import { randomUUID } from "node:crypto"
import type {
	AlertEvent,
	AlertRule,
	ArbitrageOpportunity,
	FundingRateSnapshot,
} from "@taofff/shared"
import { AlertMetric, AlertOperator, type Exchange } from "@taofff/shared"
import type { AlertHistoryRepository, AlertRuleRepository } from "../db/repositories"
import type { WsHub } from "./ws-hub"

export class AlertEngine {
	private rules: Map<string, AlertRule> = new Map()
	private lastTriggeredAt: Map<string, number> = new Map()

	constructor(
		private ruleRepo: AlertRuleRepository,
		private historyRepo: AlertHistoryRepository,
		private wsHub: WsHub,
	) {}

	async loadRules(): Promise<void> {
		const enabledRules = await this.ruleRepo.getEnabled()
		this.rules.clear()
		for (const rule of enabledRules) {
			this.rules.set(rule.id, rule)
		}
	}

	async reloadRules(): Promise<void> {
		await this.loadRules()
	}

	addRule(rule: AlertRule): void {
		if (rule.enabled) {
			this.rules.set(rule.id, rule)
		}
	}

	updateRule(rule: AlertRule): void {
		if (rule.enabled) {
			this.rules.set(rule.id, rule)
		} else {
			this.rules.delete(rule.id)
		}
	}

	removeRule(id: string): void {
		this.rules.delete(id)
		this.lastTriggeredAt.delete(id)
	}

	evaluate(rates: FundingRateSnapshot[], opportunities: ArbitrageOpportunity[]): void {
		const now = Date.now()

		for (const rule of this.rules.values()) {
			const lastTriggered = this.lastTriggeredAt.get(rule.id) || 0
			if (now - lastTriggered < rule.cooldownSeconds * 1000) {
				continue
			}

			let triggered = false

			if (rule.metric === AlertMetric.FundingRate || rule.metric === AlertMetric.Apr) {
				for (const rate of rates) {
					if (rule.symbol && rule.symbol !== rate.symbol) continue
					if (rule.exchange && rule.exchange !== rate.exchange) continue

					const value = rule.metric === AlertMetric.FundingRate ? rate.rate : rate.apr
					if (this.checkThreshold(value, rule.operator, rule.threshold)) {
						this.triggerAlert(rule, value, rate.symbol, rate.exchange, now)
						triggered = true
						break // Only trigger once per rule per evaluation
					}
				}
			} else if (rule.metric === AlertMetric.NetApr || rule.metric === AlertMetric.Spread) {
				for (const opp of opportunities) {
					if (rule.symbol && rule.symbol !== opp.symbol) continue

					const value = rule.metric === AlertMetric.NetApr ? opp.netApr : opp.spreadPct
					if (this.checkThreshold(value, rule.operator, rule.threshold)) {
						this.triggerAlert(rule, value, opp.symbol, undefined, now)
						triggered = true
						break // Only trigger once per rule per evaluation
					}
				}
			} else if (rule.metric === AlertMetric.MarginRatio) {
				// Margin ratio not implemented yet in snapshots/opportunities
			}

			if (triggered) {
				this.lastTriggeredAt.set(rule.id, now)
			}
		}
	}

	private checkThreshold(value: number, operator: AlertOperator, threshold: number): boolean {
		switch (operator) {
			case AlertOperator.GreaterThan:
				return value > threshold
			case AlertOperator.GreaterOrEqual:
				return value >= threshold
			case AlertOperator.LessThan:
				return value < threshold
			case AlertOperator.LessOrEqual:
				return value <= threshold
			case AlertOperator.Equal:
				return value === threshold
			default:
				return false
		}
	}

	private triggerAlert(
		rule: AlertRule,
		actualValue: number,
		symbol: string,
		exchange: string | undefined,
		now: number,
	): void {
		const event: AlertEvent = {
			id: randomUUID(),
			ruleId: rule.id,
			ruleName: rule.name,
			metric: rule.metric,
			operator: rule.operator,
			threshold: rule.threshold,
			actualValue,
			symbol,
			exchange: (exchange as Exchange) ?? null,
			message: `Alert triggered for ${rule.name}: ${rule.metric} ${rule.operator} ${rule.threshold} (Actual: ${actualValue})`,
			triggeredAt: now,
		}

		// Persist to DB asynchronously
		this.historyRepo.insert(event).catch((err) => {
			console.error("Failed to insert alert history:", err)
		})

		// Broadcast via WS
		this.wsHub.broadcastAlert(event)
	}
}
