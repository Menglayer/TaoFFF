import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { loadConfig } from "../src/config"

describe("config", () => {
	const originalEnv = process.env

	beforeEach(() => {
		vi.resetModules()
		process.env = { ...originalEnv }
	})

	afterEach(() => {
		process.env = originalEnv
	})

	it("loads default values when env vars are not set", () => {
		// Clear relevant env vars
		delete process.env.PORT
		delete process.env.HOST
		delete process.env.MIN_NET_APR_PCT

		const config = loadConfig()
		expect(config.port).toBe(8080)
		expect(config.host).toBe("0.0.0.0")
		expect(config.minNetAprPct).toBe(5.0)
		expect(config.tradingFeePct).toBe(0.05)
	})

	it("loads custom values from env vars", () => {
		process.env.PORT = "9090"
		process.env.HOST = "127.0.0.1"
		process.env.MIN_NET_APR_PCT = "10.5"
		process.env.TRADING_FEE_PCT = "0.1"

		const config = loadConfig()
		expect(config.port).toBe(9090)
		expect(config.host).toBe("127.0.0.1")
		expect(config.minNetAprPct).toBe(10.5)
		expect(config.tradingFeePct).toBe(0.1)
	})

	it("converts seconds to milliseconds for interval configs", () => {
		process.env.WS_BROADCAST_INTERVAL_SECONDS = "5"
		process.env.WS_FULL_SNAPSHOT_INTERVAL_SECONDS = "60"

		const config = loadConfig()
		expect(config.wsBroadcastIntervalMs).toBe(5000)
		expect(config.wsFullSnapshotIntervalMs).toBe(60000)
	})
})
