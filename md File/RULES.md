# Business Rules & Catalog Audit Specifications (RULES.md)

## GemPundit Attribute & Catalog Audit Tool
**Document Version:** 1.0.0  
**Implementation Source:** `src/lib/auditGenerators.js` & `vite.config.js`  

---

## 1. Overview & Execution Model

This document serves as the authoritative specification of all business rules, mathematical formulas, and data consistency checks implemented within the GemPundit Attribute Audit Tool. 

All audit functions are pure, deterministic generators that compare catalog rows from Magento staging against ground-truth CSV reference sheets (`Database/*.csv`). Only rows that deviate from the expected standard are returned as discrepancy records in the audit panels.

---

## 2. Catalog Sanitization & Ingestion Rules

Before any business audit is executed, raw export data from Magento (`report.csv`) passes through sanitization filters:

### Rule SAN-01: Pruning Disabled SKUs
- **Condition:** Any row where `String(row.status).toLowerCase()` contains `"disabled"`.
- **Action:** Row is excluded from client-side state and caching. Only active/enabled catalog items are audited.

### Rule SAN-02: Stripping Audit-Unused Columns
To maintain a small browser memory footprint, the following 27 unneeded Magento export columns are stripped:
```
sku_for_vendor_product, vendor_id, special_price, weight_carat, weight_sort1,
gem_composition, return_policy, offer_type, description, short_description,
description2, small_image, thumbnail, invoice_id, news_to_date,
promotion_discount_price, additional_certification, verified_certificateimage,
verified_certificateimage1, length_cm, how_to_wear, arrangement_type,
strands, length_inches, beads_in_strand, beads_size, hole, call_for_price_text
```

### Rule SAN-03: Number Normalization
- All numeric text fields (such as `qty`, `price`, `hsn_code`) have trailing `.0` or `.00` removed and commas stripped via `trimDecimalText()`.

---

## 3. Attribute Audit Rules

### 3.1 URL Key Audit (`buildUrlKeyAuditRows`)
Ensures every loose gemstone follows GemPundit's SEO-canonical slug naming convention.

- **Scope:** `attribute_set_id.toLowerCase() == 'gemstones'`
- **Lookup Sheet:** `gemstone2_wise.csv` matching `gemstone2`
- **Rule Formula:**
  $$\text{expected\_url\_key} = \text{base\_url\_key} + \text{"-"} + \text{sku}$$
  *(All characters normalized to lowercase, trimmed, with leading/trailing slashes removed).*
- **Discrepancy Condition:**
  $$\text{current\_url\_key} \neq \text{expected\_url\_key}$$
- **Validation Status Categorization:**
  - `Valid`: The URL key needs standard SKU suffix attachment matching the gemstone base.
  - `Needs Review`: The previous URL used a completely different gemstone base slug, indicating potential misclassification or re-indexing risk.

---

### 3.2 Weight (Ratti) Audit (`buildWeightAuditRows`)
Standardizes traditional Indian gemological weight (Ratti) against metric Carat weight.

- **Scope:** `attribute_set_id.toLowerCase() == 'gemstones'`
- **Conversion Formula:**
  $$\text{expected\_weight\_ratti} = \frac{\text{carat\_weight}}{0.90}$$
- **Precision:** Rounded and formatted to strictly 2 decimal places (`toFixed(2)`).
- **Discrepancy Condition:**
  $$\text{formatRatti}(\text{current\_weight\_ratti}) \neq \text{formatRatti}(\text{expected\_weight\_ratti})$$

---

### 3.3 Gemstone HSN Code Audit (`buildHsnAuditRows`)
Validates Indian GST Harmonized System of Nomenclature (HSN) codes for loose gemstones.

- **Scope:** `attribute_set_id.toLowerCase() == 'gemstones'`
- **Lookup Sheet:** `gemstone2_wise.csv` matching `gemstone2`
- **Discrepancy Condition:**
  $$\text{current\_hsn} \neq \text{reference\_hsn}$$
  *(Normalized to strip decimal suffixes, e.g. `71031020.0` $\rightarrow$ `71031020`).*

---

### 3.4 Fine Jewellery HSN Code Audit (`buildJewelleryHsnAuditRows`)
Calculates the legally compliant 8-digit HSN code for finished gemstone jewellery based on metal type, design code, and diamond embellishments.

