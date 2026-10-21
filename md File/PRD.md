# Product Requirements Document (PRD)

## Project: GemPundit Attribute & Catalog Audit Tool
**Version:** 1.0.0  
**Status:** Active Production Tool  
**Authors:** GemPundit Engineering & Catalog Operations  
**Last Updated:** October 2026  

---

## 1. Executive Summary & Purpose

GemPundit manages a high-volume, dynamic e-commerce catalog consisting of loose gemstones (precious and semi-precious) and fine gemstone jewellery (rings, pendants, bracelets, earrings, brooches, necklaces). Catalog accuracy is vital: gemstone pricing depends on carat weight, tax classifications vary by cut and material, HSN codes regulate tax compliance under GST, and URL keys directly influence SEO performance and indexing.

The **GemPundit Attribute Audit Tool** is a dedicated internal platform engineered to:
1. Ingest, sanitize, and cache large catalog export reports (~60+ attributes per product, tens of thousands of SKUs) from Magento staging servers without causing browser freezing or dev-server crashes.
2. Automate consistency auditing against 12+ ground-truth database sheets (`gemstone2_wise`, `hsn metal gemstone`, `gem_type`, `sticker`, `j_colour`, etc.).
3. Identify catalog discrepancies across 14 distinct attribute dimensions (URL Keys, Weights, HSN codes, Tax classes, Stickers, Origins, Classifications, Video URLs, etc.).
4. Provide high-performance interactive editing capabilities with inline persistence to SQLite and batch CSV export for re-import into Magento.
5. Provide a dynamic Pricing Calculator using GemPundit's proprietary pricing tiers, tax brackets, and custom rounding algorithms.

---

## 2. Target Users & Personas

| Persona | Role | Key Jobs to be Done |
|---|---|---|
| **Catalog Operations Specialist** | Catalog Quality Assurance | Reviews flagged attributes, audits auto-generated recommendations, approves/edits values, exports delta CSV files for Magento import. |
| **Pricing & Merchandising Manager** | Pricing Updates & Margin Mgmt | Inputs Price Per Carat (PPC) values, verifies custom tier rounding, assigns "Call for Price" thresholds, audits discount tags and express dispatch tags. |
| **SEO Specialist** | URL & Metadata Maintenance | Reviews URL key divergence, flags irregular slug structures, checks keyword hyphenation and canonical format against reference databases. |
| **Inventory & Fulfillment Lead** | Stock Status Reconciliation | Audits active vs inactive products, reconciles out-of-stock items, verifies shipping & dispatch timelines. |

---

## 3. High-Level Workflows & User Journeys

```
[Magento Staging Export (report.csv)]
                 │
                 ▼
[Vite Server Proxy / Express Sync] ──> [Backup Snapshot (data/backups/)]
                 │
                 ├──> [Local SQLite Storage (data/audit.db)]
                 └──> [Sanitized Local Cache (data/report.csv)]
                              │
                              ▼
        [React Client (App.jsx + Web Worker Engine)]
                              │
  ┌───────────────────────────┼───────────────────────────┐
  ▼                           ▼                           ▼
[Overview / Raw Data]   [Attribute Audit Panels]    [Update Panels]
- Export Data Table     - Url Key Audit             - Price Calculator
- Image Database        - Gemstone HSN Audit        - Weight Update (Ratti)
- Video Database        - Jewellery HSN Audit       - In-Stock Review
- Gemstone Option Data  - Tax Class Audit           - Out-of-Stock Review
- Jewellery Option Data - Stickers / Labels Audit
                        - Origin / J-Colour Audit
                        - Video Link Health Audit
                              │
                              ▼
            [Interactive Inline Edit / CellInput]
                              │
                              ├──> [Instant Auto-Save to SQLite API]
                              └──> [Pre-formatted CSV Download for Magento]
```

---

## 4. Detailed Functional Requirements

