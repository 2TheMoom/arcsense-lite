export async function analyzeTransactions(
  transactions: any[],
  getReceipt: (hash: string) => Promise<any>
) {
  let successful = 0;
  let failed = 0;
  const contractFailures: Record<string, number> = {};

  for (const tx of transactions) {
    try {
      const receipt = await getReceipt(tx.hash);

      if (!receipt) continue;

      let status = receipt.status;

      // Normalize status
      if (status === "0x1" || status === 1) {
        successful++;
      } else if (status === "0x0" || status === 0) {
        failed++;

        const contract = tx.to || "unknown";
        contractFailures[contract] =
          (contractFailures[contract] || 0) + 1;
      } else {
        // fallback (prevents false negatives)
        successful++;
      }

    } catch (err) {
      console.error("Receipt error:", err);
    }
  }

  const total = successful + failed;

  const topFailingContracts = Object.entries(contractFailures)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return {
    total,
    successful,
    failed,
    failureRate: total === 0 ? 0 : failed / total,
    topFailingContracts,
  };
}