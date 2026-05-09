import * as fs from "fs";
import * as path from "path";

// ── Config ────────────────────────────────────────────────────
const LOG_PATH = path.join(process.cwd(), "reports", "agent-log.json");
const MAX_LOGS = 100;

// ── Types ─────────────────────────────────────────────────────
export type DecisionType =
  | "NETWORK_CHECK"
  | "CONTRACT_SCAN"
  | "BLOCK_ANALYSIS"
  | "NO_ACTION"
  | "PAYMENT_SENT"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_FAILED"
  | "ERROR";

export type AgentDecision = {
  id:           string;
  type:         DecisionType;
  timestamp:    string;
  reasoning:    string;
  action:       string;
  paid:         boolean;
  amountPaid:   number;
  txId:         string | null;
  data:         any;
  cycleNumber:  number;
};

export type AgentStats = {
  totalCycles:       number;
  totalDecisions:    number;
  totalPaid:         number;
  totalUsdcSpent:    number;
  lastRunAt:         string | null;
  startedAt:         string;
  status:            "RUNNING" | "IDLE" | "ERROR";
};

type LogStore = {
  stats:     AgentStats;
  decisions: AgentDecision[];
};

// ── Store helpers ─────────────────────────────────────────────
function loadLog(): LogStore {
  try {
    if (!fs.existsSync(LOG_PATH)) {
      return {
        stats: {
          totalCycles:    0,
          totalDecisions: 0,
          totalPaid:      0,
          totalUsdcSpent: 0,
          lastRunAt:      null,
          startedAt:      new Date().toISOString(),
          status:         "IDLE",
        },
        decisions: [],
      };
    }
    return JSON.parse(fs.readFileSync(LOG_PATH, "utf-8"));
  } catch {
    return {
      stats: {
        totalCycles:    0,
        totalDecisions: 0,
        totalPaid:      0,
        totalUsdcSpent: 0,
        lastRunAt:      null,
        startedAt:      new Date().toISOString(),
        status:         "IDLE",
      },
      decisions: [],
    };
  }
}

function saveLog(store: LogStore): void {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LOG_PATH, JSON.stringify(store, null, 2));
}

// ── Public functions ──────────────────────────────────────────
export function logDecision(decision: Omit<AgentDecision, "id" | "timestamp">): AgentDecision {
  const store = loadLog();

  const entry: AgentDecision = {
    ...decision,
    id:        `decision-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };

  // Keep only last MAX_LOGS decisions
  store.decisions.unshift(entry);
  if (store.decisions.length > MAX_LOGS) {
    store.decisions = store.decisions.slice(0, MAX_LOGS);
  }

  // Update stats
  store.stats.totalDecisions++;
  store.stats.lastRunAt = entry.timestamp;

  if (decision.paid && decision.amountPaid > 0) {
    store.stats.totalPaid++;
    store.stats.totalUsdcSpent = parseFloat(
      (store.stats.totalUsdcSpent + decision.amountPaid).toFixed(4)
    );
  }

  saveLog(store);

  console.log(`🤖 Agent [${decision.type}] — ${decision.action}`);
  if (decision.paid) {
    console.log(`   💸 Paid ${decision.amountPaid} USDC | tx: ${decision.txId}`);
  }

  return entry;
}

export function incrementCycle(): number {
  const store = loadLog();
  store.stats.totalCycles++;
  store.stats.lastRunAt = new Date().toISOString();
  saveLog(store);
  return store.stats.totalCycles;
}

export function setAgentStatus(status: AgentStats["status"]): void {
  const store = loadLog();
  store.stats.status = status;
  saveLog(store);
}

export function getAgentStats(): AgentStats {
  return loadLog().stats;
}

export function getRecentDecisions(limit = 20): AgentDecision[] {
  return loadLog().decisions.slice(0, limit);
}

export function getFullLog(): LogStore {
  return loadLog();
}