const Game = require("../models/Game");
const User = require("../models/User");
const config = require("../config");
const {
  generateCard,
  generateGameCode,
  pickNextNumber,
  markNumber,
  checkBingo,
  formatCall,
  formatCard,
  MAX,
} = require("./bingo");

const activeLoops = new Map();

async function listOpenGames() {
  return Game.find({ status: "waiting" })
    .sort({ createdAt: -1 })
    .limit(15)
    .lean();
}

async function findWaitingGameByStake(entryFee) {
  return Game.findOne({ status: "waiting", entryFee }).sort({ createdAt: -1 });
}

async function createGame(hostId, entryFee, maxPlayers = config.maxPlayersPerGame) {
  let code;
  do {
    code = generateGameCode();
  } while (await Game.exists({ code }));

  return Game.create({
    code,
    entryFee,
    maxPlayers,
    hostId,
    status: "waiting",
    players: [],
    calledNumbers: [],
    pot: 0,
  });
}

async function joinGame(gameCode, user, bot) {
  const codeNormalized = String(gameCode).toUpperCase();
  const game = await Game.findOne({
    code: codeNormalized,
    status: "waiting",
  });

  if (!game) return { error: "Game not found or already started." };
  
  const freshUserCheck = await User.findOne({ telegramId: user.telegramId });
  if (freshUserCheck && freshUserCheck.isBanned) {
    return { error: "You are banned from playing." };
  }

  const maxPlayers = game.maxPlayers || config.maxPlayersPerGame;
  if (game.players.length >= maxPlayers) {
    return { error: "This room is full." };
  }
  if (game.players.some((p) => p.telegramId === user.telegramId)) {
    return { error: "You are already in this game." };
  }
  if (user.balance < game.entryFee) {
    return {
      error: `Need ${game.entryFee} Birr. Your balance: ${user.balance} Birr`,
    };
  }

  // Atomic deduction
  const freshUser = await User.findOneAndUpdate(
    { telegramId: user.telegramId, balance: { $gte: game.entryFee }, isBanned: { $ne: true } },
    { $inc: { balance: -game.entryFee } },
    { new: true }
  );
  if (!freshUser) {
    return { error: "Insufficient balance or your account is banned." };
  }

  const { card, marked } = generateCard();
  
  // Atomic push & pot increase
  const updatedGame = await Game.findOneAndUpdate(
    {
      code: codeNormalized,
      status: "waiting",
      "players.telegramId": { $ne: user.telegramId },
      [`players.${maxPlayers - 1}`]: { $exists: false }
    },
    {
      $push: {
        players: {
          telegramId: user.telegramId,
          username: user.username,
          firstName: user.firstName,
          card,
          marked,
          hasBingo: false
        }
      },
      $inc: { pot: game.entryFee }
    },
    { new: true }
  );

  // If update failed (e.g. room filled up or game started/cancelled in the split second)
  if (!updatedGame) {
    // Refund the deducted fee
    await User.findOneAndUpdate(
      { telegramId: user.telegramId },
      { $inc: { balance: game.entryFee } }
    );
    
    // Find precise error
    const gameCheck = await Game.findOne({ code: codeNormalized });
    if (!gameCheck) return { error: "Game not found." };
    if (gameCheck.status !== "waiting") return { error: "Game already started." };
    if (gameCheck.players.some((p) => p.telegramId === user.telegramId)) {
      return { error: "You are already in this game." };
    }
    return { error: "This room is full." };
  }

  // Auto-start check
  if (updatedGame.players.length >= maxPlayers) {
    // Fire & forget start
    startGame(updatedGame, bot).catch(console.error);
  }

  return { game: updatedGame, user: freshUser };
}

async function joinQuickMatch(user, entryFee, bot) {
  const game = await findWaitingGameByStake(entryFee);
  if (!game) {
    return { error: "No open rooms available at this stake. Please wait for an administrator to create one." };
  }
  return joinGame(game.code, user, bot);
}

async function startGame(game, bot) {
  if (game.status !== "waiting") return { error: "Game already started." };
  if (game.players.length < config.minPlayersToStart) {
    return {
      error: `Need at least ${config.minPlayersToStart} players (now ${game.players.length}).`,
    };
  }

  game.status = "playing";
  game.gameStartedAt = new Date();
  await game.save();

  const msg =
    `🎮 *Game ${game.code} started!*\n\n` +
    `Stake: ${game.entryFee} Birr · Pot: ${game.pot} Birr\n` +
    `Numbers: 1–${MAX}\n\n` +
    `Tap *🏆 BINGO!* when you complete a line.`;

  for (const p of game.players) {
    try {
      await bot.telegram.sendMessage(p.telegramId, msg, { parse_mode: "Markdown" });
    } catch (_) {}
  }

  const loop = setInterval(() => runCallTick(game.code, bot), config.callIntervalMs);
  activeLoops.set(game.code, loop);

  return { game };
}

