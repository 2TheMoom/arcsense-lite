import { ParsedTransaction } from "./transactionService";

export async function analyzeTransactions(
  transactions: ParsedTransaction[],
  getReceipt: (hash: string) => Promise<any>
) {
  let failed = 0;

  for (const tx of transactions) {
    try {
      const receipt = await getReceipt(tx.hash);

      if (receipt && receipt.status === "0x0") {
        failed++;
      }
    } catch (err) {
      console.log("⚠️ Failed to fetch receipt:", tx.hash);
    }
  }

  const total = transactions.length;

  return {
    total,
    success: total - failed,
    failed,
    failureRate: total === 0 ? 0 : failed / total,
  };
}