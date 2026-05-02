export function detectTrend(history: number[]): string {
  if (history.length < 3) return "Insufficient data";

  const recent = history.slice(-3);
  const avgRecent =
    recent.reduce((a, b) => a + b, 0) / recent.length;

  if (avgRecent === 0) {
    return "Stable behavior";
  }

  if (avgRecent < 0.03) {
    return "Minor failure noise";
  }

  if (avgRecent < 0.08) {
    return "Emerging failure signal";
  }

  return "Failure rate rising";
}