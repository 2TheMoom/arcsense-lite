import fs from "fs";
import path from "path";

export function saveReport(data: any) {
  const dir = path.join(__dirname, "../../reports/output");

  // ensure folder exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const jsonPath = path.join(dir, `report-${timestamp}.json`);
  const txtPath = path.join(dir, `report-${timestamp}.txt`);

  // save JSON
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));

  // save readable text
  const text = `
ArcSense Report
Time: ${new Date().toLocaleString()}

Blocks Analyzed: ${data.blocks}
Total Transactions: ${data.totalTx}
Total Failed: ${data.totalFailed}
Avg Failure Rate: ${(data.avgFailureRate * 100).toFixed(2)}%

Top Failing Contracts:
${data.topFailingContracts
  .map(([addr, count]: [string, number]) => `- ${addr} → ${count}`)
  .join("\n")}
`;

  fs.writeFileSync(txtPath, text);

  console.log("\n💾 Reports saved:");
  console.log(jsonPath);
  console.log(txtPath);
}