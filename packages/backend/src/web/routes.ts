import type { FastifyInstance } from "fastify"
import type { AppConfig } from "../config"
import type { FundingEngine } from "../core/funding-engine"
import type {
	ApiKeyRepository,
	ArbitrageOpportunityRepository,
	FundingRateRepository,
} from "../db/repositories"
import { encrypt } from "../security/crypto"

export async function registerRoutes(
	app: FastifyInstance,
	engine: FundingEngine,
	rateRepo: FundingRateRepository,
	oppRepo: ArbitrageOpportunityRepository,
	apiKeyRepo: ApiKeyRepository,
	config: AppConfig,
) {
	// Root info to avoid confusion when opening backend URL directly
	app.get("/", async () => {
		return {
			service: "TaoFFF Backend API",
			status: "ok",
			health: "/api/health",
			apiPrefix: "/api",
			timestamp: Date.now(),
		}
	})

	// Health check
	app.get("/api/health", async () => {
		return { status: "ok", timestamp: Date.now() }
	})

	// Get all current funding rates
	app.get("/api/rates", async () => {
		return engine.getAllRates()
	})

	// Get rate history for a symbol
	app.get<{
		Params: { symbol: string }
		Querystring: {
			exchange?: string
			from?: string
			to?: string
			limit?: string
		}
	}>("/api/rates/:symbol/history", async (req) => {
		const { symbol } = req.params
		const { exchange, from, to, limit } = req.query
		return rateRepo.getHistory({
			symbol: decodeURIComponent(symbol),
			exchange,
			fromTs: from ? Number(from) : undefined,
			toTs: to ? Number(to) : undefined,
			limit: limit ? Number(limit) : undefined,
		})
	})

	// Get exchange statuses
	app.get("/api/status", async () => {
		return engine.getExchangeStatuses()
	})

	// Get symbol list
	app.get("/api/symbols", async () => {
		return engine.getSymbols()
	})

	// Get current opportunities
	app.get("/api/opportunities", async () => {
		return engine.getOpportunities()
	})

	// Get historical opportunities
	app.get<{
		Querystring: {
			symbol?: string
			limit?: string
		}
	}>("/api/opportunities/history", async (req) => {
		const { symbol, limit } = req.query
		const limitNum = limit ? Number(limit) : 100
		if (symbol) {
			return oppRepo.getBySymbol(decodeURIComponent(symbol), limitNum)
		}
		return oppRepo.getRecent(limitNum)
	})

	// Get orderbook (placeholder for now)
	app.get<{
		Params: { symbol: string }
		Querystring: {
			exchangeA: string
			exchangeB: string
		}
	}>("/api/orderbook/:symbol", async (req) => {
		// Placeholder for orderbook integration
		return {
			symbol: req.params.symbol,
			exchangeA: req.query.exchangeA,
			exchangeB: req.query.exchangeB,
			bids: [],
			asks: [],
		}
	})

	// Save API key
	app.post<{
		Params: { exchange: string }
		Body: {
			apiKey: string
			secret: string
			passphrase?: string
			walletAddress?: string
			testnet?: boolean
		}
	}>("/api/keys/:exchange", async (req, reply) => {
		if (!config.masterKey) {
			return reply.status(500).send({ error: "Master key not configured" })
		}
		const { exchange } = req.params
		const { apiKey, secret, passphrase, walletAddress, testnet } = req.body

		await apiKeyRepo.upsert({
			exchange,
			encryptedKey: encrypt(apiKey, config.masterKey),
			encryptedSecret: encrypt(secret, config.masterKey),
			encryptedPassphrase: passphrase ? encrypt(passphrase, config.masterKey) : null,
			walletAddress: walletAddress ?? null,
			testnet: testnet ?? false,
		})

		return { success: true, exchange }
	})

	// List configured exchanges
	app.get("/api/keys", async () => {
		const exchanges = await apiKeyRepo.listExchanges()
		const result = []
		for (const exchange of exchanges) {
			const record = await apiKeyRepo.getByExchange(exchange)
			if (record) {
				result.push({
					exchange: record.exchange,
					hasPassphrase: record.encryptedPassphrase !== null,
					walletAddress: record.walletAddress,
					testnet: record.testnet,
					createdAt: record.createdAt,
					updatedAt: record.updatedAt,
				})
			}
		}
		return result
	})

	// Delete API key
	app.delete<{
		Params: { exchange: string }
	}>("/api/keys/:exchange", async (req) => {
		const { exchange } = req.params
		const success = await apiKeyRepo.deleteByExchange(exchange)
		return { success }
	})
}
