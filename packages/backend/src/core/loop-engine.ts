import type { HedgeTrade, LoopConfig, OpenTradeRequest } from "@taofff/shared"
import {
	assignSides,
	computeNetApr,
	type Exchange,
	LoopStatus,
	OrderMode,
	PositionSide,
} from "@taofff/shared"
import type { AppConfig } from "../config"
import type { TradeHistoryRepository } from "../db/repositories"
import type { FundingEngine } from "./funding-engine"
import type { OrderExecutor } from "./order-executor"
import type { SpreadEngine } from "./spread-engine"

export class LoopEngine {
	private loops = new Map<string, LoopConfig>()

	constructor(
		_spreadEngine: SpreadEngine,
		private orderExecutor: OrderExecutor,
		private tradeRepo: TradeHistoryRepository,
		private fundingEngine: FundingEngine,
		private config: AppConfig,
	) {}

	addLoop(config: LoopConfig): void {
		this.loops.set(config.id, config)
	}

	removeLoop(id: string): void {
		this.loops.delete(id)
	}

	pauseLoop(id: string): void {
		const loop = this.loops.get(id)
		if (loop) {
			loop.status = LoopStatus.Paused
		}
	}

	stopLoop(id: string): void {
		const loop = this.loops.get(id)
		if (loop) {
			loop.status = LoopStatus.Stopped
		}
	}

	resumeLoop(id: string): void {
		const loop = this.loops.get(id)
		if (loop) {
			loop.status = LoopStatus.Running
		}
	}

	getLoops(): LoopConfig[] {
		return Array.from(this.loops.values())
	}

	getLoop(id: string): LoopConfig | undefined {
		return this.loops.get(id)
	}

	stop(): void {
		for (const loop of this.loops.values()) {
			if (loop.status === LoopStatus.Running) {
				loop.status = LoopStatus.Paused
			}
		}
	}

	async tick(): Promise<void> {
		for (const loop of this.loops.values()) {
			if (loop.status !== LoopStatus.Running) continue

			try {
				const rates = this.fundingEngine.getSymbolRates(loop.symbol)
				const rateA = rates.find((r) => r.exchange === loop.exchangeA)
				const rateB = rates.find((r) => r.exchange === loop.exchangeB)

				if (!rateA || !rateB) {
					loop.currentSpread = null
					continue
				}

				const [longIdx, shortIdx] = assignSides(rateA.apr, rateB.apr)
				const longRate = longIdx === 0 ? rateA : rateB
				const shortRate = shortIdx === 0 ? rateA : rateB

				const netApr = computeNetApr({
					shortApr: shortRate.apr,
					longApr: longRate.apr,
					leverage: loop.leverage,
					borrowRateDaily: this.config.borrowRateDaily,
					feePct: this.config.tradingFeePct,
					slippagePct: this.config.slippagePct,
					rebalanceTimesPerYear: this.config.rebalanceTimesPerYear,
				})

				loop.currentSpread = netApr

				if (!loop.activeTradeId && netApr >= loop.entryThresholdApr) {
					// Open trade
					const sideA = longIdx === 0 ? PositionSide.Long : PositionSide.Short
					const sideB = shortIdx === 0 ? PositionSide.Long : PositionSide.Short

					const req: OpenTradeRequest = {
						symbol: loop.symbol,
						exchangeA: loop.exchangeA,
						exchangeB: loop.exchangeB,
						sideA,
						sideB,
						sizeUsdt: loop.sizeUsdt,
						leverage: loop.leverage,
						sequence: loop.sequence,
						mode: OrderMode.Loop,
					}

					const trade = await this.orderExecutor.openTrade(req)
					trade.netAprAtEntry = netApr
					await this.tradeRepo.insert(trade)

					loop.activeTradeId = trade.id
				} else if (loop.activeTradeId && netApr < loop.exitThresholdApr) {
					// Close trade
					const existing = await this.tradeRepo.getById(loop.activeTradeId)
					if (existing && existing.status === "open") {
						const hedgeTrade: HedgeTrade = {
							id: existing.id,
							symbol: existing.symbol,
							legA: {
								exchange: existing.legAExchange as Exchange,
								symbol: existing.symbol,
								side: existing.legASide as PositionSide,
								size: existing.legASize,
								entryPrice: existing.legAEntryPrice,
								exitPrice: existing.legAExitPrice,
								leverage: existing.legALeverage,
								fees: existing.legAFees,
								orderId: existing.legAOrderId,
							},
							legB: {
								exchange: existing.legBExchange as Exchange,
								symbol: existing.symbol,
								side: existing.legBSide as PositionSide,
								size: existing.legBSize,
								entryPrice: existing.legBEntryPrice,
								exitPrice: existing.legBExitPrice,
								leverage: existing.legBLeverage,
								fees: existing.legBFees,
								orderId: existing.legBOrderId,
							},
							netAprAtEntry: existing.netAprAtEntry,
							realizedPnl: existing.realizedPnl,
							fundingEarned: existing.fundingEarned,
							status: existing.status as HedgeTrade["status"],
							openedAt: existing.openedAt,
							closedAt: existing.closedAt,
						}
						const closedTrade = await this.orderExecutor.closeTrade(hedgeTrade)
						await this.tradeRepo.update(closedTrade)
					}
					loop.activeTradeId = null
				}
			} catch (err) {
				console.error(`Error in loop ${loop.id}:`, err)
			}
		}
	}
}
