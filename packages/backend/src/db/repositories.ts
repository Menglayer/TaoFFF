import type {
	AlertEvent,
	AlertMetric,
	AlertOperator,
	AlertRule,
	ArbitrageOpportunity,
	Exchange,
	FundingRateSnapshot,
	HedgeTrade,
	LoopConfig,
	LoopStatus,
	OrderSequence,
} from "@taofff/shared"
import { and, desc, eq, gte, lt, lte, sql } from "drizzle-orm"
import type { AppDatabase } from "./client"
import {
	alertHistory,
	alertRules,
	arbitrageOpportunities,
	exchangeApiKeys,
	fundingRates,
	loopConfigs,
	tradeHistory,
} from "./schema"

export class FundingRateRepository {
	constructor(private db: AppDatabase) {}

	/** Insert a batch of funding rate snapshots */
	async insertBatch(snapshots: FundingRateSnapshot[]): Promise<void> {
		if (snapshots.length === 0) return
		await this.db.insert(fundingRates).values(
			snapshots.map((s) => ({
				symbol: s.symbol,
				exchange: s.exchange,
				rate: s.rate,
				apr: s.apr,
				predictedRate: s.predictedRate,
				markPrice: s.markPrice,
				indexPrice: s.indexPrice,
				settlementHours: s.settlementHours,
				nextSettlementTs: s.nextSettlementTs,
				receiveTs: s.receiveTs,
			})),
		)
	}

	/** Query rates for a symbol over a time range */
	async getHistory(params: {
		symbol: string
		exchange?: string
		fromTs?: number
		toTs?: number
		limit?: number
	}) {
		const conditions = [eq(fundingRates.symbol, params.symbol)]

		if (params.exchange) {
			conditions.push(eq(fundingRates.exchange, params.exchange))
		}
		if (params.fromTs !== undefined) {
			conditions.push(gte(fundingRates.receiveTs, params.fromTs))
		}
		if (params.toTs !== undefined) {
			conditions.push(lte(fundingRates.receiveTs, params.toTs))
		}

		const rows = await this.db
			.select()
			.from(fundingRates)
			.where(and(...conditions))
			.orderBy(desc(fundingRates.receiveTs))
			.limit(params.limit ?? 500)

		return rows
	}

	/** Delete old data beyond retention period */
	async cleanup(retentionMs: number): Promise<number> {
		const cutoff = Date.now() - retentionMs
		const result = await this.db
			.delete(fundingRates)
			.where(lt(fundingRates.receiveTs, cutoff))
			.returning({ id: fundingRates.id })

		return result.length
	}
}

export class ArbitrageOpportunityRepository {
	constructor(private db: AppDatabase) {}

	/** Insert a batch of arbitrage opportunities */
	async insertBatch(opportunities: ArbitrageOpportunity[]): Promise<void> {
		if (opportunities.length === 0) return
		await this.db
			.insert(arbitrageOpportunities)
			.values(
				opportunities.map((o) => ({
					id: o.id,
					symbol: o.symbol,
					longExchange: o.longExchange,
					shortExchange: o.shortExchange,
					longRate: o.longRate,
					shortRate: o.shortRate,
					grossApr: o.grossApr,
					leveragedApr: o.leveragedApr,
					borrowCostApr: o.borrowCostApr,
					tradingCostApr: o.tradingCostApr,
					netApr: o.netApr,
					leverage: o.leverage,
					spreadPct: o.spreadPct,
					detectedAt: o.detectedAt,
				})),
			)
			.onConflictDoUpdate({
				target: arbitrageOpportunities.id,
				set: {
					longRate: sql`excluded.long_rate`,
					shortRate: sql`excluded.short_rate`,
					grossApr: sql`excluded.gross_apr`,
					leveragedApr: sql`excluded.leveraged_apr`,
					borrowCostApr: sql`excluded.borrow_cost_apr`,
					tradingCostApr: sql`excluded.trading_cost_apr`,
					netApr: sql`excluded.net_apr`,
					spreadPct: sql`excluded.spread_pct`,
					detectedAt: sql`excluded.detected_at`,
				},
			})
	}

	/** Get most recent opportunities */
	async getRecent(limit: number = 100) {
		return this.db
			.select()
			.from(arbitrageOpportunities)
			.orderBy(desc(arbitrageOpportunities.detectedAt))
			.limit(limit)
	}

