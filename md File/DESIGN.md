# UI/UX & Design System Specification (DESIGN.md)

## GemPundit Attribute & Catalog Audit Tool
**Document Version:** 1.0.0  
**Design System:** Modern Data-Dense Workspace (Glassmorphism + Slate Design Tokens)  
**CSS Engine:** Tailwind CSS v4 + Vanilla CSS Custom Properties (`src/index.css`)  

---

## 1. Design Philosophy & Aesthetic Principles

Catalog operations require reviewing thousands of records containing dense, multi-attribute product data. Traditional admin interfaces are either too cluttered or too sparse, leading to eye strain and operational fatigue. 

The design system for the **GemPundit Attribute Audit Tool** is built on four core pillars:
1. **High Information Density with Visual Clarity:** Maximum vertical and horizontal space dedicated to table content while maintaining 28px–32px row heights, crisp cell borders, and high contrast.
2. **Instant Visual Diffs:** Divergences between "Current Value" and "Audit Value" must be recognizable at a glance using tailored color highlights (e.g. bold blue font for newly appended URL segments, green/red status pills).
3. **Subtle Glassmorphism & Depth:** Soft borders, subtle backdrop filters (`blur(12px)`), refined shadows, and contextual elevation give the app an elegant, premium desktop-application feel.
4. **Adaptive Dark & Light Themes:** Native dark mode with dedicated slate/navy tones (`#0f172a`, `#1e293b`) that prevents glare during lengthy catalog review shifts.

---

## 2. Design Tokens & Color Palette

### 2.1 CSS Custom Properties (`:root` vs `.dark`)

| Token | Light Theme | Dark Theme | Purpose |
|---|---|---|---|
| `--bg-app` | `#f4f6f8` | `#0f172a` | Main application background |
| `--bg-sidebar` | `#ffffff` | `#1e293b` | Navigation sidebar background |
| `--bg-sidebar-glass` | `rgba(255, 255, 255, 0.75)` | `rgba(30, 41, 59, 0.75)` | Backdrop blur overlay |
| `--bg-stripe` | `#fafbfc` | `#1e293b` | Alternating table row zebra stripe |
| `--bg-hover` | `#f1f5f9` | `#334155` | Row hover & button hover state |
| `--bg-input` | `#ffffff` | `#0f172a` | Editable cell & text input background |
| `--accent` | `#2563eb` | `#3b82f6` | Primary action buttons & active nav item |
| `--accent-light` | `#eff6ff` | `rgba(59, 130, 246, 0.15)` | Active item badge & highlighted diff pills |
| `--text-900` | `#0f172a` | `#f8fafc` | Primary headings, table text, data values |
| `--text-700` | `#334155` | `#e2e8f0` | Table headers & labels |
| `--text-500` | `#64748b` | `#94a3b8` | Metadata, counts, secondary descriptions |
| `--text-400` | `#94a3b8` | `#64748b` | Placeholders & inactive icons |
| `--border` | `#e2e8f0` | `#334155` | Standard structural borders & dividers |
| `--border-strong` | `#cbd5e1` | `#475569` | Table cell borders & input outlines |

### 2.2 Semantic Status Palette

```
  SUCCESS / IN-STOCK       WARNING / REVIEW          DANGER / OUT-OF-STOCK
  Text:  #059669 (Emerald) Text:  #d97706 (Amber)    Text:  #dc2626 (Red)
  Pill:  #ecfdf5           Pill:  #fffbeb            Pill:  #fef2f2
  Dot:   #10b981           Dot:   #f59e0b            Dot:   #ef4444
```

---

## 3. Typography & Hierarchy

