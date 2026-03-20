import { lazy, Suspense } from "react"
import { createBrowserRouter } from "react-router"
import { Layout } from "./components/Layout"

const FundingRatePage = lazy(() =>
	import("./pages/FundingRatePage").then((m) => ({ default: m.FundingRatePage })),
)
const HistoryPage = lazy(() =>
	import("./pages/HistoryPage").then((m) => ({ default: m.HistoryPage })),
)
const LoopMonitorPage = lazy(() =>
	import("./pages/LoopMonitorPage").then((m) => ({ default: m.LoopMonitorPage })),
)
const SettingsPage = lazy(() =>
	import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
)
const TradingPage = lazy(() =>
	import("./pages/TradingPage").then((m) => ({ default: m.TradingPage })),
)

function PageSkeleton() {
	return (
		<div className="p-6 w-full h-full flex flex-col gap-6">
			<div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
			<div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
		</div>
	)
}

function withSuspense(Component: React.ComponentType) {
	return (
		<Suspense fallback={<PageSkeleton />}>
			<Component />
		</Suspense>
	)
}

export const router = createBrowserRouter([
	{
		path: "/",
		element: <Layout />,
		children: [
			{ index: true, element: withSuspense(FundingRatePage) },
			{ path: "rates", element: withSuspense(FundingRatePage) },
			{ path: "trade", element: withSuspense(TradingPage) },
			{ path: "loop", element: withSuspense(LoopMonitorPage) },
			{ path: "history", element: withSuspense(HistoryPage) },
			{ path: "settings", element: withSuspense(SettingsPage) },
		],
	},
])
