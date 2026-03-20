import { STALENESS_THRESHOLDS } from "./constants"
import { DataQuality } from "./enums"

/**
 * Compute the delta between two objects, returning only changed fields.
 * Returns null if objects are identical.
 */
export function deltaDict<T extends Record<string, unknown>>(prev: T, curr: T): Partial<T> | null {
	const delta: Partial<T> = {}
	let hasChange = false

	for (const key of Object.keys(curr) as (keyof T)[]) {
		if (prev[key] !== curr[key]) {
			delta[key] = curr[key]
			hasChange = true
		}
	}

	return hasChange ? delta : null
}

/**
 * Normalize exchange-specific symbol formats to unified BASE/QUOTE.
 *
 * Examples:
 *   BTC-USDT-SWAP → BTC/USDT
 *   BTCUSDT       → BTC/USDT
 *   BTC/USDT:USDT → BTC/USDT
 *   BTC/USDT      → BTC/USDT
 */
export function normalizeSymbol(raw: string): string {
	// Already normalized
	if (/^[A-Z0-9]+\/[A-Z0-9]+$/.test(raw)) return raw

	// CCXT perpetual format: BTC/USDT:USDT
	if (raw.includes(":")) {
		return raw.split(":")[0]!
	}

	// OKX format: BTC-USDT-SWAP or BTC-USDT
	if (raw.includes("-")) {
		const parts = raw.split("-")
		return `${parts[0]}/${parts[1]}`
	}

	// Binance/Bybit format: BTCUSDT — find the quote currency
	const quotes = ["USDT", "USDC", "BUSD", "USD"]
	for (const quote of quotes) {
		if (raw.endsWith(quote)) {
			const base = raw.slice(0, -quote.length)
			if (base.length > 0) return `${base}/${quote}`
		}
	}

	return raw
}

/**
 * Assess data quality based on age of the last received data.
 */
export function assessDataQuality(receiveTs: number, nowTs?: number): DataQuality {
	const now = nowTs ?? Date.now()
	const ageMs = now - receiveTs

	if (ageMs < STALENESS_THRESHOLDS.FRESH_MS) return DataQuality.Fresh
	if (ageMs < STALENESS_THRESHOLDS.OK_MS) return DataQuality.OK
	if (ageMs < STALENESS_THRESHOLDS.STALE_MS) return DataQuality.Stale
	return DataQuality.Offline
}

/**
 * Generate a unique ID for entities.
 */
export function generateId(): string {
	return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Clamp a number to a range.
 */
export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max)
}

/**
 * Format a number as percentage string with specified decimal places.
 */
export function formatPct(value: number, decimals = 2): string {
	return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`
}

/**
 * Format a number as USDT amount.
 */
export function formatUsdt(value: number, decimals = 2): string {
	return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)} USDT`
}
