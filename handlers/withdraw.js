const config = require("../config");
const { mainMenu, withdrawAmountKeyboard } = require("../keyboards/menus");
const { requireRegistered, getUserByTelegramId } = require("../services/userService");
const { createWithdrawal } = require("../services/withdrawService");

async function notifyAdminsWithdraw(bot, withdrawal, user) {
  if (config.adminIds.length === 0) {
    console.warn("ADMIN_IDS not set — withdrawal saved but admin not notified.");
    return;
  }

  const text =
    `📤 *New withdrawal request*\n\n` +
    `ID: \`${withdrawal._id}\`\n` +
    `User: ${user.firstName || "—"} (@${user.username || "—"})\n` +
    `Telegram ID: \`${user.telegramId}\`\n\n` +
    `💵 Amount: *${withdrawal.amount} Birr*\n` +
    `📱 Send Telebirr to: \`${withdrawal.phoneNumber}\`\n\n` +
    `_Pay manually in Telebirr app, then tap Approve._`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "✅ Paid & Approve", callback_data: `wd_approve:${withdrawal._id}` },
        { text: "❌ Reject", callback_data: `wd_reject:${withdrawal._id}` },
      ],
    ],
  };

  for (const adminId of config.adminIds) {
    try {
      await bot.telegram.sendMessage(adminId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (err) {
      console.error(`Could not notify admin ${adminId}:`, err.message);
    }
  }
}

function registerWithdrawHandlers(bot) {
  bot.hears("💸 Withdraw", async (ctx) => {
    try {
      const user = await requireRegistered(ctx);
      if (!user) return;

      const fresh = await getUserByTelegramId(user.telegramId);

      if (fresh.balance < config.minWithdraw) {
        return ctx.reply(
          `💸 Minimum withdrawal is *${config.minWithdraw} Birr*.\n` +
            `Your balance: *${fresh.balance} Birr*`,
          { parse_mode: "Markdown", ...mainMenu() }
        );
      }

      await ctx.reply(
        `💸 *Withdraw*\n\n` +
          `Balance: *${fresh.balance} Birr*\n` +
          `Payout Telebirr: \`${fresh.phoneNumber}\`\n\n` +
          `Choose amount to withdraw:`,
        { parse_mode: "Markdown", ...withdrawAmountKeyboard(fresh.balance) }
      );
    } catch (error) {
      console.error("Withdraw menu error:", error);
      await ctx.reply("⚠️ Could not open withdraw.", mainMenu());
    }
  });

  bot.action(/^withdraw:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const user = await requireRegistered(ctx);
      if (!user) return;

      const amount = Number(ctx.match[1]);
      const fresh = await getUserByTelegramId(user.telegramId);

      if (amount < config.minWithdraw) {
        return ctx.reply(`Minimum withdrawal is ${config.minWithdraw} Birr.`, mainMenu());
      }
      if (amount > fresh.balance) {
        return ctx.reply(`You only have ${fresh.balance} Birr.`, mainMenu());
      }

      const result = await createWithdrawal(fresh, amount);
      if (result.error) {
        return ctx.reply(result.error, mainMenu());
      }

      const { withdrawal, user: updated } = result;

      await notifyAdminsWithdraw(bot, withdrawal, updated);

      await ctx.reply(
        `✅ *Withdrawal requested*\n\n` +
          `Amount: *${amount} Birr*\n` +
          `To Telebirr: \`${withdrawal.phoneNumber}\`\n` +
          `Status: ⏳ Pending (admin will pay you soon)\n\n` +
          `💰 Remaining balance: *${updated.balance} Birr*\n` +
          `_Amount is held until admin approves or rejects._`,
        { parse_mode: "Markdown", ...mainMenu() }
      );
    } catch (error) {
      console.error("Withdraw action error:", error);
      await ctx.reply("⚠️ Withdrawal failed. Try again.", mainMenu());
    }
  });

  bot.action("withdraw_cancel", async (ctx) => {
    await ctx.answerCbQuery("Cancelled");
    await ctx.reply("Withdrawal cancelled.", mainMenu());
  });
}

module.exports = registerWithdrawHandlers;
