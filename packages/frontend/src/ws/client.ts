import type { WsClientMessage, WsServerMessage } from "@taofff/shared"

type MessageHandler = (msg: WsServerMessage) => void
type ConnectionHandler = (connected: boolean) => void

export class WsClient {
	private ws: WebSocket | null = null
	private handlers = new Set<MessageHandler>()
	private connectionHandlers = new Set<ConnectionHandler>()
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null
	private pingTimer: ReturnType<typeof setInterval> | null = null
	private reconnectDelay = 1000
	private maxReconnectDelay = 30000
	private urls: string[]
	private currentUrlIndex = 0
	private shouldReconnect = true

	constructor(url?: string) {
		const protocol = window.location.protocol === "https:" ? "wss" : "ws"
		const sameOrigin = `${protocol}://${window.location.host}/ws`
		const envUrl = import.meta.env.VITE_WS_URL as string | undefined
		const devFallbacks = import.meta.env.DEV
			? [`${protocol}://localhost:8080/ws`, `${protocol}://127.0.0.1:8080/ws`]
			: []

		const base = url ?? envUrl ?? sameOrigin
		this.urls = Array.from(new Set([base, sameOrigin, ...devFallbacks]))
	}

	private get currentUrl(): string {
		return this.urls[this.currentUrlIndex] ?? this.urls[0] ?? "ws://localhost:8080/ws"
	}

	connect(): void {
		if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING)
			return

		this.shouldReconnect = true
		this.ws = new WebSocket(this.currentUrl)

		this.ws.onopen = () => {
			this.reconnectDelay = 1000 // reset on success
			for (const handler of this.connectionHandlers) handler(true)
			this.send({ type: "subscribe" })

			// Ping keepalive every 25 seconds
			this.pingTimer = setInterval(() => {
				this.send({ type: "ping" })
			}, 25000)
		}

		this.ws.onmessage = (event) => {
			try {
				const msg = JSON.parse(event.data) as WsServerMessage
				for (const handler of this.handlers) {
					handler(msg)
				}
			} catch {
				/* ignore invalid messages */
			}
		}

		this.ws.onclose = () => {
			this.cleanup()
			for (const handler of this.connectionHandlers) handler(false)
			if (this.urls.length > 1) {
				this.currentUrlIndex = (this.currentUrlIndex + 1) % this.urls.length
			}
			if (this.shouldReconnect) {
				this.scheduleReconnect()
			}
		}

		this.ws.onerror = () => {
			this.ws?.close()
		}
	}

	private scheduleReconnect(): void {
		if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
		this.reconnectTimer = setTimeout(() => {
			this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay)
			this.connect()
		}, this.reconnectDelay)
	}

	onMessage(handler: MessageHandler): () => void {
		this.handlers.add(handler)
		return () => this.handlers.delete(handler)
	}

	onConnectionChange(handler: ConnectionHandler): () => void {
		this.connectionHandlers.add(handler)
		return () => this.connectionHandlers.delete(handler)
	}

	send(msg: WsClientMessage): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(msg))
		}
	}

	private cleanup(): void {
		if (this.pingTimer) {
			clearInterval(this.pingTimer)
			this.pingTimer = null
		}
	}

	disconnect(): void {
		this.shouldReconnect = false
		if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
		this.cleanup()
		this.ws?.close()
		this.ws = null
		this.handlers.clear()
		this.connectionHandlers.clear()
	}
}

// Singleton instance
export const wsClient = new WsClient()
