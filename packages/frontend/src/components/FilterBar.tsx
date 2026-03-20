export interface FilterBarProps {
	exchanges: { id: string; label: string; enabled: boolean; colorClass: string }[]
	onToggleExchange: (id: string) => void
	searchQuery: string
	onSearchChange: (query: string) => void
	symbolCount: number
}

export function FilterBar({
	exchanges,
	onToggleExchange,
	searchQuery,
	onSearchChange,
	symbolCount,
}: FilterBarProps) {
	return (
		<div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6 bg-gray-900/50 p-4 rounded-xl border border-gray-800 backdrop-blur-sm">
			<div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
				<span className="text-sm font-medium text-gray-400 mr-2">Exchanges:</span>
				{exchanges.map((ex) => (
					<button
						type="button"
						key={ex.id}
						onClick={() => onToggleExchange(ex.id)}
						className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border
              ${
								ex.enabled
									? `${ex.colorClass} border-transparent shadow-[0_0_15px_rgba(255,255,255,0.05)]`
									: "bg-gray-800/50 text-gray-500 border-gray-700/50 hover:bg-gray-800"
							}`}
					>
						{ex.label}
					</button>
				))}
			</div>

			<div className="flex items-center gap-4 w-full md:w-auto">
				<div className="relative w-full md:w-64">
					<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
						<svg
							className="h-4 w-4 text-gray-400"
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							role="img"
							aria-label="Search icon"
						>
							<title>Search icon</title>
							<circle cx="11" cy="11" r="8" />
							<path d="m21 21-4.3-4.3" />
						</svg>
					</div>
					<input
						type="text"
						className="block w-full pl-10 pr-3 py-2 border border-gray-700 rounded-lg leading-5 bg-gray-900/50 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
						placeholder="Search symbol (e.g. BTC)..."
						value={searchQuery}
						onChange={(e) => onSearchChange(e.target.value)}
					/>
				</div>

				<div className="text-xs text-gray-500 font-mono whitespace-nowrap bg-gray-900 px-3 py-2 rounded-lg border border-gray-800">
					{symbolCount} matching
				</div>
			</div>
		</div>
	)
}
