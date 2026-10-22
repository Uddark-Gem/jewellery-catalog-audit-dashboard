import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { getGoogleSheetsClient } from '../config/google.js';
import { SHEETS_MAPPING } from '../config/sheetsMapping.js';
import { parseCsvLine } from './csvService.js';
import { config } from '../config/env.js';

const PACKET_SIZE = 1000;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const REMOVED_REPORT_COLUMNS = new Set([
  'sku_for_vendor_product', 'vendor_id', 'special_price', 'weight_carat', 'weight_sort1',
  'gem_composition', 'return_policy', 'offer_type', 'description', 'short_description',
  'description2', 'small_image', 'thumbnail', 'invoice_id', 'news_to_date',
  'promotion_discount_price', 'additional_certification', 'verified_certificateimage',
  'verified_certificateimage1', 'length_cm', 'how_to_wear', 'arrangement_type',
  'strands', 'length_inches', 'beads_in_strand', 'beads_size', 'hole', 'call_for_price_text'
]);

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
                  rowCount: Math.max(neededRows + 50, 1000),
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
    const targetRows = Math.max(currentRows, neededRows + 50);
    const targetCols = Math.max(currentCols, neededCols + 5);
    console.log(`[Grid] Resizing "${sheetTitle}" grid to ${targetRows} rows x ${targetCols} cols...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                gridProperties: {
                  rowCount: targetRows,
                  columnCount: targetCols,
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
 * Uploads a local CSV dataset into its mapped Google Sheet in small chunk packets (500-1000 rows).
 * Streams line-by-line to prevent high memory usage.
 */
export async function uploadDatasetToSheet(targetId, maxRowsLimit = null, onProgress = null) {
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

  console.log(`\n========================================================`);
  console.log(`[Upload] Dataset: ${targetId} -> Sheet "${sheetName}"`);
  console.log(`[Upload] Spreadsheet ID: ${spreadsheetId}`);
  console.log(`[Upload] Source CSV: ${csvPath}`);

  const sheets = await getGoogleSheetsClient();

  // Step 1: Read header line and count lines
  console.log('[Upload] Scanning lines and headers...');
  let rawHeaders = null;
  let totalLineCount = 0;

  const countRl = readline.createInterface({
    input: fs.createReadStream(csvPath),
    crlfDelay: Infinity,
  });

  for await (const line of countRl) {
    if (!line.trim()) continue;
    if (!rawHeaders) {
      rawHeaders = parseCsvLine(line);
    } else {
      totalLineCount++;
    }
  }

  if (!rawHeaders || rawHeaders.length === 0) {
    throw new Error(`CSV file ${csvPath} is empty or has no header.`);
  }

  let finalHeaders = rawHeaders;
  const isReport = targetId === 'report';
  if (isReport) {
    finalHeaders = rawHeaders.filter((col) => col && !REMOVED_REPORT_COLUMNS.has(col));
  }

  const colIndices = finalHeaders.map((h) => rawHeaders.indexOf(h));
  const effectiveTotal = maxRowsLimit ? Math.min(totalLineCount, maxRowsLimit) : totalLineCount;
  console.log(`[Upload] Headers: ${finalHeaders.length} columns. Total data rows: ${effectiveTotal}`);

  // Step 2: Ensure grid dimensions
  await ensureGridSize(sheets, spreadsheetId, sheetName, effectiveTotal + 10, finalHeaders.length + 5);

  // Step 3: Clear existing sheet
  console.log(`[Upload] Clearing existing values in "${sheetName}"...`);
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${sheetName}!A1:ZZ`,
  });

  // Step 4: Write header row
  console.log('[Upload] Writing header row...');
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [finalHeaders] },
  });

  // Step 5: Stream lines in packets of PACKET_SIZE (1,000 rows)
  console.log(`[Upload] Uploading ${effectiveTotal} rows in packets of ${PACKET_SIZE} rows...`);
  const readRl = readline.createInterface({
    input: fs.createReadStream(csvPath),
    crlfDelay: Infinity,
  });

  let isFirstLine = true;
  let currentPacket = [];
  let uploadedRows = 0;
  let startRowIndex = 2; // Row 1 is header

  const statusIdx = rawHeaders.indexOf('status');

  const sendPacket = async (packet, startRow) => {
    let attempt = 0;
    const range = `${sheetName}!A${startRow}`;
    while (attempt < 6) {
      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: packet },
        });
        return;
      } catch (err) {
        attempt++;
        const isRate = err.code === 429 || err.message?.includes('RATE_LIMIT_EXCEEDED');
        const delay = isRate ? 3000 * attempt : 1500 * attempt;
        console.warn(`[Packet @ Row ${startRow}] Attempt ${attempt} failed (${err.message}). Retrying in ${delay}ms...`);
        await sleep(delay);
        if (attempt >= 6) throw err;
      }
    }
  };

  for await (const line of readRl) {
    if (isFirstLine) {
      isFirstLine = false;
      continue;
    }
    if (!line.trim()) continue;

    const rowValues = parseCsvLine(line);

    // Filter disabled if report
    if (isReport && statusIdx !== -1) {
      const statusVal = String(rowValues[statusIdx] ?? '').toLowerCase();
      if (statusVal.includes('disabled')) continue;
    }

    const shapedRow = colIndices.map((idx) => (idx !== -1 ? (rowValues[idx] ?? '') : ''));
    currentPacket.push(shapedRow);

    if (currentPacket.length >= PACKET_SIZE) {
      await sendPacket(currentPacket, startRowIndex);
      uploadedRows += currentPacket.length;
      startRowIndex += currentPacket.length;
      const pct = Math.round((uploadedRows / effectiveTotal) * 100);
      console.log(`[Upload Progress] ${uploadedRows} / ${effectiveTotal} rows (${pct}%) uploaded to "${sheetName}"`);
      if (onProgress) onProgress(uploadedRows, effectiveTotal, pct);
      currentPacket = [];
      await sleep(150); // Pacing for Google API quota
    }

    if (maxRowsLimit && uploadedRows + currentPacket.length >= maxRowsLimit) {
      break;
    }
  }

  // Flush any remaining rows
  if (currentPacket.length > 0) {
    await sendPacket(currentPacket, startRowIndex);
    uploadedRows += currentPacket.length;
    console.log(`[Upload Progress] ${uploadedRows} / ${effectiveTotal} rows (100%) uploaded to "${sheetName}"`);
    if (onProgress) onProgress(uploadedRows, effectiveTotal, 100);
  }

  console.log(`[Upload Complete] Finished uploading all ${uploadedRows} rows to "${sheetName}"!`);
  return { success: true, uploadedCount: uploadedRows, sheetName, spreadsheetId };
}

