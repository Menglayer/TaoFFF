import { DEFAULTS, Exchange } from "@taofff/shared"
import { create } from "zustand"

interface BBO {
	bestBid: number
	bestAsk: number
	bestBidSize: number
	bestAskSize: number
	timestamp: number
}

interface OrderState {
	selectedSymbol: string | null
	longExchange: Exchange | null
	shortExchange: Exchange | null

	sizeUsdt: number
	leverage: number

	bbo: Record<string, BBO>

	setSymbol: (symbol: string) => void
	setLongExchange: (ex: Exchange) => void
	setShortExchange: (ex: Exchange) => void
	setSizeUsdt: (size: number) => void
	setLeverage: (lev: number) => void
	updateBBO: (exchange: string, bbo: BBO) => void

	initFromParams: (params: { symbol?: string; long?: string; short?: string }) => void
}

export const useOrderStore = create<OrderState>((set) => ({
	selectedSymbol: null,
	longExchange: null,
	shortExchange: null,

	sizeUsdt: 1000,
	leverage: DEFAULTS.DEFAULT_LEVERAGE,

	bbo: {},

	setSymbol: (symbol) => set({ selectedSymbol: symbol }),
	setLongExchange: (ex) => set({ longExchange: ex }),
	setShortExchange: (ex) => set({ shortExchange: ex }),
	setSizeUsdt: (size) => set({ sizeUsdt: size }),
	setLeverage: (lev) => set({ leverage: lev }),
	updateBBO: (exchange, bbo) => set((state) => ({ bbo: { ...state.bbo, [exchange]: bbo } })),

	initFromParams: (params) => {
		const updates: Partial<OrderState> = {}
		if (params.symbol) updates.selectedSymbol = params.symbol
		if (params.long && Object.values(Exchange).includes(params.long as Exchange)) {
			updates.longExchange = params.long as Exchange
		}
		if (params.short && Object.values(Exchange).includes(params.short as Exchange)) {
			updates.shortExchange = params.short as Exchange
		}
		if (Object.keys(updates).length > 0) {
			set(updates)
		}
	},
}))
