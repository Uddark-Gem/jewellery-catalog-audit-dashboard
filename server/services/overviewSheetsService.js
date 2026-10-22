import fs from 'node:fs';
import path from 'node:path';
import { getGoogleSheetsClient } from '../config/google.js';
import { SHEETS_MAPPING } from '../config/sheetsMapping.js';
import { parseCsvText } from './csvService.js';
import { config } from '../config/env.js';

const BATCH_SIZE = 2500;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ensures grid dimensions in Google Sheets can accommodate total rows and columns.
 */
async function ensureGridSize(sheets, spreadsheetId, sheetTitle, neededRows, neededCols) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets.find((s) => s.properties.title.toLowerCase() === sheetTitle.toLowerCase());
  if (!sheet) {
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetTitle,
                gridProperties: {
                  rowCount: Math.max(neededRows + 10, 1000),
                  columnCount: Math.max(neededCols + 5, 26),
                },
              },
            },
          },
        ],
      },
    });
    return addRes.data.replies[0].addSheet.properties.sheetId;
  }

  const sheetId = sheet.properties.sheetId;
  const currentRows = sheet.properties.gridProperties?.rowCount || 1000;
  const currentCols = sheet.properties.gridProperties?.columnCount || 26;

  if (currentRows < neededRows || currentCols < neededCols) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                gridProperties: {
                  rowCount: Math.max(currentRows, neededRows + 50),
                  columnCount: Math.max(currentCols, neededCols + 5),
                },
              },
              fields: 'gridProperties(rowCount,columnCount)',
            },
          },
        ],
      },
    });
  }

  return sheetId;
}

/**
 * Uploads a local CSV or parsed dataset into its mapped Google Sheet.
 */
