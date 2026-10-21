import Papa from 'papaparse';

export const createRowId = () =>
  globalThis.crypto?.randomUUID?.() ?? `row-${Date.now()}-${Math.random()}`;

export const blankRow = (keys) =>
  Object.fromEntries([['id', createRowId()], ...keys.map((key) => [key, ''])]);

export const hasRowValue = (row) =>
  Object.entries(row).some(([key, value]) => key !== 'id' && String(value ?? '').trim() !== '');

export const parseCsv = (text) =>
  new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const blockingError = results.errors.find((error) => error.code !== 'TooFewFields');

        if (blockingError) {
          reject(new Error(blockingError.message));
          return;
        }

        resolve(
          results.data
            .filter(hasRowValue)
            .map((row) => ({
              ...row,
              id: createRowId(),
            })),
        );
      },
      error: (error) => reject(error),
    });
  });

export const isRowInStock = (row) => {
  const stockFlag = String(row.is_in_stock ?? '').trim().toLowerCase();

  if (['1', 'true', 'yes', 'in stock'].includes(stockFlag)) return true;
  if (['0', 'false', 'no', 'out of stock'].includes(stockFlag)) return false;

  const qty = Number.parseFloat(String(row.qty ?? '').replaceAll(',', ''));
  return Number.isFinite(qty) ? qty > 0 : false;
};

const escapeCsvCell = (value) => {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text.trimStart()) ? `'${text}` : text;
};

export const formatDatedFilename = (filename) => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  if (!filename) return `export-${dateStr}.csv`;

  if (filename.toLowerCase().endsWith('.csv')) {
    const base = filename.slice(0, -4);
    if (base.endsWith(dateStr)) return filename;
    return `${base}-${dateStr}.csv`;
  }
  return `${filename}-${dateStr}.csv`;
};

export const exportRowsAsCsv = (filename, rows, columns) => {
  if (!rows || rows.length === 0) {
    throw new Error('No rows to export.');
  }

  const finalFilename = formatDatedFilename(filename);

  const exportColumns = (columns && columns.length > 0)
    ? columns.filter((c) => !c.omitExport)
    : Object.keys(rows[0] || {}).filter((k) => k !== 'id').map((k) => ({ key: k, label: k }));

  if (exportColumns.length === 0) {
    throw new Error('No columns configured for export.');
  }

  const headers = exportColumns.map((column) => column.csvKey ?? column.key);
  const chunks = [];
  chunks.push(Papa.unparse([headers]) + '\r\n');

  // Process rows in batches of 5000 to keep memory footprint low and prevent browser lockup
  const BATCH_SIZE = 5000;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const slice = rows.slice(i, i + BATCH_SIZE);
    const batchData = [];
    for (let j = 0; j < slice.length; j++) {
      const row = slice[j];
      if (hasRowValue(row)) {
        batchData.push(exportColumns.map((column) => escapeCsvCell(row[column.key])));
      }
    }
    if (batchData.length > 0) {
      chunks.push(Papa.unparse(batchData, { header: false }) + '\r\n');
    }
  }

  const blob = new Blob(chunks, { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = finalFilename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};