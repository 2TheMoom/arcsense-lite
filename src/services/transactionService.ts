export interface ParsedTransaction {
  hash: string;
  from: string;
  to: string | null;
  value: string;
}

export function parseTransactions(transactions: any[]): ParsedTransaction[] {
  if (!transactions || transactions.length === 0) return [];

  return transactions.map((tx) => ({
    hash: tx.hash,
    from: tx.from,
    to: tx.to ?? null,
    value: tx.value,
  }));
}