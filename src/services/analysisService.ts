import { ParsedTransaction } from "./transactionService";

export async function analyzeTransactions(
  transactions: ParsedTransaction[],
  getReceipt: (hash: string) => Promise<any>
) {
  let success = 0;
  let failed = 0;

  const contractFailures: Record<string, number> = {};

  for (const tx of transactions) {
    try {
      const receipt = await getReceipt(tx.hash);

      if (!receipt) continue;

      if (receipt.status === "0x1") {
        success++;
      } else {
        failed++;

        const contract = tx.to ?? "contract_creation";

        contractFailures[contract] =
          (contractFailures[contract] || 0) + 1;
      }
    } catch {
      // ignore RPC errors per tx
    }
  }

  const total = success + failed;

  const topFailingContracts = Object.entries(contractFailures)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return {
    total,
    success,
    failed,
    failureRate: total === 0 ? 0 : failed / total,
    topFailingContracts,
  };
}