### 4.1 Data Ingestion & Sync Pipeline
- **FR-1.1: Local Cache Autoload:** On app launch, automatically detect and load `data/report.csv` or `data/report-cache.json`. Display row count, column count, and cache age.
- **FR-1.2: Staging Server Refresh:** Provide a "Refresh Staging" action that connects via HTTP Basic Auth to `https://staging.gempundit.com/var/export/report.csv`.
- **FR-1.3: Non-Destructive Backup Rotation:** Save every newly downloaded report with an ISO timestamp into `data/backups/report-YYYY-MM-DDTHH-mm-ss.csv` before writing to `data/report.csv`.
- **FR-1.4: Schema Stripping & Row Filtering:**
  - Automatically filter out rows marked with `Disabled` status.
  - Automatically strip unneeded columns (e.g. `small_image`, `thumbnail`, `invoice_id`, `hole`, `strands`, `length_inches`, `vendor_id`) to conserve browser memory and speed up computation.
- **FR-1.5: Dev Server Resiliency:** Ignore `data/report.csv` and database JSON files from Vite's HMR watcher to prevent unwanted browser reloading while fetching or processing large files.

### 4.2 Interactive Report Table
- **FR-2.1: Multi-Filter Engine:** Support combined filtering across:
  - Free-text search (SKU, Name, URL Key, etc.) with 250ms debounce.
  - Attribute Set ID dropdown (e.g., `gemstones`, `rings`, `pendants`).
  - Status filter (`Enabled` vs `Disabled`).
  - Stock filter (`In Stock` vs `Out of Stock` based on `qty` and `is_in_stock`).
- **FR-2.2: Web Worker Offloading:** Perform large-dataset filtering and column sorting inside a dedicated background Web Worker (`auditWorker.js`) to guarantee a 60 FPS UI.
- **FR-2.3: Dynamic Column Auto-Sizing:** Auto-calculate column widths based on maximum character length of visible cell values.
- **FR-2.4: Column Visibility Toggle:** Allow users to hide/show specific columns from the report view.
- **FR-2.5: Multi-Row Selection:** Checkbox selection for individual rows or select-all for visible page rows.
- **FR-2.6: Pagination:** Page size selection (25, 50, 100, 250 rows) with quick jump and navigation controls.

### 4.3 Automated Attribute Audits
- **FR-3.1: URL Key Audit:**
  - Compares current URL against ground truth rule: `<base_url_key>-<sku>`.
  - Lookup base URL in `gemstone2_wise.csv` matching `gemstone2`.
  - Auto-flags status as `Valid` or `Needs Review` (if base gemstone slug has diverged).
- **FR-3.2: Weight (Ratti) Audit:**
  - Evaluates gemstone products: `expected_weight_ratti = carat_weight / 0.9`.
  - Generates updates formatted to 2 decimal places. Flags mismatches against current `weight_ratti`.
- **FR-3.3: Gemstone HSN Code Audit:**
  - Matches `gemstone2` against `gemstone2_wise.csv` standard HSN codes.
  - Normalizes numeric representations (stripping trailing `.0`).
- **FR-3.4: Jewellery HSN Code Audit:**
  - Parses jewellery SKUs to extract design codes (e.g. `A22`, `R1-SPARKLE`, `NAV-AC10-TRI`).
  - Detects diamond inclusion by matching extracted design codes against `DIAMOND_DESIGN_CODES` set.
  - Identifies base metal configuration (`silver`, `gold`, `panchdhatu`).
  - Cross-references `hsn metal gemstone.csv` to determine accurate 8-digit HSN code.
  - Handles fallback for imitation alloys.
- **FR-3.5: Tax Class Audit:**
  - Matches `gemstone2` against `gem_type.csv`.
  - Special rule: If cut or shape indicates `carved` / `carving`, automatically assigns tax class `Jewellery Corals`.
- **FR-3.6: Classification Audit:**
  - Validates `classification` (e.g., `Precious`, `Semi-Precious`) against `gem_type.csv`.
- **FR-3.7: Stickers & Certification Audit:**
  - Validates lab certifications (`certification`, `additional_certification`).
  - Cross-references `sticker.csv` to generate comma-separated sticker tags (e.g., `IGI`, `GIA`).
- **FR-3.8: J-Colour & Color Audit:**
  - Resolves non-standard certificate colors to standardized J-Colours using `J_Colour.csv`.
- **FR-3.9: Origin Audit:**
  - Validates gemstone origin against standard origin specifications in `gem_type.csv`.
