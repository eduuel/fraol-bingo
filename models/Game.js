const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema(
  {
    telegramId: Number,
    username: String,
    firstName: String,
    card: [[Number]],
    marked: [[Boolean]],
    hasBingo: { type: Boolean, default: false },
  },
  { _id: false }
);

const gameSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, index: true },
    status: {
      type: String,
      enum: ["waiting", "playing", "finished", "cancelled"],
      default: "waiting",
    },
    entryFee: { type: Number, default: 10 },
    maxPlayers: { type: Number, default: 20 },
    pot: { type: Number, default: 0 },
    houseFee: { type: Number, default: 0 },
    winnerPrize: { type: Number, default: 0 },
    players: [playerSchema],
    calledNumbers: [Number],
    currentCall: { letter: String, number: Number },
    winnerId: Number,
    winnerName: String,
    hostId: Number,
    channelMessageId: Number,
    gameStartedAt: Date,
    gameFinishedAt: Date,
    durationSeconds: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Game", gameSchema);
