import { useEffect, useMemo, useState, useRef } from 'react';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import ReportTable from './components/ReportTable';
import UpdatePanel from './components/UpdatePanel';
import StockPanel from './components/StockPanel';
import DatabaseTable from './components/DatabaseTable';
import { createRowId, exportRowsAsCsv, formatDatedFilename, isRowInStock } from './lib/csv';
import { REPORT_COLUMNS, STOCK_COLUMNS, makeReportColumns } from './lib/tableConfig';
import {
  formatCount,
  makeDatabasePanelId,
  getDatabaseSheetId,
  makeDatabaseColumns,
  normalizeLookupValue,
  buildGemstone2WiseIndex,
  buildUrlKeyAuditRows,
  buildWeightAuditRows,
  buildHsnAuditRows,
  buildJewelleryHsnAuditRows,
  buildTaxClassAuditRows,
  buildClassificationAuditRows,
  buildStickerAuditRows,
  buildJColourAuditRows,
  buildDispatchAuditRows,
  buildOriginAuditRows,
  buildBenefitsAuditRows,
  buildNameAuditRows,
  buildStockUpdateRows,
  enrichReportRow,
  calculatePriceRow
} from './lib/auditGenerators';
import VideoAuditPanel from './components/VideoAuditPanel';
import GoogleSheetsModal from './components/GoogleSheetsModal';
import {
  TableIcon,
  ImageIcon,
  VideoIcon,
  GemIcon,
  RingIcon,
  AlertTriangleIcon,
  LayersIcon,
  LinkIcon,
  UserIcon,
  TagIcon,
  HashIcon,
  PaletteIcon,
  MapPinIcon,
  CrosshairIcon,
  TicketIcon,
  DollarSignIcon,
  ScaleIcon,
  PackageIcon,
  CheckCircleIcon,
  BanIcon,
  DatabaseIcon,
  ChevronDownIcon,
  SunIcon,
  MoonIcon,
  RefreshCwIcon,
  SparklesIcon,
} from './components/Icons';

const AUDIT_DATABASES_ENDPOINT = '/api/audit/databases.json';
const AUDIT_ROWS_ENDPOINT = '/api/audit/update-rows.json';
const AUDIT_ROWS_STORAGE_KEY = 'gempundit-audit-update-rows-v1';

const renderChangedUrl = (row, value) => {
  if (!value || !row.old_url) return <span>{value}</span>;
  const oldParts = row.old_url.split('-');
  const newParts = value.split('-');
  return (
    <div className="flex items-center gap-1 font-mono text-sm" style={{ padding: '0 8px' }}>
      {newParts.map((part, i) => (
        <span key={i} className={!oldParts.includes(part) ? 'font-bold text-blue-700' : 'text-gray-600'}>
          {part}{i < newParts.length - 1 ? '-' : ''}
        </span>
      ))}
    </div>
  );
};

const renderValidationStatus = (row, rawValue) => {
  const value = rawValue || 'Valid';
  let color = 'bg-gray-100 text-gray-800';
  if (value === 'Valid') color = 'bg-green-100 text-green-800';
  if (value === 'Needs Review') color = 'bg-amber-100 text-amber-800 font-medium';
  if (value === 'No Change') color = 'bg-gray-100 text-gray-600';
  return (
    <div className="flex justify-center items-center h-full">
      <span className={`px-2 py-0.5 rounded-full text-xs ${color}`}>{value}</span>
    </div>
  );
};

const renderStockStatus = (row, value) => {
  const inStock = value === '1' || value === 1;
  return (
    <div className="flex items-center gap-1.5 px-2">
      <span className={`w-2 h-2 rounded-full ${inStock ? 'bg-emerald-500' : 'bg-red-500'}`} />
      <span className={inStock ? 'text-emerald-700' : 'text-red-700'}>{inStock ? 'In Stock' : 'Out of Stock'}</span>
    </div>
  );
};

const URLKEY_COLS = [
  { key: 'sku', label: 'SKU', width: 120, placeholder: 'product-sku' },
  { key: 'gemstone2', label: 'Gemstone', width: 160, placeholder: 'gemstone2' },
  { key: 'status', label: 'Status', width: 90, placeholder: 'Enabled' },
  { key: 'qty', label: 'Qty', width: 60, placeholder: '0' },
  { key: 'is_in_stock', label: 'Stock Status', width: 120, placeholder: '1', render: renderStockStatus },
  { key: 'old_url', label: 'Current URL', width: 260, placeholder: '/current-url-key', csvKey: 'url_key' },
  { key: 'new_url', label: 'Proposed URL', width: 280, placeholder: '/new-url-key', render: renderChangedUrl },
  { key: 'validation_status', label: 'Validation Status', width: 140, render: renderValidationStatus },
];

const WEIGHT_COLS = [
  { key: 'sku', label: 'SKU / Name', width: 150, placeholder: 'product-sku' },
  { key: 'carat_weight', label: 'Carat Weight', width: 120, placeholder: '0.000' },
  { key: 'old_weight_ratti', label: 'Weight Ratti', width: 120, placeholder: '0.00', csvKey: 'weight_ratti' },
  { key: 'new_weight_ratti', label: 'New Weight Ratti', width: 140, placeholder: '0.00', csvKey: 'new_weight_ratti' },
];

const HSN_COLS = [
  { key: 'sku', label: 'SKU / Name', width: 150, placeholder: 'product-sku' },
  { key: 'gemstone2', label: 'Gemstone2', width: 180, placeholder: 'gemstone2' },
  { key: 'qty', label: 'Qty', width: 80, placeholder: '0' },
  { key: 'is_in_stock', label: 'Is In Stock', width: 100, placeholder: '1' },
  { key: 'old_hsn', label: 'Current HSN Code', width: 120, placeholder: '711319', csvKey: 'current_hsn_code' },
  { key: 'new_hsn', label: 'New HSN Code', width: 120, placeholder: '711319', csvKey: 'hsn_code' },
];

const JEWELLERY_HSN_COLS = [
  { key: 'sku', label: 'SKU / Name', width: 150, placeholder: 'product-sku' },
  { key: 'gemstone', label: 'Gemstone', width: 140, placeholder: 'Ruby', csvKey: 'gemstone' },
  { key: 'metal_config', label: 'Metal Config', width: 140, placeholder: 'Sterling Silver', csvKey: 'metal_config' },
  { key: 'design_code', label: 'Design Code', width: 100, placeholder: 'A22', csvKey: 'design_code' },
  { key: 'has_diamond', label: 'Has Diamond', width: 100, placeholder: 'Yes/No', csvKey: 'has_diamond' },
  { key: 'qty', label: 'Qty', width: 80, placeholder: '0' },
  { key: 'is_in_stock', label: 'Is In Stock', width: 100, placeholder: '1' },
  { key: 'old_hsn', label: 'Current HSN Code', width: 120, placeholder: '711319', csvKey: 'current_hsn_code' },
  { key: 'new_hsn', label: 'New HSN Code', width: 120, placeholder: '711319', csvKey: 'hsn_code' },
];

