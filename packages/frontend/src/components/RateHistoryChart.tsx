import { AreaSeries, ColorType, createChart } from "lightweight-charts"
import { useEffect, useRef } from "react"

export interface RateHistoryChartProps {
	symbol: string
	exchange: string
}

export function RateHistoryChart({ symbol, exchange }: RateHistoryChartProps) {
	const chartContainerRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!chartContainerRef.current) return

		const handleResize = () => {
			chart.applyOptions({ width: chartContainerRef.current?.clientWidth })
		}

		const chart = createChart(chartContainerRef.current, {
			layout: {
				background: { type: ColorType.Solid, color: "transparent" },
				textColor: "#6b7280",
			},
			grid: {
				vertLines: { visible: false },
				horzLines: { visible: false },
			},
			width: chartContainerRef.current.clientWidth,
			height: 80,
			rightPriceScale: {
				visible: false,
			},
			timeScale: {
				visible: false,
			},
			crosshair: {
				vertLine: { visible: false },
				horzLine: { visible: false },
			},
			handleScroll: false,
			handleScale: false,
		})

		const areaSeries = chart.addSeries(AreaSeries, {
			lineColor: "#3b82f6",
			topColor: "rgba(59, 130, 246, 0.4)",
			bottomColor: "rgba(59, 130, 246, 0.05)",
			lineWidth: 2,
		})

		// Fetch historical data
		let mounted = true
		fetch(`/api/rates/${symbol}/history?exchange=${exchange}`)
			.then((res) => res.json())
			.then((data) => {
				if (!mounted) return
				if (data && Array.isArray(data) && data.length > 0) {
					areaSeries.setData(data)
				}
			})
			.catch((err) => console.error("Failed to fetch history:", err))

		window.addEventListener("resize", handleResize)

		return () => {
			mounted = false
			window.removeEventListener("resize", handleResize)
			chart.remove()
		}
	}, [symbol, exchange])

	return <div ref={chartContainerRef} className="w-[200px] h-[80px]" />
}
