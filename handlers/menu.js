const { Markup } = require("telegraf");
const config = require("../config");
const { mainMenu } = require("../keyboards/menus");
const {
  requireRegistered,
  ensureReferralCode,
  getUserByTelegramId,
} = require("../services/userService");

function registerMenuHandlers(bot) {
  bot.hears("💰 Balance", async (ctx) => {
    try {
      const user = await requireRegistered(ctx);
      if (!user) return;

      await ctx.reply(`💰 Your balance: *${user.balance}* Birr`, {
        parse_mode: "Markdown",
        ...mainMenu(),
      });
    } catch (error) {
      console.error("Balance handler error:", error);
      await ctx.reply("⚠️ Could not load balance. Try /start again.", mainMenu());
    }
  });

  bot.hears("📖 Instructions", async (ctx) => {
    const user = await requireRegistered(ctx);
    if (!user) return;

    await ctx.reply(
      "📖 *How to Play:*\n\n" +
        "1. Register with your phone number\n" +
        "2. 💳 Deposit — pay Telebirr *outside* bot, send screenshot, admin approves\n" +
        "3. 🎮 Play — pick stake, join a room\n" +
        "4. Host starts when enough players join\n" +
        "5. Numbers 1–600 are called automatically\n" +
        "6. Complete a line → tap 🏆 BINGO!\n" +
        "7. Winner takes the pot 🏆\n" +
        "8. 💸 Withdraw — admin pays your Telebirr manually\n" +
        "9. /status — check bot is live",
      { parse_mode: "Markdown", ...mainMenu() }
    );
  });

  bot.hears("📞 Support", async (ctx) => {
    const user = await requireRegistered(ctx);
    if (!user) return;

    const support = config.supportUsername;

    if (!support) {
      return ctx.reply(
        "📞 *Support*\n\n" +
          "Support username is not configured yet.\n" +
          "Admin: set `SUPPORT_USERNAME` in `.env` to your real Telegram @username.",
        { parse_mode: "Markdown", ...mainMenu() }
      );
    }

    await ctx.reply(
      `📞 *Support*\n\n` +
        `For deposits, withdrawals, or game help, message:\n` +
        `👤 @${support}\n\n` +
        `Tap the button below to open chat:`,
      {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.url("💬 Open Support Chat", `https://t.me/${support}`)],
        ]).reply_markup,
      }
    );
  });

  bot.hears("🔗 Invite", async (ctx) => {
    try {
      const user = await requireRegistered(ctx);
      if (!user) return;

      const code = await ensureReferralCode(user);
      const link = `https://t.me/${config.botUsername}?start=ref_${code}`;

      await ctx.reply(
        `🔗 *Invite Friends*\n\n` +
          `Share this link:\n${link}\n\n` +
          `When they register:\n` +
          `• You get *${config.referralBonusReferrer} Birr*\n` +
          `• They get *${config.referralBonusNewUser} Birr* bonus\n\n` +
          `Your code: \`${code}\``,
        { parse_mode: "Markdown", ...mainMenu() }
      );
    } catch (error) {
      console.error("Invite error:", error);
      await ctx.reply("⚠️ Could not load invite link.", mainMenu());
    }
  });

}

module.exports = registerMenuHandlers;
