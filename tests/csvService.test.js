import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sanitizeCsvValue, parseCsvText, formatCsv } from '../server/services/csvService.js';

describe('CSV Service & Formula Injection Protection', () => {
  it('escapes dangerous formula characters with single quote', () => {
    assert.strictEqual(sanitizeCsvValue('=SUM(A1:A10)'), "'=SUM(A1:A10)");
    assert.strictEqual(sanitizeCsvValue('+12345'), "'+12345");
    assert.strictEqual(sanitizeCsvValue('-100'), "'-100");
    assert.strictEqual(sanitizeCsvValue('@executable'), "'@executable");
    assert.strictEqual(sanitizeCsvValue('\tcommand'), "'\tcommand");
  });

  it('preserves benign values unchanged', () => {
    assert.strictEqual(sanitizeCsvValue('Yellow Sapphire 4.5 Ratti'), 'Yellow Sapphire 4.5 Ratti');
    assert.strictEqual(sanitizeCsvValue('GP-1002'), 'GP-1002');
    assert.strictEqual(sanitizeCsvValue(''), '');
    assert.strictEqual(sanitizeCsvValue(null), '');
  });

  it('parses valid CSV text into structured records', () => {
    const csvData = `sku,name,price\nSKU-1,Emerald Ring,5000\nSKU-2,Ruby Pendant,8000`;
    const { columns, rows } = parseCsvText(csvData);

    assert.deepStrictEqual(columns, ['sku', 'name', 'price']);
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].sku, 'SKU-1');
    assert.strictEqual(rows[1].price, '8000');
  });

  it('formats array of objects into CSV with sanitized formula injection values', () => {
    const rows = [
      { sku: 'TEST-1', formula: '=cmd|/C calc!A0', status: 'Enabled' },
      { sku: 'TEST-2', formula: 'Normal Text', status: 'Enabled' },
    ];
    const output = formatCsv(rows, ['sku', 'formula', 'status']);
    assert.ok(output.includes("'=cmd|/C calc!A0"));
    assert.ok(output.includes('Normal Text'));
  });
});
