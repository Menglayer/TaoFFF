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
 * OKX exchange adapter using CCXT Pro.
 *
 * REST: fetchFundingRates → FundingRateSnapshot[]
 * WS:   watchFundingRate per symbol, batched via streaming loop
 */
export class OKXExchange extends BaseExchange {
	readonly exchangeId = Exchange.OKX
	readonly settlementHours = SETTLEMENT_HOURS[Exchange.OKX]

	private readonly exchange: InstanceType<typeof ccxt.pro.okx>
	private streaming = false
	private abortController: AbortController | null = null
	private orderbookStreams = new Map<string, boolean>()
	private symbols: string[] = []

	constructor() {
		super()
		this.exchange = new ccxt.pro.okx({ enableRateLimit: true, timeout: 15000 })
	}

	async fetchAllFundingRates(): Promise<FundingRateSnapshot[]> {
		if (this.symbols.length === 0) {
			this.symbols = await this.fetchPerpSymbols()
		}

		// Fetch funding rates and ticker prices in parallel, since OKX funding API lacks prices
		const [rates, tickers] = await Promise.all([
			this.exchange.fetchFundingRates(),
			this.exchange.fetchTickers(this.symbols),
		])

		const now = Date.now()
		const snapshots: FundingRateSnapshot[] = []

		for (const fr of Object.values(rates)) {
			if (fr.fundingRate == null) continue
			const tc = tickers[fr.symbol]
			const fallbackPrice = tc?.last ?? tc?.close ?? 0
			const symbol = normalizeSymbol(fr.symbol)
			const rate = fr.fundingRate
			snapshots.push({
				symbol,
				exchange: this.exchangeId,
				rate,
				apr: computeApr(rate, this.settlementHours),
				predictedRate: fr.nextFundingRate ?? null,
				markPrice: fr.markPrice ?? fallbackPrice,
				indexPrice: fr.indexPrice ?? fallbackPrice,
				settlementHours: this.settlementHours,
				nextSettlementTs: fr.nextFundingTimestamp ?? 0,
				receiveTs: now,
				quality: assessDataQuality(now),
			})
		}

		return snapshots
	}

	private pollTimer: ReturnType<typeof setTimeout> | null = null

	async startStreaming(onUpdate: (snapshots: FundingRateSnapshot[]) => void): Promise<void> {
		if (this.streaming) return
		this.streaming = true

		try {
			const snapshots = await this.fetchAllFundingRates()
			if (this.streaming && snapshots.length > 0) {
				onUpdate(snapshots)
			}
		} catch {
			// non-fatal: continue with streaming startup
		}

		this.schedulePoll(onUpdate)
	}

	private schedulePoll(onUpdate: (snapshots: FundingRateSnapshot[]) => void, attempt = 0): void {
		if (!this.streaming) return
		const delay = attempt === 0 ? 30_000 : exponentialBackoff(attempt, 30_000)
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
		if (this.pollTimer != null) {
			clearTimeout(this.pollTimer)
			this.pollTimer = null
		}
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
