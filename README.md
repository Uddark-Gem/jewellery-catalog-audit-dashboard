# Jewellery Catalog Audit Dashboard

An enterprise-grade catalog consistency, attribute auditing, and pricing operations dashboard engineered for high-volume e-commerce (loose gemstones and fine gemstone jewellery). Built with **React 19**, **Vite 8**, **Tailwind CSS v4**, **Express 5**, and seamless **Google Sheets API v4 Database Integration** via Google Service Account credentials.

---

## Key Highlights

- **Google Sheets As Database:** Directly integrates with Google Spreadsheets via Google Service Account JWT authentication. No Supabase, Firebase, or external DB accounts required.
- **Resilient Fallback Mode:** Seamlessly operates offline or during initial setup using local reference datasets (`Database/*.csv`).
- **14 Automated Attribute Consistency Audits:**
  - **URL Key Canonical Slug Audit:** Verifies `<base_url_key>-<sku>` format with mismatch categorization.
  - **Weight (Ratti) Audit:** Standardizes Indian gemological weight ($\text{carats} / 0.90$).
  - **Gemstone GST HSN Code Audit:** Validates 8-digit tax codes against master matrices.
  - **Jewellery HSN & Diamond Detection Audit:** Evaluates precious metal (Silver, Gold, Panchdhatu), mounts, and diamond presence.
  - **Tax Class Audit:** Automatic detection of carved gemstones (`Jewellery Corals`) and gem type tax categories.
  - **Classification & Origin Audits:** Validates Precious/Semi-Precious tiers and geographic origins.
  - **Stickers & Labels Audit:** Cross-references single/multi-lab certifications (GIA, IGI, etc.).
  - **J Colour & Certificate Colour Audit:** Normalizes laboratory color strings into standardized color codes.
  - **Dispatch & Shipping Timeline Audit:** Reconciles shipping commitments.
  - **Naming Normalization Audit:** Removes irregular spacing, typos, and duplicate hyphens.
- **Dynamic Pricing Calculator:** Proprietary pricing algorithm with progressive tier rounding, tax bracket calculations, express dispatch tagging, and 700,000 INR "Call for Price" threshold.
- **High-Performance 60 FPS UI:** Offloads search and multi-column sorting for 25,000+ catalog rows to a dedicated background **Web Worker**.
- **Security-First Architecture:** CSV formula injection protection, zero private keys in client code, and strict gitignore hygiene.
- **Automated Quality Pipeline:** 24 unit and integration tests, Oxlint verification, and GitHub Actions CI.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite 8, Tailwind CSS v4, Lucide-style SVG Icons |
| **Multithreading** | Dedicated Web Worker (`auditWorker.js`) |
| **Client Storage** | IndexedDB (`idb-keyval`) with LocalStorage fallback |
| **Backend API** | Node.js 20+, Express 5, Axios, PapaParse, CSV-Parser |
| **Database Layer** | Google Sheets API v4 (`googleapis`), SQLite 3 (embedded cache) |
| **Testing** | Node.js Test Runner (`node:test`, `node:assert`) |
| **Linter & Bundler** | Oxlint, Vite 8 |

---

## Directory Structure

