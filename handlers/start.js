const { getUserByTelegramId, isRegistered } = require("../services/userService");
const {
  setPendingReferral,
  parseStartReferral,
} = require("../services/referralService");
const { mainMenu, contactRequestMenu } = require("../keyboards/menus");

function registerStartHandler(bot) {
  bot.start(async (ctx) => {
    try {
      const refCode = parseStartReferral(ctx);
      if (refCode) {
        await setPendingReferral(ctx.from.id, refCode);
      }

      const user = await getUserByTelegramId(ctx.from.id);
      const name = ctx.from.first_name || "Player";

      if (isRegistered(user)) {
        ctx.state.user = user;
        await ctx.reply(
          `🎮 *Welcome back to Fraol Bingo!*\n\n` +
            `Hello *${name}*!\n\n` +
            `📱 Phone: \`${user.phoneNumber}\`\n` +
            `💰 *Balance:* ${user.balance} Birr\n\n` +
            `Choose an option below:`,
          { parse_mode: "Markdown", ...mainMenu() }
        );
        return;
      }

      let extra = "";
      if (refCode) {
        extra = "\n\n👥 You were invited by a friend — complete registration to get your bonus!";
      }

      await ctx.reply(
        `🎮 *Welcome to Fraol Bingo!*\n\n` +
          `Hello *${name}*!\n\n` +
          `To register and play, please share your *phone number*.\n\n` +
          `Tap the button below — Telegram will send *your own* contact securely.` +
          extra,
        { parse_mode: "Markdown", ...contactRequestMenu() }
      );
    } catch (error) {
      console.error("/start error:", error);
      await ctx.reply(
        "⚠️ Something went wrong. Please try /start again.",
        contactRequestMenu()
      );
    }
  });
}

module.exports = registerStartHandler;
