import { provider } from "../utils/provider";
import {
  trackContractFailure,
  updateFailureRate,
} from "../storage/stateStorage";

const sleep = (ms: number) =>
  new Promise((res) => setTimeout(res, ms));

export type BlockReport = {
  blockNumber: number;
  totalTx: number;
  failedTx: number;
  failureRate: number;
  topFailingContracts: Record<string, number>;
};

export async function analyzeBlock(
  blockNumber: number
): Promise<BlockReport | null> {
  const block = await provider.getBlock(blockNumber, true);

  if (!block || !block.transactions) return null;

  const totalTx = block.transactions.length;
  let failed = 0;
  const localContractFailures: Record<string, number> = {};

  for (const tx of block.transactions) {
    // Arc RPC returns strings OR objects — handle both safely
    const txHash: string | null =
      typeof tx === "string"
        ? tx
        : typeof tx === "object" && tx !== null && "hash" in tx
        ? (tx as { hash: string }).hash
        : null;

    if (!txHash) continue; // skip if hash is somehow missing

    try {
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt) continue;

      if (receipt.status === 0) {
        failed++;
        const addr = receipt.to || "unknown";
        trackContractFailure(addr);
        localContractFailures[addr] =
          (localContractFailures[addr] || 0) + 1;
      }

      await sleep(25);
    } catch (err: any) {
      console.log("Tx error:", err.message);
      await sleep(100);
    }
  }

  const failureRate = totalTx === 0 ? 0 : failed / totalTx;
  updateFailureRate(failureRate);

  return {
    blockNumber,
    totalTx,
    failedTx: failed,
    failureRate,
    topFailingContracts: localContractFailures,
  };
}