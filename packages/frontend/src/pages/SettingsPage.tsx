import { AlertMetric, AlertOperator, type AlertRule, Exchange } from "@taofff/shared"
import { useEffect, useState } from "react"
import { addToast } from "../components/Toast"
import { useAlertStore } from "../stores/alertStore"
import { useConfigStore } from "../stores/configStore"
import { EXCHANGE_DOT_COLOR } from "../utils/exchange"

const API = import.meta.env.DEV ? "http://localhost:8080" : ""

interface ApiKeyConfig {
	apiKey: string
	secret: string
	passphrase: string
	walletAddress: string
	testnet: boolean
}

interface ConfigState {
	exchanges: Array<{
		exchange: string
		hasPassphrase: boolean
		walletAddress: string | null
		testnet: boolean
		createdAt: number
		updatedAt: number
	}>
	settings: {
		minNetAprPct: number
		tradingFeePct: number
		slippagePct: number
		defaultLeverage: number
		borrowRateDaily: number
		rebalanceTimesPerYear: number
	}
	saveApiKey: (exchange: string, config: ApiKeyConfig) => Promise<void>
	deleteApiKey: (exchange: string) => Promise<void>
	testConnection: (exchange: string) => Promise<boolean>
}

export function SettingsPage() {
	const {
		exchanges,
		settings,
		loading,
		fetchExchanges,
		saveApiKey,
		deleteApiKey,
		testConnection,
		updateSettings,
	} = useConfigStore()
	const { rules, fetchRules, createRule, updateRule, deleteRule } = useAlertStore()

	useEffect(() => {
		fetchExchanges()
		fetchRules()
	}, [fetchExchanges, fetchRules])

	return (
		<div className="p-6 max-w-7xl mx-auto space-y-8 pb-20">
			<div>
				<h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
				<p className="text-gray-400">Manage your API keys, arbitrage configuration, and alerts.</p>
			</div>

			<div className="space-y-8">
				<ExchangeKeysSection
					exchanges={exchanges}
					onSave={saveApiKey}
					onDelete={deleteApiKey}
					onTest={testConnection}
					loading={loading}
				/>

				<ArbitrageConfigSection
					settings={settings}
					onSave={(newSettings: Partial<ConfigState["settings"]>) => {
						updateSettings(newSettings)
						addToast("Settings saved locally", "success")
					}}
				/>

				<AlertRulesSection
					rules={rules}
					onCreate={createRule}
					onUpdate={updateRule}
					onDelete={deleteRule}
				/>

				<DataExportSection />
			</div>
		</div>
	)
}

function ExchangeKeysSection({
	exchanges,
	onSave,
	onDelete,
	onTest,
	loading,
}: {
	exchanges: ConfigState["exchanges"]
	onSave: ConfigState["saveApiKey"]
	onDelete: ConfigState["deleteApiKey"]
	onTest: ConfigState["testConnection"]
	loading: boolean
}) {
	const exchangeList = Object.values(Exchange)

	return (
		<section>
			<h2 className="text-lg font-semibold text-white mb-4">Exchange API Keys</h2>
			<div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
				{exchangeList.map((exName) => {
					const config = exchanges.find((e) => e.exchange === exName)
					return (
						<div key={exName} className="bg-[#1a1b2e] border border-[#2a2b4a] rounded-xl p-6">
							<div className="flex items-center gap-2 mb-4">
								<span
									className={`w-3 h-3 rounded-full ${EXCHANGE_DOT_COLOR[exName as Exchange] || "bg-gray-500"}`}
								/>
								<h3 className="text-md font-medium text-white capitalize">{exName}</h3>
								{config && (
									<span className="ml-auto text-xs font-medium px-2 py-1 bg-green-900/50 text-green-400 rounded-full">
										✓ Configured
									</span>
								)}
							</div>

							{config ? (
								<div className="space-y-4">
									<p className="text-sm text-gray-400">
										Last updated: {new Date(config.updatedAt).toLocaleString()}
									</p>
									<div className="flex gap-2">
										<button
											type="button"
											onClick={async () => {
												const ok = await onTest(exName)
												if (ok) addToast(`Connection to ${exName} successful`, "success")
												else addToast(`Connection to ${exName} failed`, "error")
											}}
											disabled={loading}
											className="flex-1 bg-[#2a2b4a] hover:bg-[#3a3b5a] text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
										>
											Test Connection
										</button>
										<button
											type="button"
											onClick={async () => {
												await onDelete(exName)
												addToast(`Deleted ${exName} key`, "info")
											}}
											disabled={loading}
											className="px-4 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
										>
											Delete
										</button>
									</div>
								</div>
							) : (
								<ApiKeyForm exchange={exName} onSave={onSave} loading={loading} />
							)}
						</div>
					)
				})}
			</div>
		</section>
	)
}

