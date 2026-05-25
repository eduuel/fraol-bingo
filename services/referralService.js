const PendingReferral = require("../models/PendingReferral");

async function setPendingReferral(telegramId, code) {
  if (code) {
    await PendingReferral.findOneAndUpdate(
      { telegramId },
      { code },
      { upsert: true, new: true }
    );
  }
}

async function consumePendingReferral(telegramId) {
  const record = await PendingReferral.findOne({ telegramId });
  if (record) {
    await PendingReferral.deleteOne({ telegramId });
    return record.code;
  }
  return null;
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
