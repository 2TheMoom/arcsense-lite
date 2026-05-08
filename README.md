# ArcSense Lite

**Lightweight signal intelligence for Arc Testnet.**

ArcSense scans live blocks on Arc Network's testnet, detects failed transactions, identifies problematic contracts, and surfaces actionable insights in real time — through both a terminal engine and a live web dashboard.

> Built by [Abu Olumi](https://x.com/olumi441) · Powered by [Arc](https://x.com/arc)

---

## Live Dashboard

**[arcsense-lite.vercel.app](https://arcsense-lite.vercel.app)**

---

## What It Does

Most tools track transaction volume. ArcSense tracks where things break.

- Scans live Arc Testnet blocks in real time
- Detects failed transactions per block
- Identifies which contracts are causing failures
- Tracks failure patterns across blocks (not just per block)
- Classifies severity: LOW / MEDIUM / HIGH
- Fires alerts when failure rate crosses 10% or 15%
- Generates weekly intelligence reports automatically
- Exposes a live API for the dashboard frontend

---

## Stack

| Layer | Tech |
|---|---|
| Engine | TypeScript + Node.js |
| Blockchain | ethers.js v6 → Arc Testnet RPC |
| API | Express + CORS |
| Dashboard | React + Vite + Recharts |
| Hosting (engine) | Railway |
| Hosting (dashboard) | Vercel |
| Uptime monitoring | UptimeRobot |

---

## Project Structure

```
arcsense-lite/
├── src/
│   ├── analysis/
│   │   ├── analyzeBlock.ts       # Block scanning + failure detection
│   │   └── reportGenerator.ts    # Terminal output + weekly reports
│   ├── config/
│   │   ├── env.ts
│   │   └── network.ts
│   ├── monitor/
│   │   └── realtimeMonitor.ts
│   ├── storage/
│   │   ├── stateStorage.ts       # In-memory state + contract history
│   │   └── fileStorage.ts
│   ├── utils/
│   │   └── provider.ts           # Arc Testnet RPC provider
│   ├── worker/
│   │   └── analyzerWorker.ts
│   └── index.ts                  # Engine entry point + Express API
├── dashboard/
│   └── src/
│       └── App.jsx               # Full React dashboard
├── reports/
│   └── output/                   # Weekly report files (.txt + .json)
├── .env.example
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### 1. Clone the repo

```bash
git clone https://github.com/2TheMoon/arcsense-lite.git
cd arcsense-lite
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment

```bash
cp .env.example .env
```

Edit `.env`:

```
RPC_URL=https://rpc.testnet.arc.network
```

### 4. Run the engine locally

```bash
npx ts-node src/index.ts
```

The engine will start scanning Arc Testnet and expose an API at `http://localhost:3001/reports`.

### 5. Run the dashboard locally

```bash
cd dashboard
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## API

### `GET /reports`

Returns the latest block reports and persistent counters.

```json
{
  "meta": {
    "totalBlocksScanned": 342,
    "totalAlertsTriggered": 18
  },
  "reports": [
    {
      "blockNumber": 41118798,
      "totalTx": 21,
      "failedTx": 2,
      "failureRate": 0.095,
      "topFailingContracts": {
        "0x9e05...f8FA": 2
      }
    }
  ]
}
```

---

## Dashboard Features

- **Live block feed** — scrolling stream of blocks with failure indicators
- **Failure rate chart** — last 30 blocks with rolling average + severity zones
- **Contract intelligence** — ranked failing contracts with Arc Explorer links
- **Alert system** — WARNING (≥10%) and CRITICAL (≥15%) toasts
- **Signal summary** — trend, insight, and severity in the topbar
- **Responsive** — works on desktop and mobile

---

## Weekly Reports

ArcSense automatically generates weekly intelligence reports saved to `reports/output/`.

Each report includes:
- Total blocks and transactions analyzed
- Average and peak failure rates
- Alert count and critical block count
- Network health score (0–100)
- Top 5 failing contracts of the week
- Most volatile block
- Plain-English weekly insight

Reports are saved as both `.txt` (readable) and `.json` (for programmatic use).

To trigger a report manually for testing, add this temporarily to `src/index.ts`:

```typescript
import { triggerWeeklyReport } from "./analysis/reportGenerator";
setTimeout(() => triggerWeeklyReport(), 10000);
```

---

## Deployment

### Engine → Railway

1. Connect your GitHub repo to [Railway](https://railway.app)
2. Set environment variable: `RPC_URL=https://rpc.testnet.arc.network`
3. Build command: `npm run build`
4. Start command: `npm start`

### Dashboard → Vercel

1. Import repo to [Vercel](https://vercel.com)
2. Set root directory to `dashboard`
3. Build command: `npm run build`
4. Output directory: `dist`

---

## What's Next

- Historical pattern tracking across sessions
- Weekly report panel on the dashboard
- Multi-contract correlation analysis
- Arc Mainnet support

---

## License

MIT

---

*ArcSense is an independent community tool. Not officially affiliated with Arc Network or Circle.*
