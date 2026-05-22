const Withdrawal = require("../models/Withdrawal");
const User = require("../models/User");

async function hasPendingWithdrawal(telegramId) {
  return Withdrawal.exists({ telegramId, status: "pending" });
}

async function createWithdrawal(user, amount) {
  if (!user.phoneNumber) {
    return { error: "Phone number missing. Send /start and register again." };
  }
  if (user.balance < amount) {
    return {
      error: `Insufficient balance. You have ${user.balance} Birr, requested ${amount} Birr.`,
    };
  }
  if (await hasPendingWithdrawal(user.telegramId)) {
    return { error: "You already have a pending withdrawal. Wait for admin approval." };
  }

  const freshUser = await User.findOne({ telegramId: user.telegramId });
  freshUser.balance -= amount;
  await freshUser.save();

  const withdrawal = await Withdrawal.create({
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    phoneNumber: user.phoneNumber,
    amount,
    status: "pending",
  });

  return { withdrawal, user: freshUser };
}

async function approveWithdrawal(withdrawalId, adminTelegramId) {
  const withdrawal = await Withdrawal.findById(withdrawalId);
  if (!withdrawal) return { error: "Withdrawal not found." };
  if (withdrawal.status !== "pending") {
    return { error: `Already ${withdrawal.status}.` };
  }

  withdrawal.status = "approved";
  withdrawal.reviewedBy = adminTelegramId;
  await withdrawal.save();

  const user = await User.findOne({ telegramId: withdrawal.telegramId });
  return { withdrawal, user };
}

async function rejectWithdrawal(withdrawalId, adminTelegramId, reason = "") {
  const withdrawal = await Withdrawal.findById(withdrawalId);
  if (!withdrawal) return { error: "Withdrawal not found." };
  if (withdrawal.status !== "pending") {
    return { error: `Already ${withdrawal.status}.` };
  }

  const user = await User.findOne({ telegramId: withdrawal.telegramId });
  if (user) {
    user.balance += withdrawal.amount;
    await user.save();
  }

  withdrawal.status = "rejected";
  withdrawal.reviewedBy = adminTelegramId;
  withdrawal.rejectReason = reason;
  await withdrawal.save();

  return { withdrawal, user };
}

async function listPendingWithdrawals() {
  return Withdrawal.find({ status: "pending" }).sort({ createdAt: -1 }).limit(20);
}

module.exports = {
  hasPendingWithdrawal,
  createWithdrawal,
  approveWithdrawal,
  rejectWithdrawal,
  listPendingWithdrawals,
};
