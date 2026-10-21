import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { getGoogleIntegrationStatus } from './config/google.js';
import googleSheetsRoutes from './routes/googleSheetsRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import dataRoutes from './routes/dataRoutes.js';
import syncRoutes from './routes/syncRoutes.js';

const app = express();

// Security & Parsing Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.env,
  });
});

// Mount Routes
app.use('/api/sheets', googleSheetsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/data', dataRoutes);
app.use('/api', syncRoutes);

// Serve static client build if dist exists (Production Single-Port Mode)
const distPath = path.resolve(config.paths.root, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Global Error Handler
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// Start Server when not running in test runner
let server = null;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(config.port, async () => {
  console.log(`========================================================`);
  console.log(` Jewellery Catalog Audit Dashboard Server`);
  console.log(` Running on: http://localhost:${config.port}`);
  console.log(` Environment: ${config.env}`);
  console.log(`========================================================`);

  // Check Google Service Account status on boot
  try {
    const googleStatus = await getGoogleIntegrationStatus();
    if (googleStatus.ready) {
      console.log(` [Google Sheets] Connected: "${googleStatus.spreadsheetTitle}"`);
      console.log(` [Google Sheets] Service Account: ${googleStatus.clientEmail}`);
      console.log(` [Google Sheets] Available Sheets: ${googleStatus.sheets?.join(', ')}`);
    } else {
      console.log(` [Google Sheets] Offline / Standby: ${googleStatus.error || 'Awaiting configuration'}`);
      console.log(` [Google Sheets] Using local Database/*.csv fallback mode.`);
    }
  } catch (err) {
    console.log(` [Google Sheets] Initialization notice: ${err.message}`);
  }
  });
}

export default app;
export { server };
