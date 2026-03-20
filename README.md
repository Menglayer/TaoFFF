# TaoFFF — USDT-Denominated Hedge Arbitrage Trading Platform

TaoFFF is a semi-automated quantitative trading tool designed for cross-exchange funding rate arbitrage. It monitors funding rates across major exchanges to detect spread opportunities and facilitate execution of delta-neutral hedge trades.

## Features

*   Real-time funding rate monitoring across 16 exchanges (Binance, Coinbase, OKX, Bybit, Bitget, Backpack, Gate, KuCoin, HTX, MEXC, Hyperliquid, Aster, Lighter, GRVT, Extended, edgeX)
*   Cross-exchange spread detection and opportunity ranking
*   One-click hedge trade execution for simultaneous long and short positions
*   Automated loop monitoring with configurable entry and exit thresholds
*   P&L tracking featuring a cumulative funding earned chart
*   Alert system with configurable rules and cooldown periods
*   CSV data export for rates, trades, and opportunities
*   Responsive dark-themed UI with WebSocket real-time updates

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│                   Frontend                    │
│   React 19 + TypeScript + TailwindCSS 4      │
│   Zustand Stores + WebSocket Client          │
├─────────────────────────────────────────────┤
│                   Backend                     │
│   Fastify 5 + TypeScript                     │
│   ┌─────────┐ ┌──────────┐ ┌──────────┐    │
│   │ Funding  │ │ Spread   │ │ Order    │    │
│   │ Engine   │ │ Engine   │ │ Executor │    │
│   ├─────────┤ ├──────────┤ ├──────────┤    │
│   │ Loop     │ │ Alert    │ │ WS Hub   │    │
│   │ Engine   │ │ Engine   │ │          │    │
│   └─────────┘ └──────────┘ └──────────┘    │
│   ┌─────────────────────────────────────┐    │
│   │ Exchange Adapters (CCXT Pro + HL)   │    │
│   │ Binance | OKX | Bybit | Hyperliquid│    │
│   └─────────────────────────────────────┘    │
│   SQLite (Drizzle ORM) + AES-256-GCM        │
└─────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 5.9, TailwindCSS 4, Zustand 5, Vite 6 |
| Backend | Node.js, Fastify 5, TypeScript 5.9 |
| Database | SQLite (better-sqlite3) + Drizzle ORM |
| Exchange Data | CCXT 4 Pro (major CEX), @nktkas/hyperliquid, custom adapters (Aster/Lighter/GRVT/Extended/edgeX) |
| Charts | lightweight-charts 5 |
| Linting | Biome 2 |
| Testing | Vitest 3 |

## Prerequisites

*   Node.js >= 20
*   pnpm >= 9

## Getting Started

