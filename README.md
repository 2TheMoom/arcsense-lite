# ArcSense Lite

**Real-time signal intelligence and autonomous agent commerce on Arc Testnet.**

ArcSense scans live blocks on Arc Network's testnet, detects failed transactions, identifies problematic contracts, and surfaces actionable intelligence through a live dashboard — powered by a pay-per-query API and an autonomous agent that purchases intelligence using USDC.

> Built by [Abu Olumi](https://x.com/olumi441) · Powered by [Arc](https://x.com/arc) · Circle Wallets + USDC on Arc Testnet

---

## Live

| | |
|---|---|
| **Dashboard** | [arcsense-lite.vercel.app](https://arcsense-lite.vercel.app) |
| **Engine API** | [arcsense-lite-production.up.railway.app](https://arcsense-lite-production.up.railway.app) |
| **Arc Explorer** | [testnet.arcscan.app](https://testnet.arcscan.app) |
| **X** | [@ArcSense_](https://x.com/ArcSense_) |

---

## What ArcSense Does

Most tools track transaction volume. ArcSense tracks where things break — and acts on it autonomously.

- Scans every live Arc Testnet block in real time
- Detects failed transactions and identifies which contracts cause them
- Tracks failure patterns across blocks with behavioral classification
- Fires alerts when failure rate crosses 10% or 15%
- Generates weekly intelligence reports automatically every 7 days
- Exposes a **pay-per-query intelligence API** open to any Arc Testnet wallet
- Runs an **autonomous agent** that monitors the network, makes decisions, and pays for intelligence using USDC via Circle Wallets — no human involvement

---

## Autonomous Agent

The ArcSense Agent runs on a 5-minute scheduler and operates entirely without human input.

**Every cycle the agent:**

1. Fetches live network health directly from the engine — bypasses the payment gate entirely
2. Runs a decision engine against configurable thresholds
3. If conditions are met, sends 0.1 USDC from its own Circle Wallet to the ArcSense service wallet
4. Receives paid intelligence — contract risk scores or block analysis
5. Logs the full decision with a clickable Arc Explorer transaction link

**Decision thresholds:**

| Condition | Action |
|---|---|
| Health score < 85 | Buy contract risk scan |
| Failure rate ≥ 3% | Buy block analysis |
| Failure rate ≥ 10% | Buy deep contract scan (CRITICAL) |

**Agent endpoints:**

```
GET  /agent/status       — current agent state + lifetime stats
GET  /agent/log          — decision log with tx links
POST /agent/run          — manually trigger one cycle
POST /agent/start        — start the scheduler
POST /agent/stop         — stop the scheduler
```

**Agent wallet:** `0x4f8633b1fe3de6754ce0a6a7d784d52e3de0511f`
**Service wallet:** `0xb0717528602bc5bd26e143445a87846b2a5f6218`

All payments are real USDC transfers on Arc Testnet, verifiable on [Arc Explorer](https://testnet.arcscan.app).

---

## Pay-Per-Query Intelligence API

ArcSense exposes a gated intelligence API open to any developer or autonomous system on Arc Testnet.

### Pricing

| Tier | Cost |
|---|---|
| Free tier | 5 queries per wallet |
| Paid tier | 0.1 USDC per query |

### Payment

Send USDC to the service wallet on Arc Testnet using **any EVM wallet** — MetaMask, Rabby, or programmatically. No Circle account required for external users.

```
Service wallet: 0xb0717528602bc5bd26e143445a87846b2a5f6218
Network: Arc Testnet
Token: USDC (native)
```

### Endpoints

```
GET  /api/intelligence/network                    — Network health snapshot
GET  /api/intelligence/contract/:address          — Contract risk score + classification
GET  /api/intelligence/block/:number              — Block analysis
GET  /api/intelligence/usage                      — Wallet usage stats + paid credits
POST /api/intelligence/confirm/:queryId           — Confirm payment and add 1 credit
GET  /reports/weekly                              — Latest weekly intelligence report
```

All GET intelligence endpoints accept `?wallet=0xYOURWALLET&mode=prepay` query params.

### Full production URLs

```
GET  https://arcsense-lite-production.up.railway.app/api/intelligence/network?wallet=YOUR_WALLET_ADDRESS&mode=prepay
GET  https://arcsense-lite-production.up.railway.app/api/intelligence/contract/0xCONTRACT?wallet=YOUR_WALLET_ADDRESS
GET  https://arcsense-lite-production.up.railway.app/api/intelligence/block/BLOCK_NUMBER?wallet=YOUR_WALLET_ADDRESS
GET  https://arcsense-lite-production.up.railway.app/api/intelligence/usage?wallet=YOUR_WALLET_ADDRESS
POST https://arcsense-lite-production.up.railway.app/api/intelligence/confirm/QUERY_ID
```

Replace `YOUR_WALLET_ADDRESS` with your actual Arc Testnet wallet address.

### How to query

**Step 1 — Check your free queries:**
```bash
GET /api/intelligence/usage?wallet=0xYOUR_ADDRESS
```

**Step 2 — Query while free:**
```bash
GET /api/intelligence/network?wallet=0xYOUR_ADDRESS&mode=prepay
```

**Step 3 — After free tier, pay to continue:**

The API returns a `payment` object with step-by-step instructions:
```json
{
  "success": false,
  "payment": {
    "required": true,
    "amount": 0.1,
    "destination": "0xb0717528602bc5bd26e143445a87846b2a5f6218",
    "instructions": [
      "1. Send exactly 0.1 USDC to: 0xb071...6218",
      "2. Use any Arc Testnet EVM wallet",
      "3. Call POST /api/intelligence/confirm/:queryId",
      "4. Body: { wallet, txId }",
      "5. 1 credit added — next query served immediately"
    ]
  }
}
```

**Step 4 — Confirm and unlock:**
```bash
POST /api/intelligence/confirm/:queryId
Body: { "wallet": "0xYOURS", "txId": "0xTX_HASH" }
```

Payment is verified via Blockscout on Arc Testnet. No Circle API required. One credit is added per payment and consumed automatically on the next query.

### Selective queries

Each endpoint is independently gated. Pay only for what you query:

```bash
# Contract risk only
GET /api/intelligence/contract/0xABC?wallet=0xYOURS

# Network health only
GET /api/intelligence/network?wallet=0xYOURS

# Specific block only
GET /api/intelligence/block/41234567?wallet=0xYOURS
```

### Example response

```json
{
  "success": true,
  "queryId": "abc-123",
  "data": {
    "healthScore": 83,
    "status": "HEALTHY",
    "avgFailureRate": "4.25%",
    "totalTransactions": 482,
    "totalFailures": 20,
    "topFailingContracts": [],
    "latestBlock": 41552295,
    "meta": {
      "tier": "FREE",
      "queriesRemaining": 4
    }
  }
}
```

---

## Dashboard

**[arcsense-lite.vercel.app](https://arcsense-lite.vercel.app)**

The dashboard has a landing page that loads first with live stats pulled from the engine. Click Launch Dashboard to enter the live interface.

| Panel | Description |
|---|---|
| Block Feed | Live scrolling stream of blocks with failure indicators |
| Failure Chart | Last 30 blocks with rolling average and severity zones |
| Contract Intelligence | Ranked failing contracts with behavioral classification and Arc Explorer links |
| Agent Intelligence | Live agent status, decision log, USDC spent, manual trigger |
| Stats Row | Blocks scanned, total failures, avg rate, alerts, agent cycles, USDC spent |
| API Access | Full production endpoint URLs, service wallet, payment instructions — topbar |
| Weekly Reports | Auto-generated weekly intelligence report — topbar |

**Contract classifications:**
- 📛 HIGH FREQUENCY FAILER — 10+ failures, 2+ per block
- ⚠️ REPEAT OFFENDER — appeared in 5+ blocks
- 🆕 NEW FAILURE — recent, 2+ failures
- 🔄 RECURRING PATTERN — 1.5+ failures per block
- 🔍 OCCASIONAL FAILURE — isolated incidents

---

## Weekly Reports

ArcSense automatically generates weekly intelligence reports every 7 days.

Each report includes:
- Total blocks and transactions analyzed
- Average and peak failure rates
- Alert count and critical block count
- Network health score (0—100)
- Top 5 failing contracts of the week
- Most volatile block
- Plain-English weekly insight

Reports are accessible via the Weekly Reports button in the dashboard topbar and via the `/reports/weekly` API endpoint.

---

## Stack

| Layer | Tech |
|---|---|
| Engine | TypeScript + Node.js |
| Blockchain | ethers.js v6 + Arc Testnet RPC |
| Payments | Circle Developer Wallets + USDC |
| Payment verification | Blockscout API (testnet.arcscan.app) |
| API | Express + CORS |
| Dashboard | React + Vite + Recharts |
| Engine hosting | Railway |
| Dashboard hosting | Vercel |
| Monitoring | UptimeRobot |

---

## Project Structure

```
arcsense-lite/
├── src/
│   ├── agent/
│   │   ├── arcAgent.ts           # Autonomous agent loop + scheduler
│   │   ├── agentWallet.ts        # Circle wallet + Blockscout payment
│   │   ├── agentDecision.ts      # Decision engine + thresholds
│   │   └── agentLogger.ts        # Persistent decision log
│   ├── analysis/
│   │   ├── analyzeBlock.ts       # Block scanning + failure detection
│   │   └── reportGenerator.ts    # Terminal output + weekly reports
│   ├── api/
│   │   └── intelligenceApi.ts    # Gated intelligence endpoints
│   ├── config/
│   │   ├── env.ts
│   │   └── network.ts
│   ├── payment/
│   │   ├── circlePayment.ts      # Circle API wrapper
│   │   └── queryTracker.ts       # Free tier + paid credits + usage tracking
│   ├── utils/
│   │   └── provider.ts           # Arc Testnet RPC provider
│   └── index.ts                  # Engine entry point + API routes
├── dashboard/
│   └── src/
│       └── App.jsx               # Full React dashboard + landing page
├── reports/
│   ├── weekly-store.json         # Weekly snapshot accumulator
│   └── weekly-*.json             # Generated weekly report files
├── .env.example
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Circle Developer account (for agent payments)

### 1. Clone

```bash
git clone https://github.com/2TheMoon/arcsense-lite.git
cd arcsense-lite
```

### 2. Install

```bash
npm install
```

### 3. Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
RPC_URL=https://rpc.testnet.arc.network

# Circle (required for agent payments)
CIRCLE_API_KEY=TEST_API_KEY:your_key
CIRCLE_ENTITY_SECRET=your_hex_secret
CIRCLE_ENTITY_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----

# Service wallet (receives payments)
CIRCLE_WALLET_ADDRESS=0xYOUR_SERVICE_WALLET
CIRCLE_WALLET_ID=your-wallet-id
CIRCLE_WALLET_SET_ID=your-wallet-set-id

# Agent wallet (sends payments)
CIRCLE_AGENT_WALLET_ADDRESS=0xYOUR_AGENT_WALLET
CIRCLE_AGENT_WALLET_ID=your-agent-wallet-id
```

### 4. Run engine

```bash
npx ts-node src/index.ts
```

API available at `http://localhost:3001`.

### 5. Run dashboard

```bash
cd dashboard
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## Deployment

### Engine → Railway

1. Connect GitHub repo to [Railway](https://railway.app)
2. Add all environment variables from `.env`
3. Build: `npm run build`
4. Start: `npm start`

### Dashboard → Vercel

1. Import repo to [Vercel](https://vercel.com)
2. Root directory: `dashboard`
3. Build: `npm run build`
4. Output: `dist`

---

## Circle Integration

ArcSense uses Circle Developer Wallets for agent-to-service USDC transfers on Arc Testnet.

- **Agent wallet** — holds USDC, sends 0.1 USDC per intelligence purchase autonomously
- **Service wallet** — receives payments from agent and external developers, balance visible on dashboard
- **External payments** — verified via Blockscout API, no Circle account needed for external users
- **Fee level** — MEDIUM for all transfers on Arc Testnet
- **Credit system** — each confirmed payment adds 1 credit to the wallet, consumed automatically on the next query

---

## What's Next

- Historical pattern tracking across sessions
- Multi-contract correlation analysis
- Contract search bar
- Arc Mainnet support

---

## License

MIT

---

*ArcSense is an independent community tool. Not officially affiliated with Arc Network or Circle.*