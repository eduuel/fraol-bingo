const User = require("../models/User");
const config = require("../config");

function isRegistered(user) {
  return Boolean(user?.phoneNumber);
}

function makeReferralCode(telegramId) {
  return `F${telegramId.toString(36).toUpperCase()}`;
}

async function ensureReferralCode(user) {
  if (!user.referralCode) {
    user.referralCode = makeReferralCode(user.telegramId);
    await user.save();
  }
  return user.referralCode;
}

async function applyReferralBonus(newUser, referralCode) {
  if (!referralCode) return { referredBy: null };

  const referrer = await User.findOne({ referralCode });
  if (!referrer || referrer.telegramId === newUser.telegramId) {
    return { referredBy: null };
  }

  newUser.referredBy = referrer.telegramId;
  newUser.balance += config.referralBonusNewUser;
  newUser.referralEarnings += config.referralBonusNewUser;

  const updatedReferrer = await User.findOneAndUpdate(
    { referralCode },
    {
      $inc: { balance: config.referralBonusReferrer, referralEarnings: config.referralBonusReferrer },
      $addToSet: { referredUsers: newUser.telegramId }
    },
    { new: true }
  );

  return { referredBy: referrer.telegramId, referrer: updatedReferrer };
}

async function registerWithContact(from, contact, incomingReferralCode = null) {
  if (contact.user_id !== from.id) {
    const err = new Error("You must share your own contact.");
    err.code = "NOT_OWN_CONTACT";
    throw err;
  }

  const telegramId = from.id;
  const username = from.username ?? null;
  const firstName = from.first_name ?? contact.first_name ?? null;
  const phoneNumber = contact.phone_number;

  try {
    let user = await User.findOne({ telegramId });
    const isNew = !user;

    if (user) {
      user.username = username;
      user.firstName = firstName;
      user.phoneNumber = phoneNumber;
      await ensureReferralCode(user);
      await user.save();
      return { user, isNew: false, referralApplied: false };
    }

    user = await User.create({
      telegramId,
      username,
      firstName,
      phoneNumber,
      balance: 0,
      referralCode: makeReferralCode(telegramId),
    });

    let referralApplied = false;
    let referrer = null;

    if (incomingReferralCode) {
      const result = await applyReferralBonus(user, incomingReferralCode);
      if (result.referrer) {
        referralApplied = true;
        referrer = result.referrer;
        await user.save();
      }
    }

    return { user, isNew: true, referralApplied, referrer };
  } catch (error) {
    if (error.code === 11000) {
      const user = await User.findOne({ telegramId });
      if (user) {
        user.phoneNumber = phoneNumber;
        await ensureReferralCode(user);
        await user.save();
        return { user, isNew: false, referralApplied: false };
      }
    }
    throw error;
  }
}

async function getUserByTelegramId(telegramId) {
  return User.findOne({ telegramId });
}

async function requireRegistered(ctx) {
  const user = await getUserByTelegramId(ctx.from.id);

  if (!isRegistered(user)) {
    const { contactRequestMenu } = require("../keyboards/menus");
    await ctx.reply(
      "📱 *Registration required*\n\n" +
        "Please share your phone number using the button below to continue.",
      { parse_mode: "Markdown", ...contactRequestMenu() }
    );
    return null;
  }

  if (user.isBanned) {
    await ctx.reply("⛔ Your account has been banned by an administrator.");
    return null;
  }

  return user;
}

module.exports = {
  isRegistered,
  makeReferralCode,
  ensureReferralCode,
  registerWithContact,
  getUserByTelegramId,
  requireRegistered,
};
