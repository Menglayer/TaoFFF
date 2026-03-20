import { z } from "zod"
import {
	AlertMetric,
	AlertOperator,
	Exchange,
	OrderMode,
	OrderSequence,
	PositionSide,
} from "./enums"

export const FundingRateSnapshotSchema = z.object({
	symbol: z.string(),
	exchange: z.nativeEnum(Exchange),
	rate: z.number(),
	apr: z.number(),
	predictedRate: z.number().nullable(),
	markPrice: z.number().positive(),
	indexPrice: z.number().positive(),
	settlementHours: z.number().positive(),
	nextSettlementTs: z.number(),
	receiveTs: z.number(),
})

export const OpenTradeRequestSchema = z.object({
	symbol: z.string().min(1),
	exchangeA: z.nativeEnum(Exchange),
	exchangeB: z.nativeEnum(Exchange),
	sideA: z.nativeEnum(PositionSide),
	sideB: z.nativeEnum(PositionSide),
	sizeUsdt: z.number().positive(),
	leverage: z.number().int().min(1).max(125),
	sequence: z.nativeEnum(OrderSequence),
	mode: z.nativeEnum(OrderMode),
})

export const CloseTradeRequestSchema = z.object({
	tradeId: z.string().min(1),
	sequence: z.nativeEnum(OrderSequence),
})

export const AlertRuleSchema = z.object({
	name: z.string().min(1).max(100),
	metric: z.nativeEnum(AlertMetric),
	operator: z.nativeEnum(AlertOperator),
	threshold: z.number(),
	symbol: z.string().nullable().default(null),
	exchange: z.nativeEnum(Exchange).nullable().default(null),
	cooldownSeconds: z.number().int().min(0).default(300),
	enabled: z.boolean().default(true),
})

export const ExchangeApiKeyInputSchema = z.object({
	exchange: z.nativeEnum(Exchange),
	apiKey: z.string().min(1),
	apiSecret: z.string().min(1),
	passphrase: z.string().nullable().default(null),
	walletAddress: z.string().nullable().default(null),
	testnet: z.boolean().default(false),
})

export const AppSettingsSchema = z.object({
	minNetAprPct: z.number().min(0).default(5.0),
	tradingFeePct: z.number().min(0).default(0.05),
	slippagePct: z.number().min(0).default(0.02),
	defaultLeverage: z.number().int().min(1).max(125).default(1),
	borrowRateDaily: z.number().min(0).default(0.0001),
	rebalanceTimesPerYear: z.number().int().min(1).default(12),
	stalenessThresholdSeconds: z.number().int().min(1).default(120),
})

export const LoopConfigInputSchema = z.object({
	symbol: z.string().min(1),
	exchangeA: z.nativeEnum(Exchange),
	exchangeB: z.nativeEnum(Exchange),
	entryThresholdApr: z.number().positive(),
	exitThresholdApr: z.number(),
	sizeUsdt: z.number().positive(),
	leverage: z.number().int().min(1).max(125),
	sequence: z.nativeEnum(OrderSequence),
})
