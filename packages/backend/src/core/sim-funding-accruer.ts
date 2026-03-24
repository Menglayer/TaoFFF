import type { Exchange, HedgeTrade, PositionSide } from "@taofff/shared"
import type { TradeHistoryRepository } from "../db/repositories"
import type { FundingEngine } from "./funding-engine"
import type { SimBalanceManager } from "./sim-balance-manager"

/** Track last settlement timestamp per trade-leg to avoid double-counting */
interface SettlementTracker {
	lastSettledTsA: number
	lastSettledTsB: number
}

export class SimFundingAccruer {
	private timer: ReturnType<typeof setInterval> | null = null
	private settlements = new Map<string, SettlementTracker>()

	constructor(
		private tradeRepo: TradeHistoryRepository,
		private engine: FundingEngine,
		private balanceManager: SimBalanceManager,
	) {}

	/** Start the accruer on a 60-second interval */
	start(): void {
		this.timer = setInterval(() => {
			void this.tick()
		}, 60_000)
	}

	/** Stop the accruer */
	stop(): void {
		if (this.timer) {
			clearInterval(this.timer)
			this.timer = null
		}
	}

	/** Single tick — check all open sim positions for settlement */
	async tick(): Promise<void> {
		const openPositions = await this.tradeRepo.getSimOpenPositions()
		const now = Date.now()

		for (const pos of openPositions) {
			const rates = this.engine.getSymbolRates(pos.symbol)
			const rateA = rates.find((r) => r.exchange === pos.legAExchange)
			const rateB = rates.find((r) => r.exchange === pos.legBExchange)

			if (!rateA || !rateB) continue

			let tracker = this.settlements.get(pos.id)
			if (!tracker) {
				tracker = {
					lastSettledTsA: pos.openedAt,
					lastSettledTsB: pos.openedAt,
				}
				this.settlements.set(pos.id, tracker)
			}

			let fundingDelta = 0

			// Check leg A settlement
			if (rateA.nextSettlementTs <= now && rateA.nextSettlementTs > tracker.lastSettledTsA) {
				const notionalA = pos.legASize * pos.legAEntryPrice
				// Long position pays funding when rate > 0, receives when rate < 0
				const fundingA = pos.legASide === "long" ? -rateA.rate * notionalA : rateA.rate * notionalA
				fundingDelta += fundingA
				tracker.lastSettledTsA = rateA.nextSettlementTs
			}

			// Check leg B settlement
			if (rateB.nextSettlementTs <= now && rateB.nextSettlementTs > tracker.lastSettledTsB) {
				const notionalB = pos.legBSize * pos.legBEntryPrice
				const fundingB = pos.legBSide === "long" ? -rateB.rate * notionalB : rateB.rate * notionalB
				fundingDelta += fundingB
				tracker.lastSettledTsB = rateB.nextSettlementTs
			}

			if (fundingDelta !== 0) {
				// Update trade's funding earned in DB
				const updatedFunding = pos.fundingEarned + fundingDelta
				const hedgeTrade: HedgeTrade = {
					id: pos.id,
					symbol: pos.symbol,
					legA: {
						exchange: pos.legAExchange as Exchange,
						symbol: pos.symbol,
						side: pos.legASide as PositionSide,
						size: pos.legASize,
						entryPrice: pos.legAEntryPrice,
						exitPrice: pos.legAExitPrice,
						leverage: pos.legALeverage,
						fees: pos.legAFees,
						orderId: pos.legAOrderId,
					},
					legB: {
						exchange: pos.legBExchange as Exchange,
						symbol: pos.symbol,
						side: pos.legBSide as PositionSide,
						size: pos.legBSize,
						entryPrice: pos.legBEntryPrice,
						exitPrice: pos.legBExitPrice,
						leverage: pos.legBLeverage,
						fees: pos.legBFees,
						orderId: pos.legBOrderId,
					},
					netAprAtEntry: pos.netAprAtEntry,
					realizedPnl: pos.realizedPnl,
					fundingEarned: updatedFunding,
					status: pos.status as HedgeTrade["status"],
					openedAt: pos.openedAt,
					closedAt: pos.closedAt,
					simulated: true,
				}

				await this.tradeRepo.update(hedgeTrade)

				// Update balance
				await this.balanceManager.applyFunding(fundingDelta)
			}
		}

		// Clean up settlements for closed trades
		const openIds = new Set(openPositions.map((p) => p.id))
		for (const id of this.settlements.keys()) {
			if (!openIds.has(id)) {
				this.settlements.delete(id)
			}
		}
	}
}
