import { HttpTransport, InfoClient } from "@nktkas/hyperliquid"
import type { FundingRateSnapshot } from "@taofff/shared"
import { assessDataQuality, computeApr, DEFAULTS, Exchange, SETTLEMENT_HOURS } from "@taofff/shared"
import { BaseExchange, exponentialBackoff } from "./base"

/**
 * Hyperliquid exchange adapter using @nktkas/hyperliquid SDK.
 *
 * Unlike CEX adapters (Binance/OKX/Bybit) which use CCXT Pro WebSocket streaming,
 * Hyperliquid uses REST polling because its Info API does not provide a dedicated
 * funding-rate-only WebSocket stream.
 *
 * Key differences:
 *  - 1-hour funding settlement (vs 8h for CEX)
 *  - REST polling at configurable interval (default 30s)
 *  - Assets identified by name (e.g. "BTC"), not CCXT symbol pairs
 *  - All numeric values returned as strings from the API
 */
export class HyperliquidExchange extends BaseExchange {
	readonly exchangeId = Exchange.Hyperliquid
	readonly settlementHours = SETTLEMENT_HOURS[Exchange.Hyperliquid]

	private readonly info: InfoClient
	private streaming = false
	private pollTimer: ReturnType<typeof setTimeout> | null = null
	private readonly pollIntervalMs: number

	constructor(pollIntervalMs?: number) {
		super()
		const transport = new HttpTransport()
		this.info = new InfoClient({ transport })
		this.pollIntervalMs = pollIntervalMs ?? DEFAULTS.HYPERLIQUID_POLL_INTERVAL_MS
	}

	async fetchAllFundingRates(): Promise<FundingRateSnapshot[]> {
		const [metaAndCtxs, predicted] = await Promise.all([
			this.info.metaAndAssetCtxs(),
			this.info.predictedFundings(),
		])

		const [meta, assetCtxs] = metaAndCtxs
		const now = Date.now()
		const snapshots: FundingRateSnapshot[] = []

		// Build a lookup for predicted funding rates: coin → { rate, nextTime }
		const predictedMap = new Map<string, { rate: number; nextTime: number }>()
		for (const [asset, exchanges] of predicted) {
			// Find the Hyperliquid venue entry (first entry is typically HL itself)
			for (const [, data] of exchanges) {
				if (data != null) {
					predictedMap.set(asset, {
						rate: Number.parseFloat(data.fundingRate),
						nextTime: data.nextFundingTime,
					})
					break
				}
			}
		}

		for (let i = 0; i < meta.universe.length; i++) {
			const asset = meta.universe[i]!
			const ctx = assetCtxs[i]
			if (!ctx || asset.isDelisted) continue

			const rate = Number.parseFloat(ctx.funding)
			if (Number.isNaN(rate)) continue

			const symbol = `${asset.name}/USDT`
			const markPrice = Number.parseFloat(ctx.markPx)
			const oraclePrice = Number.parseFloat(ctx.oraclePx)
			const pred = predictedMap.get(asset.name)

			snapshots.push({
				symbol,
				exchange: this.exchangeId,
				rate,
				apr: computeApr(rate, this.settlementHours),
				predictedRate: pred?.rate ?? null,
				markPrice: Number.isNaN(markPrice) ? 0 : markPrice,
				indexPrice: Number.isNaN(oraclePrice) ? 0 : oraclePrice,
				settlementHours: this.settlementHours,
				nextSettlementTs: pred?.nextTime ?? 0,
				receiveTs: now,
				quality: assessDataQuality(now),
			})
		}

		return snapshots
	}

	async startStreaming(onUpdate: (snapshots: FundingRateSnapshot[]) => void): Promise<void> {
		if (this.streaming) return
		this.streaming = true

		// Do an initial fetch immediately
		try {
			const snapshots = await this.fetchAllFundingRates()
			if (this.streaming && snapshots.length > 0) {
				onUpdate(snapshots)
			}
		} catch {
			// Non-fatal — the poll loop will retry
		}

		// Start polling loop
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
		const meta = await this.info.meta()
		const symbols: string[] = []
		for (const asset of meta.universe) {
			if (asset.isDelisted) continue
			symbols.push(`${asset.name}/USDT`)
		}
		return symbols
	}
}
