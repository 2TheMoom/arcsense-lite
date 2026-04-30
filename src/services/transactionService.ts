export interface ParsedTransaction {
  hash: string;
  from: string;
  to: string | null;
}

export function parseTransactions(block: any): ParsedTransaction[] {
  if (!block || !block.transactions) return [];

  return block.transactions.map((tx: any) => ({
    hash: tx.hash,
    from: tx.from,
    to: tx.to,
  }));
}