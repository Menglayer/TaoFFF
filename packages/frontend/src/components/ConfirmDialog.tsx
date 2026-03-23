import { useEffect } from "react"
import { createPortal } from "react-dom"

type TradePhase = "idle" | "confirming" | "executing" | "success" | "error"

interface ConfirmDialogProps {
	open: boolean
	phase: TradePhase
	trade: {
		symbol: string
		longExchange: string
		shortExchange: string
		sizeUsdt: number
		leverage: number
	} | null
	error: string | null
	onConfirm: () => void
	onCancel: () => void
}

export function ConfirmDialog({
	open,
	phase,
	trade,
	error,
	onConfirm,
	onCancel,
}: ConfirmDialogProps) {
	// Auto-close on success
	useEffect(() => {
		if (phase === "success") {
			const timer = setTimeout(() => {
				onCancel()
			}, 1500)
			return () => clearTimeout(timer)
		}
		return undefined
	}, [phase, onCancel])

	if (!open || !trade) return null

	const modalContent = (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300">
			<div className="mx-4 w-full max-w-md transform overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl transition-all">
				<div className="border-b border-gray-800 p-6 text-center">
					<h2 className="text-xl font-bold text-white tracking-tight">确认交易</h2>
				</div>

				<div className="p-6 space-y-6">
					<div className="text-center">
						<div className="text-3xl font-black text-white tracking-widest uppercase">
							{trade.symbol}
						</div>
						<div className="mt-2 flex items-center justify-center gap-3">
							<span className="flex items-center gap-1 text-sm font-medium text-green-400 bg-green-400/10 px-2 py-1 rounded">
								做多 ↑ {trade.longExchange}
							</span>
							<span className="text-gray-500 text-xs tracking-widest">VS</span>
							<span className="flex items-center gap-1 text-sm font-medium text-red-400 bg-red-400/10 px-2 py-1 rounded">
								做空 ↓ {trade.shortExchange}
							</span>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4 border-y border-gray-800 py-6">
						<div className="text-center">
							<p className="text-xs text-gray-500 uppercase tracking-widest mb-1">
								仓位金额 (USDT)
							</p>
							<p className="text-xl font-bold text-gray-200">
								$
								{trade.sizeUsdt.toLocaleString(undefined, {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2,
								})}
							</p>
						</div>
						<div className="text-center">
							<p className="text-xs text-gray-500 uppercase tracking-widest mb-1">杠杆</p>
							<span className="inline-block rounded bg-blue-600/20 px-3 py-1 text-lg font-bold text-blue-400">
								{trade.leverage}x
							</span>
						</div>
					</div>

					{phase === "error" && error && (
						<div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400 text-center">
							{error}
						</div>
					)}

					{phase === "success" && (
						<div className="flex items-center justify-center gap-2 rounded border border-green-500/30 bg-green-500/10 p-4 text-green-400 text-center">
							<span className="text-xl">✓</span>
							<span className="font-bold">交易执行成功</span>
						</div>
					)}
				</div>

				<div className="flex bg-gray-950 p-4 gap-3">
					<button
						type="button"
						onClick={onCancel}
						disabled={phase === "executing"}
						className="flex-1 rounded border border-gray-700 bg-gray-800 py-3 text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition-colors"
					>
						{phase === "success" ? "关闭" : "取消"}
					</button>

					{phase !== "success" && (
						<button
							type="button"
							onClick={onConfirm}
							disabled={phase === "executing"}
							className="flex-1 rounded bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors relative overflow-hidden"
						>
							{phase === "executing" ? (
								<div className="flex items-center justify-center gap-2">
									<div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
									<span>执行中...</span>
								</div>
							) : phase === "error" ? (
								"重试执行"
							) : (
								"确认并执行"
							)}
						</button>
					)}
				</div>
			</div>
		</div>
	)

	return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent
}
