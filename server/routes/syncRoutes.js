import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import https from 'node:https';
import http from 'node:http';
import crypto from 'node:crypto';
import csv from 'csv-parser';
import { config } from '../config/env.js';
import { getDb } from '../db.js';
import { parseCsvText } from '../services/csvService.js';

const router = Router();

const STAGING_URLS = {
  report: 'https://staging.gempundit.com/var/export/report.csv',
  q3_processed_images: 'https://staging.gempundit.com/var/export/q3.csv',
  videodata_new: 'https://staging.gempundit.com/var/export/videodata.csv',
  templatetagproduct_gemstone: 'https://staging.gempundit.com/var/export/templatetagproduct_gemstone.csv',
  templatetagproduct_jewellery: 'https://staging.gempundit.com/var/export/templatetagproduct_jewellery.csv',
  templatetagproduct: 'https://staging.gempundit.com/var/export/templatetagproduct.csv',
  custom_option_issues: 'https://staging.gempundit.com/var/export/custom_option_issues.csv',
};

const REMOVED_REPORT_COLUMNS = new Set([
  'sku_for_vendor_product', 'vendor_id', 'special_price', 'weight_carat', 'weight_sort1',
  'gem_composition', 'return_policy', 'offer_type', 'description', 'short_description',
  'description2', 'small_image', 'thumbnail', 'invoice_id', 'news_to_date',
  'promotion_discount_price', 'additional_certification', 'verified_certificateimage',
  'verified_certificateimage1', 'length_cm', 'how_to_wear', 'arrangement_type',
  'strands', 'length_inches', 'beads_in_strand', 'beads_size', 'hole', 'call_for_price_text'
]);

function shapeReportPayload(columns, rows) {
  const keptColumns = columns.filter((col) => col && !REMOVED_REPORT_COLUMNS.has(col));
  const keptRows = rows
    .filter((row) => !String(row.status ?? '').trim().toLowerCase().includes('disabled'))
    .map((row) => Object.fromEntries(keptColumns.map((col) => [col, row[col] ?? ''])));
  return { columns: keptColumns, rows: keptRows };
}

/**
 * POST /api/sync
 * Direct staging sync to SQLite with backup archiving.
 */
