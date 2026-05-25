const mongoose = require("mongoose");

const gameHistorySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, index: true },
    entryFee: { type: Number, required: true },
    playerCount: { type: Number, required: true },
    pot: { type: Number, required: true },
    houseFee: { type: Number, required: true },
    winnerPrize: { type: Number, required: true },
    status: { type: String, required: true },
    winner: {
      telegramId: Number,
      username: String,
      firstName: String,
    },
    players: [
      {
        telegramId: Number,
        username: String,
        firstName: String,
      },
    ],
    totalNumbersCalled: { type: Number, required: true },
    durationSeconds: { type: Number, default: 0 },
    finishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GameHistory", gameHistorySchema);
