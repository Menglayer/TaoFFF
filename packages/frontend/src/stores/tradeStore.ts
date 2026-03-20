import type { HedgeTrade } from "@taofff/shared"
import { create } from "zustand"

type TradePhase = "idle" | "confirming" | "executing" | "success" | "error"

interface TradeState {
	phase: TradePhase
	pendingTrade: {
		symbol: string
		longExchange: string
		shortExchange: string
		sizeUsdt: number
		leverage: number
	} | null
	lastTrade: HedgeTrade | null
	error: string | null
	positions: HedgeTrade[]
	history: HedgeTrade[]

	// Actions
	requestTrade: (params: NonNullable<TradeState["pendingTrade"]>) => void
	confirmTrade: () => Promise<void>
	cancelTrade: () => void
	closeTrade: (tradeId: string) => Promise<void>
	fetchPositions: () => Promise<void>
	fetchHistory: () => Promise<void>
	reset: () => void
}

const API = import.meta.env.DEV ? "http://localhost:8080" : ""

export const useTradeStore = create<TradeState>((set, get) => ({
	phase: "idle",
	pendingTrade: null,
	lastTrade: null,
	error: null,
	positions: [],
	history: [],

	requestTrade: (params) => {
		set({ pendingTrade: params, phase: "confirming", error: null })
	},

	confirmTrade: async () => {
		const { pendingTrade } = get()
		if (!pendingTrade) return

		set({ phase: "executing", error: null })

		try {
			const res = await fetch(`${API}/api/trade/open`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(pendingTrade),
			})

			if (!res.ok) {
				const errText = await res.text()
				throw new Error(errText || `Trade failed with status ${res.status}`)
			}

			const trade = await res.json()

			set({ phase: "success", lastTrade: trade, pendingTrade: null })

			// Auto-fetch positions
			get().fetchPositions()
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to execute trade"
			set({ phase: "error", error: message })
		}
	},

	cancelTrade: () => {
		set({ phase: "idle", pendingTrade: null, error: null })
	},

	closeTrade: async (tradeId: string) => {
		try {
			const res = await fetch(`${API}/api/trade/close`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ tradeId }),
			})

			if (!res.ok) {
				throw new Error("Failed to close trade")
			}

			get().fetchPositions()
			get().fetchHistory()
		} catch (err) {
			console.error("Failed to close trade:", err)
			// Could show a toast here in a real app
		}
	},

	fetchPositions: async () => {
		try {
			const res = await fetch(`${API}/api/trade/positions`)
			if (!res.ok) throw new Error("Failed to fetch positions")
			const positions = await res.json()
			set({ positions })
		} catch (err) {
			console.error(err)
		}
	},

	fetchHistory: async () => {
		try {
			const res = await fetch(`${API}/api/trade/history`)
			if (!res.ok) throw new Error("Failed to fetch history")
			const history = await res.json()
			set({ history })
		} catch (err) {
			console.error(err)
		}
	},

	reset: () => {
		set({ phase: "idle", pendingTrade: null, error: null, lastTrade: null })
	},
}))