- **Scope:** `attribute_set_id` belongs to `DESIGN_CODE_SETS`:
  `bracelets`, `rings`, `pendants`, `earrings`, `brooches`, `necklaces` (and their `config x002` counterparts).
- **Metal Mapping Rule:**
  - `Sterling Silver` $\rightarrow$ `silver`
  - `Gold` $\rightarrow$ `gold`
  - `Panchdhatu` $\rightarrow$ `panchdhatu`
  - `White Silver Plated Alloy` $\rightarrow$ *Excluded from audit*
- **Design Code Extraction from SKU:**
  - Format: `<TYPE>-<DESIGN_CODE>-...` (e.g. `R123-A22-SIL`).
  - Special Modifier: If SKU part #2 is `NAV`, code is taken from index 2 (e.g. `R123-NAV-AC10-TRI`).
  - Suffix Merging: Suffixes `SPARKLE`, `DAZZLE`, `CAP`, `TRI` are concatenated (e.g. `R1-SPARKLE`).
- **Diamond Detection:**
  - If extracted `designCode` exists in the set `DIAMOND_DESIGN_CODES` (150+ verified designs), `metal_two` is set to `"diamond"`. Otherwise, `metal_two` is `""`.
- **Reference Lookup:** Matches `hsn metal gemstone.csv` on:
  $$\text{gemstone} = \text{row.gemstone} \quad \land \quad \text{metal\_one} = \text{mappedMetal} \quad \land \quad \text{metal\_two} = \text{diamondTag}$$
- **Fallback Rule:** If a diamond combination is undefined in the matrix (e.g. Panchdhatu imitation alloy), it falls back to the base metal entry without diamond.
- **Discrepancy Condition:**
  $$\text{current\_hsn} \neq \text{expected\_hsn}$$

---

### 3.5 Tax Class Audit (`buildTaxClassAuditRows`)
Validates tax rate category assignment in Magento.

- **Scope:** `attribute_set_id.toLowerCase() == 'gemstones'`
- **Special Carving Override:**
  - If `cut.toLowerCase() == 'carved'` OR `shape.toLowerCase() \in ['carving', 'carved']`:
  - **Expected Tax Class:** `"Jewellery Corals"` (Note: Marked with `Auto-assigned (Carved)`).
- **Standard Lookup:**
  - Matches `gem_type.csv` on `gemstone2` to retrieve `tax_class_id`.
- **Discrepancy Condition:**
  $$\text{current\_tax\_class} \neq \text{expected\_tax\_class}$$

---

### 3.6 Classification Audit (`buildClassificationAuditRows`)
Validates whether a gemstone is categorized as Precious vs. Semi-Precious.

- **Scope:** `attribute_set_id.toLowerCase() == 'gemstones'`
- **Lookup Sheet:** `gem_type.csv` matching `gemstone2`
- **Discrepancy Condition:**
  $$\text{current\_classification} \neq \text{reference\_classification}$$

---

### 3.7 Certification & Stickers Audit (`buildStickerAuditRows`)
Validates badge stickers displayed on product listing and detail pages based on authenticating gemological laboratories.

- **Scope:** `attribute_set_id.toLowerCase() == 'gemstones'`
- **Lookup Sheet:** `sticker.csv`
- **Rule Logic:**
  1. Lookup main certification (`row.certification`) in `sticker.csv`. If found and value $\neq \text{"0"}$, add sticker tag.
  2. Lookup additional certification (`row.additional_certification`). If found and value $\neq \text{"0"}$, add sticker tag.
  3. Sort and join expected sticker tags as comma-separated list.
- **Discrepancy Condition:**
  Sorted array of `current_stickers` $\neq$ Sorted array of `expected_stickers`.

---

### 3.8 J-Colour Standardization Audit (`buildJColourAuditRows`)
Translates non-uniform certificate color descriptions into GemPundit standard J-Colour codes.

- **Lookup Sheet:** `J_Colour.csv`
- **Rule Logic:** Matches `Color On certificate` from `J_Colour.csv` against product `colour`.
- **Discrepancy Condition:**
  $$\text{current\_j\_colour.toLowerCase()} \neq \text{reference\_j\_colour.toLowerCase()}$$

