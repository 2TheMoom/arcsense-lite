export interface Tx {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  status: number;
}

export interface TxJob {
  blockNumber: number;
  txHashes: string[];
}