	/** Get opportunities filtered by symbol */
	async getBySymbol(symbol: string, limit: number = 100) {
		return this.db
			.select()
			.from(arbitrageOpportunities)
			.where(eq(arbitrageOpportunities.symbol, symbol))
			.orderBy(desc(arbitrageOpportunities.detectedAt))
			.limit(limit)
	}
}

export class ApiKeyRepository {
	constructor(private db: AppDatabase) {}

	/** Save (upsert) an API key for an exchange */
	async upsert(data: {
		exchange: string
		encryptedKey: string
		encryptedSecret: string
		encryptedPassphrase: string | null
		walletAddress: string | null
		testnet: boolean
	}): Promise<void> {
		const now = Date.now()
		await this.db
			.insert(exchangeApiKeys)
			.values({
				exchange: data.exchange,
				encryptedKey: data.encryptedKey,
				encryptedSecret: data.encryptedSecret,
				encryptedPassphrase: data.encryptedPassphrase,
				walletAddress: data.walletAddress,
				testnet: data.testnet,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: exchangeApiKeys.exchange,
				set: {
					encryptedKey: sql`excluded.encrypted_key`,
					encryptedSecret: sql`excluded.encrypted_secret`,
					encryptedPassphrase: sql`excluded.encrypted_passphrase`,
					walletAddress: sql`excluded.wallet_address`,
					testnet: sql`excluded.testnet`,
					updatedAt: sql`excluded.updated_at`,
				},
			})
	}

	/** Get API key record for an exchange (still encrypted) */
	async getByExchange(exchange: string) {
		const rows = await this.db
			.select()
			.from(exchangeApiKeys)
			.where(eq(exchangeApiKeys.exchange, exchange))
			.limit(1)
		return rows[0] ?? null
	}

	/** Get all exchanges that have API keys configured */
	async listExchanges(): Promise<string[]> {
		const rows = await this.db.select({ exchange: exchangeApiKeys.exchange }).from(exchangeApiKeys)
		return rows.map((r) => r.exchange)
	}

	/** Delete API key for an exchange */
	async deleteByExchange(exchange: string): Promise<boolean> {
		const result = await this.db
			.delete(exchangeApiKeys)
			.where(eq(exchangeApiKeys.exchange, exchange))
			.returning({ exchange: exchangeApiKeys.exchange })
		return result.length > 0
	}
}

export class TradeHistoryRepository {
	constructor(private db: AppDatabase) {}

	/** Insert a new trade record */
	async insert(trade: HedgeTrade): Promise<void> {
		await this.db.insert(tradeHistory).values({
			id: trade.id,
			symbol: trade.symbol,
			legAExchange: trade.legA.exchange,
			legASide: trade.legA.side,
			legASize: trade.legA.size,
			legAEntryPrice: trade.legA.entryPrice,
			legAExitPrice: trade.legA.exitPrice,
			legALeverage: trade.legA.leverage,
			legAFees: trade.legA.fees,
			legAOrderId: trade.legA.orderId,
			legBExchange: trade.legB.exchange,
			legBSide: trade.legB.side,
			legBSize: trade.legB.size,
			legBEntryPrice: trade.legB.entryPrice,
			legBExitPrice: trade.legB.exitPrice,
			legBLeverage: trade.legB.leverage,
			legBFees: trade.legB.fees,
			legBOrderId: trade.legB.orderId,
			netAprAtEntry: trade.netAprAtEntry,
			realizedPnl: trade.realizedPnl,
			fundingEarned: trade.fundingEarned,
			status: trade.status,
			openedAt: trade.openedAt,
			closedAt: trade.closedAt,
		})
	}

	/** Update a trade (e.g., after closing) */
	async update(trade: HedgeTrade): Promise<void> {
		await this.db
			.update(tradeHistory)
			.set({
				legAExitPrice: trade.legA.exitPrice,
				legAFees: trade.legA.fees,
				legBExitPrice: trade.legB.exitPrice,
				legBFees: trade.legB.fees,
				realizedPnl: trade.realizedPnl,
				fundingEarned: trade.fundingEarned,
				status: trade.status,
				closedAt: trade.closedAt,
			})
			.where(eq(tradeHistory.id, trade.id))
	}

	/** Get all open positions */
	async getOpenPositions(): Promise<(typeof tradeHistory.$inferSelect)[]> {
		return this.db
			.select()
			.from(tradeHistory)
			.where(eq(tradeHistory.status, "open"))
			.orderBy(desc(tradeHistory.openedAt))
	}

