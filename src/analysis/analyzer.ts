// src/analysis/analyzer.ts

export interface AnalysisReport {
  total: number;
  successful: number;
  failed: number;
  failureRate: number;
  topFailingContracts: [string, number][];
  contractHistory: Record<string, number>;
}

export async function analyzeTransactions(
  txHashes: string[],
  getReceipt: (hash: string) => Promise<any>
): Promise<AnalysisReport> {
  let successful = 0;
  let failed = 0;

  const contractFailures: Record<string, number> = {};

  for (const hash of txHashes) {
    try {
      const receipt = await getReceipt(hash);

      if (!receipt) continue;

      if (receipt.status === 1) {
        successful++;
      } else {
        failed++;

        const contract = receipt.to || "unknown";

        contractFailures[contract] =
          (contractFailures[contract] || 0) + 1;
      }
    } catch (err) {
      // Ignore RPC errors per tx
      continue;
    }
  }

  const total = successful + failed;
  const failureRate = total === 0 ? 0 : failed / total;

  const topFailingContracts = Object.entries(contractFailures)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return {
    total,
    successful,
    failed,
    failureRate,
    topFailingContracts,
    contractHistory: contractFailures,
  };
}