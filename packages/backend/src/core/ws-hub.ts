import type {
	AlertEvent,
	LoopConfig,
	SimPositionSnapshot,
	WsAlertMessage,
	WsClientMessage,
	WsDeltaMessage,
	WsFullSnapshotMessage,
	WsServerMessage,
} from "@taofff/shared"
import type { WebSocket } from "ws"
import type { FundingEngine } from "./funding-engine"

interface SimProviderResult {
	simPositions: SimPositionSnapshot[]
	simBalance: {
		currentBalance: number
		reservedMargin: number
		availableBalance: number
	} | null
}

interface WsClient {
	ws: WebSocket
	subscribedSymbols: Set<string> | null // null = all symbols
	lastPongTs: number
}

export class WsHub {
	private clients = new Map<WebSocket, WsClient>()
	private broadcastTimer: ReturnType<typeof setInterval> | null = null
	private snapshotTimer: ReturnType<typeof setInterval> | null = null
	private loopProvider: (() => LoopConfig[]) | null = null
	private simProvider: (() => Promise<SimProviderResult>) | null = null
	private lastLoopsStr: string = "[]"

	constructor(
		private engine: FundingEngine,
		private broadcastIntervalMs = 2_000,
		private snapshotIntervalMs = 30_000,
	) {}

	setLoopProvider(provider: () => LoopConfig[]): void {
		this.loopProvider = provider
	}

	setSimProvider(provider: () => Promise<SimProviderResult>): void {
		this.simProvider = provider
	}

	/** Add a new WebSocket connection */
	addClient(ws: WebSocket): void {
		const client: WsClient = {
			ws,
			subscribedSymbols: null, // subscribe to all by default
			lastPongTs: Date.now(),
		}
		this.clients.set(ws, client)

		// Send initial full snapshot
		this.sendFullSnapshot(client)

		// Handle messages
		ws.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
			try {
				const msg: WsClientMessage = JSON.parse(data.toString()) as WsClientMessage
				this.handleClientMessage(client, msg)
			} catch {
				/* ignore invalid messages */
			}
		})

		ws.on("close", () => {
			this.clients.delete(ws)
		})
	}

	/** Start broadcast timers */
	start(): void {
		// Delta broadcast every broadcastIntervalMs
		this.broadcastTimer = setInterval(() => {
			this.broadcastDelta()
		}, this.broadcastIntervalMs)

		// Full snapshot every snapshotIntervalMs
		this.snapshotTimer = setInterval(() => {
			this.broadcastFullSnapshot()
		}, this.snapshotIntervalMs)
	}

	/** Stop broadcast timers and close all connections */
	stop(): void {
		if (this.broadcastTimer) clearInterval(this.broadcastTimer)
		if (this.snapshotTimer) clearInterval(this.snapshotTimer)
		this.broadcastTimer = null
		this.snapshotTimer = null

		for (const [ws] of this.clients) {
			ws.close(1001, "Server shutting down")
		}
		this.clients.clear()
	}

	/** Number of connected clients */
	get clientCount(): number {
		return this.clients.size
	}

	private handleClientMessage(client: WsClient, msg: WsClientMessage): void {
		switch (msg.type) {
			case "ping":
				client.lastPongTs = Date.now()
				this.send(client.ws, { type: "pong", ts: Date.now() })
				break

			case "subscribe":
				if (msg.symbols) {
					client.subscribedSymbols = new Set(msg.symbols)
				} else {
					client.subscribedSymbols = null // all
				}
				// Resend snapshot with new subscription filter
				this.sendFullSnapshot(client)
				break

			case "unsubscribe":
				client.subscribedSymbols = null
				break
		}
	}

	private sendFullSnapshot(client: WsClient): void {
		const snapshot = this.engine.getFullSnapshot()
		const msg: WsFullSnapshotMessage = {
			type: "full",
			rates: this.filterRates(snapshot.rates, client.subscribedSymbols),
			opportunities: snapshot.opportunities,
			statuses: snapshot.statuses,
			loops: this.loopProvider ? this.loopProvider() : [],
			ts: Date.now(),
		}

		if (this.simProvider) {
			void this.simProvider().then((sim) => {
				msg.simPositions = sim.simPositions
				msg.simBalance = sim.simBalance ?? undefined
				this.send(client.ws, msg)
			})
		} else {
			this.send(client.ws, msg)
		}
	}

	private broadcastFullSnapshot(): void {
		for (const client of this.clients.values()) {
			this.sendFullSnapshot(client)
		}
	}

	private broadcastDelta(): void {
		const delta = this.engine.computeDelta()
		const loops = this.loopProvider ? this.loopProvider() : []

		let loopsChanged = false
		const currentLoopsStr = JSON.stringify(loops)
		if (currentLoopsStr !== this.lastLoopsStr) {
			loopsChanged = true
			this.lastLoopsStr = currentLoopsStr
		}

		// Always broadcast when sim provider is present (sim data changes every tick)
		if (!delta && !loopsChanged && !this.simProvider) return

		if (this.simProvider) {
			void this.simProvider().then((sim) => {
				for (const client of this.clients.values()) {
					const msg: WsDeltaMessage = {
						type: "delta",
						rates: delta?.rates
							? this.filterRates(delta.rates, client.subscribedSymbols)
							: undefined,
						opportunities: delta?.opportunities,
						statuses: delta?.statuses,
						loops: loopsChanged ? loops : undefined,
						simPositions: sim.simPositions,
						simBalance: sim.simBalance ?? undefined,
						ts: Date.now(),
					}
					this.send(client.ws, msg)
				}
			})
		} else {
			for (const client of this.clients.values()) {
				const msg: WsDeltaMessage = {
					type: "delta",
					rates: delta?.rates ? this.filterRates(delta.rates, client.subscribedSymbols) : undefined,
					opportunities: delta?.opportunities,
					statuses: delta?.statuses,
					loops: loopsChanged ? loops : undefined,
					ts: Date.now(),
				}
				this.send(client.ws, msg)
			}
		}
	}

	/** Broadcast an alert event to all connected clients */
	broadcastAlert(event: AlertEvent): void {
		const msg: WsAlertMessage = { type: "alert", event }
		for (const client of this.clients.values()) {
			this.send(client.ws, msg)
		}
	}

	/** Filter rates to only include subscribed symbols */
	private filterRates<T>(
		rates: Record<string, Record<string, T>>,
		subscribedSymbols: Set<string> | null,
	): Record<string, Record<string, T>> {
		if (!subscribedSymbols) return rates // all symbols
		const filtered: Record<string, Record<string, T>> = {}
		for (const [symbol, exchangeMap] of Object.entries(rates)) {
			if (subscribedSymbols.has(symbol)) {
				filtered[symbol] = exchangeMap
			}
		}
		return filtered
	}

	private send(ws: WebSocket, msg: WsServerMessage): void {
		if (ws.readyState === ws.OPEN) {
			ws.send(JSON.stringify(msg))
		}
	}
}
