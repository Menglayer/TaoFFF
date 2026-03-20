import {
	computeBorrowCostApr,
	computeEntryExitCostPct,
	computeGrossApr,
	computeLeveragedApr,
	computeNetApr,
	computeTradingCostApr,
	DEFAULTS,
	type Exchange,
} from "@taofff/shared"
import { useEffect, useMemo } from "react"
import { useSearchParams } from "react-router"
import { OrderbookDisplay } from "../components/OrderbookDisplay"
import { SkeletonTable } from "../components/Skeleton"
import { useOrderStore } from "../stores/orderStore"
import { useRateStore } from "../stores/rateStore"
import { useTradeStore } from "../stores/tradeStore"
import { ALL_EXCHANGES, EXCHANGE_DISPLAY_NAME } from "../utils/exchange"

const EXCHANGES = ALL_EXCHANGES

export function TradingPage() {
	const [searchParams] = useSearchParams()
	const {
		selectedSymbol,
		longExchange,
		shortExchange,
		sizeUsdt,
		leverage,
		setSymbol,
		setLongExchange,
		setShortExchange,
		setSizeUsdt,
		setLeverage,
		initFromParams,
		bbo,
	} = useOrderStore()

	const { rates, connect, disconnect } = useRateStore()
	const { positions, fetchPositions, requestTrade, closeTrade, phase } = useTradeStore()

	// Initialize from URL params on mount
	useEffect(() => {
		const symbol = searchParams.get("symbol") || undefined
		const long = searchParams.get("long") || undefined
		const short = searchParams.get("short") || undefined

		initFromParams({ symbol, long, short })
	}, [searchParams, initFromParams])

	// Connect to WS and fetch positions
	useEffect(() => {
		connect()
		fetchPositions()
		return () => disconnect()
	}, [connect, disconnect, fetchPositions])

	// Get available symbols from rateStore
	const symbols = useMemo(() => Object.keys(rates).sort(), [rates])

	// If selectedSymbol is null but we have symbols, pick the first one
	useEffect(() => {
		if (!selectedSymbol && symbols.length > 0 && symbols[0]) {
			setSymbol(symbols[0])
		}
	}, [selectedSymbol, symbols, setSymbol])

	// Fee Preview Computations
	const preview = useMemo(() => {
		if (!selectedSymbol || !longExchange || !shortExchange) return null

		const longRateData = rates[selectedSymbol]?.[longExchange]
		const shortRateData = rates[selectedSymbol]?.[shortExchange]

		if (!longRateData || !shortRateData) return null

		const longApr = longRateData.apr
		const shortApr = shortRateData.apr

		const grossApr = computeGrossApr(shortApr, longApr)
		const leveragedApr = computeLeveragedApr(grossApr, leverage)
		const borrowCostApr = computeBorrowCostApr(DEFAULTS.BORROW_RATE_DAILY, leverage)

		const entryExitCostPct = computeEntryExitCostPct(
			DEFAULTS.TRADING_FEE_PCT,
			DEFAULTS.SLIPPAGE_PCT,
		)
		const tradingCostApr = computeTradingCostApr(
			entryExitCostPct,
			DEFAULTS.REBALANCE_TIMES_PER_YEAR,
			leverage,
		)

		const netApr = computeNetApr({
			shortApr,
			longApr,
			leverage,
			borrowRateDaily: DEFAULTS.BORROW_RATE_DAILY,
			feePct: DEFAULTS.TRADING_FEE_PCT,
			slippagePct: DEFAULTS.SLIPPAGE_PCT,
			rebalanceTimesPerYear: DEFAULTS.REBALANCE_TIMES_PER_YEAR,
		})

		return {
			grossApr,
			leveragedApr,
			borrowCostApr,
			tradingCostApr,
			netApr,
			tradingFee: DEFAULTS.TRADING_FEE_PCT,
			slippage: DEFAULTS.SLIPPAGE_PCT,
		}
	}, [selectedSymbol, longExchange, shortExchange, leverage, rates])

	const isTradeValid =
		selectedSymbol && longExchange && shortExchange && sizeUsdt > 0 && leverage > 0

	const handleExecute = () => {
		if (!isTradeValid) return
		requestTrade({
			symbol: selectedSymbol,
			longExchange,
			shortExchange,
			sizeUsdt,
			leverage,
		})
	}

	return (
		<div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500 p-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold tracking-tight text-gray-100 flex items-center gap-3">
					Trading
				</h1>
				<select
					className="bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
					value={selectedSymbol || ""}
					onChange={(e) => setSymbol(e.target.value)}
				>
					<option value="" disabled>
						Select Symbol
					</option>
					{symbols.map((s) => (
						<option key={s} value={s}>
							{s}
						</option>
					))}
				</select>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Left Panel: Order Form */}
				<div className="lg:col-span-1 bg-gray-900/50 border border-gray-800 rounded-xl p-6 shadow-2xl backdrop-blur-sm flex flex-col gap-6">
					<div>
						<h2 className="text-lg font-semibold text-white mb-4">Order Panel</h2>

						{/* Direction / Exchanges */}
						<div className="flex flex-col gap-4">
							<div className="flex justify-between items-center">
								<span className="text-gray-400 font-medium text-sm w-16">Long</span>
								<select
									className="flex-1 bg-gray-950 border border-gray-800 text-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 transition-colors"
									value={longExchange || ""}
									onChange={(e) => setLongExchange(e.target.value as Exchange)}
								>
									<option value="" disabled>
										Select Exchange
									</option>
									{EXCHANGES.map((ex) => (
										<option key={ex} value={ex} disabled={ex === shortExchange}>
											{EXCHANGE_DISPLAY_NAME[ex]}
										</option>
									))}
								</select>
							</div>

							<div className="flex justify-between items-center">
								<span className="text-gray-400 font-medium text-sm w-16">Short</span>
								<select
									className="flex-1 bg-gray-950 border border-gray-800 text-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 transition-colors"
									value={shortExchange || ""}
									onChange={(e) => setShortExchange(e.target.value as Exchange)}
								>
									<option value="" disabled>
										Select Exchange
									</option>
									{EXCHANGES.map((ex) => (
										<option key={ex} value={ex} disabled={ex === longExchange}>
											{EXCHANGE_DISPLAY_NAME[ex]}
										</option>
									))}
								</select>
							</div>
						</div>
					</div>

					{/* Size */}
					<div>
						<label className="text-gray-400 font-medium text-sm block mb-2">Size (USDT)</label>
						<input
							type="number"
							min="10"
							step="10"
							value={sizeUsdt}
							onChange={(e) => setSizeUsdt(Number(e.target.value))}
							className="w-full bg-gray-950 border border-gray-800 text-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 transition-colors"
						/>
					</div>

					{/* Leverage Slider */}
					<div>
						<div className="flex justify-between items-center mb-2">
							<label className="text-gray-400 font-medium text-sm">Leverage</label>
							<span className="text-blue-400 font-bold">{leverage}x</span>
						</div>
						<input
							type="range"
							min="1"
							max="20"
							step="1"
							value={leverage}
							onChange={(e) => setLeverage(Number(e.target.value))}
							className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
						/>
					</div>

					{/* Fee Preview */}
					<div className="bg-gray-950/60 border border-gray-800/80 rounded-lg p-4 flex flex-col gap-2 mt-2">
						<h3 className="text-xs uppercase text-gray-500 font-bold tracking-wider mb-1">
							Fee Preview
						</h3>
						{preview ? (
							<>
								<div className="flex justify-between text-sm">
									<span className="text-gray-400">Trading Fee</span>
									<span className="text-gray-300">{(preview.tradingFee * 100).toFixed(2)}%</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-gray-400">Slippage</span>
									<span className="text-gray-300">{(preview.slippage * 100).toFixed(2)}%</span>
								</div>
								<div className="flex justify-between text-sm mt-2 pt-2 border-t border-gray-800/50">
									<span className="text-gray-400">Gross APR</span>
									<span className="text-gray-300">{preview.grossApr.toFixed(2)}%</span>
								</div>
								<div className="flex justify-between text-sm font-semibold">
									<span className="text-blue-400">Net APR</span>
									<span className={preview.netApr >= 0 ? "text-green-400" : "text-red-400"}>
										{preview.netApr.toFixed(2)}%
									</span>
								</div>
							</>
						) : (
							<div className="text-sm text-gray-500 italic py-2">
								Select symbol and exchanges to preview APR
							</div>
						)}
					</div>

					{/* Execute Button */}
					<div className="mt-auto pt-4 relative group">
						<button
							type="button"
							disabled={!isTradeValid || phase === "executing" || phase === "confirming"}
							onClick={handleExecute}
							className={`w-full font-semibold py-3 rounded-lg transition-all ${
								isTradeValid
									? "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
									: "bg-blue-600/50 text-white/50 cursor-not-allowed border border-blue-500/20"
							}`}
						>
							{phase === "executing" ? "Executing..." : "Execute Trade"}
						</button>
					</div>
				</div>

				{/* Right Panel: Orderbooks & Positions */}
				<div className="lg:col-span-2 flex flex-col gap-6">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{/* Long Exchange Orderbook */}
						<div className="flex flex-col gap-2">
							<h3 className="text-sm text-gray-400 uppercase font-bold tracking-wider mb-1 px-1">
								Long Leg
							</h3>
							{longExchange ? (
								bbo[longExchange] ? (
									<OrderbookDisplay exchange={longExchange} bbo={bbo[longExchange]} />
								) : (
									<SkeletonTable rows={5} columns={2} />
								)
							) : (
								<div className="border border-gray-800 border-dashed rounded-xl flex items-center justify-center p-8 text-gray-500 text-sm bg-gray-900/20 h-full min-h-[160px]">
									Select long exchange
								</div>
							)}
						</div>

						{/* Short Exchange Orderbook */}
						<div className="flex flex-col gap-2">
							<h3 className="text-sm text-gray-400 uppercase font-bold tracking-wider mb-1 px-1">
								Short Leg
							</h3>
							{shortExchange ? (
								bbo[shortExchange] ? (
									<OrderbookDisplay exchange={shortExchange} bbo={bbo[shortExchange]} />
								) : (
									<SkeletonTable rows={5} columns={2} />
								)
							) : (
								<div className="border border-gray-800 border-dashed rounded-xl flex items-center justify-center p-8 text-gray-500 text-sm bg-gray-900/20 h-full min-h-[160px]">
									Select short exchange
								</div>
							)}
						</div>
					</div>

					{/* Active Positions */}
					<div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 shadow-xl flex-1 mt-4 flex flex-col">
						<h2 className="text-lg font-semibold text-white mb-6 border-b border-gray-800 pb-3">
							Active Positions
						</h2>
						{positions.length > 0 ? (
							<div className="overflow-x-auto">
								<table className="w-full text-left">
									<thead>
										<tr>
											<th className="pb-3 text-xs text-gray-500 uppercase tracking-wider font-medium">
												Symbol
											</th>
											<th className="pb-3 text-xs text-gray-500 uppercase tracking-wider font-medium">
												Long / Short
											</th>
											<th className="pb-3 text-xs text-gray-500 uppercase tracking-wider font-medium">
												Size
											</th>
											<th className="pb-3 text-xs text-gray-500 uppercase tracking-wider font-medium">
												Entry Price (L/S)
											</th>
											<th className="pb-3 text-xs text-gray-500 uppercase tracking-wider font-medium">
												Net APR
											</th>
											<th className="pb-3 text-xs text-gray-500 uppercase tracking-wider font-medium">
												Status
											</th>
											<th className="pb-3 text-xs text-gray-500 uppercase tracking-wider font-medium text-right">
												Action
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-800/50">
										{positions.map((pos) => (
											<tr key={pos.id} className="hover:bg-gray-800/30 transition-colors">
												<td className="py-4 text-sm font-bold text-gray-200">{pos.symbol}</td>
												<td className="py-4 text-sm text-gray-400">
													<span className="text-green-400">{pos.legA.exchange}</span>
													<span className="mx-1 text-gray-600">/</span>
													<span className="text-red-400">{pos.legB.exchange}</span>
												</td>
												<td className="py-4 text-sm text-gray-300">
													$
													{(pos.legA.size * pos.legA.entryPrice).toLocaleString(undefined, {
														maximumFractionDigits: 2,
													})}
													<span className="ml-1 text-xs text-blue-400 bg-blue-400/10 px-1 rounded">
														{pos.legA.leverage}x
													</span>
												</td>
												<td className="py-4 text-sm text-gray-400">
													{pos.legA.entryPrice.toFixed(4)} <span className="text-gray-600">/</span>{" "}
													{pos.legB.entryPrice.toFixed(4)}
												</td>
												<td className="py-4 text-sm font-medium text-green-400">
													{pos.netAprAtEntry.toFixed(2)}%
												</td>
												<td className="py-4">
													<span className="inline-flex items-center rounded-full bg-green-400/10 px-2 py-1 text-xs font-medium text-green-400 border border-green-400/20">
														{pos.status.toUpperCase()}
													</span>
												</td>
												<td className="py-4 text-right">
													<button
														type="button"
														onClick={() => closeTrade(pos.id)}
														className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors border border-red-400/20 hover:bg-red-400/10 px-3 py-1 rounded"
													>
														Close
													</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<div className="flex-1 flex flex-col items-center justify-center text-gray-500 py-12">
								<svg
									className="w-12 h-12 mb-4 text-gray-700"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									aria-label="Empty orderbook"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={1}
										d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
									/>
								</svg>
								<p className="text-sm">No active positions yet.</p>
								<p className="text-xs mt-1 text-gray-600">Execute a trade to see positions here.</p>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
