import cors from "@fastify/cors"
import websocket from "@fastify/websocket"
import type { FundingRateSnapshot } from "@taofff/shared"
import { DataQuality } from "@taofff/shared"
import { lt } from "drizzle-orm"
import Fastify from "fastify"
import { loadConfig } from "./config"
import { AlertEngine } from "./core/alert-engine"
import { FundingEngine } from "./core/funding-engine"
import { LoopEngine } from "./core/loop-engine"
import { OrderExecutor } from "./core/order-executor"
import { SpreadEngine } from "./core/spread-engine"
import { WsHub } from "./core/ws-hub"
import { createDb } from "./db/client"
import {
	AlertHistoryRepository,
	AlertRuleRepository,
	ApiKeyRepository,
	ArbitrageOpportunityRepository,
	FundingRateRepository,
	LoopConfigRepository,
	TradeHistoryRepository,
} from "./db/repositories"
import { alertHistory, fundingRates, tradeHistory } from "./db/schema"
import { createAllExchanges } from "./exchanges"
import { registerAlertRoutes } from "./web/alert-routes"
import { registerExportRoutes } from "./web/export-routes"
import { registerLoopRoutes } from "./web/loop-routes"
import { registerRoutes } from "./web/routes"
import { registerTradeRoutes } from "./web/trade-routes"
import { registerWsHandler } from "./web/ws-handler"

