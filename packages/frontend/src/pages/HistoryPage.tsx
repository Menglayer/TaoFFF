import type { AlertEvent, HedgeTrade } from "@taofff/shared"
import { ColorType, createChart, type LineData, LineSeries, type Time } from "lightweight-charts"
import { useEffect, useMemo, useRef, useState } from "react"
import { SkeletonTable } from "../components/Skeleton"
import { useSimStore } from "../stores/simStore"
import { useTradeStore } from "../stores/tradeStore"

const API = import.meta.env.DEV ? "http://localhost:8080" : ""

type TabId = "trades" | "funding" | "alerts"
type TradeFilter = "all" | "real" | "sim"

export function HistoryPage() {
	const [activeTab, setActiveTab] = useState<TabId>("trades")
	const [isLoading, setIsLoading] = useState(true)
	const [tradeFilter, setTradeFilter] = useState<TradeFilter>("all")

	const { history, fetchHistory } = useTradeStore()
	const { history: simHistory, fetchHistory: fetchSimHistory } = useSimStore()
	const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([])
	const chartContainerRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		Promise.all([fetchHistory(), fetchSimHistory()]).finally(() => setIsLoading(false))
	}, [fetchHistory, fetchSimHistory])

	useEffect(() => {
		if (activeTab === "alerts") {
			fetch(`${API}/api/alerts/history`)
				.then((r) => r.json())
				.then(setAlertEvents)
				.catch(console.error)
		}
	}, [activeTab])

	// Merge and filter history based on tradeFilter
	const filteredHistory: HedgeTrade[] = useMemo(() => {
		const realTrades = (history || []).map((t) => ({ ...t, simulated: false }))
		const simTrades = (simHistory || []).map((t) => ({ ...t, simulated: true }))

		switch (tradeFilter) {
			case "real":
				return realTrades
			case "sim":
				return simTrades
			default:
				return [...realTrades, ...simTrades].sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0))
		}
	}, [history, simHistory, tradeFilter])

	useEffect(() => {
		if (activeTab !== "funding" || !chartContainerRef.current) return

		const handleResize = () => {
			chart.applyOptions({ width: chartContainerRef.current?.clientWidth })
		}

		const chart = createChart(chartContainerRef.current, {
			layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#9ca3af" },
			grid: { vertLines: { color: "#2a2b4a" }, horzLines: { color: "#2a2b4a" } },
			width: chartContainerRef.current.clientWidth,
			height: 300,
			timeScale: {
				timeVisible: true,
				secondsVisible: false,
			},
		})

		const lineSeries = chart.addSeries(LineSeries, {
			color: "#00ff88",
			lineWidth: 2,
		})

		const trades = [...filteredHistory].sort((a, b) => {
			const timeA = a.openedAt || 0
			const timeB = b.openedAt || 0
			return timeA - timeB
		})

		let cumulative = 0
		const data: LineData<Time>[] = []

		trades.forEach((t) => {
			const funding = t.fundingEarned ?? 0
			const openedAt = t.openedAt
			if (openedAt) {
				cumulative += Number(funding)
				// Lightweight charts time needs to be seconds for unix timestamp
				data.push({ time: Math.floor(openedAt / 1000) as Time, value: cumulative })
			}
		})

		// Deduplicate exact timestamps by keeping the latest value
		const uniqueData = data.reduce((acc, curr) => {
			const existing = acc.find((item) => item.time === curr.time)
			if (existing) {
				existing.value = curr.value
			} else {
				acc.push(curr)
			}
			return acc
		}, [] as LineData<Time>[])

		if (uniqueData.length > 0) {
			lineSeries.setData(uniqueData)
			chart.timeScale().fitContent()
		}

		window.addEventListener("resize", handleResize)

		return () => {
			window.removeEventListener("resize", handleResize)
			chart.remove()
		}
	}, [activeTab, filteredHistory])

	const summary = useMemo(() => {
		const trades = filteredHistory
		const closed = trades.filter((t) => t.status === "closed")
		const totalPnl = closed.reduce((sum, t) => sum + Number(t.realizedPnl ?? 0), 0)
		const totalFunding = trades.reduce((sum, t) => sum + Number(t.fundingEarned ?? 0), 0)
		const wins = closed.filter((t) => Number(t.realizedPnl ?? 0) > 0).length
		const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0

		const avgHoldTime =
			closed.length > 0
				? closed.reduce((sum, t) => {
						const opened = t.openedAt ?? 0
						const closedTime = t.closedAt ?? opened
						return sum + (closedTime - opened)
					}, 0) / closed.length
				: 0

		return { totalPnl, totalFunding, wins, winRate, avgHoldTime, tradeCount: closed.length }
	}, [filteredHistory])

	const formatDuration = (ms: number) => {
		const seconds = Math.floor(ms / 1000)
		const hours = Math.floor(seconds / 3600)
		const minutes = Math.floor((seconds % 3600) / 60)
		return `${hours}h ${minutes}m`
	}

	const renderTabs = () => (
		<div className="flex items-center justify-between border-b border-[#2a2b4a] mb-6">
			<div className="flex">
				<button
					type="button"
					className={`px-6 py-3 font-medium text-sm transition-colors ${activeTab === "trades" ? "text-indigo-400 border-b-2 border-indigo-500" : "text-gray-400 hover:text-white"}`}
					onClick={() => setActiveTab("trades")}
				>
					交易历史
				</button>
				<button
					type="button"
					className={`px-6 py-3 font-medium text-sm transition-colors ${activeTab === "funding" ? "text-indigo-400 border-b-2 border-indigo-500" : "text-gray-400 hover:text-white"}`}
					onClick={() => setActiveTab("funding")}
				>
					资金费收益
				</button>
				<button
					type="button"
					className={`px-6 py-3 font-medium text-sm transition-colors ${activeTab === "alerts" ? "text-indigo-400 border-b-2 border-indigo-500" : "text-gray-400 hover:text-white"}`}
					onClick={() => setActiveTab("alerts")}
				>
					告警历史
				</button>
			</div>
			{activeTab !== "alerts" && (
				<div className="flex items-center gap-1 mr-2">
					{(["all", "real", "sim"] as const).map((f) => (
						<button
							key={f}
							type="button"
							onClick={() => setTradeFilter(f)}
							className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
								tradeFilter === f
									? f === "sim"
										? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
										: f === "real"
											? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
											: "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
									: "text-gray-500 hover:text-gray-300 border border-transparent"
							}`}
						>
							{f === "all" ? "全部" : f === "real" ? "真实" : "模拟"}
						</button>
					))}
				</div>
			)}
		</div>
	)

	const renderTradeHistory = () => (
		<div className="space-y-6">
			{/* Summary Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div className="bg-[#1a1b2e] border border-[#2a2b4a] rounded-xl p-5">
					<p className="text-gray-400 text-sm mb-1">总盈亏</p>
					<p
						className={`text-2xl font-bold ${summary.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
					>
						${summary.totalPnl.toFixed(4)}
					</p>
				</div>
				<div className="bg-[#1a1b2e] border border-[#2a2b4a] rounded-xl p-5">
					<p className="text-gray-400 text-sm mb-1">累计资金费收益</p>
					<p className="text-2xl font-bold text-emerald-400">${summary.totalFunding.toFixed(4)}</p>
				</div>
				<div className="bg-[#1a1b2e] border border-[#2a2b4a] rounded-xl p-5">
					<p className="text-gray-400 text-sm mb-1">胜率</p>
					<p className="text-2xl font-bold text-white">
						{summary.winRate.toFixed(1)}%{" "}
						<span className="text-sm font-normal text-gray-500">
							({summary.wins}/{summary.tradeCount})
						</span>
					</p>
				</div>
				<div className="bg-[#1a1b2e] border border-[#2a2b4a] rounded-xl p-5">
					<p className="text-gray-400 text-sm mb-1">平均持仓时长</p>
					<p className="text-2xl font-bold text-white">{formatDuration(summary.avgHoldTime)}</p>
				</div>
			</div>

			{/* Trade Table */}
			<div className="bg-[#1a1b2e] border border-[#2a2b4a] rounded-xl overflow-x-auto">
				{isLoading ? (
					<SkeletonTable rows={5} columns={8} />
				) : (
					<table className="w-full text-left min-w-[800px]">
						<thead className="bg-[#0d0e1a]/50 text-gray-400 text-xs uppercase tracking-wider border-b border-[#2a2b4a]">
							<tr>
								<th className="p-4 font-medium">类型</th>
								<th className="p-4 font-medium">ID</th>
								<th className="p-4 font-medium">交易对</th>
								<th className="p-4 font-medium">做多交易所</th>
								<th className="p-4 font-medium">做空交易所</th>
								<th className="p-4 font-medium">仓位</th>
								<th className="p-4 font-medium">开仓年化</th>
								<th className="p-4 font-medium">P&amp;L</th>
								<th className="p-4 font-medium">Funding</th>
								<th className="p-4 font-medium">状态</th>
								<th className="p-4 font-medium">开仓时间</th>
								<th className="p-4 font-medium">平仓时间</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-[#2a2b4a] text-sm">
							{filteredHistory.length > 0 ? (
								filteredHistory.map((t) => {
									const isSim = !!t.simulated
									const id = t.id?.substring(0, 8) || "---"
									const symbol = t.symbol
									const legA = t.legA || {}
									const legB = t.legB || {}

									let longEx = "---"
									let shortEx = "---"
									if (legA.side) {
										longEx = legA.side === "long" ? legA.exchange : legB.exchange
										shortEx = legA.side === "short" ? legA.exchange : legB.exchange
									}

									const size = legA.size ?? 0
									const entryApr = t.netAprAtEntry ?? 0
									const pnl = t.realizedPnl ?? 0
									const funding = t.fundingEarned ?? 0
									const status = t.status || "unknown"
									const opened = t.openedAt
									const closed = t.closedAt
									const openedStr = opened ? new Date(opened).toLocaleString() : "-"
									const closedStr = closed ? new Date(closed).toLocaleString() : "-"

									const statusColor =
										status === "open"
											? "text-blue-400 border-blue-400/30 bg-blue-400/10"
											: status === "partial"
												? "text-yellow-400 border-yellow-400/30 bg-yellow-400/10"
												: "text-gray-400 border-gray-400/30 bg-gray-400/10"

									return (
										<tr key={t.id} className="hover:bg-[#2a2b4a]/30 transition-colors">
											<td className="p-4">
												{isSim ? (
													<span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
														SIM
													</span>
												) : (
													<span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
														真实
													</span>
												)}
											</td>
											<td className="p-4 text-gray-500 font-mono">{id}</td>
											<td className="p-4 font-medium text-white">{symbol}</td>
											<td className="p-4 text-gray-300">{longEx}</td>
											<td className="p-4 text-gray-300">{shortEx}</td>
											<td className="p-4 text-gray-300">${Number(size).toFixed(2)}</td>
											<td className="p-4 text-gray-300">{Number(entryApr).toFixed(2)}%</td>
											<td
												className={`p-4 font-medium ${pnl > 0 ? "text-emerald-400" : pnl < 0 ? "text-red-400" : "text-gray-400"}`}
											>
												${Number(pnl).toFixed(4)}
											</td>
											<td className="p-4 text-emerald-400">${Number(funding).toFixed(4)}</td>
											<td className="p-4">
												<span className={`px-2 py-1 rounded text-xs border ${statusColor}`}>
													{status === "open"
														? "持有中"
														: status === "closed"
															? "已平仓"
															: status.toUpperCase()}
												</span>
											</td>
											<td className="p-4 text-gray-400 text-xs">{openedStr}</td>
											<td className="p-4 text-gray-400 text-xs">{closedStr}</td>
										</tr>
									)
								})
							) : (
								<tr>
									<td colSpan={12} className="p-8 text-center text-gray-500">
										暂无交易历史。
									</td>
								</tr>
							)}
						</tbody>
					</table>
				)}
			</div>
		</div>
	)

	const renderFundingEarned = () => (
		<div className="space-y-6">
			{/* Chart */}
			<div className="bg-[#1a1b2e] border border-[#2a2b4a] rounded-xl p-5">
				<h3 className="text-white font-medium mb-4">累计资金费收益</h3>
				{filteredHistory.filter((t) => (t.fundingEarned ?? 0) > 0).length === 0 ? (
					<div className="h-[300px] flex items-center justify-center text-gray-500">
						暂无资金费收益数据。
					</div>
				) : (
					<div ref={chartContainerRef} className="w-full h-[300px]" />
				)}
			</div>

			{/* Table */}
			<div className="bg-[#1a1b2e] border border-[#2a2b4a] rounded-xl overflow-x-auto">
				{isLoading ? (
					<SkeletonTable rows={5} columns={6} />
				) : (
					<table className="w-full text-left min-w-[600px]">
						<thead className="bg-[#0d0e1a]/50 text-gray-400 text-xs uppercase tracking-wider border-b border-[#2a2b4a]">
							<tr>
								<th className="p-4 font-medium">类型</th>
								<th className="p-4 font-medium">交易对</th>
								<th className="p-4 font-medium">做多交易所</th>
								<th className="p-4 font-medium">做空交易所</th>
								<th className="p-4 font-medium">资金费收益</th>
								<th className="p-4 font-medium">状态</th>
								<th className="p-4 font-medium">持仓时长</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-[#2a2b4a] text-sm">
							{filteredHistory.length > 0 ? (
								filteredHistory.map((t) => {
									const isSim = !!t.simulated
									const symbol = t.symbol
									const legA = t.legA || {}
									const legB = t.legB || {}

									let longEx = "---"
									let shortEx = "---"
									if (legA.side) {
										longEx = legA.side === "long" ? legA.exchange : legB.exchange
										shortEx = legA.side === "short" ? legA.exchange : legB.exchange
									}

									const funding = t.fundingEarned ?? 0
									const status = t.status || "unknown"
									const opened = t.openedAt ?? 0
									const closed = t.closedAt ?? Date.now()
									const durationStr = opened ? formatDuration(closed - opened) : "-"

									const statusColor =
										status === "open"
											? "text-blue-400 border-blue-400/30 bg-blue-400/10"
											: status === "partial"
												? "text-yellow-400 border-yellow-400/30 bg-yellow-400/10"
												: "text-gray-400 border-gray-400/30 bg-gray-400/10"

									return (
										<tr key={t.id} className="hover:bg-[#2a2b4a]/30 transition-colors">
											<td className="p-4">
												{isSim ? (
													<span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
														SIM
													</span>
												) : (
													<span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
														真实
													</span>
												)}
											</td>
											<td className="p-4 font-medium text-white">{symbol}</td>
											<td className="p-4 text-gray-300">{longEx}</td>
											<td className="p-4 text-gray-300">{shortEx}</td>
											<td className="p-4 text-emerald-400 font-medium">
												${Number(funding).toFixed(4)}
											</td>
											<td className="p-4">
												<span className={`px-2 py-1 rounded text-xs border ${statusColor}`}>
													{status === "open"
														? "持有中"
														: status === "closed"
															? "已平仓"
															: status.toUpperCase()}
												</span>
											</td>
											<td className="p-4 text-gray-400">{durationStr}</td>
										</tr>
									)
								})
							) : (
								<tr>
									<td colSpan={7} className="p-8 text-center text-gray-500">
										暂无资金费数据。
									</td>
								</tr>
							)}
						</tbody>
					</table>
				)}
			</div>
		</div>
	)

	const renderAlertHistory = () => (
		<div className="bg-[#1a1b2e] border border-[#2a2b4a] rounded-xl overflow-x-auto">
			{isLoading ? (
				<SkeletonTable rows={5} columns={8} />
			) : (
				<table className="w-full text-left min-w-[800px]">
					<thead className="bg-[#0d0e1a]/50 text-gray-400 text-xs uppercase tracking-wider border-b border-[#2a2b4a]">
						<tr>
							<th className="p-4 font-medium">规则名称</th>
							<th className="p-4 font-medium">指标</th>
							<th className="p-4 font-medium">条件</th>
							<th className="p-4 font-medium">实际值</th>
							<th className="p-4 font-medium">交易对</th>
							<th className="p-4 font-medium">交易所</th>
							<th className="p-4 font-medium">消息</th>
							<th className="p-4 font-medium">触发时间</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-[#2a2b4a] text-sm">
						{alertEvents.length > 0 ? (
							alertEvents.map((a) => (
								<tr key={a.id} className="hover:bg-[#2a2b4a]/30 transition-colors">
									<td className="p-4 font-medium text-white">{a.ruleName}</td>
									<td className="p-4 text-gray-300">{a.metric}</td>
									<td className="p-4 text-gray-300">
										{a.operator} {a.threshold}
									</td>
									<td className="p-4 text-yellow-400 font-medium">
										{Number(a.actualValue).toFixed(4)}
									</td>
									<td className="p-4 text-gray-300">{a.symbol || "---"}</td>
									<td className="p-4 text-gray-300">{a.exchange || "---"}</td>
									<td className="p-4 text-gray-400 text-xs max-w-xs truncate" title={a.message}>
										{a.message}
									</td>
									<td className="p-4 text-gray-500 text-xs">
										{new Date(a.triggeredAt).toLocaleString()}
									</td>
								</tr>
							))
						) : (
							<tr>
								<td colSpan={8} className="p-8 text-center text-gray-500">
									暂无告警记录。
								</td>
							</tr>
						)}
					</tbody>
				</table>
			)}
		</div>
	)

	return (
		<div className="p-6">
			<h2 className="text-2xl font-bold text-white mb-6">历史与盈亏</h2>
			{renderTabs()}

			{activeTab === "trades" && renderTradeHistory()}
			{activeTab === "funding" && renderFundingEarned()}
			{activeTab === "alerts" && renderAlertHistory()}
		</div>
	)
}
