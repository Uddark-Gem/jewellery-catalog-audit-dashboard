import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGoogleSheetsClient } from '../server/config/google.js';
import { parseCsvText } from '../server/services/csvService.js';
import { config } from '../server/config/env.js';
import { SHEETS_MAPPING } from '../server/config/sheetsMapping.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

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
    // Sheet does not exist, add it
    console.log(`Creating worksheet "${sheetTitle}"...`);
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
    console.log(`Resizing "${sheetTitle}" grid from ${currentRows}x${currentCols} to ${Math.max(currentRows, neededRows + 50)}x${Math.max(currentCols, neededCols + 5)}...`);
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

export async function uploadDatasetToSheet(targetId, maxRowsLimit = null) {
  const targetConfig = SHEETS_MAPPING[targetId];
  if (!targetConfig) {
    throw new Error(`Unknown targetId: "${targetId}". Valid: ${Object.keys(SHEETS_MAPPING).join(', ')}`);
  }

  const { spreadsheetId, sheetName } = targetConfig;
  const csvPath = path.join(config.paths.data, `${targetId}.csv`);

  if (!fs.existsSync(csvPath)) {
    console.warn(`[Skip] CSV file not found at: ${csvPath}`);
    return { success: false, error: 'CSV file not found' };
  }

  console.log(`\n========================================================`);
  console.log(`Uploading: ${targetId} -> Sheet "${sheetName}"`);
  console.log(`Spreadsheet ID: ${spreadsheetId}`);
  console.log(`CSV file: ${csvPath}`);

  const sheets = await getGoogleSheetsClient();

  // 1. Read & parse CSV
  console.log('Reading CSV file from disk...');
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
    console.log(`Limiting upload to first ${maxRowsLimit} rows (total available: ${rows.length})...`);
    rows = rows.slice(0, maxRowsLimit);
  }

  const totalRows = rows.length;
  const totalCols = columns.length;
  console.log(`Total rows to upload: ${totalRows}, columns: ${totalCols}`);

  // 2. Ensure grid size in Google Sheet
  await ensureGridSize(sheets, spreadsheetId, sheetName, totalRows + 1, totalCols);

  // 3. Clear existing values
  console.log(`Clearing existing values in "${sheetName}"...`);
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${sheetName}!A1:ZZ`,
  });

  // 4. Write header
  console.log(`Writing headers (${totalCols} columns)...`);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [columns] },
  });

  // 5. Write rows in batches
  let uploadedCount = 0;
  for (let i = 0; i < totalRows; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const startRow = i + 2; // Row 1 is headers (1-indexed)
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
    const pct = Math.round((uploadedCount / totalRows) * 100);
    console.log(`Progress: ${uploadedCount} / ${totalRows} rows uploaded (${pct}%)...`);
    await sleep(200); // Gentle pacing
  }

  console.log(`Successfully uploaded ${uploadedCount} rows to "${sheetName}"!`);
  return { success: true, uploadedCount, sheetName };
}

// Allow running from CLI directly: node scripts/uploadStagingToSheets.js [targetId] [limit]
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const argTarget = process.argv[2] || 'all';
  const argLimit = process.argv[3] ? Number.parseInt(process.argv[3], 10) : null;

  (async () => {
    try {
      if (argTarget === 'all') {
        for (const t of Object.keys(SHEETS_MAPPING)) {
          try {
            await uploadDatasetToSheet(t, argLimit);
          } catch (e) {
            console.error(`Error uploading ${t}:`, e.message);
          }
        }
      } else {
        await uploadDatasetToSheet(argTarget, argLimit);
      }
      console.log('\nAll done!');
      process.exit(0);
    } catch (err) {
      console.error('Fatal error:', err);
      process.exit(1);
    }
  })();
}
