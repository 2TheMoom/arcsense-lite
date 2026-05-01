export function parseTransactions(transactions: any[]): any[] {
  return transactions.map((tx) => ({
    hash: tx.hash,
    from: tx.from,
    to: tx.to,
    value: tx.value,
  }));
}