/**
 * Fetches dataset rows and columns directly from the mapped Google Sheet.
 * Supports pagination (page, limit) to keep responses fast and within Vercel's payload limits.
 */
export async function fetchDatasetFromGoogleSheet(targetId, limit = 2500, page = 1) {
  const targetConfig = SHEETS_MAPPING[targetId];
  if (!targetConfig) return null;

  const { spreadsheetId, sheetName, fallbackSheetName } = targetConfig;
  const sheets = await getGoogleSheetsClient();

  let activeSheetName = sheetName;
  const offset = (page - 1) * limit;
  const startRow = offset + 2; // Row 1 is header
  const endRow = offset + limit + 1;

  // First fetch header row + requested data rows
  const headerRange = `${activeSheetName}!A1:ZZ1`;
  const dataRange = `${activeSheetName}!A${startRow}:ZZ${endRow}`;

  let headerResponse;
  let dataResponse;

  try {
    const batchRes = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: [headerRange, dataRange],
      valueRenderOption: 'FORMATTED_VALUE',
    });
    headerResponse = batchRes.data.valueRanges?.[0]?.values;
    dataResponse = batchRes.data.valueRanges?.[1]?.values;
  } catch (err) {
    if (fallbackSheetName) {
      try {
        activeSheetName = fallbackSheetName;
        const batchRes = await sheets.spreadsheets.values.batchGet({
          spreadsheetId,
          ranges: [`${activeSheetName}!A1:ZZ1`, `${activeSheetName}!A${startRow}:ZZ${endRow}`],
          valueRenderOption: 'FORMATTED_VALUE',
        });
        headerResponse = batchRes.data.valueRanges?.[0]?.values;
        dataResponse = batchRes.data.valueRanges?.[1]?.values;
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

  const columns = (headerResponse?.[0] || []).map((h) => String(h || '').trim()).filter(Boolean);
  const rawRows = dataResponse || [];

  if (columns.length === 0 && rawRows.length === 0) {
    return {
      source: `Google Sheet: ${activeSheetName} (Empty)`,
      columns: [],
      rows: [],
      totalRows: 0,
      page,
      pageSize: limit,
      spreadsheetId,
      sheetName: activeSheetName,
    };
  }

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
    page,
    pageSize: limit,
    totalRows: rows.length,
    spreadsheetId,
    sheetName: activeSheetName,
  };
}
