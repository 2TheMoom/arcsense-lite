export async function getBlockTransactions(block: any): Promise<any[]> {
  if (!block || !block.transactions) return [];

  return block.transactions.map((tx: any) =>
    typeof tx === "string" ? tx : tx.hash
  );
}