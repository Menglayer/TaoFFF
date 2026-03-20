import type {
	ArbitrageOpportunity,
	ExchangeStatus,
	FundingRateSnapshot,
	WsServerMessage,
} from "@taofff/shared"
import { create } from "zustand"
import { wsClient } from "../ws/client"

interface RateState {
	// symbol -> exchange -> snapshot
	rates: Record<string, Record<string, FundingRateSnapshot>>
	statuses: ExchangeStatus[]
	opportunities: ArbitrageOpportunity[]
	connected: boolean
	loading: boolean
	error: string | null
	lastUpdateTs: number

	// Actions
	handleMessage: (msg: WsServerMessage) => void
	setConnection: (connected: boolean) => void
	connect: () => void
	disconnect: () => void
}

export const useRateStore = create<RateState>((set, get) => ({
	rates: {},
	statuses: [],
	opportunities: [],
	connected: false,
	loading: true,
	error: null,
	lastUpdateTs: 0,

	handleMessage: (msg) => {
		switch (msg.type) {
			case "full":
				set({
					rates: msg.rates,
					statuses: msg.statuses,
					opportunities: msg.opportunities,
					loading: false,
					error: null,
					lastUpdateTs: msg.ts,
				})
				break
			case "delta":
				set((state) => {
					const newRates = { ...state.rates }
					if (msg.rates) {
						for (const [symbol, exchanges] of Object.entries(msg.rates)) {
							if (!newRates[symbol]) newRates[symbol] = {}
							for (const [exchange, partial] of Object.entries(exchanges)) {
								newRates[symbol][exchange] = {
									...newRates[symbol][exchange],
									...partial,
								} as FundingRateSnapshot
							}
						}
					}
					return {
						rates: newRates,
						statuses: msg.statuses
							? (state.statuses.map((s) => {
									const update = msg.statuses?.find((us) => us.exchange === s.exchange)
									return update ? { ...s, ...update } : s
								}) as ExchangeStatus[])
							: state.statuses,
						opportunities: msg.opportunities ?? state.opportunities,
						lastUpdateTs: msg.ts,
					}
				})
				break
		}
	},

	setConnection: (connected) => {
		set((state) => ({
			connected,
			loading: connected ? state.loading : false,
			error: connected ? state.error : "WebSocket disconnected. Please ensure backend is running.",
		}))
	},

	connect: () => {
		wsClient.connect()
		wsClient.onMessage((msg) => get().handleMessage(msg))
		wsClient.onConnectionChange((connected) => get().setConnection(connected))
		set({ loading: true, error: null })
	},

	disconnect: () => {
		wsClient.disconnect()
		set({ connected: false, loading: false })
	},
}))
