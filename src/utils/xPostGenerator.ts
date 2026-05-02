export function generateXPost(
  report: any,
  trend: string,
  insight: string,
  severity: string
): string {
  const percent = (report.failureRate * 100).toFixed(2);

  const tone =
    severity === "HIGH"
      ? "🚨 Critical network instability detected."
      : severity === "MEDIUM"
      ? "⚠️ Network showing stress signals."
      : "System looks stable on the surface.";

  return `🐦 ArcSense Signal

${percent}% failure rate (${report.failed}/${report.total} tx)

${tone}

But here’s the signal:

${trend}

${insight}

Tracking failures > tracking activity.

#Arc #Testnet #OnchainData`;
}