```
jewellery-catalog-audit-dashboard/
├── .github/workflows/ci.yml       # GitHub Actions CI for lint, test, build
├── .env.example                   # Environment configuration template
├── .gitignore                     # Strict exclusion of secrets, keys, and caches
├── README.md                      # Comprehensive documentation
├── package.json                   # Scripts and dependencies
├── vite.config.js                 # Vite configuration with proxy to port 3000
│
├── server/                        # Modular Express Backend
│   ├── index.js                   # Application bootstrap & error handling
│   ├── db.js                      # Embedded SQLite connection
│   ├── config/
│   │   ├── env.js                 # Environment variable loader
│   │   └── google.js              # Google Service Account JWT client & status check
│   ├── services/
│   │   ├── googleSheetsService.js # Batch reads, writes, and rate limit retry backoff
│   │   └── csvService.js          # CSV parsing and formula injection protection
│   ├── repositories/
│   │   ├── googleSheetsRepo.js    # Google Sheets worksheet adapter
│   │   ├── productRepo.js         # Catalog product repository
│   │   ├── auditRepo.js           # Delta audit updates repository
│   │   └── referenceRepo.js       # Ground-truth databases (Google Sheets + CSV fallback)
│   └── routes/
│       ├── googleSheetsRoutes.js  # /api/sheets endpoints (status, test, sync)
│       ├── auditRoutes.js         # /api/audit endpoints (databases, check-url, delta rows)
│       ├── dataRoutes.js          # /api/data endpoints (paginated catalog)
│       └── syncRoutes.js          # /api/sync & staging endpoints
│
├── src/                           # React 19 Frontend
│   ├── index.css                  # Curated design tokens & dark/light theme
│   ├── main.jsx                   # React DOM root
│   ├── App.jsx                    # Primary application shell & navigation
│   ├── components/
│   │   ├── GoogleSheetsModal.jsx  # Interactive Google Sheets sync & diagnostic modal
│   │   ├── ReportTable.jsx        # Virtualized catalog table with worker filtering
│   │   ├── UpdatePanel.jsx        # Audit delta review and CSV export panel
│   │   ├── StockPanel.jsx         # In-stock vs out-of-stock reconciliation
│   │   ├── DatabaseTable.jsx      # Ground-truth matrix viewer
│   │   ├── VideoAuditPanel.jsx    # Media asset health checker
│   │   ├── CellInput.jsx          # Inline debounced table editor
│   │   ├── Pagination.jsx         # Accessible pagination bar
│   │   └── Icons.jsx              # Optimized UI icons
│   └── lib/
│       ├── auditGenerators.js     # 14 pure audit rules & pricing algorithms
│       ├── auditWorker.js         # Background worker for 60 FPS sorting/filtering
│       ├── csv.js                 # Streaming chunked CSV exporter
│       └── tableConfig.js         # Column definitions and placeholders
│
├── tests/                         # Automated Test Suite (24 tests)
│   ├── auditRules.test.js         # Unit tests for all audit formulas
│   ├── csvService.test.js         # Formula injection and parsing tests
│   ├── googleSheets.test.js       # Google API client & retry tests
│   └── serverApi.test.js          # Express API route integration tests
│
├── Database/                      # Ground-truth CSV lookup reference matrices
├── secrets/                       # Protected folder for google-service-account.json
└── docs/                          # Detailed Technical Guides
    ├── GOOGLE_SHEETS_SETUP.md     # Google Service Account & Sharing Guide
    ├── DATABASE_SCHEMA.md         # Worksheet & column specifications
    ├── SECURITY_CHECKLIST.md      # Security audit report & mitigations
    └── DEPLOYMENT.md              # Production deployment & hosting guide
```

---

## Quick Start & Local Setup

### 1. Clone & Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

### 3. Connect Google Service Account
1. Place your Google Service Account JSON file into:
   ```
   ./secrets/google-service-account.json
   ```
2. Open your target Google Spreadsheet in your browser and click **Share**.
3. Share the spreadsheet with the `client_email` listed in your JSON file with **Editor** permissions.
4. Copy the Spreadsheet ID from the URL and set it in `.env.local`:
   ```env
   GOOGLE_SPREADSHEET_ID=your_spreadsheet_id_here
   GOOGLE_SHEET_NAME=Products
   ```
   *(For full step-by-step instructions, see [GOOGLE_SHEETS_SETUP.md](file:///d:/AI/Attibute%20Audit%20-%20Google%20Sheet/docs/GOOGLE_SHEETS_SETUP.md)).*

### 4. Run Locally
Run both the Express backend and Vite frontend concurrently:
```bash
npm run start:all
```

- **Frontend Application:** `http://localhost:5173`
- **Backend API:** `http://localhost:3000`

---

## Available NPM Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run start:all` | `concurrently "npm run dev" "npm run server"` | Starts both Vite dev server and Express API simultaneously |
| `npm run dev` | `vite` | Runs the frontend Vite development server |
| `npm run server` | `node server/index.js` | Runs the Express API backend server |
| `npm test` | `node --test tests/*.test.js` | Runs all 24 automated unit and integration tests |
| `npm run lint` | `oxlint` | Executes code quality and security linting |
| `npm run build` | `vite build` | Builds the optimized production client bundle to `./dist` |
| `npm run preview` | `vite preview` | Previews the production bundle locally |

---

## Verification & Testing

To verify the integrity of the repository:

```bash
# Run linter
npm run lint

# Run all 24 automated tests
npm test

# Build production bundle
npm run build
```

---

## Documentation Links

- [Google Sheets Setup Guide](file:///d:/AI/Attibute%20Audit%20-%20Google%20Sheet/docs/GOOGLE_SHEETS_SETUP.md)
- [Database & Worksheet Schema](file:///d:/AI/Attibute%20Audit%20-%20Google%20Sheet/docs/DATABASE_SCHEMA.md)
- [Security Audit & Checklist](file:///d:/AI/Attibute%20Audit%20-%20Google%20Sheet/docs/SECURITY_CHECKLIST.md)
- [Deployment & Operations Guide](file:///d:/AI/Attibute%20Audit%20-%20Google%20Sheet/docs/DEPLOYMENT.md)
