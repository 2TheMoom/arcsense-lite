export type AnalysisReport = {
  total: number;
  successful: number;
  failed: number;
  failureRate: number;
  topFailingContracts: [string, number][];
  contractHistory: Record<string, number>;
};

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

      if (receipt && receipt.status === 1) {
        successful++;
      } else {
        failed++;

        const addr = receipt?.to || "unknown";
        contractFailures[addr] = (contractFailures[addr] || 0) + 1;
      }
    } catch {
      failed++;
    }
  }

  const total = txHashes.length;
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