const TAX_COLS = [
  { key: 'sku', label: 'SKU / Name', width: 150, placeholder: 'product-sku' },
  { key: 'gemstone2', label: 'Gemstone2', width: 180, placeholder: 'gemstone2' },
  { key: 'status', label: 'Status', width: 90, placeholder: 'Enabled' },
  { key: 'qty', label: 'Qty', width: 80, placeholder: '0' },
  { key: 'is_in_stock', label: 'Is In Stock', width: 100, placeholder: '1' },
  { key: 'old_tax', label: 'Current Class', width: 120, placeholder: '0', csvKey: 'tax_class_id' },
  { key: 'new_tax', label: 'New Tax Class', width: 120, placeholder: '0' },
  { key: 'note', label: 'Note', width: 100, placeholder: 'optional' },
];

const STICKER_COLS = [
  { key: 'sku', label: 'SKU / Name', width: 150, placeholder: 'product-sku' },
  { key: 'gemstone2', label: 'Gemstone2', width: 180, placeholder: 'gemstone2' },
  { key: 'status', label: 'Status', width: 90, placeholder: 'Enabled' },
  { key: 'certification', label: 'Certification', width: 150, placeholder: 'certification' },
  { key: 'qty', label: 'Qty', width: 80, placeholder: '0', csvKey: 'qty' },
  { key: 'is_in_stock', label: 'Is In Stock', width: 100, placeholder: '1', csvKey: 'is_in_stock' },
  { key: 'old_sticker', label: 'Current Sticker', width: 150, placeholder: 'sticker_name', csvKey: 'stickers' },
  { key: 'new_sticker', label: 'New Sticker', width: 150, placeholder: 'sticker_name' },
];

const PRICE_COLS = [
  { key: 'sku', label: 'sku', width: 150, placeholder: 'product-sku' },
  { key: 'ppc', label: 'ppc', width: 100, placeholder: '0.00', editable: true, omitExport: true },
  { key: 'price', label: 'price', width: 100, placeholder: '0.00', csvKey: 'price' },
  { key: 'price_per_carat', label: 'price_per_carat', width: 120, placeholder: '0', csvKey: 'price_per_carat' },
  { key: 'callfor', label: 'callfor', width: 120, placeholder: '', csvKey: 'callfor' },
  { key: 'price_range', label: 'price_range', width: 120, placeholder: '', csvKey: 'price_range' },
  { key: 'price_per_carat_range', label: 'price_per_carat_range', width: 160, placeholder: '', csvKey: 'price_per_carat_range' },
  { key: 'offers', label: 'offers', width: 120, placeholder: '', csvKey: 'offers' },
  { key: 'product_category_type', label: 'product_category_type', width: 160, placeholder: '', csvKey: 'product_category_type' },
  { key: 'comment_explation', label: 'comment_explation', width: 200, placeholder: '', csvKey: 'comment_explation' },
];

const CLASSIFICATION_COLS = [
  { key: 'sku', label: 'SKU / Name', width: 150, placeholder: 'product-sku' },
  { key: 'gemstone2', label: 'Gemstone2', width: 180, placeholder: 'gemstone2' },
  { key: 'status', label: 'Status', width: 90, placeholder: 'Enabled' },
  { key: 'qty', label: 'Qty', width: 80, placeholder: '0' },
  { key: 'is_in_stock', label: 'Is In Stock', width: 100, placeholder: '1' },
  { key: 'old_classification', label: 'Current Classification', width: 150, placeholder: '', csvKey: 'classification' },
  { key: 'new_classification', label: 'New Classification', width: 150, placeholder: '' },
];

const OFFERS_COLS = [
  { key: 'sku', label: 'SKU / Name', width: 150, placeholder: 'product-sku' },
  { key: 'old_offers', label: 'Current Offers', width: 150, placeholder: '', csvKey: 'offers' },
  { key: 'new_offers', label: 'New Offers', width: 150, placeholder: '' },
];

const JCOLOUR_COLS = [
  { key: 'sku', label: 'SKU / Name', width: 150, placeholder: 'product-sku' },
  { key: 'gemstone2', label: 'Gemstone2', width: 180, placeholder: 'gemstone2' },
  { key: 'status', label: 'Status', width: 90, placeholder: 'Enabled' },
  { key: 'colour', label: 'Certificate Colour', width: 160, placeholder: 'colour' },
  { key: 'qty', label: 'Qty', width: 80, placeholder: '0' },
  { key: 'is_in_stock', label: 'Is In Stock', width: 100, placeholder: '1' },
  { key: 'old_jcolour', label: 'Current J Colour', width: 150, placeholder: '', csvKey: 'j_colour' },
  { key: 'new_jcolour', label: 'New J Colour', width: 150, placeholder: '' },
];

const ORIGIN_COLS = [
  { key: 'sku', label: 'SKU / Name', width: 150, placeholder: 'product-sku' },
  { key: 'gemstone2', label: 'Gemstone2', width: 180, placeholder: 'gemstone2' },
  { key: 'status', label: 'Status', width: 90, placeholder: 'Enabled' },
  { key: 'qty', label: 'Qty', width: 80, placeholder: '0' },
  { key: 'is_in_stock', label: 'Is In Stock', width: 100, placeholder: '1' },
  { key: 'old_origin', label: 'Current Origin', width: 150, placeholder: '', csvKey: 'origin' },
  { key: 'new_origin', label: 'New Origin', width: 150, placeholder: '' },
];

const NAME_COLS = [
  { key: 'sku', label: 'SKU / Name', width: 150, placeholder: 'product-sku' },
  { key: 'old_name', label: 'Current Name', width: 150, placeholder: '', csvKey: 'name' },
  { key: 'new_name', label: 'New Name', width: 150, placeholder: '' },
];

const CALIBRATED_COLS = [
  { key: 'sku', label: 'SKU / Name', width: 150, placeholder: 'product-sku' },
  { key: 'old_calibrated', label: 'Current Calibrated Type & Range', width: 220, placeholder: '', csvKey: 'calibrated_type_range' },
  { key: 'new_calibrated', label: 'New Calibrated Type & Range', width: 220, placeholder: '' },
];

const DISPATCH_COLS = [
  { key: 'sku', label: 'SKU / Name', width: 150, placeholder: 'product-sku' },
  { key: 'gemstone2', label: 'Gemstone2', width: 180, placeholder: 'gemstone2' },
  { key: 'status', label: 'Status', width: 90, placeholder: 'Enabled' },
  { key: 'price', label: 'Price', width: 100, placeholder: '0.00' },
  { key: 'qty', label: 'Qty', width: 80, placeholder: '0' },
  { key: 'is_in_stock', label: 'Is In Stock', width: 100, placeholder: '1' },
  { key: 'old_dispatch', label: 'Current dispatch & Shipping Days', width: 220, placeholder: '', csvKey: 'dispatch_shipping_days' },
  { key: 'new_dispatch', label: 'New dispatch & Shipping Days', width: 220, placeholder: '' },
];

const BENEFITS_COLS = [
  { key: 'sku', label: 'SKU / Name', width: 150, placeholder: 'product-sku' },
  { key: 'gemstone2', label: 'Gemstone2', width: 180, placeholder: 'gemstone2' },
  { key: 'status', label: 'Status', width: 90, placeholder: 'Enabled' },
  { key: 'qty', label: 'Qty', width: 80, placeholder: '0' },
  { key: 'is_in_stock', label: 'Is In Stock', width: 100, placeholder: '1' },
  { key: 'old_benefits', label: 'Current Benefits', width: 260, placeholder: '', csvKey: 'gemstone_benifits_new' },
  { key: 'new_benefits', label: 'New Benefits', width: 260, placeholder: '' },
];

