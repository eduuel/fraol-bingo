require("dotenv").config();

const { Telegraf } = require("telegraf");
const config = require("../config");
const registerUser = require("../middleware/registerUser");
const registerStart = require("../handlers/start");
const registerMenu = require("../handlers/menu");
const registerGame = require("../handlers/game");
const registerAdmin = require("../handlers/admin");

function createBot() {
  if (!config.botToken) {
    throw new Error("BOT_TOKEN missing in .env");
  }

  const bot = new Telegraf(config.botToken);
  bot.use(registerUser);
  registerStart(bot);
  registerMenu(bot);
  registerGame(bot);
  registerAdmin(bot);
  return bot;
}

async function launchBot() {
  const bot = createBot();
  await bot.launch();
  console.log(`🤖 @${config.botUsername} is running (in-memory storage, no MongoDB)`);
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
  return bot;
}

module.exports = { createBot, launchBot };