- **FR-3.10: Product Name Audit:**
  - Sanitizes multiple consecutive spaces and standardizes hyphen padding (` - `).
- **FR-3.11: Dispatch & Shipping Days Audit:**
  - Maps numeric `shipping_days` to customer-facing `dispatch_days` text using `shipping & Dispatch.csv`.
- **FR-3.12: Video Link Health Audit:**
  - Filters products by `news_from_date` date range and `attribute_set_id`.
  - Joins with `videodata_new` to obtain video media URLs (`https://cdn2.gempundit.com/skin/video/...`).
  - Concurrently batches HTTP HEAD/GET health checks (concurrency = 10) to flag 404s or broken media.

### 4.4 Catalog Update & Pricing Workflows
- **FR-4.1: Dynamic Price Calculation:**
  - Given a user-entered `PPC` (Price Per Carat), automatically compute:
    1. Base tax rate (0.25% for regular gems, 3% for pearls and non-coral carvings, 5% for corals).
    2. Total raw price = `((PPC * tax) + PPC) * carat_weight`.
    3. Custom tiered rounding:
       - $\le 1,000 \rightarrow$ nearest 10
       - $\le 5,000 \rightarrow$ nearest 50
       - $\le 100,000 \rightarrow$ nearest 100
       - $\le 400,000 \rightarrow$ nearest 500
       - $\le 699,999 \rightarrow$ nearest 1,000
       - $\ge 700,000 \rightarrow$ capped at 700,000 ("Call for Price")
    4. Auto-calculated derived attributes: `price_per_carat`, `callfor`, `price_range`, `price_per_carat_range`, `offers` (auto-sets "Express Dispatch" for vendor GP under 700k), `product_category_type` (`P` if $> 40,000$, else `MP`), and audit comments.
- **FR-4.2: Stock Review & Inversion:**
  - "In Stock Review" panel filters for currently out-of-stock items to mark in stock.
  - "Active / Deactive Update" panel filters for in-stock items to mark out of stock.

### 4.5 Persistence & Export
- **FR-5.1: Dual Persistence:**
  - Client-side persistence via `idb-keyval` (IndexedDB) and `localStorage`.
  - Server-side persistence via REST PUT `/api/data/:id` writing to SQLite.
- **FR-5.2: Magento-Ready CSV Export:**
  - Automatic injection protection (prepends `'` to cells starting with `=`, `+`, `-`, `@`).
  - Streamed/chunked unparsing (5,000 row chunks) to prevent memory crashes.
  - Automatically appends today's date (`-YYYY-MM-DD.csv`) to filenames.
  - Respects `csvKey` remappings and `omitExport` flags.

---

## 5. Non-Functional Requirements (NFRs)

- **Performance:**
  - Must smoothly handle 20,000+ catalog rows in the browser without UI freezes.
  - Web Worker execution time for full filter + sort cycle under 80ms.
  - CSV unparsing time under 1.5 seconds for 10,000 rows.
- **Data Integrity & Security:**
  - Basic Auth credentials must never be exposed to the client bundle (held strictly in server proxy / `.env.local`).
  - CSV Formula Injection defense on all exported files.
  - SQLite transactions with batch limits during bulk ingest.
- **Reliability & Offline-First:**
  - Works seamlessly offline with local `data/report.csv` and local SQLite `data/audit.db`.
  - Retains all user modifications across navigation tabs and browser reloads.
- **Usability & Accessibility:**
  - Full keyboard accessibility for grid navigation.
  - Screen reader friendly ARIA labels and roles.
  - Dark Mode and Light Mode support with tailored color palettes.

---

## 6. Success Metrics & KPIs

| Metric | Target | Current Baseline |
|---|---|---|
| **Catalog Audit Cycle Time** | Reduced from 4 days to < 2 hours | ~1.5 hours with automated rule engines |
| **Catalog Error Rate in Production** | < 0.05% SKU attribute defects | Minimal due to pre-export rule validation |
| **Export File Magento Compatibility** | 100% first-pass import success | Zero field name or delimiter rejections |
| **Browser Memory Footprint** | Peak memory < 200MB for 25k SKUs | Maintained via column pruning & Web Workers |
