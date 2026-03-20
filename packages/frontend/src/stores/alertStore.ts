import type { AlertEvent, AlertRule } from "@taofff/shared"
import { create } from "zustand"

const API = import.meta.env.DEV ? "http://localhost:8080" : ""

interface AlertState {
	rules: AlertRule[]
	events: AlertEvent[]
	fetchRules: () => Promise<void>
	createRule: (params: Omit<AlertRule, "id" | "createdAt" | "updatedAt">) => Promise<void>
	updateRule: (id: string, updates: Partial<AlertRule>) => Promise<void>
	deleteRule: (id: string) => Promise<void>
	fetchHistory: () => Promise<void>
	addEvent: (event: AlertEvent) => void
}

export const useAlertStore = create<AlertState>((set, get) => ({
	rules: [],
	events: [],

	fetchRules: async () => {
		try {
			const res = await fetch(`${API}/api/alerts/rules`)
			if (res.ok) {
				const data = await res.json()
				set({ rules: data })
			}
		} catch (e) {
			console.error(e)
		}
	},

	createRule: async (params) => {
		const res = await fetch(`${API}/api/alerts/rules`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(params),
		})
		if (!res.ok) throw new Error("Failed to create rule")
		await get().fetchRules()
	},

	updateRule: async (id, updates) => {
		const res = await fetch(`${API}/api/alerts/rules/${id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(updates),
		})
		if (!res.ok) throw new Error("Failed to update rule")
		await get().fetchRules()
	},

	deleteRule: async (id) => {
		const res = await fetch(`${API}/api/alerts/rules/${id}`, { method: "DELETE" })
		if (!res.ok) throw new Error("Failed to delete rule")
		await get().fetchRules()
	},

	fetchHistory: async () => {
		try {
			const res = await fetch(`${API}/api/alerts/history`)
			if (res.ok) {
				const data = await res.json()
				set({ events: data })
			}
		} catch (e) {
			console.error(e)
		}
	},

	addEvent: (event) => {
		set((state) => ({ events: [event, ...state.events].slice(0, 100) }))
	},
}))