function ApiKeyForm({
	exchange,
	onSave,
	loading,
}: {
	exchange: string
	onSave: ConfigState["saveApiKey"]
	loading: boolean
}) {
	const [apiKey, setApiKey] = useState("")
	const [secret, setSecret] = useState("")
	const [passphrase, setPassphrase] = useState("")
	const [walletAddress, setWalletAddress] = useState("")
	const [testnet, setTestnet] = useState(false)
	const [show, setShow] = useState(false)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!apiKey || !secret) return
		await onSave(exchange, { apiKey, secret, passphrase, walletAddress, testnet })
		addToast(`Saved ${exchange} API key`, "success")
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-3">
			<div>
				<input
					type={show ? "text" : "password"}
					placeholder="API Key"
					value={apiKey}
					onChange={(e) => setApiKey(e.target.value)}
					className="w-full bg-[#0d0e1a] border border-[#2a2b4a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none transition-colors"
					required
				/>
			</div>
			<div className="relative">
				<input
					type={show ? "text" : "password"}
					placeholder="API Secret"
					value={secret}
					onChange={(e) => setSecret(e.target.value)}
					className="w-full bg-[#0d0e1a] border border-[#2a2b4a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none pr-14 transition-colors"
					required
				/>
				<button
					type="button"
					onClick={() => setShow(!show)}
					className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs hover:text-white"
				>
					{show ? "Hide" : "Show"}
				</button>
			</div>

			{exchange === Exchange.OKX && (
				<div>
					<input
						type={show ? "text" : "password"}
						placeholder="Passphrase"
						value={passphrase}
						onChange={(e) => setPassphrase(e.target.value)}
						className="w-full bg-[#0d0e1a] border border-[#2a2b4a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none transition-colors"
						required
					/>
				</div>
			)}

			{exchange === Exchange.Hyperliquid && (
				<div>
					<input
						type="text"
						placeholder="Wallet Address"
						value={walletAddress}
						onChange={(e) => setWalletAddress(e.target.value)}
						className="w-full bg-[#0d0e1a] border border-[#2a2b4a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none transition-colors"
						required
					/>
				</div>
			)}

			<label className="flex items-center gap-2 cursor-pointer mt-2 w-max">
				<input
					type="checkbox"
					checked={testnet}
					onChange={(e) => setTestnet(e.target.checked)}
					className="accent-indigo-500 rounded bg-[#0d0e1a] border-[#2a2b4a] w-4 h-4"
				/>
				<span className="text-sm text-gray-300">Testnet</span>
			</label>

			<button
				type="submit"
				disabled={loading || !apiKey || !secret}
				className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 rounded-lg transition-colors mt-2 disabled:opacity-50"
			>
				Save Key
			</button>
		</form>
	)
}