async function main() {
	const config = loadConfig()

	// Initialize database
	const { db, sqlite } = createDb(config.dbPath)

	// Create core services
	const engine = new FundingEngine()
	const spreadEngine = new SpreadEngine(engine, config)
	const wsHub = new WsHub(engine, config.wsBroadcastIntervalMs, config.wsFullSnapshotIntervalMs)
	const rateRepo = new FundingRateRepository(db)
	const oppRepo = new ArbitrageOpportunityRepository(db)
	const apiKeyRepo = new ApiKeyRepository(db)
	const tradeRepo = new TradeHistoryRepository(db)
	const alertRuleRepo = new AlertRuleRepository(db)
	const alertHistoryRepo = new AlertHistoryRepository(db)
	const loopRepo = new LoopConfigRepository(db)
	const orderExecutor = new OrderExecutor(apiKeyRepo, config)
	const alertEngine = new AlertEngine(alertRuleRepo, alertHistoryRepo, wsHub)
	const loopEngine = new LoopEngine(spreadEngine, orderExecutor, tradeRepo, engine, config)

	// Create Fastify instance
	const app = Fastify({
		logger: {
			level: "info",
		},
	})

	// Register plugins
	await app.register(cors, {
		origin: true,
		credentials: true,
	})

	await app.register(websocket, {
		options: {
			maxPayload: 1_048_576,
		},
	})

	// Decorate with shared resources
	app.decorate("db", db)
	app.decorate("config", config)

	// Register routes and WS handler
	await registerRoutes(app, engine, rateRepo, oppRepo, apiKeyRepo, config)
	await registerTradeRoutes(app, orderExecutor, tradeRepo, engine)
	await registerWsHandler(app, wsHub)
	await registerAlertRoutes(app, alertEngine, alertRuleRepo, alertHistoryRepo, rateRepo)
	await registerExportRoutes(app, rateRepo, tradeRepo, oppRepo)
	await registerLoopRoutes(app, loopEngine, loopRepo)

	// Load alert rules
	await alertEngine.loadRules()

	// Load loop configs
	const loops = await loopRepo.getAll()
	for (const loop of loops) {
		// Reset status to stopped on startup if it was running, or keep it?
		// The requirement says: "Load saved loop configs from DB on startup (loopRepo.getAll()) and add running ones to engine"
		// Wait, if it was running, should it continue running?
		// "add running ones to engine" -> actually, I should add all of them to the engine so they can be managed.
		// Let's add all of them to the engine.
		loopEngine.addLoop(loop)
	}

	// Set loop provider for WS
	wsHub.setLoopProvider(() => loopEngine.getLoops())

	// Start exchange adapters (configurable disable list for geo-blocked venues)
	const disabled = new Set(config.disabledExchanges)
	const allExchanges = createAllExchanges()
	const exchanges = allExchanges.filter((ex) => !disabled.has(ex.exchangeId))

	for (const ex of allExchanges) {
		if (disabled.has(ex.exchangeId)) {
			engine.updateExchangeStatus(ex.exchangeId, {
				connected: false,
				lastMessageTs: Date.now(),
				symbolCount: 0,
				quality: DataQuality.Offline,
				errorCount: 0,
				lastError: "Disabled by DISABLED_EXCHANGES",
			})
			app.log.warn({ exchange: ex.exchangeId }, "Exchange disabled by config")
		}
	}

	// Periodic DB persistence
	let persistTimer: ReturnType<typeof setInterval> | null = null
	let oppTimer: ReturnType<typeof setInterval> | null = null
	let cleanupTimer: ReturnType<typeof setInterval> | null = null
	let symbolRefreshTimer: ReturnType<typeof setInterval> | null = null

	// Graceful shutdown
	let shuttingDown = false
	const shutdown = async () => {
		if (shuttingDown) return
		shuttingDown = true
		app.log.info("Shutting down...")

		const timeout = setTimeout(() => {
			app.log.error("Shutdown timed out after 10s, forcing exit")
			process.exit(1)
		}, 10000)

		try {
			if (persistTimer) clearInterval(persistTimer)
			if (oppTimer) clearInterval(oppTimer)
			if (cleanupTimer) clearInterval(cleanupTimer)
			if (symbolRefreshTimer) clearInterval(symbolRefreshTimer)
			app.log.info("Cleared timers")
		} catch (err) {
			app.log.error({ err }, "Error clearing timers")
		}

		try {
			loopEngine.stop()
			app.log.info("Stopped loop engine")
		} catch (err) {
			app.log.error({ err }, "Error stopping loop engine")
		}

		try {
			wsHub.stop()
			app.log.info("Stopped WS hub")
		} catch (err) {
			app.log.error({ err }, "Error stopping WS hub")
		}

		try {
			await Promise.allSettled(exchanges.map((ex) => ex.stopStreaming()))
			app.log.info("Stopped exchange adapters")
		} catch (err) {
			app.log.error({ err }, "Error stopping exchange adapters")
		}

		try {
			await app.close()
			app.log.info("Closed Fastify app")
		} catch (err) {
			app.log.error({ err }, "Error closing Fastify app")
		}

		try {
			sqlite.close()
			app.log.info("Closed SQLite connection")
		} catch (err) {
			app.log.error({ err }, "Error closing SQLite connection")
		}

		clearTimeout(timeout)
		app.log.info("Shutdown complete")
		process.exit(0)
	}

	process.on("SIGINT", shutdown)
	process.on("SIGTERM", shutdown)
	process.on("SIGHUP", shutdown)

	// Start server
	await app.listen({ port: config.port, host: config.host })
	app.log.info(`TaoFFF backend running on http://${config.host}:${config.port}`)

	// Start exchange streaming
	for (const ex of exchanges) {
		engine.updateExchangeStatus(ex.exchangeId, {
			connected: false,
			lastMessageTs: 0,
			symbolCount: 0,
			quality: DataQuality.Offline,
			errorCount: 0,
			lastError: null,
		})
	}

	const startExchangesConcurrently = async () => {
		await Promise.allSettled(
			exchanges.map(async (ex) => {
				try {
					await ex.startStreaming((snapshots: FundingRateSnapshot[]) => {
						engine.updateRates(snapshots)
						engine.updateExchangeStatus(ex.exchangeId, {
							connected: true,
							lastMessageTs: Date.now(),
							symbolCount: ex.getSymbols().length || snapshots.length,
							quality: snapshots[0]?.quality ?? DataQuality.OK,
							lastError: null,
						})
					})
				} catch (err) {
					engine.updateExchangeStatus(ex.exchangeId, {
						connected: false,
						lastMessageTs: Date.now(),
						quality: DataQuality.Offline,
						errorCount: 1,
						lastError: err instanceof Error ? err.message : String(err),
					})
					app.log.error({ exchange: ex.exchangeId, err }, "Exchange streaming failed")
				}
			}),
		)
	}

	void startExchangesConcurrently()

	// Start WS broadcasting
	wsHub.start()

	// Detect and persist opportunities every 5 seconds
	oppTimer = setInterval(async () => {
		try {
			const opps = spreadEngine.detectOpportunities()
			engine.setOpportunities(opps)
			try {
				await oppRepo.insertBatch(opps)
			} catch (err) {
				app.log.error({ err }, "Opportunity persistence failed")
			}
			alertEngine.evaluate(engine.getAllRates(), opps)
			await loopEngine.tick()
		} catch (err) {
			app.log.error({ err }, "Opportunity detection/persistence failed")
		}
	}, 5_000)

	// Persist rates to DB every 60 seconds
	persistTimer = setInterval(async () => {
		try {
			const rates = engine.getAllRates()
			await rateRepo.insertBatch(rates)
		} catch (err) {
			app.log.error({ err }, "Rate persistence failed")
		}
	}, 60_000)

	// DB Cleanup Loop
	const runCleanup = async () => {
		try {
			const now = Date.now()
			const ratesCutoff = now - config.retentionDaysRates * 24 * 60 * 60 * 1000
			const tradesCutoff = now - config.retentionDaysTrades * 24 * 60 * 60 * 1000
			const metricsCutoff = now - config.retentionDaysMetrics * 24 * 60 * 60 * 1000

			await db.delete(fundingRates).where(lt(fundingRates.receiveTs, ratesCutoff))
			await db.delete(tradeHistory).where(lt(tradeHistory.openedAt, tradesCutoff))
			await db.delete(alertHistory).where(lt(alertHistory.triggeredAt, metricsCutoff))

			app.log.info("DB cleanup completed successfully")
		} catch (err) {
			app.log.error({ err }, "DB cleanup failed")
		}
	}

	setTimeout(() => {
		runCleanup()
		cleanupTimer = setInterval(runCleanup, 24 * 60 * 60 * 1000)
	}, 60_000)

	// Dynamic Symbol Discovery
	const runSymbolRefresh = async () => {
		app.log.info("Starting dynamic symbol discovery...")
		for (const ex of exchanges) {
			if (ex.exchangeId === "hyperliquid") continue // Hyperliquid fetches all symbols each poll
			try {
				const newSymbols = await ex.fetchPerpSymbols()
				const currentSymbols = ex.getSymbols()

				if (
					newSymbols.length !== currentSymbols.length ||
					!newSymbols.every((s) => currentSymbols.includes(s))
				) {
					ex.updateSymbols(newSymbols)
					app.log.info({ exchange: ex.exchangeId, count: newSymbols.length }, "Updated symbols")
				}
			} catch (err) {
				engine.updateExchangeStatus(ex.exchangeId, {
					connected: false,
					lastMessageTs: Date.now(),
					quality: DataQuality.Offline,
					lastError: err instanceof Error ? err.message : String(err),
				})
				app.log.error({ exchange: ex.exchangeId, err }, "Symbol refresh failed for exchange")
			}
		}
	}

	symbolRefreshTimer = setInterval(runSymbolRefresh, 6 * 60 * 60 * 1000)
}

main().catch((err: unknown) => {
	console.error("Failed to start server:", err)
	process.exit(1)
})
