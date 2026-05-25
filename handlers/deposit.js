const config = require("../config");
const { mainMenu, depositAmountKeyboard } = require("../keyboards/menus");
const { requireRegistered } = require("../services/userService");
const {
  setAwaitingScreenshot,
  getAwaitingScreenshot,
  clearAwaitingScreenshot,
  hasPendingDeposit,
  createDeposit,
} = require("../services/depositService");

function formatTelebirrPayee() {
  return (
    `👤 *Account name:* ${config.telebirrOwnerName}\n` +
    `📱 *Telebirr:* \`${config.telebirrNumber}\``
  );
}

function formatTelebirrInstructions(amount) {
  return (
    `💳 *Deposit ${amount} Birr*\n\n` +
    `1️⃣ Send *${amount} Birr* to:\n` +
    `${formatTelebirrPayee()}\n\n` +
    `2️⃣ Take a clear *screenshot* of the successful payment\n\n` +
    `3️⃣ Send the screenshot *here* as a photo\n\n` +
    `_Admin will verify and add balance to your account._`
  );
}

async function notifyAdmins(bot, deposit, user) {
  if (config.adminIds.length === 0) {
    console.warn("ADMIN_IDS not set — deposit saved but no admin notified.");
    return;
  }

  const caption =
    `📥 *New deposit request*\n\n` +
    `ID: \`${deposit._id}\`\n` +
    `User: ${user.firstName || "—"} (@${user.username || "no username"})\n` +
    `Telegram ID: \`${user.telegramId}\`\n` +
    `Phone: \`${user.phoneNumber || "—"}\`\n` +
    `Amount: *${deposit.amount} Birr*`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "✅ Approve", callback_data: `dep_approve:${deposit._id}` },
        { text: "❌ Reject", callback_data: `dep_reject:${deposit._id}` },
      ],
    ],
  };

  for (const adminId of config.adminIds) {
    try {
      await bot.telegram.sendPhoto(adminId, deposit.screenshotFileId, {
        caption,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (err) {
      console.error(`Could not notify admin ${adminId}:`, err.message);
    }
  }
}

function registerDepositHandlers(bot) {
  bot.hears("💳 Deposit", async (ctx) => {
    try {
      const user = await requireRegistered(ctx);
      if (!user) return;

      if (await hasPendingDeposit(user.telegramId)) {
        return ctx.reply(
          "⏳ You already have a *pending* deposit. Wait for admin approval or contact support.",
          { parse_mode: "Markdown", ...mainMenu() }
        );
      }

      await clearAwaitingScreenshot(user.telegramId);

      await ctx.reply(
        `💳 *Add balance*\n\n` +
          `Choose how much you want to deposit:\n\n` +
          formatTelebirrPayee(),
        { parse_mode: "Markdown", ...depositAmountKeyboard() }
      );
    } catch (error) {
      console.error("Deposit menu error:", error);
      await ctx.reply("⚠️ Could not open deposit. Try again.", mainMenu());
    }
  });

  bot.action(/^deposit_amt:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const user = await requireRegistered(ctx);
      if (!user) return;

      const amount = Number(ctx.match[1]);
      if (!config.depositAmounts.includes(amount)) {
        return ctx.reply("Invalid amount.", mainMenu());
      }

      if (await hasPendingDeposit(user.telegramId)) {
        return ctx.reply("You already have a pending deposit.", mainMenu());
      }

      await setAwaitingScreenshot(user.telegramId, amount);

      await ctx.reply(formatTelebirrInstructions(amount), {
        parse_mode: "Markdown",
        ...mainMenu(),
      });
    } catch (error) {
      console.error("Deposit amount error:", error);
      await ctx.reply("⚠️ Something went wrong.", mainMenu());
    }
  });

  bot.action("deposit_cancel", async (ctx) => {
    await ctx.answerCbQuery("Cancelled");
    await clearAwaitingScreenshot(ctx.from.id);
    await ctx.reply("Deposit cancelled.", mainMenu());
  });

  bot.on("photo", async (ctx) => {
    try {
      const pending = await getAwaitingScreenshot(ctx.from.id);
      if (!pending) return;

      const user = await requireRegistered(ctx);
      if (!user) return;

      if (await hasPendingDeposit(user.telegramId)) {
        await clearAwaitingScreenshot(ctx.from.id);
        return ctx.reply("You already have a pending deposit.", mainMenu());
      }

      const deposit = await createDeposit(user, pending.amount, ctx.message.photo);
      await clearAwaitingScreenshot(ctx.from.id);

      await notifyAdmins(bot, deposit, user);

      await ctx.reply(
        `✅ *Screenshot received!*\n\n` +
          `Amount: *${deposit.amount} Birr*\n` +
          `Status: ⏳ Pending admin approval\n\n` +
          `You will be notified when your balance is updated.`,
        { parse_mode: "Markdown", ...mainMenu() }
      );
    } catch (error) {
      console.error("Deposit photo error:", error);
      await clearAwaitingScreenshot(ctx.from.id);
      await ctx.reply(
        "⚠️ Could not save your deposit. Please try 💳 Deposit again.",
        mainMenu()
      );
    }
  });
}

module.exports = registerDepositHandlers;
