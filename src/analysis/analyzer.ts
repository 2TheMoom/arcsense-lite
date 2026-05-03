import pLimit from "p-limit";

/**
 * Final shape used across your app
 */
export interface AnalysisReport {
  total: number;
  successful: number;
  failed: number;
  failureRate: number;
  topFailingContracts: [string, number][];
  contractHistory: Record<string, number>;
}

/**
 * 🔁 Retry-safe receipt fetcher
 * Prevents false negatives due to RPC lag
 */
async function safeGetReceipt(
  hash: string,
  getTxReceipt: (hash: string) => Promise<any>,
  retries = 2,
  delayMs = 150
): Promise<any | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const receipt = await getTxReceipt(hash);

      if (receipt) return receipt;

      // wait before retry (helps with pending receipts)
      await new Promise((res) => setTimeout(res, delayMs));
    } catch {
      // ignore and retry
    }
  }

  return null;
}

/**
 * Analyze a batch of transactions
 */
export async function analyzeTransactions(
  txs: any[],
  getTxReceipt: (hash: string) => Promise<any>
): Promise<AnalysisReport> {
  let successful = 0;
  let failed = 0;

  const contractFailures: Record<string, number> = {};
  const contractHistory: Record<string, number> = {};

  // 🔥 Controlled concurrency (tune between 5–20)
  const limit = pLimit(10);

  await Promise.all(
    txs.map((tx) =>
      limit(async () => {
        try {
          if (!tx || !tx.hash) return;

          // Track all contract interactions
          if (tx.to) {
            contractHistory[tx.to] =
              (contractHistory[tx.to] || 0) + 1;
          }

          // ✅ Use retry-safe receipt fetch
          const receipt = await safeGetReceipt(
            tx.hash,
            getTxReceipt
          );

          // 🚨 Skip if still unavailable (pending tx)
          if (!receipt) return;

          if (receipt.status === 1) {
            successful++;
          } else if (receipt.status === 0) {
            failed++;

            if (tx.to) {
              contractFailures[tx.to] =
                (contractFailures[tx.to] || 0) + 1;
            }
          }
        } catch {
          // Do NOT mark as failed — just skip
          return;
        }
      })
    )
  );

  const total = successful + failed;

  const failureRate =
    total === 0 ? 0 : failed / total;

  const topFailingContracts = Object.entries(contractFailures)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return {
    total,
    successful,
    failed,
    failureRate,
    topFailingContracts,
    contractHistory,
  };
}