function ArbitrageConfigSection({
	settings,
	onSave,
}: {
	settings: ConfigState["settings"]
	onSave: (settings: Partial<ConfigState["settings"]>) => void
}) {
	const [form, setForm] = useState(settings)

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target
		setForm((prev) => ({ ...prev, [name]: parseFloat(value) || 0 }))
	}

	return (
		<section>
			<h2 className="text-lg font-semibold text-white mb-4">Arbitrage Configuration</h2>
			<div className="bg-[#1a1b2e] border border-[#2a2b4a] rounded-xl p-6">
				<p className="text-xs text-gray-400 mb-6">
					These settings are loaded from server environment variables. Changes here apply to the UI
					only.
				</p>

				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
					{[
						{ label: "Min Net APR (%)", name: "minNetAprPct", step: "0.1" },
						{ label: "Trading Fee (%)", name: "tradingFeePct", step: "0.01" },
						{ label: "Slippage (%)", name: "slippagePct", step: "0.01" },
						{ label: "Default Leverage", name: "defaultLeverage", step: "1" },
						{ label: "Borrow Rate Daily", name: "borrowRateDaily", step: "0.0001" },
						{ label: "Rebalance Times/Year", name: "rebalanceTimesPerYear", step: "1" },
					].map((field) => (
						<div key={field.name}>
							<label className="block text-sm font-medium text-gray-300 mb-1">{field.label}</label>
							<input
								type="number"
								name={field.name}
								value={settings[field.name as keyof ConfigState["settings"]]}
								onChange={handleChange}
								step={field.step}
								className="w-full bg-[#0d0e1a] border border-[#2a2b4a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none transition-colors"
							/>
						</div>
					))}
				</div>

				<button
					type="button"
					onClick={() => onSave(form)}
					className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors"
				>
					Save Configuration
				</button>
			</div>
		</section>
	)
}

function AlertRulesSection({
	rules,
	onCreate,
	onUpdate,
	onDelete,
}: {
	rules: AlertRule[]
	onCreate: (rule: Omit<AlertRule, "id" | "createdAt" | "updatedAt">) => Promise<void>
	onUpdate: (id: string, updates: { enabled?: boolean }) => void
	onDelete: (id: string) => Promise<void>
}) {
	const [showForm, setShowForm] = useState(false)

	return (
		<section>
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-lg font-semibold text-white">Alert Rules</h2>
				<button
					type="button"
					onClick={() => setShowForm(!showForm)}
					className="bg-[#2a2b4a] hover:bg-[#3a3b5a] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
				>
					{showForm ? "Cancel" : "Create New Rule"}
				</button>
			</div>

			{showForm && (
				<div className="bg-[#1a1b2e] border border-[#2a2b4a] rounded-xl p-6 mb-4">
					<AlertRuleForm
						onSubmit={async (data) => {
							await onCreate(data)
							setShowForm(false)
							addToast("Rule created", "success")
						}}
					/>
				</div>
			)}

			<div className="space-y-3">
				{rules.length === 0 ? (
					<div className="text-center py-8 border border-dashed border-gray-700 rounded-xl bg-[#1a1b2e]/50">
						<p className="text-gray-500 text-sm">No alert rules configured.</p>
					</div>
				) : (
					rules.map((rule) => (
						<div
							key={rule.id}
							className="bg-[#1a1b2e] border border-[#2a2b4a] rounded-xl p-4 flex flex-col sm:flex-row gap-4 sm:items-center justify-between transition-colors hover:border-indigo-500/50"
						>
							<div>
								<h3 className="text-white font-medium flex items-center gap-2 text-sm">
									{rule.name}
									{!rule.enabled && (
										<span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 font-semibold uppercase tracking-wider">
											Disabled
										</span>
									)}
								</h3>
								<p className="text-xs text-gray-400 mt-1.5 flex items-center gap-2">
									<span className="bg-[#0d0e1a] px-2 py-1 rounded text-gray-300 font-mono">
										{rule.metric} {rule.operator} {rule.threshold}
									</span>
									{rule.symbol && <span className="text-indigo-400">{rule.symbol}</span>}
									{rule.exchange && <span className="text-purple-400">{rule.exchange}</span>}
								</p>
							</div>
							<div className="flex items-center gap-4">
								<label className="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={rule.enabled}
										onChange={(e) => {
											onUpdate(rule.id, { enabled: e.target.checked })
											addToast(`Rule ${e.target.checked ? "enabled" : "disabled"}`, "info")
										}}
										className="accent-indigo-500 rounded bg-[#0d0e1a] border-[#2a2b4a] w-4 h-4"
									/>
									<span className="text-sm text-gray-300 select-none">Enabled</span>
								</label>
								<button
									type="button"
									onClick={async () => {
										await onDelete(rule.id)
										addToast("Rule deleted", "info")
									}}
									className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors px-2 py-1 bg-red-400/10 hover:bg-red-400/20 rounded"
								>
									Delete
								</button>
							</div>
						</div>
					))
				)}
			</div>
		</section>
	)
}