async function runCallTick(gameCode, bot) {
  const game = await Game.findOne({ code: gameCode, status: "playing" });
  if (!game) {
    stopGameLoop(gameCode);
    return;
  }

  const next = pickNextNumber(game.calledNumbers);
  if (next === null) {
    await endGameNoWinner(game, bot);
    return;
  }

  game.calledNumbers.push(next);
  game.currentCall = { letter: "", number: next };

  for (const player of game.players) {
    const { marked } = markNumber(player.card, player.marked, next);
    player.marked = marked;
  }

  await game.save();

  const callNum = game.calledNumbers.length;
  const recent = game.calledNumbers.slice(-6).map(formatCall).join(" · ");

  for (const p of game.players) {
    try {
      const pl = game.players.find((x) => x.telegramId === p.telegramId);
      await bot.telegram.sendMessage(
        p.telegramId,
        `📢 *#${callNum}* → *${formatCall(next)}*\n\n` +
          `Recent: ${recent}\n` +
          `Pot: *${game.pot}* Birr · Players: ${game.players.length}\n\n` +
          `Your card:\n${formatCard(pl.card, pl.marked)}`,
        { parse_mode: "Markdown" }
      );
    } catch (_) {}
  }
}

async function claimBingo(gameCode, telegramId, bot) {
  const game = await Game.findOne({ code: gameCode, status: "playing" });
  if (!game) return { error: "You are not in an active game." };

  const player = game.players.find((p) => p.telegramId === telegramId);
  if (!player) return { error: "You are not in this game." };

  const lines = checkBingo(player.marked);
  if (lines.length === 0) {
    return { error: "No bingo yet! Complete a row, column, or diagonal first." };
  }

  return awardWinner(game, player, lines, bot);
}

async function awardWinner(game, player, lines, bot) {
  stopGameLoop(game.code);

  const houseFee = Math.round(game.pot * 0.3);
  const winnerPrize = game.pot - houseFee;

  game.status = "finished";
  game.winnerId = player.telegramId;
  game.winnerName = player.firstName || player.username || "Player";
  game.houseFee = houseFee;
  game.winnerPrize = winnerPrize;
  game.gameFinishedAt = new Date();
  if (game.gameStartedAt) {
    game.durationSeconds = Math.round((game.gameFinishedAt - game.gameStartedAt) / 1000);
  }
  await game.save();

  // Award winner atomically
  await User.findOneAndUpdate(
    { telegramId: player.telegramId },
    {
      $inc: {
        balance: winnerPrize,
        totalWinnings: winnerPrize,
        gamesWon: 1,
        gamesPlayed: 1
      }
    }
  );

  // Mark games played for others
  for (const p of game.players) {
    if (p.telegramId === player.telegramId) continue;
    await User.findOneAndUpdate(
      { telegramId: p.telegramId },
      { $inc: { gamesPlayed: 1 } }
    );
  }

  // Create lightweight GameHistory doc
  try {
    const GameHistory = require("../models/GameHistory");
    await GameHistory.create({
      code: game.code,
      entryFee: game.entryFee,
      playerCount: game.players.length,
      pot: game.pot,
      houseFee: game.houseFee,
      winnerPrize: game.winnerPrize,
      status: "finished",
      winner: {
        telegramId: player.telegramId,
        username: player.username,
        firstName: player.firstName
      },
      players: game.players.map(p => ({
        telegramId: p.telegramId,
        username: p.username,
        firstName: p.firstName
      })),
      totalNumbersCalled: game.calledNumbers.length,
      durationSeconds: game.durationSeconds,
      finishedAt: game.gameFinishedAt
    });
  } catch (err) {
    console.error("Failed to save game history:", err);
  }

  const winMsg =
    `🎉 *BINGO! Game ${game.code}*\n\n` +
    `Winner: *${game.winnerName}*\n` +
    `Line: ${lines.join(", ")}\n` +
    `Prize: *${winnerPrize}* Birr (after 30% fee)\n` +
    `House Fee: *${houseFee}* Birr`;

  for (const p of game.players) {
    try {
      await bot.telegram.sendMessage(p.telegramId, winMsg, { parse_mode: "Markdown" });
    } catch (_) {}
  }

  return { success: true, game, lines };
}

async function endGameNoWinner(game, bot) {
  stopGameLoop(game.code);
  game.status = "finished";
  game.houseFee = 0;
  game.winnerPrize = 0;
  game.gameFinishedAt = new Date();
  if (game.gameStartedAt) {
    game.durationSeconds = Math.round((game.gameFinishedAt - game.gameStartedAt) / 1000);
  }
  await game.save();

  for (const p of game.players) {
    await User.findOneAndUpdate(
      { telegramId: p.telegramId },
      { $inc: { balance: game.entryFee } }
    );
    try {
      await bot.telegram.sendMessage(
        p.telegramId,
        `Game ${game.code} ended — all ${MAX} numbers called. Entry refunded.`
      );
    } catch (_) {}
  }

  // Create lightweight GameHistory doc
  try {
    const GameHistory = require("../models/GameHistory");
    await GameHistory.create({
      code: game.code,
      entryFee: game.entryFee,
      playerCount: game.players.length,
      pot: game.pot,
      houseFee: 0,
      winnerPrize: 0,
      status: "no_winner",
      players: game.players.map(p => ({
        telegramId: p.telegramId,
        username: p.username,
        firstName: p.firstName
      })),
      totalNumbersCalled: game.calledNumbers.length,
      durationSeconds: game.durationSeconds,
      finishedAt: game.gameFinishedAt
    });
  } catch (err) {
    console.error("Failed to save game history:", err);
  }
}

