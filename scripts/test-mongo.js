require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

const mongoose = require("mongoose");

mongoose
  .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 })
  .then(() => {
    console.log("✅ MongoDB connected successfully!");
    return mongoose.disconnect();
  })
  .catch((err) => {
    console.error("❌ MongoDB failed:", err.message);
    process.exit(1);
  });
