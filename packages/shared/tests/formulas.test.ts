import { describe, expect, it } from "vitest"
import {
	assignSides,
	computeApr,
	computeBorrowCostApr,
	computeEntryExitCostPct,
	computeGrossApr,
	computeLeveragedApr,
	computeNetApr,
	computeSpread,
	computeTradingCostApr,
} from "../src/formulas"

describe("computeApr", () => {
	it("annualizes 8-hour settlement rate", () => {
		// 0.01% rate, 8h settlement = 3 periods/day * 365
		const apr = computeApr(0.0001, 8)
		expect(apr).toBeCloseTo(10.95, 1)
	})

	it("annualizes 1-hour settlement rate (Hyperliquid)", () => {
		// 0.01% rate, 1h settlement = 24 periods/day * 365
		const apr = computeApr(0.0001, 1)
		expect(apr).toBeCloseTo(87.6, 1)
	})

	it("handles zero rate", () => {
		expect(computeApr(0, 8)).toBe(0)
	})

	it("handles negative rate", () => {
		const apr = computeApr(-0.0001, 8)
		expect(apr).toBeCloseTo(-10.95, 1)
	})
})

describe("computeSpread", () => {
	it("computes spread between two prices", () => {
		const spread = computeSpread(100, 99)
		// (100 - 99) * 2 / (100 + 99) * 100 = 200 / 199 * 100 ≈ 1.005%
		expect(spread).toBeCloseTo(1.005, 2)
	})

	it("returns 0 for equal prices", () => {
		expect(computeSpread(100, 100)).toBe(0)
	})

	it("returns 0 for zero sum", () => {
		expect(computeSpread(0, 0)).toBe(0)
	})

	it("handles negative spread", () => {
		const spread = computeSpread(99, 100)
		expect(spread).toBeLessThan(0)
	})
})

describe("assignSides", () => {
	it("shorts higher-rate exchange when both positive", () => {
		// A has 10% APR, B has 5% APR → short A (index 0), long B (index 1)
		const [longIdx, shortIdx] = assignSides(10, 5)
		expect(longIdx).toBe(1)
		expect(shortIdx).toBe(0)
	})

	it("shorts less-negative exchange when both negative", () => {
		// A has -2%, B has -5% → A is higher (less negative) → short A, long B
		const [longIdx, shortIdx] = assignSides(-2, -5)
		expect(longIdx).toBe(1)
		expect(shortIdx).toBe(0)
	})

	it("shorts positive, longs negative in mixed case", () => {
		// A has -3%, B has 5% → B is higher → short B, long A
		const [longIdx, shortIdx] = assignSides(-3, 5)
		expect(longIdx).toBe(0)
		expect(shortIdx).toBe(1)
	})

	it("handles equal rates", () => {
		const [longIdx, shortIdx] = assignSides(5, 5)
		// aprA >= aprB → short A, long B
		expect(longIdx).toBe(1)
		expect(shortIdx).toBe(0)
	})
})

describe("computeGrossApr", () => {
	it("computes absolute difference", () => {
		expect(computeGrossApr(10, 5)).toBe(5)
		expect(computeGrossApr(5, 10)).toBe(5)
		expect(computeGrossApr(-5, 5)).toBe(10)
	})
})

describe("computeLeveragedApr", () => {
	it("multiplies by leverage", () => {
		expect(computeLeveragedApr(10, 3)).toBe(30)
		expect(computeLeveragedApr(10, 1)).toBe(10)
	})
})

describe("computeBorrowCostApr", () => {
	it("computes annualized borrow cost", () => {
		// 0.01% daily * 365 * 100 * (3-1) = 7.3%
		const cost = computeBorrowCostApr(0.0001, 3)
		expect(cost).toBeCloseTo(7.3, 1)
	})

	it("returns 0 at 1x leverage", () => {
		expect(computeBorrowCostApr(0.0001, 1)).toBe(0)
	})
})

describe("computeEntryExitCostPct", () => {
	it("computes 4x fee+slippage", () => {
		// 4 * (0.05 + 0.02) = 0.28%
		expect(computeEntryExitCostPct(0.05, 0.02)).toBeCloseTo(0.28, 2)
	})
})

describe("computeTradingCostApr", () => {
	it("computes annualized trading cost", () => {
		expect(computeTradingCostApr(0.28, 12, 3)).toBeCloseTo(10.08, 1)
	})
})

describe("computeNetApr", () => {
	it("computes net apr for a typical scenario", () => {
		const netApr = computeNetApr({
			shortApr: 15,
			longApr: 5,
			leverage: 3,
			borrowRateDaily: 0.0001,
			feePct: 0.05,
			slippagePct: 0.02,
			rebalanceTimesPerYear: 12,
		})
		// grossApr = 10, leveragedApr = 30
		// borrowCost = 0.0001 * 365 * 100 * 2 = 7.3
		// entryExitCost = 4 * 0.07 = 0.28
		// tradingCost = 0.28 * 12 * 3 = 10.08
		// netApr = 30 - 7.3 - 10.08 = 12.62
		expect(netApr).toBeCloseTo(12.62, 1)
	})

	it("returns negative for unprofitable scenario", () => {
		const netApr = computeNetApr({
			shortApr: 5.5,
			longApr: 5,
			leverage: 1,
			borrowRateDaily: 0.001,
			feePct: 0.1,
			slippagePct: 0.05,
			rebalanceTimesPerYear: 52,
		})
		expect(netApr).toBeLessThan(0)
	})
})
