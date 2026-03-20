import type { FundingRateSnapshot } from "@taofff/shared"
import { assessDataQuality, computeApr, DEFAULTS, Exchange, SETTLEMENT_HOURS } from "@taofff/shared"
import { BaseExchange, exponentialBackoff } from "./base"

const BASE_URL = "https://market-data.grvt.io"

/**
 * GRVT (Gravity Markets) exchange adapter using REST polling.
 *
 * GRVT uses POST-based market data endpoints. Instruments are identified
 * by names like "BTC_USDT_Perp". Timestamps are in nanoseconds.
 *
 * Key details:
 *  - 8-hour funding settlement (per-instrument, may vary)
 *  - POST /full/v1/all_instruments → instrument list
 *  - POST /full/v1/funding → funding rate per instrument
 *  - All POST bodies are JSON; no auth for public market data
 *  - Timestamps in nanoseconds (divide by 1e6 for ms)
 */

/** Instrument from all_instruments response */
interface GRVTInstrument {
	instrument: string
	instrument_hash: string
	base: string
	quote: string
	kind: string
	venues: string[]
	settlement_period: string
	base_decimals: number
	quote_decimals: number
	tick_size: string
	min_size: string
	is_active: boolean
}

/** all_instruments response */
interface GRVTAllInstrumentsResponse {
	result: GRVTInstrument[]
}

/** Funding rate result */
interface GRVTFundingRateEntry {
	instrument: string
	funding_rate: string
	funding_time: string
	funding_interval_hours?: string
	mark_price: string
	index_price?: string
}

/** Funding rate response */
interface GRVTFundingRateResponse {
	result: GRVTFundingRateEntry | GRVTFundingRateEntry[]
}

export class GRVTExchange extends BaseExchange {
	readonly exchangeId = Exchange.GRVT
	readonly settlementHours = SETTLEMENT_HOURS[Exchange.GRVT]

	private streaming = false
	private pollTimer: ReturnType<typeof setTimeout> | null = null
	private readonly pollIntervalMs: number
	/** Cached list of active perpetual instrument names */
	private instruments: string[] = []

	constructor(pollIntervalMs?: number) {
		super()
		this.pollIntervalMs = pollIntervalMs ?? DEFAULTS.GRVT_POLL_INTERVAL_MS
	}

	/**
	 * Normalize GRVT instrument name to unified symbol.
	 * "BTC_USDT_Perp" → "BTC/USDT"
	 */
	private normalizeInstrument(instrument: string): string {
		// Format: BASE_QUOTE_Perp
		const parts = instrument.split("_")
		if (parts.length >= 2) {
			return `${parts[0]}/${parts[1]}`
		}
		return instrument
	}

	/** Convert nanosecond timestamp to milliseconds */
	private nsToMs(ns: string | number): number {
		const val = typeof ns === "string" ? Number.parseInt(ns, 10) : ns
		if (Number.isNaN(val) || val === 0) return 0
		// GRVT timestamps are in nanoseconds
		return Math.floor(val / 1_000_000)
	}

	/** Load active perpetual instruments */
	private async loadInstruments(): Promise<void> {
		const res = await fetch(`${BASE_URL}/full/v1/all_instruments`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ kind: ["PERPETUAL"], is_active: true }),
			signal: AbortSignal.timeout(15000),
		})
		if (!res.ok) throw new Error(`GRVT all_instruments: ${res.status} ${res.statusText}`)
		const data = (await res.json()) as GRVTAllInstrumentsResponse

		this.instruments = []
		for (const inst of data.result ?? []) {
			if (inst.is_active === false) continue
			if (inst.kind !== "PERPETUAL") continue
			this.instruments.push(inst.instrument)
		}
	}

	async fetchAllFundingRates(): Promise<FundingRateSnapshot[]> {
		// Ensure instruments are loaded
		if (this.instruments.length === 0) {
			await this.loadInstruments()
		}

		const now = Date.now()
		const snapshots: FundingRateSnapshot[] = []

		// GRVT requires fetching funding data per instrument
		// We batch requests with Promise.allSettled to handle individual failures
		const results = await Promise.allSettled(
			this.instruments.map(async (instrument) => {
				const res = await fetch(`${BASE_URL}/full/v1/funding`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ instrument }),
					signal: AbortSignal.timeout(15000),
				})
				if (!res.ok) return null
				const data = (await res.json()) as GRVTFundingRateResponse
				return data.result
			}),
		)

		for (const result of results) {
			if (result.status !== "fulfilled" || result.value == null) continue

			const entries = Array.isArray(result.value) ? result.value : [result.value]
			// Keep only the most recent entry per instrument (API returns descending history)
			const latestEntry = entries[0]
			if (!latestEntry) continue
			for (const entry of [latestEntry]) {
				if (!entry.instrument) continue

				const rate = Number.parseFloat(entry.funding_rate)
				if (Number.isNaN(rate)) continue

				const symbol = this.normalizeInstrument(entry.instrument)
				// Only USDT-margined
				if (!symbol.endsWith("/USDT")) continue

				const markPrice = Number.parseFloat(entry.mark_price)
				const indexPrice = entry.index_price ? Number.parseFloat(entry.index_price) : 0
				const fundingTimeMs = this.nsToMs(entry.funding_time)
				const intervalHours = entry.funding_interval_hours
					? Number.parseInt(entry.funding_interval_hours, 10)
					: this.settlementHours
				const nextSettlement =
					fundingTimeMs > 0 && intervalHours > 0
						? fundingTimeMs + intervalHours * 60 * 60 * 1000
						: 0

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
		}

		return snapshots
	}

	async startStreaming(onUpdate: (snapshots: FundingRateSnapshot[]) => void): Promise<void> {
		if (this.streaming) return
		this.streaming = true

		// Pre-load instruments
		try {
			await this.loadInstruments()
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
		await this.loadInstruments()
		return this.instruments.map((i) => this.normalizeInstrument(i))
	}
}
