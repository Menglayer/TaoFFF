import { Exchange, type LoopConfig } from "@taofff/shared"
import type React from "react"
import { useEffect, useState } from "react"
import { LoopCard } from "../components/LoopCard"
import { SkeletonCard } from "../components/Skeleton"
import { useLoopStore } from "../stores/loopStore"
import { wsClient } from "../ws/client"

export function LoopMonitorPage() {
	const { loops, fetchLoops, createLoop, loading, error, updateFromWs } = useLoopStore()

	const [isFormOpen, setIsFormOpen] = useState(false)
	const [symbol, setSymbol] = useState("BTC/USDT")
	const [exchangeA, setExchangeA] = useState<Exchange>(Exchange.Binance)
	const [exchangeB, setExchangeB] = useState<Exchange>(Exchange.Hyperliquid)
	const [entryThresholdApr, setEntryThresholdApr] = useState<number>(15)
	const [exitThresholdApr, setExitThresholdApr] = useState<number>(2)
	const [sizeUsdt, setSizeUsdt] = useState<number>(1000)
	const [leverage, setLeverage] = useState<number>(3)

	useEffect(() => {
		fetchLoops()

		const unsub = wsClient.onMessage((msg) => {
			if (msg.type === "full" && msg.loops) {
				updateFromWs(msg.loops, true)
			} else if (msg.type === "delta" && msg.loops) {
				updateFromWs(msg.loops as Partial<LoopConfig>[], false)
			}
		})

		return unsub
	}, [fetchLoops, updateFromWs])

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault()
		await createLoop({
			symbol,
			exchangeA,
			exchangeB,
			entryThresholdApr,
			exitThresholdApr,
			sizeUsdt,
			leverage,
		})
		setIsFormOpen(false)
	}

	return (
		<div className="p-6 max-w-7xl mx-auto space-y-6">
			<div className="flex items-center justify-between">
				<h2 className="text-3xl font-bold text-white tracking-tight">Loop Monitor</h2>
			</div>

			{error && (
				<div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg">
					{error}
				</div>
			)}

			{/* Form Section */}
			<div className="bg-[#1a1b2e] border border-[#2a2b4a] rounded-xl overflow-hidden shadow-lg">
				<button
					type="button"
					onClick={() => setIsFormOpen(!isFormOpen)}
					className="w-full flex items-center justify-between p-5 text-left hover:bg-[#2a2b4a]/50 transition-colors"
				>
					<span className="text-lg font-semibold text-white">Create New Loop</span>
					<span className="text-gray-400 bg-[#2a2b4a] w-8 h-8 rounded-full flex items-center justify-center font-bold">
						{isFormOpen ? "−" : "+"}
					</span>
				</button>

				{isFormOpen && (
					<form onSubmit={handleCreate} className="p-5 border-t border-[#2a2b4a] bg-[#0d0e1a]/30">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
							<div className="space-y-1.5">
								<label htmlFor="symbol-input" className="text-sm font-medium text-gray-400">
									Symbol
								</label>
								<input
									id="symbol-input"
									type="text"
									value={symbol}
									onChange={(e) => setSymbol(e.target.value.toUpperCase())}
									className="w-full bg-[#0d0e1a] border border-[#2a2b4a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
									required
								/>
							</div>
							<div className="space-y-1.5">
								<label htmlFor="exchange-a-select" className="text-sm font-medium text-gray-400">
									Exchange A
								</label>
								<select
									id="exchange-a-select"
									value={exchangeA}
									onChange={(e) => setExchangeA(e.target.value as Exchange)}
									className="w-full bg-[#0d0e1a] border border-[#2a2b4a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
								>
									{Object.values(Exchange).map((ex) => (
										<option key={ex} value={ex}>
											{ex}
										</option>
									))}
								</select>
							</div>
							<div className="space-y-1.5">
								<label htmlFor="exchange-b-select" className="text-sm font-medium text-gray-400">
									Exchange B
								</label>
								<select
									id="exchange-b-select"
									value={exchangeB}
									onChange={(e) => setExchangeB(e.target.value as Exchange)}
									className="w-full bg-[#0d0e1a] border border-[#2a2b4a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
								>
									{Object.values(Exchange).map((ex) => (
										<option key={ex} value={ex}>
											{ex}
										</option>
									))}
								</select>
							</div>
							<div className="space-y-1.5">
								<label htmlFor="size-input" className="text-sm font-medium text-gray-400">
									Size (USDT)
								</label>
								<input
									id="size-input"
									type="number"
									value={sizeUsdt}
									onChange={(e) => setSizeUsdt(Number(e.target.value))}
									min="10"
									className="w-full bg-[#0d0e1a] border border-[#2a2b4a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
									required
								/>
							</div>

							<div className="space-y-1.5">
								<label className="text-sm font-medium text-gray-400">Entry Threshold (APR %)</label>
								<input
									type="number"
									value={entryThresholdApr}
									onChange={(e) => setEntryThresholdApr(Number(e.target.value))}
									step="0.1"
									className="w-full bg-[#0d0e1a] border border-[#2a2b4a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500"
									required
								/>
							</div>
							<div className="space-y-1.5">
								<label className="text-sm font-medium text-gray-400">Exit Threshold (APR %)</label>
								<input
									type="number"
									value={exitThresholdApr}
									onChange={(e) => setExitThresholdApr(Number(e.target.value))}
									step="0.1"
									className="w-full bg-[#0d0e1a] border border-[#2a2b4a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500"
									required
								/>
							</div>

							<div className="space-y-1.5 lg:col-span-2">
								<label className="text-sm font-medium text-gray-400 flex justify-between">
									<span>Leverage</span>
									<span className="text-blue-400">{leverage}x</span>
								</label>
								<input
									type="range"
									value={leverage}
									onChange={(e) => setLeverage(Number(e.target.value))}
									min="1"
									max="20"
									step="1"
									className="w-full accent-blue-500 h-2 bg-[#0d0e1a] rounded-lg appearance-none cursor-pointer mt-2"
								/>
								<div className="flex justify-between text-xs text-gray-500 px-1">
									<span>1x</span>
									<span>10x</span>
									<span>20x</span>
								</div>
							</div>
						</div>

						<div className="flex justify-end pt-4 border-t border-[#2a2b4a]/50">
							<button
								type="submit"
								disabled={loading}
								className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all disabled:opacity-50"
							>
								{loading ? "Creating..." : "Create Loop"}
							</button>
						</div>
					</form>
				)}
			</div>

			{/* Grid Section */}
			<div className="space-y-4">
				<h3 className="text-lg font-semibold text-gray-300 border-b border-[#2a2b4a] pb-2">
					Active Loops
				</h3>

				{loading && loops.length === 0 ? (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
						<SkeletonCard count={3} />
					</div>
				) : loops.length === 0 ? (
					<div className="text-center p-10 bg-[#1a1b2e]/50 border border-[#2a2b4a] rounded-xl text-gray-400 border-dashed">
						No loops configured. Create one above to start automated monitoring.
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
						{loops.map((loop) => (
							<LoopCard key={loop.id} loop={loop} />
						))}
					</div>
				)}
			</div>
		</div>
	)
}