const UPDATE_PANELS = {
  urlkey: { label: 'URL Key', filename: 'url-key-updates.csv', columns: URLKEY_COLS },
  weight: { label: 'Weight Update', filename: 'weight-ratti-updates.csv', columns: WEIGHT_COLS },
  hsn: { label: 'Gemstone HSN Code', filename: 'hsn-code-updates.csv', columns: HSN_COLS },
  jewellery_hsn: { label: 'Jewellery HSN Code', filename: 'jewellery-hsn-code-updates.csv', columns: JEWELLERY_HSN_COLS },
  taxclass: { label: 'Tax Class', filename: 'tax-class-updates.csv', columns: TAX_COLS },
  stickers: { label: 'Stickers / Labels', filename: 'sticker-updates.csv', columns: STICKER_COLS },
  price: { label: 'Price Update', filename: 'price-updates.csv', columns: PRICE_COLS },
  classification: { label: 'Classification', filename: 'classification-updates.csv', columns: CLASSIFICATION_COLS },
  offers: { label: 'Offers', filename: 'offers-updates.csv', columns: OFFERS_COLS },
  jcolour: { label: 'J Colour', filename: 'jcolour-updates.csv', columns: JCOLOUR_COLS },
  origin: { label: 'Origin', filename: 'origin-updates.csv', columns: ORIGIN_COLS },
  name: { label: 'Name', filename: 'name-updates.csv', columns: NAME_COLS },
  calibrated: { label: 'Calibrated Type & Range', filename: 'calibrated-updates.csv', columns: CALIBRATED_COLS },
  dispatch: { label: 'dispatch & Shipping Days', filename: 'dispatch-updates.csv', columns: DISPATCH_COLS },
  benefits: { label: 'Benefits', filename: 'benefits-updates.csv', columns: BENEFITS_COLS },
  image_audit: { label: 'Image audit', filename: 'image-audit-updates.csv', columns: [{ key: 'sku', label: 'SKU / Name', width: 150 }] },
};

const BASE_NAV_GROUPS = [
  { label: 'OVERVIEW', items: [
    { id: 'report', label: 'Export Data' },
    { id: 'q3_processed_images', label: 'Image Database' },
    { id: 'videodata_new', label: 'Video Database' },
    { id: 'templatetagproduct_gemstone', label: 'Gemstone Option Data' },
    { id: 'templatetagproduct_jewellery', label: 'Jewellery Option Data' },
    { id: 'custom_option_issues', label: 'Custom Option Issues' }
  ] },
  {
    label: 'ATTRIBUTE AUDIT',
    items: [
      { id: 'image_audit', label: 'Image audit' },
      { id: 'video_audit', label: 'Video audit' },
      { id: 'urlkey', label: 'Url Key' },
      { id: 'name', label: 'Name' },
      { id: 'classification', label: 'Classification' },
      { id: 'hsn', label: 'Gemstone HSN Code' },
      { id: 'jewellery_hsn', label: 'Jewellery HSN Code' },
      { id: 'taxclass', label: 'Tax Class' },
      { id: 'jcolour', label: 'J Colour' },
      { id: 'origin', label: 'Origin' },
      { id: 'calibrated', label: 'Calibrated type & Range' },
      { id: 'stickers', label: 'Sticker labels' },
      { id: 'dispatch', label: 'Dispatch & Shipping Days' },
      { id: 'benefits', label: 'Benefits' },
    ],
  },
  {
    label: 'UPDATE ATTRIBUTE',
    items: [
      { id: 'price', label: 'Price Update' },
      { id: 'weight', label: 'Weight Update' },
      { id: 'instock', label: 'In Stock Review' },
      { id: 'outstock', label: 'Active / Deactive Update' },
    ],
  },
];

const getNavIcon = (id) => {
  switch (id) {
    case 'report': return <TableIcon className="w-4 h-4" />;
    case 'q3_processed_images': return <ImageIcon className="w-4 h-4" />;
    case 'videodata_new': return <VideoIcon className="w-4 h-4" />;
    case 'templatetagproduct_gemstone': return <GemIcon className="w-4 h-4" />;
    case 'templatetagproduct_jewellery': return <RingIcon className="w-4 h-4" />;
    case 'custom_option_issues': return <AlertTriangleIcon className="w-4 h-4" />;
    case 'image_audit': return <ImageIcon className="w-4 h-4" />;
    case 'video_audit': return <VideoIcon className="w-4 h-4" />;
    case 'urlkey': return <LinkIcon className="w-4 h-4" />;
    case 'name': return <UserIcon className="w-4 h-4" />;
    case 'classification': return <TagIcon className="w-4 h-4" />;
    case 'hsn': return <HashIcon className="w-4 h-4" />;
    case 'jewellery_hsn': return <RingIcon className="w-4 h-4" />;
    case 'taxclass': return <LayersIcon className="w-4 h-4" />;
    case 'jcolour': return <PaletteIcon className="w-4 h-4" />;
    case 'origin': return <MapPinIcon className="w-4 h-4" />;
    case 'calibrated': return <CrosshairIcon className="w-4 h-4" />;
    case 'stickers': return <TicketIcon className="w-4 h-4" />;
    case 'dispatch': return <PackageIcon className="w-4 h-4" />;
    case 'benefits': return <SparklesIcon className="w-4 h-4" />;
    case 'price': return <DollarSignIcon className="w-4 h-4" />;
    case 'weight': return <ScaleIcon className="w-4 h-4" />;
    case 'instock': return <CheckCircleIcon className="w-4 h-4" />;
    case 'outstock': return <BanIcon className="w-4 h-4" />;
    default:
      if (id.startsWith('database:')) return <DatabaseIcon className="w-4 h-4" />;
      return <TableIcon className="w-4 h-4" />;
  }
};

