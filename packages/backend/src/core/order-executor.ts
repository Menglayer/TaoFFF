import type { HedgeTrade, OpenTradeRequest, TradeLeg } from "@taofff/shared"
import { Exchange, OrderSequence, PositionSide } from "@taofff/shared"
import ccxt, { type Exchange as CcxtExchange } from "ccxt"
import type { AppConfig } from "../config"
import type { ApiKeyRepository } from "../db/repositories"
import { decrypt } from "../security/crypto"

interface OrderResult {
	orderId: string
	filledPrice: number
	filledSize: number
	fees: number
}

export class OrderExecutor {
	constructor(
		private apiKeyRepo: ApiKeyRepository,
		private config: AppConfig,
	) {}

	/** Create an authenticated CCXT exchange instance */
	private async createAuthenticatedExchange(exchange: Exchange): Promise<CcxtExchange> {
		const keyRecord = await this.apiKeyRepo.getByExchange(exchange)
		if (!keyRecord) throw new Error(`No API key configured for ${exchange}`)
		if (!this.config.masterKey) throw new Error("MASTER_KEY not configured")

		const apiKey = decrypt(keyRecord.encryptedKey, this.config.masterKey)
		const secret = decrypt(keyRecord.encryptedSecret, this.config.masterKey)
		const passphrase = keyRecord.encryptedPassphrase
			? decrypt(keyRecord.encryptedPassphrase, this.config.masterKey)
			: undefined

		const options: Record<string, string | boolean> = {
			apiKey,
			secret,
			enableRateLimit: true,
		}
		if (passphrase) {
			// OKX uses 'password' for passphrase in CCXT
			;(options as Record<string, string | boolean>).password = passphrase
		}
		if (keyRecord.testnet) {
			options.sandbox = true
		}

		// Use the right CCXT exchange class
		switch (exchange) {
			case Exchange.Binance:
				return new ccxt.binance(options)
			case Exchange.OKX:
				return new ccxt.okx(options)
			case Exchange.Bybit:
				return new ccxt.bybit(options)
			case Exchange.Hyperliquid:
				throw new Error(`Exchange ${exchange} does not support trading via CCXT`)
			default:
				throw new Error(`Exchange ${exchange} does not support trading via CCXT`)
		}
	}

	/** Execute a market order on a single exchange */
	private async executeOrder(
		ex: CcxtExchange,
		symbol: string,
		side: PositionSide,
		sizeUsdt: number,
		leverage: number,
	): Promise<OrderResult> {
		await ex.loadMarkets()

		// Set leverage if supported
		try {
			await ex.setLeverage(leverage, symbol)
		} catch {
			// Some exchanges don't support setLeverage for all pairs — continue
		}

		// Convert USDT notional to contract size using mark price
		const ticker = await ex.fetchTicker(symbol)
		const price = ticker.last ?? ticker.close ?? 0
		if (price <= 0) throw new Error(`Cannot determine price for ${symbol}`)

		const amount = (sizeUsdt * leverage) / price

		const orderSide = side === PositionSide.Long ? "buy" : "sell"
		const order = await ex.createMarketOrder(symbol, orderSide, amount)

		return {
			orderId: order.id,
			filledPrice: order.average ?? order.price ?? price,
			filledSize: order.filled ?? amount,
			fees: order.fee?.cost ?? 0,
		}
	}

