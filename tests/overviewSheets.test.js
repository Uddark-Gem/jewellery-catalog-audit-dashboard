import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SHEETS_MAPPING } from '../server/config/sheetsMapping.js';
import { fetchDatasetFromGoogleSheet } from '../server/services/overviewSheetsService.js';

describe('Overview Sheets Mapping & Service', () => {
  it('maps all expected datasets to spreadsheets and sheet names', () => {
    assert.ok(SHEETS_MAPPING.report);
    assert.equal(SHEETS_MAPPING.report.sheetName, 'Export Data');
    assert.equal(SHEETS_MAPPING.report.spreadsheetId, '1gF5LTrq7u81-bk0F5C5LBjhYMqE5UtuQt43MIMj6LWI');

    assert.ok(SHEETS_MAPPING.q3_processed_images);
    assert.equal(SHEETS_MAPPING.q3_processed_images.sheetName, 'Image Database');

    assert.ok(SHEETS_MAPPING.videodata_new);
    assert.equal(SHEETS_MAPPING.videodata_new.sheetName, 'Video Database');

    assert.ok(SHEETS_MAPPING.templatetagproduct_gemstone);
    assert.equal(SHEETS_MAPPING.templatetagproduct_gemstone.sheetName, 'Gemstone Option Data');

    assert.ok(SHEETS_MAPPING.templatetagproduct_jewellery);
    assert.equal(SHEETS_MAPPING.templatetagproduct_jewellery.sheetName, 'Jewellery Option Data');

    assert.ok(SHEETS_MAPPING.custom_option_issues);
    assert.equal(SHEETS_MAPPING.custom_option_issues.sheetName, 'Custom Option Issues');
  });

  it('fetchDatasetFromGoogleSheet returns structured response for mapped sheet', async () => {
    const result = await fetchDatasetFromGoogleSheet('report', 5);
    assert.ok(result);
    assert.ok(result.source.includes('Google Sheet'));
    assert.ok(Array.isArray(result.columns));
    assert.ok(Array.isArray(result.rows));
  });

  it('fetchDatasetFromGoogleSheet returns null for unknown targetId', async () => {
    const result = await fetchDatasetFromGoogleSheet('nonexistent_dataset');
    assert.equal(result, null);
  });
});
