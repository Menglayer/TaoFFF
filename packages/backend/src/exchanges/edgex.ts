import type { FundingRateSnapshot } from "@taofff/shared"
import { assessDataQuality, computeApr, DEFAULTS, Exchange, SETTLEMENT_HOURS } from "@taofff/shared"
import { BaseExchange, exponentialBackoff } from "./base"

const BASE_URL = "https://pro.edgex.exchange"

/**
 * edgeX exchange adapter using REST polling.
 *
 * edgeX is a StarkEx-based DEX. Contracts are identified by numeric contractId
 * (e.g. 10000001 = BTCUSDT). No WS funding rate stream exists, so we poll REST.
 *
 * Key details:
 *  - 4-hour funding settlement (240 min)
 *  - GET /api/v1/public/meta/getMetaData → contract list with contractId, contractName
 *  - GET /api/v1/public/funding/getLatestFundingRate → all or per-contract funding rates
 *  - No auth required for public data
 */

/** Metadata contract entry */
interface EdgeXContract {
	contractId: string
	contractName: string
	enableTrade?: boolean
	enableDisplay?: boolean
}

/** Metadata response */
interface EdgeXMetaData {
	data: {
		contractDataList?: EdgeXContract[]
		contractList?: EdgeXContract[]
	}
}

/** Single funding rate entry */
interface EdgeXFundingRate {
	contractId: string
	fundingRate: string
	fundingTimestamp: string
	nextFundingTime?: string
	oraclePrice?: string
	markPrice?: string
	indexPrice?: string
}

/** Funding rate response */
interface EdgeXFundingResponse {
	data: EdgeXFundingRate[] | EdgeXFundingRate
}

interface EdgeXFundingPageResponse {
	data: {
		dataList: EdgeXFundingRate[]
	}
}

export class EdgeXExchange extends BaseExchange {
	readonly exchangeId = Exchange.EdgeX
	readonly settlementHours = SETTLEMENT_HOURS[Exchange.EdgeX]

	private streaming = false
	private pollTimer: ReturnType<typeof setTimeout> | null = null
	private readonly pollIntervalMs: number
	/** contractId → symbol mapping (e.g. "10000001" → "BTC/USDT") */
	private contractMap = new Map<string, string>()

	constructor(pollIntervalMs?: number) {
		super()
		this.pollIntervalMs = pollIntervalMs ?? DEFAULTS.EDGEX_POLL_INTERVAL_MS
	}

	/** Build the contractId → symbol map from metadata */
	private async loadContractMap(): Promise<void> {
		const res = await fetch(`${BASE_URL}/api/v1/public/meta/getMetaData`, {
			signal: AbortSignal.timeout(15000),
		})
		if (!res.ok) throw new Error(`edgeX getMetaData: ${res.status} ${res.statusText}`)
		const data = (await res.json()) as EdgeXMetaData

		this.contractMap.clear()
		const contracts = data.data.contractDataList ?? data.data.contractList ?? []
		for (const c of contracts) {
			if (c.enableDisplay === false) continue
			if (c.enableTrade === false) continue
			// contractName is like "BTCUSD"/"BTCUSDT" — normalize to "BTC/USDT"
			const name = c.contractName
			const rawQuote = name.endsWith("USDT") ? "USDT" : "USD"
			const quote = rawQuote === "USD" ? "USDT" : rawQuote
			if (name.endsWith(quote)) {
				const base = name.slice(0, -quote.length)
				this.contractMap.set(c.contractId, `${base}/${quote}`)
			} else if (name.endsWith(rawQuote)) {
				const base = name.slice(0, -rawQuote.length)
				this.contractMap.set(c.contractId, `${base}/${quote}`)
			} else {
				this.contractMap.set(c.contractId, `${name}/${quote}`)
			}
		}
	}

	async fetchAllFundingRates(): Promise<FundingRateSnapshot[]> {
		// Ensure contract map is loaded
		if (this.contractMap.size === 0) {
			await this.loadContractMap()
		}

		const res = await fetch(`${BASE_URL}/api/v1/public/funding/getLatestFundingRate`, {
			signal: AbortSignal.timeout(15000),
		})
		if (!res.ok) throw new Error(`edgeX funding: ${res.status} ${res.statusText}`)
		const body = (await res.json()) as EdgeXFundingResponse

		const now = Date.now()
		const snapshots: FundingRateSnapshot[] = []

		let items = Array.isArray(body.data) ? body.data : [body.data]

		// getLatestFundingRate may return [] without contractId; fallback to funding page per contract.
		if (items.length === 0) {
			const fallbackItems: EdgeXFundingRate[] = []
			for (const contractId of this.contractMap.keys()) {
				const pageRes = await fetch(
					`${BASE_URL}/api/v1/public/funding/getFundingRatePage?contractId=${contractId}&size=1&page=1`,
					{ signal: AbortSignal.timeout(15000) },
				)
				if (!pageRes.ok) continue
				const page = (await pageRes.json()) as EdgeXFundingPageResponse
				const first = page?.data?.dataList?.[0]
				if (first) fallbackItems.push(first)
			}
			items = fallbackItems
		}

		for (const item of items) {
			const rate = Number.parseFloat(item.fundingRate)
			if (Number.isNaN(rate)) continue

			const symbol = this.contractMap.get(item.contractId)
			if (!symbol) continue
			// Only USDT-margined
			if (!symbol.endsWith("/USDT")) continue

			const markPrice = Number.parseFloat(item.markPrice ?? "0")
			const indexPrice = Number.parseFloat(item.indexPrice ?? item.oraclePrice ?? "0")
			const nextSettlement = item.nextFundingTime ? Number.parseInt(item.nextFundingTime, 10) : 0

			snapshots.push({
				symbol,
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

		// Pre-load contract map
		try {
			await this.loadContractMap()
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
		await this.loadContractMap()
		return Array.from(this.contractMap.values()).filter((s) => s.endsWith("/USDT"))
	}
}
