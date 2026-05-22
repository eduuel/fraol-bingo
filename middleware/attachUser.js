const { getUserByTelegramId } = require("../services/userService");

/** Load registered user onto ctx.state (does not create accounts). */
async function attachUser(ctx, next) {
  if (!ctx.from) return next();

  try {
    const user = await getUserByTelegramId(ctx.from.id);
    ctx.state.user = user;
  } catch (error) {
    console.error("attachUser error:", error.message);
    ctx.state.user = null;
  }

  return next();
}

module.exports = attachUser;