- **Font Family:** `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Monospace Font:** `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` (applied to SKUs, URL Keys, HSN codes, and Price values).

| Level | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| **App Title** | 1.125rem (18px) | 700 (Bold) | 1.25 | Topbar header brand lockup |
| **Section Header** | 0.65rem (10.5px)| 700 (Bold) | 1.2 | Sidebar uppercase group headers (`tracking-wider`) |
| **Nav Item** | 0.875rem (14px) | 500 (Medium)| 1.4 | Sidebar menu items |
| **Table Header**| 0.75rem (12px)  | 600 (Semibold)| 1.2 | Table column headings with sort toggles |
| **Table Cell**  | 0.8125rem (13px)| 400 (Regular)| 1.3 | Data cells, inputs, and inline values |
| **Status Badge**| 0.75rem (12px)  | 600 (Semibold)| 1.0 | Validation pills (`Valid`, `Needs Review`) |
| **Counter Pill**| 0.70rem (11px)  | 500 (Medium)| 1.0 | Row counts and pagination stats |

---

## 4. Layout Architecture & Workspace Zones

```
+---------------------------------------------------------------------------------------+
|  TOPBAR: Brand Lockup | Progress Bar | Source Badge | Sync Staging | Save Cache | Theme|
+---------------------+-----------------------------------------------------------------+
|  SIDEBAR            |  MAIN WORKSPACE                                                 |
|                     |                                                                 |
|  OVERVIEW           |  +-----------------------------------------------------------+  |
|  - Export Data      |  | TOOLBAR: Search Input | Filters | Density | Export CSV     |  |
|  - Image Database   |  +-----------------------------------------------------------+  |
|  - Video Database   |  |                                                           |  |
|  - Custom Options   |  | INTERACTIVE DATA TABLE                                    |  |
|                     |  |  # | SKU | Current | Proposed | Diff | Status | Actions   |  |
|  ATTRIBUTE AUDIT    |  |----+-----+---------+----------+------+--------+-----------|  |
|  - Url Key          |  |  1 | ... | ...     | ...      | ...  | [Valid]| Edit      |  |
|  - Name             |  |  2 | ... | ...     | ...      | ...  | [Revw] | Edit      |  |
|  - Classification   |  |                                                           |  |
|  - HSN Codes        |  |                                                           |  |
|  - Tax Class        |  |                                                           |  |
|  - Stickers         |  |                                                           |  |
|  - Video Health     |  +-----------------------------------------------------------+  |
|                     |  | PAGINATION FOOTER: Page 1 of 42 | [25|50|100|250] | Total |  |
|  UPDATE ATTRIBUTE   |  +-----------------------------------------------------------+  |
|  - Price Update     |                                                                 |
|  - Weight Update    |                                                                 |
|  - Stock Review     |                                                                 |
+---------------------+-----------------------------------------------------------------+
```

### 4.1 Topbar Navigation (`.app-topbar`)
- Fixed at the top, `z-index: 20`, height: 56px.
- Houses the progress bar indicator (`.progress-bar-fill`) that animates during background Web Worker processing and Axios sync operations.
- Contains direct action buttons: "Refresh Staging" (with loading spinner), "Save Cache", and the Dark/Light mode toggle button.

### 4.2 Sidebar Navigation (`Sidebar.jsx`)
- Width: 260px, scrollable vertical axis.
- Grouped into three distinct functional sections:
  1. **OVERVIEW:** Raw catalog and multi-media reference datasets.
  2. **ATTRIBUTE AUDIT:** Discrepancy detection panels.
  3. **UPDATE ATTRIBUTE:** Operational workflows (Pricing, Weights, Stock changes).
- Each item features an intuitive glyph/emoji icon + label + active blue pill highlight (`bg-[#eff6ff] text-[#1d4ed8]`).

---

## 5. Table & Grid Design Specifications

### 5.1 Interactive Table Design Patterns
- **Sticky Column #1:** The row index column (`#`) and selection checkbox are pinned to the left edge during horizontal scrolling.
- **Header Sort Buttons:** Clicking any column header cycles between Ascending (`▲`), Descending (`▼`), and Default sort.
- **Dynamic Width Calculation:** Columns auto-fit their content based on `Math.min(Math.max(longestValue * 7.2 + 42, 78), 280)px`.
- **Zebra Striping:** Alternating subtle row backgrounds (`var(--bg-stripe)`) facilitate eye scanning across 20+ columns.
- **Empty State Feedback:** Centered card with icon, title, and clear recovery action (e.g. "Try clearing filters").

### 5.2 Custom Visual Diff Renderers

#### A. URL Key Diff (`renderChangedUrl`)
Highlights newly added or altered URL slugs in bold blue monospace font:
```jsx
// Highlights segments in proposed URL that did not exist in old URL
<span className={!oldParts.includes(part) ? 'font-bold text-blue-700' : 'text-gray-600'}>
  {part}
</span>
```

#### B. Validation Status Pill (`renderValidationStatus`)
- `Valid`: Soft green pill (`bg-green-100 text-green-800`).
- `Needs Review`: Soft amber pill (`bg-amber-100 text-amber-800 font-medium`).
- `No Change`: Neutral slate pill (`bg-gray-100 text-gray-600`).

#### C. Stock Status Indicator (`renderStockStatus`)
- Displays an 8px circular status light (Green for In Stock, Red for Out of Stock) accompanied by clear status text.

### 5.3 Editable Cell Design (`CellInput.jsx`)
- Seamless transition between reading and editing.
- Normal state: clean typography matching table styles.
- Focus/Edit state: 1px active blue border (`border-blue-500`), subtle blue ring shadow, full cell fill.
- Enter key or `onBlur` immediately commits changes and dispatches persistence events to SQLite.

---

## 6. Micro-Interactions & Animations

1. **Button Hover & Click States:**
   - Buttons have subtle scale transitions (`active:scale-95`).
   - Ghost buttons change to soft slate background (`hover:bg-slate-100 dark:hover:bg-slate-800`).
2. **Loading States:**
   - "Refresh Staging" button switches into a disabled state displaying an animated circular spinner with text "Syncing...".
   - Topbar progress bar animates horizontally across the workspace border.
   - Video URL health check displays real-time percentage completion badge (`Checking (48%)`).
3. **Table Checkbox Multi-Select:**
   - Master checkbox in header supports indeterminate state when a subset of rows is selected.
   - Selected rows receive a gentle blue background tint (`bg-blue-50/60 dark:bg-blue-900/20`).

---

## 7. Accessibility & Usability (a11y)

- **Keyboard Traversal:** Users can tab through table inputs, search fields, and pagination controls sequentially without keyboard traps.
- **Screen Reader Support:** All icon-only buttons include `aria-label` tags; decorative icons use `aria-hidden="true"`.
- **Color Contrast:** All text tokens meet WCAG 2.1 AA standards (minimum 4.5:1 contrast against their respective backgrounds in both light and dark modes).
- **Reduced Motion:** CSS animations respect the user's `prefers-reduced-motion` system settings.