function stopGameLoop(gameCode) {
  const loop = activeLoops.get(gameCode);
  if (loop) {
    clearInterval(loop);
    activeLoops.delete(gameCode);
  }
}

async function getActiveGameForUser(telegramId) {
  return Game.findOne({
    status: "playing",
    "players.telegramId": telegramId,
  });
}

async function getWaitingGameForUser(telegramId) {
  return Game.findOne({
    status: "waiting",
    "players.telegramId": telegramId,
  });
}

async function cancelGame(gameCode, bot) {
  const game = await Game.findOne({ code: String(gameCode).toUpperCase() });
  if (!game) return { error: "Game not found." };
  if (game.status === "finished" || game.status === "cancelled") {
    return { error: `Game is already ${game.status}.` };
  }

  stopGameLoop(game.code);

  game.status = "cancelled";
  game.gameFinishedAt = new Date();
  if (game.gameStartedAt) {
    game.durationSeconds = Math.round((game.gameFinishedAt - game.gameStartedAt) / 1000);
  }
  await game.save();

  for (const p of game.players) {
    await User.findOneAndUpdate(
      { telegramId: p.telegramId },
      { $inc: { balance: game.entryFee } }
    );
    try {
      await bot.telegram.sendMessage(
        p.telegramId,
        `⚠️ *Game Cancelled*\n\nGame \`${game.code}\` was cancelled by an administrator. Your entry fee of *${game.entryFee} Birr* has been refunded.`,
        { parse_mode: "Markdown" }
      );
    } catch (_) {}
  }

  // Create lightweight GameHistory doc
  try {
    const GameHistory = require("../models/GameHistory");
    await GameHistory.create({
      code: game.code,
      entryFee: game.entryFee,
      playerCount: game.players.length,
      pot: game.pot,
      houseFee: 0,
      winnerPrize: 0,
      status: "cancelled",
      players: game.players.map(p => ({
        telegramId: p.telegramId,
        username: p.username,
        firstName: p.firstName
      })),
      totalNumbersCalled: game.calledNumbers.length,
      durationSeconds: game.durationSeconds,
      finishedAt: game.gameFinishedAt
    });
  } catch (err) {
    console.error("Failed to save cancel game history:", err);
  }

  return { success: true };
}

async function recoverOrphanedGames(bot) {
  try {
    const orphanedGames = await Game.find({ status: "playing" });
    if (orphanedGames.length === 0) return;

    console.log(`🔍 Found ${orphanedGames.length} orphaned active games. Cancelling and refunding...`);

    for (const game of orphanedGames) {
      game.status = "cancelled";
      game.gameFinishedAt = new Date();
      if (game.gameStartedAt) {
        game.durationSeconds = Math.round((game.gameFinishedAt - game.gameStartedAt) / 1000);
      }
      await game.save();

      for (const p of game.players) {
        await User.findOneAndUpdate(
          { telegramId: p.telegramId },
          { $inc: { balance: game.entryFee } }
        );
        try {
          await bot.telegram.sendMessage(
            p.telegramId,
            `⚠️ *System Restart Notification*\n\nGame \`${game.code}\` was aborted due to a server restart. Your entry fee of *${game.entryFee} Birr* has been refunded.`,
            { parse_mode: "Markdown" }
          );
        } catch (_) {}
      }

      // Create lightweight GameHistory doc
      try {
        const GameHistory = require("../models/GameHistory");
        await GameHistory.create({
          code: game.code,
          entryFee: game.entryFee,
          playerCount: game.players.length,
          pot: game.pot,
          houseFee: 0,
          winnerPrize: 0,
          status: "cancelled_restart",
          players: game.players.map(p => ({
            telegramId: p.telegramId,
            username: p.username,
            firstName: p.firstName
          })),
          totalNumbersCalled: game.calledNumbers.length,
          durationSeconds: game.durationSeconds,
          finishedAt: game.gameFinishedAt
        });
      } catch (err) {
        console.error("Failed to save recovery game history:", err);
      }
    }
  } catch (error) {
    console.error("Error recovering orphaned games:", error);
  }
}

module.exports = {
  listOpenGames,
  createGame,
  joinGame,
  joinQuickMatch,
  startGame,
  claimBingo,
  getActiveGameForUser,
  getWaitingGameForUser,
  stopGameLoop,
  cancelGame,
  recoverOrphanedGames,
};
