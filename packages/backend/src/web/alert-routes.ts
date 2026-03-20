import { randomUUID } from "node:crypto"
import type { AlertRule, Exchange } from "@taofff/shared"
import type { FastifyInstance } from "fastify"
import type { AlertEngine } from "../core/alert-engine"
import type {
	AlertHistoryRepository,
	AlertRuleRepository,
	FundingRateRepository,
} from "../db/repositories"

export async function registerAlertRoutes(
	app: FastifyInstance,
	alertEngine: AlertEngine,
	alertRuleRepo: AlertRuleRepository,
	alertHistoryRepo: AlertHistoryRepository,
	rateRepo: FundingRateRepository,
) {
	app.post<{ Body: Partial<AlertRule> }>("/api/alerts/rules", async (request, reply) => {
		const body = request.body
		if (!body.name || !body.metric || !body.operator || body.threshold === undefined) {
			return reply.status(400).send({ error: "Missing required fields" })
		}

		const now = Date.now()
		const rule: AlertRule = {
			id: randomUUID(),
			name: body.name,
			metric: body.metric,
			operator: body.operator,
			threshold: body.threshold,
			symbol: body.symbol ?? null,
			exchange: (body.exchange as Exchange) ?? null,
			cooldownSeconds: body.cooldownSeconds ?? 300,
			enabled: body.enabled ?? true,
			createdAt: now,
			updatedAt: now,
		}

		await alertRuleRepo.insert(rule)
		alertEngine.addRule(rule)

		return rule
	})

	app.get("/api/alerts/rules", async () => {
		return await alertRuleRepo.getAll()
	})

	app.get<{ Params: { id: string } }>("/api/alerts/rules/:id", async (request, reply) => {
		const rule = await alertRuleRepo.getById(request.params.id)
		if (!rule) {
			return reply.status(404).send({ error: "Rule not found" })
		}
		return rule
	})

	app.put<{ Params: { id: string }; Body: Partial<AlertRule> }>(
		"/api/alerts/rules/:id",
		async (request, reply) => {
			const id = request.params.id
			const existing = await alertRuleRepo.getById(id)
			if (!existing) {
				return reply.status(404).send({ error: "Rule not found" })
			}

			const body = request.body
			const updated: AlertRule = {
				...existing,
				...body,
				id, // ensure ID doesn't change
				updatedAt: Date.now(),
			}

			await alertRuleRepo.update(updated)
			alertEngine.updateRule(updated)

			return updated
		},
	)

	app.delete<{ Params: { id: string } }>("/api/alerts/rules/:id", async (request, reply) => {
		const id = request.params.id
		const deleted = await alertRuleRepo.deleteById(id)
		if (!deleted) {
			return reply.status(404).send({ error: "Rule not found" })
		}

		alertEngine.removeRule(id)
		return { success: true }
	})

	app.get<{ Querystring: { ruleId?: string; limit?: number } }>(
		"/api/alerts/history",
		async (request) => {
			const { ruleId, limit } = request.query
			const parsedLimit = limit ? Number(limit) : 100

			if (ruleId) {
				return await alertHistoryRepo.getByRuleId(ruleId, parsedLimit)
			}
			return await alertHistoryRepo.getRecent(parsedLimit)
		},
	)

	app.get<{
		Params: { symbol: string }
		Querystring: { exchange?: string; from?: number; to?: number; limit?: number }
	}>("/api/rates/:symbol/chart", async (request) => {
		const { symbol } = request.params
		const { exchange, from, to, limit } = request.query

		const history = await rateRepo.getHistory({
			symbol,
			exchange,
			fromTs: from ? Number(from) : undefined,
			toTs: to ? Number(to) : undefined,
			limit: limit ? Number(limit) : 500,
		})

		return history.map((h) => ({
			ts: h.receiveTs,
			rate: h.rate,
			apr: h.apr,
			exchange: h.exchange,
		}))
	})
}
