import {
	computeRequiredMargin,
	computeSimFees,
	computeSimFillPrice,
	computeUnrealizedPnl,
	type Exchange,
	type FundingRateSnapshot,
	type HedgeTrade,
	PositionSide,
	type SimPositionSnapshot,
	type TradeLeg,
} from "@taofff/shared"
import type { AppConfig } from "../config"
import type { TradeHistoryRepository } from "../db/repositories"
import type { FundingEngine } from "./funding-engine"
import type { SimBalanceManager } from "./sim-balance-manager"

/**
 * Resolve the best available price from a funding rate snapshot.
 * Some exchanges (e.g. Lighter) may report markPrice=0 while providing a valid indexPrice.
 * This mirrors the fallback logic used in spread-engine.ts.
 */
function resolvePrice(rate: FundingRateSnapshot): number {
	return rate.markPrice > 0 ? rate.markPrice : rate.indexPrice
}

export class SimOrderExecutor {
	constructor(
		private engine: FundingEngine,
		private tradeRepo: TradeHistoryRepository,
		private balanceManager: SimBalanceManager,
		private config: AppConfig,
	) {}

	/** Open a simulated hedge trade */
	async openTrade(params: {
		symbol: string
		longExchange: Exchange
		shortExchange: Exchange
		sizeUsdt: number
		leverage: number
	}): Promise<HedgeTrade> {
		const { symbol, longExchange, shortExchange, sizeUsdt, leverage } = params

		// Get current mark prices from funding engine
		const rates = this.engine.getSymbolRates(symbol)
		const longRate = rates.find((r) => r.exchange === longExchange)
		const shortRate = rates.find((r) => r.exchange === shortExchange)

		if (!longRate) throw new Error(`No rate data for ${symbol} on ${longExchange}`)
		if (!shortRate) throw new Error(`No rate data for ${symbol} on ${shortExchange}`)

		// Check margin — both legs need margin
		const requiredMargin = computeRequiredMargin(sizeUsdt * 2, leverage)
		const balance = await this.balanceManager.getBalance()
		if (!balance) {
			throw new Error("Sim balance not initialized. Call POST /api/sim/balance/reset first.")
		}
		if (balance.currentBalance < requiredMargin) {
			throw new Error(
				`Insufficient balance. Required: ${requiredMargin.toFixed(2)}, Available: ${balance.currentBalance.toFixed(2)}`,
			)
		}

		// Resolve best available prices (markPrice → indexPrice fallback)
		const basePriceA = resolvePrice(longRate)
		const basePriceB = resolvePrice(shortRate)

		if (basePriceA <= 0 || basePriceB <= 0) {
			throw new Error(
				`Invalid price data for ${symbol}: ${longExchange}=${basePriceA}, ${shortExchange}=${basePriceB}. Cannot open trade.`,
			)
		}

		// Apply slippage to fill prices
		const fillPriceA = computeSimFillPrice(basePriceA, this.config.slippagePct, "long")
		const fillPriceB = computeSimFillPrice(basePriceB, this.config.slippagePct, "short")

		// Compute sizes in base currency
		const sizeA = sizeUsdt / fillPriceA
		const sizeB = sizeUsdt / fillPriceB

		// Compute fees
		const feesA = computeSimFees(sizeUsdt, this.config.tradingFeePct)
		const feesB = computeSimFees(sizeUsdt, this.config.tradingFeePct)

		// Reserve margin
		const reserved = await this.balanceManager.reserveMargin(requiredMargin)
		if (!reserved) throw new Error("Failed to reserve margin")

		// Deduct opening fees from balance
		await this.balanceManager.releaseMargin(0, -(feesA + feesB), feesA + feesB)

		const now = Date.now()
		const tradeId = `sim-${now}-${Math.random().toString(36).substring(2, 8)}`

		// Compute net APR at entry
		const netAprAtEntry = shortRate.apr - longRate.apr

		const legA: TradeLeg = {
			exchange: longExchange,
			symbol,
			side: PositionSide.Long,
			size: sizeA,
			entryPrice: fillPriceA,
			exitPrice: null,
			leverage,
			fees: feesA,
			orderId: `sim-ord-${now}-a-${Math.random().toString(36).substring(2, 6)}`,
		}

		const legB: TradeLeg = {
			exchange: shortExchange,
			symbol,
			side: PositionSide.Short,
			size: sizeB,
			entryPrice: fillPriceB,
			exitPrice: null,
			leverage,
			fees: feesB,
			orderId: `sim-ord-${now}-b-${Math.random().toString(36).substring(2, 6)}`,
		}

		const trade: HedgeTrade = {
			id: tradeId,
			symbol,
			legA,
			legB,
			netAprAtEntry,
			realizedPnl: null,
			fundingEarned: 0,
			status: "open",
			openedAt: now,
			closedAt: null,
			simulated: true,
		}

		await this.tradeRepo.insert(trade)
		return trade
	}

