import fs from 'node:fs';
import Papa from 'papaparse';

/**
 * Escapes characters that trigger formula execution in spreadsheet software (Excel, Google Sheets).
 */
export function sanitizeCsvValue(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/^[=+\-@\t\r]/.test(text) || /^[=+\-@]/.test(text.trimStart())) {
    return `'${text}`;
  }
  return text;
}

/**
 * Parses a CSV string or buffer into an array of objects with sanitized headers.
 */
export function parseCsvText(csvText, options = {}) {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    ...options,
  });

  const blockingError = parsed.errors.find((error) => error.code !== 'TooFewFields');
  if (blockingError) {
    throw new Error(`CSV Parsing Error: ${blockingError.message}`);
  }

  const columns = parsed.meta.fields || [];
  const rows = parsed.data.map((row) => {
    const cleanRow = {};
    columns.forEach((col) => {
      cleanRow[col] = row[col] !== undefined ? String(row[col]).trim() : '';
    });
    return cleanRow;
  });

  return { columns, rows };
}

/**
 * Parses a CSV file from disk synchronously or via stream.
 */
export async function parseCsvFile(filePath) {
  const content = await fs.promises.readFile(filePath, 'utf8');
  return parseCsvText(content);
}

/**
 * Formats an array of objects into a sanitized CSV string.
 */
export function formatCsv(rows, columns = null) {
  if (!rows || rows.length === 0) return '';

  const exportColumns = columns || Object.keys(rows[0]).filter((k) => k !== 'id');
  const sanitizedRows = rows.map((row) => {
    const clean = {};
    exportColumns.forEach((col) => {
      clean[col] = sanitizeCsvValue(row[col]);
    });
    return clean;
  });

  return Papa.unparse(sanitizedRows, {
    columns: exportColumns,
    header: true,
  });
}
