const store = require("../storage/memory");
const config = require("../config");
const {
  generateCard,
  generateGameCode,
  pickNextNumber,
  markNumber,
  checkBingo,
  formatCall,
  formatCard,
  numberToLetter,
} = require("./bingo");

const activeLoops = new Map();

async function listOpenGames() {
  return store
    .listGames((g) => g.status === "waiting")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10);
}

async function createGame(hostId, entryFee = config.defaultEntryFee) {
  let code;
  do {
    code = generateGameCode();
  } while (store.gameCodeExists(code));

  const game = {
    code,
    entryFee,
    hostId,
    status: "waiting",
    players: [],
    calledNumbers: [],
    pot: 0,
    createdAt: new Date(),
  };

  store.saveGame(game);
  return game;
}

async function joinGame(gameCode, user) {
  const game = store.getGame(gameCode);
  if (!game || game.status !== "waiting") {
    return { error: "Game not found or already started." };
  }

  if (game.players.some((p) => p.telegramId === user.telegramId)) {
    return { error: "You are already in this game." };
  }

  if (user.balance < game.entryFee) {
    return { error: `Need ${game.entryFee} points. Your balance: ${user.balance}` };
  }

  const { card, marked } = generateCard();
  user.balance -= game.entryFee;
  store.saveUser(user);

  game.players.push({
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    card,
    marked,
  });
  game.pot += game.entryFee;
  store.saveGame(game);

  return { game, user };
}

async function startGame(game, bot) {
  if (game.status !== "waiting") return { error: "Game already started." };
  if (game.players.length < config.minPlayersToStart) {
    return { error: `Need at least ${config.minPlayersToStart} players.` };
  }

  game.status = "playing";
  store.saveGame(game);

  const notify = async (text) => {
    for (const p of game.players) {
      try {
        await bot.telegram.sendMessage(p.telegramId, text, { parse_mode: "Markdown" });
      } catch (_) {}
    }
  };

  await notify(
    `🎮 *Game ${game.code} started!*\nNumbers will be called every few seconds.\nTap *🏆 BINGO!* when you complete a line.`
  );

  const loop = setInterval(() => runCallTick(game.code, bot), config.callIntervalMs);
  activeLoops.set(game.code, loop);

  return { game };
}

async function runCallTick(gameCode, bot) {
  const game = store.getGame(gameCode);
  if (!game || game.status !== "playing") {
    stopGameLoop(gameCode);
    return;
  }

  const next = pickNextNumber(game.calledNumbers);
  if (next === null) {
    await endGameNoWinner(game, bot);
    return;
  }

  game.calledNumbers.push(next);
  game.currentCall = { letter: numberToLetter(next), number: next };

  for (const player of game.players) {
    const { marked } = markNumber(player.card, player.marked, next);
    player.marked = marked;
  }

  store.saveGame(game);

  const recent = game.calledNumbers.slice(-8).map(formatCall).join(" · ");
  const msg = `📢 *${formatCall(next)}*\n\nRecent: ${recent}\n\nPlayers: ${game.players.length} · Pot: *${game.pot}* pts`;

  for (const p of game.players) {
    try {
      const pl = game.players.find((x) => x.telegramId === p.telegramId);
      await bot.telegram.sendMessage(
        p.telegramId,
        `${msg}\n\nYour card:\n${formatCard(pl.card, pl.marked)}`,
        { parse_mode: "Markdown" }
      );
    } catch (_) {}
  }
}

async function claimBingo(gameCode, telegramId, bot) {
  const game = store.getGame(gameCode);
  if (!game || game.status !== "playing") {
    return { error: "No active game found." };
  }

  const player = game.players.find((p) => p.telegramId === telegramId);
  if (!player) return { error: "You are not in this game." };

  const lines = checkBingo(player.marked);
  if (lines.length === 0) {
    return { error: "No bingo yet! Keep playing." };
  }

  return await awardWinner(game, player, lines, bot);
}

async function awardWinner(game, player, lines, bot) {
  stopGameLoop(game.code);

  game.status = "finished";
  game.winnerId = player.telegramId;
  game.winnerName = player.firstName || player.username || "Player";
  store.saveGame(game);

  const winner = store.getUser(player.telegramId);
  if (winner) {
    winner.balance += game.pot;
    winner.gamesWon += 1;
    winner.gamesPlayed += 1;
    store.saveUser(winner);
  }

  for (const p of game.players) {
    const u = store.getUser(p.telegramId);
    if (u && p.telegramId !== player.telegramId) {
      u.gamesPlayed += 1;
      store.saveUser(u);
    }
  }

  const winMsg =
    `🎉 *BINGO! Game ${game.code}*\n\n` +
    `Winner: *${game.winnerName}*\n` +
    `Line: ${lines.join(", ")}\n` +
    `Prize: *${game.pot}* points`;

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
  store.saveGame(game);

  for (const p of game.players) {
    const u = store.getUser(p.telegramId);
    if (u) {
      u.balance += game.entryFee;
      store.saveUser(u);
    }
    try {
      await bot.telegram.sendMessage(
        p.telegramId,
        `Game ${game.code} ended — all numbers called. Entry fees refunded.`
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
  return (
    store.listGames(
      (g) => g.status === "playing" && g.players.some((p) => p.telegramId === telegramId)
    )[0] || null
  );
}

async function getWaitingGameForUser(telegramId) {
  return (
    store.listGames(
      (g) => g.status === "waiting" && g.players.some((p) => p.telegramId === telegramId)
    )[0] || null
  );
}

module.exports = {
  listOpenGames,
  createGame,
  joinGame,
  startGame,
  claimBingo,
  getActiveGameForUser,
  getWaitingGameForUser,
  stopGameLoop,
};
