import { DataQuality, Exchange, type FundingRateSnapshot } from "@taofff/shared"
import { describe, expect, it } from "vitest"
import type { AppConfig } from "../src/config"
import { FundingEngine } from "../src/core/funding-engine"
import { SpreadEngine } from "../src/core/spread-engine"

describe("SpreadEngine", () => {
	const mockConfig: AppConfig = {
		port: 8080,
		host: "0.0.0.0",
		masterKey: "test",
		dbPath: ":memory:",
		minNetAprPct: 5.0,
		tradingFeePct: 0.05,
		slippagePct: 0.02,
		defaultLeverage: 1,
		borrowRateDaily: 0.0001,
		rebalanceTimesPerYear: 12,
		stalenessThresholdSeconds: 120,
		wsBroadcastIntervalMs: 2000,
		wsFullSnapshotIntervalMs: 30000,
		binanceSettlementHours: 8,
		okxSettlementHours: 8,
		bybitSettlementHours: 8,
		hyperliquidSettlementHours: 1,
		hyperliquidPollIntervalMs: 30000,
		retentionDaysRates: 30,
		retentionDaysTrades: 90,
		retentionDaysMetrics: 14,
	}

	it("computes spreads correctly", () => {
		const fundingEngine = new FundingEngine()
		const spreadEngine = new SpreadEngine(fundingEngine, mockConfig)
		const now = Date.now()

		const rateA: FundingRateSnapshot = {
			symbol: "BTC/USDT",
			exchange: Exchange.Binance,
			rate: 0.0001,
			apr: 10.95,
			predictedRate: null,
			markPrice: 50000,
			indexPrice: 50000,
			settlementHours: 8,
			nextSettlementTs: now + 3600000,
			receiveTs: now,
			quality: DataQuality.Fresh,
		}

		const rateB: FundingRateSnapshot = {
			symbol: "BTC/USDT",
			exchange: Exchange.OKX,
			rate: 0.0002,
			apr: 21.9,
			predictedRate: null,
			markPrice: 50050,
			indexPrice: 50000,
			settlementHours: 8,
			nextSettlementTs: now + 3600000,
			receiveTs: now,
			quality: DataQuality.Fresh,
		}

		fundingEngine.updateRates([rateA, rateB])

		const spreads = spreadEngine.computeSpreads("BTC/USDT")
		expect(spreads).toHaveLength(1)
		expect(spreads[0]?.symbol).toBe("BTC/USDT")
		expect(spreads[0]?.exchangeA).toBe(Exchange.Binance)
		expect(spreads[0]?.exchangeB).toBe(Exchange.OKX)
		expect(spreads[0]?.grossApr).toBeCloseTo(10.95, 1)
	})

	it("ignores stale rates when computing spreads", () => {
		const fundingEngine = new FundingEngine()
		const spreadEngine = new SpreadEngine(fundingEngine, mockConfig)
		const now = Date.now()

		const rateA: FundingRateSnapshot = {
			symbol: "BTC/USDT",
			exchange: Exchange.Binance,
			rate: 0.0001,
			apr: 10.95,
			predictedRate: null,
			markPrice: 50000,
			indexPrice: 50000,
			settlementHours: 8,
			nextSettlementTs: now + 3600000,
			receiveTs: now,
			quality: DataQuality.Fresh,
		}

		const rateB: FundingRateSnapshot = {
			symbol: "BTC/USDT",
			exchange: Exchange.OKX,
			rate: 0.0002,
			apr: 21.9,
			predictedRate: null,
			markPrice: 50050,
			indexPrice: 50000,
			settlementHours: 8,
			nextSettlementTs: now + 3600000,
			receiveTs: now,
			quality: DataQuality.Stale, // Stale rate
		}

		fundingEngine.updateRates([rateA, rateB])

		const spreads = spreadEngine.computeSpreads("BTC/USDT")
		expect(spreads).toHaveLength(0) // Should be empty because one rate is stale
	})

	it("detects opportunities above threshold", () => {
		const fundingEngine = new FundingEngine()
		const spreadEngine = new SpreadEngine(fundingEngine, mockConfig)
		const now = Date.now()

		const rateA: FundingRateSnapshot = {
			symbol: "BTC/USDT",
			exchange: Exchange.Binance,
			rate: -0.0005, // -54.75% APR
			apr: -54.75,
			predictedRate: null,
			markPrice: 50000,
			indexPrice: 50000,
			settlementHours: 8,
			nextSettlementTs: now + 3600000,
			receiveTs: now,
			quality: DataQuality.Fresh,
		}

		const rateB: FundingRateSnapshot = {
			symbol: "BTC/USDT",
			exchange: Exchange.OKX,
			rate: 0.0005, // 54.75% APR
			apr: 54.75,
			predictedRate: null,
			markPrice: 50050,
			indexPrice: 50000,
			settlementHours: 8,
			nextSettlementTs: now + 3600000,
			receiveTs: now,
			quality: DataQuality.Fresh,
		}

		fundingEngine.updateRates([rateA, rateB])

		const opps = spreadEngine.detectOpportunities()
		expect(opps).toHaveLength(1)
		expect(opps[0]?.symbol).toBe("BTC/USDT")
		expect(opps[0]?.longExchange).toBe(Exchange.Binance) // Long the negative rate
		expect(opps[0]?.shortExchange).toBe(Exchange.OKX) // Short the positive rate
		expect(opps[0]?.grossApr).toBeCloseTo(109.5, 1)
		expect(opps[0]?.netApr).toBeGreaterThan(mockConfig.minNetAprPct)
	})

	it("filters opportunities below threshold", () => {
		const fundingEngine = new FundingEngine()
		const spreadEngine = new SpreadEngine(fundingEngine, mockConfig)
		const now = Date.now()

		const rateA: FundingRateSnapshot = {
			symbol: "BTC/USDT",
			exchange: Exchange.Binance,
			rate: 0.0001, // 10.95% APR
			apr: 10.95,
			predictedRate: null,
			markPrice: 50000,
			indexPrice: 50000,
			settlementHours: 8,
			nextSettlementTs: now + 3600000,
			receiveTs: now,
			quality: DataQuality.Fresh,
		}

		const rateB: FundingRateSnapshot = {
			symbol: "BTC/USDT",
			exchange: Exchange.OKX,
			rate: 0.00015, // 16.425% APR
			apr: 16.425,
			predictedRate: null,
			markPrice: 50050,
			indexPrice: 50000,
			settlementHours: 8,
			nextSettlementTs: now + 3600000,
			receiveTs: now,
			quality: DataQuality.Fresh,
		}

		fundingEngine.updateRates([rateA, rateB])

		const opps = spreadEngine.detectOpportunities()
		// Gross APR is ~5.475%, net APR will be lower than 5.0% threshold due to fees
		expect(opps).toHaveLength(0)
	})
})
