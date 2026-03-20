import { create } from "zustand"

const API = import.meta.env.DEV ? "http://localhost:8080" : ""

interface ConfigState {
	exchanges: Array<{
		exchange: string
		hasPassphrase: boolean
		walletAddress: string | null
		testnet: boolean
		createdAt: number
		updatedAt: number
	}>
	settings: {
		minNetAprPct: number
		tradingFeePct: number
		slippagePct: number
		defaultLeverage: number
		borrowRateDaily: number
		rebalanceTimesPerYear: number
	}
	loading: boolean
	fetchExchanges: () => Promise<void>
	saveApiKey: (
		exchange: string,
		data: {
			apiKey: string
			secret: string
			passphrase?: string
			walletAddress?: string
			testnet?: boolean
		},
	) => Promise<void>
	deleteApiKey: (exchange: string) => Promise<void>
	testConnection: (exchange: string) => Promise<boolean>
	updateSettings: (settings: Partial<ConfigState["settings"]>) => void
}

export const useConfigStore = create<ConfigState>((set, get) => ({
	exchanges: [],
	settings: {
		minNetAprPct: 5.0,
		tradingFeePct: 0.05,
		slippagePct: 0.02,
		defaultLeverage: 1,
		borrowRateDaily: 0.0001,
		rebalanceTimesPerYear: 12,
	},
	loading: false,

	fetchExchanges: async () => {
		set({ loading: true })
		try {
			const res = await fetch(`${API}/api/keys`)
			if (res.ok) {
				const data = await res.json()
				set({ exchanges: data })
			}
		} catch (e) {
			console.error(e)
		} finally {
			set({ loading: false })
		}
	},

	saveApiKey: async (exchange, data) => {
		set({ loading: true })
		try {
			const res = await fetch(`${API}/api/keys/${exchange}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			})
			if (!res.ok) throw new Error("Failed to save API key")
			await get().fetchExchanges()
		} finally {
			set({ loading: false })
		}
	},

	deleteApiKey: async (exchange) => {
		set({ loading: true })
		try {
			const res = await fetch(`${API}/api/keys/${exchange}`, { method: "DELETE" })
			if (!res.ok) throw new Error("Failed to delete API key")
			await get().fetchExchanges()
		} finally {
			set({ loading: false })
		}
	},

	testConnection: async (_exchange) => {
		try {
			// Very simple test implementation: just try fetching /api/status. In a real app we'd query something exchange specific.
			const res = await fetch(`${API}/api/status`)
			return res.ok
		} catch {
			return false
		}
	},

	updateSettings: (settings) => {
		set((state) => ({
			settings: { ...state.settings, ...settings },
		}))
	},
}))
