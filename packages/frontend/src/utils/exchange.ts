import { Exchange } from "@taofff/shared"

export const EXCHANGE_DISPLAY_NAME: Record<Exchange, string> = {
	[Exchange.Binance]: "Binance",
	[Exchange.Coinbase]: "Coinbase",
	[Exchange.OKX]: "OKX",
	[Exchange.Bybit]: "Bybit",
	[Exchange.Bitget]: "Bitget",
	[Exchange.Backpack]: "Backpack",
	[Exchange.Gate]: "Gate",
	[Exchange.KuCoin]: "KuCoin",
	[Exchange.HTX]: "HTX",
	[Exchange.MEXC]: "MEXC",
	[Exchange.Hyperliquid]: "Hyperliquid",
	[Exchange.Aster]: "Aster",
	[Exchange.Lighter]: "Lighter",
	[Exchange.GRVT]: "GRVT",
	[Exchange.Extended]: "Extended",
	[Exchange.EdgeX]: "edgeX",
}

export const EXCHANGE_TEXT_COLOR: Record<Exchange, string> = {
	[Exchange.Binance]: "text-[#F0B90B]",
	[Exchange.Coinbase]: "text-[#0052FF]",
	[Exchange.OKX]: "text-gray-100",
	[Exchange.Bybit]: "text-[#F7A600]",
	[Exchange.Bitget]: "text-[#00D2A0]",
	[Exchange.Backpack]: "text-[#8B5CF6]",
	[Exchange.Gate]: "text-[#16A34A]",
	[Exchange.KuCoin]: "text-[#14B8A6]",
	[Exchange.HTX]: "text-[#2563EB]",
	[Exchange.MEXC]: "text-[#3B82F6]",
	[Exchange.Hyperliquid]: "text-[#00D1A0]",
	[Exchange.Aster]: "text-[#E8491D]",
	[Exchange.Lighter]: "text-[#A78BFA]",
	[Exchange.GRVT]: "text-[#F59E0B]",
	[Exchange.Extended]: "text-[#38BDF8]",
	[Exchange.EdgeX]: "text-[#06B6D4]",
}

export const EXCHANGE_BG_COLOR: Record<Exchange, string> = {
	[Exchange.Binance]: "bg-[#F0B90B]/10 text-[#F0B90B]",
	[Exchange.Coinbase]: "bg-[#0052FF]/10 text-[#0052FF]",
	[Exchange.OKX]: "bg-gray-100/10 text-gray-100",
	[Exchange.Bybit]: "bg-[#F7A600]/10 text-[#F7A600]",
	[Exchange.Bitget]: "bg-[#00D2A0]/10 text-[#00D2A0]",
	[Exchange.Backpack]: "bg-[#8B5CF6]/10 text-[#8B5CF6]",
	[Exchange.Gate]: "bg-[#16A34A]/10 text-[#16A34A]",
	[Exchange.KuCoin]: "bg-[#14B8A6]/10 text-[#14B8A6]",
	[Exchange.HTX]: "bg-[#2563EB]/10 text-[#2563EB]",
	[Exchange.MEXC]: "bg-[#3B82F6]/10 text-[#3B82F6]",
	[Exchange.Hyperliquid]: "bg-[#00D1A0]/10 text-[#00D1A0]",
	[Exchange.Aster]: "bg-[#E8491D]/10 text-[#E8491D]",
	[Exchange.Lighter]: "bg-[#A78BFA]/10 text-[#A78BFA]",
	[Exchange.GRVT]: "bg-[#F59E0B]/10 text-[#F59E0B]",
	[Exchange.Extended]: "bg-[#38BDF8]/10 text-[#38BDF8]",
	[Exchange.EdgeX]: "bg-[#06B6D4]/10 text-[#06B6D4]",
}

export const EXCHANGE_DOT_COLOR: Record<Exchange, string> = {
	[Exchange.Binance]: "bg-[#F0B90B]",
	[Exchange.Coinbase]: "bg-[#0052FF]",
	[Exchange.OKX]: "bg-[#FFFFFF]",
	[Exchange.Bybit]: "bg-[#F7A600]",
	[Exchange.Bitget]: "bg-[#00D2A0]",
	[Exchange.Backpack]: "bg-[#8B5CF6]",
	[Exchange.Gate]: "bg-[#16A34A]",
	[Exchange.KuCoin]: "bg-[#14B8A6]",
	[Exchange.HTX]: "bg-[#2563EB]",
	[Exchange.MEXC]: "bg-[#3B82F6]",
	[Exchange.Hyperliquid]: "bg-[#00FF88]",
	[Exchange.Aster]: "bg-[#E8491D]",
	[Exchange.Lighter]: "bg-[#A78BFA]",
	[Exchange.GRVT]: "bg-[#F59E0B]",
	[Exchange.Extended]: "bg-[#38BDF8]",
	[Exchange.EdgeX]: "bg-[#06B6D4]",
}

export const ALL_EXCHANGES = Object.values(Exchange)
