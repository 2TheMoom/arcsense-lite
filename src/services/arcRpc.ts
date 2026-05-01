import axios from "axios";

const RPCS = [
  "https://rpc.testnet.arc.network",
  "https://rpc.drpc.testnet.arc.network",
  "https://rpc.quicknode.testnet.arc.network",
];

let requestId = 1;
let currentRpcIndex = 0;

// Rotate RPC when one fails
function switchRpc() {
  currentRpcIndex = (currentRpcIndex + 1) % RPCS.length;
  console.warn(`⚠️ Switching RPC → ${RPCS[currentRpcIndex]}`);
}

// Core RPC call with retry + fallback
async function rpcCall(method: string, params: any[] = []) {
  const maxRetries = RPCS.length;

  for (let i = 0; i < maxRetries; i++) {
    const rpcUrl = RPCS[currentRpcIndex];

    try {
      const response = await axios.post(
        rpcUrl,
        {
          jsonrpc: "2.0",
          id: requestId++,
          method,
          params,
        },
        {
          timeout: 8000,
        }
      );

      if (response.data?.result !== undefined) {
        return response.data.result;
      }

      throw new Error("Invalid RPC response");
    } catch (error: any) {
      console.error(`❌ RPC Error (${rpcUrl}): ${error.message}`);
      switchRpc();
    }
  }

  throw new Error("🚨 All RPC endpoints failed");
}

// Public functions
export async function getBlockNumber(): Promise<number> {
  const hex = await rpcCall("eth_blockNumber");
  return parseInt(hex, 16);
}

export async function getBlockByNumber(blockNumber: number) {
  const hexBlock = "0x" + blockNumber.toString(16);
  return await rpcCall("eth_getBlockByNumber", [hexBlock, true]);
}

export async function getTransactionReceipt(hash: string) {
  return await rpcCall("eth_getTransactionReceipt", [hash]);
}