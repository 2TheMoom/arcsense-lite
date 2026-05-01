import dotenv from "dotenv";

dotenv.config();

export const RPC_URL = process.env.RPC_URL || "";

if (!RPC_URL) {
  throw new Error("❌ RPC_URL is not defined in .env");
}