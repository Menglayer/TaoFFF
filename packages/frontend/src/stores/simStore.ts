import type { HedgeTrade, SimPositionSnapshot, WsServerMessage } from "@taofff/shared"
import { create } from "zustand"
import { wsClient } from "../ws/client"

/** Translate common backend error messages to Chinese */
function translateSimError(msg: string): string {
	if (msg.startsWith("No rate data for"))
		return msg.replace(/No rate data for (.+) on (.+)/, "交易所 $2 没有 $1 的行情数据")
	if (msg.startsWith("Invalid price data for"))
		return msg.replace(
			/Invalid price data for (.+): (.+)\. Cannot open trade\./,
			"$1 价格数据无效（$2），无法开仓",
		)
	if (msg.startsWith("Insufficient balance"))
		return msg.replace(
			/Insufficient balance\. Required: (.+), Available: (.+)/,
			"余额不足，需要 $$$1，可用 $$$2",
		)
	if (msg.includes("not initialized")) return "模拟余额未初始化，请先重置余额"
	return msg
}

type SimPhase = "idle" | "executing" | "success" | "error"

interface SimBalanceState {
	currentBalance: number
	reservedMargin: number
	availableBalance: number
}

interface SimState {
	balance: SimBalanceState | null
	positions: SimPositionSnapshot[]
	history: HedgeTrade[]
	phase: SimPhase
	error: string | null

	// Actions
	openSimTrade: (params: {
		symbol: string
		longExchange: string
		shortExchange: string
		sizeUsdt: number
		leverage: number
	}) => Promise<void>
	closeSimTrade: (tradeId: string) => Promise<void>
	fetchPositions: () => Promise<void>
	fetchHistory: () => Promise<void>
	fetchBalance: () => Promise<void>
	resetBalance: (amount?: number) => Promise<void>
	handleWsMessage: (msg: WsServerMessage) => void
	connect: () => void
	disconnect: () => void
	reset: () => void
}

const API = import.meta.env.DEV ? "http://localhost:8080" : ""

export const useSimStore = create<SimState>((set, get) => ({
	balance: null,
	positions: [],
	history: [],
	phase: "idle",
	error: null,

	openSimTrade: async (params) => {
		set({ phase: "executing", error: null })
		try {
			const res = await fetch(`${API}/api/sim/open`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(params),
			})
			if (!res.ok) {
				const body = await res.json().catch(() => null)
				const raw = (body as Record<string, string> | null)?.error ?? `模拟开仓失败 (${res.status})`
				throw new Error(translateSimError(raw))
			}
			set({ phase: "success" })
			// Refresh positions and balance
			get().fetchPositions()
			get().fetchBalance()
		} catch (err) {
			const message = err instanceof Error ? err.message : "模拟开仓失败"
			set({ phase: "error", error: message })
		}
	},

	closeSimTrade: async (tradeId) => {
		try {
			const res = await fetch(`${API}/api/sim/close`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ tradeId }),
			})
			if (!res.ok) {
				throw new Error("模拟平仓失败")
			}
			get().fetchPositions()
			get().fetchBalance()
			get().fetchHistory()
		} catch (err) {
			console.error("Failed to close sim trade:", err)
		}
	},

	fetchPositions: async () => {
		try {
			const res = await fetch(`${API}/api/sim/positions`)
			if (!res.ok) throw new Error("Failed to fetch sim positions")
			const positions = await res.json()
			set({ positions })
		} catch (err) {
			console.error(err)
		}
	},

	fetchHistory: async () => {
		try {
			const res = await fetch(`${API}/api/sim/history`)
			if (!res.ok) throw new Error("Failed to fetch sim history")
			const history: HedgeTrade[] = await res.json()
			set({ history })
		} catch (err) {
			console.error(err)
		}
	},

	fetchBalance: async () => {
		try {
			const res = await fetch(`${API}/api/sim/balance`)
			if (!res.ok) {
				if (res.status === 404) {
					set({ balance: null })
					return
				}
				throw new Error("Failed to fetch sim balance")
			}
			const data = await res.json()
			set({
				balance: {
					currentBalance: data.currentBalance,
					reservedMargin: data.reservedMargin,
					availableBalance: data.currentBalance - data.reservedMargin,
				},
			})
		} catch (err) {
			console.error(err)
		}
	},

	resetBalance: async (amount?: number) => {
		try {
			const res = await fetch(`${API}/api/sim/balance/reset`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(amount !== undefined ? { initialBalance: amount } : {}),
			})
			if (!res.ok) throw new Error("Failed to reset sim balance")
			const data = await res.json()
			if (data.balance) {
				set({
					balance: {
						currentBalance: data.balance.currentBalance,
						reservedMargin: data.balance.reservedMargin,
						availableBalance: data.balance.currentBalance - data.balance.reservedMargin,
					},
				})
			}
		} catch (err) {
			console.error(err)
		}
	},

	handleWsMessage: (msg) => {
		if (msg.type === "full" || msg.type === "delta") {
			const updates: Partial<SimState> = {}
			if (msg.simPositions) {
				updates.positions = msg.simPositions
			}
			if (msg.simBalance) {
				updates.balance = msg.simBalance
			}
			if (Object.keys(updates).length > 0) {
				set(updates)
			}
		}
	},

	connect: () => {
		wsClient.onMessage((msg) => get().handleWsMessage(msg))
		// Initial fetches
		get().fetchBalance()
		get().fetchHistory()
	},

	disconnect: () => {
		// WsClient lifecycle managed by rateStore
	},

	reset: () => {
		set({ phase: "idle", error: null })
	},
}))
