import type {
	AlertMetric,
	AlertOperator,
	DataQuality,
	Exchange,
	LoopStatus,
	OrderMode,
	OrderSequence,
	PositionSide,
} from "./enums"

/** A single funding rate observation from one exchange for one symbol */
export interface FundingRateSnapshot {
	symbol: string
	exchange: Exchange
	rate: number
	apr: number
	predictedRate: number | null
	markPrice: number
	indexPrice: number
	settlementHours: number
	nextSettlementTs: number
	receiveTs: number
	quality: DataQuality
}

/** Pairwise spread between two exchanges for the same symbol */
export interface SpreadSnapshot {
	symbol: string
	exchangeA: Exchange
	exchangeB: Exchange
	rateA: number
	rateB: number
	aprA: number
	aprB: number
	grossApr: number
	spreadPct: number
	timestamp: number
}

/** A detected arbitrage opportunity */
export interface ArbitrageOpportunity {
	id: string
	symbol: string
	longExchange: Exchange
	shortExchange: Exchange
	longRate: number
	shortRate: number
	grossApr: number
	leveragedApr: number
	borrowCostApr: number
	tradingCostApr: number
	netApr: number
	leverage: number
	spreadPct: number
	detectedAt: number
	quality: DataQuality
}

/** Status of a connected exchange */
export interface ExchangeStatus {
	exchange: Exchange
	connected: boolean
	lastMessageTs: number
	symbolCount: number
	quality: DataQuality
	errorCount: number
	lastError: string | null
}

/** Per-exchange metrics snapshot */
export interface VenueMetrics {
	exchange: Exchange
	latencyMs: number
	messageRate: number
	errorRate: number
	uptimePct: number
	timestamp: number
}

/** Alert rule configuration */
export interface AlertRule {
	id: string
	name: string
	metric: AlertMetric
	operator: AlertOperator
	threshold: number
	symbol: string | null
	exchange: Exchange | null
	cooldownSeconds: number
	enabled: boolean
	createdAt: number
	updatedAt: number
}

/** A triggered alert event */
export interface AlertEvent {
	id: string
	ruleId: string
	ruleName: string
	metric: AlertMetric
	operator: AlertOperator
	threshold: number
	actualValue: number
	symbol: string
	exchange: Exchange | null
	message: string
	triggeredAt: number
}

/** Encrypted API key storage record */
export interface ExchangeApiKey {
	exchange: Exchange
	encryptedKey: string
	encryptedSecret: string
	encryptedPassphrase: string | null
	walletAddress: string | null
	testnet: boolean
	createdAt: number
	updatedAt: number
}

/** A single hedge trade (one leg) */
export interface TradeLeg {
	exchange: Exchange
	symbol: string
	side: PositionSide
	size: number
	entryPrice: number
	exitPrice: number | null
	leverage: number
	fees: number
	orderId: string
}

/** A complete bilateral hedge trade */
export interface HedgeTrade {
	id: string
	symbol: string
	legA: TradeLeg
	legB: TradeLeg
	netAprAtEntry: number
	realizedPnl: number | null
	fundingEarned: number
	status: "open" | "closed" | "partial"
	openedAt: number
	closedAt: number | null
	/** Whether this is a simulated (paper) trade */
	simulated?: boolean
}

/** Open trade request */
export interface OpenTradeRequest {
	symbol: string
	exchangeA: Exchange
	exchangeB: Exchange
	sideA: PositionSide
	sideB: PositionSide
	sizeUsdt: number
	leverage: number
	sequence: OrderSequence
	mode: OrderMode
}

/** Close trade request */
export interface CloseTradeRequest {
	tradeId: string
	sequence: OrderSequence
}

/** Loop configuration */
export interface LoopConfig {
	id: string
	symbol: string
	exchangeA: Exchange
	exchangeB: Exchange
	entryThresholdApr: number
	exitThresholdApr: number
	sizeUsdt: number
	leverage: number
	sequence: OrderSequence
	status: LoopStatus
	currentSpread: number | null
	activeTradeId: string | null
	createdAt: number
	updatedAt: number
}

/** Application settings */
export interface AppSettings {
	minNetAprPct: number
	tradingFeePct: number
	slippagePct: number
	defaultLeverage: number
	borrowRateDaily: number
	rebalanceTimesPerYear: number
	stalenessThresholdSeconds: number
}

/** Simulated balance record */
export interface SimBalance {
	id: string
	initialBalance: number
	currentBalance: number
	reservedMargin: number
	totalRealizedPnl: number
	totalFundingEarned: number
	totalFeesSpent: number
	createdAt: number
	updatedAt: number
}

/** Simulated position snapshot with live P&L (computed, not stored) */
export interface SimPositionSnapshot {
	trade: HedgeTrade
	unrealizedPnlA: number
	unrealizedPnlB: number
	unrealizedPnlTotal: number
	currentMarkPriceA: number
	currentMarkPriceB: number
	marginUsed: number
	fundingAccrued: number
}

/** P&L summary */
export interface PnlSummary {
	totalPnl: number
	totalFundingEarned: number
	totalFees: number
	tradeCount: number
	winCount: number
	lossCount: number
	winRate: number
	avgHoldTimeMs: number
}
