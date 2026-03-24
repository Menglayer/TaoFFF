import type { SimBalance } from "@taofff/shared"
import type { SimBalanceRepository } from "../db/repositories"

export class SimBalanceManager {
	constructor(private repo: SimBalanceRepository) {}

	/** Initialize or get current balance */
	async initialize(amount: number = 100000): Promise<SimBalance> {
		let record = await this.repo.get()
		if (!record) {
			await this.repo.reset(amount)
			record = await this.repo.get()
		}
		return this.toModel(record!)
	}

	/** Get current balance state */
	async getBalance(): Promise<SimBalance | null> {
		const record = await this.repo.get()
		return record ? this.toModel(record) : null
	}

	/** Reserve margin when opening a position */
	async reserveMargin(amount: number): Promise<boolean> {
		const record = await this.repo.get()
		if (!record) return false
		if (record.currentBalance < amount) return false

		await this.repo.upsert({
			id: record.id,
			initialBalance: record.initialBalance,
			currentBalance: record.currentBalance - amount,
			reservedMargin: record.reservedMargin + amount,
			totalRealizedPnl: record.totalRealizedPnl,
			totalFundingEarned: record.totalFundingEarned,
			totalFeesSpent: record.totalFeesSpent,
		})
		return true
	}

	/** Release margin and apply P&L when closing a position */
	async releaseMargin(marginAmount: number, realizedPnl: number, fees: number): Promise<void> {
		const record = await this.repo.get()
		if (!record) return

		await this.repo.upsert({
			id: record.id,
			initialBalance: record.initialBalance,
			currentBalance: record.currentBalance + marginAmount + realizedPnl,
			reservedMargin: Math.max(0, record.reservedMargin - marginAmount),
			totalRealizedPnl: record.totalRealizedPnl + realizedPnl,
			totalFundingEarned: record.totalFundingEarned,
			totalFeesSpent: record.totalFeesSpent + fees,
		})
	}

	/** Apply funding earnings */
	async applyFunding(amount: number): Promise<void> {
		const record = await this.repo.get()
		if (!record) return

		await this.repo.upsert({
			id: record.id,
			initialBalance: record.initialBalance,
			currentBalance: record.currentBalance + amount,
			reservedMargin: record.reservedMargin,
			totalRealizedPnl: record.totalRealizedPnl,
			totalFundingEarned: record.totalFundingEarned + amount,
			totalFeesSpent: record.totalFeesSpent,
		})
	}

	/** Reset balance to initial amount */
	async reset(amount: number = 100000): Promise<SimBalance> {
		await this.repo.reset(amount)
		const record = await this.repo.get()
		return this.toModel(record!)
	}

	private toModel(
		record: NonNullable<Awaited<ReturnType<SimBalanceRepository["get"]>>>,
	): SimBalance {
		return {
			id: record.id,
			initialBalance: record.initialBalance,
			currentBalance: record.currentBalance,
			reservedMargin: record.reservedMargin,
			totalRealizedPnl: record.totalRealizedPnl,
			totalFundingEarned: record.totalFundingEarned,
			totalFeesSpent: record.totalFeesSpent,
			createdAt: record.createdAt,
			updatedAt: record.updatedAt,
		}
	}
}
