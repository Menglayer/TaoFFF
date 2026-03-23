import { type Exchange, STALENESS_THRESHOLDS } from "@taofff/shared"
import { EXCHANGE_TEXT_COLOR } from "../utils/exchange"

function getExchangeColorClass(exchange: string) {
	return EXCHANGE_TEXT_COLOR[exchange as Exchange] ?? "text-gray-300"
}

function getQualityColor(msAge: number) {
	if (msAge < STALENESS_THRESHOLDS.FRESH_MS)
		return "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
	if (msAge < STALENESS_THRESHOLDS.OK_MS) return "bg-yellow-400"
	if (msAge < STALENESS_THRESHOLDS.STALE_MS) return "bg-orange-500"
	return "bg-gray-500"
}

export function OrderbookDisplay({
	exchange,
	bbo,
}: {
	exchange: Exchange
	bbo?: {
		bestBid: number
		bestAsk: number
		bestBidSize: number
		bestAskSize: number
		timestamp: number
	}
}) {
	const now = Date.now()
	const age = bbo ? now - bbo.timestamp : Infinity
	const dotColor = getQualityColor(age)

	return (
		<div className="flex flex-col border border-gray-800 rounded-xl bg-gray-900/50 p-4 shadow-xl">
			<div className="flex items-center justify-between mb-4">
				<div className={`font-semibold capitalize ${getExchangeColorClass(exchange)}`}>
					{exchange}
				</div>
				<div className="flex items-center gap-2 text-xs text-gray-400">
					{bbo && <span>{age > 60000 ? ">1 分钟前" : `${Math.floor(age / 1000)} 秒前`}</span>}
					<div className={`w-2 h-2 rounded-full ${dotColor}`} />
				</div>
			</div>

			{!bbo ? (
				<div className="flex-1 flex items-center justify-center text-gray-500 text-sm py-8">
					订单簿数据不可用
				</div>
			) : (
				<div className="flex flex-col gap-2 font-mono text-sm">
					<div className="grid grid-cols-2 text-gray-400 text-xs uppercase mb-1 border-b border-gray-800/50 pb-2">
						<span>价格</span>
						<span className="text-right">数量</span>
					</div>

					{/* ASK */}
					<div className="grid grid-cols-2 text-red-400 group hover:bg-red-400/5 px-2 py-1 rounded transition-colors">
						<span>{bbo.bestAsk.toFixed(4)}</span>
						<span className="text-right">{bbo.bestAskSize.toFixed(4)}</span>
					</div>

					{/* SPREAD */}
					<div className="text-center text-xs text-gray-500 py-1 border-y border-gray-800/30">
						价差：{Math.abs(bbo.bestAsk - bbo.bestBid).toFixed(4)}
					</div>

					{/* BID */}
					<div className="grid grid-cols-2 text-green-400 group hover:bg-green-400/5 px-2 py-1 rounded transition-colors">
						<span>{bbo.bestBid.toFixed(4)}</span>
						<span className="text-right">{bbo.bestBidSize.toFixed(4)}</span>
					</div>
				</div>
			)}
		</div>
	)
}
