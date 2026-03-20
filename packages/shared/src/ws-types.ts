import type {
	AlertEvent,
	ArbitrageOpportunity,
	ExchangeStatus,
	FundingRateSnapshot,
	LoopConfig,
} from "./models"

// ─── Server → Client Messages ───

export interface WsFullSnapshotMessage {
	type: "full"
	rates: Record<string, Record<string, FundingRateSnapshot>>
	opportunities: ArbitrageOpportunity[]
	statuses: ExchangeStatus[]
	loops: LoopConfig[]
	ts: number
}

export interface WsDeltaMessage {
	type: "delta"
	rates?: Record<string, Record<string, Partial<FundingRateSnapshot>>>
	opportunities?: ArbitrageOpportunity[]
	statuses?: Partial<ExchangeStatus>[]
	loops?: Partial<LoopConfig>[]
	ts: number
}

export interface WsAlertMessage {
	type: "alert"
	event: AlertEvent
}

export interface WsPongMessage {
	type: "pong"
	ts: number
}

export type WsServerMessage =
	| WsFullSnapshotMessage
	| WsDeltaMessage
	| WsAlertMessage
	| WsPongMessage

// ─── Client → Server Messages ───

export interface WsPingMessage {
	type: "ping"
}

export interface WsSubscribeMessage {
	type: "subscribe"
	symbols?: string[]
}

export interface WsUnsubscribeMessage {
	type: "unsubscribe"
	symbols?: string[]
}

export type WsClientMessage = WsPingMessage | WsSubscribeMessage | WsUnsubscribeMessage
