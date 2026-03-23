import type { ArbitrageOpportunity } from "@taofff/shared"
import { DataQuality, DEFAULTS, type Exchange } from "@taofff/shared"
import { Link } from "react-router"
import { useRateStore } from "../stores/rateStore"
import { useTradeStore } from "../stores/tradeStore"
import { EXCHANGE_DISPLAY_NAME, EXCHANGE_TEXT_COLOR } from "../utils/exchange"

function getExchangeColorClass(exchange: Exchange) {
	return EXCHANGE_TEXT_COLOR[exchange] ?? "text-gray-300"
}

function getQualityColor(quality: DataQuality) {
	switch (quality) {
		case DataQuality.Fresh:
			return "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
		case DataQuality.OK:
			return "bg-yellow-400"
		case DataQuality.Stale:
			return "bg-orange-500"
		case DataQuality.Offline:
			return "bg-gray-500"
		default:
			return "bg-gray-500"
	}
}

function formatExchangeName(exchange: Exchange) {
	return EXCHANGE_DISPLAY_NAME[exchange] ?? exchange
}

export function OpportunityCard({ opp }: { opp: ArbitrageOpportunity }) {
	const { requestTrade } = useTradeStore()
	const rates = useRateStore((state) => state.rates[opp.symbol])
	const longPredicted = rates?.[opp.longExchange]?.predictedRate
	const shortPredicted = rates?.[opp.shortExchange]?.predictedRate

	const isHighApr = opp.netApr > 20
	const isGoodApr = opp.netApr > 10
	const isNegativeApr = opp.netApr < 0

	let netAprColor = "text-gray-300"
	let netAprGlow = ""

	if (isNegativeApr) {
		netAprColor = "text-red-400"
	} else if (isHighApr) {
		netAprColor = "text-green-400"
		netAprGlow = "drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]"
	} else if (isGoodApr) {
		netAprColor = "text-green-500"
	}

	const grossAprColor = opp.grossApr >= 0 ? "text-green-400" : "text-red-400"

	const handleQuickTrade = () => {
		requestTrade({
			symbol: opp.symbol,
			longExchange: opp.longExchange,
			shortExchange: opp.shortExchange,
			sizeUsdt: 1000,
			leverage: DEFAULTS.DEFAULT_LEVERAGE,
		})
	}

	return (
		<div className="relative flex flex-col p-5 bg-gray-900/80 border border-gray-700 rounded-xl hover:border-gray-600 transition-all duration-300 shadow-lg group">
			{/* Top Header */}
			<div className="flex items-center justify-between mb-3">
				<div className="flex items-center gap-2">
					<div className={`w-2 h-2 rounded-full ${getQualityColor(opp.quality)}`} />
					<h3 className="text-xl font-bold tracking-tight text-white">{opp.symbol}</h3>
					{opp.leverage > 1 && (
						<span className="px-2 py-0.5 text-xs font-semibold bg-gray-800 text-blue-400 rounded-md border border-gray-700">
							{opp.leverage}x
						</span>
					)}
				</div>
				<div className={`text-2xl font-black tracking-tighter ${netAprColor} ${netAprGlow}`}>
					{opp.netApr.toFixed(2)}%{" "}
					<span className="text-xs font-medium text-gray-500 uppercase tracking-wider">净年化</span>
				</div>
			</div>

			{/* Direction & Exchanges */}
			<div className="flex flex-wrap items-center gap-1.5 text-sm font-medium bg-gray-950/50 p-2.5 rounded-lg mb-4 border border-gray-800/80">
				<span className={`${getExchangeColorClass(opp.longExchange)} opacity-90`}>多</span>
				<span className={`${getExchangeColorClass(opp.longExchange)} flex items-center`}>
					{formatExchangeName(opp.longExchange)}
					<span className="text-xs ml-1 opacity-75 font-mono">
						({(opp.longRate * 100).toFixed(4)}%
						{longPredicted != null ? ` → ${(longPredicted * 100).toFixed(4)}%` : ""})
					</span>
				</span>
				<span className="text-gray-600 mx-1 shrink-0">/</span>
				<span className={`${getExchangeColorClass(opp.shortExchange)} opacity-90`}>空</span>
				<span className={`${getExchangeColorClass(opp.shortExchange)} flex items-center`}>
					{formatExchangeName(opp.shortExchange)}
					<span className="text-xs ml-1 opacity-75 font-mono">
						({(opp.shortRate * 100).toFixed(4)}%
						{shortPredicted != null ? ` → ${(shortPredicted * 100).toFixed(4)}%` : ""})
					</span>
				</span>
			</div>

			{/* Metrics Grid */}
			<div className="grid grid-cols-2 gap-3 mb-5 relative group/metrics">
				<div className="flex flex-col p-2.5 rounded-lg bg-gray-800/30 border border-gray-800/50">
					<span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">毛年化</span>
					<span className={`text-sm font-bold ${grossAprColor}`}>{opp.grossApr.toFixed(2)}%</span>
				</div>
				{opp.leverage > 1 ? (
					<div className="flex flex-col p-2.5 rounded-lg bg-gray-800/30 border border-gray-800/50">
						<span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
							杠杆年化
						</span>
						<span className="text-sm font-bold text-blue-400">{opp.leveragedApr.toFixed(2)}%</span>
					</div>
				) : (
					<div className="flex flex-col p-2.5 rounded-lg bg-gray-800/30 border border-gray-800/50">
						<span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">价差</span>
						<span className="text-sm font-bold text-gray-300">
							{opp.spreadPct.toFixed(4)}%
						</span>
					</div>
				)}

				{/* Cost Breakdown Tooltip (Shows on hover over metrics) */}
				<div className="absolute left-0 right-0 top-full mt-2 opacity-0 invisible group-hover/metrics:opacity-100 group-hover/metrics:visible transition-all duration-200 z-20 shadow-xl translate-y-1 group-hover/metrics:translate-y-0">
					<div className="flex flex-col gap-1.5 p-3 rounded-lg bg-gray-900 border border-gray-700 text-xs shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
						<div className="flex justify-between items-center">
							<span className="text-gray-400">借贷成本</span>
							<span className="text-orange-400 font-mono">{opp.borrowCostApr.toFixed(2)}%</span>
						</div>
						<div className="flex justify-between items-center">
							<span className="text-gray-400">交易成本</span>
							<span className="text-orange-400 font-mono">{opp.tradingCostApr.toFixed(2)}%</span>
						</div>
						<div className="flex justify-between items-center pt-1.5 mt-0.5 border-t border-gray-800">
							<span className="text-gray-400">价差</span>
							<span className="text-blue-300 font-mono">{opp.spreadPct.toFixed(4)}%</span>
						</div>
					</div>
				</div>
			</div>

			{/* Trade Button */}
			<div className="mt-auto pt-2 flex gap-2">
				<Link
					to={`/trade?symbol=${opp.symbol}&long=${opp.longExchange}&short=${opp.shortExchange}`}
					className="flex-1 flex items-center justify-center py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-colors duration-200 shadow-[0_0_15px_rgba(37,99,235,0.2)] hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]"
				>
					立即交易
				</Link>
				<button
					type="button"
					onClick={handleQuickTrade}
					title="快捷下单（1000 USDT）"
					className="flex items-center justify-center bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-600/30 rounded-lg px-3 transition-colors"
				>
					⚡
				</button>
			</div>
		</div>
	)
}
