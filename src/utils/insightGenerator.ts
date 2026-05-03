type AnalysisReport = {
  total: number;
  successful: number;
  failed: number;
  failureRate: number;
  topFailingContracts: [string, number][];
  contractHistory: Record<string, number>;
};

export function generateInsight(report: AnalysisReport) {
  let trend = "Stable";
  let message = "Network operating normally.";
  let severity = "NONE";

  if (report.failureRate > 0.2) {
    trend = "Failure rate rising";
    message = "Elevated failure rate detected across multiple transactions.";
    severity = "HIGH";
  } else if (report.failureRate > 0.1) {
    trend = "Emerging failure signal";
    message = "Notable increase in failed transactions.";
    severity = "MEDIUM";
  } else if (report.failureRate > 0.02) {
    trend = "Minor failure noise";
    message = "Some failures detected but within normal range.";
    severity = "LOW";
  }

  return { trend, message, severity };
}