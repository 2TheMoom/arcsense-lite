export async function analyzeTransactions(
  txHashes: string[],
  getReceipt: (hash: string) => Promise<any>
) {
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

        const addr = receipt.to || "unknown";

        contractFailures[addr] = (contractFailures[addr] || 0) + 1;
      }
    } catch {
      failed++;
    }
  }

  const total = successful + failed;

  return {
    total,
    successful,
    failed,
    failureRate: total > 0 ? failed / total : 0,
    topFailingContracts: Object.entries(contractFailures).sort(
      (a, b) => b[1] - a[1]
    ),
    contractHistory: contractFailures,
  };
}