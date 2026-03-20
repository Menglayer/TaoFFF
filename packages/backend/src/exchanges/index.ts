import { Exchange } from "@taofff/shared"
import { AsterExchange } from "./aster"
import { BackpackExchange } from "./backpack"
import type { BaseExchange } from "./base"
import { BinanceExchange } from "./binance"
import { BitgetExchange } from "./bitget"
import { BybitExchange } from "./bybit"
import { ExtendedExchange } from "./extended"
import { GateExchange } from "./gate"
import { GRVTExchange } from "./grvt"
import { HTXExchange } from "./htx"
import { HyperliquidExchange } from "./hyperliquid"
import { LighterExchange } from "./lighter"
import { MEXCExchange } from "./mexc"
import { OKXExchange } from "./okx"

export { BaseExchange } from "./base"

const exchangeMap: Partial<Record<Exchange, () => BaseExchange>> = {
	[Exchange.Binance]: () => new BinanceExchange(),
	[Exchange.OKX]: () => new OKXExchange(),
	[Exchange.Bybit]: () => new BybitExchange(),
	[Exchange.Bitget]: () => new BitgetExchange(),
	[Exchange.Backpack]: () => new BackpackExchange(),
	[Exchange.Gate]: () => new GateExchange(),
	[Exchange.HTX]: () => new HTXExchange(),
	[Exchange.MEXC]: () => new MEXCExchange(),
	[Exchange.Hyperliquid]: () => new HyperliquidExchange(),
	[Exchange.Aster]: () => new AsterExchange(),
	[Exchange.Lighter]: () => new LighterExchange(),
	[Exchange.GRVT]: () => new GRVTExchange(),
	[Exchange.Extended]: () => new ExtendedExchange(),
}

/** Create a single exchange adapter by ID */
export function createExchange(id: Exchange): BaseExchange {
	const factory = exchangeMap[id]
	if (!factory) {
		throw new Error(`Exchange adapter not enabled: ${id}`)
	}
	return factory()
}

/** Create all configured exchange adapters */
export function createAllExchanges(): BaseExchange[] {
	const enabledExchanges: Exchange[] = [
		Exchange.Binance,
		Exchange.OKX,
		Exchange.Bybit,
		Exchange.Bitget,
		Exchange.Backpack,
		Exchange.Gate,
		Exchange.HTX,
		Exchange.MEXC,
		Exchange.Hyperliquid,
		Exchange.Aster,
		Exchange.Lighter,
		Exchange.GRVT,
		Exchange.Extended,
	]

	return enabledExchanges.map((id) => createExchange(id))
}
