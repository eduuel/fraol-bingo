const mongoose = require("mongoose");

const selectedStakeSchema = new mongoose.Schema(
  {
    telegramId: { type: Number, required: true, unique: true, index: true },
    mode: { type: String, enum: ["quick", "create"], required: true },
    createdAt: { type: Date, default: Date.now, expires: 600 }, // 10 minutes
  },
  { timestamps: true }
);

module.exports = mongoose.model("SelectedStake", selectedStakeSchema);
