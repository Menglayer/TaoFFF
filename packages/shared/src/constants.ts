import { Exchange } from "./enums"

/** Staleness thresholds in milliseconds */
export const STALENESS_THRESHOLDS = {
	/** Data is considered fresh */
	FRESH_MS: 30_000,
	/** Data is OK but aging */
	OK_MS: 120_000,
	/** Data is stale — shown with warning */
	STALE_MS: 300_000,
	/** Beyond this, consider offline */
} as const

/** Settlement hours per exchange */
export const SETTLEMENT_HOURS: Record<Exchange, number> = {
	[Exchange.Binance]: 8,
	[Exchange.Coinbase]: 8,
	[Exchange.OKX]: 8,
	[Exchange.Bybit]: 8,
	[Exchange.Bitget]: 8,
	[Exchange.Backpack]: 8,
	[Exchange.Gate]: 8,
	[Exchange.KuCoin]: 8,
	[Exchange.HTX]: 8,
	[Exchange.MEXC]: 8,
	[Exchange.Hyperliquid]: 1,
	[Exchange.Aster]: 8,
	[Exchange.Lighter]: 1,
	[Exchange.GRVT]: 8,
	[Exchange.Extended]: 1,
	[Exchange.EdgeX]: 4,
} as const

/** Default configuration values */
export const DEFAULTS = {
	MIN_NET_APR_PCT: 5.0,
	TRADING_FEE_PCT: 0.05,
	SLIPPAGE_PCT: 0.02,
	DEFAULT_LEVERAGE: 1,
	BORROW_RATE_DAILY: 0.0001,
	REBALANCE_TIMES_PER_YEAR: 12,
	WS_BROADCAST_INTERVAL_MS: 2_000,
	WS_FULL_SNAPSHOT_INTERVAL_MS: 30_000,
	HYPERLIQUID_POLL_INTERVAL_MS: 30_000,
	ASTER_POLL_INTERVAL_MS: 30_000,
	LIGHTER_POLL_INTERVAL_MS: 30_000,
	GRVT_POLL_INTERVAL_MS: 30_000,
	EXTENDED_POLL_INTERVAL_MS: 30_000,
	EDGEX_POLL_INTERVAL_MS: 30_000,
	DB_RETENTION_DAYS_RATES: 30,
	DB_RETENTION_DAYS_TRADES: 90,
	DB_RETENTION_DAYS_METRICS: 14,
} as const

/** WebSocket close codes */
export const WS_CLOSE_CODES = {
	NORMAL: 1000,
	GOING_AWAY: 1001,
	SLOW_CLIENT: 4000,
	INVALID_MESSAGE: 4001,
} as const

/** CCXT perpetual symbol suffix for USDT-margined contracts */
export const PERP_SUFFIX = ":USDT"
