import { useEffect } from "react"
import { create } from "zustand"

export interface ToastItem {
	id: string
	message: string
	type: "success" | "error" | "warning" | "info"
}

interface ToastState {
	toasts: ToastItem[]
	add: (message: string, type: ToastItem["type"]) => void
	remove: (id: string) => void
}

const useToastStore = create<ToastState>((set) => ({
	toasts: [],
	add: (message, type) => {
		const id = Math.random().toString(36).slice(2)
		set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))
	},
	remove: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export function addToast(message: string, type: ToastItem["type"] = "info") {
	useToastStore.getState().add(message, type)
}

const typeStyles = {
	success: "border-green-500 text-green-400",
	error: "border-red-500 text-red-400",
	warning: "border-yellow-500 text-yellow-400",
	info: "border-blue-500 text-blue-400",
}

export function ToastContainer() {
	const toasts = useToastStore((s) => s.toasts)
	const remove = useToastStore((s) => s.remove)

	return (
		<div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
			{toasts.map((toast) => (
				<Toast key={toast.id} toast={toast} onRemove={() => remove(toast.id)} />
			))}
		</div>
	)
}

function Toast({ toast, onRemove }: { toast: ToastItem; onRemove: () => void }) {
	useEffect(() => {
		const timer = setTimeout(onRemove, 5000)
		return () => clearTimeout(timer)
	}, [onRemove])

	return (
		<div
			className={`pointer-events-auto bg-[#1a1b2e] border border-[#2a2b4a] border-l-4 ${typeStyles[toast.type]} rounded-lg shadow-lg p-4 flex items-start justify-between min-w-[300px] max-w-sm animate-slide-in-right`}
		>
			<p className="text-sm font-medium text-white break-words pr-4">{toast.message}</p>
			<button
				type="button"
				onClick={onRemove}
				className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
			>
				✕
			</button>
		</div>
	)
}
