const config = require("../config");
const { mainMenu, playMenu, stakeKeyboard } = require("../keyboards/menus");
const { requireRegistered, getUserByTelegramId } = require("../services/userService");
const { formatCard, MAX } = require("../services/bingo");
const SelectedStake = require("../models/SelectedStake");
const {
  listOpenGames,
  createGame,
  joinGame,
  joinQuickMatch,
  startGame,
  claimBingo,
  getActiveGameForUser,
  getWaitingGameForUser,
} = require("../services/gameService");

const awaitingGameCode = new Set();

function registerGameHandlers(bot) {
  bot.hears("🎮 Play", async (ctx) => {
    const user = await requireRegistered(ctx);
    if (!user) return;

    const active = await getActiveGameForUser(user.telegramId);
    if (active) {
      return ctx.reply(
        `You are in game \`${active.code}\` (${active.status}).\nTap 🏆 BINGO! when you have a line.`,
        { parse_mode: "Markdown", ...mainMenu() }
      );
    }

    await ctx.reply(
      `🎮 *Fraol Bingo* (numbers 1–${MAX})\n\n` +
        `Choose how to play:\n` +
        `• *Quick Join* — join a waiting room for a stake\n` +
        `• *Create Room* — host a new game (Admin only)\n` +
        `• *Join by Code* — enter room code from a friend\n` +
        `• *Start Game* — host starts when enough players joined`,
      { parse_mode: "Markdown", ...playMenu() }
    );
  });

  bot.hears("⬅️ Back", async (ctx) => {
    awaitingGameCode.delete(ctx.from.id);
    await SelectedStake.deleteOne({ telegramId: ctx.from.id });
    await ctx.reply("Main menu:", mainMenu());
  });

  bot.hears(["⚡ Quick Join", "➕ Create Room"], async (ctx) => {
    const user = await requireRegistered(ctx);
    if (!user) return;

    const isCreate = ctx.message.text.includes("Create");
    if (isCreate && !config.adminIds.includes(ctx.from.id)) {
      return ctx.reply("⛔ Room creation is restricted to administrators.", playMenu());
    }

    await SelectedStake.findOneAndUpdate(
      { telegramId: ctx.from.id },
      { mode: isCreate ? "create" : "quick" },
      { upsert: true, new: true }
    );

    await ctx.reply(
      `💵 Choose *stake* (entry fee in Birr):`,
      { parse_mode: "Markdown", ...stakeKeyboard() }
    );
  });

  bot.action(/^stake:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const user = await requireRegistered(ctx);
      if (!user) return;

      const stake = Number(ctx.match[1]);
      const pending = await SelectedStake.findOne({ telegramId: ctx.from.id }).lean();
      if (!pending) {
        return ctx.reply("Tap ⚡ Quick Join or ➕ Create Room first.", playMenu());
      }

      if (pending.mode === "create" && !config.adminIds.includes(ctx.from.id)) {
        await SelectedStake.deleteOne({ telegramId: ctx.from.id });
        return ctx.reply("⛔ Room creation is restricted to administrators.", playMenu());
      }

      await SelectedStake.deleteOne({ telegramId: ctx.from.id });

      if (user.balance < stake) {
        return ctx.reply(
          `Need ${stake} Birr. Your balance: ${user.balance} Birr.\nUse 💳 Deposit first.`,
          playMenu()
        );
      }

      let result;
      if (pending.mode === "quick") {
        result = await joinQuickMatch(user, stake, bot);
      } else {
        const game = await createGame(user.telegramId, stake);
        result = await joinGame(game.code, user, bot);
      }

      if (result.error) {
        return ctx.reply(result.error, playMenu());
      }

      const g = result.game;
      const me = g.players.find((p) => p.telegramId === user.telegramId);

      await ctx.reply(
        `✅ Joined room \`${g.code}\`\n\n` +
          `Stake: *${g.entryFee}* Birr · Pot: *${g.pot}* Birr\n` +
          `Players: ${g.players.length} / ${g.maxPlayers || config.maxPlayersPerGame} (auto-start when full)\n\n` +
          (g.hostId === user.telegramId
            ? `You are the host — tap *▶️ Start Game* to start manually, or wait for players to auto-start.\n\n`
            : `Waiting for players / host to start…\n\n`) +
          `Your card:\n${formatCard(me.card, me.marked)}`,
        { parse_mode: "Markdown", ...playMenu() }
      );
    } catch (error) {
      console.error("Stake join error:", error);
      await ctx.reply("⚠️ Could not join game.", playMenu());
    }
  });

  bot.action("deposit_cancel", async (ctx) => {
    // Kept to avoid breaking references, handled by deposit module
    await ctx.answerCbQuery("Cancelled");
  });

  bot.action("stake_cancel", async (ctx) => {
    await ctx.answerCbQuery("Cancelled");
    await SelectedStake.deleteOne({ telegramId: ctx.from.id });
    await ctx.reply("Cancelled.", playMenu());
  });

  bot.hears("🔍 Join by Code", async (ctx) => {
    const user = await requireRegistered(ctx);
    if (!user) return;

    awaitingGameCode.add(ctx.from.id);
    await ctx.reply("Send the *room code* (e.g. `AB12CD`):", {
      parse_mode: "Markdown",
      ...playMenu(),
    });
  });

  bot.hears("📋 Open Rooms", async (ctx) => {
    const user = await requireRegistered(ctx);
    if (!user) return;

    const games = await listOpenGames();
    if (games.length === 0) {
      return ctx.reply("No open rooms. Wait for an admin to create one.", playMenu());
    }

    const lines = games.map(
      (g) =>
        `\`${g.code}\` — ${g.entryFee} Birr · ${g.players.length}/${g.maxPlayers || config.maxPlayersPerGame} players · pot ${g.pot}`
    );

    await ctx.reply(`📋 *Open rooms*\n\n${lines.join("\n")}`, {
      parse_mode: "Markdown",
      ...playMenu(),
    });
  });

  bot.hears("▶️ Start Game", async (ctx) => {
    try {
      const user = await requireRegistered(ctx);
      if (!user) return;

      const game = await getWaitingGameForUser(user.telegramId);
      if (!game) {
        return ctx.reply("You are not in a waiting room. Join or create one first.", playMenu());
      }

      if (game.hostId !== user.telegramId) {
        return ctx.reply("Only the host who created the room can start.", playMenu());
      }

      const result = await startGame(game, bot);
      if (result.error) {
        return ctx.reply(result.error, playMenu());
      }

      await ctx.reply(
        `🎮 Game \`${game.code}\` is live!\nNumbers 1–${MAX} are being called.`,
        { parse_mode: "Markdown", ...mainMenu() }
      );
    } catch (error) {
      console.error("Start game error:", error);
      await ctx.reply("⚠️ Could not start game.", playMenu());
    }
  });

  bot.hears("🏆 BINGO!", async (ctx) => {
    try {
      const user = await requireRegistered(ctx);
      if (!user) return;

      const active = await getActiveGameForUser(user.telegramId);
      if (!active) {
        return ctx.reply("You are not in an active game.", mainMenu());
      }

      const result = await claimBingo(active.code, user.telegramId, bot);
      if (result.error) {
        return ctx.reply(result.error, mainMenu());
      }

      const fresh = await getUserByTelegramId(user.telegramId);
      await ctx.reply(
        `🎉 *You won!*\n\nPrize *${result.game.winnerPrize}* Birr (after 30% fee) added.\n💰 Balance: *${fresh.balance}* Birr`,
        { parse_mode: "Markdown", ...mainMenu() }
      );
    } catch (error) {
      console.error("Bingo claim error:", error);
      await ctx.reply("⚠️ Could not claim BINGO.", mainMenu());
    }
  });

  bot.on("text", async (ctx, next) => {
    const text = ctx.message.text?.trim();
    if (!awaitingGameCode.has(ctx.from.id)) return next();

    const menuButtons = [
      "🎮 Play",
      "🏆 BINGO!",
      "💰 Balance",
      "💳 Deposit",
      "💸 Withdraw",
      "📖 Instructions",
      "📞 Support",
      "🔗 Invite",
      "⚡ Quick Join",
      "➕ Create Room",
      "🔍 Join by Code",
      "📋 Open Rooms",
      "▶️ Start Game",
      "⬅️ Back",
    ];
    if (!text || menuButtons.includes(text) || text.startsWith("/")) return next();

    awaitingGameCode.delete(ctx.from.id);

    const user = await requireRegistered(ctx);
    if (!user) return;

    const result = await joinGame(text, user, bot);
    if (result.error) {
      return ctx.reply(result.error, playMenu());
    }

    const g = result.game;
    const me = g.players.find((p) => p.telegramId === user.telegramId);

    await ctx.reply(
      `✅ Joined \`${g.code}\` · ${g.players.length}/${g.maxPlayers || config.maxPlayersPerGame} players · pot ${g.pot} Birr\n\n` +
        `Your card:\n${formatCard(me.card, me.marked)}`,
      { parse_mode: "Markdown", ...playMenu() }
    );
  });
}

module.exports = registerGameHandlers;
