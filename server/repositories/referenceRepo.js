import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/env.js';
import { parseCsvText } from '../services/csvService.js';
import { getGoogleIntegrationStatus } from '../config/google.js';

import { defaultSheetsService } from '../services/googleSheetsService.js';

const CACHE_FILE = path.join(config.paths.data, 'audit-databases-cache.json');
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class ReferenceRepository {
  /**
   * Returns all reference databases (gemstone2_wise, hsn metal gemstone, gem_type, etc.)
   * Prefers Google Sheets if configured, with automatic fallback to local Database/*.csv files.
   */
  async getAllReferenceDatabases(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = await this.readCache();
      if (cached && cached.length > 0) return cached;
    }

    // Tier 1: Try Google Sheets API via Service Account if configured
    const googleStatus = await getGoogleIntegrationStatus();
    if (googleStatus.ready && googleStatus.sheets?.length > 0) {
      try {
        const sheetResults = await this.fetchFromGoogleSheets(googleStatus.sheets);
        if (sheetResults.length > 0) {
          await this.writeCache(sheetResults);
          return sheetResults;
        }
      } catch (err) {
        console.warn(`[ReferenceRepository] Could not fetch from Google Sheets API: ${err.message}. Trying public link fallback.`);
      }
    }

    // Tier 2: Try public Google Sheets fetch if spreadsheet ID configured
    if (config.google.spreadsheetId) {
      try {
        const publicResults = await this.fetchFromPublicGoogleSheets();
        if (publicResults.length > 0) {
          await this.writeCache(publicResults);
          return publicResults;
        }
      } catch (err) {
        console.warn(`[ReferenceRepository] Public Google Sheet fetch: ${err.message}. Falling back to local CSVs.`);
      }
    }

    // Tier 3: Fallback to local CSV files in Database/
    const localResults = await this.fetchFromLocalCsvs();
    if (localResults.length > 0) {
      await this.writeCache(localResults);
      return localResults;
    }

    return [];
  }

  async fetchFromPublicGoogleSheets() {
    if (!config.google.spreadsheetId) return [];
    const knownSheets = [
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
    ];

    const results = [];
    for (let index = 0; index < knownSheets.length; index++) {
      const title = knownSheets[index];
      try {
        const { columns, rows } = await defaultSheetsService.fetchPublicSheetCsv(title);
        if (columns.length > 0) {
          results.push({
            source: `Google Sheets: ${title}`,
            spreadsheetId: config.google.spreadsheetId,
            sheetId: title,
            sheetTitle: title,
            index,
            rowCount: rows.length,
            columns,
            rows,
          });
        }
      } catch {
        // Individual worksheet not found or sheet not public
      }
    }
    return results;
  }

  async fetchFromGoogleSheets(availableSheets) {
    const targetSheets = availableSheets.filter(
      (title) => title !== config.google.sheetName && title !== 'Audit_Updates'
    );
    if (targetSheets.length === 0) return [];

    const ranges = targetSheets.map((title) => `'${title}'!A1:ZZ`);
    const batchData = await defaultSheetsService.batchReadSheets(ranges);

    const results = [];
    targetSheets.forEach((title, index) => {
      const cleanTitle = title.replace(/^'|'$/g, '').trim().toLowerCase();
      const matchedKey = Object.keys(batchData).find((k) => {
        const cleanK = k.split('!')[0].replace(/^'|'$/g, '').trim().toLowerCase();
        return cleanK === cleanTitle || k.toLowerCase().includes(cleanTitle);
      });
      const sheetData = matchedKey ? batchData[matchedKey] : { headers: [], rows: [] };

      results.push({
        source: `Google Sheets: ${title}`,
        spreadsheetId: config.google.spreadsheetId,
        sheetId: title,
        sheetTitle: title,
        index,
        rowCount: sheetData.rows.length,
        columns: sheetData.headers,
        rows: sheetData.rows,
      });
    });

    return results;
  }

  async fetchFromLocalCsvs() {
    const databaseDir = config.paths.database;
    if (!fs.existsSync(databaseDir)) return [];

    const files = (await fs.promises.readdir(databaseDir)).filter((file) => file.endsWith('.csv'));
    const results = [];

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const filePath = path.join(databaseDir, file);
      const csvText = await fs.promises.readFile(filePath, 'utf8');
      const { columns, rows } = parseCsvText(csvText);

      results.push({
        source: `Local CSV: ${file}`,
        spreadsheetId: 'local',
        sheetId: file,
        sheetTitle: file.replace('.csv', ''),
        index,
        rowCount: rows.length,
        columns,
        rows,
      });
    }

    return results;
  }

  async readCache() {
    try {
      const stat = await fs.promises.stat(CACHE_FILE);
      if (Date.now() - stat.mtimeMs < CACHE_TTL_MS) {
        const raw = await fs.promises.readFile(CACHE_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch {}
    return null;
  }

  async writeCache(data) {
    try {
      await fs.promises.mkdir(config.paths.data, { recursive: true });
      await fs.promises.writeFile(CACHE_FILE, JSON.stringify(data));
    } catch (err) {
      console.warn(`[ReferenceRepository] Failed to write cache: ${err.message}`);
    }
  }
}

export const referenceRepo = new ReferenceRepository();
export default referenceRepo;
