import { Router } from 'express';
import https from 'node:https';
import http from 'node:http';
import { referenceRepo } from '../repositories/referenceRepo.js';
import { auditRepo } from '../repositories/auditRepo.js';

const router = Router();

/**
 * GET /api/audit/databases.json
 * Returns all ground-truth reference sheets.
 */
router.get('/databases.json', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const databases = await referenceRepo.getAllReferenceDatabases(forceRefresh);
    res.json({
      source: databases[0]?.source || 'Reference Datastores',
      spreadsheetId: databases[0]?.spreadsheetId || 'local',
      databaseCount: databases.length,
      rowCount: databases.reduce((total, database) => total + database.rowCount, 0),
      databases,
    });
  } catch (err) {
    res.status(500).json({ error: `Could not load reference databases: ${err.message}` });
  }
});

/**
 * GET /api/audit/database.json
 */
router.get('/database.json', async (req, res) => {
  try {
    const databases = await referenceRepo.getAllReferenceDatabases();
    const firstDb = databases[0] || { rows: [], source: 'No database found', columns: [] };
    res.json({ source: firstDb.source, rowCount: firstDb.rows.length, columns: firstDb.columns, rows: firstDb.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/audit/update-rows.json
 */
router.get('/update-rows.json', async (_req, res) => {
  try {
    const data = await auditRepo.getAuditUpdateRows();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/audit/update-rows.json
 */
router.post('/update-rows.json', async (req, res) => {
  try {
    const payload = await auditRepo.saveAuditUpdateRows(req.body.updateRows || {});
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: `Could not persist audit rows: ${err.message}` });
  }
});

/**
 * POST /api/audit/check-url
 * Validates a video/image asset URL using an HTTP HEAD request.
 */
router.post('/check-url', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url in body' });

  const isHttps = url.startsWith('https:');
  const client = isHttps ? https : http;
  const options = {
    method: 'HEAD',
    timeout: 5000,
  };

  const checkReq = client.request(url, options, (checkRes) => {
    res.json({ url, status: checkRes.statusCode });
  });

  checkReq.on('error', (err) => {
    res.json({ url, status: 0, error: err.message });
  });

  checkReq.on('timeout', () => {
    checkReq.destroy();
    res.json({ url, status: 408, error: 'Timeout' });
  });

  checkReq.end();
});

export default router;
