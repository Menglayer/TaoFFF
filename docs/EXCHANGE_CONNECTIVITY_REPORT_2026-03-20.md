# Exchange Connectivity Report (2026-03-20)

## Scope

Validated public API connectivity for newly requested venues:

- Aster
- Lighter
- GRVT
- Extended (interpreted from "edge" in Taoli docs)
- edgeX (kept as compatibility adapter)

## Results

| Exchange | Endpoint(s) Checked | HTTP | Runtime Adapter Result | Status |
|---|---|---:|---|---|
| Aster | `/fapi/v1/premiumIndex`, `/fapi/v1/exchangeInfo` | 200 | symbols=322, rates=381 | ✅ PASS |
| Lighter | `/api/v1/funding-rates`, `/api/v1/orderBooks` | 200 | symbols=162, rates=154 | ✅ PASS |
| GRVT | `POST /full/v1/all_instruments`, `POST /full/v1/funding` | 200 | symbols=95, rates=95 | ✅ PASS |
| Extended | `/api/v1/info/markets` | 200 | symbols=103, rates=103 | ✅ PASS |
| edgeX | `/api/v1/public/meta/getMetaData`, funding endpoints | 200 | symbols=92, rates=92 | ✅ PASS |

## Key Fixes Applied During Validation

1. **GRVT endpoint correction**
   - Switched from `POST /full/v1/funding_rate` (404) to `POST /full/v1/funding` (200).
   - Keep latest record only per instrument to avoid history explosion.

2. **Lighter payload shape correction**
   - Updated parser to current fields: `market_id`, `symbol`, `rate`, `exchange`.
   - Filtered to `exchange === "lighter"` to avoid mixed upstream venues.

3. **edgeX metadata + funding fallback**
   - Metadata uses `contractList` (not `contractDataList` in current mainnet payload).
   - Added fallback path via `getFundingRatePage` when `getLatestFundingRate` returns empty list.
   - Normalized symbols like `BTCUSD` -> `BTC/USDT` for unified U-based UI.

## Notes

- Extended is the Taoli-documented venue under “Perp DEX > Extended”.
- edgeX adapter is retained for compatibility and future routing/testing flexibility.
