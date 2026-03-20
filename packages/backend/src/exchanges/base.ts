import type { Exchange, FundingRateSnapshot } from "@taofff/shared"

/** Best bid/offer for a symbol from this exchange */
export interface BBO {
	symbol: string
	exchange: Exchange
	bestBid: number
	bestAsk: number
	bestBidSize: number
	bestAskSize: number
	timestamp: number
}

/**
 * Compute an exponential backoff delay with a cap.
 * Returns milliseconds to wait before the next retry.
 */
export function exponentialBackoff(attempt: number, baseMs = 1000, maxMs = 60000): number {
	return Math.min(baseMs * 2 ** attempt, maxMs)
}

/**
 * Abstract base class for all exchange adapters.
 *
 * Each adapter exposes read-only funding rate data via REST and streaming.
 * No API keys are required — only public market data endpoints are used.
 */
export abstract class BaseExchange {
	/** Exchange identifier from the shared enum */
	abstract readonly exchangeId: Exchange

	/** Hours between funding settlements (8 for most CEX, 1 for Hyperliquid) */
	abstract readonly settlementHours: number

	/**
	 * REST: fetch current funding rates for all USDT-margined perpetuals.
	 */
	abstract fetchAllFundingRates(): Promise<FundingRateSnapshot[]>

	/**
	 * WebSocket / polling: start streaming funding rate updates.
	 * Calls `onUpdate` with new snapshots whenever data arrives.
	 */
	abstract startStreaming(onUpdate: (snapshots: FundingRateSnapshot[]) => void): Promise<void>

	/**
	 * Stop streaming and clean up connections.
	 */
	abstract stopStreaming(): Promise<void>

	/**
	 * Check whether streaming is currently active.
	 */
	abstract isStreaming(): boolean

	/**
	 * Get the list of USDT-margined perpetual symbols available on this exchange.
	 */
	abstract fetchPerpSymbols(): Promise<string[]>

	/**
	 * Update the symbol list for streaming without restarting.
	 * CEX adapters override this to swap the active symbols array.
	 * Default is a no-op (e.g. Hyperliquid fetches all symbols each poll).
	 */
	updateSymbols(_symbols: string[]): void {
		// Default no-op — subclasses override as needed
	}

	/**
	 * Get the currently streaming symbols.
	 */
	getSymbols(): string[] {
		return []
	}

	/**
	 * Watch orderbook for a specific symbol.
	 */
	watchOrderBook?(symbol: string, onUpdate: (bbo: BBO) => void): Promise<void>

	/**
	 * Stop watching orderbook for a specific symbol.
	 */
	stopOrderBook?(symbol: string): Promise<void>
}