const readStoredUpdateRows = () => {
  if (typeof window === 'undefined') return {};

  try {
    const stored = window.localStorage.getItem(AUDIT_ROWS_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const hasStoredAuditRows = (rowsByPanel) =>
  Object.values(rowsByPanel ?? {}).some((rows) => Array.isArray(rows) && rows.length > 0);

const makeInitialUpdateRows = () => readStoredUpdateRows();
const makeInitialStockRows = () => ({});

const cloneRowsWithIds = (rows, activeId = 'report') => {
  if (activeId === 'report') {
    return rows.map((row, idx) => ({
      ...enrichReportRow(row),
      id: row.id || row.sku || `report-${idx}`,
    }));
  }
  return rows.map((row, idx) => ({
    ...row,
    id: row.id || row.sku || `${activeId}-${idx}`,
  }));
};

const getReportColumnKeys = (rows, columns, activeId = 'report') => {
  if (columns?.length) {
    const keys = [...columns];
    if (activeId === 'report' && !keys.includes('design_code')) keys.push('design_code');
    return keys;
  }
  if (rows.length > 0) return Object.keys(rows[0]).filter((key) => key !== 'id');
  const fallback = REPORT_COLUMNS.map((column) => column.key);
  if (activeId === 'report' && !fallback.includes('design_code')) fallback.push('design_code');
  return fallback;
};

function Sidebar({ active, onSelect, navGroups }) {
  return (
    <aside className="sidebar-shell flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="sidebar-group-label">{group.label}</p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`sidebar-item ${active === item.id ? 'active' : ''}`}
                  aria-current={active === item.id ? 'page' : undefined}
                  onClick={() => onSelect(item.id)}
                >
                  <span className="sidebar-icon" aria-hidden="true">{getNavIcon(item.id)}</span>
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

const DB_LABELS = {
  report: 'Export Data',
  q3_processed_images: 'Image Database',
  videodata_new: 'Video Database',
  templatetagproduct_gemstone: 'Gemstone Option Data',
  templatetagproduct_jewellery: 'Jewellery Option Data',
  custom_option_issues: 'Custom Option Issues',
  templatetagproduct: 'Custom Option Data',
};

export default function App() {
  const [active, setActive] = useState('report');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('gempundit_dark_mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('gempundit_dark_mode', isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);
  const [reportRows, setReportRows] = useState([]);
  const [reportColumns, setReportColumns] = useState(REPORT_COLUMNS);
  const [databaseSheets, setDatabaseSheets] = useState([]);
  const [updateRows, setUpdateRows] = useState(makeInitialUpdateRows);
  const [stockRows, setStockRows] = useState(makeInitialStockRows);
  const [isFetching, setIsFetching] = useState(false);
  const [sourceLabel, setSourceLabel] = useState('Checking local report.csv');
  const [auditLabel, setAuditLabel] = useState('Checking audit database');
  const [sheetsStatus, setSheetsStatus] = useState(null);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [status, setStatus] = useState({ kind: 'info', message: '' });
  const [isAuditStoreReady, setIsAuditStoreReady] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteData, setPasteData] = useState('');
  const [downloadProgress, setDownloadProgress] = useState(null);
  const workspaceCache = useRef({});
  const sseRef = useRef(null);


  const DEFAULT_DATABASE_TABS = useMemo(() => [
    'Valid Values',
    'Gem_Type',
    'shipping & Dispatch',
    'J_Colour',
    'specific_gravity',
    'Sticker',
    'naming',
    'Special Colour',
    'Vivid in Colour',
    'astro/non astro',
    'gemstone2_wise',
    'hsn metal gemstone',
  ], []);

  const navGroups = useMemo(() => {
    const databaseItems = databaseSheets.length > 0
      ? databaseSheets.map((database) => ({
          id: makeDatabasePanelId(database.sheetId),
          label: database.sheetTitle,
        }))
      : DEFAULT_DATABASE_TABS.map((tab) => ({
          id: makeDatabasePanelId(tab),
          label: tab,
        }));

    return [...BASE_NAV_GROUPS, { label: 'Database', items: databaseItems }];
  }, [databaseSheets, DEFAULT_DATABASE_TABS]);

  const allItems = useMemo(() => navGroups.flatMap((group) => group.items), [navGroups]);
  const activeLabel = allItems.find((item) => item.id === active)?.label ?? '';
  const activeDatabaseId = getDatabaseSheetId(active);
  const activeDatabase = activeDatabaseId
    ? databaseSheets.find((database) => {
        const id = String(database.sheetId || database.sheetTitle || '').toLowerCase().trim();
        const target = activeDatabaseId.toLowerCase().trim();
        return id === target || id.replace(/[^a-z0-9]/g, '') === target.replace(/[^a-z0-9]/g, '');
      })
    : null;
  const gemstone2WiseIndex = useMemo(() => buildGemstone2WiseIndex(databaseSheets), [databaseSheets]);
  const activeRowCount = activeDatabase
    ? activeDatabase.rows.length
    : ['report', 'q3_processed_images', 'videodata_new', 'templatetagproduct_gemstone', 'templatetagproduct_jewellery', 'templatetagproduct', 'custom_option_issues'].includes(active)
      ? reportRows.length
      : UPDATE_PANELS[active]
        ? (updateRows[active]?.length ?? 0)
        : active === 'instock'
          ? (stockRows.in?.length ?? 0)
          : active === 'outstock'
            ? (stockRows.out?.length ?? 0)
            : 0;

  const getCatalogRows = () => (workspaceCache.current['report']?.rows?.length ? workspaceCache.current['report'].rows : reportRows);

  const hydrateWorkspace = (rows, source, columns, activeId = 'report') => {
    const csvColumns = makeReportColumns(getReportColumnKeys(rows, columns, activeId));
    const cloned = cloneRowsWithIds(rows, activeId);

    workspaceCache.current[activeId] = {
      rows: cloned,
      columns: csvColumns,
      source,
    };

    if (activeId === 'report') {
      setReportRows((prev) => (prev.length === 0 ? cloned : prev));
    }

    setReportRows(cloned);
    setReportColumns(csvColumns);
    setStockRows({});
    setSourceLabel(source);
    setLastSyncLabel('Just now');
    setActive(activeId);

    const label = DB_LABELS[activeId] || activeId;
    setStatus({ kind: 'success', message: `Loaded ${formatCount(rows.length)} rows for ${label} from ${source}.` });
  };



  const fetchAuditDatabases = async (forceRefresh = false) => {
    try {
      const url = forceRefresh ? `${AUDIT_DATABASES_ENDPOINT}?refresh=true` : AUDIT_DATABASES_ENDPOINT;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(await response.text());
      const payload = await response.json();
      const databases = payload.databases ?? [];
      setDatabaseSheets(databases);
      if (databases.length > 0) {
        setAuditLabel(`${databases.length} databases loaded`);
      } else {
        setAuditLabel('Reference DB Standby');
      }
    } catch {
      setAuditLabel('Reference DB Standby');
    }
  };

  const fetchSheetsStatus = async () => {
    try {
      const res = await fetch('/api/sheets/status');
      if (res.ok) {
        const data = await res.json();
        setSheetsStatus(data);
      }
    } catch {}
  };

  useEffect(() => {
    let cancelled = false;

    const loadStoredAuditRows = async () => {
      try {
        // Try IndexedDB first
        const idbRows = await idbGet(AUDIT_ROWS_STORAGE_KEY);
        if (idbRows && typeof idbRows === 'object' && Object.keys(idbRows).length > 0) {
          if (!cancelled) setUpdateRows((prev) => (hasStoredAuditRows(prev) ? prev : idbRows));
        }

        const response = await fetch(AUDIT_ROWS_ENDPOINT, { cache: 'no-store' });
        if (response.ok) {
          const payload = await response.json();
          if (!cancelled && payload.updateRows && Object.keys(payload.updateRows).length > 0) {
            setUpdateRows((prev) => (hasStoredAuditRows(prev) ? prev : payload.updateRows));
          }
        }
      } catch {
        // Fallback to localStorage
        try {
          const stored = window.localStorage?.getItem(AUDIT_ROWS_STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (!cancelled && parsed) setUpdateRows((prev) => (hasStoredAuditRows(prev) ? prev : parsed));
          }
        } catch {}
      } finally {
        if (!cancelled) setIsAuditStoreReady(true);
      }
    };

    fetchAuditDatabases();
    fetchSheetsStatus();

    const loadLocalReport = async (targetId = 'report') => {
      try {
        const response = await fetch(`/api/report/local-${targetId}.json`, { cache: 'no-store' });
        if (!response.ok) throw new Error(await response.text());
        const payload = await response.json();
        if (!cancelled) hydrateWorkspace(payload.rows ?? [], payload.source || `local data/${targetId}.csv`, payload.columns, targetId);
      } catch (error) {
        if (!cancelled) {
          if (targetId === 'report') {
            setSourceLabel('No local report.csv loaded');
            setStatus({ kind: 'info', message: error.message || 'No local report.csv loaded yet.' });
          } else {
            setReportRows([]);
            setReportColumns([]);
            setActive(targetId);
            setSourceLabel(`No local ${targetId}.csv loaded`);
            setStatus({ kind: 'info', message: error.message || `No local ${targetId}.csv loaded yet.` });
          }
        }
      }
    };

    loadStoredAuditRows();
    loadLocalReport();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAuditStoreReady) return;
    idbSet(AUDIT_ROWS_STORAGE_KEY, updateRows).catch(() => {});
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(AUDIT_ROWS_STORAGE_KEY, JSON.stringify(updateRows));
      } catch {}
    }

    fetch(AUDIT_ROWS_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ updateRows }),
    }).catch(() => {
      // Browser storage is still available if the local file endpoint is offline.
    });
  }, [updateRows, isAuditStoreReady]);

  // Auto-dismiss success status after 4 seconds
  useEffect(() => {
    if (status.message && status.kind === 'success') {
      const timer = setTimeout(() => setStatus({ kind: 'info', message: '' }), 4000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleFetchData = (targetDb = null) => {
    if (isFetching) return;
    const activeDb = targetDb || (['q3_processed_images', 'videodata_new', 'templatetagproduct_gemstone', 'templatetagproduct_jewellery', 'templatetagproduct'].includes(active) ? active : 'report');
    const label = DB_LABELS[activeDb] || activeDb;

    setIsFetching(true);
    setDownloadProgress(0);

    setStatus({ kind: 'info', message: `Connecting to staging server for ${label}...` });

    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }

    const sse = new EventSource(`/api/sync-staging?db=${activeDb}`);
    sseRef.current = sse;

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
          setDownloadProgress(data.percent);
          const mbLoaded = (data.loaded / 1024 / 1024).toFixed(1);
          const mbTotal = data.total > 0 ? (data.total / 1024 / 1024).toFixed(1) : '?';
          setStatus({
            kind: 'info',
            message: `Downloading ${label} from staging: ${data.percent}% (${mbLoaded} MB / ${mbTotal} MB)...`,
          });
        } else if (data.type === 'processing') {
          setDownloadProgress(100);
          setStatus({ kind: 'info', message: data.message || `Download complete. Processing ${label}...` });
        } else if (data.type === 'complete') {
          sse.close();
          sseRef.current = null;
          fetch(`/api/report/local-${activeDb}.json?t=${Date.now()}`)
            .then((res) => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.json();
            })
            .then((payload) => {
              hydrateWorkspace(payload.rows ?? [], `staging ${activeDb}.csv`, payload.columns, activeDb);
              setStatus({
                kind: 'success',
                message: `Successfully downloaded and synced ${formatCount(payload.rowCount || payload.rows?.length || 0)} rows for ${label}.`,
              });
            })
            .catch((err) => {
              setStatus({ kind: 'error', message: `Failed to load updated data for ${label}: ${err.message}` });
            })
            .finally(() => {
              setIsFetching(false);
              setDownloadProgress(null);
            });
        } else if (data.type === 'error') {
          sse.close();
          sseRef.current = null;
          setIsFetching(false);
          setDownloadProgress(null);
          setStatus({ kind: 'error', message: data.message || `Staging sync failed for ${label}.` });
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    sse.onerror = (err) => {
      console.error('SSE connection error:', err);
      sse.close();
      sseRef.current = null;
      setIsFetching(false);
      setDownloadProgress(null);
      setStatus({ kind: 'error', message: `Connection to staging sync for ${label} failed or interrupted.` });
    };
  };

  const handleSelect = async (id) => {
    setActive(id);

    if (['report', 'q3_processed_images', 'videodata_new', 'templatetagproduct_gemstone', 'templatetagproduct_jewellery', 'templatetagproduct', 'custom_option_issues'].includes(id)) {
      if (workspaceCache.current[id]) {
        const cached = workspaceCache.current[id];
        setReportRows(cached.rows);
        setReportColumns(cached.columns);
        setStockRows({});
        setSourceLabel(cached.source);
        setStatus({ kind: 'success', message: `Restored ${formatCount(cached.rows.length)} rows from cache.` });
        return;
      }

      setIsFetching(true);
      const label = DB_LABELS[id] || id;
      setStatus({ kind: 'info', message: `Loading ${label}...` });
      try {
        const response = await fetch(`/api/report/local-${id}.json`, { cache: 'no-store' });
        if (response.ok) {
           const payload = await response.json();
           hydrateWorkspace(payload.rows ?? [], payload.source || `local data/${id}.csv`, payload.columns, id);
           return;
        }
      } catch {
        setReportRows([]);
        setReportColumns([]);
      } finally {
        setIsFetching(false);
      }
      return;
    }

    if (UPDATE_PANELS[id]) {
      setUpdateRows((prev) => ({
        ...prev,
        [id]: prev[id] ?? [],
      }));
    }

    if (id === 'instock' || id === 'outstock') {
      const mode = id === 'instock' ? 'in' : 'out';
      const catalog = getCatalogRows();
      setStockRows((prev) => ({
        ...prev,
        [mode]: prev[mode]?.length ? prev[mode] : buildStockUpdateRows(catalog, mode),
      }));
    }

    setActive(id);
  };
  const handleGenerateWeights = () => {
    const catalog = getCatalogRows();
    if (!catalog.length) {
      setStatus({ kind: 'error', message: 'Report data is still loading or not loaded. Please wait for it to load.' });
      return;
    }
    const rows = buildWeightAuditRows(catalog);
    setUpdateRows((prev) => ({
      ...prev,
      weight: rows,
    }));
    setStatus({ kind: 'success', message: `Generated ${formatCount(rows.length)} weight ratti audit rows.` });
    setActive('weight');
  };
  const handleGenerateUrlKeys = () => {
    const catalog = getCatalogRows();
    if (!catalog.length) {
      setStatus({ kind: 'error', message: 'Report data is still loading or not loaded. Please wait for it to load.' });
      return;
    }
    const rows = buildUrlKeyAuditRows(catalog, gemstone2WiseIndex);
    setUpdateRows((prev) => ({
      ...prev,
      urlkey: rows,
    }));
    setStatus({ kind: 'success', message: `Generated ${formatCount(rows.length)} URL key audit rows.` });
    setActive('urlkey');
  };

  const handleGenerateHsnCodes = () => {
    const catalog = getCatalogRows();
    if (!catalog.length) {
      setStatus({ kind: 'error', message: 'Report data is still loading or not loaded. Please wait for it to load.' });
      return;
    }
    const rows = buildHsnAuditRows(catalog, gemstone2WiseIndex);
    setUpdateRows((prev) => ({
      ...prev,
      hsn: rows,
    }));
    setStatus({ kind: 'success', message: `Generated ${formatCount(rows.length)} HSN audit rows from gemstone2_wise.` });
    setActive('hsn');
  };

  const handleGenerateJewelleryHsnCodes = () => {
    const catalog = getCatalogRows();
    if (!catalog.length) {
      setStatus({ kind: 'error', message: 'Report catalog data is still loading or not loaded. Please wait for it to load.' });
      return;
    }
    if (!databaseSheets.length) {
      setStatus({ kind: 'error', message: 'Audit database sheets are still loading. Please wait a moment.' });
      return;
    }
    const rows = buildJewelleryHsnAuditRows(catalog, databaseSheets);
    setUpdateRows((prev) => ({
      ...prev,
      jewellery_hsn: rows,
    }));
    setStatus({ kind: 'success', message: `Generated ${formatCount(rows.length)} Jewellery HSN audit rows.` });
    setActive('jewellery_hsn');
  };

  const handleGenerateTaxClass = () => {
    const catalog = getCatalogRows();
    if (!catalog.length) {
      setStatus({ kind: 'error', message: 'Report data is still loading or not loaded. Please wait for it to load.' });
      return;
    }
    const rows = buildTaxClassAuditRows(catalog, databaseSheets);
    setUpdateRows((prev) => ({
      ...prev,
      taxclass: rows,
    }));
    setStatus({ kind: 'success', message: `Generated ${formatCount(rows.length)} Tax Class audit rows.` });
    setActive('taxclass');
  };

  const handleGenerateClassification = () => {
    const catalog = getCatalogRows();
    if (!catalog.length) {
      setStatus({ kind: 'error', message: 'Report data is still loading or not loaded. Please wait for it to load.' });
      return;
    }
    const rows = buildClassificationAuditRows(catalog, databaseSheets);
    setUpdateRows((prev) => ({
      ...prev,
      classification: rows,
    }));
    setStatus({ kind: 'success', message: `Generated ${formatCount(rows.length)} Classification audit rows.` });
    setActive('classification');
  };

  const handleGenerateStickers = () => {
    const catalog = getCatalogRows();
    if (!catalog.length) {
      setStatus({ kind: 'error', message: 'Report data is still loading or not loaded. Please wait for it to load.' });
      return;
    }
    const rows = buildStickerAuditRows(catalog, databaseSheets);
    setUpdateRows((prev) => ({
      ...prev,
      stickers: rows,
    }));
    setStatus({ kind: 'success', message: `Generated ${formatCount(rows.length)} Sticker audit rows.` });
    setActive('stickers');
  };

  const handleGenerateJColour = () => {
    const catalog = getCatalogRows();
    if (!catalog.length) {
      setStatus({ kind: 'error', message: 'Report data is still loading or not loaded. Please wait for it to load.' });
      return;
    }
    const rows = buildJColourAuditRows(catalog, databaseSheets);
    setUpdateRows((prev) => ({
      ...prev,
      jcolour: rows,
    }));
    setStatus({ kind: 'success', message: `Generated ${formatCount(rows.length)} J Colour audit rows.` });
    setActive('jcolour');
  };

  const handleGenerateDispatch = () => {
    const catalog = getCatalogRows();
    if (!catalog.length) {
      setStatus({ kind: 'error', message: 'Report data is still loading or not loaded. Please wait for it to load.' });
      return;
    }
    const rows = buildDispatchAuditRows(catalog, databaseSheets);
    setUpdateRows((prev) => ({
      ...prev,
      dispatch: rows,
    }));
    setStatus({ kind: 'success', message: `Generated ${formatCount(rows.length)} Dispatch & Shipping Days audit rows.` });
    setActive('dispatch');
  };

  const handleGenerateOrigin = () => {
    const catalog = getCatalogRows();
    if (!catalog.length) {
      setStatus({ kind: 'error', message: 'Report data is still loading or not loaded. Please wait for it to load.' });
      return;
    }
    const rows = buildOriginAuditRows(catalog, databaseSheets);
    setUpdateRows((prev) => ({
      ...prev,
      origin: rows,
    }));
    setStatus({ kind: 'success', message: `Generated ${formatCount(rows.length)} Origin audit rows.` });
    setActive('origin');
  };

  const handleGenerateBenefits = () => {
    const catalog = getCatalogRows();
    if (!catalog.length) {
      setStatus({ kind: 'error', message: 'Report data is still loading or not loaded. Please wait for it to load.' });
      return;
    }
    const rows = buildBenefitsAuditRows(catalog, databaseSheets);
    setUpdateRows((prev) => ({
      ...prev,
      benefits: rows,
    }));
    setStatus({ kind: 'success', message: `Generated ${formatCount(rows.length)} Benefits audit rows.` });
    setActive('benefits');
  };

  const handleGenerateName = () => {
    const catalog = getCatalogRows();
    if (!catalog.length) {
      setStatus({ kind: 'error', message: 'Report data is still loading or not loaded. Please wait for it to load.' });
      return;
    }
    const rows = buildNameAuditRows(catalog);
    setUpdateRows((prev) => ({
      ...prev,
      name: rows,
    }));
    setStatus({ kind: 'success', message: `Generated ${formatCount(rows.length)} Name audit rows.` });
    setActive('name');
  };



  const handlePasteSubmit = () => {
    const lines = pasteData.split('\n').map(l => l.trim()).filter(Boolean);
    const pastedData = [];
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split('\t');
      if (parts.length < 2) {
         const csvParts = lines[i].split(',');
         if (csvParts.length >= 2) {
             pastedData.push({ sku: csvParts[0].trim(), ppc: csvParts[1].trim() });
         }
         continue;
      }
      pastedData.push({ sku: parts[0].trim(), ppc: parts[1].trim() });
    }

    if (pastedData.length === 0) {
      setStatus({ kind: 'error', message: 'No valid data found in paste.' });
      return;
    }

    if (pastedData[0].sku.toLowerCase() === 'sku') {
      pastedData.shift();
    }
    
    const rows = [];
    const catalog = getCatalogRows();
    pastedData.forEach(item => {
      const matched = catalog.find(r => r.sku?.trim().toLowerCase() === item.sku.toLowerCase() || r.name?.trim().toLowerCase() === item.sku.toLowerCase());
      if (matched && normalizeLookupValue(matched.attribute_set_id) === 'gemstones' && isRowInStock(matched)) {
        const baseRow = {
          id: createRowId(),
          sku: matched.sku || matched.name || '',
          ppc: '',
          price: '',
          price_per_carat: '',
          callfor: '',
          price_range: '',
          price_per_carat_range: '',
          offers: '',
          product_category_type: '',
          comment_explation: '',
          shape: matched.shape || '',
          gemstone: matched.gemstone || '',
          carat_weight: matched.carat_weight || '',
          vendor: matched.vendor || '',
          comment_explation_original: matched.comment_explation || '',
        };
        const calcRow = calculatePriceRow(baseRow, item.ppc);
        rows.push(calcRow);
      }
    });

    setUpdateRows((prev) => ({
      ...prev,
      price: rows,
    }));
    setStatus({ kind: 'success', message: `Matched and generated ${formatCount(rows.length)} Price audit rows from pasted data.` });
    setIsPasteModalOpen(false);
    setPasteData('');
    setActive('price');
  };



  const handleDownloadActive = () => {
    try {
      if (activeDatabase) {
        const rows = activeDatabase.rows ?? [];
        if (!rows.length) {
          setStatus({ kind: 'error', message: 'No rows available to export.' });
          return;
        }
        const filename = formatDatedFilename(`${activeDatabase.sheetTitle}.csv`);
        exportRowsAsCsv(filename, rows, makeDatabaseColumns(activeDatabase.columns));
        setStatus({ kind: 'success', message: `Exported ${formatCount(rows.length)} rows to ${filename}` });
        return;
      }

      if (['report', 'q3_processed_images', 'videodata_new', 'templatetagproduct_gemstone', 'templatetagproduct_jewellery', 'templatetagproduct', 'custom_option_issues'].includes(active)) {
        let baseName = `${active}.csv`;
        if (active === 'report') baseName = 'export-data.csv';
        else if (active === 'templatetagproduct_gemstone') baseName = 'gemstone-custom-options.csv';
        else if (active === 'templatetagproduct_jewellery') baseName = 'jewellery-custom-options.csv';
        else if (active === 'custom_option_issues') baseName = 'custom-option-issues.csv';
        const filename = formatDatedFilename(baseName);
        if (!reportRows.length) {
          setStatus({ kind: 'error', message: 'No rows available to export.' });
          return;
        }
        exportRowsAsCsv(filename, reportRows, reportColumns);
        setStatus({ kind: 'success', message: `Exported ${formatCount(reportRows.length)} rows to ${filename}` });
        return;
      }

      if (UPDATE_PANELS[active]) {
        const panel = UPDATE_PANELS[active];
        const rows = updateRows[active] ?? [];
        if (!rows.length) {
          setStatus({ kind: 'error', message: 'No rows available to export.' });
          return;
        }
        const filename = formatDatedFilename(panel.filename);
        exportRowsAsCsv(filename, rows, panel.columns);
        setStatus({ kind: 'success', message: `Exported ${formatCount(rows.length)} rows to ${filename}` });
        return;
      }

      const mode = active === 'instock' ? 'in' : 'out';
      const rows = stockRows[mode] ?? [];
      if (!rows.length) {
        setStatus({ kind: 'error', message: 'No rows available to export.' });
        return;
      }
      const filename = formatDatedFilename(`${active}.csv`);
      exportRowsAsCsv(filename, rows, STOCK_COLUMNS);
      setStatus({ kind: 'success', message: `Exported ${formatCount(rows.length)} rows to ${filename}` });
    } catch (error) {
      console.error('Export error:', error);
      setStatus({ kind: 'error', message: error.message || 'Export failed.' });
    }
  };

  const renderPanel = () => {
    if (activeDatabase) return <DatabaseTable columns={activeDatabase.columns} rows={activeDatabase.rows} />;

    if (active.startsWith('database:')) {
      const sheetName = getDatabaseSheetId(active);
      return (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs text-center space-y-4 max-w-lg mx-auto my-auto">
          <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <DatabaseIcon className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {sheetName} Database
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Linked to your Google Sheet: <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">Catalog DataBase - Loose Gemstone</span>
            </p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-amber-900/40 text-xs text-left space-y-1 w-full">
            <p className="font-semibold">Google Sheets Database in Standby</p>
            <p className="text-[11.5px] text-amber-600 dark:text-amber-400/90">
              Click &quot;Connect Google Sheet&quot; below to connect via link sharing (view access) or Google Service Account.
            </p>
          </div>
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsSheetsModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <DatabaseIcon className="w-3.5 h-3.5" />
              Connect Google Sheet
            </button>
            <button
              type="button"
              onClick={() => fetchAuditDatabases(true)}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <RefreshCwIcon className="w-3.5 h-3.5" />
              Retry Load
            </button>
          </div>
        </div>
      );
    }

    if (['report', 'q3_processed_images', 'videodata_new', 'templatetagproduct_gemstone', 'templatetagproduct_jewellery', 'templatetagproduct', 'custom_option_issues'].includes(active)) {
      return (
        <ReportTable
          columns={reportColumns}
          rows={reportRows}
          onRowsChange={(updater) => {
            setReportRows((prev) => {
              const updated = typeof updater === 'function' ? updater(prev) : updater;
              if (workspaceCache.current[active]) {
                workspaceCache.current[active].rows = updated;
              }
              return updated;
            });
          }}
          onExport={handleDownloadActive}
          onRefresh={() => handleFetchData(active)}
          isRefreshing={isFetching}
        />
      );
    }

    if (active === 'video_audit') {
      return <VideoAuditPanel reportRows={reportRows} />;
    }

    if (UPDATE_PANELS[active]) {
      const panel = UPDATE_PANELS[active];
      return (
        <UpdatePanel
          columns={panel.columns}
          rows={updateRows[active] ?? []}
          onRowsChange={(updater) =>
            setUpdateRows((prev) => {
              const oldRows = prev[active] ?? [];
              const newRows = typeof updater === 'function' ? updater(oldRows) : updater;
              
              if (active === 'price') {
                const calcRows = newRows.map((newRow, idx) => {
                  const oldRow = oldRows[idx];
                  if (oldRow && oldRow.ppc !== newRow.ppc) {
                    return calculatePriceRow(newRow, newRow.ppc);
                  }
                  return newRow;
                });
                return { ...prev, [active]: calcRows };
              }
              
              return {
                ...prev,
                [active]: newRows,
              };
            })
          }
          onExport={handleDownloadActive}
        />
      );
    }

    const mode = active === 'instock' ? 'in' : 'out';
    return (
      <StockPanel
        mode={mode}
        rows={stockRows[mode] ?? []}
        onRowsChange={(updater) =>
          setStockRows((prev) => ({
            ...prev,
            [mode]: typeof updater === 'function' ? updater(prev[mode] ?? []) : updater,
          }))
        }
      />
    );
  };

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden font-sans ${isDarkMode ? 'dark' : ''}`} style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      <header className="app-topbar">
        <div className="flex items-center gap-3">
          <div className="brand-badge">G</div>
          <h1 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">GemPundit Audit</h1>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="px-2.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[10.5px] font-bold uppercase tracking-wider border border-amber-200/60 dark:border-amber-900/40">
            STAGING
          </span>
          <div className="topbar-status-chip">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span className="max-w-[200px] truncate" title={sourceLabel}>
              {sourceLabel.includes('report.csv') ? 'Local report.csv loaded' : sourceLabel}
            </span>
            <ChevronDownIcon className="w-3.5 h-3.5 text-slate-400" />
          </div>
          
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5"></div>

          <div className="topbar-status-chip">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span>{databaseSheets.length > 0 ? 'Reference DB loaded' : auditLabel}</span>
            <ChevronDownIcon className="w-3.5 h-3.5 text-slate-400" />
          </div>
          
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5"></div>

          {/* Google Sheets Status & Sync Pill */}
          <button
            type="button"
            onClick={() => setIsSheetsModalOpen(true)}
            className="topbar-status-chip hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Google Sheets Database Status & Sync Controls"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${sheetsStatus?.ready ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {sheetsStatus?.ready ? `Sheets: ${sheetsStatus.spreadsheetTitle || 'Connected'}` : 'Sheets: Standby'}
            </span>
            <ChevronDownIcon className="w-3.5 h-3.5 text-slate-400" />
          </button>
          
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5"></div>
          
          {/* Theme segmented toggle */}
          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setIsDarkMode(false)}
              className={`p-1 rounded-md transition-colors ${!isDarkMode ? 'bg-white dark:bg-slate-700 shadow-xs text-amber-500' : 'text-slate-400 hover:text-slate-600'}`}
              aria-label="Light Mode"
              title="Light Mode"
            >
              <SunIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsDarkMode(true)}
              className={`p-1 rounded-md transition-colors ${isDarkMode ? 'bg-white dark:bg-slate-700 shadow-xs text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}
              aria-label="Dark Mode"
              title="Dark Mode"
            >
              <MoonIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            className="btn-ghost flex items-center gap-1.5"
            onClick={handleDownloadActive}
            title="Export currently active view"
          >
            <span>Export</span>
            <ChevronDownIcon className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button 
            className="flex items-center gap-2 px-4 py-2 bg-[#111827] hover:bg-[#1E293B] dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors relative overflow-hidden" 
            onClick={() => handleFetchData(active)}
            disabled={isFetching}
            title={DB_LABELS[active] ? `Sync ${DB_LABELS[active]} from staging` : 'Sync Data'}
          >
            <RefreshCwIcon className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>{isFetching ? (downloadProgress != null ? `Syncing ${downloadProgress}%` : 'Syncing...') : (DB_LABELS[active] ? `Sync ${DB_LABELS[active]}` : 'Sync Export Data')}</span>
            {isFetching && (
              <div className="absolute inset-0 bg-white/20 pointer-events-none" style={{ width: downloadProgress != null ? `${downloadProgress}%` : '100%' }} />
            )}
          </button>
        </div>
      </header>

      {status.message && (
        <div className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between transition-all duration-200 ${
          status.kind === 'error' ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-b border-red-200 dark:border-red-900' :
          status.kind === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-900' :
          'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-b border-blue-200 dark:border-blue-900'
        }`}>
          <div className="flex items-center gap-2">
            <span>{status.kind === 'error' ? '❌' : status.kind === 'success' ? '✅' : 'ℹ️'}</span>
            <span>{status.message}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setStatus({ kind: 'info', message: '' })}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-bold px-1.5 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden bg-[#F6F8FB] dark:bg-[#0B0F19] app-body">
        <Sidebar active={active} onSelect={handleSelect} navGroups={navGroups} />

        <main className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col min-w-0">
          <div className="app-content mx-auto h-full flex flex-col w-full">
            <div className="page-heading flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
                  {activeLabel}
                  {active === 'urlkey' && <span className="text-slate-400 text-base cursor-pointer hover:text-slate-600" aria-label="Info" title="URL Key guidelines">ⓘ</span>}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {activeDatabase ? 'Workbook database table.' : active === 'urlkey' ? 'Review and validate proposed URL changes before export.' : `Manage ${activeLabel.toLowerCase()} attributes for SKUs.`}
                </p>
              </div>
              
              <div className="page-heading-actions flex items-center gap-3 flex-wrap justify-end">
                {active === 'urlkey' && (
                  <button className="btn-primary" type="button" onClick={handleGenerateUrlKeys}>
                    Generate URL Keys
                  </button>
                )}
                {active === 'weight' && (
                  <button className="btn-primary" type="button" onClick={handleGenerateWeights}>
                    Generate Weight Ratti
                  </button>
                )}
                {active === 'hsn' && (
                  <button className="btn-primary" type="button" onClick={handleGenerateHsnCodes}>
                    Generate HSN Codes
                  </button>
                )}
                {active === 'jewellery_hsn' && (
                  <button className="btn-primary" type="button" onClick={handleGenerateJewelleryHsnCodes}>
                    Generate Jewellery HSN
                  </button>
                )}
                {active === 'taxclass' && (
                  <button className="btn-primary" type="button" onClick={handleGenerateTaxClass}>
                    Generate Tax Class
                  </button>
                )}
                {active === 'classification' && (
                  <button className="btn-primary" type="button" onClick={handleGenerateClassification}>
                    Generate Classification
                  </button>
                )}
                {active === 'stickers' && (
                  <button className="btn-primary" type="button" onClick={handleGenerateStickers}>
                    Generate Stickers
                  </button>
                )}
                {active === 'jcolour' && (
                  <button className="btn-primary" type="button" onClick={handleGenerateJColour}>
                    Generate J Colour
                  </button>
                )}
                {active === 'dispatch' && (
                  <button className="btn-primary" type="button" onClick={handleGenerateDispatch}>
                    Generate Dispatch Days
                  </button>
                )}
                {active === 'origin' && (
                  <button className="btn-primary" type="button" onClick={handleGenerateOrigin}>
                    Generate Origin
                  </button>
                )}
                {active === 'benefits' && (
                  <button className="btn-primary" type="button" onClick={handleGenerateBenefits}>
                    Generate Benefits
                  </button>
                )}
                {active === 'name' && (
                  <button className="btn-primary" type="button" onClick={handleGenerateName}>
                    Generate Name
                  </button>
                )}
                {active === 'price' && (
                  <button className="btn-primary" type="button" onClick={() => setIsPasteModalOpen(true)}>
                    Paste SKU & PPC
                  </button>
                )}

                {UPDATE_PANELS[active] && updateRows[active]?.length > 0 && (
                  <>
                    <button 
                      className="btn-ghost text-red-600 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40" 
                      type="button" 
                      onClick={() => {
                        setUpdateRows(prev => ({ ...prev, [active]: [] }));
                        setStatus({ kind: 'info', message: `Cleared ${activeLabel} audit rows.` });
                      }}
                    >
                      Clear
                    </button>
                    <button className="btn-primary" type="button" onClick={handleDownloadActive}>
                      Export CSV
                    </button>
                  </>
                )}
                <span className="record-pill">
                  {formatCount(activeRowCount)} Records
                </span>
              </div>
            </div>

            {renderPanel()}
          </div>
        </main>
      </div>
      {isPasteModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col gap-4 text-gray-900 dark:text-gray-100">
            <h3 className="text-lg font-semibold">Paste SKU & PPC Data</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Copy the data from your spreadsheet (SKU column and PPC column) and paste it here.</p>
            <textarea
              className="border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-gray-100 p-3 rounded-lg h-64 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="SKU123&#9;150.50&#10;SKU124&#9;200.00"
              value={pasteData}
              onChange={e => setPasteData(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button className="btn-ghost" onClick={() => setIsPasteModalOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={handlePasteSubmit}>Process Data</button>
            </div>
          </div>
        </div>
      )}

      {/* Google Sheets Modal */}
      <GoogleSheetsModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        activePanelId={active}
        activeRows={UPDATE_PANELS[active] ? updateRows[active] : reportRows}
        onSheetsConnected={() => {
          fetchAuditDatabases(true);
          fetchSheetsStatus();
        }}
      />
    </div>
  );
}
