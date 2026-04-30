import fs from "fs";
import path from "path";

export function analyzeTrend(current: any) {
  const dir = path.join(__dirname, "../../reports/output");

  if (!fs.existsSync(dir)) {
    return "No previous reports to compare.";
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  if (files.length < 2) {
    return "Not enough reports for trend analysis.";
  }

  const latestFile = files[files.length - 1];
  const prevFile = files[files.length - 2];

  const prev = JSON.parse(
    fs.readFileSync(path.join(dir, prevFile), "utf-8")
  );

  let output = "\n📈 Trend Analysis\n\n";

  // Failure rate comparison
  const prevRate = prev.avgFailureRate;
  const currRate = current.avgFailureRate;

  if (currRate > prevRate) {
    output += `Failure rate increased (${(prevRate * 100).toFixed(2)}% → ${(currRate * 100).toFixed(2)}%)\n`;
  } else if (currRate < prevRate) {
    output += `Failure rate decreased (${(prevRate * 100).toFixed(2)}% → ${(currRate * 100).toFixed(2)}%)\n`;
  } else {
    output += `Failure rate unchanged (${(currRate * 100).toFixed(2)}%)\n`;
  }

  // Contract comparison
  const prevMap: Record<string, number> = Object.fromEntries(
    prev.topFailingContracts || []
  );

  const currMap: Record<string, number> = Object.fromEntries(
    current.topFailingContracts || []
  );

  // New failing contracts
  for (const addr in currMap) {
    if (!prevMap[addr]) {
      output += `New failing contract: ${addr}\n`;
    }
  }

  // Increased failures
  for (const addr in currMap) {
    if (prevMap[addr] && currMap[addr] > prevMap[addr]) {
      output += `Contract ${addr} failures increased (${prevMap[addr]} → ${currMap[addr]})\n`;
    }
  }

  return output;
}