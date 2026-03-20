import type { FundingRateSnapshot } from "@taofff/shared"
import { assessDataQuality, computeApr, DEFAULTS, Exchange, SETTLEMENT_HOURS } from "@taofff/shared"
import { BaseExchange, exponentialBackoff } from "./base"

const BASE_URL = "https://fapi.asterdex.com"

/**
 * Aster DEX exchange adapter.
 *
 * Aster exposes a Binance-compatible Futures API at fapi.asterdex.com.
 * Uses REST polling because there is no dedicated funding-rate-only
 * WebSocket channel (the WS mark-price stream exists but REST is simpler
 * and consistent with other polling adapters).
 *
 * Key details:
 *  - 8-hour funding settlement (some symbols 4h — fundingInfo endpoint)
 *  - GET /fapi/v1/premiumIndex returns all symbols when no param given
 *  - GET /fapi/v1/exchangeInfo for perpetual symbols list
 *  - No auth required for public market data
 */

/** Raw premiumIndex entry from Aster (Binance-compatible) */
interface AsterPremiumIndex {
	symbol: string
	markPrice: string
	indexPrice: string
	lastFundingRate: string
	nextFundingTime: number
	interestRate: string
	time: number
}

/** Raw exchangeInfo symbol entry */
interface AsterSymbolInfo {
	symbol: string
	status: string
	contractType: string
	quoteAsset: string
	marginAsset: string
}

/** Raw exchangeInfo response */
interface AsterExchangeInfo {
	symbols: AsterSymbolInfo[]
}

export class AsterExchange extends BaseExchange {
	readonly exchangeId = Exchange.Aster
	readonly settlementHours = SETTLEMENT_HOURS[Exchange.Aster]

	private streaming = false
	private pollTimer: ReturnType<typeof setTimeout> | null = null
	private readonly pollIntervalMs: number

	constructor(pollIntervalMs?: number) {
		super()
		this.pollIntervalMs = pollIntervalMs ?? DEFAULTS.ASTER_POLL_INTERVAL_MS
	}

	async fetchAllFundingRates(): Promise<FundingRateSnapshot[]> {
		const res = await fetch(`${BASE_URL}/fapi/v1/premiumIndex`, {
			signal: AbortSignal.timeout(15000),
		})
		if (!res.ok) throw new Error(`Aster premiumIndex: ${res.status} ${res.statusText}`)
		const data = (await res.json()) as AsterPremiumIndex[]

		const now = Date.now()
		const snapshots: FundingRateSnapshot[] = []

		for (const item of data) {
			const rate = Number.parseFloat(item.lastFundingRate)
			if (Number.isNaN(rate)) continue

			// Only USDT-margined perpetuals
			if (!item.symbol.endsWith("USDT")) continue

			const base = item.symbol.slice(0, -4)
			const symbol = `${base}/USDT`
			const markPrice = Number.parseFloat(item.markPrice)
			const indexPrice = Number.parseFloat(item.indexPrice)

			snapshots.push({
				symbol,
				exchange: this.exchangeId,
				rate,
				apr: computeApr(rate, this.settlementHours),
				predictedRate: null, // Aster does not expose predicted rate in premiumIndex
				markPrice: Number.isNaN(markPrice) ? 0 : markPrice,
				indexPrice: Number.isNaN(indexPrice) ? 0 : indexPrice,
				settlementHours: this.settlementHours,
				nextSettlementTs: item.nextFundingTime ?? 0,
				receiveTs: now,
				quality: assessDataQuality(now),
			})
		}

		return snapshots
	}

	async startStreaming(onUpdate: (snapshots: FundingRateSnapshot[]) => void): Promise<void> {
		if (this.streaming) return
		this.streaming = true

		// Initial fetch
		try {
			const snapshots = await this.fetchAllFundingRates()
			if (this.streaming && snapshots.length > 0) {
				onUpdate(snapshots)
			}
		} catch {
			// Non-fatal — poll loop will retry
		}

		this.schedulePoll(onUpdate)
	}

	private schedulePoll(onUpdate: (snapshots: FundingRateSnapshot[]) => void, attempt = 0): void {
		if (!this.streaming) return
		const delay =
			attempt === 0 ? this.pollIntervalMs : exponentialBackoff(attempt, this.pollIntervalMs)
		this.pollTimer = setTimeout(async () => {
			if (!this.streaming) return
			try {
				const snapshots = await this.fetchAllFundingRates()
				if (this.streaming && snapshots.length > 0) {
					onUpdate(snapshots)
				}
				this.schedulePoll(onUpdate, 0)
			} catch {
				console.warn(`[${this.exchangeId}] Reconnecting in ${delay}ms (attempt ${attempt + 1})`)
				this.schedulePoll(onUpdate, attempt + 1)
			}
		}, delay)
	}

	async stopStreaming(): Promise<void> {
		this.streaming = false
		if (this.pollTimer != null) {
			clearTimeout(this.pollTimer)
			this.pollTimer = null
		}
	}

	isStreaming(): boolean {
		return this.streaming
	}

	async fetchPerpSymbols(): Promise<string[]> {
		const res = await fetch(`${BASE_URL}/fapi/v1/exchangeInfo`, {
			signal: AbortSignal.timeout(15000),
		})
		if (!res.ok) throw new Error(`Aster exchangeInfo: ${res.status} ${res.statusText}`)
		const data = (await res.json()) as AsterExchangeInfo

		const symbols: string[] = []
		for (const sym of data.symbols) {
			if (
				sym.contractType === "PERPETUAL" &&
				sym.quoteAsset === "USDT" &&
				sym.status === "TRADING"
			) {
				const base = sym.symbol.replace("USDT", "")
				symbols.push(`${base}/USDT`)
			}
		}
		return symbols
	}
}