```bash
# Clone the repo
git clone <repo-url>
cd TaoFFF

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your settings (MASTER_KEY is required for API key encryption)

# Build shared package
pnpm --filter @taofff/shared build

# Start backend (development)
pnpm --filter @taofff/backend dev

# Start frontend (development)
pnpm --filter @taofff/frontend dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| PORT | Server port (default: 8080) |
| HOST | Server host (default: 0.0.0.0) |
| MASTER_KEY | 32+ character string for AES-256-GCM encryption of API keys |
| DB_PATH | Path to the SQLite database file |
| MIN_NET_APR_PCT | Minimum net APR threshold for opportunity detection |
| TRADING_FEE_PCT | Estimated trading fee percentage for calculations |
| SLIPPAGE_PCT | Estimated slippage percentage for calculations |
| DEFAULT_LEVERAGE | Default leverage used for calculations |
| BORROW_RATE_DAILY | Daily borrowing rate for margin calculations |
| REBALANCE_TIMES_PER_YEAR | Number of rebalances per year for cost estimation |
| STALENESS_THRESHOLD_SECONDS | Seconds before data is considered stale |
| WS_BROADCAST_INTERVAL_SECONDS | Interval for WebSocket data broadcasts |
| WS_FULL_SNAPSHOT_INTERVAL_SECONDS | Interval for full WebSocket state snapshots |
| BINANCE_SETTLEMENT_HOURS | Funding settlement interval for Binance |
| OKX_SETTLEMENT_HOURS | Funding settlement interval for OKX |
| BYBIT_SETTLEMENT_HOURS | Funding settlement interval for Bybit |
| HYPERLIQUID_SETTLEMENT_HOURS | Funding settlement interval for Hyperliquid |
| HYPERLIQUID_POLL_INTERVAL_SECONDS | Polling interval for Hyperliquid data |
| RETENTION_DAYS_RATES | Days to keep historical funding rate data |
| RETENTION_DAYS_TRADES | Days to keep trade history data |
| RETENTION_DAYS_METRICS | Days to keep performance metrics |

## Project Structure

```
TaoFFF/
├── packages/
│   ├── shared/          # Types, schemas, formulas, utilities
│   ├── backend/         # Fastify API server + exchange adapters
│   │   ├── src/
│   │   │   ├── core/        # FundingEngine, SpreadEngine, OrderExecutor, LoopEngine, AlertEngine
│   │   │   ├── db/          # Drizzle schema + repositories
│   │   │   ├── exchanges/   # Exchange adapters (CEX + Perp DEX incl. Aster/Lighter/GRVT/Extended/edgeX)
│   │   │   ├── security/    # AES-256-GCM encryption
│   │   │   └── web/         # Route handlers + WebSocket
│   │   └── data/            # SQLite database
│   └── frontend/        # React SPA
│       └── src/
│           ├── components/  # Layout, FilterBar, Charts, Skeleton, ErrorBoundary
│           ├── pages/       # FundingRate, Trading, LoopMonitor, History, Settings
│           ├── stores/      # Zustand state management
│           └── ws/          # WebSocket client
├── biome.json           # Linter/formatter config
├── vitest.workspace.ts  # Test config
└── tsconfig.base.json   # Shared TypeScript config
```

## Pages Overview

*   **Funding Rates** — Live multi-exchange rate table with sorting, filtering, and quality indicators.
*   **Trading** — Symbol selection, orderbook display, and one-click hedge execution.
*   **Loop Monitor** — Automated spread monitoring with configurable thresholds for entry and exit.
*   **History & P&L** — Trade history log, cumulative funding chart, and alert history.
*   **Settings** — API key management, arbitrage configuration, alert rules, and data export tools.

## API Endpoints

### Rates
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/rates | Get current funding rates across all exchanges |
| GET | /api/rates/:symbol/history | Get historical rates for a symbol |
| GET | /api/status | Get connection status for exchanges |
| GET | /api/symbols | Get list of available symbols |

### Opportunities
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/opportunities | Get current arbitrage opportunities |
| GET | /api/opportunities/history | Get historical opportunity logs |

### Trading
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/orderbook/:symbol | Get consolidated orderbook (placeholder) |

### API Keys
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/keys | List configured exchanges and key metadata |
| POST | /api/keys/:exchange | Save or update encrypted API keys |
| DELETE | /api/keys/:exchange | Remove API keys for an exchange |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Server health check |

### WebSocket
| URL | Description |
|-----|-------------|
| /ws | Real-time updates for rates, opportunities, and engine state |

## Development

```bash
# Start both backend and frontend
pnpm dev

# Region-safe startup (disables Bybit when geo-blocked)
pnpm dev:cn

# If local ports are stuck by zombie node processes, reset then start
pnpm dev:reset
```

```bash
# Run tests
pnpm --filter @taofff/shared test
pnpm --filter @taofff/backend test

# Lint check
pnpm biome check .

# Build all
pnpm --filter @taofff/shared build
pnpm --filter @taofff/frontend build

# Type check backend
pnpm --filter @taofff/backend exec tsc --noEmit
```

## Security Notes

*   API keys are encrypted at rest using AES-256-GCM.
*   A MASTER_KEY is required in the environment to perform encryption and decryption.
*   The application does not include built-in authentication as it is intended for personal use.
*   Do not expose this tool to the public internet without an additional security layer (e.g., VPN, reverse proxy with auth).

## License

MIT