---

### 3.9 Gemstone Origin Audit (`buildOriginAuditRows`)
Ensures standard geographical origin strings (e.g. "Burma", "Ceylon", "Kashmir", "Zambia").

- **Scope:** `attribute_set_id.toLowerCase() == 'gemstones'`
- **Lookup Sheet:** `gem_type.csv` matching `gemstone2`
- **Discrepancy Condition:**
  $$\text{current\_origin.toLowerCase()} \neq \text{reference\_origin.toLowerCase()}$$

---

### 3.10 Product Name Normalization (`buildNameAuditRows`)
Enforces typographic quality standards on product titles.

- **Rule Logic:**
  1. Replaces multiple consecutive spaces (`\s+`) with a single space.
  2. Standardizes hyphens with symmetric spacing (`\s*-\s*` $\rightarrow$ `" - "`).
- **Discrepancy Condition:**
  $$\text{sanitized\_name} \neq \text{current\_name}$$

---

### 3.11 Shipping & Dispatch Days Audit (`buildDispatchAuditRows`)
Synchronizes internal warehouse handling days with customer-facing delivery text.

- **Lookup Sheet:** `shipping & Dispatch.csv`
- **Discrepancy Condition:**
  Current `dispatch_days` does not match the mapped text for the corresponding `shipping_days`.

---

### 3.12 Gemstone Benefits Audit (`buildBenefitsAuditRows`)
Validates astrological, energetic, and health benefits assigned to products against authoritative gemstone mappings.

- **Lookup Sheet:** `Gem_Type.csv`
- **Rule Logic:** Matches `gemstone2` against reference rows in `Gem_Type.csv` to retrieve canonical `gemstone_benifits`.
- **Target Report Field:** `gemstone_benifits_new`
- **Discrepancy Condition:**
  $$\text{normalizeLookupValue}(\text{current\_gemstone\_benifits\_new}) \neq \text{normalizeLookupValue}(\text{reference\_gemstone\_benifits})$$

---

## 4. Pricing & Margin Calculation Engine (`calculatePriceRow`)

When an operator inputs or updates `PPC` (Price Per Carat), the application recalculates the entire pricing profile using this exact sequence:

```
[PPC Input] + [Tax Rate Calculation] + [Carat Weight]
                      │
                      ▼
     [Raw Price: ((PPC * Tax) + PPC) * Carat]
                      │
                      ▼
        [Custom Tiered Rounding Rule]
                      │
                      ▼
               [Computed Price]
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
  [Price Per Carat] [Call For Price] [Price Range]
        │             │             │
        ▼             ▼             ▼
  [Offers Badge]    [Category: P/MP][Audit Comment]
```

### 4.1 Applicable Tax Rate Formula
$$\text{Tax Rate} = \begin{cases} 
0.05 \text{ (5\%)} & \text{if Gemstone contains 'Coral'} \\
0.03 \text{ (3\%)} & \text{if Shape is 'Carving'/'Carved' and Gemstone not Coral} \\
0.03 \text{ (3\%)} & \text{if Gemstone is 'Pearl'} \\
0.0025 \text{ (0.25\%)} & \text{otherwise (Standard precious/semi-precious)}
\end{cases}$$

### 4.2 Raw Price Formula
$$\text{Raw Price} = ((\text{PPC} \times \text{Tax Rate}) + \text{PPC}) \times \text{carat\_weight}$$

### 4.3 Custom Tiered Rounding (`customRound`)
To ensure clean commercial pricing in INR:
$$\text{Price} = \begin{cases}
\text{round}(\text{Raw Price} / 10) \times 10 & \text{if Raw Price} \le 1,000 \\
\text{round}(\text{Raw Price} / 50) \times 50 & \text{if Raw Price} \le 5,000 \\
\text{round}(\text{Raw Price} / 100) \times 100 & \text{if Raw Price} \le 100,000 \\
\text{round}(\text{Raw Price} / 500) \times 500 & \text{if Raw Price} \le 400,000 \\
\text{round}(\text{Raw Price} / 1000) \times 1000 & \text{if Raw Price} \le 699,999 \\
700,000 & \text{if Raw Price} \ge 700,000
\end{cases}$$

