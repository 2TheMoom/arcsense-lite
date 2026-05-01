import fs from "fs";
import path from "path";

export function saveReport(report: any) {
  const outputDir = path.join(process.cwd(), "reports/output");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const jsonPath = path.join(outputDir, `report-${timestamp}.json`);
  const txtPath = path.join(outputDir, `report-${timestamp}.txt`);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(txtPath, JSON.stringify(report, null, 2));

  return { jsonPath, txtPath };
}