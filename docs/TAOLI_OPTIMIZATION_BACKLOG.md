# TaoLi-Inspired Optimization Backlog

Derived from taoli.tools / docs.taoli.tools patterns and mapped to TaoFFF.

## Implemented in this iteration

1. **Expanded Perp DEX coverage**
   - Added Aster, Lighter, GRVT, Extended (+ edgeX compatibility).

2. **Connector resilience improvements**
   - Added endpoint fallbacks and payload-shape tolerant parsing for volatile public APIs.

3. **Unified symbol normalization**
   - Standardized inconsistent venue symbols into U-based display conventions.

## Next high-value optimizations

1. **Exchange setup wizard pages (per venue)**
   - Similar to Taoli's detailed setup docs integrated into UI.

2. **Live risk board (position + fee + funding drift)**
   - Single panel for margin risk and funding reversal alerts.

3. **Execution diagnostics panel**
   - Per-exchange latency/error counters + retry telemetry.

4. **Public funding dashboard filters**
   - OI/24h volume/funding interval filters exposed in Funding page.

5. **Strategy safety rails**
   - Hard caps for leverage, max notional, and spread slippage guard.

6. **Per-venue credential checklist UX**
   - Required fields and permission hints by exchange type.