### 4.4 Derived Price Attributes
1. **Price Per Carat (`price_per_carat`):**
   - If `Price == 700000` and `Gemstone == 'Alexandrite'`: `500000`
   - If `Price == 700000`: `0`
   - Else: `Math.round(Price / carat_weight)`
2. **Call for Price Flag (`callfor`):**
   - If `Price > 699999`: `"Call for Price"`, else `""`.
3. **Price Range Rounding (`roundRange`):**
   - Rounded in 500 increments (`500 * Math.round(x / 500)`).
   - If rounded value exceeds `Price`, subtract 500.
4. **Offers Tag (`offers`):**
   - If `Price == 700000`: `"Call for Price"`.
   - If `vendor == 'GP'` and `Price < 700000`: `"Express Dispatch"`.
5. **Product Category Type (`product_category_type`):**
   - If `Price > 40000`: `"P"` (Prestige).
   - Else: `"MP"` (Mass Prestige).
6. **Audit Comment (`comment_explation`):**
   - Automatically appends: `Price update on DD-MM-YYYY by <Author>`.

---

## 5. Stock Review & Inversion Logic

- **In-Stock Identification Rule (`isRowInStock`):**
  A product is considered in stock if `is_in_stock \in ['1', 'true', 'yes', 'in stock']` OR `parseFloat(qty) > 0`.
- **In-Stock Review Panel:**
  Displays products where `isRowInStock == false` to facilitate restocking. Action defaults to `"Mark in stock"`.
- **Active / Deactive Update Panel:**
  Displays products where `isRowInStock == true` to facilitate deactivating exhausted inventory. Action defaults to `"Mark out of stock"`.

---

## 6. Custom Option Data Partitioning (Gemstone vs. Jewellery)

To eliminate matrix sparsity and phantom columns, custom option data from `templatetagproduct` is cleanly split into two dedicated views based on product category:

### 6.1 Gemstone Custom Option Data (`templatetagproduct_gemstone`)
- **Applicable Attribute Sets (Case-Insensitive):**
  - `Gemstones`
  - `beads-necklace-byquality`
  - `Gemstones - Config1`
- **Output Columns:**
  - Product Metadata: `sku`, `product_url`, `attribute_set_id`, `gemstone`, `shape`, `cut`, `qty`, `is_in_stock`, `status`
  - Options: `Pooja`, `Certificate`, `Custom Options`, `Weight Option`
- **Consolidation Rule:** If multiple option values exist for a SKU (e.g. secondary certificates), they are merged into a clean comma-separated string rather than creating phantom `-1`, `-2` columns.

### 6.2 Jewellery Custom Option Data (`templatetagproduct_jewellery`)
- **Applicable Attribute Sets (Case-Insensitive):**
  - `Bracelets - Config X002`
  - `Rings - Config X002`
  - `Pendants - Config X002`
  - `Earrings - Config X002`
  - `Brooches - Config X002`
  - `Necklaces - Config X002`
- **Output Columns:**
  - Product Metadata: `sku`, `product_url`, `attribute_set_id`, `gemstone`, `shape`, `cut`, `qty`, `is_in_stock`, `status`
  - Options: `Pooja`, `Certificate`, `Weight Option`, `Jewellry Option`, `Gold Option`, `Diamond Substitute`, `Costing`, `Ring Size System`, `Bracelet Chain`, `Bracelet Size`
- **Consolidation Rule:** All jewellery option titles (which previously spawned up to 33 overflow columns) are consolidated directly into `Jewellry Option`.

### 6.3 Custom Option Pruning & Issue Policy (`custom_option_issues`)
- **Rule CO-01 (Pruning Disabled SKUs):**
  If a SKU is disabled in Magento (or missing from the active `report.csv` catalog), its custom option template tag data is completely purged rather than retained or logged as an anomaly.
- **Registry Size:** 0 active issues logged.
  *(Note: All 8,667 disabled/orphaned SKUs, 144 excluded attribute set records, 129 multi-jewellery overflow records, and 12 unmapped zero options have been pruned from custom option datasets per business rules).*
- **Generated Reports:**
  - `data/custom_option_issues.csv` (0 records)
  - `data/custom_option_orphaned_skus.csv` (0 records)




