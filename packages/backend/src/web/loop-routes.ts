import type { Exchange, LoopConfig } from "@taofff/shared"
import { LoopStatus, OrderSequence } from "@taofff/shared"
import type { FastifyInstance } from "fastify"
import type { LoopEngine } from "../core/loop-engine"
import type { LoopConfigRepository } from "../db/repositories"

interface CreateLoopBody {
	symbol: string
	exchangeA: Exchange
	exchangeB: Exchange
	entryThresholdApr: number
	exitThresholdApr: number
	sizeUsdt: number
	leverage: number
	sequence?: OrderSequence
}

export async function registerLoopRoutes(
	app: FastifyInstance,
	loopEngine: LoopEngine,
	loopRepo: LoopConfigRepository,
) {
	app.post<{ Body: CreateLoopBody }>("/api/loop/create", async (req) => {
		const body = req.body
		const now = Date.now()
		const id = `loop-${now}-${Math.random().toString(36).substring(2, 8)}`

		const config: LoopConfig = {
			id,
			symbol: body.symbol,
			exchangeA: body.exchangeA,
			exchangeB: body.exchangeB,
			entryThresholdApr: body.entryThresholdApr,
			exitThresholdApr: body.exitThresholdApr,
			sizeUsdt: body.sizeUsdt,
			leverage: body.leverage,
			sequence: body.sequence ?? OrderSequence.Parallel,
			status: LoopStatus.Stopped,
			currentSpread: null,
			activeTradeId: null,
			createdAt: now,
			updatedAt: now,
		}

		await loopRepo.insert(config)
		loopEngine.addLoop(config)

		return config
	})

	app.post<{ Params: { id: string } }>("/api/loop/:id/start", async (req, reply) => {
		const { id } = req.params
		const loop = loopEngine.getLoop(id)
		if (!loop) {
			return reply.status(404).send({ error: "Loop not found" })
		}

		loopEngine.resumeLoop(id)
		loop.updatedAt = Date.now()
		await loopRepo.update(loop)

		return loop
	})

	app.post<{ Params: { id: string } }>("/api/loop/:id/stop", async (req, reply) => {
		const { id } = req.params
		const loop = loopEngine.getLoop(id)
		if (!loop) {
			return reply.status(404).send({ error: "Loop not found" })
		}

		loopEngine.stopLoop(id)
		loop.updatedAt = Date.now()
		await loopRepo.update(loop)

		return loop
	})

	app.post<{ Params: { id: string } }>("/api/loop/:id/pause", async (req, reply) => {
		const { id } = req.params
		const loop = loopEngine.getLoop(id)
		if (!loop) {
			return reply.status(404).send({ error: "Loop not found" })
		}

		loopEngine.pauseLoop(id)
		loop.updatedAt = Date.now()
		await loopRepo.update(loop)

		return loop
	})

	app.get("/api/loop/status", async () => {
		return loopEngine.getLoops()
	})

	app.get<{ Params: { id: string } }>("/api/loop/:id", async (req, reply) => {
		const { id } = req.params
		const loop = loopEngine.getLoop(id)
		if (!loop) {
			return reply.status(404).send({ error: "Loop not found" })
		}
		return loop
	})

	app.delete<{ Params: { id: string } }>("/api/loop/:id", async (req, reply) => {
		const { id } = req.params
		const loop = loopEngine.getLoop(id)
		if (!loop) {
			return reply.status(404).send({ error: "Loop not found" })
		}

		loopEngine.removeLoop(id)
		await loopRepo.deleteById(id)

		return { success: true }
	})
}
