import { useEffect, useState } from "react"
import { NavLink, Outlet } from "react-router"
import { useTradeStore } from "../stores/tradeStore"
import { wsClient } from "../ws/client"
import { ConfirmDialog } from "./ConfirmDialog"
import { ErrorBoundary } from "./ErrorBoundary"
import { addToast, ToastContainer } from "./Toast"

const navItems = [
	{ to: "/rates", label: "资金费率", icon: "📊" },
	{ to: "/trade", label: "交易面板", icon: "⚡" },
	{ to: "/loop", label: "循环监控", icon: "🔄" },
	{ to: "/history", label: "历史与盈亏", icon: "📈" },
	{ to: "/settings", label: "系统设置", icon: "⚙️" },
]

export function Layout() {
	const { phase, pendingTrade, error, confirmTrade, cancelTrade } = useTradeStore()
	const [theme, setTheme] = useState<"dark" | "light">(() => {
		if (typeof window === "undefined") return "dark"
		const saved = window.localStorage.getItem("taofff-theme")
		return saved === "light" ? "light" : "dark"
	})

	useEffect(() => {
		const unsub = wsClient.onMessage((msg) => {
			if (msg.type === "alert") {
				addToast(`告警：${msg.event.message}`, "warning")
			}
		})
		return unsub
	}, [])

	useEffect(() => {
		document.documentElement.classList.toggle("theme-light", theme === "light")
		document.documentElement.classList.toggle("theme-dark", theme === "dark")
		window.localStorage.setItem("taofff-theme", theme)
	}, [theme])

	return (
		<div className="app-shell flex h-screen flex-col md:flex-row overflow-hidden bg-gray-950 text-gray-100">
			{/* Desktop Sidebar */}
			<aside className="hidden md:flex w-56 flex-shrink-0 border-r border-gray-800 bg-gray-900 flex-col">
				<div className="px-4 py-5 border-b border-gray-800">
					<h1 className="text-lg font-bold text-white tracking-tight">TaoFFF</h1>
					<p className="text-xs text-gray-500 mt-0.5">对冲套利平台</p>
				</div>
				<nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
					{navItems.map((item) => (
						<NavLink
							key={item.to}
							to={item.to}
							className={({ isActive }) =>
								`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
									isActive
										? "bg-blue-600/20 text-blue-400 font-medium"
										: "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
								}`
							}
						>
							<span className="text-base">{item.icon}</span>
							{item.label}
						</NavLink>
					))}
				</nav>
				<div className="px-4 py-3 border-t border-gray-800">
					<div className="flex items-center justify-between gap-2">
						<p className="text-xs text-gray-600">v0.1.0</p>
						<button
							type="button"
							onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
							className="rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
						>
							{theme === "dark" ? "浅色" : "深色"}
						</button>
					</div>
				</div>
			</aside>

			{/* Main content */}
			<main className="flex-1 overflow-auto pb-24 md:pb-0">
				<ErrorBoundary>
					<Outlet />
				</ErrorBoundary>
			</main>

			{/* Mobile Bottom Navigation */}
			<nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-gray-900 border-t border-gray-800 flex justify-around items-center px-2 z-50 safe-area-pb">
				<button
					type="button"
					onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
					className="flex h-12 w-12 items-center justify-center rounded-lg text-gray-300 hover:bg-gray-800"
					aria-label="切换主题"
					title="切换深浅色"
				>
					{theme === "dark" ? "☀️" : "🌙"}
				</button>
				{navItems.map((item) => (
					<NavLink
						key={item.to}
						to={item.to}
						className={({ isActive }) =>
							`flex flex-col items-center justify-center w-12 h-12 rounded-lg transition-colors ${
								isActive ? "bg-blue-600/20 text-blue-400" : "text-gray-400 hover:text-gray-200"
							}`
						}
						aria-label={item.label}
					>
						<span className="text-xl">{item.icon}</span>
					</NavLink>
				))}
			</nav>

			<ConfirmDialog
				open={phase !== "idle"}
				phase={phase}
				trade={pendingTrade}
				error={error}
				onConfirm={confirmTrade}
				onCancel={cancelTrade}
			/>
			<ToastContainer />
		</div>
	)
}
