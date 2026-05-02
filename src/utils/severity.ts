// src/utils/severity.ts

export function getSeverity(rate: number, trend: string): string {
  if (rate === 0) return "NONE";
  if (rate < 0.05) return "LOW";
  if (rate < 0.1) return "MEDIUM";
  return "HIGH";
}