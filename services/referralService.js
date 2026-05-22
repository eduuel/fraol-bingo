/** Stores referral code from ?start=ref_XXX until user completes phone registration */
const pendingReferrals = new Map();

function setPendingReferral(telegramId, code) {
  if (code) pendingReferrals.set(telegramId, code);
}

function consumePendingReferral(telegramId) {
  const code = pendingReferrals.get(telegramId);
  pendingReferrals.delete(telegramId);
  return code || null;
}

function parseStartReferral(ctx) {
  const payload =
    ctx.startPayload ||
    ctx.message?.text?.split(" ")[1] ||
    "";

  if (payload.startsWith("ref_")) {
    return payload.replace("ref_", "").trim();
  }
  return null;
}

module.exports = {
  setPendingReferral,
  consumePendingReferral,
  parseStartReferral,
};
