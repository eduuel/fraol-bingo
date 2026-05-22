const Deposit = require("../models/Deposit");
const User = require("../models/User");

/** telegramId -> { amount } while waiting for screenshot */
const awaitingScreenshot = new Map();

function setAwaitingScreenshot(telegramId, amount) {
  awaitingScreenshot.set(telegramId, { amount });
}

function getAwaitingScreenshot(telegramId) {
  return awaitingScreenshot.get(telegramId) || null;
}

function clearAwaitingScreenshot(telegramId) {
  awaitingScreenshot.delete(telegramId);
}

async function hasPendingDeposit(telegramId) {
  return Deposit.exists({ telegramId, status: "pending" });
}

async function createDeposit(user, amount, photo) {
  const largest = photo.reduce((a, b) => (a.file_size > b.file_size ? a : b));

  return Deposit.create({
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    phoneNumber: user.phoneNumber,
    amount,
    screenshotFileId: largest.file_id,
    screenshotUniqueId: largest.file_unique_id,
    status: "pending",
  });
}

async function getDepositById(id) {
  return Deposit.findById(id);
}

async function approveDeposit(depositId, adminTelegramId) {
  const deposit = await Deposit.findById(depositId);
  if (!deposit) return { error: "Deposit not found." };
  if (deposit.status !== "pending") {
    return { error: `Already ${deposit.status}.` };
  }

  const user = await User.findOne({ telegramId: deposit.telegramId });
  if (!user) return { error: "User not found." };

  deposit.status = "approved";
  deposit.reviewedBy = adminTelegramId;
  await deposit.save();

  user.balance += deposit.amount;
  await user.save();

  return { deposit, user };
}

async function rejectDeposit(depositId, adminTelegramId, reason = "") {
  const deposit = await Deposit.findById(depositId);
  if (!deposit) return { error: "Deposit not found." };
  if (deposit.status !== "pending") {
    return { error: `Already ${deposit.status}.` };
  }

  deposit.status = "rejected";
  deposit.reviewedBy = adminTelegramId;
  deposit.rejectReason = reason;
  await deposit.save();

  return { deposit };
}

async function listPendingDeposits() {
  return Deposit.find({ status: "pending" }).sort({ createdAt: -1 }).limit(20);
}

module.exports = {
  setAwaitingScreenshot,
  getAwaitingScreenshot,
  clearAwaitingScreenshot,
  hasPendingDeposit,
  createDeposit,
  getDepositById,
  approveDeposit,
  rejectDeposit,
  listPendingDeposits,
};
