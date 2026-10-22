import axios from 'axios';
import { getGoogleSheetsClient } from '../config/google.js';
import { config } from '../config/env.js';
import { parseCsvText } from './csvService.js';

/**
 * Executes a Google Sheets API call with exponential backoff on rate limits / 429 errors.
 */
async function withRetry(operation, maxRetries = 3, initialDelayMs = 1000) {
  let attempt = 0;
  let delay = initialDelayMs;

  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (error) {
      attempt++;
      const isRateLimit = error.code === 429 || error.status === 429 || error.message?.includes('RATE_LIMIT_EXCEEDED');
      const isTransient = error.code >= 500 && error.code < 600;

      if ((isRateLimit || isTransient) && attempt < maxRetries) {
        console.warn(`[GoogleSheetsService] API error (${error.code || error.message}), retrying attempt ${attempt}/${maxRetries} after ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        throw error;
      }
    }
  }
}

/**
 * GoogleSheetsService provides high-performance, batch-oriented methods to interact with Google Sheets.
 */
export class GoogleSheetsService {
  constructor(spreadsheetId = config.google.spreadsheetId) {
    this.spreadsheetId = spreadsheetId;
  }

  /**
   * Reads a single worksheet or range. Returns { headers, rows, rawValues }.
   */
  async readSheet(range = 'A1:ZZ') {
    if (!this.spreadsheetId) throw new Error('Spreadsheet ID is not configured.');
    const sheets = await getGoogleSheetsClient();

    const response = await withRetry(async () =>
      sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range,
        valueRenderOption: 'FORMATTED_VALUE',
      })
    );

    const values = response.data.values || [];
    if (values.length === 0) {
      return { headers: [], rows: [], rawValues: [] };
    }

    const headers = values[0].map((h) => String(h || '').trim());
    const rows = values.slice(1).map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        if (header) {
          obj[header] = row[index] !== undefined ? String(row[index]) : '';
        }
      });
      return obj;
    });

    return { headers, rows, rawValues: values };
  }

  /**
   * Batch-reads multiple ranges / sheets in a single HTTP request.
   */
  async batchReadSheets(ranges = []) {
    if (!this.spreadsheetId) throw new Error('Spreadsheet ID is not configured.');
    if (ranges.length === 0) return {};

    const sheets = await getGoogleSheetsClient();
    const response = await withRetry(async () =>
      sheets.spreadsheets.values.batchGet({
        spreadsheetId: this.spreadsheetId,
        ranges,
        valueRenderOption: 'FORMATTED_VALUE',
      })
    );

    const valueRanges = response.data.valueRanges || [];
    const results = {};

    valueRanges.forEach((vr) => {
      const rangeName = vr.range || '';
      const values = vr.values || [];
      if (values.length === 0) {
        results[rangeName] = { headers: [], rows: [] };
        return;
      }

      const headers = values[0].map((h) => String(h || '').trim());
      const rows = values.slice(1).map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          if (header) {
            obj[header] = row[index] !== undefined ? String(row[index]) : '';
          }
        });
        return obj;
      });

      results[rangeName] = { headers, rows };
    });

    return results;
  }

  /**
   * Appends rows to a worksheet using batching.
   */
  async appendRows(sheetName, rows = [], headers = null) {
    if (!this.spreadsheetId) throw new Error('Spreadsheet ID is not configured.');
    if (rows.length === 0) return { updatedRows: 0 };

    const sheets = await getGoogleSheetsClient();
    const activeHeaders = headers || Object.keys(rows[0] || {}).filter((k) => k !== 'id');

    const valueRows = rows.map((row) => activeHeaders.map((header) => row[header] ?? ''));

    const response = await withRetry(async () =>
      sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: valueRows,
        },
      })
    );

    return { updatedRows: response.data.updates?.updatedRows || 0 };
  }

  /**
   * Overwrites or populates an entire worksheet with headers and rows.
   */
  async overwriteSheet(sheetName, headers = [], rows = []) {
    if (!this.spreadsheetId) throw new Error('Spreadsheet ID is not configured.');
    const sheets = await getGoogleSheetsClient();

    // 1. Ensure worksheet exists; if not, create it
    await this.ensureSheetExists(sheetName);

    // 2. Clear existing sheet values
    await withRetry(async () =>
      sheets.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1:ZZ`,
      })
    );

    // 3. Write headers and rows
    const allValues = [headers];
    rows.forEach((row) => {
      allValues.push(headers.map((h) => row[h] ?? ''));
    });

    const response = await withRetry(async () =>
      sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: allValues,
        },
      })
    );

    return { updatedRows: response.data.updatedRows || 0 };
  }

  /**
   * Updates a single cell or a small range.
   */
  async updateRange(range, values) {
    if (!this.spreadsheetId) throw new Error('Spreadsheet ID is not configured.');
    const sheets = await getGoogleSheetsClient();

    const response = await withRetry(async () =>
      sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      })
    );

    return response.data;
  }

  /**
   * Ensures a sheet with the given title exists in the spreadsheet.
   */
  async ensureSheetExists(sheetTitle) {
    if (!this.spreadsheetId) throw new Error('Spreadsheet ID is not configured.');
    const sheets = await getGoogleSheetsClient();

    const metadata = await withRetry(async () =>
      sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        fields: 'sheets.properties.title',
      })
    );

    const titles = (metadata.data.sheets || []).map((s) => s.properties?.title);
    if (!titles.includes(sheetTitle)) {
      await withRetry(async () =>
        sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: { title: sheetTitle },
                },
              },
            ],
          },
        })
      );
    }
  }

  /**
   * Fetches worksheet data via public CSV export if spreadsheet is shared with link.
   */
  async fetchPublicSheetCsv(sheetTitle) {
    if (!this.spreadsheetId) throw new Error('Spreadsheet ID is not configured.');
    const encodedSheet = encodeURIComponent(sheetTitle);
    const url = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodedSheet}`;

    const response = await axios.get(url, {
      timeout: 10000,
      responseType: 'text',
      headers: {
        'Accept': 'text/csv,text/plain,*/*',
      },
    });

    if (!response.data || typeof response.data !== 'string' || response.data.trim().startsWith('<!DOCTYPE html>')) {
      throw new Error(`Worksheet "${sheetTitle}" is not publicly accessible.`);
    }

    return parseCsvText(response.data);
  }
}

export const defaultSheetsService = new GoogleSheetsService();
export default defaultSheetsService;
