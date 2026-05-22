const mongoose = require("mongoose");
const config = require("../config");
const User = require("../models/User");
const Game = require("../models/Game");
const Deposit = require("../models/Deposit");
const Withdrawal = require("../models/Withdrawal");
const { getUserByTelegramId, isRegistered } = require("../services/userService");
const { MAX } = require("../services/bingo");

const startedAt = new Date();

function dbStatusLabel() {
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };
  return states[mongoose.connection.readyState] || "unknown";
}

function formatUptime(ms) {
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function isAdmin(telegramId) {
  return config.adminIds.includes(telegramId);
}

async function buildStatusMessage(ctx, detailed = false) {
  const dbOk = mongoose.connection.readyState === 1;
  const user = await getUserByTelegramId(ctx.from.id);

  let text =
    `🟢 *Fraol Bingo — Live Bot*\n\n` +
    `This is a *real* game bot (not a mock).\n` +
    `Money is handled *manually* via Telebirr — same as Beteseb.\n\n` +
    `🤖 Bot: @${config.botUsername}\n` +
    `📡 Telegram: online\n` +
    `🗄 Database: ${dbOk ? "✅ connected" : "❌ " + dbStatusLabel()}\n` +
    `🎱 Bingo numbers: 1–${MAX}\n`;

  if (isRegistered(user)) {
    text +=
      `\n👤 *Your account*\n` +
      `Balance: *${user.balance} Birr*\n` +
      `Phone: \`${user.phoneNumber}\`\n`;
  } else {
    text += `\n📱 Send /start and share your phone to register.\n`;
  }

  text +=
    `\n💳 *Payments (manual)*\n` +
    `Deposit → pay Telebirr → send screenshot → admin approves\n` +
    `Withdraw → request → admin pays your Telebirr → approves\n` +
    `Payee: ${config.telebirrOwnerName} · \`${config.telebirrNumber}\``;

  if (detailed && isAdmin(ctx.from.id)) {
    const [users, activeGames, pendingDep, pendingWd] = await Promise.all([
      User.countDocuments(),
      Game.countDocuments({ status: "playing" }),
      Deposit.countDocuments({ status: "pending" }),
      Withdrawal.countDocuments({ status: "pending" }),
    ]);

    text +=
      `\n\n🛠 *Admin stats*\n` +
      `Uptime: ${formatUptime(Date.now() - startedAt.getTime())}\n` +
      `Registered users: ${users}\n` +
      `Active games: ${activeGames}\n` +
      `Pending deposits: ${pendingDep}\n` +
      `Pending withdrawals: ${pendingWd}`;
  }

  return text;
}

function registerStatusHandler(bot) {
  bot.command("status", async (ctx) => {
    try {
      const detailed = isAdmin(ctx.from.id);
      const text = await buildStatusMessage(ctx, detailed);
      await ctx.reply(text, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("/status error:", error);
      await ctx.reply("⚠️ Could not load status. Database may be down.");
    }
  });
}

module.exports = registerStatusHandler;