	/** Get trade history (closed trades) */
	async getHistory(limit: number = 100) {
		return this.db.select().from(tradeHistory).orderBy(desc(tradeHistory.openedAt)).limit(limit)
	}

	/** Get a single trade by ID */
	async getById(id: string) {
		const rows = await this.db.select().from(tradeHistory).where(eq(tradeHistory.id, id)).limit(1)
		return rows[0] ?? null
	}
}

export class AlertRuleRepository {
	constructor(private db: AppDatabase) {}

	async insert(rule: AlertRule): Promise<void> {
		await this.db.insert(alertRules).values({
			id: rule.id,
			name: rule.name,
			metric: rule.metric,
			operator: rule.operator,
			threshold: rule.threshold,
			symbol: rule.symbol ?? null,
			exchange: rule.exchange ?? null,
			cooldownSeconds: rule.cooldownSeconds,
			enabled: rule.enabled,
			createdAt: rule.createdAt,
			updatedAt: rule.updatedAt,
		})
	}

	async update(rule: AlertRule): Promise<void> {
		await this.db
			.update(alertRules)
			.set({
				name: rule.name,
				metric: rule.metric,
				operator: rule.operator,
				threshold: rule.threshold,
				symbol: rule.symbol ?? null,
				exchange: rule.exchange ?? null,
				cooldownSeconds: rule.cooldownSeconds,
				enabled: rule.enabled,
				updatedAt: rule.updatedAt,
			})
			.where(eq(alertRules.id, rule.id))
	}

	async getAll(): Promise<AlertRule[]> {
		const rows = await this.db.select().from(alertRules)
		return rows.map((r) => ({
			id: r.id,
			name: r.name,
			metric: r.metric as AlertMetric,
			operator: r.operator as AlertOperator,
			threshold: r.threshold,
			symbol: r.symbol ?? null,
			exchange: (r.exchange as Exchange) ?? null,
			cooldownSeconds: r.cooldownSeconds,
			enabled: r.enabled,
			createdAt: r.createdAt,
			updatedAt: r.updatedAt,
		}))
	}

	async getEnabled(): Promise<AlertRule[]> {
		const rows = await this.db.select().from(alertRules).where(eq(alertRules.enabled, true))
		return rows.map((r) => ({
			id: r.id,
			name: r.name,
			metric: r.metric as AlertMetric,
			operator: r.operator as AlertOperator,
			threshold: r.threshold,
			symbol: r.symbol ?? null,
			exchange: (r.exchange as Exchange) ?? null,
			cooldownSeconds: r.cooldownSeconds,
			enabled: r.enabled,
			createdAt: r.createdAt,
			updatedAt: r.updatedAt,
		}))
	}

	async getById(id: string): Promise<AlertRule | null> {
		const rows = await this.db.select().from(alertRules).where(eq(alertRules.id, id)).limit(1)
		if (rows.length === 0) return null
		const r = rows[0]
		if (!r) return null
		return {
			id: r.id,
			name: r.name,
			metric: r.metric as AlertMetric,
			operator: r.operator as AlertOperator,
			threshold: r.threshold,
			symbol: r.symbol ?? null,
			exchange: (r.exchange as Exchange) ?? null,
			cooldownSeconds: r.cooldownSeconds,
			enabled: r.enabled,
			createdAt: r.createdAt,
			updatedAt: r.updatedAt,
		}
	}

	async deleteById(id: string): Promise<boolean> {
		const result = await this.db
			.delete(alertRules)
			.where(eq(alertRules.id, id))
			.returning({ id: alertRules.id })
		return result.length > 0
	}
}

export class AlertHistoryRepository {
	constructor(private db: AppDatabase) {}

	async insert(event: AlertEvent): Promise<void> {
		await this.db.insert(alertHistory).values({
			id: event.id,
			ruleId: event.ruleId,
			ruleName: event.ruleName,
			metric: event.metric,
			operator: event.operator,
			threshold: event.threshold,
			actualValue: event.actualValue,
			symbol: event.symbol,
			exchange: event.exchange ?? null,
			message: event.message,
			triggeredAt: event.triggeredAt,
		})
	}

