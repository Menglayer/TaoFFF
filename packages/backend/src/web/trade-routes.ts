import type { HedgeTrade, OpenTradeRequest } from "@taofff/shared"
import { Exchange, OrderMode, OrderSequence, PositionSide } from "@taofff/shared"
import type { FastifyInstance } from "fastify"
import type { FundingEngine } from "../core/funding-engine"
import type { OrderExecutor } from "../core/order-executor"
import type { TradeHistoryRepository } from "../db/repositories"

function validateExchange(value: string): Exchange {
	const valid = Object.values(Exchange) as string[]
	if (!valid.includes(value)) throw new Error(`Invalid exchange: ${value}`)
	return value as Exchange
}

export async function registerTradeRoutes(
	app: FastifyInstance,
	orderExecutor: OrderExecutor,
	tradeRepo: TradeHistoryRepository,
	engine: FundingEngine,
) {
	// POST /api/trade/open
	app.post<{
		Body: {
			symbol: string
			longExchange: string
			shortExchange: string
			sizeUsdt: number
			leverage: number
			sequence?: string
		}
	}>("/api/trade/open", async (req, reply) => {
		const { symbol, longExchange, shortExchange, sizeUsdt, leverage, sequence } = req.body

		if (!symbol || !longExchange || !shortExchange || !sizeUsdt || !leverage) {
			return reply.status(400).send({ error: "Missing required fields" })
		}

		let exchangeA: Exchange
		let exchangeB: Exchange
		try {
			exchangeA = validateExchange(longExchange)
			exchangeB = validateExchange(shortExchange)
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Invalid exchange"
			return reply.status(400).send({ error: message })
		}

		const openReq: OpenTradeRequest = {
			symbol,
			exchangeA,
			exchangeB,
			sideA: PositionSide.Long,
			sideB: PositionSide.Short,
			sizeUsdt,
			leverage,
			sequence: (sequence as OrderSequence) || OrderSequence.Parallel,
			mode: OrderMode.Once,
		}

		try {
			const trade = await orderExecutor.openTrade(openReq)

			// Compute net APR at entry from current rates
			const rates = engine.getAllRates()
			const longRate = rates.find((r) => r.symbol === symbol && r.exchange === longExchange)
			const shortRate = rates.find((r) => r.symbol === symbol && r.exchange === shortExchange)
			if (longRate && shortRate) {
				trade.netAprAtEntry = shortRate.apr - longRate.apr // Simplified; real formula in spread-engine
			}

			await tradeRepo.insert(trade)
			return { success: true, trade }
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Trade execution failed"
			return reply.status(500).send({ error: message })
		}
	})

	// POST /api/trade/close
	app.post<{
		Body: { tradeId: string }
	}>("/api/trade/close", async (req, reply) => {
		const { tradeId } = req.body
		if (!tradeId) return reply.status(400).send({ error: "tradeId required" })

		const existing = await tradeRepo.getById(tradeId)
		if (!existing) return reply.status(404).send({ error: "Trade not found" })
		if (existing.status !== "open") return reply.status(400).send({ error: "Trade is not open" })

		// Reconstruct HedgeTrade from DB row
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

		try {
			const closed = await orderExecutor.closeTrade(hedgeTrade)
			await tradeRepo.update(closed)
			return { success: true, trade: closed }
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Close execution failed"
			return reply.status(500).send({ error: message })
		}
	})

	// GET /api/trade/positions — active open positions
	app.get("/api/trade/positions", async () => {
		return tradeRepo.getOpenPositions()
	})

	// GET /api/trade/history — all trades
	app.get<{
		Querystring: { limit?: string }
	}>("/api/trade/history", async (req) => {
		const limit = req.query.limit ? Number(req.query.limit) : 100
		return tradeRepo.getHistory(limit)
	})
}
