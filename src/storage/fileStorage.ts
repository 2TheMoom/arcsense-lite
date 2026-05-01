import fs from "fs";
import path from "path";

export function saveReport(reportData: any) {
  const outputDir = path.join(process.cwd(), "reports", "output");

  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const jsonPath = path.join(outputDir, `report-${timestamp}.json`);
  const txtPath = path.join(outputDir, `report-${timestamp}.txt`);

  // Save JSON
  fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2));

  // Save TXT
  const textReport = `
ArcSense Report

Blocks Analyzed: ${reportData.blocksAnalyzed}
Total Transactions: ${reportData.totalTransactions}
Total Failed: ${reportData.totalFailed}
Failure Rate: ${(reportData.avgFailureRate * 100).toFixed(2)}%

Top Failing Contracts:
${
  reportData.topFailingContracts.length > 0
    ? reportData.topFailingContracts
        .map(([addr, count]: [string, number]) => `- ${addr} → ${count}`)
        .join("\n")
    : "None"
}
`;

  fs.writeFileSync(txtPath, textReport.trim());

  return { jsonPath, txtPath };
}