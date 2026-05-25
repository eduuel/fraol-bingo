const config = require("../config");
const {
  approveDeposit,
  rejectDeposit,
  listPendingDeposits,
} = require("../services/depositService");
const {
  approveWithdrawal,
  rejectWithdrawal,
  listPendingWithdrawals,
} = require("../services/withdrawService");

function isAdmin(telegramId) {
  return config.adminIds.includes(telegramId);
}

async function notifyUser(bot, telegramId, text) {
  try {
    await bot.telegram.sendMessage(telegramId, text, { parse_mode: "Markdown" });
  } catch (err) {
    console.error(`Could not notify user ${telegramId}:`, err.message);
  }
}

function registerAdminHandlers(bot) {
  bot.action(/^dep_approve:(.+)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
      return ctx.answerCbQuery("Admin only", { show_alert: true });
    }

    try {
      const depositId = ctx.match[1];
      const result = await approveDeposit(depositId, ctx.from.id);

      if (result.error) {
        return ctx.answerCbQuery(result.error, { show_alert: true });
      }

      const { deposit, user } = result;

      await ctx.answerCbQuery("Approved ✅");
      await ctx.editMessageCaption(
        `${ctx.callbackQuery.message.caption}\n\n✅ *APPROVED* by admin`,
        { parse_mode: "Markdown" }
      ).catch(() => {});

      await notifyUser(
        bot,
        deposit.telegramId,
        `✅ *Deposit approved!*\n\n` +
          `+${deposit.amount} Birr added to your account.\n` +
          `💰 New balance: *${user.balance} Birr*`
      );
    } catch (error) {
      console.error("Approve deposit error:", error);
      await ctx.answerCbQuery("Failed to approve", { show_alert: true });
    }
  });

  bot.action(/^dep_reject:(.+)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
      return ctx.answerCbQuery("Admin only", { show_alert: true });
    }

    try {
      const depositId = ctx.match[1];
      const result = await rejectDeposit(depositId, ctx.from.id);

      if (result.error) {
        return ctx.answerCbQuery(result.error, { show_alert: true });
      }

      const { deposit } = result;

      await ctx.answerCbQuery("Rejected ❌");
      await ctx.editMessageCaption(
        `${ctx.callbackQuery.message.caption}\n\n❌ *REJECTED* by admin`,
        { parse_mode: "Markdown" }
      ).catch(() => {});

      await notifyUser(
        bot,
        deposit.telegramId,
        `❌ *Deposit rejected*\n\n` +
          `Amount: ${deposit.amount} Birr\n\n` +
          `Please contact support or send a clearer screenshot via 💳 Deposit.`
      );
    } catch (error) {
      console.error("Reject deposit error:", error);
      await ctx.answerCbQuery("Failed to reject", { show_alert: true });
    }
  });

  bot.command("pending", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Admin only.");

    const list = await listPendingDeposits();
    if (list.length === 0) {
      return ctx.reply("No pending deposits.");
    }

    const lines = list.map(
      (d) =>
        `\`${d._id}\` — ${d.amount} Birr — ${d.firstName || d.telegramId} (@${d.username || "—"})`
    );

    await ctx.reply(`📋 *Pending deposits*\n\n${lines.join("\n")}`, {
      parse_mode: "Markdown",
    });
  });

  bot.command("approve", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Admin only.");

    const id = ctx.message.text.split(" ")[1];
    if (!id) return ctx.reply("Usage: /approve <deposit_id>");

    const result = await approveDeposit(id, ctx.from.id);
    if (result.error) return ctx.reply(result.error);

    const { deposit, user } = result;
    await ctx.reply(`Approved ${deposit.amount} Birr. User balance: ${user.balance}`);

    await notifyUser(
      bot,
      deposit.telegramId,
      `✅ Deposit approved! +${deposit.amount} Birr\n💰 Balance: ${user.balance} Birr`
    );
  });

  bot.command("reject", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Admin only.");

    const id = ctx.message.text.split(" ")[1];
    if (!id) return ctx.reply("Usage: /reject <deposit_id>");

    const result = await rejectDeposit(id, ctx.from.id);
    if (result.error) return ctx.reply(result.error);

    await ctx.reply("Deposit rejected.");
    await notifyUser(
      bot,
      result.deposit.telegramId,
      `❌ Your deposit of ${result.deposit.amount} Birr was rejected. Contact support.`
    );
  });

  bot.action(/^wd_approve:(.+)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
      return ctx.answerCbQuery("Admin only", { show_alert: true });
    }

    try {
      const result = await approveWithdrawal(ctx.match[1], ctx.from.id);
      if (result.error) {
        return ctx.answerCbQuery(result.error, { show_alert: true });
      }

      const { withdrawal, user } = result;

      await ctx.answerCbQuery("Withdrawal approved ✅");
      await ctx.editMessageText(
        `${ctx.callbackQuery.message.text}\n\n✅ *PAID & APPROVED*`,
        { parse_mode: "Markdown" }
      ).catch(() => {});

      await notifyUser(
        bot,
        withdrawal.telegramId,
        `✅ *Withdrawal completed!*\n\n` +
          `${withdrawal.amount} Birr sent to \`${withdrawal.phoneNumber}\`\n` +
          `💰 Balance: *${user?.balance ?? 0} Birr*`
      );
    } catch (error) {
      console.error("Approve withdrawal error:", error);
      await ctx.answerCbQuery("Failed", { show_alert: true });
    }
  });

  bot.action(/^wd_reject:(.+)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
      return ctx.answerCbQuery("Admin only", { show_alert: true });
    }

    try {
      const result = await rejectWithdrawal(ctx.match[1], ctx.from.id);
      if (result.error) {
        return ctx.answerCbQuery(result.error, { show_alert: true });
      }

      const { withdrawal, user } = result;

      await ctx.answerCbQuery("Rejected — balance refunded");
      await ctx.editMessageText(
        `${ctx.callbackQuery.message.text}\n\n❌ *REJECTED* — refunded to user`,
        { parse_mode: "Markdown" }
      ).catch(() => {});

      await notifyUser(
        bot,
        withdrawal.telegramId,
        `❌ *Withdrawal rejected*\n\n` +
          `${withdrawal.amount} Birr returned to your account.\n` +
          `💰 Balance: *${user?.balance ?? 0} Birr*`
      );
    } catch (error) {
      console.error("Reject withdrawal error:", error);
      await ctx.answerCbQuery("Failed", { show_alert: true });
    }
  });

  bot.command("pendingwd", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Admin only.");

    const list = await listPendingWithdrawals();
    if (list.length === 0) return ctx.reply("No pending withdrawals.");

    const lines = list.map(
      (w) =>
        `\`${w._id}\` — ${w.amount} Birr → ${w.phoneNumber} — ${w.firstName || w.telegramId}`
    );

    await ctx.reply(`📤 *Pending withdrawals*\n\n${lines.join("\n")}`, {
      parse_mode: "Markdown",
    });
  });

  bot.command("admin", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Admin only.");

    await ctx.reply(
      `🛠 *Admin commands*\n\n` +
        `/status — bot health + stats (admin view)\n\n` +
        `*Rooms*\n` +
        `/createroom <fee> [maxPlayers] — create a bingo room\n` +
        `/rooms — list active and waiting rooms\n` +
        `/closeroom <code> — force-cancel and refund room\n\n` +
        `*Users*\n` +
        `/ban <telegramId> — ban a user from playing\n` +
        `/unban <telegramId> — unban a user\n` +
        `/addbalance <telegramId> <amount> — add balance to a user\n` +
        `/deductbalance <telegramId> <amount> — deduct balance from a user\n\n` +
        `*Deposits*\n` +
        `/pending — list pending deposits\n` +
        `/approve <id> — approve deposit\n` +
        `/reject <id> — reject deposit\n\n` +
        `*Withdrawals*\n` +
        `/pendingwd — list pending withdrawals\n` +
        `Use ✅/❌ inline buttons on deposit/withdrawal alerts.`,
      { parse_mode: "Markdown" }
    );
  });

  bot.command("createroom", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Admin only.");

    const args = ctx.message.text.split(" ").slice(1);
    if (args.length === 0) {
      return ctx.reply("Usage: /createroom <fee> [maxPlayers]\nExample: /createroom 50 10");
    }

    const fee = Number(args[0]);
    if (isNaN(fee) || fee <= 0) {
      return ctx.reply("Error: Stake fee must be a valid positive number.");
    }

    const maxPlayers = args[1] ? Number(args[1]) : config.maxPlayersPerGame;
    if (isNaN(maxPlayers) || maxPlayers < 2) {
      return ctx.reply("Error: Max players must be at least 2.");
    }

    try {
      const { createGame } = require("../services/gameService");
      const game = await createGame(ctx.from.id, fee, maxPlayers);
      await ctx.reply(
        `✅ *Bingo Room Created!*\n\n` +
          `Room Code: \`${game.code}\`\n` +
          `Entry Fee: *${game.entryFee} Birr*\n` +
          `Max Players: *${game.maxPlayers}*`,
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      console.error("Admin createroom error:", err);
      await ctx.reply("⚠️ Failed to create room: " + err.message);
    }
  });

  bot.command("rooms", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Admin only.");

    try {
      const Game = require("../models/Game");
      const rooms = await Game.find({ status: { $in: ["waiting", "playing"] } }).sort({ status: -1, createdAt: -1 });

      if (rooms.length === 0) {
        return ctx.reply("There are no active or waiting rooms currently.");
      }

      const lines = rooms.map(
        (r) =>
          `• \`${r.code}\` [${r.status.toUpperCase()}] Fee: ${r.entryFee} Birr | Players: ${r.players.length}/${r.maxPlayers || config.maxPlayersPerGame} | Pot: ${r.pot} Birr`
      );

      await ctx.reply(`📋 *Active and Waiting Rooms*\n\n${lines.join("\n")}`, {
        parse_mode: "Markdown",
      });
    } catch (err) {
      console.error("Admin rooms command error:", err);
      await ctx.reply("⚠️ Failed to query rooms.");
    }
  });

  bot.command("closeroom", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Admin only.");

    const code = ctx.message.text.split(" ")[1];
    if (!code) return ctx.reply("Usage: /closeroom <code>");

    try {
      const { cancelGame } = require("../services/gameService");
      const result = await cancelGame(code, bot);
      if (result.error) {
        return ctx.reply(`❌ Error: ${result.error}`);
      }
      await ctx.reply(`✅ Room \`${code.toUpperCase()}\` has been force-closed, and all players have been refunded.`);
    } catch (err) {
      console.error("Admin closeroom error:", err);
      await ctx.reply("⚠️ Failed to close room.");
    }
  });

  bot.command("ban", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Admin only.");

    const targetId = Number(ctx.message.text.split(" ")[1]);
    if (isNaN(targetId)) return ctx.reply("Usage: /ban <telegramId>");

    try {
      const User = require("../models/User");
      const user = await User.findOneAndUpdate(
        { telegramId: targetId },
        { isBanned: true },
        { new: true }
      );

      if (!user) return ctx.reply("❌ User not found.");
      await ctx.reply(`✅ User \`${user.firstName || user.telegramId}\` (@${user.username || "—"}) has been banned.`);
    } catch (err) {
      console.error("Admin ban error:", err);
      await ctx.reply("⚠️ Failed to ban user.");
    }
  });

  bot.command("unban", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Admin only.");

    const targetId = Number(ctx.message.text.split(" ")[1]);
    if (isNaN(targetId)) return ctx.reply("Usage: /unban <telegramId>");

    try {
      const User = require("../models/User");
      const user = await User.findOneAndUpdate(
        { telegramId: targetId },
        { isBanned: false },
        { new: true }
      );

      if (!user) return ctx.reply("❌ User not found.");
      await ctx.reply(`✅ User \`${user.firstName || user.telegramId}\` (@${user.username || "—"}) has been unbanned.`);
    } catch (err) {
      console.error("Admin unban error:", err);
      await ctx.reply("⚠️ Failed to unban user.");
    }
  });

  bot.command("addbalance", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Admin only.");

    const args = ctx.message.text.split(" ").slice(1);
    if (args.length < 2) return ctx.reply("Usage: /addbalance <telegramId> <amount>");

    const targetId = Number(args[0]);
    const amount = Number(args[1]);

    if (isNaN(targetId) || isNaN(amount) || amount <= 0) {
      return ctx.reply("Error: Invalid arguments. Amount must be positive.");
    }

    try {
      const User = require("../models/User");
      const user = await User.findOneAndUpdate(
        { telegramId: targetId },
        { $inc: { balance: amount } },
        { new: true }
      );

      if (!user) return ctx.reply("❌ User not found.");
      await ctx.reply(`✅ Added *${amount} Birr* to user \`${user.firstName || user.telegramId}\` (@${user.username || "—"}).\nNew Balance: *${user.balance} Birr*`, { parse_mode: "Markdown" });

      await notifyUser(bot, targetId, `💰 *Admin Balance Adjustment*\n\nYour balance has been increased by *+${amount} Birr*.\n💰 New Balance: *${user.balance} Birr*`);
    } catch (err) {
      console.error("Admin addbalance error:", err);
      await ctx.reply("⚠️ Failed to add balance.");
    }
  });

  bot.command("deductbalance", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Admin only.");

    const args = ctx.message.text.split(" ").slice(1);
    if (args.length < 2) return ctx.reply("Usage: /deductbalance <telegramId> <amount>");

    const targetId = Number(args[0]);
    const amount = Number(args[1]);

    if (isNaN(targetId) || isNaN(amount) || amount <= 0) {
      return ctx.reply("Error: Invalid arguments. Amount must be positive.");
    }

    try {
      const User = require("../models/User");
      const user = await User.findOne({ telegramId: targetId });
      if (!user) return ctx.reply("❌ User not found.");

      if (user.balance < amount) {
        return ctx.reply(`❌ Insufficient user balance. Current balance is only ${user.balance} Birr.`);
      }

      user.balance -= amount;
      await user.save();

      await ctx.reply(`✅ Deducted *${amount} Birr* from user \`${user.firstName || user.telegramId}\` (@${user.username || "—"}).\nNew Balance: *${user.balance} Birr*`, { parse_mode: "Markdown" });

      await notifyUser(bot, targetId, `💰 *Admin Balance Adjustment*\n\nYour balance has been decreased by *-${amount} Birr*.\n💰 New Balance: *${user.balance} Birr*`);
    } catch (err) {
      console.error("Admin deductbalance error:", err);
      await ctx.reply("⚠️ Failed to deduct balance.");
    }
  });
}

module.exports = registerAdminHandlers;
