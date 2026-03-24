export function SkeletonCard({ count = 1 }: { count?: number }) {
	return (
		<>
			{Array.from({ length: count }).map((_, i) => (
				<div
					key={`skeleton-card-${i}`}
					className="h-48 w-full animate-pulse rounded-xl bg-gray-900 p-6 shadow-md border border-gray-800 flex flex-col justify-between"
				>
					<div className="h-6 w-1/3 rounded bg-gray-800" />
					<div className="space-y-3">
						<div className="h-4 w-full rounded bg-gray-800" />
						<div className="h-4 w-5/6 rounded bg-gray-800" />
						<div className="h-4 w-4/6 rounded bg-gray-800" />
					</div>
				</div>
			))}
		</>
	)
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
	return (
		<div className="w-full overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-sm">
			<div className="flex bg-gray-950 px-6 py-4 border-b border-gray-800">
				{Array.from({ length: columns }).map((_, i) => (
					<div
						key={`skeleton-header-${i}`}
						className="h-4 flex-1 mr-4 animate-pulse rounded bg-gray-800"
					/>
				))}
			</div>
			<div className="px-6 py-2">
				{Array.from({ length: rows }).map((_, i) => (
					<div
						key={`skeleton-row-${i}`}
						className="flex py-3 border-b border-gray-800/50 last:border-0"
					>
						{Array.from({ length: columns }).map((_, j) => (
							<div
								key={`skeleton-cell-${i}-${j}`}
								className="h-5 flex-1 mr-4 animate-pulse rounded bg-gray-800"
							/>
						))}
					</div>
				))}
			</div>
		</div>
	)
}
