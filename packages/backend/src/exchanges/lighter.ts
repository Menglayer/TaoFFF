import type { FundingRateSnapshot } from "@taofff/shared"
import { assessDataQuality, computeApr, DEFAULTS, Exchange, SETTLEMENT_HOURS } from "@taofff/shared"
import { BaseExchange, exponentialBackoff } from "./base"

const BASE_URL = "https://mainnet.zklighter.elliot.ai"

/**
 * Lighter (zkLighter) exchange adapter using REST polling.
 *
 * Lighter is a zkSync-based perpetual DEX. Markets are identified by integer
 * market_index (0 = ETH-USD, etc.). We use REST polling because the WS
 * market_stats stream can be complex to manage for all markets.
 *
 * Key details:
 *  - 1-hour funding settlement
 *  - GET /api/v1/orderBooks → market metadata (symbol, market_index)
 *  - GET /api/v1/funding-rates → current funding rates per market
 *  - Symbols like "ETH-USD" normalized to "ETH/USD" then mapped to USDT equivalent
 *  - No auth required for public data
 */

/** Market info from orderBooks endpoint */
interface LighterMarket {
	market_id: number
	symbol: string
	status: string
	mark_price?: string
	index_price?: string
}

/** orderBooks response */
interface LighterOrderBooksResponse {
	order_books: LighterMarket[]
}

/** Funding rate entry */
interface LighterFundingRate {
	market_id: number
	symbol?: string
	rate: number | string
	exchange?: string
}

/** Funding rates response */
interface LighterFundingResponse {
	funding_rates: LighterFundingRate[]
}

export class LighterExchange extends BaseExchange {
	readonly exchangeId = Exchange.Lighter
	readonly settlementHours = SETTLEMENT_HOURS[Exchange.Lighter]

	private streaming = false
	private pollTimer: ReturnType<typeof setTimeout> | null = null
	private readonly pollIntervalMs: number
	/** market_id → normalized symbol */
	private marketMap = new Map<number, { symbol: string; markPrice: number; indexPrice: number }>()

	constructor(pollIntervalMs?: number) {
		super()
		this.pollIntervalMs = pollIntervalMs ?? DEFAULTS.LIGHTER_POLL_INTERVAL_MS
	}

	/**
	 * Normalize Lighter symbol format.
	 * Lighter uses base symbols (e.g. BTC, ETH); TaoLi is U-based, so normalize to BTC/USDT.
	 * since the platform is USDT-denominated for consistency.
	 */
	private normalizeSymbol(raw: string): string {
		if (raw.includes("/")) return raw
		if (raw.includes("-")) {
			const [base, quote] = raw.split("-")
			if (base && quote) {
				return `${base}/${quote === "USD" ? "USDT" : quote}`
			}
		}
		return `${raw}/USDT`
	}

	/** Load market metadata */
	private async loadMarkets(): Promise<void> {
		const res = await fetch(`${BASE_URL}/api/v1/orderBooks`, { signal: AbortSignal.timeout(15000) })
		if (!res.ok) throw new Error(`Lighter orderBooks: ${res.status} ${res.statusText}`)
		const data = (await res.json()) as LighterOrderBooksResponse

		this.marketMap.clear()
		for (const m of data.order_books) {
			if (m.status !== "active") continue
			this.marketMap.set(m.market_id, {
				symbol: this.normalizeSymbol(m.symbol),
				markPrice: Number.parseFloat(m.mark_price ?? "0") || 0,
				indexPrice: Number.parseFloat(m.index_price ?? "0") || 0,
			})
		}
	}

	async fetchAllFundingRates(): Promise<FundingRateSnapshot[]> {
		// Ensure markets are loaded
		if (this.marketMap.size === 0) {
			await this.loadMarkets()
		}

		const res = await fetch(`${BASE_URL}/api/v1/funding-rates`, {
			signal: AbortSignal.timeout(15000),
		})
		if (!res.ok) throw new Error(`Lighter funding-rates: ${res.status} ${res.statusText}`)
		const data = (await res.json()) as LighterFundingResponse

		const now = Date.now()
		const snapshots: FundingRateSnapshot[] = []

		for (const item of data.funding_rates) {
			if (item.exchange && item.exchange !== "lighter") continue
			const market = this.marketMap.get(item.market_id)
			if (!market) continue

			const rate =
				typeof item.rate === "number" ? item.rate : Number.parseFloat(item.rate as string)
			if (Number.isNaN(rate)) continue

			// Lighter funding endpoint does not always include prices/timestamps; derive next settlement.
			const markPrice = market.markPrice
			const indexPrice = market.indexPrice
			const nextSettlement = now + this.settlementHours * 60 * 60 * 1000

			snapshots.push({
				symbol: market.symbol,
				exchange: this.exchangeId,
				rate,
				apr: computeApr(rate, this.settlementHours),
				predictedRate: null,
				markPrice: Number.isNaN(markPrice) ? 0 : markPrice,
				indexPrice: Number.isNaN(indexPrice) ? 0 : indexPrice,
				settlementHours: this.settlementHours,
				nextSettlementTs: nextSettlement,
				receiveTs: now,
				quality: assessDataQuality(now),
			})
		}

		return snapshots
	}

	async startStreaming(onUpdate: (snapshots: FundingRateSnapshot[]) => void): Promise<void> {
		if (this.streaming) return
		this.streaming = true

		// Pre-load market map
		try {
			await this.loadMarkets()
		} catch {
			// Will retry on first poll
		}

		// Initial fetch
		try {
			const snapshots = await this.fetchAllFundingRates()
			if (this.streaming && snapshots.length > 0) {
				onUpdate(snapshots)
			}
		} catch {
			// Non-fatal
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
		await this.loadMarkets()
		return Array.from(this.marketMap.values()).map((m) => m.symbol)
	}
}
