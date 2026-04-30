import dotenv from "dotenv";

dotenv.config();

export const config = {
  ARC_RPC_URL: process.env.ARC_RPC_URL || "",
};

if (!config.ARC_RPC_URL) {
  throw new Error("ARC_RPC_URL is not set in .env");
}