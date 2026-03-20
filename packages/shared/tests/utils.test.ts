import { describe, expect, it } from "vitest"
import { STALENESS_THRESHOLDS } from "../src/constants"
import { DataQuality } from "../src/enums"
import {
	assessDataQuality,
	clamp,
	deltaDict,
	formatPct,
	formatUsdt,
	generateId,
	normalizeSymbol,
} from "../src/utils"

describe("deltaDict", () => {
	it("returns null when objects are identical", () => {
		const obj = { a: 1, b: "test" }
		expect(deltaDict(obj, { ...obj })).toBeNull()
	})

	it("returns only changed fields", () => {
		const prev = { a: 1, b: "test", c: true }
		const curr = { a: 2, b: "test", c: false }
		expect(deltaDict(prev, curr)).toEqual({ a: 2, c: false })
	})

	it("handles new fields in curr", () => {
		const prev = { a: 1 } as Record<string, number>
		const curr = { a: 1, b: 2 }
		expect(deltaDict(prev, curr)).toEqual({ b: 2 })
	})
})

describe("normalizeSymbol", () => {
	it("returns already normalized symbol", () => {
		expect(normalizeSymbol("BTC/USDT")).toBe("BTC/USDT")
		expect(normalizeSymbol("ETH/USDC")).toBe("ETH/USDC")
	})

	it("normalizes CCXT perpetual format", () => {
		expect(normalizeSymbol("BTC/USDT:USDT")).toBe("BTC/USDT")
	})

	it("normalizes OKX format", () => {
		expect(normalizeSymbol("BTC-USDT-SWAP")).toBe("BTC/USDT")
		expect(normalizeSymbol("ETH-USDT")).toBe("ETH/USDT")
	})

	it("normalizes Binance/Bybit format", () => {
		expect(normalizeSymbol("BTCUSDT")).toBe("BTC/USDT")
		expect(normalizeSymbol("ETHUSDC")).toBe("ETH/USDC")
		expect(normalizeSymbol("DOGEBUSD")).toBe("DOGE/BUSD")
		expect(normalizeSymbol("SOLUSD")).toBe("SOL/USD")
	})

	it("returns raw if no match", () => {
		expect(normalizeSymbol("UNKNOWNFORMAT")).toBe("UNKNOWNFORMAT")
	})
})

describe("assessDataQuality", () => {
	it("returns Fresh for recent data", () => {
		const now = Date.now()
		expect(assessDataQuality(now - 1000, now)).toBe(DataQuality.Fresh)
		expect(assessDataQuality(now - STALENESS_THRESHOLDS.FRESH_MS + 1, now)).toBe(DataQuality.Fresh)
	})

	it("returns OK for slightly older data", () => {
		const now = Date.now()
		expect(assessDataQuality(now - STALENESS_THRESHOLDS.FRESH_MS, now)).toBe(DataQuality.OK)
		expect(assessDataQuality(now - STALENESS_THRESHOLDS.OK_MS + 1, now)).toBe(DataQuality.OK)
	})

	it("returns Stale for old data", () => {
		const now = Date.now()
		expect(assessDataQuality(now - STALENESS_THRESHOLDS.OK_MS, now)).toBe(DataQuality.Stale)
		expect(assessDataQuality(now - STALENESS_THRESHOLDS.STALE_MS + 1, now)).toBe(DataQuality.Stale)
	})

	it("returns Offline for very old data", () => {
		const now = Date.now()
		expect(assessDataQuality(now - STALENESS_THRESHOLDS.STALE_MS, now)).toBe(DataQuality.Offline)
		expect(assessDataQuality(now - STALENESS_THRESHOLDS.STALE_MS * 2, now)).toBe(
			DataQuality.Offline,
		)
	})
})

describe("generateId", () => {
	it("generates unique string IDs", () => {
		const id1 = generateId()
		const id2 = generateId()
		expect(typeof id1).toBe("string")
		expect(id1.length).toBeGreaterThan(0)
		expect(id1).not.toBe(id2)
	})
})

describe("clamp", () => {
	it("clamps value within range", () => {
		expect(clamp(5, 1, 10)).toBe(5)
		expect(clamp(0, 1, 10)).toBe(1)
		expect(clamp(15, 1, 10)).toBe(10)
	})
})

describe("formatPct", () => {
	it("formats positive numbers with + sign", () => {
		expect(formatPct(5.123)).toBe("+5.12%")
		expect(formatPct(0)).toBe("+0.00%")
	})

	it("formats negative numbers with - sign", () => {
		expect(formatPct(-5.123)).toBe("-5.12%")
	})

	it("respects decimals parameter", () => {
		expect(formatPct(5.12345, 4)).toBe("+5.1235%")
		expect(formatPct(5.1, 0)).toBe("+5%")
	})
})

describe("formatUsdt", () => {
	it("formats positive numbers with + sign", () => {
		expect(formatUsdt(100.5)).toBe("+100.50 USDT")
		expect(formatUsdt(0)).toBe("+0.00 USDT")
	})

	it("formats negative numbers with - sign", () => {
		expect(formatUsdt(-100.5)).toBe("-100.50 USDT")
	})

	it("respects decimals parameter", () => {
		expect(formatUsdt(100.567, 1)).toBe("+100.6 USDT")
		expect(formatUsdt(100, 0)).toBe("+100 USDT")
	})
})
