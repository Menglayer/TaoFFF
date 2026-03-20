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

export class MEXCExchange extends BaseExchange {
	readonly exchangeId = Exchange.MEXC
	readonly settlementHours = SETTLEMENT_HOURS[Exchange.MEXC]

	private readonly exchange: InstanceType<typeof ccxt.pro.mexc>
	private streaming = false
	private abortController: AbortController | null = null
	private orderbookStreams = new Map<string, boolean>()
	private symbols: string[] = []

	constructor() {
		super()
		this.exchange = new ccxt.pro.mexc({ enableRateLimit: true, timeout: 15000 })
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
				} catch {
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
