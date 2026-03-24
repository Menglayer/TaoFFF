/**
 * Annualize a per-period funding rate to APR (percentage).
 *
 * @param rate - Funding rate as a decimal (e.g., 0.0001 = 0.01%)
 * @param settlementHours - Hours between settlements (8 for most CEX, 1 for Hyperliquid)
 * @returns APR as percentage (e.g., 10.95)
 */
export function computeApr(rate: number, settlementHours: number): number {
	const periodsPerDay = 24 / settlementHours
	return rate * periodsPerDay * 365 * 100
}

/**
 * Compute the price spread between two venues as a percentage.
 *
 * Formula: -A+B = (A_Bid1 - B_Ask1) * 2 / (A_Bid1 + B_Ask1) * 100
 *
 * @param priceA - Price on exchange A
 * @param priceB - Price on exchange B
 * @returns Spread as percentage
 */
export function computeSpread(priceA: number, priceB: number): number {
	if (priceA + priceB === 0) return 0
	return (((priceA - priceB) * 2) / (priceA + priceB)) * 100
}

/**
 * Determine which side to long and which to short based on funding rates.
 *
 * Rules:
 * - Both positive: short the higher APR, long the lower
 * - Both negative: short the less-negative, long the more-negative
 * - Mixed: long the negative-rate exchange, short the positive
 *
 * @returns [longExchangeIndex, shortExchangeIndex] — 0 for A, 1 for B
 */
export function assignSides(aprA: number, aprB: number): [longIdx: 0 | 1, shortIdx: 0 | 1] {
	// The exchange you pay funding on → short it (earn funding)
	// The exchange you receive funding on → long it (pay less or earn)
	if (aprA >= aprB) {
		// A has higher rate → short A, long B
		return [1, 0]
	}
	// B has higher rate → short B, long A
	return [0, 1]
}

/**
 * Compute the gross APR from a funding rate spread.
 */
export function computeGrossApr(shortApr: number, longApr: number): number {
	return Math.abs(shortApr - longApr)
}

/**
 * Compute the leveraged APR.
 */
export function computeLeveragedApr(grossApr: number, leverage: number): number {
	return grossApr * leverage
}

/**
 * Compute the borrow cost APR (percentage).
 *
 * @param borrowRateDaily - Daily borrow rate as decimal (e.g., 0.0001)
 * @param leverage - Position leverage
 */
export function computeBorrowCostApr(borrowRateDaily: number, leverage: number): number {
	return borrowRateDaily * 365 * 100 * (leverage - 1)
}

/**
 * Compute the entry/exit trading cost as a percentage.
 *
 * @param feePct - Trading fee percentage
 * @param slippagePct - Expected slippage percentage
 */
export function computeEntryExitCostPct(feePct: number, slippagePct: number): number {
	// 4 trades total: open A, open B, close A, close B
	return 4.0 * (feePct + slippagePct)
}

/**
 * Compute the annualized trading cost APR.
 */
export function computeTradingCostApr(
	entryExitCostPct: number,
	rebalanceTimesPerYear: number,
	leverage: number,
): number {
	return entryExitCostPct * rebalanceTimesPerYear * leverage
}

/**
 * Compute the net APR — THE KEY METRIC for hedge arbitrage profitability.
 *
 * netApr = leveragedApr - borrowCostApr - tradingCostApr
 */
export function computeNetApr(params: {
	shortApr: number
	longApr: number
	leverage: number
	borrowRateDaily: number
	feePct: number
	slippagePct: number
	rebalanceTimesPerYear: number
}): number {
	const grossApr = computeGrossApr(params.shortApr, params.longApr)
	const leveragedApr = computeLeveragedApr(grossApr, params.leverage)
	const borrowCostApr = computeBorrowCostApr(params.borrowRateDaily, params.leverage)
	const entryExitCostPct = computeEntryExitCostPct(params.feePct, params.slippagePct)
	const tradingCostApr = computeTradingCostApr(
		entryExitCostPct,
		params.rebalanceTimesPerYear,
		params.leverage,
	)
	return leveragedApr - borrowCostApr - tradingCostApr
}

// ─── Simulation Formulas ───

/**
 * Compute unrealized P&L for a single leg.
 *
 * @param entryPrice - Entry price of the position
 * @param markPrice - Current mark price
 * @param size - Position size in base currency
 * @param side - "long" or "short"
 * @returns Unrealized P&L in quote currency (USDT)
 */
export function computeUnrealizedPnl(
	entryPrice: number,
	markPrice: number,
	size: number,
	side: "long" | "short",
): number {
	if (side === "long") {
		return (markPrice - entryPrice) * size
	}
	return (entryPrice - markPrice) * size
}

/**
 * Compute simulated fill price with slippage applied.
 *
 * @param markPrice - Current mark price
 * @param slippagePct - Slippage percentage (e.g., 0.02 = 0.02%)
 * @param side - "long" (buy, price goes up) or "short" (sell, price goes down)
 * @returns Simulated fill price after slippage
 */
export function computeSimFillPrice(
	markPrice: number,
	slippagePct: number,
	side: "long" | "short",
): number {
	const slippageMultiplier = slippagePct / 100
	if (side === "long") {
		// Buying pushes price up
		return markPrice * (1 + slippageMultiplier)
	}
	// Selling pushes price down
	return markPrice * (1 - slippageMultiplier)
}

/**
 * Compute simulated trading fees for a single leg.
 *
 * @param notionalUsdt - Notional value in USDT
 * @param feePct - Fee percentage (e.g., 0.05 = 0.05%)
 * @returns Fee amount in USDT
 */
export function computeSimFees(notionalUsdt: number, feePct: number): number {
	return notionalUsdt * (feePct / 100)
}

/**
 * Compute required margin for a position.
 *
 * @param sizeUsdt - Position size in USDT
 * @param leverage - Leverage multiplier
 * @returns Required margin in USDT
 */
export function computeRequiredMargin(sizeUsdt: number, leverage: number): number {
	return sizeUsdt / leverage
}
