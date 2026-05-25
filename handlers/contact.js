const config = require("../config");
const { registerWithContact } = require("../services/userService");
const { consumePendingReferral } = require("../services/referralService");
const { mainMenu, contactRequestMenu } = require("../keyboards/menus");

function registerContactHandler(bot) {
  bot.on("contact", async (ctx) => {
    try {
      const contact = ctx.message.contact;
      const refCode = await consumePendingReferral(ctx.from.id);

      const { user, isNew, referralApplied } = await registerWithContact(
        ctx.from,
        contact,
        refCode
      );
      ctx.state.user = user;

      const registeredText = isNew
        ? "✅ *User registered successfully!*"
        : "✅ *Phone number updated successfully!*";

      let bonusText = "";
      if (isNew && referralApplied) {
        bonusText =
          `\n🎁 Referral bonus: *+${config.referralBonusNewUser} Birr* added!\n`;
      }

      await ctx.reply(
        `${registeredText}${bonusText}\n\n` +
          `📱 Phone: \`${user.phoneNumber}\`\n` +
          `💰 Balance: *${user.balance}* Birr\n\n` +
          `You can now continue playing. Choose an option below:`,
        { parse_mode: "Markdown", ...mainMenu() }
      );
    } catch (error) {
      if (error.code === "NOT_OWN_CONTACT") {
        return ctx.reply(
          "❌ Please share *your own* phone number, not someone else's contact.",
          { parse_mode: "Markdown", ...contactRequestMenu() }
        );
      }

      console.error("Contact registration error:", error);
      await ctx.reply(
        "⚠️ Registration failed. Please try again using the Share Phone button.",
        contactRequestMenu()
      );
    }
  });
}

module.exports = registerContactHandler;
