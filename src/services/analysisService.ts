export async function analyzeTransactions(
  txs: string[],
  getReceipt: (hash: string) => Promise<any>
) {
  let total = txs.length;
  let failed = 0;
  let successful = 0;

  const contractFailures: Record<string, number> = {};
  const contractHistory: Record<string, number> = {};

  for (const hash of txs) {
    const receipt = await getReceipt(hash);
    if (!receipt) continue;

    if (receipt.status === "0x0") {
      failed++;

      const contract = receipt.to || "unknown";
      contractFailures[contract] = (contractFailures[contract] || 0) + 1;
    } else {
      successful++;
    }
  }

  const failureRate = total === 0 ? 0 : failed / total;

  const topFailingContracts = Object.entries(contractFailures)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  for (const [contract, count] of topFailingContracts) {
    if (contract === "unknown") continue;
    contractHistory[contract] =
      (contractHistory[contract] || 0) + count;
  }

  return {
    total,
    successful,
    failed,
    failureRate,
    topFailingContracts,
    contractHistory,
  };
}