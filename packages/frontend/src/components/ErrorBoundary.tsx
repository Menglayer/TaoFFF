import type React from "react"
import { Component, type ReactNode } from "react"

interface Props {
	children?: ReactNode
}

interface State {
	hasError: boolean
	error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
	public state: State = {
		hasError: false,
	}

	public static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error }
	}

	public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		console.error("Uncaught error:", error, errorInfo)
	}

	public render() {
		if (this.state.hasError) {
			return (
				<div className="flex h-full w-full items-center justify-center p-4 bg-gray-950 text-gray-100">
					<div className="max-w-md rounded-xl border border-red-900/50 bg-gray-900 p-6 shadow-xl">
						<div className="mb-4 flex items-center space-x-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-900/30 text-red-500">
								<svg
									className="h-6 w-6"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									role="img"
									aria-label="Error icon"
								>
									<title>Error icon</title>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
									/>
								</svg>
							</div>
							<h2 className="text-xl font-semibold text-gray-100">Something went wrong</h2>
						</div>

						<p className="mb-6 text-sm text-gray-400">
							An unexpected error occurred in this component.
						</p>

						{this.state.error && import.meta.env.DEV && (
							<details className="mb-6 rounded-lg bg-gray-950 p-4">
								<summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-300">
									Error Details
								</summary>
								<pre className="mt-2 overflow-x-auto text-[10px] text-red-400">
									{this.state.error.message}
									{"\n"}
									{this.state.error.stack}
								</pre>
							</details>
						)}

						<button
							type="button"
							onClick={() => window.location.reload()}
							className="w-full rounded-lg bg-red-600/10 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-600/20 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-colors"
						>
							Reload Page
						</button>
					</div>
				</div>
			)
		}

		return this.props.children
	}
}
