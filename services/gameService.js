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

async function createGame(hostId, entryFee) {
  let code;
  do {
    code = generateGameCode();
  } while (await Game.exists({ code }));

  return Game.create({
    code,
    entryFee,
    hostId,
    status: "waiting",
    players: [],
    calledNumbers: [],
    pot: 0,
  });
}

async function joinGame(gameCode, user) {
  const game = await Game.findOne({
    code: String(gameCode).toUpperCase(),
    status: "waiting",
  });

  if (!game) return { error: "Game not found or already started." };
  if (game.players.length >= config.maxPlayersPerGame) {
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

  const freshUser = await User.findOne({ telegramId: user.telegramId });
  freshUser.balance -= game.entryFee;
  await freshUser.save();

  const { card, marked } = generateCard();
  game.players.push({
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    card,
    marked,
  });
  game.pot += game.entryFee;
  await game.save();

  return { game, user: freshUser };
}

async function joinQuickMatch(user, entryFee) {
  let game = await findWaitingGameByStake(entryFee);
  if (!game) {
    game = await createGame(user.telegramId, entryFee);
  }
  return joinGame(game.code, user);
}

async function startGame(game, bot) {
  if (game.status !== "waiting") return { error: "Game already started." };
  if (game.players.length < config.minPlayersToStart) {
    return {
      error: `Need at least ${config.minPlayersToStart} players (now ${game.players.length}).`,
    };
  }

  game.status = "playing";
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

  game.status = "finished";
  game.winnerId = player.telegramId;
  game.winnerName = player.firstName || player.username || "Player";
  await game.save();

  const winner = await User.findOne({ telegramId: player.telegramId });
  if (winner) {
    winner.balance += game.pot;
    winner.gamesWon = (winner.gamesWon || 0) + 1;
    winner.gamesPlayed = (winner.gamesPlayed || 0) + 1;
    await winner.save();
  }

  for (const p of game.players) {
    if (p.telegramId === player.telegramId) continue;
    const u = await User.findOne({ telegramId: p.telegramId });
    if (u) {
      u.gamesPlayed = (u.gamesPlayed || 0) + 1;
      await u.save();
    }
  }

  const winMsg =
    `🎉 *BINGO! Game ${game.code}*\n\n` +
    `Winner: *${game.winnerName}*\n` +
    `Line: ${lines.join(", ")}\n` +
    `Prize: *${game.pot}* Birr`;

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
  await game.save();

  for (const p of game.players) {
    const u = await User.findOne({ telegramId: p.telegramId });
    if (u) {
      u.balance += game.entryFee;
      await u.save();
    }
    try {
      await bot.telegram.sendMessage(
        p.telegramId,
        `Game ${game.code} ended — all ${MAX} numbers called. Entry refunded.`
      );
    } catch (_) {}
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
};
