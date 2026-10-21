import { blankRow } from './csv.js';

const KNOWN_REPORT_COLUMNS = {
  sku: { label: 'SKU', width: 110, placeholder: 'product-sku' },
  name: { label: 'Name', width: 160, placeholder: 'Product name' },
  url_key: { label: 'URL Key', width: 160, placeholder: '/url-key-slug' },
  product_url: { label: 'Product URL', width: 220, placeholder: 'https://...' },
  attribute_set_id: { label: 'Attribute Set ID', width: 140, placeholder: 'Attribute Set' },
  gemstone: { label: 'Gemstone', width: 130, placeholder: 'Gemstone' },
  shape: { label: 'Shape', width: 110, placeholder: 'Shape' },
  cut: { label: 'Cut', width: 100, placeholder: 'Cut' },
  design_code: { label: 'Design Code', width: 120, placeholder: 'B1' },
  weight_ratti: { label: 'Weight (Ratti)', width: 100, placeholder: '0.000' },
  hsn_code: { label: 'HSN Code', width: 90, placeholder: '711319' },
  tax_class_id: { label: 'Tax Class', width: 85, placeholder: '0' },
  stickers: { label: 'Stickers', width: 130, placeholder: 'sticker_name' },
  price: { label: 'Price', width: 80, placeholder: '0.00' },
  status: { label: 'Status', width: 80, placeholder: 'enabled' },
  qty: { label: 'Qty', width: 60, placeholder: '0' },
  is_in_stock: { label: 'is_in_stock', width: 85, placeholder: '1' },
  Pooja: { label: 'Pooja', width: 180, placeholder: 'Pooja' },
  'Pooja-1': { label: 'Pooja 2', width: 180, placeholder: 'Pooja 2' },
  Certificate: { label: 'Certificate', width: 200, placeholder: 'Certificate' },
  'Certificate-1': { label: 'Certificate 2', width: 200, placeholder: 'Certificate 2' },
  'Custom Options': { label: 'Custom Options', width: 220, placeholder: 'Custom Options' },
  'Custom Options-1': { label: 'Custom Options 2', width: 220, placeholder: 'Custom Options 2' },
  'Weight Option': { label: 'Weight Option', width: 220, placeholder: 'Weight Option' },
  'Weight Option-1': { label: 'Weight Option 2', width: 220, placeholder: 'Weight Option 2' },
  'Jewellry Option': { label: 'Jewellery Option', width: 240, placeholder: 'Jewellery Option' },
  'Jewellry Option-1': { label: 'Jewellery Option 2', width: 240, placeholder: 'Jewellery Option 2' },
  'Gold Option': { label: 'Gold Option', width: 180, placeholder: 'Gold Option' },
  'Gold Option-1': { label: 'Gold Option 2', width: 180, placeholder: 'Gold Option 2' },
  'Diamond Substitute': { label: 'Diamond Substitute', width: 180, placeholder: 'Diamond Substitute' },
  'Diamond Substitute-1': { label: 'Diamond Substitute 2', width: 180, placeholder: 'Diamond Substitute 2' },
  Costing: { label: 'Costing', width: 120, placeholder: 'Costing' },
  'Ring Size System': { label: 'Ring Size System', width: 180, placeholder: 'Ring Size' },
  'Ring Size System-1': { label: 'Ring Size System 2', width: 180, placeholder: 'Ring Size 2' },
  'Ring Size System-2': { label: 'Ring Size System 3', width: 180, placeholder: 'Ring Size 3' },
  'Bracelet Chain': { label: 'Bracelet Chain', width: 160, placeholder: 'Bracelet Chain' },
  'Bracelet Size': { label: 'Bracelet Size', width: 160, placeholder: 'Bracelet Size' },
  issue_type: { label: 'Issue Type', width: 230, placeholder: 'Issue type' },
  affected_options: { label: 'Affected Option(s)', width: 350, placeholder: 'Details' },
  action_taken: { label: 'Action Taken', width: 280, placeholder: 'Action' },
};

export const makeReportColumns = (keys = []) =>
  keys
    .filter((key) => key && key !== 'id')
    .map((key) => ({
      key,
      label: KNOWN_REPORT_COLUMNS[key]?.label ?? key,
      width: KNOWN_REPORT_COLUMNS[key]?.width ?? Math.min(Math.max(key.length * 9 + 32, 96), 220),
      placeholder: KNOWN_REPORT_COLUMNS[key]?.placeholder ?? '',
    }));

export const REPORT_COLUMNS = [
  { key: 'sku', label: 'SKU', width: 110, placeholder: 'product-sku' },
  { key: 'name', label: 'Name', width: 160, placeholder: 'Product name' },
  { key: 'url_key', label: 'URL Key', width: 160, placeholder: '/url-key-slug' },
  { key: 'design_code', label: 'Design Code', width: 120, placeholder: 'B1' },
  { key: 'weight_ratti', label: 'Weight (Ratti)', width: 100, placeholder: '0.000' },
  { key: 'hsn_code', label: 'HSN Code', width: 90, placeholder: '711319' },
  { key: 'tax_class_id', label: 'Tax Class', width: 85, placeholder: '0' },
  { key: 'stickers', label: 'Stickers', width: 130, placeholder: 'sticker_name' },
  { key: 'price', label: 'Price', width: 80, placeholder: '0.00' },
  { key: 'status', label: 'Status', width: 80, placeholder: 'enabled' },
  { key: 'qty', label: 'Qty', width: 60, placeholder: '0' },
];

export const STOCK_COLUMNS = [
  { key: 'sku', label: 'SKU / Identifier', width: 180, placeholder: 'product-sku-001' },
  { key: 'stock_action', label: 'Action', width: 140, placeholder: 'Mark in stock' },
  { key: 'current_qty', label: 'Current Qty', width: 100, placeholder: '0' },
  { key: 'notes', label: 'Notes', width: 220, placeholder: 'optional note' },
];

export const blankReportRows = (count = 4) =>
  Array.from({ length: count }, () => blankRow(REPORT_COLUMNS.map((column) => column.key)));

export const blankUpdateRows = (columns, count = 2) =>
  Array.from({ length: count }, () => blankRow(columns.map((column) => column.key)));

export const blankStockRows = (mode, count = 2) =>
  Array.from({ length: count }, () => ({
    ...blankRow(STOCK_COLUMNS.map((column) => column.key)),
    stock_action: mode === 'in' ? 'Mark in stock' : 'Mark out of stock',
  }));
