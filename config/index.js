require("dotenv").config();

module.exports = {
  botToken: process.env.BOT_TOKEN,
  botUsername: process.env.BOT_USERNAME || "fraol_bingo_bot",
  telebirrNumber: process.env.TELEBIRR_NUMBER || "09XX XXX XXXX",
  telebirrOwnerName: process.env.TELEBIRR_OWNER_NAME || "Nurahmed Alemu",
  adminIds: (process.env.ADMIN_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .map(Number),
  depositAmounts: (process.env.DEPOSIT_AMOUNTS || "50,100,200,500")
    .split(",")
    .map((n) => Number(n.trim()))
    .filter((n) => n > 0),
  gameStakes: (process.env.GAME_STAKES || "10,20,50,100")
    .split(",")
    .map((n) => Number(n.trim()))
    .filter((n) => n > 0),
  maxBingoNumber: Number(process.env.MAX_BINGO_NUMBER) || 600,
  minPlayersToStart: Number(process.env.MIN_PLAYERS) || 2,
  maxPlayersPerGame: Number(process.env.MAX_PLAYERS) || 20,
  callIntervalMs: Number(process.env.CALL_INTERVAL_MS) || 3500,
  minDeposit: Number(process.env.MIN_DEPOSIT) || 10,
  maxDeposit: Number(process.env.MAX_DEPOSIT) || 10000,
  minWithdraw: Number(process.env.MIN_WITHDRAW) || 50,
  withdrawAmounts: (process.env.WITHDRAW_AMOUNTS || "50,100,200,500")
    .split(",")
    .map((n) => Number(n.trim()))
    .filter((n) => n > 0),
  supportUsername: (process.env.SUPPORT_USERNAME || "")
    .replace(/^@/, "")
    .trim(),
  referralBonusReferrer: Number(process.env.REFERRAL_BONUS_REFERRER) || 50,
  referralBonusNewUser: Number(process.env.REFERRAL_BONUS_NEW_USER) || 25,
};
