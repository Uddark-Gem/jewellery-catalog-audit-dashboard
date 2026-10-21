# Project Tracker & Implementation Roadmap (TRACKER.md)

## GemPundit Attribute & Catalog Audit Tool
**Document Version:** 1.0.0  
**Current Release:** v1.0.0 (Production Stable)  
**Maintenance Owner:** GemPundit Engineering & Catalog Operations  

---

## 1. Feature Status Matrix

| Module / Feature | Status | Implemented In | Notes / Verification |
|---|---|---|---|
| **Data Ingestion & Staging Sync** | ✅ Done | `server/index.js`, `vite.config.js` | Basic Auth, streaming backup, transaction batching. |
| **Local SQLite Persistence** | ✅ Done | `server/db.js`, `data/audit.db` | Indexed SQLite store with parameterized queries. |
| **Pruning Disabled Rows & Columns** | ✅ Done | `vite.config.js` | 27 unused columns removed, disabled rows dropped. |
| **HMR Watcher Exception Handling** | ✅ Done | `vite.config.js` | Prevents dev-server reload during CSV/cache sync. |
| **Multithreaded Filter & Sort** | ✅ Done | `src/lib/auditWorker.js` | Web Worker execution keeps table UI at 60 FPS. |
| **Interactive Report Table** | ✅ Done | `src/components/ReportTable.jsx` | Pagination, dynamic column sizing, multi-select. |
| **URL Key Audit Panel** | ✅ Done | `src/lib/auditGenerators.js` | Differentiates `Valid` vs `Needs Review`. |
| **Weight (Ratti) Audit Panel** | ✅ Done | `src/lib/auditGenerators.js` | `Carat / 0.9` formula to 2 decimal places. |
| **Gemstone HSN Audit Panel** | ✅ Done | `src/lib/auditGenerators.js` | Mapped against `gemstone2_wise.csv`. |
| **Jewellery HSN Audit Panel** | ✅ Done | `src/lib/auditGenerators.js` | Design code extraction, diamond detection (150+). |
| **Tax Class Audit Panel** | ✅ Done | `src/lib/auditGenerators.js` | Carved gemstone auto-assignment rule. |
| **Stickers & Certification Audit** | ✅ Done | `src/lib/auditGenerators.js` | Main + additional lab certification validation. |
| **J-Colour Audit Panel** | ✅ Done | `src/lib/auditGenerators.js` | Harmonizes certificate color with standard code. |
| **Origin Audit Panel** | ✅ Done | `src/lib/auditGenerators.js` | Validates geographical origins. |
| **Name Normalization Audit** | ✅ Done | `src/lib/auditGenerators.js` | Whitespace & hyphen padding cleanup. |
| **Dispatch & Shipping Audit** | ✅ Done | `src/lib/auditGenerators.js` | Synchronizes shipping days to dispatch days text. |
| **Dynamic Price Calculator** | ✅ Done | `src/lib/auditGenerators.js` | Custom tiered rounding, taxes, callfor, ranges. |
| **In-Stock & Out-of-Stock Panels** | ✅ Done | `src/components/StockPanel.jsx` | Functional inversion filter for inventory review. |
| **Video Link Health Checker** | ✅ Done | `src/components/VideoAuditPanel.jsx`| Date range filter, async batch checks (concurrency 10). |
| **Batch CSV Exporter** | ✅ Done | `src/lib/csv.js` | Formula injection defense, dated filenames. |
| **State Lifting Across Panels** | ✅ Done | `src/App.jsx` | Preserves edits when switching tabs. |
| **Dark & Light Mode** | ✅ Done | `src/index.css`, `src/App.jsx` | Custom slate/blue tokens with zero contrast issues. |
| **Python Media ETL Scripts** | ✅ Done | `process_images.py`, `process_videodata.py` | Media matrix unrolling & CDN prepending. |
| **Gemstone & Jewellery Option Split** | ✅ Done | `src/App.jsx`, `vite.config.js` | Separates custom options into Gemstone & Jewellery subsets. |
| **Direct Magento REST API Push** | 📋 Planned | Future Milestone | Direct write-back to Magento without manual CSV. |
| **Audit Revision History Log** | 📋 Backlog | Future Milestone | Storing who edited which cell at what timestamp. |

