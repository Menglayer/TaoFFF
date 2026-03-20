import type { FundingRateSnapshot } from "@taofff/shared"
import {
	assessDataQuality,
	computeApr,
	Exchange,
	normalizeSymbol,
	SETTLEMENT_HOURS,
} from "@taofff/shared"
import ccxt from "ccxt"
import { BaseExchange, type BBO, exponentialBackoff } from "./base"

/**
 * Bybit exchange adapter using CCXT Pro.
 *
 * REST: fetchFundingRates → FundingRateSnapshot[]
 * WS:   watchFundingRate per symbol, batched via streaming loop
 */
export class BybitExchange extends BaseExchange {
	readonly exchangeId = Exchange.Bybit
	readonly settlementHours = SETTLEMENT_HOURS[Exchange.Bybit]

	private readonly exchange: InstanceType<typeof ccxt.pro.bybit>
	private streaming = false
	private abortController: AbortController | null = null
	private orderbookStreams = new Map<string, boolean>()
	private symbols: string[] = []
	private readonly apiHostOverride?: string
	private apiHostResolved = false

	constructor() {
		super()
		this.apiHostOverride = process.env.BYBIT_API_HOST?.trim()
		this.exchange = new ccxt.pro.bybit({ enableRateLimit: true, timeout: 15000 })
	}

	private async ensureApiHost(): Promise<void> {
		if (this.apiHostResolved) return

		const envHosts = (process.env.BYBIT_API_HOSTS ?? "")
			.split(",")
			.map((h) => h.trim())
			.filter((h) => h.length > 0)

		const candidates = Array.from(
			new Set([
				...(this.apiHostOverride ? [this.apiHostOverride] : []),
				...envHosts,
				"https://api.bybit.com",
				"https://api.bytick.com",
			]),
		)

		for (const host of candidates) {
			try {
				const res = await fetch(`${host}/v5/market/time`, { signal: AbortSignal.timeout(5000) })
				if (!res.ok) continue
				this.exchange.urls.api = {
					public: host,
					private: host,
				}
				this.apiHostResolved = true
				return
			} catch {
				// try next host
			}
		}

		this.apiHostResolved = true
	}

	async fetchAllFundingRates(): Promise<FundingRateSnapshot[]> {
		const rates = await this.exchange.fetchFundingRates()
		const now = Date.now()
		const snapshots: FundingRateSnapshot[] = []

		for (const fr of Object.values(rates)) {
			if (fr.fundingRate == null) continue
			const symbol = normalizeSymbol(fr.symbol)
			const rate = fr.fundingRate
			snapshots.push({
				symbol,
				exchange: this.exchangeId,
				rate,
				apr: computeApr(rate, this.settlementHours),
				predictedRate: fr.nextFundingRate ?? null,
				markPrice: fr.markPrice ?? 0,
				indexPrice: fr.indexPrice ?? 0,
				settlementHours: this.settlementHours,
				nextSettlementTs: fr.nextFundingTimestamp ?? 0,
				receiveTs: now,
				quality: assessDataQuality(now),
			})
		}

		return snapshots
	}

	async startStreaming(onUpdate: (snapshots: FundingRateSnapshot[]) => void): Promise<void> {
		if (this.streaming) return
		this.streaming = true
		this.abortController = new AbortController()
		await this.ensureApiHost()

		try {
			const snapshots = await this.fetchAllFundingRates()
			if (this.streaming && snapshots.length > 0) {
				onUpdate(snapshots)
			}
		} catch {
			// non-fatal: continue with streaming startup
		}

		try {
			this.symbols = await this.fetchPerpSymbols()
		} catch {
			this.symbols = []
		}

		// Fire-and-forget the streaming loop — don't await it
		void this.streamLoop(onUpdate)
	}

	private async streamLoop(onUpdate: (snapshots: FundingRateSnapshot[]) => void): Promise<void> {
		let attempt = 0
		while (this.streaming) {
			if (this.symbols.length === 0) {
				await new Promise((resolve) => setTimeout(resolve, 1000))
				continue
			}

			for (const symbol of this.symbols) {
				if (!this.streaming) break
				try {
					const fr = await this.exchange.watchFundingRate(symbol)
					if (fr.fundingRate == null) continue
					const now = Date.now()
					const normalized = normalizeSymbol(fr.symbol)
					const rate = fr.fundingRate
					const snapshot: FundingRateSnapshot = {
						symbol: normalized,
						exchange: this.exchangeId,
						rate,
						apr: computeApr(rate, this.settlementHours),
						predictedRate: fr.nextFundingRate ?? null,
						markPrice: fr.markPrice ?? 0,
						indexPrice: fr.indexPrice ?? 0,
						settlementHours: this.settlementHours,
						nextSettlementTs: fr.nextFundingTimestamp ?? 0,
						receiveTs: now,
						quality: assessDataQuality(now),
					}
					onUpdate([snapshot])
					attempt = 0
				} catch {
					if (!this.streaming) break
					const delay = exponentialBackoff(attempt)
					attempt++
					console.warn(`[${this.exchangeId}] Reconnecting in ${delay}ms (attempt ${attempt})`)
					await new Promise((resolve) => setTimeout(resolve, delay))
				}
			}
		}
	}

	override updateSymbols(symbols: string[]): void {
		this.symbols = symbols
	}

	override getSymbols(): string[] {
		return this.symbols
	}

	async stopStreaming(): Promise<void> {
		this.streaming = false
		this.abortController?.abort()
		this.abortController = null
		await this.exchange.close()
	}

	isStreaming(): boolean {
		return this.streaming
	}

	async fetchPerpSymbols(): Promise<string[]> {
		await this.exchange.loadMarkets()
		const symbols: string[] = []
		for (const market of Object.values(this.exchange.markets)) {
			if (
				market.type === "swap" &&
				market.linear === true &&
				market.settle === "USDT" &&
				market.active === true
			) {
				symbols.push(market.symbol)
			}
		}
		return symbols
	}

	async watchOrderBook(symbol: string, onUpdate: (bbo: BBO) => void): Promise<void> {
		if (this.orderbookStreams.get(symbol)) return
		this.orderbookStreams.set(symbol, true)

		// Fire-and-forget the streaming loop
		void (async () => {
			while (this.orderbookStreams.get(symbol)) {
				try {
					const ob = await this.exchange.watchOrderBook(symbol, 5)
					if (!this.orderbookStreams.get(symbol)) break

					const bestBid = ob.bids && ob.bids.length > 0 && ob.bids[0] ? Number(ob.bids[0][0]) : 0
					const bestBidSize =
						ob.bids && ob.bids.length > 0 && ob.bids[0] ? Number(ob.bids[0][1]) : 0
					const bestAsk = ob.asks && ob.asks.length > 0 && ob.asks[0] ? Number(ob.asks[0][0]) : 0
					const bestAskSize =
						ob.asks && ob.asks.length > 0 && ob.asks[0] ? Number(ob.asks[0][1]) : 0

					if (bestBid > 0 && bestAsk > 0) {
						onUpdate({
							symbol: normalizeSymbol(symbol),
							exchange: this.exchangeId,
							bestBid,
							bestAsk,
							bestBidSize,
							bestAskSize,
							timestamp: Date.now(),
						})
					}
				} catch (_e) {
					// Connection errors are expected during reconnects
					if (!this.orderbookStreams.get(symbol)) break
					await new Promise((resolve) => setTimeout(resolve, 1000))
				}
			}
		})()
	}

	async stopOrderBook(symbol: string): Promise<void> {
		this.orderbookStreams.set(symbol, false)
	}
}