	async getRecent(limit: number = 100): Promise<AlertEvent[]> {
		const rows = await this.db
			.select()
			.from(alertHistory)
			.orderBy(desc(alertHistory.triggeredAt))
			.limit(limit)
		return rows.map((r) => ({
			id: r.id,
			ruleId: r.ruleId,
			ruleName: r.ruleName,
			metric: r.metric as AlertMetric,
			operator: r.operator as AlertOperator,
			threshold: r.threshold,
			actualValue: r.actualValue,
			symbol: r.symbol,
			exchange: (r.exchange as Exchange) ?? undefined,
			message: r.message,
			triggeredAt: r.triggeredAt,
		}))
	}

	async getByRuleId(ruleId: string, limit: number = 100): Promise<AlertEvent[]> {
		const rows = await this.db
			.select()
			.from(alertHistory)
			.where(eq(alertHistory.ruleId, ruleId))
			.orderBy(desc(alertHistory.triggeredAt))
			.limit(limit)
		return rows.map((r) => ({
			id: r.id,
			ruleId: r.ruleId,
			ruleName: r.ruleName,
			metric: r.metric as AlertMetric,
			operator: r.operator as AlertOperator,
			threshold: r.threshold,
			actualValue: r.actualValue,
			symbol: r.symbol,
			exchange: (r.exchange as Exchange) ?? undefined,
			message: r.message,
			triggeredAt: r.triggeredAt,
		}))
	}
}

export class LoopConfigRepository {
	constructor(private db: AppDatabase) {}

	async insert(config: LoopConfig): Promise<void> {
		await this.db.insert(loopConfigs).values({
			id: config.id,
			symbol: config.symbol,
			exchangeA: config.exchangeA,
			exchangeB: config.exchangeB,
			entryThresholdApr: config.entryThresholdApr,
			exitThresholdApr: config.exitThresholdApr,
			sizeUsdt: config.sizeUsdt,
			leverage: config.leverage,
			sequence: config.sequence,
			status: config.status,
			activeTradeId: config.activeTradeId,
			createdAt: config.createdAt,
			updatedAt: config.updatedAt,
		})
	}

	async update(config: LoopConfig): Promise<void> {
		await this.db
			.update(loopConfigs)
			.set({
				symbol: config.symbol,
				exchangeA: config.exchangeA,
				exchangeB: config.exchangeB,
				entryThresholdApr: config.entryThresholdApr,
				exitThresholdApr: config.exitThresholdApr,
				sizeUsdt: config.sizeUsdt,
				leverage: config.leverage,
				sequence: config.sequence,
				status: config.status,
				activeTradeId: config.activeTradeId,
				updatedAt: config.updatedAt,
			})
			.where(eq(loopConfigs.id, config.id))
	}

	async getAll(): Promise<LoopConfig[]> {
		const rows = await this.db.select().from(loopConfigs)
		return rows.map((r) => ({
			id: r.id,
			symbol: r.symbol,
			exchangeA: r.exchangeA as Exchange,
			exchangeB: r.exchangeB as Exchange,
			entryThresholdApr: r.entryThresholdApr,
			exitThresholdApr: r.exitThresholdApr,
			sizeUsdt: r.sizeUsdt,
			leverage: r.leverage,
			sequence: r.sequence as OrderSequence,
			status: r.status as LoopStatus,
			currentSpread: null,
			activeTradeId: r.activeTradeId,
			createdAt: r.createdAt,
			updatedAt: r.updatedAt,
		}))
	}

	async getById(id: string): Promise<LoopConfig | null> {
		const rows = await this.db.select().from(loopConfigs).where(eq(loopConfigs.id, id)).limit(1)
		if (rows.length === 0) return null
		const r = rows[0]
		if (!r) return null
		return {
			id: r.id,
			symbol: r.symbol,
			exchangeA: r.exchangeA as Exchange,
			exchangeB: r.exchangeB as Exchange,
			entryThresholdApr: r.entryThresholdApr,
			exitThresholdApr: r.exitThresholdApr,
			sizeUsdt: r.sizeUsdt,
			leverage: r.leverage,
			sequence: r.sequence as OrderSequence,
			status: r.status as LoopStatus,
			currentSpread: null,
			activeTradeId: r.activeTradeId,
			createdAt: r.createdAt,
			updatedAt: r.updatedAt,
		}
	}

	async deleteById(id: string): Promise<boolean> {
		const result = await this.db
			.delete(loopConfigs)
			.where(eq(loopConfigs.id, id))
			.returning({ id: loopConfigs.id })
		return result.length > 0
	}
}
