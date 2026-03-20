import type { FastifyInstance } from "fastify"
import type {
	ArbitrageOpportunityRepository,
	FundingRateRepository,
	TradeHistoryRepository,
} from "../db/repositories"

export async function registerExportRoutes(
	app: FastifyInstance,
	rateRepo: FundingRateRepository,
	tradeRepo: TradeHistoryRepository,
	oppRepo: ArbitrageOpportunityRepository,
) {
	app.get<{
		Querystring: { symbol?: string; exchange?: string; from?: number; to?: number; limit?: number }
	}>("/api/export/rates", async (request, reply) => {
		const { symbol, exchange, from, to, limit } = request.query

		if (!symbol) {
			return reply.status(400).send({ error: "Symbol is required for rate export" })
		}

		const history = await rateRepo.getHistory({
			symbol,
			exchange,
			fromTs: from ? Number(from) : undefined,
			toTs: to ? Number(to) : undefined,
			limit: limit ? Number(limit) : 10000,
		})

		const headers = [
			"symbol",
			"exchange",
			"rate",
			"apr",
			"predicted_rate",
			"mark_price",
			"index_price",
			"settlement_hours",
			"next_settlement_ts",
			"receive_ts",
		]

		const rows = history.map((h) => [
			h.symbol,
			h.exchange,
			h.rate,
			h.apr,
			h.predictedRate ?? "",
			h.markPrice,
			h.indexPrice,
			h.settlementHours,
			h.nextSettlementTs,
			h.receiveTs,
		])

		const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")

		reply.header("Content-Type", "text/csv")
		reply.header("Content-Disposition", `attachment; filename="rates_${symbol}_${Date.now()}.csv"`)
		return csv
	})

	app.get<{ Querystring: { limit?: number } }>("/api/export/trades", async (request, reply) => {
		const { limit } = request.query
		const history = await tradeRepo.getHistory(limit ? Number(limit) : 10000)

		const headers = [
			"id",
			"symbol",
			"leg_a_exchange",
			"leg_a_side",
			"leg_a_size",
			"leg_a_entry_price",
			"leg_a_exit_price",
			"leg_a_leverage",
			"leg_a_fees",
			"leg_a_order_id",
			"leg_b_exchange",
			"leg_b_side",
			"leg_b_size",
			"leg_b_entry_price",
			"leg_b_exit_price",
			"leg_b_leverage",
			"leg_b_fees",
			"leg_b_order_id",
			"net_apr_at_entry",
			"realized_pnl",
			"funding_earned",
			"status",
			"opened_at",
			"closed_at",
		]

		const rows = history.map((h) => [
			h.id,
			h.symbol,
			h.legAExchange,
			h.legASide,
			h.legASize,
			h.legAEntryPrice,
			h.legAExitPrice ?? "",
			h.legALeverage,
			h.legAFees,
			h.legAOrderId,
			h.legBExchange,
			h.legBSide,
			h.legBSize,
			h.legBEntryPrice,
			h.legBExitPrice ?? "",
			h.legBLeverage,
			h.legBFees,
			h.legBOrderId,
			h.netAprAtEntry,
			h.realizedPnl ?? "",
			h.fundingEarned,
			h.status,
			h.openedAt,
			h.closedAt ?? "",
		])

		const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")

		reply.header("Content-Type", "text/csv")
		reply.header("Content-Disposition", `attachment; filename="trades_${Date.now()}.csv"`)
		return csv
	})

	app.get<{ Querystring: { symbol?: string; limit?: number } }>(
		"/api/export/opportunities",
		async (request, reply) => {
			const { symbol, limit } = request.query
			const parsedLimit = limit ? Number(limit) : 10000

			const history = symbol
				? await oppRepo.getBySymbol(symbol, parsedLimit)
				: await oppRepo.getRecent(parsedLimit)

			const headers = [
				"id",
				"symbol",
				"long_exchange",
				"short_exchange",
				"long_rate",
				"short_rate",
				"gross_apr",
				"leveraged_apr",
				"borrow_cost_apr",
				"trading_cost_apr",
				"net_apr",
				"leverage",
				"spread_pct",
				"detected_at",
			]

			const rows = history.map((h) => [
				h.id,
				h.symbol,
				h.longExchange,
				h.shortExchange,
				h.longRate,
				h.shortRate,
				h.grossApr,
				h.leveragedApr,
				h.borrowCostApr,
				h.tradingCostApr,
				h.netApr,
				h.leverage,
				h.spreadPct,
				h.detectedAt,
			])

			const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")

			reply.header("Content-Type", "text/csv")
			reply.header("Content-Disposition", `attachment; filename="opportunities_${Date.now()}.csv"`)
			return csv
		},
	)
}
