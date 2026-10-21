# Database & Google Sheets Schema Specification

This document defines the worksheet structures and attribute schemas for the **Jewellery Catalog Audit Dashboard**.

---

## 1. Primary Worksheets in Google Sheets

| Worksheet Name | Primary Purpose | Record Key | Update Frequency |
|---|---|---|---|
| `Products` | Master product catalog (loose gems and jewellery) | `sku` | Real-time / Daily |
| `gemstone2_wise` | Base SEO slug and loose gem HSN reference | `gemstone2` | Static reference |
| `hsn metal gemstone` | Fine jewellery HSN matrix by metal & diamond | Composite (`gemstone`, `metal_one`, `metal_two`) | Static reference |
| `gem_type` | Tax class & classification mapping | `gemstone2` | Static reference |
| `sticker` | Certificate sticker rules | `certification` | Static reference |
| `j_colour` | Certificate color to standardized J-colour mapping | `colour` | Static reference |
| `shipping & Dispatch` | Shipping days to dispatch days conversion | `shipping_days` | Static reference |
| `Audit_Updates` | Delta changes pending export or Magento sync | `sku` + `panelId` | Dynamic updates |

---

## 2. Main Product Catalog Schema (`Products` Worksheet)

| Column Name | Type | Description | Example |
|---|---|---|---|
| `sku` | String (Unique) | Product Stock Keeping Unit | `GP1002`, `R123-A22-SIL` |
| `name` | String | Product title | `Natural Blue Sapphire 4.50 Ratti` |
| `attribute_set_id` | String | Product category classification | `gemstones`, `rings`, `pendants` |
| `url_key` | String | SEO canonical URL slug | `blue-sapphire-neelam-gp1002` |
| `status` | String | Visibility status | `Enabled`, `Disabled` |
| `qty` | Number / Integer | Inventory quantity on hand | `1`, `0` |
| `is_in_stock` | String / Boolean | Stock availability indicator | `1`, `0` |
| `carat_weight` | Decimal | Metric weight in carats | `4.50` |
| `weight_ratti` | Decimal | Traditional Indian gem weight | `5.00` |
| `price` | Number | Retail base price in INR | `45000` |
| `price_per_carat` | Number | Price per carat in INR | `10000` |
| `hsn_code` | String (8-digit) | Indian GST HSN code | `71031020`, `71131130` |
| `tax_class_id` | String | Magento tax class | `0`, `Jewellery Corals` |
| `classification` | String | Gem value class | `Precious`, `Semi-Precious` |
| `gemstone` | String | Primary gemstone family | `Blue Sapphire`, `Ruby` |
| `gemstone2` | String | Specific trade variety | `Yellow Sapphire`, `Pitambari` |
| `shape` | String | Gem cutting shape | `Oval`, `Cushion`, `Round` |
| `cut` | String | Cutting style | `Faceted`, `Cabochon`, `Carved` |
| `metal_config` | String | Jewellery precious metal composition | `Sterling Silver 925`, `18K Yellow Gold` |
| `design_code` | String | Jewellery mounting design pattern | `A22`, `R1-SPARKLE` |
| `stickers` | String | Promotional & certification stickers | `Certified`, `Best Seller` |
| `callfor` | String | Call for price flag | `Call for Price`, `""` |
| `price_range` | Number / String | Rounded tier pricing range | `45000` |
| `price_per_carat_range`| Number / String | Tier price per carat range | `10000` |
| `offers` | String | Marketing and dispatch incentive | `Express Dispatch` |
| `comment_explation` | String | Audit trail & modification history | `Price update on 21-10-2026 by Audit` |

---

## 3. Reference Database Schemas

### 3.1 `gemstone2_wise`
- `gemstone2`: Specific gemstone variety name.
- `url_key`: Base canonical URL key prefix (e.g. `yellow-sapphire-pukhraj`).
- `hsn_code`: Standard 8-digit GST HSN code for loose stones.

### 3.2 `hsn metal gemstone`
- `gemstone`: Main gem name.
- `metal_one`: Base metal identifier (`silver`, `gold`, `panchdhatu`).
- `metal_two`: Embellishment identifier (`diamond` or empty).
- `hsn_code`: Applicable 8-digit GST HSN code.

### 3.3 `gem_type`
- `gemstone2`: Gemstone name.
- `classification`: `Precious` or `Semi-Precious`.
- `tax_class_id`: Tax class code.
- `origin`: Default provenance origin country/region.
- `gemstone_benifits`: Astrological & spiritual benefits summary.

### 3.4 `sticker`
- `certification`: Certification agency (e.g., `GIA`, `IGI`, `IGI-GTL`).
- `stickers`: Corresponding sticker label to apply.

---

## 4. Fallback Behavior
If the target Google Spreadsheet is offline, unshared, or temporarily unreachable, the repository layer automatically loads the static reference sheets from `./Database/*.csv` without interrupting UI workflows.
