import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getGoogleIntegrationStatus } from '../server/config/google.js';
import { GoogleSheetsService } from '../server/services/googleSheetsService.js';

describe('Google Service Account & Sheets API Integration', () => {
  it('getGoogleIntegrationStatus returns safe diagnostic object when credentials unmounted', async () => {
    const status = await getGoogleIntegrationStatus();
    assert.strictEqual(typeof status, 'object');
    assert.strictEqual(typeof status.ready, 'boolean');
    // In local dev without the user's specific JSON file mounted, ready should be false with an informative error
    if (!status.ready) {
      assert.ok(typeof status.error === 'string');
      assert.ok(status.error.length > 0);
    }
  });

  it('GoogleSheetsService constructor accepts configurable spreadsheet ID', () => {
    const customService = new GoogleSheetsService('custom-test-spreadsheet-id');
    assert.strictEqual(customService.spreadsheetId, 'custom-test-spreadsheet-id');
  });

  it('GoogleSheetsService throws clean descriptive error if spreadsheetId is empty', async () => {
    const emptyService = new GoogleSheetsService('');
    await assert.rejects(
      async () => {
        await emptyService.readSheet('A1:B2');
      },
      {
        message: /Spreadsheet ID is not configured/,
      }
    );
  });
});
