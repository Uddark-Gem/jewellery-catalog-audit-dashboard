import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  buildUrlKeyAuditRows,
  buildWeightAuditRows,
  buildHsnAuditRows,
  buildJewelleryHsnAuditRows,
  buildTaxClassAuditRows,
  calculateTax,
  customRound,
  roundRange,
  calculatePriceRow,
  enrichReportRow,
  formatRattiWeight,
  trimDecimalText,
} from '../src/lib/auditGenerators.js';

describe('Audit Rules & Business Logic Engine', () => {
  it('trimDecimalText removes decimals and commas correctly', () => {
    assert.strictEqual(trimDecimalText('71031020.0'), '71031020');
    assert.strictEqual(trimDecimalText('1,250.00'), '1250');
    assert.strictEqual(trimDecimalText(''), '');
  });

  it('formatRattiWeight calculates and formats ratti weight to 2 decimals', () => {
    assert.strictEqual(formatRattiWeight(4.5 / 0.9), '5.00');
    assert.strictEqual(formatRattiWeight(3.14159), '3.14');
    assert.strictEqual(formatRattiWeight(NaN), '');
  });

  it('buildUrlKeyAuditRows generates expected slug and flags mismatches', () => {
    const reportRows = [
      {
        attribute_set_id: 'gemstones',
        gemstone2: 'Yellow Sapphire',
        sku: 'GP12345',
        url_key: 'old-slug-key',
        status: 'Enabled',
        qty: '1',
        is_in_stock: '1',
      },
      {
        attribute_set_id: 'gemstones',
        gemstone2: 'Yellow Sapphire',
        sku: 'GP99999',
        url_key: 'yellow-sapphire-pukhraj-gp99999',
        status: 'Enabled',
      },
    ];

    const gemstone2WiseIndex = new Map([
      ['yellow sapphire', { gemstone2: 'Yellow Sapphire', url_key: 'yellow-sapphire-pukhraj' }],
    ]);

    const result = buildUrlKeyAuditRows(reportRows, gemstone2WiseIndex);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].sku, 'GP12345');
    assert.strictEqual(result[0].new_url, 'yellow-sapphire-pukhraj-gp12345');
    assert.strictEqual(result[0].validation_status, 'Needs Review');
  });

  it('buildWeightAuditRows flags ratti weight discrepancies', () => {
    const reportRows = [
      {
        attribute_set_id: 'gemstones',
        sku: 'GEM-001',
        carat_weight: '4.5',
        weight_ratti: '4.20', // Should be 4.5 / 0.9 = 5.00
      },
      {
        attribute_set_id: 'gemstones',
        sku: 'GEM-002',
        carat_weight: '4.5',
        weight_ratti: '5.00', // Accurate, should NOT be flagged
      },
    ];

    const discrepancies = buildWeightAuditRows(reportRows);
    assert.strictEqual(discrepancies.length, 1);
    assert.strictEqual(discrepancies[0].sku, 'GEM-001');
    assert.strictEqual(discrepancies[0].new_weight_ratti, '5.00');
  });

  it('buildHsnAuditRows audits loose gemstone HSN codes against reference sheet', () => {
    const reportRows = [
      {
        attribute_set_id: 'gemstones',
        sku: 'RUBY-101',
        gemstone2: 'Ruby',
        hsn_code: '71031010', // mismatch
      },
    ];

    const gemstone2WiseIndex = new Map([
      ['ruby', { gemstone2: 'Ruby', hsn_code: '71031020' }],
    ]);

    const discrepancies = buildHsnAuditRows(reportRows, gemstone2WiseIndex);
    assert.strictEqual(discrepancies.length, 1);
    assert.strictEqual(discrepancies[0].old_hsn, '71031010');
    assert.strictEqual(discrepancies[0].new_hsn, '71031020');
  });

  it('buildJewelleryHsnAuditRows accurately identifies diamond designs and derives jewellery HSN', () => {
    const reportRows = [
      {
        attribute_set_id: 'rings',
        sku: 'R101-A22-SIL',
        gemstone: 'Blue Sapphire',
        metal_config: 'Sterling Silver 925',
        hsn_code: '71131120',
      },
    ];

    const databaseSheets = [
      {
        sheetTitle: 'hsn metal gemstone',
        rows: [
          {
            gemstone: 'Blue Sapphire',
            metal_one: 'silver',
            metal_two: 'diamond', // A22 is in DIAMOND_DESIGN_CODES
            hsn_code: '71131130',
          },
        ],
      },
    ];

    const result = buildJewelleryHsnAuditRows(reportRows, databaseSheets);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].design_code, 'A22');
    assert.strictEqual(result[0].has_diamond, 'Yes');
    assert.strictEqual(result[0].new_hsn, '71131130');
  });

  it('buildTaxClassAuditRows auto-assigns Jewellery Corals to carved gemstones', () => {
    const reportRows = [
      {
        attribute_set_id: 'gemstones',
        sku: 'CARV-001',
        cut: 'Carved',
        shape: 'Oval',
        tax_class_id: '0',
      },
    ];

    const databaseSheets = [
      {
        sheetTitle: 'gem_type',
        rows: [],
      },
    ];

    const result = buildTaxClassAuditRows(reportRows, databaseSheets);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].new_tax, 'Jewellery Corals');
    assert.strictEqual(result[0].note, 'Auto-assigned (Carved)');
  });

  it('calculateTax handles coral, pearls, and carvings properly', () => {
    assert.strictEqual(calculateTax('Carved', 'Emerald'), 0.03);
    assert.strictEqual(calculateTax('Oval', 'Red Coral'), 0.05);
    assert.strictEqual(calculateTax('Round', 'Pearl'), 0.03);
    assert.strictEqual(calculateTax('Oval', 'Ruby'), 0.0025);
  });

  it('customRound enforces GemPundit tier rounding algorithm', () => {
    assert.strictEqual(customRound(452), 450); // <= 1000: round to 10
    assert.strictEqual(customRound(2430), 2450); // <= 5000: round to 50
    assert.strictEqual(customRound(45220), 45200); // <= 100000: round to 100
    assert.strictEqual(customRound(250260), 250500); // <= 400000: round to 500
    assert.strictEqual(customRound(550400), 550000); // <= 699999: round to 1000
    assert.strictEqual(customRound(850000), 700000); // > 699999: capped at 700000
  });

  it('roundRange rounds in 500 step intervals', () => {
    assert.strictEqual(roundRange(4800), 5000);
    assert.strictEqual(roundRange('Call for Price'), 'Call for Price');
  });

  it('calculatePriceRow generates price, price range, and tags correctly', () => {
    const row = {
      sku: 'TEST-SKU-1',
      shape: 'Oval',
      gemstone: 'Blue Sapphire',
      carat_weight: '3.0',
      vendor: 'GP',
      comment_explation_original: 'Original notes',
    };

    const updated = calculatePriceRow(row, '10000');
    assert.strictEqual(typeof updated.price, 'number');
    assert.strictEqual(updated.offers, 'Express Dispatch');
    assert.strictEqual(updated.product_category_type, 'MP');
    assert.ok(updated.comment_explation.includes('Price update on'));
  });

  it('enrichReportRow extracts design code from SKU', () => {
    const enriched = enrichReportRow({
      attribute_set_id: 'rings',
      sku: 'R99-A22-GOLD',
    });
    assert.strictEqual(enriched.design_code, 'A22');
  });
});
