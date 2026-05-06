export type ContractStats = {
  calls: number;
  success: number;
  fail: number;
};

export type BlockReport = {
  blockNumber: number;
  total: number;
  successful: number;
  failed: number;
  failureRate: number;
  contractStats: Record<string, ContractStats>;
};

export type Job = {
  blockNumber: number;
};