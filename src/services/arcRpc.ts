import fetch from "node-fetch";

const RPCS = [
  "https://rpc.testnet.arc.network",
  "https://rpc.drpc.testnet.arc.network",
  "https://rpc.quicknode.testnet.arc.network",
];

let currentRpcIndex = 0;

async function callRpc(method: string, params: any[]) {
  for (let i = 0; i < RPCS.length; i++) {
    const rpc = RPCS[currentRpcIndex];

    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method,
          params,
        }),
      });

      const data = await res.json();

      if (data.error) throw new Error(data.error.message);

      return data.result;
    } catch (err) {
      console.warn(`⚠️ RPC failed (${rpc}), switching...`);
      currentRpcIndex = (currentRpcIndex + 1) % RPCS.length;
    }
  }

  throw new Error("All RPC endpoints failed");
}

// ✅ Get latest block number
export async function getLatestBlockNumber(): Promise<number> {
  const hex = await callRpc("eth_blockNumber", []);
  return parseInt(hex, 16);
}

// ✅ Get block with transactions
export async function getBlockByNumber(blockNumber: number): Promise<any> {
  const hexBlock = "0x" + blockNumber.toString(16);

  return await callRpc("eth_getBlockByNumber", [hexBlock, true]);
}

// ✅ Get transaction receipt (CRITICAL for real failures)
export async function getTransactionReceipt(hash: string): Promise<any> {
  return await callRpc("eth_getTransactionReceipt", [hash]);
}