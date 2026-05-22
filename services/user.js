const config = require("../config");
const store = require("../storage/memory");

function makeReferralCode(telegramId) {
  return `BB${telegramId.toString(36).toUpperCase().slice(-6)}`;
}

async function findOrCreateUser(ctx) {
  const from = ctx.from;
  const telegramId = from.id;
  let user = store.getUser(telegramId);

  if (user) {
    user.username = from.username || user.username;
    user.firstName = from.first_name || user.firstName;
    store.saveUser(user);
    return { user, isNew: false };
  }

  const startPayload = ctx.startPayload || ctx.message?.text?.split(" ")[1];
  let referredBy = null;

  user = {
    telegramId,
    username: from.username,
    firstName: from.first_name,
    balance: config.startingBalance,
    referralCode: makeReferralCode(telegramId),
    referredBy: null,
    gamesPlayed: 0,
    gamesWon: 0,
    isAdmin: config.adminIds.includes(telegramId),
    createdAt: new Date(),
  };

  if (startPayload && startPayload.startsWith("ref_")) {
    const code = startPayload.replace("ref_", "");
    const referrer = store.findUserByReferralCode(code);
    if (referrer && referrer.telegramId !== telegramId) {
      referredBy = referrer.telegramId;
      user.referredBy = referredBy;
      user.balance += config.referralBonusNewUser;
      referrer.balance += config.referralBonusReferrer;
      store.saveUser(referrer);
    }
  }

  store.saveUser(user);
  return { user, isNew: true, referredBy };
}

async function getUser(telegramId) {
  return store.getUser(telegramId);
}

async function isAdmin(telegramId) {
  if (config.adminIds.includes(telegramId)) return true;
  const user = store.getUser(telegramId);
  return user?.isAdmin === true;
}

module.exports = {
  findOrCreateUser,
  getUser,
  isAdmin,
  makeReferralCode,
};
