import type { FundingRateSnapshot } from "@taofff/shared"
import { assessDataQuality, computeApr, DEFAULTS, Exchange, SETTLEMENT_HOURS } from "@taofff/shared"
import { BaseExchange, exponentialBackoff } from "./base"

const BASE_URL = "https://api.starknet.extended.exchange"

interface ExtendedMarketStats {
	markPrice?: string
	indexPrice?: string
	fundingRate?: string
	nextFundingRate?: number
}

interface ExtendedMarket {
	name: string
	status: string
	marketStats: ExtendedMarketStats
}

interface ExtendedMarketsResponse {
	status: string
	data: ExtendedMarket[]
}

export class ExtendedExchange extends BaseExchange {
	readonly exchangeId = Exchange.Extended
	readonly settlementHours = SETTLEMENT_HOURS[Exchange.Extended]

	private streaming = false
	private pollTimer: ReturnType<typeof setTimeout> | null = null
	private readonly pollIntervalMs: number

	constructor(pollIntervalMs?: number) {
		super()
		this.pollIntervalMs = pollIntervalMs ?? DEFAULTS.EXTENDED_POLL_INTERVAL_MS
	}

	private normalizeMarket(name: string): string {
		return name.replace("-", "/")
	}

	async fetchAllFundingRates(): Promise<FundingRateSnapshot[]> {
		const res = await fetch(`${BASE_URL}/api/v1/info/markets`, {
			signal: AbortSignal.timeout(15000),
		})
		if (!res.ok) throw new Error(`Extended markets: ${res.status} ${res.statusText}`)
		const body = (await res.json()) as ExtendedMarketsResponse

		if (body.status.toLowerCase() !== "ok") {
			throw new Error("Extended markets response status not OK")
		}

		const now = Date.now()
		const snapshots: FundingRateSnapshot[] = []

		for (const market of body.data ?? []) {
			if (market.status !== "ACTIVE" && market.status !== "REDUCE_ONLY") continue

			const symbol = this.normalizeMarket(market.name)
			const stats = market.marketStats ?? {}
			const rate = Number.parseFloat(stats.fundingRate ?? "")
			if (Number.isNaN(rate)) continue

			const markPrice = Number.parseFloat(stats.markPrice ?? "0")
			const indexPrice = Number.parseFloat(stats.indexPrice ?? "0")
			const nextSettlementTs = stats.nextFundingRate ?? 0

			snapshots.push({
				symbol,
				exchange: this.exchangeId,
				rate,
				apr: computeApr(rate, this.settlementHours),
				predictedRate: null,
				markPrice: Number.isNaN(markPrice) ? 0 : markPrice,
				indexPrice: Number.isNaN(indexPrice) ? 0 : indexPrice,
				settlementHours: this.settlementHours,
				nextSettlementTs,
				receiveTs: now,
				quality: assessDataQuality(now),
			})
		}

		return snapshots
	}

	async startStreaming(onUpdate: (snapshots: FundingRateSnapshot[]) => void): Promise<void> {
		if (this.streaming) return
		this.streaming = true

		try {
			const snapshots = await this.fetchAllFundingRates()
			if (this.streaming && snapshots.length > 0) onUpdate(snapshots)
		} catch {
			// noop
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
				if (this.streaming && snapshots.length > 0) onUpdate(snapshots)
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
		const snapshots = await this.fetchAllFundingRates()
		return snapshots.map((s) => s.symbol)
	}
}
