const { findOrCreateUser } = require("../services/user");

async function registerUser(ctx, next) {
  if (!ctx.from) return next();

  try {
    const { user, isNew, referredBy } = await findOrCreateUser(ctx);
    ctx.state.user = user;
    ctx.state.isNewUser = isNew;
    ctx.state.referredBy = referredBy;
  } catch (err) {
    console.error("Register user error:", err.message);
  }

  return next();
}

module.exports = registerUser;
