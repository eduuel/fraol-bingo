const mongoose = require("mongoose");

const depositSchema = new mongoose.Schema(
  {
    telegramId: { type: Number, required: true, index: true },
    username: String,
    firstName: String,
    phoneNumber: String,
    amount: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    screenshotFileId: { type: String, required: true },
    screenshotUniqueId: String,
    reviewedBy: Number,
    rejectReason: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Deposit", depositSchema);
