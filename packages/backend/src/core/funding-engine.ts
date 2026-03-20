import {
	type ArbitrageOpportunity,
	DataQuality,
	deltaDict,
	type Exchange,
	type ExchangeStatus,
	type FundingRateSnapshot,
} from "@taofff/shared"

export class FundingEngine {
	/** symbol → exchange → snapshot */
	private rates = new Map<string, Map<string, FundingRateSnapshot>>()

	/** Previous state for delta computation */
	private previousRates = new Map<string, Map<string, FundingRateSnapshot>>()

	/** Exchange connection statuses */
	private exchangeStatuses = new Map<string, ExchangeStatus>()

	/** Detected arbitrage opportunities */
	private opportunities: ArbitrageOpportunity[] = []
	private opportunitiesChanged = false

	/** Update rates from an exchange adapter */
	updateRates(snapshots: FundingRateSnapshot[]): void {
		for (const snap of snapshots) {
			let symbolMap = this.rates.get(snap.symbol)
			if (!symbolMap) {
				symbolMap = new Map()
				this.rates.set(snap.symbol, symbolMap)
			}
			symbolMap.set(snap.exchange, snap)
		}
	}

	/** Update exchange status (merges with existing) */
	updateExchangeStatus(exchange: Exchange, status: Partial<ExchangeStatus>): void {
		const existing = this.exchangeStatuses.get(exchange)
		if (existing) {
			this.exchangeStatuses.set(exchange, { ...existing, ...status })
		} else {
			// Initialize a full ExchangeStatus when first seen
			const initial: ExchangeStatus = {
				exchange,
				connected: false,
				lastMessageTs: 0,
				symbolCount: 0,
				quality: DataQuality.Offline,
				errorCount: 0,
				lastError: null,
				...status,
			}
			this.exchangeStatuses.set(exchange, initial)
		}
	}

	/** Get full snapshot for initial WebSocket message */
	getFullSnapshot(): {
		rates: Record<string, Record<string, FundingRateSnapshot>>
		opportunities: ArbitrageOpportunity[]
		statuses: ExchangeStatus[]
	} {
		const rates: Record<string, Record<string, FundingRateSnapshot>> = {}
		for (const [symbol, exchangeMap] of this.rates) {
			rates[symbol] = Object.fromEntries(exchangeMap)
		}
		return {
			rates,
			opportunities: this.opportunities,
			statuses: Array.from(this.exchangeStatuses.values()),
		}
	}

	/**
	 * Compute delta since last broadcast using deltaDict() from shared.
	 * After calling this, the "previous" state is updated to current.
	 * Returns null if nothing changed.
	 */
	computeDelta(): {
		rates?: Record<string, Record<string, Partial<FundingRateSnapshot>>>
		statuses?: Partial<ExchangeStatus>[]
		opportunities?: ArbitrageOpportunity[]
	} | null {
		const ratesDelta: Record<string, Record<string, Partial<FundingRateSnapshot>>> = {}
		let hasRateChanges = false

		// Compare current rates with previous
		for (const [symbol, exchangeMap] of this.rates) {
			const prevSymbolMap = this.previousRates.get(symbol)

			for (const [exchangeId, snap] of exchangeMap) {
				const prevSnap = prevSymbolMap?.get(exchangeId)

				if (!prevSnap) {
					// New entry — include full snapshot as delta
					if (!ratesDelta[symbol]) ratesDelta[symbol] = {}
					ratesDelta[symbol][exchangeId] = snap
					hasRateChanges = true
				} else {
					// Compare fields using deltaDict
					const d = deltaDict(
						prevSnap as unknown as Record<string, unknown>,
						snap as unknown as Record<string, unknown>,
					)
					if (d) {
						if (!ratesDelta[symbol]) ratesDelta[symbol] = {}
						ratesDelta[symbol][exchangeId] = d as Partial<FundingRateSnapshot>
						hasRateChanges = true
					}
				}
			}
		}

		// Check for removed symbols/exchanges (in previous but not in current)
		// Not typical in this use case, but handled for correctness
		// (Removed entries are simply not included — client keeps stale data until next full snapshot)

		// Compute status deltas — compare serialized form
		// For simplicity, always include statuses if any exist
		// (statuses change infrequently; including them is cheap)

		const hasChanges = hasRateChanges || this.opportunitiesChanged

		if (!hasChanges) {
			// Still copy current to previous even if no changes detected
			this.snapshotCurrentToPrevious()
			return null
		}

		const result: {
			rates?: Record<string, Record<string, Partial<FundingRateSnapshot>>>
			statuses?: Partial<ExchangeStatus>[]
			opportunities?: ArbitrageOpportunity[]
		} = {}

		if (hasRateChanges) {
			result.rates = ratesDelta
		}

		if (this.opportunitiesChanged) {
			result.opportunities = this.opportunities
			this.opportunitiesChanged = false
		}

		// Copy current state to previous for next delta computation
		this.snapshotCurrentToPrevious()

		return result
	}

	/** Get all rates for REST API */
	getAllRates(): FundingRateSnapshot[] {
		const result: FundingRateSnapshot[] = []
		for (const exchangeMap of this.rates.values()) {
			for (const snap of exchangeMap.values()) {
				result.push(snap)
			}
		}
		return result
	}

	/** Get rates for a specific symbol */
	getSymbolRates(symbol: string): FundingRateSnapshot[] {
		const exchangeMap = this.rates.get(symbol)
		if (!exchangeMap) return []
		return Array.from(exchangeMap.values())
	}

	/** Get unique symbol list, sorted alphabetically */
	getSymbols(): string[] {
		return Array.from(this.rates.keys()).sort()
	}

	/** Get exchange list with status */
	getExchangeStatuses(): ExchangeStatus[] {
		return Array.from(this.exchangeStatuses.values())
	}

	/** Set detected opportunities */
	setOpportunities(opps: ArbitrageOpportunity[]): void {
		this.opportunities = opps
		this.opportunitiesChanged = true
	}

	/** Get detected opportunities */
	getOpportunities(): ArbitrageOpportunity[] {
		return this.opportunities
	}

	/** Deep-copy current rates into previousRates for next delta comparison */
	private snapshotCurrentToPrevious(): void {
		this.previousRates = new Map()
		for (const [symbol, exchangeMap] of this.rates) {
			const prevExchangeMap = new Map<string, FundingRateSnapshot>()
			for (const [exchangeId, snap] of exchangeMap) {
				// Shallow copy is sufficient — FundingRateSnapshot has only primitive fields
				prevExchangeMap.set(exchangeId, { ...snap })
			}
			this.previousRates.set(symbol, prevExchangeMap)
		}
	}
}