export async function uploadDatasetToSheet(targetId, maxRowsLimit = null) {
  const targetConfig = SHEETS_MAPPING[targetId];
  if (!targetConfig) {
    throw new Error(`Unknown targetId: "${targetId}". Valid: ${Object.keys(SHEETS_MAPPING).join(', ')}`);
  }

  const { spreadsheetId, sheetName } = targetConfig;
  const csvPath = path.join(config.paths.data, `${targetId}.csv`);

  if (!fs.existsSync(csvPath)) {
    console.warn(`[Skip] CSV file not found at: ${csvPath}`);
    return { success: false, error: `CSV file not found at ${csvPath}` };
  }

  console.log(`[Upload] Starting upload for ${targetId} -> Sheet "${sheetName}" (${spreadsheetId})`);

  const sheets = await getGoogleSheetsClient();
  const csvContent = await fs.promises.readFile(csvPath, 'utf8');
  const parsed = parseCsvText(csvContent);

  let columns = parsed.columns || [];
  let rows = parsed.rows || [];

  if (targetId === 'report') {
    const REMOVED_REPORT_COLUMNS = new Set([
      'sku_for_vendor_product', 'vendor_id', 'special_price', 'weight_carat', 'weight_sort1',
      'gem_composition', 'return_policy', 'offer_type', 'description', 'short_description',
      'description2', 'small_image', 'thumbnail', 'invoice_id', 'news_to_date',
      'promotion_discount_price', 'additional_certification', 'verified_certificateimage',
      'verified_certificateimage1', 'length_cm', 'how_to_wear', 'arrangement_type',
      'strands', 'length_inches', 'beads_in_strand', 'beads_size', 'hole', 'call_for_price_text'
    ]);
    columns = columns.filter((col) => col && !REMOVED_REPORT_COLUMNS.has(col));
    rows = rows.filter((row) => !String(row.status ?? '').trim().toLowerCase().includes('disabled'));
  }

  if (maxRowsLimit && rows.length > maxRowsLimit) {
    rows = rows.slice(0, maxRowsLimit);
  }

  const totalRows = rows.length;
  const totalCols = columns.length;

  await ensureGridSize(sheets, spreadsheetId, sheetName, totalRows + 1, totalCols);

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${sheetName}!A1:ZZ`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [columns] },
  });

  let uploadedCount = 0;
  for (let i = 0; i < totalRows; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const startRow = i + 2;
    const range = `${sheetName}!A${startRow}`;
    const values = chunk.map((r) => columns.map((col) => r[col] ?? ''));

    let attempt = 0;
    while (attempt < 5) {
      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values },
        });
        break;
      } catch (err) {
        attempt++;
        const isRate = err.code === 429 || err.message?.includes('RATE_LIMIT_EXCEEDED');
        console.warn(`[Batch ${i / BATCH_SIZE + 1}] Retrying attempt ${attempt} after delay... ${err.message}`);
        await sleep(isRate ? 3000 * attempt : 1000 * attempt);
        if (attempt >= 5) throw err;
      }
    }

    uploadedCount += chunk.length;
    await sleep(200);
  }

  console.log(`[Upload] Uploaded ${uploadedCount} rows to "${sheetName}"`);
  return { success: true, uploadedCount, sheetName };
}

/**
 * Fetches dataset rows and columns directly from the mapped Google Sheet.
 * Limits row fetching to stay safely within memory and response limits.
 */
export async function fetchDatasetFromGoogleSheet(targetId, limit = 3000) {
  const targetConfig = SHEETS_MAPPING[targetId];
  if (!targetConfig) return null;

  const { spreadsheetId, sheetName, fallbackSheetName } = targetConfig;
  const sheets = await getGoogleSheetsClient();

  let activeSheetName = sheetName;
  let range = `${activeSheetName}!A1:ZZ${limit + 1}`;
  let response;

  try {
    response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: 'FORMATTED_VALUE',
    });
  } catch (err) {
    if (fallbackSheetName) {
      try {
        activeSheetName = fallbackSheetName;
        range = `${activeSheetName}!A1:ZZ${limit + 1}`;
        response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
          valueRenderOption: 'FORMATTED_VALUE',
        });
      } catch (fallbackErr) {
        if (fallbackErr.code === 403 || fallbackErr.message?.includes('permission')) {
          return {
            source: `Google Sheet: ${activeSheetName} (Permission Required)`,
            columns: ['Notice', 'Action Required', 'Service Account Email'],
            rows: [{
              Notice: `Cannot access Google Spreadsheet (${spreadsheetId})`,
              'Action Required': `Please open sheet, click 'Share', and add the Service Account as Editor.`,
              'Service Account Email': 'sheet-cat@sanguine-frame-509407-n9.iam.gserviceaccount.com',
            }],
            totalRows: 0,
            spreadsheetId,
            sheetName: activeSheetName,
            error: fallbackErr.message,
          };
        }
        throw fallbackErr;
      }
    } else {
      if (err.code === 403 || err.message?.includes('permission')) {
        return {
          source: `Google Sheet: ${activeSheetName} (Permission Required)`,
          columns: ['Notice', 'Action Required', 'Service Account Email'],
          rows: [{
            Notice: `Cannot access Google Spreadsheet (${spreadsheetId})`,
            'Action Required': `Please open sheet, click 'Share', and add the Service Account as Editor.`,
            'Service Account Email': 'sheet-cat@sanguine-frame-509407-n9.iam.gserviceaccount.com',
          }],
          totalRows: 0,
          spreadsheetId,
          sheetName: activeSheetName,
          error: err.message,
        };
      }
      throw err;
    }
  }

  const values = response?.data?.values || [];
  if (values.length === 0) {
    return {
      source: `Google Sheet: ${activeSheetName} (Empty)`,
      columns: [],
      rows: [],
      totalRows: 0,
      spreadsheetId,
      sheetName: activeSheetName,
    };
  }

  const columns = values[0].map((h) => String(h || '').trim()).filter(Boolean);
  const rawRows = values.slice(1);
  const rows = rawRows.map((r) => {
    const rowObj = {};
    columns.forEach((col, idx) => {
      rowObj[col] = r[idx] !== undefined ? String(r[idx]) : '';
    });
    return rowObj;
  });

  return {
    source: `Google Sheet: ${activeSheetName}`,
    columns,
    rows,
    totalRows: rows.length,
    spreadsheetId,
    sheetName: activeSheetName,
  };
}
