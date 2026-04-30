import { ParsedTransaction } from "./transactionService";

export async function analyzeTransactions(
  transactions: ParsedTransaction[],
  getReceipt: (hash: string) => Promise<any>
) {
  // 🔥 Fetch all receipts in parallel
  const receipts = await Promise.all(
    transactions.map(async (tx) => {
      try {
        const receipt = await getReceipt(tx.hash);
        return { tx, receipt };
      } catch {
        return { tx, receipt: null };
      }
    })
  );

  let failed = 0;
  const failureMap: Record<string, number> = {};

  for (const { tx, receipt } of receipts) {
    if (receipt && receipt.status === "0x0") {
      failed++;

      const contract = tx.to || "UNKNOWN";

      if (!failureMap[contract]) {
        failureMap[contract] = 0;
      }

      failureMap[contract]++;
    }
  }

  const total = transactions.length;

  const topFailingContracts = Object.entries(failureMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return {
    total,
    success: total - failed,
    failed,
    failureRate: total === 0 ? 0 : failed / total,
    topFailingContracts,
  };
}