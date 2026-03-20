import { describe, expect, it } from "vitest"
import {
	AlertMetric,
	AlertOperator,
	Exchange,
	OrderMode,
	OrderSequence,
	PositionSide,
} from "../src/enums"
import {
	AlertRuleSchema,
	AppSettingsSchema,
	CloseTradeRequestSchema,
	ExchangeApiKeyInputSchema,
	FundingRateSnapshotSchema,
	LoopConfigInputSchema,
	OpenTradeRequestSchema,
} from "../src/schemas"

describe("FundingRateSnapshotSchema", () => {
	it("validates correct data", () => {
		const data = {
			symbol: "BTC/USDT",
			exchange: Exchange.Binance,
			rate: 0.0001,
			apr: 10.95,
			predictedRate: 0.00015,
			markPrice: 50000,
			indexPrice: 50010,
			settlementHours: 8,
			nextSettlementTs: Date.now() + 3600000,
			receiveTs: Date.now(),
		}
		expect(FundingRateSnapshotSchema.parse(data)).toEqual(data)
	})

	it("rejects invalid exchange", () => {
		const data = {
			symbol: "BTC/USDT",
			exchange: "invalid_exchange",
			rate: 0.0001,
			apr: 10.95,
			predictedRate: null,
			markPrice: 50000,
			indexPrice: 50010,
			settlementHours: 8,
			nextSettlementTs: Date.now() + 3600000,
			receiveTs: Date.now(),
		}
		expect(() => FundingRateSnapshotSchema.parse(data)).toThrow()
	})

	it("rejects negative markPrice", () => {
		const data = {
			symbol: "BTC/USDT",
			exchange: Exchange.Binance,
			rate: 0.0001,
			apr: 10.95,
			predictedRate: null,
			markPrice: -50000,
			indexPrice: 50010,
			settlementHours: 8,
			nextSettlementTs: Date.now() + 3600000,
			receiveTs: Date.now(),
		}
		expect(() => FundingRateSnapshotSchema.parse(data)).toThrow()
	})
})

describe("OpenTradeRequestSchema", () => {
	it("validates correct data", () => {
		const data = {
			symbol: "BTC/USDT",
			exchangeA: Exchange.Binance,
			exchangeB: Exchange.OKX,
			sideA: PositionSide.Long,
			sideB: PositionSide.Short,
			sizeUsdt: 1000,
			leverage: 5,
			sequence: OrderSequence.Parallel,
			mode: OrderMode.Once,
		}
		expect(OpenTradeRequestSchema.parse(data)).toEqual(data)
	})

	it("rejects invalid leverage", () => {
		const data = {
			symbol: "BTC/USDT",
			exchangeA: Exchange.Binance,
			exchangeB: Exchange.OKX,
			sideA: PositionSide.Long,
			sideB: PositionSide.Short,
			sizeUsdt: 1000,
			leverage: 200, // max is 125
			sequence: OrderSequence.Parallel,
			mode: OrderMode.Once,
		}
		expect(() => OpenTradeRequestSchema.parse(data)).toThrow()
	})
})

describe("CloseTradeRequestSchema", () => {
	it("validates correct data", () => {
		const data = {
			tradeId: "trade_123",
			sequence: OrderSequence.AThenB,
		}
		expect(CloseTradeRequestSchema.parse(data)).toEqual(data)
	})

	it("rejects empty tradeId", () => {
		const data = {
			tradeId: "",
			sequence: OrderSequence.AThenB,
		}
		expect(() => CloseTradeRequestSchema.parse(data)).toThrow()
	})
})

describe("AlertRuleSchema", () => {
	it("validates correct data with defaults", () => {
		const data = {
			name: "High APR",
			metric: AlertMetric.Apr,
			operator: AlertOperator.GreaterThan,
			threshold: 20,
		}
		const parsed = AlertRuleSchema.parse(data)
		expect(parsed.name).toBe("High APR")
		expect(parsed.symbol).toBeNull()
		expect(parsed.exchange).toBeNull()
		expect(parsed.cooldownSeconds).toBe(300)
		expect(parsed.enabled).toBe(true)
	})
})

describe("ExchangeApiKeyInputSchema", () => {
	it("validates correct data", () => {
		const data = {
			exchange: Exchange.Binance,
			apiKey: "key123",
			apiSecret: "secret123",
		}
		const parsed = ExchangeApiKeyInputSchema.parse(data)
		expect(parsed.passphrase).toBeNull()
		expect(parsed.walletAddress).toBeNull()
		expect(parsed.testnet).toBe(false)
	})
})

describe("AppSettingsSchema", () => {
	it("validates empty object with defaults", () => {
		const parsed = AppSettingsSchema.parse({})
		expect(parsed.minNetAprPct).toBe(5.0)
		expect(parsed.tradingFeePct).toBe(0.05)
		expect(parsed.slippagePct).toBe(0.02)
		expect(parsed.defaultLeverage).toBe(1)
		expect(parsed.borrowRateDaily).toBe(0.0001)
		expect(parsed.rebalanceTimesPerYear).toBe(12)
		expect(parsed.stalenessThresholdSeconds).toBe(120)
	})

	it("validates partial overrides", () => {
		const parsed = AppSettingsSchema.parse({ minNetAprPct: 10 })
		expect(parsed.minNetAprPct).toBe(10)
		expect(parsed.tradingFeePct).toBe(0.05)
	})
})

describe("LoopConfigInputSchema", () => {
	it("validates correct data", () => {
		const data = {
			symbol: "ETH/USDT",
			exchangeA: Exchange.Bybit,
			exchangeB: Exchange.Hyperliquid,
			entryThresholdApr: 15,
			exitThresholdApr: 5,
			sizeUsdt: 500,
			leverage: 3,
			sequence: OrderSequence.BThenA,
		}
		expect(LoopConfigInputSchema.parse(data)).toEqual(data)
	})
})