function AlertRuleForm({
	onSubmit,
}: {
	onSubmit: (data: {
		name: string
		metric: AlertMetric
		operator: AlertOperator
		threshold: number
		symbol: string | null
		exchange: Exchange | null
		cooldownSeconds: number
		enabled: boolean
	}) => Promise<void>
}) {
	const [form, setForm] = useState({
		name: "",
		metric: AlertMetric.FundingRate,
		operator: AlertOperator.GreaterThan,
		threshold: "",
		symbol: "",
		exchange: "",
		cooldownSeconds: 300,
		enabled: true,
	})

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		onSubmit({
			...form,
			threshold: parseFloat(form.threshold as string),
			symbol: form.symbol || null,
			exchange: (form.exchange || null) as Exchange | null,
		})
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
				<div className="sm:col-span-2">
					<label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
					<input
						type="text"
						value={form.name}
						onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
						className="w-full bg-[#0d0e1a] border border-[#2a2b4a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none transition-colors"
						required
						placeholder="e.g. High APR Alert"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium text-gray-300 mb-1">Metric</label>
					<select
						value={form.metric}
						onChange={(e) => setForm((p) => ({ ...p, metric: e.target.value as AlertMetric }))}
						className="w-full bg-[#0d0e1a] border border-[#2a2b4a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none transition-colors"
					>
						{Object.values(AlertMetric).map((m) => (
							<option key={m} value={m}>
								{m}
							</option>
						))}
					</select>
				</div>

				<div>
					<label className="block text-sm font-medium text-gray-300 mb-1">Operator</label>
					<select
						value={form.operator}
						onChange={(e) => setForm((p) => ({ ...p, operator: e.target.value as AlertOperator }))}
						className="w-full bg-[#0d0e1a] border border-[#2a2b4a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none transition-colors"
					>
						{Object.values(AlertOperator).map((o) => (
							<option key={o} value={o}>
								{o}
							</option>
						))}
					</select>
				</div>

				<div>
					<label className="block text-sm font-medium text-gray-300 mb-1">Operator</label>
					<select
						value={form.operator}
						onChange={(e) => setForm((p) => ({ ...p, operator: e.target.value as AlertOperator }))}
						className="w-full bg-[#0d0e1a] border border-[#2a2b4a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none transition-colors"
					>
						{Object.values(AlertOperator).map((o) => (
							<option key={o} value={o}>
								{o}
							</option>
						))}
					</select>
				</div>

				<div>
					<label className="block text-sm font-medium text-gray-300 mb-1">Threshold</label>
					<input
						type="number"
						step="any"
						value={form.threshold}
						onChange={(e) => setForm((p) => ({ ...p, threshold: e.target.value }))}
						className="w-full bg-[#0d0e1a] border border-[#2a2b4a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none transition-colors"
						required
					/>
				</div>

				<div>
					<label className="block text-sm font-medium text-gray-300 mb-1">Symbol (Optional)</label>
					<input
						type="text"
						value={form.symbol}
						onChange={(e) => setForm((p) => ({ ...p, symbol: e.target.value }))}
						className="w-full bg-[#0d0e1a] border border-[#2a2b4a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none transition-colors uppercase"
						placeholder="e.g. BTC-USDT"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium text-gray-300 mb-1">
						Exchange (Optional)
					</label>
					<select
						value={form.exchange}
						onChange={(e) => setForm((p) => ({ ...p, exchange: e.target.value }))}
						className="w-full bg-[#0d0e1a] border border-[#2a2b4a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none transition-colors capitalize"
					>
						<option value="">Any Exchange</option>
						{Object.values(Exchange).map((ex) => (
							<option key={ex} value={ex}>
								{ex}
							</option>
						))}
					</select>
				</div>

				<div>
					<label className="block text-sm font-medium text-gray-300 mb-1">Cooldown (s)</label>
					<input
						type="number"
						min="0"
						value={form.cooldownSeconds}
						onChange={(e) =>
							setForm((p) => ({ ...p, cooldownSeconds: parseInt(e.target.value, 10) || 0 }))
						}
						className="w-full bg-[#0d0e1a] border border-[#2a2b4a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none transition-colors"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium text-gray-300 mb-1">Symbol (Optional)</label>
					<input
						type="text"
						value={form.symbol}
						onChange={(e) => setForm((p) => ({ ...p, symbol: e.target.value }))}
						className="w-full bg-[#0d0e1a] border border-[#2a2b4a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none transition-colors uppercase"
						placeholder="e.g. BTC-USDT"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium text-gray-300 mb-1">
						Exchange (Optional)
					</label>
					<select
						value={form.exchange}
						onChange={(e) => setForm((p) => ({ ...p, exchange: e.target.value }))}
						className="w-full bg-[#0d0e1a] border border-[#2a2b4a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none transition-colors capitalize"
					>
						<option value="">Any Exchange</option>
						{Object.values(Exchange).map((ex) => (
							<option key={ex} value={ex}>
								{ex}
							</option>
						))}
					</select>
				</div>

				<div>
					<label className="block text-sm font-medium text-gray-300 mb-1">Cooldown (s)</label>
					<input
						type="number"
						min="0"
						value={form.cooldownSeconds}
						onChange={(e) =>
							setForm((p) => ({ ...p, cooldownSeconds: parseInt(e.target.value, 10) || 0 }))
						}
						className="w-full bg-[#0d0e1a] border border-[#2a2b4a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none transition-colors"
					/>
				</div>
			</div>

			<div className="flex items-center justify-between pt-4 border-t border-[#2a2b4a]">
				<label className="flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						checked={form.enabled}
						onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
						className="accent-indigo-500 rounded bg-[#0d0e1a] border-[#2a2b4a] w-4 h-4"
					/>
					<span className="text-sm text-gray-300 select-none">Enabled</span>
				</label>
				<button
					type="submit"
					className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
				>
					Create Rule
				</button>
			</div>
		</form>
	)
}

