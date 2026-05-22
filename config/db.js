const dns = require("dns");
const mongoose = require("mongoose");

dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

const connectDB = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGO_URI is missing in .env");
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 20000,
  });

  console.log("✅ MongoDB Connected");
};

module.exports = connectDB;
