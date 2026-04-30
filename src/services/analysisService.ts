import { ParsedTransaction } from "./transactionService";

export function analyzeTransactions(transactions: ParsedTransaction[]) {
  const total = transactions.length;

  return {
    total,
    success: total,
    failed: 0,
    failureRate: 0,
  };
}