router.post('/sync', async (_req, res) => {
  try {
    const { username, password, reportUrl } = config.staging;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing GEMPUNDIT_REPORT_USERNAME or GEMPUNDIT_REPORT_PASSWORD in environment',
      });
    }

    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
    const db = await getDb();

    await fs.promises.mkdir(config.paths.backups, { recursive: true });
    await fs.promises.mkdir(config.paths.data, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(config.paths.backups, `report-${timestamp}.csv`);
    const reportPath = path.join(config.paths.data, 'report.csv');

    const response = await axios({
      method: 'GET',
      url: reportUrl,
      responseType: 'stream',
      headers: { Authorization: authHeader },
    });

    const writer = fs.createWriteStream(backupPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    try {
      await fs.promises.copyFile(backupPath, reportPath);
    } catch (e) {
      console.warn('Could not copy to data/report.csv:', e.message);
    }

    await db.exec('DELETE FROM reports');

    const insertStmt = await db.prepare(`
      INSERT INTO reports (
        id, attribute_set_id, sku, name, meta_title, url_key, treatment, carat_weight,
        classification, cutting_style, dimensions, j_colour, name2, offers, weight_ratti,
        shipping_days, hsn_code, price, price_per_carat, status, tax_class_id, gemstone,
        shape, certification, colour, cut, dimension_type, dispatch_days, gemstone2, vendor,
        origin, product_type, comment_explation, qty, is_in_stock, gemstone3, image,
        news_from_date, stickers, callfor, quality_config_gem, redirect_select_for_quality,
        select_for_quality, mainproduct_forjewlrypage, gemstone2_type, price_per_carat_range,
        metal_config, ideal_design, price_for_jewelry, promotion_baseprice_jewlery,
        product_discount_percentage, specific_gravity, refractive_index, show_pricing_table,
        callfor_price_wanto_show, automatic_video_link, calibrated_size_range, quality_grade,
        dimension_approx, certificate_number1, price_range, gemstone_benifits_new, product_category_type
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    let rowCount = 0;
    const BATCH_SIZE = 1000;
    let batch = [];

    const flushBatch = async () => {
      if (batch.length === 0) return;
      await db.exec('BEGIN TRANSACTION');
      for (const row of batch) {
        await insertStmt.run(
          crypto.randomUUID(), row.attribute_set_id ?? '', row.sku ?? '', row.name ?? '', row.meta_title ?? '',
          row.url_key ?? '', row.treatment ?? '', row.carat_weight ?? '', row.classification ?? '',
          row.cutting_style ?? '', row.dimensions ?? '', row.j_colour ?? '', row.name2 ?? '',
          row.offers ?? '', row.weight_ratti ?? '', row.shipping_days ?? '', row.hsn_code ?? '',
          row.price ?? '', row.price_per_carat ?? '', row.status ?? '', row.tax_class_id ?? '',
          row.gemstone ?? '', row.shape ?? '', row.certification ?? '', row.colour ?? '',
          row.cut ?? '', row.dimension_type ?? '', row.dispatch_days ?? '', row.gemstone2 ?? '',
          row.vendor ?? '', row.origin ?? '', row.product_type ?? '', row.comment_explation ?? '',
          row.qty ?? '', row.is_in_stock ?? '', row.gemstone3 ?? '', row.image ?? '',
          row.news_from_date ?? '', row.stickers ?? '', row.callfor ?? '', row.quality_config_gem ?? '',
          row.redirect_select_for_quality ?? '', row.select_for_quality ?? '', row.mainproduct_forjewlrypage ?? '',
          row.gemstone2_type ?? '', row.price_per_carat_range ?? '', row.metal_config ?? '',
          row.ideal_design ?? '', row.price_for_jewelry ?? '', row.promotion_baseprice_jewlery ?? '',
          row.product_discount_percentage ?? '', row.specific_gravity ?? '', row.refractive_index ?? '',
          row.show_pricing_table ?? '', row.callfor_price_wanto_show ?? '', row.automatic_video_link ?? '',
          row.calibrated_size_range ?? '', row.quality_grade ?? '', row.dimension_approx ?? '',
          row.certificate_number1 ?? '', row.price_range ?? '', row.gemstone_benifits_new ?? '',
          row.product_category_type ?? ''
        );
      }
      await db.exec('COMMIT');
      batch = [];
    };

    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(backupPath).pipe(csv());
      stream.on('data', async (row) => {
        rowCount++;
        batch.push(row);
        if (batch.length >= BATCH_SIZE) {
          stream.pause();
          await flushBatch();
          stream.resume();
        }
      });
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    await flushBatch();
    await insertStmt.finalize();

    res.json({ success: true, message: `Synced ${rowCount} rows successfully`, file: backupPath });
  } catch (error) {
    console.error('[Sync] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/sync-staging
 * Server-Sent Events (SSE) streaming download progress from staging.
 */
router.get('/sync-staging', async (req, res) => {
  const targetDb = req.query.db || 'report';
  const url = STAGING_URLS[targetDb] || STAGING_URLS.report;
  const { username, password } = config.staging;

  if (!username || !password) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Missing staging username or password in .env.local' })}\n\n`);
    res.end();
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
    const localFile = path.join(config.paths.data, `${targetDb}.csv`);
    const tempFile = path.join(config.paths.data, `${targetDb}.tmp`);

    await fs.promises.mkdir(config.paths.data, { recursive: true });

    const client = url.startsWith('https:') ? https : http;
    const proxyRequest = client.request(url, {
      method: 'GET',
      headers: { Authorization: authHeader },
    }, (proxyRes) => {
      if (proxyRes.statusCode !== 200) {
        sendEvent({ type: 'error', message: `Staging returned HTTP ${proxyRes.statusCode}` });
        res.end();
        return;
      }

      const total = Number.parseInt(proxyRes.headers['content-length'] || '0', 10);
      let loaded = 0;
      let lastReportedPercent = -1;

      const writeStream = fs.createWriteStream(tempFile);
      proxyRes.pipe(writeStream);

      proxyRes.on('data', (chunk) => {
        loaded += chunk.length;
        if (total > 0) {
          const percent = Math.floor((loaded / total) * 100);
          if (percent !== lastReportedPercent && percent % 5 === 0) {
            lastReportedPercent = percent;
            sendEvent({ type: 'progress', percent, loaded, total });
          }
        }
      });

      writeStream.on('finish', async () => {
        try {
          sendEvent({ type: 'processing', percent: 100, loaded, total, message: 'Download complete. Parsing and saving cache...' });
          if (fs.existsSync(localFile)) {
            try { fs.unlinkSync(localFile); } catch {}
          }
          fs.renameSync(tempFile, localFile);

          const csvText = await fs.promises.readFile(localFile, 'utf8');
          const parsed = parseCsvText(csvText);
          const shaped = shapeReportPayload(parsed.columns, parsed.rows);

          const cacheFile = path.join(config.paths.data, `${targetDb}-cache.json`);
          await fs.promises.writeFile(cacheFile, JSON.stringify({
            source: `Staging Export: ${targetDb}.csv`,
            rowCount: shaped.rows.length,
            ...shaped,
          }));

          sendEvent({ type: 'complete', rowCount: shaped.rows.length, columns: shaped.columns });
        } catch (err) {
          sendEvent({ type: 'error', message: err.message });
        } finally {
          res.end();
        }
      });

      writeStream.on('error', (err) => {
        sendEvent({ type: 'error', message: `Disk write error: ${err.message}` });
        res.end();
      });
    });

    proxyRequest.on('error', (err) => {
      sendEvent({ type: 'error', message: `Network error: ${err.message}` });
      res.end();
    });

    req.on('close', () => {
      proxyRequest.destroy();
    });
  } catch (err) {
    sendEvent({ type: 'error', message: err.message });
    res.end();
  }
});

