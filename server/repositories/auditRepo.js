import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/env.js';
import { googleSheetsRepo } from './googleSheetsRepo.js';
import { getGoogleIntegrationStatus } from '../config/google.js';

const AUDIT_ROWS_FILE = path.join(config.paths.data, 'audit-update-rows.json');

export class AuditRepository {
  async getAuditUpdateRows() {
    try {
      if (fs.existsSync(AUDIT_ROWS_FILE)) {
        const raw = await fs.promises.readFile(AUDIT_ROWS_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn(`[AuditRepository] Failed to read ${AUDIT_ROWS_FILE}: ${err.message}`);
    }
    return { updateRows: {}, updatedAt: null, source: 'local' };
  }

  async saveAuditUpdateRows(updateRows) {
    await fs.promises.mkdir(config.paths.data, { recursive: true });
    const payload = {
      source: 'local data/audit-update-rows.json',
      updatedAt: new Date().toISOString(),
      updateRows: updateRows || {},
    };
    await fs.promises.writeFile(AUDIT_ROWS_FILE, JSON.stringify(payload, null, 2));
    return payload;
  }

  /**
   * Pushes the active audit updates to a Google Sheet worksheet (e.g. 'Audit_Updates').
   */
  async exportUpdatesToGoogleSheet(panelId, rows) {
    const status = await getGoogleIntegrationStatus();
    if (!status.ready) {
      throw new Error(`Google Sheets integration is not connected: ${status.error || 'Check configuration'}`);
    }

    if (!rows || rows.length === 0) {
      throw new Error('No rows to export.');
    }

    const sheetTitle = `Audit_${panelId.toUpperCase()}`;
    const headers = Object.keys(rows[0]).filter((k) => k !== 'id');
    const result = await googleSheetsRepo.saveWorksheet(sheetTitle, headers, rows);

    return {
      success: true,
      sheetTitle,
      rowsExported: rows.length,
      result,
    };
  }
}

export const auditRepo = new AuditRepository();
export default auditRepo;
