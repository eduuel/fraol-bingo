const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    telegramId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      default: null,
      trim: true,
    },
    firstName: {
      type: String,
      default: null,
      trim: true,
    },
    phoneNumber: {
      type: String,
      default: null,
      trim: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    totalWinnings: { type: Number, default: 0 },
    referralEarnings: { type: Number, default: 0 },
    referredUsers: { type: [Number], default: [] },
    isBanned: { type: Boolean, default: false },
    referralCode: { type: String, unique: true, sparse: true, index: true },
    referredBy: { type: Number, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
