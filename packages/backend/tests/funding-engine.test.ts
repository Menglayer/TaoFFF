import { DataQuality, Exchange, type FundingRateSnapshot } from "@taofff/shared"
import { describe, expect, it } from "vitest"
import { FundingEngine } from "../src/core/funding-engine"

describe("FundingEngine", () => {
	it("stores and retrieves rates", () => {
		const engine = new FundingEngine()
		const now = Date.now()

		const snapshot: FundingRateSnapshot = {
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

		engine.updateRates([snapshot])

		const rates = engine.getSymbolRates("BTC/USDT")
		expect(rates).toHaveLength(1)
		expect(rates[0]).toEqual(snapshot)

		const allRates = engine.getAllRates()
		expect(allRates).toHaveLength(1)
		expect(allRates[0]).toEqual(snapshot)

		const symbols = engine.getSymbols()
		expect(symbols).toEqual(["BTC/USDT"])
	})

	it("updates existing rates", () => {
		const engine = new FundingEngine()
		const now = Date.now()

		const snapshot1: FundingRateSnapshot = {
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

		engine.updateRates([snapshot1])

		const snapshot2: FundingRateSnapshot = {
			...snapshot1,
			rate: 0.0002,
			apr: 21.9,
		}

		engine.updateRates([snapshot2])

		const rates = engine.getSymbolRates("BTC/USDT")
		expect(rates).toHaveLength(1)
		expect(rates[0]?.rate).toBe(0.0002)
	})

	it("manages exchange statuses", () => {
		const engine = new FundingEngine()

		engine.updateExchangeStatus(Exchange.Binance, { connected: true, symbolCount: 100 })

		const statuses = engine.getExchangeStatuses()
		expect(statuses).toHaveLength(1)
		expect(statuses[0]?.exchange).toBe(Exchange.Binance)
		expect(statuses[0]?.connected).toBe(true)
		expect(statuses[0]?.symbolCount).toBe(100)
		expect(statuses[0]?.quality).toBe(DataQuality.Offline) // Default

		engine.updateExchangeStatus(Exchange.Binance, { quality: DataQuality.Fresh })

		const updatedStatuses = engine.getExchangeStatuses()
		expect(updatedStatuses[0]?.quality).toBe(DataQuality.Fresh)
		expect(updatedStatuses[0]?.connected).toBe(true) // Preserved
	})

	it("returns full snapshot", () => {
		const engine = new FundingEngine()
		const now = Date.now()

		const snapshot: FundingRateSnapshot = {
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

		engine.updateRates([snapshot])
		engine.updateExchangeStatus(Exchange.Binance, { connected: true })

		const fullSnapshot = engine.getFullSnapshot()
		expect(fullSnapshot.rates["BTC/USDT"]?.[Exchange.Binance]).toEqual(snapshot)
		expect(fullSnapshot.statuses).toHaveLength(1)
		expect(fullSnapshot.opportunities).toHaveLength(0)
	})

	it("stores and retrieves opportunities", () => {
		const engine = new FundingEngine()
		const opps = [
			{
				id: "BTC/USDT-binance-okx",
				symbol: "BTC/USDT",
				longExchange: Exchange.Binance,
				shortExchange: Exchange.OKX,
				longRate: 0.0001,
				shortRate: 0.0002,
				grossApr: 10.95,
				leveragedApr: 10.95,
				borrowCostApr: 0,
				tradingCostApr: 0,
				netApr: 10.95,
				leverage: 1,
				spreadPct: 0.1,
				detectedAt: Date.now(),
				quality: DataQuality.Fresh,
			},
		]

		engine.setOpportunities(opps)
		expect(engine.getOpportunities()).toEqual(opps)
	})

	it("computes delta correctly", () => {
		const engine = new FundingEngine()
		const now = Date.now()

		const snapshot1: FundingRateSnapshot = {
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

		engine.updateRates([snapshot1])

		// First delta should contain the full snapshot
		const delta1 = engine.computeDelta()
		expect(delta1?.rates?.["BTC/USDT"]?.[Exchange.Binance]).toEqual(snapshot1)

		// Second delta with no changes should be null
		const delta2 = engine.computeDelta()
		expect(delta2).toBeNull()

		// Update rate
		const snapshot2: FundingRateSnapshot = {
			...snapshot1,
			rate: 0.0002,
			apr: 21.9,
		}
		engine.updateRates([snapshot2])

		// Third delta should contain only changed fields
		const delta3 = engine.computeDelta()
		expect(delta3?.rates?.["BTC/USDT"]?.[Exchange.Binance]).toEqual({
			rate: 0.0002,
			apr: 21.9,
		})
	})
})
