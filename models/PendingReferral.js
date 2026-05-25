const mongoose = require("mongoose");

const pendingReferralSchema = new mongoose.Schema(
  {
    telegramId: { type: Number, required: true, unique: true, index: true },
    code: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 86400 }, // 24 hours
  },
  { timestamps: true }
);

module.exports = mongoose.model("PendingReferral", pendingReferralSchema);
