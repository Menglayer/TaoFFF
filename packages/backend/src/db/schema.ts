import { sql } from "drizzle-orm"
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** Historical funding rate snapshots */
export const fundingRates = sqliteTable(
	"funding_rates",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		symbol: text("symbol").notNull(),
		exchange: text("exchange").notNull(),
		rate: real("rate").notNull(),
		apr: real("apr").notNull(),
		predictedRate: real("predicted_rate"),
		markPrice: real("mark_price").notNull(),
		indexPrice: real("index_price").notNull(),
		settlementHours: integer("settlement_hours").notNull(),
		nextSettlementTs: integer("next_settlement_ts").notNull(),
		receiveTs: integer("receive_ts").notNull(),
		createdAt: integer("created_at").notNull().default(sql`(unixepoch() * 1000)`),
	},
	(table) => ({
		symbolExchangeIdx: index("fr_symbol_exchange_idx").on(table.symbol, table.exchange),
		receiveTsIdx: index("fr_receive_ts_idx").on(table.receiveTs),
	}),
)

/** Detected pairwise arbitrage opportunities */
export const arbitrageOpportunities = sqliteTable(
	"arbitrage_opportunities",
	{
		id: text("id").primaryKey(),
		symbol: text("symbol").notNull(),
		longExchange: text("long_exchange").notNull(),
		shortExchange: text("short_exchange").notNull(),
		longRate: real("long_rate").notNull(),
		shortRate: real("short_rate").notNull(),
		grossApr: real("gross_apr").notNull(),
		leveragedApr: real("leveraged_apr").notNull(),
		borrowCostApr: real("borrow_cost_apr").notNull(),
		tradingCostApr: real("trading_cost_apr").notNull(),
		netApr: real("net_apr").notNull(),
		leverage: integer("leverage").notNull(),
		spreadPct: real("spread_pct").notNull(),
		detectedAt: integer("detected_at").notNull(),
	},
	(table) => ({
		symbolIdx: index("ao_symbol_idx").on(table.symbol),
		netAprIdx: index("ao_net_apr_idx").on(table.netApr),
		detectedAtIdx: index("ao_detected_at_idx").on(table.detectedAt),
	}),
)

/** User-configured alert rules */
export const alertRules = sqliteTable("alert_rules", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	metric: text("metric").notNull(),
	operator: text("operator").notNull(),
	threshold: real("threshold").notNull(),
	symbol: text("symbol"),
	exchange: text("exchange"),
	cooldownSeconds: integer("cooldown_seconds").notNull().default(300),
	enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
	createdAt: integer("created_at").notNull().default(sql`(unixepoch() * 1000)`),
	updatedAt: integer("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
})

/** Triggered alert events */
export const alertHistory = sqliteTable(
	"alert_history",
	{
		id: text("id").primaryKey(),
		ruleId: text("rule_id")
			.notNull()
			.references(() => alertRules.id, { onDelete: "cascade" }),
		ruleName: text("rule_name").notNull(),
		metric: text("metric").notNull(),
		operator: text("operator").notNull(),
		threshold: real("threshold").notNull(),
		actualValue: real("actual_value").notNull(),
		symbol: text("symbol").notNull(),
		exchange: text("exchange"),
		message: text("message").notNull(),
		triggeredAt: integer("triggered_at").notNull(),
	},
	(table) => ({
		ruleIdIdx: index("ah_rule_id_idx").on(table.ruleId),
		triggeredAtIdx: index("ah_triggered_at_idx").on(table.triggeredAt),
	}),
)

/** Notification log */
export const notificationLog = sqliteTable(
	"notification_log",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		alertEventId: text("alert_event_id").references(() => alertHistory.id),
		channel: text("channel").notNull().default("browser"),
		message: text("message").notNull(),
		sentAt: integer("sent_at").notNull().default(sql`(unixepoch() * 1000)`),
	},
	(table) => ({
		sentAtIdx: index("nl_sent_at_idx").on(table.sentAt),
	}),
)

/** Exchange health metrics over time */
export const venueMetricsHistory = sqliteTable(
	"venue_metrics_history",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		exchange: text("exchange").notNull(),
		latencyMs: real("latency_ms").notNull(),
		messageRate: real("message_rate").notNull(),
		errorRate: real("error_rate").notNull(),
		uptimePct: real("uptime_pct").notNull(),
		timestamp: integer("timestamp").notNull(),
	},
	(table) => ({
		exchangeIdx: index("vm_exchange_idx").on(table.exchange),
		timestampIdx: index("vm_timestamp_idx").on(table.timestamp),
	}),
)

/** Encrypted API key storage */
export const exchangeApiKeys = sqliteTable("exchange_api_keys", {
	exchange: text("exchange").primaryKey(),
	encryptedKey: text("encrypted_key").notNull(),
	encryptedSecret: text("encrypted_secret").notNull(),
	encryptedPassphrase: text("encrypted_passphrase"),
	walletAddress: text("wallet_address"),
	testnet: integer("testnet", { mode: "boolean" }).notNull().default(false),
	createdAt: integer("created_at").notNull().default(sql`(unixepoch() * 1000)`),
	updatedAt: integer("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
})

/** Executed trades for P&L tracking */
export const tradeHistory = sqliteTable(
	"trade_history",
	{
		id: text("id").primaryKey(),
		symbol: text("symbol").notNull(),
		legAExchange: text("leg_a_exchange").notNull(),
		legASide: text("leg_a_side").notNull(),
		legASize: real("leg_a_size").notNull(),
		legAEntryPrice: real("leg_a_entry_price").notNull(),
		legAExitPrice: real("leg_a_exit_price"),
		legALeverage: integer("leg_a_leverage").notNull(),
		legAFees: real("leg_a_fees").notNull().default(0),
		legAOrderId: text("leg_a_order_id").notNull(),
		legBExchange: text("leg_b_exchange").notNull(),
		legBSide: text("leg_b_side").notNull(),
		legBSize: real("leg_b_size").notNull(),
		legBEntryPrice: real("leg_b_entry_price").notNull(),
		legBExitPrice: real("leg_b_exit_price"),
		legBLeverage: integer("leg_b_leverage").notNull(),
		legBFees: real("leg_b_fees").notNull().default(0),
		legBOrderId: text("leg_b_order_id").notNull(),
		netAprAtEntry: real("net_apr_at_entry").notNull(),
		realizedPnl: real("realized_pnl"),
		fundingEarned: real("funding_earned").notNull().default(0),
		status: text("status").notNull().default("open"),
		openedAt: integer("opened_at").notNull(),
		closedAt: integer("closed_at"),
	},
	(table) => ({
		symbolIdx: index("th_symbol_idx").on(table.symbol),
		statusIdx: index("th_status_idx").on(table.status),
		openedAtIdx: index("th_opened_at_idx").on(table.openedAt),
	}),
)

/** Automated spread monitoring loops */
export const loopConfigs = sqliteTable("loop_configs", {
	id: text("id").primaryKey(),
	symbol: text("symbol").notNull(),
	exchangeA: text("exchange_a").notNull(),
	exchangeB: text("exchange_b").notNull(),
	entryThresholdApr: real("entry_threshold_apr").notNull(),
	exitThresholdApr: real("exit_threshold_apr").notNull(),
	sizeUsdt: real("size_usdt").notNull(),
	leverage: integer("leverage").notNull(),
	sequence: text("sequence").notNull().default("parallel"),
	status: text("status").notNull().default("stopped"),
	activeTradeId: text("active_trade_id"),
	createdAt: integer("created_at").notNull().default(sql`(unixepoch() * 1000)`),
	updatedAt: integer("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
})
