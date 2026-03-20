import "dotenv/config"
import { resolve } from "node:path"

export interface AppConfig {
	port: number
	host: string
	masterKey: string
	dbPath: string
	minNetAprPct: number
	tradingFeePct: number
	slippagePct: number
	defaultLeverage: number
	borrowRateDaily: number
	rebalanceTimesPerYear: number
	stalenessThresholdSeconds: number
	wsBroadcastIntervalMs: number
	wsFullSnapshotIntervalMs: number
	binanceSettlementHours: number
	okxSettlementHours: number
	bybitSettlementHours: number
	hyperliquidSettlementHours: number
	hyperliquidPollIntervalMs: number
	retentionDaysRates: number
	retentionDaysTrades: number
	retentionDaysMetrics: number
	disabledExchanges: string[]
}

export function loadConfig(): AppConfig {
	return {
		port: Number(process.env.PORT || 8080),
		host: process.env.HOST || "0.0.0.0",
		masterKey: process.env.MASTER_KEY || "",
		dbPath: resolve(process.env.DB_PATH || "./data/taofff.db"),
		minNetAprPct: Number(process.env.MIN_NET_APR_PCT || 5.0),
		tradingFeePct: Number(process.env.TRADING_FEE_PCT || 0.05),
		slippagePct: Number(process.env.SLIPPAGE_PCT || 0.02),
		defaultLeverage: Number(process.env.DEFAULT_LEVERAGE || 1),
		borrowRateDaily: Number(process.env.BORROW_RATE_DAILY || 0.0001),
		rebalanceTimesPerYear: Number(process.env.REBALANCE_TIMES_PER_YEAR || 12),
		stalenessThresholdSeconds: Number(process.env.STALENESS_THRESHOLD_SECONDS || 120),
		wsBroadcastIntervalMs: Number(process.env.WS_BROADCAST_INTERVAL_SECONDS || 2) * 1000,
		wsFullSnapshotIntervalMs: Number(process.env.WS_FULL_SNAPSHOT_INTERVAL_SECONDS || 30) * 1000,
		binanceSettlementHours: Number(process.env.BINANCE_SETTLEMENT_HOURS || 8),
		okxSettlementHours: Number(process.env.OKX_SETTLEMENT_HOURS || 8),
		bybitSettlementHours: Number(process.env.BYBIT_SETTLEMENT_HOURS || 8),
		hyperliquidSettlementHours: Number(process.env.HYPERLIQUID_SETTLEMENT_HOURS || 1),
		hyperliquidPollIntervalMs: Number(process.env.HYPERLIQUID_POLL_INTERVAL_SECONDS || 30) * 1000,
		retentionDaysRates: Number(process.env.RETENTION_DAYS_RATES || 30),
		retentionDaysTrades: Number(process.env.RETENTION_DAYS_TRADES || 90),
		retentionDaysMetrics: Number(process.env.RETENTION_DAYS_METRICS || 14),
		disabledExchanges: (process.env.DISABLED_EXCHANGES || "")
			.split(",")
			.map((s) => s.trim().toLowerCase())
			.filter((s) => s.length > 0),
	}
}
