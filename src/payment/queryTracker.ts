import * as fs from "fs";
import * as path from "path";

// ── Config ────────────────────────────────────────────────────
const FREE_QUERIES    = 5;
const QUERY_PRICE     = 0.1; // USDC
const STORE_PATH      = path.join(process.cwd(), "reports", "query-store.json");

// ── Types ─────────────────────────────────────────────────────
export type PaymentMode = "prepay" | "postpay";

export type WalletUsage = {
  walletAddress:  string;
  freeQueriesLeft: number;
  totalQueries:   number;
  totalSpent:     number;
  preferredMode:  PaymentMode;
  pendingPayment: PendingPayment | null;
  createdAt:      string;
  lastQueryAt:    string;
};

export type PendingPayment = {
  queryId:       string;
  amountDue:     number;
  requestedAt:   string;
  expiresAt:     string;
  intelligence:  any;
};

// ── Store ─────────────────────────────────────────────────────
type Store = Record<string, WalletUsage>;

function loadStore(): Store {
  try {
    if (!fs.existsSync(STORE_PATH)) return {};
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function saveStore(store: Store): void {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

// ── Wallet helpers ────────────────────────────────────────────
export function getOrCreateWallet(walletAddress: string): WalletUsage {
  const store = loadStore();
  const addr  = walletAddress.toLowerCase();

  if (!store[addr]) {
    store[addr] = {
      walletAddress:   addr,
      freeQueriesLeft: FREE_QUERIES,
      totalQueries:    0,
      totalSpent:      0,
      preferredMode:   "prepay",
      pendingPayment:  null,
      createdAt:       new Date().toISOString(),
      lastQueryAt:     new Date().toISOString(),
    };
    saveStore(store);
    console.log(`🆕 New wallet registered: ${addr} — ${FREE_QUERIES} free queries granted`);
  }

  return store[addr];
}

export function hasFreeQueries(walletAddress: string): boolean {
  const usage = getOrCreateWallet(walletAddress);
  return usage.freeQueriesLeft > 0;
}

export function deductFreeQuery(walletAddress: string): void {
  const store = loadStore();
  const addr  = walletAddress.toLowerCase();
  const usage = store[addr];
  if (!usage) return;

  usage.freeQueriesLeft = Math.max(0, usage.freeQueriesLeft - 1);
  usage.totalQueries++;
  usage.lastQueryAt = new Date().toISOString();
  saveStore(store);
  console.log(`✅ Free query used — ${usage.freeQueriesLeft} remaining for ${addr}`);
}

export function recordPaidQuery(walletAddress: string): void {
  const store = loadStore();
  const addr  = walletAddress.toLowerCase();
  const usage = store[addr];
  if (!usage) return;

  usage.totalQueries++;
  usage.totalSpent  = parseFloat((usage.totalSpent + QUERY_PRICE).toFixed(4));
  usage.lastQueryAt = new Date().toISOString();
  saveStore(store);
  console.log(`💰 Paid query recorded — total spent: ${usage.totalSpent} USDC for ${addr}`);
}

export function setPreferredMode(walletAddress: string, mode: PaymentMode): void {
  const store = loadStore();
  const addr  = walletAddress.toLowerCase();
  const usage = getOrCreateWallet(walletAddress);
  store[addr] = { ...usage, preferredMode: mode };
  saveStore(store);
}

export function setPendingPayment(
  walletAddress: string,
  queryId: string,
  intelligence: any
): PendingPayment {
  const store   = loadStore();
  const addr    = walletAddress.toLowerCase();
  const now     = new Date();
  const expires = new Date(now.getTime() + 60 * 1000); // 60 seconds

  const pending: PendingPayment = {
    queryId,
    amountDue:    QUERY_PRICE,
    requestedAt:  now.toISOString(),
    expiresAt:    expires.toISOString(),
    intelligence,
  };

  store[addr].pendingPayment = pending;
  saveStore(store);
  console.log(`⏳ Postpay pending for ${addr} — expires at ${expires.toISOString()}`);
  return pending;
}

export function clearPendingPayment(walletAddress: string): void {
  const store = loadStore();
  const addr  = walletAddress.toLowerCase();
  if (store[addr]) {
    store[addr].pendingPayment = null;
    saveStore(store);
  }
}

export function isPendingExpired(walletAddress: string): boolean {
  const usage = getOrCreateWallet(walletAddress);
  if (!usage.pendingPayment) return false;
  return new Date() > new Date(usage.pendingPayment.expiresAt);
}

export function getQueryPrice(): number {
  return QUERY_PRICE;
}

export function getWalletStats(walletAddress: string): WalletUsage {
  return getOrCreateWallet(walletAddress);
}