# Exchange Dropdown Filtering Verification Report

**Date:** March 24, 2026  
**Page:** http://localhost:5173/trade  
**Symbol:** BTC/USDT  
**Status:** ✅ PASSED

---

## Summary

The exchange dropdown filtering is **working correctly**. All exchanges with zero price data (lighter, kucoin, mexc) are successfully filtered out from both long and short exchange dropdowns for BTC/USDT.

---

## Test Results

### Step 1: Exchange Dropdown Analysis

#### Long Exchange (做多) - Available Options: 12 total
- ✅ Binance
- ✅ OKX
- ✅ Bybit
- ✅ Bitget
- ✅ Backpack
- ✅ Gate
- ✅ HTX
- ✅ Hyperliquid
- ✅ Aster
- ✅ GRVT
- ✅ edgeX
- (+ 1 placeholder: "选择交易所")

#### Short Exchange (做空) - Available Options: 12 total
- ✅ Binance
- ✅ OKX
- ✅ Bybit
- ✅ Bitget
- ✅ Backpack
- ✅ Gate
- ✅ HTX
- ✅ Hyperliquid
- ✅ Aster
- ✅ GRVT
- ✅ edgeX
- (+ 1 placeholder: "选择交易所")

---

## Filtering Verification

### ❌ Problematic Exchanges (CORRECTLY FILTERED OUT)
| Exchange | Expected | Status | Notes |
|----------|----------|--------|-------|
| lighter | ABSENT | ✅ PASS | Not found in dropdowns (100% zero price data) |
| kucoin | ABSENT | ✅ PASS | Not found in dropdowns (100% zero price data) |
| mexc | ABSENT | ✅ PASS | Not found in dropdowns (100% zero price data) |

### ✅ Valid Exchanges (CORRECTLY PRESENT)
| Exchange | Status | Found In |
|----------|--------|----------|
| binance | ✅ PASS | Long & Short |
| okx | ✅ PASS | Long & Short |
| bybit | ✅ PASS | Long & Short |
| bitget | ✅ PASS | Long & Short |
| gate | ✅ PASS | Long & Short |
| hyperliquid | ✅ PASS | Long & Short |
| aster | ✅ PASS | Long & Short |
| backpack | ✅ PASS | Long & Short |

---

## Functionality Test

### Trade Execution Test
1. **Selected:** OKX (long) + Binance (short)
2. **Action:** Clicked "模拟开仓" (Simulate Opening Position)
3. **Result:** ✅ Successfully executed
   - Left panel shows: OKX / Binance selections
   - Trading history table populated with new trade entries
   - New row shows: BTC/USDT | OKX / Binance | $1,000 | 1x

---

## Screenshots Captured

| # | Screenshot | Description |
|---|-----------|-------------|
| 1 | 01_initial.png | Initial page load |
| 2 | 02_btc_selected.png | BTC/USDT symbol selected |
| 3 | 03_long_dropdown_open.png | Long exchange dropdown open (做多) |
| 4 | 04_short_dropdown_open.png | Short exchange dropdown open (做空) |
| 5 | 05_after_simulate_button.png | After clicking "模拟开仓" |

---

## Code Implementation Details

**File:** `packages/frontend/src/pages/TradingPage.tsx`

The filtering logic uses `availableExchanges` computed property that:
1. Fetches all funded rates for the selected symbol
2. Filters exchanges where BOTH `markPrice === 0` AND `indexPrice === 0`
3. Returns only exchanges with at least one valid price source
4. Applies the same filter to both long and short dropdowns

**Key Check:**
```typescript
const availableExchanges = fundedRates
  ?.filter(rate => rate.symbol === selectedSymbol)
  ?.map(rate => rate.exchange)
  ?.filter((ex, idx, arr) => arr.indexOf(ex) === idx) // unique
  ?.filter(exchange => {
    const hasPrice = fundedRates?.some(
      rate => rate.exchange === exchange && 
      (rate.markPrice !== 0 || rate.indexPrice !== 0)
    );
    return hasPrice;
  });
```

---

## Conclusion

✅ **VERIFICATION PASSED**

- Problematic exchanges (lighter, kucoin, mexc) are successfully filtered out
- All valid exchanges are present and selectable
- Trade execution functionality works correctly
- Both long and short dropdowns maintain consistent filtering
