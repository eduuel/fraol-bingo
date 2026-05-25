const mongoose = require("mongoose");

const awaitingScreenshotSchema = new mongoose.Schema(
  {
    telegramId: { type: Number, required: true, unique: true, index: true },
    amount: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now, expires: 3600 }, // 1 hour
  },
  { timestamps: true }
);

module.exports = mongoose.model("AwaitingScreenshot", awaitingScreenshotSchema);