---

## 2. Completed Milestones & Deep Audit Changelog

### Deep Audit & Stabilization (July – October 2026)
- **Security Hardening:**
  - Removed all hardcoded Basic Auth credentials from client and server repositories. Credentials now reside strictly in environment variables (`.env.local`).
  - Added strict CSV Formula Injection mitigation in `exportRowsAsCsv` (`'` prepended to `=`, `+`, `-`, `@`).
- **Performance & Stability:**
  - Implemented client-side Web Worker (`auditWorker.js`) to offload multi-criteria filtering and sorting for 25,000+ catalog rows.
  - Implemented chunked CSV unparsing in `csv.js` (batches of 5,000 rows) to eliminate browser lockups on export.
  - Excluded `data/report.csv` and JSON caches from Vite's file watcher, fixing runaway dev-server reloads.
  - Resolved tab freeze and sluggish switching on 80,000+ row views (`templatetagproduct_gemstone` and `templatetagproduct_jewellery`): eliminated synchronous UUID/regex enrichment overhead, streamlined dropdown option extraction to bounded sample loops, and fixed conditional tab activation state bug in `App.jsx`.
- **Data Integrity & Usability:**
  - Lifted table state into `App.jsx`, ensuring edits in "Export Data" or "Update Panels" persist seamlessly when toggling views.
  - Inverted stock panel filtering: `In Stock Review` now correctly displays out-of-stock items, and `Active / Deactive Update` displays in-stock items.
  - Implemented resilient SQLite transactions with batch limits of 1,000 rows during synchronization.
  - Separated duplicate custom options into dedicated extra columns (e.g. `Certificate-1`, `Custom Options-1`, `Weight Option-1`, `Jewellry Option-1`, `Diamond Substitute-1`, etc.) for both Gemstone and Jewellery datasets instead of comma concatenation.

---

## 3. Roadmap & Upcoming Work

```
  Q4 2026 (Near-Term)             Q1 2027 (Mid-Term)            Q2 2027 (Long-Term)
┌─────────────────────────┐     ┌────────────────────────┐    ┌─────────────────────────┐
│ - Automated Nightly     │     │ - Direct Magento 2     │    │ - Full AI Catalog Copilot│
│   Sync via Cron         │ ──> │   REST API Connector   │ ──>│   (Predictive pricing & │
│ - User Activity Audit   │     │ - Role-Based Access    │    │   auto-categorization)  │
│   Log (Author tracking) │     │   Control (Admin/Editor│    │ - Multi-Storefront Sync │
└─────────────────────────┘     └────────────────────────┘    └─────────────────────────┘
```

### 3.1 Near-Term Backlog (Q4 2026)
- [ ] **Nightly Automated Sync:** Run `server/index.js` sync as a scheduled cron job at 02:00 AM IST to pre-populate `data/audit.db`.
- [ ] **Author Session Prompt:** Modal prompt on first price edit asking for operator name/initials to tag in `comment_explation`.
- [ ] **Export Selection:** Allow exporting only selected rows via checkbox rather than full table.

### 3.2 Mid-Term Initiatives (Q1 2027)
- [ ] **Direct Magento 2 Integration:** Connect to Magento 2 Bulk API (`/rest/default/async/bulk/V1/products`) to push delta updates directly, eliminating manual CSV export/import steps.
- [ ] **Authentication & Access Control:** Add lightweight OAuth / Google Workspace SSO for team member attribution.

---

## 4. Verification & QA Checklist

Every pull request or release must pass this verification baseline:

- [ ] **Static Code Analysis:** `npm run lint` (`oxlint`) completes with `0 errors, 0 warnings`.
- [ ] **Production Build:** `npm run build` (`vite build`) completes without build errors or chunk warnings.
- [ ] **CSV Injection Verification:** Exported CSVs starting with formula triggers (`=SUM()`, `+1`, `-cmd`) must have prepended single quotes.
- [ ] **Memory Benchmark:** Memory consumption during 20,000 row load must remain under 250MB heap.
- [ ] **Worker Latency:** Filter query execution in `auditWorker.js` must complete in $< 100\text{ms}$.
- [ ] **SQLite Transaction Test:** Bulk sync of 25,000 rows completes in $< 15\text{s}$ without database locks.
