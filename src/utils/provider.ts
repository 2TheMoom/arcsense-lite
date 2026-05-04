import { JsonRpcProvider } from "ethers";

export const provider = new JsonRpcProvider(
  process.env.RPC_URL || "https://rpc-testnet.arc.xyz"
);