function DataExportSection() {
	const downloadCsv = (endpoint: string, filename: string) => {
		const link = document.createElement("a")
		link.href = `${API}${endpoint}`
		link.download = filename
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
	}

	return (
		<section>
			<h2 className="text-lg font-semibold text-white mb-4">Data Export</h2>
			<div className="bg-[#1a1b2e] border border-[#2a2b4a] rounded-xl p-6">
				<p className="text-sm text-gray-400 mb-4">
					Export your historical data as CSV for external analysis.
				</p>
				<div className="flex flex-wrap gap-4">
					<button
						type="button"
						onClick={() => downloadCsv("/api/export/rates", "rates.csv")}
						className="flex items-center gap-2 bg-[#2a2b4a] hover:bg-[#3a3b5a] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
					>
						<span>📊</span> Export Rates
					</button>
					<button
						type="button"
						onClick={() => downloadCsv("/api/export/trades", "trades.csv")}
						className="flex items-center gap-2 bg-[#2a2b4a] hover:bg-[#3a3b5a] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
					>
						<span>⚡</span> Export Trades
					</button>
					<button
						type="button"
						onClick={() => downloadCsv("/api/export/opportunities", "opportunities.csv")}
						className="flex items-center gap-2 bg-[#2a2b4a] hover:bg-[#3a3b5a] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
					>
						<span>🔍</span> Export Opportunities
					</button>
				</div>
			</div>
		</section>
	)
}
