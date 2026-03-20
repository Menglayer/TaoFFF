export enum Exchange {
	Binance = "binance",
	Coinbase = "coinbase",
	OKX = "okx",
	Bybit = "bybit",
	Bitget = "bitget",
	Backpack = "backpack",
	Gate = "gate",
	KuCoin = "kucoin",
	HTX = "htx",
	MEXC = "mexc",
	Hyperliquid = "hyperliquid",
	Aster = "aster",
	Lighter = "lighter",
	GRVT = "grvt",
	Extended = "extended",
	EdgeX = "edgex",
}

export enum DataQuality {
	Fresh = "fresh",
	OK = "ok",
	Stale = "stale",
	Offline = "offline",
}

export enum SpreadType {
	FundingRate = "funding_rate",
	Price = "price",
}

export enum AlertOperator {
	GreaterThan = ">",
	GreaterOrEqual = ">=",
	LessThan = "<",
	LessOrEqual = "<=",
	Equal = "==",
}

export enum AlertMetric {
	FundingRate = "funding_rate",
	Apr = "apr",
	NetApr = "net_apr",
	Spread = "spread",
	MarginRatio = "margin_ratio",
}

export enum OrderSequence {
	Parallel = "parallel",
	AThenB = "a_then_b",
	BThenA = "b_then_a",
}

export enum OrderMode {
	Once = "once",
	Loop = "loop",
}

export enum LoopStatus {
	Running = "running",
	Paused = "paused",
	Stopped = "stopped",
}

export enum PositionSide {
	Long = "long",
	Short = "short",
}
