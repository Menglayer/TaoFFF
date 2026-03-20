import type { ArbitrageOpportunity, FundingRateSnapshot, SpreadSnapshot } from "@taofff/shared"
import {
	assignSides,
	computeBorrowCostApr,
	computeEntryExitCostPct,
	computeGrossApr,
	computeLeveragedApr,
	computeNetApr,
	computeSpread,
	computeTradingCostApr,
	DataQuality,
} from "@taofff/shared"
import type { AppConfig } from "../config"
import type { FundingEngine } from "./funding-engine"

/** Quality levels considered usable for opportunity detection */
const USABLE_QUALITIES = new Set<DataQuality>([DataQuality.Fresh, DataQuality.OK])

export class SpreadEngine {
	constructor(
		private engine: FundingEngine,
		private config: AppConfig,
	) {}

	/**
	 * Compute pairwise spreads between all exchange pairs for a given symbol.
	 * Only uses rates with Fresh or OK quality.
	 */
	computeSpreads(symbol: string): SpreadSnapshot[] {
		const rates = this.engine.getSymbolRates(symbol).filter((r) => USABLE_QUALITIES.has(r.quality))

		if (rates.length < 2) return []

		const spreads: SpreadSnapshot[] = []

		for (let i = 0; i < rates.length; i++) {
			for (let j = i + 1; j < rates.length; j++) {
				const a = rates[i] as FundingRateSnapshot
				const b = rates[j] as FundingRateSnapshot

				const [longIdx, shortIdx] = assignSides(a.apr, b.apr)
				const longRate = longIdx === 0 ? a : b
				const shortRate = shortIdx === 0 ? a : b

				const grossApr = computeGrossApr(shortRate.apr, longRate.apr)
				const spreadPct = computeSpread(a.markPrice, b.markPrice)

				spreads.push({
					symbol,
					exchangeA: a.exchange,
					exchangeB: b.exchange,
					rateA: a.rate,
					rateB: b.rate,
					aprA: a.apr,
					aprB: b.apr,
					grossApr,
					spreadPct,
					timestamp: Math.max(a.receiveTs, b.receiveTs),
				})
			}
		}

		return spreads
	}

	/**
	 * Detect arbitrage opportunities across all symbols.
	 * Filters by minNetAprPct, sorted by netApr descending.
	 */
	detectOpportunities(): ArbitrageOpportunity[] {
		const symbols = this.engine.getSymbols()
		const opportunities: ArbitrageOpportunity[] = []
		const now = Date.now()

		for (const symbol of symbols) {
			const rates = this.engine
				.getSymbolRates(symbol)
				.filter((r) => USABLE_QUALITIES.has(r.quality))

			if (rates.length < 2) continue

			// Check all pairwise combinations
			for (let i = 0; i < rates.length; i++) {
				for (let j = i + 1; j < rates.length; j++) {
					const a = rates[i] as FundingRateSnapshot
					const b = rates[j] as FundingRateSnapshot

					const [longIdx, shortIdx] = assignSides(a.apr, b.apr)
					const longRate = longIdx === 0 ? a : b
					const shortRate = shortIdx === 0 ? a : b

					const grossApr = computeGrossApr(shortRate.apr, longRate.apr)
					const leveragedApr = computeLeveragedApr(grossApr, this.config.defaultLeverage)
					const borrowCostApr = computeBorrowCostApr(
						this.config.borrowRateDaily,
						this.config.defaultLeverage,
					)
					const entryExitCostPct = computeEntryExitCostPct(
						this.config.tradingFeePct,
						this.config.slippagePct,
					)
					const tradingCostApr = computeTradingCostApr(
						entryExitCostPct,
						this.config.rebalanceTimesPerYear,
						this.config.defaultLeverage,
					)

					const netApr = computeNetApr({
						shortApr: shortRate.apr,
						longApr: longRate.apr,
						leverage: this.config.defaultLeverage,
						borrowRateDaily: this.config.borrowRateDaily,
						feePct: this.config.tradingFeePct,
						slippagePct: this.config.slippagePct,
						rebalanceTimesPerYear: this.config.rebalanceTimesPerYear,
					})

					if (netApr < this.config.minNetAprPct) continue

					const spreadPct = computeSpread(longRate.markPrice, shortRate.markPrice)

					// Determine the worst quality between the two rates
					const quality =
						a.quality === DataQuality.Fresh && b.quality === DataQuality.Fresh
							? DataQuality.Fresh
							: DataQuality.OK

					const id = `${symbol}-${longRate.exchange}-${shortRate.exchange}`

					opportunities.push({
						id,
						symbol,
						longExchange: longRate.exchange,
						shortExchange: shortRate.exchange,
						longRate: longRate.rate,
						shortRate: shortRate.rate,
						grossApr,
						leveragedApr,
						borrowCostApr,
						tradingCostApr,
						netApr,
						leverage: this.config.defaultLeverage,
						spreadPct,
						detectedAt: now,
						quality,
					})
				}
			}
		}

		// Sort by netApr descending
		opportunities.sort((a, b) => b.netApr - a.netApr)

		return opportunities
	}
}
