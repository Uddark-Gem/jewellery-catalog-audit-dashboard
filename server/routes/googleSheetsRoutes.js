import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { getGoogleIntegrationStatus, setRuntimeCredentials, setRuntimeSpreadsheetId } from '../config/google.js';
import { defaultSheetsService } from '../services/googleSheetsService.js';
import { referenceRepo } from '../repositories/referenceRepo.js';
import { auditRepo } from '../repositories/auditRepo.js';
import { productRepo } from '../repositories/productRepo.js';
import { config } from '../config/env.js';

const router = Router();

/**
 * POST /api/sheets/configure
 * Updates spreadsheet ID or service account credentials dynamically.
 */
router.post('/configure', async (req, res) => {
  try {
    const { spreadsheetId, serviceAccountJson } = req.body;
    if (spreadsheetId) {
      setRuntimeSpreadsheetId(spreadsheetId.trim());
      defaultSheetsService.spreadsheetId = spreadsheetId.trim();
    }

    if (serviceAccountJson) {
      let parsedCreds = typeof serviceAccountJson === 'string'
        ? JSON.parse(serviceAccountJson.trim())
        : serviceAccountJson;
      setRuntimeCredentials(parsedCreds);

      try {
        const secretsDir = path.resolve(config.paths.root, 'secrets');
        if (!fs.existsSync(secretsDir)) fs.mkdirSync(secretsDir, { recursive: true });
        fs.writeFileSync(path.join(secretsDir, 'google-service-account.json'), JSON.stringify(parsedCreds, null, 2));
      } catch (e) {
        console.warn('Could not write to secrets file:', e.message);
      }
    }

    // Force refresh cache
    await referenceRepo.getAllReferenceDatabases(true);

    const status = await getGoogleIntegrationStatus();
    res.json({ success: true, status });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/sheets/status
 * Returns connection diagnostic status, detected credentials, and worksheet names.
 */
router.get('/status', async (_req, res) => {
  try {
    const status = await getGoogleIntegrationStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ configured: false, ready: false, error: err.message });
  }
});

/**
 * POST /api/sheets/test
 * Performs a live test against the configured Google Spreadsheet.
 */
router.post('/test', async (_req, res) => {
  try {
    const startTime = Date.now();
    const status = await getGoogleIntegrationStatus();
    if (!status.ready) {
      return res.status(400).json({ success: false, error: status.error });
    }

    // Attempt a light read from the first available sheet or A1:B2
    const firstSheet = status.sheets?.[0] || 'Sheet1';
    const sample = await defaultSheetsService.readSheet(`${firstSheet}!A1:B2`);
    const latencyMs = Date.now() - startTime;

    res.json({
      success: true,
      latencyMs,
      spreadsheetTitle: status.spreadsheetTitle,
      clientEmail: status.clientEmail,
      sampleRange: `${firstSheet}!A1:B2`,
      sampleHeaders: sample.headers,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/sheets/export-panel
 * Exports rows from an audit panel into a Google Spreadsheet worksheet.
 */
router.post('/export-panel', async (req, res) => {
  try {
    const { panelId, rows } = req.body;
    if (!panelId || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'Missing panelId or rows array' });
    }

    const result = await auditRepo.exportUpdatesToGoogleSheet(panelId, rows);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/sheets/sync-products
 * Synchronizes SQLite product records to the configured Google Sheet.
 */
router.post('/sync-products', async (_req, res) => {
  try {
    const result = await productRepo.syncToGoogleSheet();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
