// src/utils/insightGenerator.ts

import { AnalysisReport } from "../analysis/analyzer";

export function generateInsight(
  report: AnalysisReport,
  trend: string,
  contractMemory: Record<string, number>
): string {
  const { failed, failureRate, topFailingContracts } = report;

  // 🧠 Case 1: No failures
  if (failed === 0) {
    if (trend.includes("rising")) {
      return "No failures in this block, but historical trend shows rising instability.";
    }

    if (trend.includes("noise")) {
      return "Network mostly clean with occasional minor failures.";
    }

    return "No failures detected. Network execution is clean.";
  }

  // 🧠 Case 2: Single failure
  if (failed === 1) {
    const [addr] = topFailingContracts[0];

    const historicalCount = contractMemory[addr] || 0;

    if (historicalCount > 3) {
      return `Recurring failure detected from ${addr}. Possible unstable contract.`;
    }

    if (trend.includes("rising")) {
      return `Early failure signal from ${addr} aligning with rising trend.`;
    }

    return `Single failure observed from ${addr}. Early signal only.`;
  }

  // 🧠 Case 3: Multiple failures
  if (failureRate > 0.05) {
    return "Elevated failure rate detected across multiple transactions.";
  }

  if (trend.includes("rising")) {
    return "Failure activity increasing across recent blocks.";
  }

  return "Irregular failure pattern detected. Monitoring closely.";
}