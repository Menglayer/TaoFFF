import { DataQuality, type Exchange } from "@taofff/shared"
import { useEffect, useMemo, useState } from "react"
import { FilterBar } from "../components/FilterBar"
import { OpportunityPanel } from "../components/OpportunityPanel"
import { SkeletonTable } from "../components/Skeleton"
import { useRateStore } from "../stores/rateStore"
import {
	ALL_EXCHANGES,
	EXCHANGE_BG_COLOR,
	EXCHANGE_DISPLAY_NAME,
	EXCHANGE_TEXT_COLOR,
} from "../utils/exchange"

// Time formatter
function formatTimeRemaining(ms: number) {
	if (ms <= 0) return "00:00:00"
	const totalSeconds = Math.floor(ms / 1000)
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60
	return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
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

function getExchangeColorClass(exchange: string) {
	return EXCHANGE_TEXT_COLOR[exchange as Exchange] ?? "text-gray-300"
}

function getExchangeBgClass(exchange: string) {
	return EXCHANGE_BG_COLOR[exchange as Exchange] ?? "bg-gray-800 text-gray-300"
}

export function FundingRatePage() {
	const { rates, connected, loading, error, connect, disconnect } = useRateStore()
	const [searchQuery, setSearchQuery] = useState("")
	const [enabledExchanges, setEnabledExchanges] = useState<Record<string, boolean>>(
		Object.fromEntries(ALL_EXCHANGES.map((exchange) => [exchange, true])),
	)

	const [sortConfig, setSortConfig] = useState<{
		key: string
		exchange?: string
		direction: "asc" | "desc"
	} | null>(null)

	useEffect(() => {
		connect()
		return () => disconnect()
	}, [connect, disconnect])

	const [now, setNow] = useState(Date.now())
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000)
		return () => clearInterval(timer)
	}, [])

	const exchangesList = ALL_EXCHANGES.map((exchange) => ({
		id: exchange,
		label: EXCHANGE_DISPLAY_NAME[exchange],
	}))

	const handleToggleExchange = (id: string) => {
		setEnabledExchanges((prev) => ({ ...prev, [id]: !prev[id] }))
	}

	const handleSort = (key: string, exchange?: string) => {
		setSortConfig((prev) => {
			if (prev?.key === key && prev?.exchange === exchange) {
				return { ...prev, direction: prev.direction === "asc" ? "desc" : "asc" }
			}
			return { key, exchange, direction: "desc" }
		})
	}

	const filteredSymbols = useMemo(() => {
		return Object.keys(rates).filter((symbol) =>
			symbol.toLowerCase().includes(searchQuery.toLowerCase()),
		)
	}, [rates, searchQuery])

	const sortedSymbols = useMemo(() => {
		if (!sortConfig) return filteredSymbols

		return [...filteredSymbols].sort((a, b) => {
			let valA: string | number = 0
			let valB: string | number = 0

			if (sortConfig.key === "symbol") {
				valA = a
				valB = b
			} else if (sortConfig.exchange) {
				const rateA = rates[a]?.[sortConfig.exchange]
				const rateB = rates[b]?.[sortConfig.exchange]

				if (sortConfig.key === "rate") {
					valA = rateA?.rate ?? -Infinity
					valB = rateB?.rate ?? -Infinity
				} else if (sortConfig.key === "apr") {
					valA = rateA?.apr ?? -Infinity
					valB = rateB?.apr ?? -Infinity
				} else if (sortConfig.key === "settlement") {
					valA = rateA?.nextSettlementTs ?? Infinity
					valB = rateB?.nextSettlementTs ?? Infinity
				}
			}

			if (valA === valB) return 0
			const comparison = valA > valB ? 1 : -1
			return sortConfig.direction === "asc" ? comparison : -comparison
		})
	}, [filteredSymbols, rates, sortConfig])

	const activeExchanges = exchangesList.filter((ex) => enabledExchanges[ex.id])

	if (loading) {
		return (
			<div className="flex flex-col h-full space-y-6 p-4 md:p-6 animate-in fade-in duration-500">
				<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
					<h1 className="text-2xl font-bold tracking-tight text-gray-100 flex items-center gap-3">
						Live Funding Rates
					</h1>
				</div>
				<SkeletonTable rows={10} columns={5} />
			</div>
		)
	}

	if (!connected && Object.keys(rates).length === 0) {
		return (
			<div className="flex flex-col h-full space-y-6 p-4 md:p-6 animate-in fade-in duration-500">
				<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
					<h1 className="text-2xl font-bold tracking-tight text-gray-100">Live Funding Rates</h1>
				</div>
				<div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
					<p className="font-medium mb-1">Unable to load live rates.</p>
					<p className="text-sm text-red-200/90">
						{error ??
							"Backend connection failed. Start backend on http://localhost:8080 and refresh."}
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col h-full space-y-6 p-4 md:p-6 animate-in fade-in duration-500">
			<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
				<h1 className="text-2xl font-bold tracking-tight text-gray-100 flex items-center gap-3">
					Live Funding Rates
					<div
						className={`flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full border ${connected ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}
					>
						<div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
						{connected ? "WS Connected" : "Disconnected"}
					</div>
				</h1>
			</div>

			<FilterBar
				exchanges={exchangesList.map((ex) => ({
					...ex,
					enabled: !!enabledExchanges[ex.id],
					colorClass: getExchangeBgClass(ex.id),
				}))}
				onToggleExchange={handleToggleExchange}
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				symbolCount={sortedSymbols.length}
			/>

			<OpportunityPanel />

			{sortedSymbols.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-gray-900/30 rounded-xl border border-gray-800">
					<p>No matching symbols found.</p>
				</div>
			) : (
				<div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900/50 shadow-2xl backdrop-blur-sm relative">
					<div className="md:hidden absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-900/80 to-transparent pointer-events-none z-20" />
					<div className="md:hidden absolute right-2 top-2 text-[10px] text-gray-500 z-30 pointer-events-none animate-pulse">
						Scroll →
					</div>
					<table className="w-full text-left text-sm text-gray-300">
						<thead className="bg-gray-950/80 text-xs uppercase text-gray-400 sticky top-0 z-10 backdrop-blur-md">
							<tr>
								<th
									className="px-6 py-4 font-semibold tracking-wider cursor-pointer hover:text-gray-200 transition-colors"
									onClick={() => handleSort("symbol")}
								>
									Symbol{" "}
									{sortConfig?.key === "symbol" && (sortConfig.direction === "asc" ? "↑" : "↓")}
								</th>

								{activeExchanges.map((ex) => (
									<th
										key={ex.id}
										colSpan={3}
										className="px-6 py-4 border-l border-gray-800/50 font-semibold tracking-wider"
									>
										<div
											className={`flex items-center justify-center gap-2 ${getExchangeColorClass(ex.id)}`}
										>
											{ex.label}
										</div>
									</th>
								))}
							</tr>
							<tr className="border-b border-gray-800">
								<th className="px-6 py-2 bg-gray-950/40"></th>
								{activeExchanges.map((ex) => (
									<th
										key={ex.id}
										colSpan={3}
										className="px-0 py-0 border-l border-gray-800/50 bg-gray-950/40"
									>
										<div className="grid grid-cols-3 divide-x divide-gray-800/30 text-[10px] text-center text-gray-500">
											<div
												className="py-2 cursor-pointer hover:bg-gray-800/50 transition-colors"
												onClick={() => handleSort("rate", ex.id)}
											>
												RATE%{" "}
												{sortConfig?.key === "rate" &&
													sortConfig?.exchange === ex.id &&
													(sortConfig.direction === "asc" ? "↑" : "↓")}
											</div>
											<div
												className="py-2 cursor-pointer hover:bg-gray-800/50 transition-colors"
												onClick={() => handleSort("apr", ex.id)}
											>
												APR%{" "}
												{sortConfig?.key === "apr" &&
													sortConfig?.exchange === ex.id &&
													(sortConfig.direction === "asc" ? "↑" : "↓")}
											</div>
											<div
												className="py-2 cursor-pointer hover:bg-gray-800/50 transition-colors"
												onClick={() => handleSort("settlement", ex.id)}
											>
												COUNTDOWN{" "}
												{sortConfig?.key === "settlement" &&
													sortConfig?.exchange === ex.id &&
													(sortConfig.direction === "asc" ? "↑" : "↓")}
											</div>
										</div>
									</th>
								))}
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-800/50 font-mono text-[13px]">
							{sortedSymbols.map((symbol) => (
								<tr key={symbol} className="hover:bg-gray-800/30 transition-colors group">
									<td className="px-6 py-4 whitespace-nowrap">
										<div className="font-bold text-gray-200 font-sans tracking-wide flex items-center gap-2">
											{searchQuery
												? symbol.split(new RegExp(`(${searchQuery})`, "gi")).map((part, i) =>
														part.toLowerCase() === searchQuery.toLowerCase() ? (
															<span key={i} className="bg-blue-500/30 text-blue-300">
																{part}
															</span>
														) : (
															part
														),
													)
												: symbol}
										</div>
									</td>

									{activeExchanges.map((ex) => {
										const rateData = rates[symbol]?.[ex.id]

										if (!rateData) {
											return (
												<td
													key={ex.id}
													colSpan={3}
													className="px-6 py-4 border-l border-gray-800/50 text-center text-gray-600"
												>
													-
												</td>
											)
										}

										const isPositive = rateData.rate > 0
										const isHigh = Math.abs(rateData.apr) > 20
										const colorClass = isPositive
											? "text-green-400"
											: rateData.rate < 0
												? "text-red-400"
												: "text-gray-400"
										const weightClass = isHigh ? "font-bold" : "font-medium"
										const timeRemaining = Math.max(0, rateData.nextSettlementTs - now)

										return (
											<td key={ex.id} colSpan={3} className="px-0 py-0 border-l border-gray-800/50">
												<div className="grid grid-cols-3 divide-x divide-gray-800/10 text-center h-full min-w-[200px]">
													<div
														className={`py-4 px-2 flex items-center justify-center gap-1.5 ${colorClass} ${weightClass}`}
													>
														<div
															className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getQualityColor(rateData.quality)}`}
														/>
														{(rateData.rate * 100).toFixed(4)}%
													</div>
													<div
														className={`py-4 px-2 flex items-center justify-center ${colorClass} ${weightClass}`}
													>
														{rateData.apr.toFixed(2)}%
													</div>
													<div className="py-4 px-2 flex items-center justify-center text-gray-500">
														{formatTimeRemaining(timeRemaining)}
													</div>
												</div>
											</td>
										)
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	)
}