/**
 * GET /api/export/report.csv
 */
router.get('/export/report.csv', (_req, res) => {
  const reportPath = path.join(config.paths.data, 'report.csv');
  if (!fs.existsSync(reportPath)) {
    return res.status(404).send('No local data/report.csv found yet. Click Refresh Staging once to create it.');
  }

  res.writeHead(200, {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': 'attachment; filename="report.csv"',
  });
  fs.createReadStream(reportPath).pipe(res);
});

/**
 * GET /api/report/local-:target.json
 */
router.get('/report/local-:target.json', async (req, res) => {
  const target = req.params.target;
  const cacheFile = path.join(config.paths.data, `${target}-cache.json`);
  const csvFile = path.join(config.paths.data, `${target}.csv`);

  try {
    if (fs.existsSync(cacheFile)) {
      const raw = await fs.promises.readFile(cacheFile, 'utf8');
      return res.json(JSON.parse(raw));
    }

    if (fs.existsSync(csvFile)) {
      const csvText = await fs.promises.readFile(csvFile, 'utf8');
      const parsed = parseCsvText(csvText);
      const shaped = shapeReportPayload(parsed.columns, parsed.rows);
      await fs.promises.writeFile(cacheFile, JSON.stringify({
        source: `Local CSV: ${target}.csv`,
        rowCount: shaped.rows.length,
        ...shaped,
      }));
      return res.json({ source: `Local CSV: ${target}.csv`, ...shaped });
    }

    res.status(404).json({ error: `No local data/${target}.csv found.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
