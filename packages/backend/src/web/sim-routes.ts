import {
	SimBalanceResetSchema,
	SimCloseTradeRequestSchema,
	SimOpenTradeRequestSchema,
} from "@taofff/shared"
import type { FastifyInstance } from "fastify"
import type { SimBalanceManager } from "../core/sim-balance-manager"
import type { SimOrderExecutor } from "../core/sim-order-executor"
import { mapRowToHedgeTrade, type TradeHistoryRepository } from "../db/repositories"

export async function registerSimRoutes(
	app: FastifyInstance,
	simExecutor: SimOrderExecutor,
	tradeRepo: TradeHistoryRepository,
	balanceManager: SimBalanceManager,
): Promise<void> {
	// POST /api/sim/open — open a simulated hedge trade
	app.post<{
		Body: {
			symbol: string
			longExchange: string
			shortExchange: string
			sizeUsdt: number
			leverage: number
		}
	}>("/api/sim/open", async (req, reply) => {
		const parsed = SimOpenTradeRequestSchema.safeParse(req.body)
		if (!parsed.success) {
			return reply.status(400).send({ error: parsed.error.message })
		}

		try {
			const trade = await simExecutor.openTrade({
				symbol: parsed.data.symbol,
				longExchange: parsed.data.longExchange,
				shortExchange: parsed.data.shortExchange,
				sizeUsdt: parsed.data.sizeUsdt,
				leverage: parsed.data.leverage,
			})
			return { success: true, trade }
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Sim trade execution failed"
			return reply.status(500).send({ error: message })
		}
	})

	// POST /api/sim/close — close a simulated trade
	app.post<{ Body: { tradeId: string } }>("/api/sim/close", async (req, reply) => {
		const parsed = SimCloseTradeRequestSchema.safeParse(req.body)
		if (!parsed.success) {
			return reply.status(400).send({ error: parsed.error.message })
		}

		try {
			const trade = await simExecutor.closeTrade(parsed.data.tradeId)
			return { success: true, trade }
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Sim close failed"
			return reply.status(500).send({ error: message })
		}
	})

	// GET /api/sim/positions — live position snapshots with unrealized P&L
	app.get("/api/sim/positions", async () => {
		return simExecutor.getPositionSnapshots()
	})

	// GET /api/sim/history — simulated trade history
	app.get<{ Querystring: { limit?: string } }>("/api/sim/history", async (req) => {
		const limit = req.query.limit ? Number(req.query.limit) : 100
		const rows = await tradeRepo.getSimHistory(limit)
		return rows.map(mapRowToHedgeTrade)
	})

	// GET /api/sim/balance — current balance state
	app.get("/api/sim/balance", async (_req, reply) => {
		const balance = await balanceManager.getBalance()
		if (!balance) {
			return reply.status(404).send({ error: "Balance not initialized" })
		}
		return balance
	})

	// POST /api/sim/balance/reset — reset balance and clear all sim trades
	app.post<{ Body: { initialBalance?: number } }>("/api/sim/balance/reset", async (req) => {
		const parsed = SimBalanceResetSchema.safeParse(req.body ?? {})
		const amount = parsed.success ? parsed.data.initialBalance : 100000

		// Clear all sim trades (open + closed) before resetting balance
		await tradeRepo.deleteAllSimTrades()

		const balance = await balanceManager.reset(amount)
		return { success: true, balance }
	})
}
