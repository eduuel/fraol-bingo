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
        `*Deposits*\n` +
        `/pending — list pending deposits\n` +
        `/approve <id> — approve deposit\n` +
        `/reject <id> — reject deposit\n\n` +
        `*Withdrawals*\n` +
        `/pendingwd — list pending withdrawals\n` +
        `Use ✅/❌ on deposit screenshots & withdrawal messages.`,
      { parse_mode: "Markdown" }
    );
  });
}

module.exports = registerAdminHandlers;
