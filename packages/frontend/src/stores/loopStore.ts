import type { LoopConfig } from "@taofff/shared"
import { create } from "zustand"

export interface CreateLoopParams {
	symbol: string
	exchangeA: string
	exchangeB: string
	entryThresholdApr: number
	exitThresholdApr: number
	sizeUsdt: number
	leverage: number
}

interface LoopState {
	loops: LoopConfig[]
	loading: boolean
	error: string | null

	fetchLoops: () => Promise<void>
	createLoop: (params: CreateLoopParams) => Promise<void>
	startLoop: (id: string) => Promise<void>
	pauseLoop: (id: string) => Promise<void>
	stopLoop: (id: string) => Promise<void>
	deleteLoop: (id: string) => Promise<void>
	updateFromWs: (loops: Partial<LoopConfig>[], isFull?: boolean) => void
}

const API = import.meta.env.DEV ? "http://localhost:8080" : ""

export const useLoopStore = create<LoopState>((set, get) => ({
	loops: [],
	loading: false,
	error: null,

	fetchLoops: async () => {
		set({ loading: true, error: null })
		try {
			const res = await fetch(`${API}/api/loop/status`)
			if (!res.ok) {
				throw new Error(`Failed to fetch loops: ${res.statusText}`)
			}
			const data = await res.json()
			set({ loops: data, loading: false })
		} catch (err) {
			set({ error: err instanceof Error ? err.message : "Unknown error", loading: false })
		}
	},

	createLoop: async (params) => {
		set({ loading: true, error: null })
		try {
			const res = await fetch(`${API}/api/loop/create`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(params),
			})
			if (!res.ok) {
				const text = await res.text()
				throw new Error(text || `Failed to create loop: ${res.statusText}`)
			}
			await get().fetchLoops()
		} catch (err) {
			set({ error: err instanceof Error ? err.message : "Unknown error", loading: false })
		}
	},

	startLoop: async (id) => {
		try {
			const res = await fetch(`${API}/api/loop/${id}/start`, { method: "POST" })
			if (!res.ok) throw new Error("Failed to start loop")
			// Opt. fetch loops or rely on WS
		} catch (err) {
			set({ error: err instanceof Error ? err.message : "Unknown error" })
		}
	},

	pauseLoop: async (id) => {
		try {
			const res = await fetch(`${API}/api/loop/${id}/pause`, { method: "POST" })
			if (!res.ok) throw new Error("Failed to pause loop")
		} catch (err) {
			set({ error: err instanceof Error ? err.message : "Unknown error" })
		}
	},

	stopLoop: async (id) => {
		try {
			const res = await fetch(`${API}/api/loop/${id}/stop`, { method: "POST" })
			if (!res.ok) throw new Error("Failed to stop loop")
		} catch (err) {
			set({ error: err instanceof Error ? err.message : "Unknown error" })
		}
	},

	deleteLoop: async (id) => {
		try {
			const res = await fetch(`${API}/api/loop/${id}`, { method: "DELETE" })
			if (!res.ok) throw new Error("Failed to delete loop")
			set((state) => ({ loops: state.loops.filter((l) => l.id !== id) }))
		} catch (err) {
			set({ error: err instanceof Error ? err.message : "Unknown error" })
		}
	},

	updateFromWs: (wsLoops, isFull = false) => {
		set((state) => {
			if (isFull) {
				return { loops: wsLoops as LoopConfig[] }
			}
			const currentMap = new Map(state.loops.map((l) => [l.id, l]))
			let changed = false
			for (const update of wsLoops) {
				if (!update.id) continue
				const existing = currentMap.get(update.id)
				if (existing) {
					currentMap.set(update.id, { ...existing, ...update })
					changed = true
				}
			}
			if (changed) {
				return { loops: Array.from(currentMap.values()) }
			}
			return state
		})
	},
}))
