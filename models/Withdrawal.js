const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema(
  {
    telegramId: { type: Number, required: true, index: true },
    username: String,
    firstName: String,
    phoneNumber: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    reviewedBy: Number,
    rejectReason: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
