import { type Exchange, type LoopConfig, LoopStatus } from "@taofff/shared"
import { useLoopStore } from "../stores/loopStore"
import { EXCHANGE_DISPLAY_NAME, EXCHANGE_TEXT_COLOR } from "../utils/exchange"

function getExchangeColorClass(exchange: Exchange | string) {
	return EXCHANGE_TEXT_COLOR[exchange as Exchange] ?? "text-gray-300"
}

function formatExchangeName(exchange: Exchange | string) {
	return EXCHANGE_DISPLAY_NAME[exchange as Exchange] ?? exchange.toString()
}

function StatusBadge({ status }: { status: LoopStatus }) {
	if (status === LoopStatus.Running) {
		return (
			<span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-green-500/20 text-green-400 border border-green-500/30">
				运行中
			</span>
		)
	}
	if (status === LoopStatus.Paused) {
		return (
			<span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
				已暂停
			</span>
		)
	}
	return (
		<span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-gray-500/20 text-gray-400 border border-gray-500/30">
			已停止
		</span>
	)
}

export function LoopCard({ loop }: { loop: LoopConfig }) {
	const { startLoop, pauseLoop, stopLoop, deleteLoop } = useLoopStore()

	// Calc visualization bounds
	// We want to visualize spread relative to [exit - buffer, entry + buffer]
	const spread = loop.currentSpread ?? 0

	// Make the scale reasonable (like +/- a few percentage points around thresholds)
	const rangeMargin = Math.max(0.5, (loop.entryThresholdApr - loop.exitThresholdApr) * 0.5)
	const minApr = loop.exitThresholdApr - rangeMargin
	const maxApr = loop.entryThresholdApr + rangeMargin
	const totalRange = maxApr - minApr

	const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val))
	const getPercent = (val: number) => ((clamp(val, minApr, maxApr) - minApr) / totalRange) * 100

	const entryPct = getPercent(loop.entryThresholdApr)
	const exitPct = getPercent(loop.exitThresholdApr)
	const spreadPct = getPercent(spread)

	// Status effects
	const isAboveEntry = spread > loop.entryThresholdApr
	const isBelowExit = spread < loop.exitThresholdApr

	const markerGlow = isAboveEntry
		? "bg-green-400 shadow-[0_0_10px_rgba(74,222,128,1)]"
		: isBelowExit
			? "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,1)]"
			: "bg-blue-400"

	return (
		<div className="relative flex flex-col p-5 bg-[#1a1b2e] border border-[#2a2b4a] rounded-xl shadow-lg group">
			{/* Top Header */}
			<div className="flex items-center justify-between mb-3">
				<div className="flex items-center gap-3">
					<h3 className="text-xl font-bold tracking-tight text-white">{loop.symbol}</h3>
					<StatusBadge status={loop.status} />
				</div>
				<button
					type="button"
					onClick={() => deleteLoop(loop.id)}
					className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
					title="删除循环"
				>
					<svg
						className="w-4 h-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						role="img"
						aria-label="Delete loop"
					>
						<title>Delete loop</title>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
						/>
					</svg>
				</button>
			</div>

			{/* Exchanges */}
			<div className="flex items-center gap-2 text-sm font-medium bg-[#0d0e1a]/50 p-2.5 rounded-lg mb-4 border border-[#2a2b4a]/60">
				<span className={getExchangeColorClass(loop.exchangeA)}>
					{formatExchangeName(loop.exchangeA)}
				</span>
				<span className="text-gray-500">↔</span>
				<span className={getExchangeColorClass(loop.exchangeB)}>
					{formatExchangeName(loop.exchangeB)}
				</span>
			</div>

			{/* Threshold Visualization */}
			<div className="mb-5 p-3 bg-[#0d0e1a]/30 rounded-lg border border-[#2a2b4a]/30">
				<div className="flex justify-between text-xs font-semibold text-gray-400 mb-2">
					<div className="flex flex-col">
						<span>平仓</span>
						<span className="text-red-400">{loop.exitThresholdApr.toFixed(2)}%</span>
					</div>
					<div className="flex flex-col items-center">
						<span>当前</span>
						<span
							className={`text-sm ${isAboveEntry ? "text-green-400" : isBelowExit ? "text-red-400" : "text-blue-400"} font-bold`}
						>
							{loop.currentSpread !== null ? `${loop.currentSpread.toFixed(2)}%` : "—"}
						</span>
					</div>
					<div className="flex flex-col items-end">
						<span>开仓</span>
						<span className="text-green-400">{loop.entryThresholdApr.toFixed(2)}%</span>
					</div>
				</div>

				<div className="relative h-2 bg-gray-800 rounded-full mt-3">
					{/* Zones */}
					<div
						className="absolute top-0 bottom-0 left-0 bg-red-900/30 rounded-l-full"
						style={{ width: `${exitPct}%` }}
					/>
					<div
						className="absolute top-0 bottom-0 right-0 bg-green-900/30 rounded-r-full"
						style={{ left: `${entryPct}%` }}
					/>

					{/* Threshold Lines */}
					<div
						className="absolute top-[-4px] bottom-[-4px] w-0.5 bg-red-500"
						style={{ left: `${exitPct}%` }}
					/>
					<div
						className="absolute top-[-4px] bottom-[-4px] w-0.5 bg-green-500"
						style={{ left: `${entryPct}%` }}
					/>

					{/* Current Spread Marker */}
					{loop.currentSpread !== null && (
						<div
							className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white ${markerGlow} transition-all duration-300`}
							style={{ left: `${spreadPct}%` }}
						/>
					)}
				</div>
			</div>

			{/* Info Row */}
			<div className="flex items-center justify-between mb-5">
				<div className="text-sm">
					<span className="text-gray-400 mr-2">仓位：</span>
					<span className="font-semibold text-white">
						{loop.sizeUsdt} USDT <span className="text-blue-400">× {loop.leverage}x</span>
					</span>
				</div>
				{loop.activeTradeId && (
					<div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-blue-400 text-xs font-bold uppercase tracking-wider">
						<span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
						持仓中
					</div>
				)}
			</div>

			{/* Actions */}
			<div className="mt-auto flex gap-2">
				{loop.status === LoopStatus.Stopped && (
					<button
						type="button"
						onClick={() => startLoop(loop.id)}
						className="flex-1 py-2 px-4 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/50 font-bold text-sm rounded-lg transition-colors"
					>
						启动循环
					</button>
				)}

				{loop.status === LoopStatus.Running && (
					<>
						<button
							type="button"
							onClick={() => pauseLoop(loop.id)}
							className="flex-1 py-2 px-4 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-600/50 font-bold text-sm rounded-lg transition-colors"
						>
							暂停
						</button>
						<button
							type="button"
							onClick={() => stopLoop(loop.id)}
							className="flex-1 py-2 px-4 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/50 font-bold text-sm rounded-lg transition-colors"
						>
							停止
						</button>
					</>
				)}

				{loop.status === LoopStatus.Paused && (
					<>
						<button
							type="button"
							onClick={() => startLoop(loop.id)}
							className="flex-1 py-2 px-4 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/50 font-bold text-sm rounded-lg transition-colors"
						>
							继续
						</button>
						<button
							type="button"
							onClick={() => stopLoop(loop.id)}
							className="flex-1 py-2 px-4 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/50 font-bold text-sm rounded-lg transition-colors"
						>
							停止
						</button>
					</>
				)}
			</div>
		</div>
	)
}