	/** Close a simulated hedge trade */
	async closeTrade(tradeId: string): Promise<HedgeTrade> {
		const existing = await this.tradeRepo.getById(tradeId)
		if (!existing) throw new Error("Trade not found")
		if (existing.status !== "open") throw new Error("Trade is not open")
		if (!existing.simulated) throw new Error("Trade is not a simulated trade")

		const symbol = existing.symbol
		const rates = this.engine.getSymbolRates(symbol)
		const rateA = rates.find((r) => r.exchange === existing.legAExchange)
		const rateB = rates.find((r) => r.exchange === existing.legBExchange)

		if (!rateA) throw new Error(`No rate data for ${symbol} on ${existing.legAExchange}`)
		if (!rateB) throw new Error(`No rate data for ${symbol} on ${existing.legBExchange}`)

		// Close price with slippage (opposite side), using resolved prices
		const closeSideA: "long" | "short" = existing.legASide === PositionSide.Long ? "short" : "long"
		const closeSideB: "long" | "short" = existing.legBSide === PositionSide.Long ? "short" : "long"
		const basePriceA = resolvePrice(rateA)
		const basePriceB = resolvePrice(rateB)

		if (basePriceA <= 0 || basePriceB <= 0) {
			throw new Error(
				`Invalid price data for ${symbol}: ${existing.legAExchange}=${basePriceA}, ${existing.legBExchange}=${basePriceB}. Cannot close trade.`,
			)
		}

		const closePriceA = computeSimFillPrice(basePriceA, this.config.slippagePct, closeSideA)
		const closePriceB = computeSimFillPrice(basePriceB, this.config.slippagePct, closeSideB)

		// Close fees
		const closeNotionalA = existing.legASize * closePriceA
		const closeNotionalB = existing.legBSize * closePriceB
		const closeFeesA = computeSimFees(closeNotionalA, this.config.tradingFeePct)
		const closeFeesB = computeSimFees(closeNotionalB, this.config.tradingFeePct)

		// P&L per leg
		const pnlA = computeUnrealizedPnl(
			existing.legAEntryPrice,
			closePriceA,
			existing.legASize,
			existing.legASide as "long" | "short",
		)
		const pnlB = computeUnrealizedPnl(
			existing.legBEntryPrice,
			closePriceB,
			existing.legBSize,
			existing.legBSide as "long" | "short",
		)

		const totalCloseFees = closeFeesA + closeFeesB
		const realizedPnl = pnlA + pnlB - totalCloseFees

		const now = Date.now()
		const marginUsed = computeRequiredMargin(
			existing.legASize * existing.legAEntryPrice + existing.legBSize * existing.legBEntryPrice,
			existing.legALeverage,
		)

		// Release margin and apply P&L
		await this.balanceManager.releaseMargin(marginUsed, realizedPnl, totalCloseFees)

		const closed: HedgeTrade = {
			id: existing.id,
			symbol: existing.symbol,
			legA: {
				exchange: existing.legAExchange as Exchange,
				symbol: existing.symbol,
				side: existing.legASide as PositionSide,
				size: existing.legASize,
				entryPrice: existing.legAEntryPrice,
				exitPrice: closePriceA,
				leverage: existing.legALeverage,
				fees: existing.legAFees + closeFeesA,
				orderId: existing.legAOrderId,
			},
			legB: {
				exchange: existing.legBExchange as Exchange,
				symbol: existing.symbol,
				side: existing.legBSide as PositionSide,
				size: existing.legBSize,
				entryPrice: existing.legBEntryPrice,
				exitPrice: closePriceB,
				leverage: existing.legBLeverage,
				fees: existing.legBFees + closeFeesB,
				orderId: existing.legBOrderId,
			},
			netAprAtEntry: existing.netAprAtEntry,
			realizedPnl: realizedPnl + existing.fundingEarned,
			fundingEarned: existing.fundingEarned,
			status: "closed",
			openedAt: existing.openedAt,
			closedAt: now,
			simulated: true,
		}

		await this.tradeRepo.update(closed)
		return closed
	}

	/** Compute live position snapshots with unrealized P&L */
	async getPositionSnapshots(): Promise<SimPositionSnapshot[]> {
		const openPositions = await this.tradeRepo.getSimOpenPositions()
		const snapshots: SimPositionSnapshot[] = []

		for (const pos of openPositions) {
			const rates = this.engine.getSymbolRates(pos.symbol)
			const rateA = rates.find((r) => r.exchange === pos.legAExchange)
			const rateB = rates.find((r) => r.exchange === pos.legBExchange)

			const markPriceA = rateA ? resolvePrice(rateA) : pos.legAEntryPrice
			const markPriceB = rateB ? resolvePrice(rateB) : pos.legBEntryPrice

			const unrealizedPnlA = computeUnrealizedPnl(
				pos.legAEntryPrice,
				markPriceA,
				pos.legASize,
				pos.legASide as "long" | "short",
			)
			const unrealizedPnlB = computeUnrealizedPnl(
				pos.legBEntryPrice,
				markPriceB,
				pos.legBSize,
				pos.legBSide as "long" | "short",
			)

			const marginUsed = computeRequiredMargin(
				pos.legASize * pos.legAEntryPrice + pos.legBSize * pos.legBEntryPrice,
				pos.legALeverage,
			)

			const trade: HedgeTrade = {
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
				fundingEarned: pos.fundingEarned,
				status: pos.status as HedgeTrade["status"],
				openedAt: pos.openedAt,
				closedAt: pos.closedAt,
				simulated: true,
			}

			snapshots.push({
				trade,
				unrealizedPnlA,
				unrealizedPnlB,
				unrealizedPnlTotal: unrealizedPnlA + unrealizedPnlB,
				currentMarkPriceA: markPriceA,
				currentMarkPriceB: markPriceB,
				marginUsed,
				fundingAccrued: pos.fundingEarned,
			})
		}

		return snapshots
	}
}
