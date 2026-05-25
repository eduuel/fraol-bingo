require("dotenv").config();

const { Telegraf } = require("telegraf");
const connectDB = require("../config/db");
const attachUser = require("../middleware/attachUser");
const registerStartHandler = require("../handlers/start");
const registerContactHandler = require("../handlers/contact");
const registerMenuHandlers = require("../handlers/menu");
const registerGameHandlers = require("../handlers/game");
const registerDepositHandlers = require("../handlers/deposit");
const registerWithdrawHandlers = require("../handlers/withdraw");
const registerAdminHandlers = require("../handlers/admin");
const registerStatusHandler = require("../handlers/status");

const { recoverOrphanedGames } = require("../services/gameService");

async function startBot() {
  if (!process.env.BOT_TOKEN) {
    throw new Error("BOT_TOKEN is missing in .env");
  }

  await connectDB();

  const bot = new Telegraf(process.env.BOT_TOKEN);

  // Recover orphaned games from database on startup
  await recoverOrphanedGames(bot);

  bot.use(attachUser);
  registerStartHandler(bot);
  registerContactHandler(bot);
  registerDepositHandlers(bot);
  registerWithdrawHandlers(bot);
  registerAdminHandlers(bot);
  registerStatusHandler(bot);
  registerGameHandlers(bot);
  registerMenuHandlers(bot);

  await bot.launch();

  console.log("🤖 Fraol Bingo Bot Running...");

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

startBot().catch((error) => {
  console.error("❌ Failed to start bot:", error.message);
  process.exit(1);
});