	/** Open a bilateral hedge trade */
	async openTrade(req: OpenTradeRequest): Promise<HedgeTrade> {
		const exA = await this.createAuthenticatedExchange(req.exchangeA)
		const exB = await this.createAuthenticatedExchange(req.exchangeB)

		let resultA: OrderResult
		let resultB: OrderResult

		// Map the CCXT symbol format (e.g., "BTC/USDT:USDT" for perpetual)
		const symbol = req.symbol.includes("/") ? req.symbol : `${req.symbol}/USDT:USDT`

		if (req.sequence === OrderSequence.Parallel) {
			// Execute both legs simultaneously
			;[resultA, resultB] = await Promise.all([
				this.executeOrder(exA, symbol, req.sideA, req.sizeUsdt, req.leverage),
				this.executeOrder(exB, symbol, req.sideB, req.sizeUsdt, req.leverage),
			])
		} else if (req.sequence === OrderSequence.AThenB) {
			resultA = await this.executeOrder(exA, symbol, req.sideA, req.sizeUsdt, req.leverage)
			resultB = await this.executeOrder(exB, symbol, req.sideB, req.sizeUsdt, req.leverage)
		} else {
			resultB = await this.executeOrder(exB, symbol, req.sideB, req.sizeUsdt, req.leverage)
			resultA = await this.executeOrder(exA, symbol, req.sideA, req.sizeUsdt, req.leverage)
		}

		const now = Date.now()
		const tradeId = `trade-${now}-${Math.random().toString(36).substring(2, 8)}`

		const legA: TradeLeg = {
			exchange: req.exchangeA,
			symbol: req.symbol,
			side: req.sideA,
			size: resultA.filledSize,
			entryPrice: resultA.filledPrice,
			exitPrice: null,
			leverage: req.leverage,
			fees: resultA.fees,
			orderId: resultA.orderId,
		}

		const legB: TradeLeg = {
			exchange: req.exchangeB,
			symbol: req.symbol,
			side: req.sideB,
			size: resultB.filledSize,
			entryPrice: resultB.filledPrice,
			exitPrice: null,
			leverage: req.leverage,
			fees: resultB.fees,
			orderId: resultB.orderId,
		}

		// Compute netAprAtEntry from the spread engine or passed in via config
		// For now, use 0 — the calling route will set this from the spread data
		const trade: HedgeTrade = {
			id: tradeId,
			symbol: req.symbol,
			legA,
			legB,
			netAprAtEntry: 0,
			realizedPnl: null,
			fundingEarned: 0,
			status: "open",
			openedAt: now,
			closedAt: null,
		}

		// Close exchange connections if needed (ccxt doesn't strictly require this for REST, but good practice if ws is used)
		// await exA.close()
		// await exB.close()

		return trade
	}

	/** Close an existing hedge trade */
	async closeTrade(trade: HedgeTrade): Promise<HedgeTrade> {
		const exA = await this.createAuthenticatedExchange(trade.legA.exchange)
		const exB = await this.createAuthenticatedExchange(trade.legB.exchange)

		const symbol = trade.symbol.includes("/") ? trade.symbol : `${trade.symbol}/USDT:USDT`

		// Close = opposite side
		const closeSideA =
			trade.legA.side === PositionSide.Long ? PositionSide.Short : PositionSide.Long
		const closeSideB =
			trade.legB.side === PositionSide.Long ? PositionSide.Short : PositionSide.Long

		const [closeA, closeB] = await Promise.all([
			this.executeOrder(
				exA,
				symbol,
				closeSideA,
				(trade.legA.size * trade.legA.entryPrice) / trade.legA.leverage,
				trade.legA.leverage,
			),
			this.executeOrder(
				exB,
				symbol,
				closeSideB,
				(trade.legB.size * trade.legB.entryPrice) / trade.legB.leverage,
				trade.legB.leverage,
			),
		])

		const now = Date.now()

		// Calculate PnL for each leg
		const pnlA =
			trade.legA.side === PositionSide.Long
				? (closeA.filledPrice - trade.legA.entryPrice) * trade.legA.size
				: (trade.legA.entryPrice - closeA.filledPrice) * trade.legA.size
		const pnlB =
			trade.legB.side === PositionSide.Long
				? (closeB.filledPrice - trade.legB.entryPrice) * trade.legB.size
				: (trade.legB.entryPrice - closeB.filledPrice) * trade.legB.size

		const totalFees = trade.legA.fees + trade.legB.fees + closeA.fees + closeB.fees
		const realizedPnl = pnlA + pnlB - totalFees

		const closed: HedgeTrade = {
			...trade,
			legA: { ...trade.legA, exitPrice: closeA.filledPrice, fees: trade.legA.fees + closeA.fees },
			legB: { ...trade.legB, exitPrice: closeB.filledPrice, fees: trade.legB.fees + closeB.fees },
			realizedPnl,
			status: "closed",
			closedAt: now,
		}

		return closed
	}
}
