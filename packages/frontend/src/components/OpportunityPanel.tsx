import { DEFAULTS } from "@taofff/shared"
import { useMemo, useState } from "react"
import { useRateStore } from "../stores/rateStore"
import { OpportunityCard } from "./OpportunityCard"

export function OpportunityPanel() {
	const { opportunities } = useRateStore()
	const [minNetApr, setMinNetApr] = useState<number>(DEFAULTS.MIN_NET_APR_PCT)

	// Default to expanded if we have opportunities initially, otherwise false
	// We'll just manage state, but it might be better to start expanded if opportunities exist.
	const [isExpanded, setIsExpanded] = useState(true)

	const filteredOpps = useMemo(() => {
		return opportunities
			.filter((opp) => opp.netApr >= minNetApr)
			.sort((a, b) => b.netApr - a.netApr)
			.slice(0, 20)
	}, [opportunities, minNetApr])

	if (opportunities.length === 0) {
		return null
	}

	const bestNetApr =
		opportunities.length > 0 ? Math.max(...opportunities.map((o) => o.netApr)).toFixed(2) : "0.00"

	return (
		<div className="flex flex-col border border-gray-800 bg-gray-900/40 rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm transition-all duration-300">
			{/* Header / Summary Bar */}
			<button
				type="button"
				className="flex items-center justify-between p-4 bg-gray-950/80 cursor-pointer hover:bg-gray-900 transition-colors w-full text-left"
				onClick={() => setIsExpanded(!isExpanded)}
			>
				<div className="flex items-center gap-4">
					<div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20 text-red-400 font-black animate-pulse">
						🔥
					</div>
					<h2 className="text-lg font-bold text-gray-200 tracking-tight">
						{filteredOpps.length} Opportunities Found
					</h2>
					<span className="px-3 py-1 text-xs font-bold rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
						Best: {bestNetApr}% APR
					</span>
				</div>

				<div className="flex items-center gap-6">
					<button
						type="button"
						className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-gray-800 transition-colors"
						onClick={(e) => {
							e.stopPropagation()
							setIsExpanded(!isExpanded)
						}}
					>
						<svg
							className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							role="img"
							aria-label="Toggle expansion"
						>
							<title>Toggle expansion</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</button>
				</div>
			</button>

			{/* Expanded Content */}
			{isExpanded && (
				<div className="p-5 border-t border-gray-800/60 bg-gray-900/20">
					{/* Filters */}
					<div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800/50">
						<div className="flex items-center gap-4">
							<label htmlFor="min-apr-slider" className="text-sm font-medium text-gray-400">
								Min Net APR:
							</label>
							<div className="flex items-center gap-3">
								<input
									id="min-apr-slider"
									type="range"
									min="0"
									max="50"
									step="0.5"
									value={minNetApr}
									onChange={(e) => setMinNetApr(parseFloat(e.target.value))}
									className="w-32 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
								/>
								<span className="text-sm font-bold text-gray-300 w-12">{minNetApr}%</span>
							</div>
						</div>
						<div className="text-xs text-gray-500 font-medium">
							Showing top {filteredOpps.length} results
						</div>
					</div>

					{/* Grid */}
					{filteredOpps.length > 0 ? (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
							{filteredOpps.map((opp) => (
								<OpportunityCard key={opp.id} opp={opp} />
							))}
						</div>
					) : (
						<div className="flex flex-col items-center justify-center py-10 text-gray-500">
							<p>No opportunities matching your criteria.</p>
							<button
								type="button"
								className="mt-2 text-sm text-blue-400 hover:text-blue-300 underline"
								onClick={() => setMinNetApr(0)}
							>
								Clear Filters
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	)
}
