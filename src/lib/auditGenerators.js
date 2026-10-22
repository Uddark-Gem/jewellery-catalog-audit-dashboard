
import { createRowId, isRowInStock } from './csv.js';
import { makeReportColumns } from './tableConfig.js';

export const formatCount = (value) => new Intl.NumberFormat('en-US').format(value);
export const makeDatabasePanelId = (sheetId) => `database:${sheetId}`;
export const getDatabaseSheetId = (id) => (id.startsWith('database:') ? id.slice('database:'.length) : null);
export const makeDatabaseColumns = (columns = []) => makeReportColumns(columns).map((column) => ({ ...column, label: column.key }));
export const findDatabaseSheet = (databaseSheets = [], name = '') => {
  if (!Array.isArray(databaseSheets) || !name) return null;
  const target = normalizeLookupValue(name).replace(/[^a-z0-9]/g, '');
  return databaseSheets.find((s) => {
    const title = normalizeLookupValue(s.sheetTitle || s.sheetId).replace(/[^a-z0-9]/g, '');
    return title === target || title.includes(target) || target.includes(title);
  });
};
export const normalizeLookupValue = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
export const normalizeUrlKey = (value) => String(value ?? '').trim().toLowerCase().replace(/^\/+|\/+$/g, '');
export const makeSkuUrlPart = (sku) => String(sku ?? '').trim().toLowerCase();
export const parseAuditNumber = (value) => Number.parseFloat(String(value ?? '').trim().replaceAll(',', ''));
export const formatRattiWeight = (value) => {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(2);
};
export const normalizeHsnCode = (value) => trimDecimalText(value);
export const trimDecimalText = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const numeric = Number.parseFloat(text.replaceAll(',', ''));
  if (!Number.isFinite(numeric)) return text;
  return String(Math.trunc(numeric));
};
export const normalizeReportNumberFields = (row) => ({
  ...row,
  qty: trimDecimalText(row.qty),
  price: trimDecimalText(row.price),
});

export const buildGemstone2WiseIndex = (databaseSheets) => {
  const gemstone2Wise = findDatabaseSheet(databaseSheets, 'gemstone2_wise');
  const rows = gemstone2Wise?.rows ?? [];
  const index = new Map();

  rows.forEach((row) => {
    const gemstone2 = normalizeLookupValue(row.gemstone2);
    if (gemstone2 && !index.has(gemstone2)) index.set(gemstone2, row);
  });

  return index;
};

export const buildUrlKeyAuditRows = (reportRows, gemstone2WiseIndex) =>
  reportRows.reduce((rows, reportRow) => {
    if (normalizeLookupValue(reportRow.attribute_set_id) !== 'gemstones') return rows;

    const reference = gemstone2WiseIndex.get(normalizeLookupValue(reportRow.gemstone2));
    const skuPart = makeSkuUrlPart(reportRow.sku);
    const baseUrlKey = normalizeUrlKey(reference?.url_key);

    if (!reference || !skuPart || !baseUrlKey) return rows;

    const currentUrlKey = normalizeUrlKey(reportRow.url_key);
    const expectedUrlKey = `${baseUrlKey}-${skuPart}`;
    if (currentUrlKey === expectedUrlKey) return rows;

    let validationStatus = 'Valid';
    const escapedSku = skuPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const oldBase = currentUrlKey.replace(new RegExp(`-${escapedSku}$`), '');
    
    // If the old URL had a different gemstone base, flag for review
    if (oldBase && oldBase !== skuPart && oldBase !== baseUrlKey) {
        validationStatus = 'Needs Review';
    }

    rows.push({
      id: createRowId(),
      sku: reportRow.sku || reportRow.name || '',
      gemstone2: reportRow.gemstone2 ?? '',
      status: reportRow.status ?? '',
      qty: reportRow.qty ?? '',
      is_in_stock: reportRow.is_in_stock ?? '',
      old_url: reportRow.url_key ?? '',
      new_url: expectedUrlKey,
      validation_status: validationStatus,
    });

    return rows;
  }, []);

export const buildWeightAuditRows = (reportRows) =>
  reportRows.reduce((rows, reportRow) => {
    if (normalizeLookupValue(reportRow.attribute_set_id) !== 'gemstones') return rows;

    const caratWeight = parseAuditNumber(reportRow.carat_weight);
    if (!Number.isFinite(caratWeight)) return rows;

    const expectedWeight = caratWeight / 0.9;
    const expectedWeightText = formatRattiWeight(expectedWeight);
    const currentWeight = parseAuditNumber(reportRow.weight_ratti);
    if (Number.isFinite(currentWeight) && formatRattiWeight(currentWeight) === expectedWeightText) return rows;

    rows.push({
      id: createRowId(),
      sku: reportRow.sku || reportRow.name || '',
      carat_weight: reportRow.carat_weight ?? '',
      old_weight_ratti: reportRow.weight_ratti ?? '',
      new_weight_ratti: expectedWeightText,
    });

    return rows;
  }, []);
export const buildHsnAuditRows = (reportRows, gemstone2WiseIndex) =>
  reportRows.reduce((rows, reportRow) => {
    if (normalizeLookupValue(reportRow.attribute_set_id) !== 'gemstones') return rows;

    const reference = gemstone2WiseIndex.get(normalizeLookupValue(reportRow.gemstone2));
    const expectedHsn = normalizeHsnCode(reference?.hsn_code ?? reference?.hsn ?? '');
    const currentHsn = normalizeHsnCode(reportRow.hsn_code);

    if (!reference || !expectedHsn || currentHsn === expectedHsn) return rows;

    rows.push({
      id: createRowId(),
      sku: reportRow.sku || reportRow.name || '',
      gemstone2: reportRow.gemstone2 ?? '',
      qty: reportRow.qty ?? '',
      is_in_stock: reportRow.is_in_stock ?? '',
      old_hsn: reportRow.hsn_code ?? '',
      new_hsn: expectedHsn,
    });

    return rows;
  }, []);

export const DIAMOND_DESIGN_CODES = new Set([
  'R1-SPARKLE', 'R1-DAZZLE', 'A2-SPARKLE', 'A2-DAZZLE', 'A22', 'A24', 'A25', 'A26', 'A28', 'A34', 'A36', 'A42', 'A43', 'A44', 'A46', 'A48', 'A52', 'A53', 'A54', 'A56', 'A58',
  'D4-SPARKLE', 'D14', 'D15', 'D17', 'D18', 'D19', 'D21', 'D23', 'D24', 'D26', 'D27', 'D28',
  'AC9', 'AC10', 'AC12', 'AC15', 'AC19', 'AC10-TRI', 'AC12-TRI', 'AC17-TRI', 'AC9-CAP', 'AC10-CAP', 'AC15-CAP', 'AC17-CAP',
  'DC4', 'DC8-CAP', 'DC11-CAP', 'DC8-TRI', 'DC11-TRI', 'DC8', 'DC12', 'DC14', 'DC16', 'DC17', 'DC19', 'DC20',
  'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'E14', 'E15', 'E16', 'E17', 'E18', 'E19', 'E20', 'E21', 'E22', 'E23', 'E24', 'E25', 'E26', 'E27', 'E28', 'E29', 'E30', 'E31', 'E32', 'E33', 'E35', 'E36', 'E37',
  'AO23', 'AO25', 'AO28', 'AP8', 'AP10', 'AP11', 'AP12', 'AP13',
  'DP4', 'DP5', 'DP9', 'DP10', 'DP11', 'DP13', 'DP14', 'DP15', 'DP16',
  'PE1', 'PE2', 'PE3', 'PE5', 'PE6', 'PE8', 'PE9', 'PE11',
  'N8', 'NP1', 'NP3', 'NP4', 'NP7', 'NE2', 'NE5', 'NE6', 'NE7', 'NE8', 'NE9', 'NE11', 'NE13',
  'BR1', 'BR2', 'BR3', 'BR4', 'BR5', 'BR6', 'BR7', 'BR8', 'BR9', 'BR10', 'BR11', 'BR12', 'BR13', 'BR14', 'BR15', 'BR16', 'BR17', 'BR18', 'BR19', 'BR20', 'BR21', 'BR22', 'BR23', 'BR24', 'BR25',
  'NK1', 'NK3', 'NK7', 'NK8',
  'ER10', 'ER1', 'ER11', 'ER12', 'ER13', 'ER15', 'ER17', 'ER18', 'ER19', 'ER20', 'ER2', 'ER21', 'ER22', 'ER23', 'ER24', 'ER25', 'ER26', 'ER27', 'ER28', 'ER29', 'ER30', 'ER3', 'ER31', 'ER32', 'ER33', 'ER35', 'ER36', 'ER37', 'ER4', 'ER6', 'ER7', 'ER8', 'ER9'
]);

export const buildJewelleryHsnAuditRows = (reportRows, databaseSheets) => {
  const hsnMetalGemstoneSheet = findDatabaseSheet(databaseSheets, 'hsn metal gemstone');
  if (!hsnMetalGemstoneSheet) return [];
  const hsnRows = hsnMetalGemstoneSheet.rows;

  return reportRows.reduce((rows, reportRow) => {
    if (!DESIGN_CODE_SETS.includes(normalizeLookupValue(reportRow.attribute_set_id))) return rows;

    const metalConfig = String(reportRow.metal_config || '').trim();
    let mappedMetal = '';
    if (/Sterling Silver/i.test(metalConfig)) {
      mappedMetal = 'silver';
    } else if (/Gold/i.test(metalConfig)) {
      mappedMetal = 'gold';
    } else if (/Panchdhatu/i.test(metalConfig)) {
      mappedMetal = 'panchdhatu';
    } else if (/White Silver Plated Alloy/i.test(metalConfig)) {
      return rows; // ignore
    }

    if (!mappedMetal) return rows; // skip if we can't map the metal

    const lookupGemstone = normalizeLookupValue(reportRow.gemstone);
    
    const sku = reportRow.sku || '';
    const parts = sku.split('-');
    
    let designCode = '';
    if (parts.length >= 2) {
      let codeIndex = 1;
      if (parts[1].toUpperCase() === 'NAV' && parts.length > 2) {
        codeIndex = 2;
      }
      const baseCodeOrig = parts[codeIndex] || '';
      let extracted = baseCodeOrig.toUpperCase();
      
      const nextPart = parts[codeIndex + 1] ? parts[codeIndex + 1].toUpperCase() : '';
      if (nextPart === 'SPARK' || nextPart === 'SPARKLE') {
        extracted = `${extracted}-SPARKLE`;
      } else if (nextPart === 'DAZZ' || nextPart === 'DAZZLE') {
        extracted = `${extracted}-DAZZLE`;
      } else if (nextPart === 'CAP') {
        extracted = `${extracted}-CAP`;
      } else if (nextPart === 'TRI') {
        extracted = `${extracted}-TRI`;
      }
      designCode = extracted;
    }
    
    const isDiamond = DIAMOND_DESIGN_CODES.has(designCode);
    const lookupMetalTwo = isDiamond ? 'diamond' : '';

    let matchedRef = hsnRows.find(r => 
      normalizeLookupValue(r.gemstone) === lookupGemstone &&
      normalizeLookupValue(r.metal_one) === mappedMetal &&
      normalizeLookupValue(r.metal_two) === lookupMetalTwo
    );

    // Fallback: If diamond combination is not defined in reference sheet (e.g. Panchdhatu imitation alloy 71179090),
    // fallback to base metal entry without diamond
    if (!matchedRef && isDiamond) {
      matchedRef = hsnRows.find(r => 
        normalizeLookupValue(r.gemstone) === lookupGemstone &&
        normalizeLookupValue(r.metal_one) === mappedMetal &&
        normalizeLookupValue(r.metal_two) === ''
      );
    }

    if (!matchedRef || !matchedRef.hsn_code) return rows;

    const expectedHsn = normalizeHsnCode(matchedRef.hsn_code);
    if (!expectedHsn) return rows;

    const currentHsn = normalizeHsnCode(reportRow.hsn_code);

    if (currentHsn === expectedHsn) return rows;

    rows.push({
      id: createRowId(),
      sku: reportRow.sku || reportRow.name || '',
      gemstone: reportRow.gemstone || '',
      metal_config: reportRow.metal_config || '',
      design_code: designCode,
      has_diamond: isDiamond ? 'Yes' : 'No',
      qty: reportRow.qty ?? '',
      is_in_stock: reportRow.is_in_stock ?? '',
      old_hsn: reportRow.hsn_code ?? '',
      new_hsn: expectedHsn,
    });

    return rows;
  }, []);
};

export const buildTaxClassAuditRows = (reportRows, databaseSheets) => {
  const gemTypeSheet = findDatabaseSheet(databaseSheets, 'gem_type');
  if (!gemTypeSheet) return [];
  const gemTypeRows = gemTypeSheet.rows;

  return reportRows.reduce((rows, reportRow) => {
    if (normalizeLookupValue(reportRow.attribute_set_id) !== 'gemstones') return rows;
    
    let expectedTaxClass = '';
    const isCarved = normalizeLookupValue(reportRow.cut) === 'carved' || ['carving', 'carved'].includes(normalizeLookupValue(reportRow.shape));

    if (isCarved) {
      expectedTaxClass = 'Jewellery Corals';
    } else {
      const lookupGemstone2 = normalizeLookupValue(reportRow.gemstone2);
      const matchedRef = gemTypeRows.find(r => normalizeLookupValue(r.gemstone2) === lookupGemstone2);
      if (!matchedRef) return rows;
      expectedTaxClass = String(matchedRef.tax_class_id || '').trim();
    }

    if (!expectedTaxClass) return rows;

    const currentTaxClass = String(reportRow.tax_class_id || '').trim();
    if (currentTaxClass === expectedTaxClass) return rows;

    rows.push({
      id: createRowId(),
      sku: reportRow.sku || reportRow.name || '',
      gemstone2: reportRow.gemstone2 ?? '',
      status: reportRow.status ?? '',
      qty: reportRow.qty ?? '',
      is_in_stock: reportRow.is_in_stock ?? '',
      old_tax: reportRow.tax_class_id ?? '',
      new_tax: expectedTaxClass,
      note: isCarved ? 'Auto-assigned (Carved)' : '',
    });

    return rows;
  }, []);
};

export const buildClassificationAuditRows = (reportRows, databaseSheets) => {
  const gemTypeSheet = findDatabaseSheet(databaseSheets, 'gem_type');
  if (!gemTypeSheet) return [];
  const gemTypeRows = gemTypeSheet.rows;

  return reportRows.reduce((rows, reportRow) => {
    if (normalizeLookupValue(reportRow.attribute_set_id) !== 'gemstones') return rows;
    
    const lookupGemstone2 = normalizeLookupValue(reportRow.gemstone2);
    const matchedRef = gemTypeRows.find(r => normalizeLookupValue(r.gemstone2) === lookupGemstone2);
    if (!matchedRef) return rows;

    const expectedClassification = String(matchedRef.classification || '').trim();
    if (!expectedClassification) return rows;

    const currentClassification = String(reportRow.classification || '').trim();
    if (currentClassification === expectedClassification) return rows;

    rows.push({
      id: createRowId(),
      sku: reportRow.sku || reportRow.name || '',
      gemstone2: reportRow.gemstone2 ?? '',
      status: reportRow.status ?? '',
      qty: reportRow.qty ?? '',
      is_in_stock: reportRow.is_in_stock ?? '',
      old_classification: reportRow.classification ?? '',
      new_classification: expectedClassification,
    });

    return rows;
  }, []);
};

export const buildStickerAuditRows = (reportRows, databaseSheets) => {
  const stickerSheet = findDatabaseSheet(databaseSheets, 'sticker');
  if (!stickerSheet) return [];
  const stickerRows = stickerSheet.rows;

  return reportRows.reduce((rows, reportRow) => {
    if (normalizeLookupValue(reportRow.attribute_set_id) !== 'gemstones') return rows;
    
    let expectedStickersList = [];

    const lookupCertification = normalizeLookupValue(reportRow.certification);
    const mainRef = stickerRows.find(r => normalizeLookupValue(r.certification) === lookupCertification);
    if (mainRef) {
      let mainSticker = String(mainRef.stickers || mainRef.Stickers || '').trim();
      if (mainSticker && mainSticker !== '0') expectedStickersList.push(mainSticker);
    }

    const lookupAdditional = normalizeLookupValue(reportRow.additional_certification);
    if (lookupAdditional) {
      const addRef = stickerRows.find(r => normalizeLookupValue(r.certification) === lookupAdditional);
      if (addRef) {
        let addSticker = String(addRef.stickers || addRef.Stickers || '').trim();
        if (addSticker && addSticker !== '0') expectedStickersList.push(addSticker);
      }
    }

    if (expectedStickersList.length === 0) return rows;

    let currentStickerStr = String(reportRow.stickers || '').trim();
    if (currentStickerStr === '0') currentStickerStr = '';

    const currentList = currentStickerStr.split(',').map(s => s.trim()).filter(Boolean).sort();
    const expectedListSorted = [...expectedStickersList].sort();

    const isMatch = currentList.length === expectedListSorted.length &&
                    currentList.every((val, index) => val === expectedListSorted[index]);

    if (isMatch) return rows;

    const expectedStickerStr = expectedStickersList.join(', ');

    rows.push({
      id: createRowId(),
      sku: reportRow.sku || reportRow.name || '',
      gemstone2: reportRow.gemstone2 ?? '',
      status: reportRow.status ?? '',
      certification: [reportRow.certification, reportRow.additional_certification].filter(Boolean).join(', '),
      qty: reportRow.qty ?? '',
      is_in_stock: reportRow.is_in_stock ?? '',
      old_sticker: reportRow.stickers ?? '',
      new_sticker: expectedStickerStr,
    });

    return rows;
  }, []);
};

export const buildJColourAuditRows = (reportRows, databaseSheets) => {
  const jColourSheet = databaseSheets.find((s) => /j[_\s]?colou?r/i.test(s.sheetTitle));
  if (!jColourSheet) return [];
  const refRows = jColourSheet.rows;

  const normalizeColorKey = (val) =>
    String(val ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s*,\s*/g, ', ')
      .replace(/\s+/g, ' ');

  const colorMap = new Map();
  for (const r of refRows) {
    const certColor = normalizeColorKey(r['Color On certificate'] || r.colour || '');
    const standardJColour = String(r.j_colour || '').trim();
    if (certColor && standardJColour) {
      if (!colorMap.has(certColor)) colorMap.set(certColor, standardJColour);
    }
  }

  return reportRows.reduce((rows, reportRow) => {
    const sku = reportRow.sku || reportRow.name || '';
    if (!sku) return rows;

    const rawColor = String(reportRow.colour ?? '').trim();
    if (!rawColor) return rows;

    const currentColor = normalizeColorKey(rawColor);
    const expected = colorMap.get(currentColor);
    if (!expected) return rows;

    const currentJColour = String(reportRow.j_colour || '').trim();
    if (normalizeLookupValue(currentJColour) === normalizeLookupValue(expected)) return rows;

    rows.push({
      id: createRowId(),
      sku,
      gemstone2: reportRow.gemstone2 ?? '',
      status: reportRow.status ?? '',
      colour: rawColor,
      qty: reportRow.qty ?? '',
      is_in_stock: reportRow.is_in_stock ?? '',
      old_jcolour: currentJColour,
      new_jcolour: expected,
    });
    return rows;
  }, []);
};

export const buildDispatchAuditRows = (reportRows, databaseSheets) => {
  const dispatchSheet = databaseSheets.find((s) => /dispatch|shipping/i.test(s.sheetTitle));
  if (!dispatchSheet) return [];

  const dispatchMap = new Map();
  for (const r of dispatchSheet.rows) {
    const days = String(r.shipping_days ?? '').trim();
    const text = String(r.dispatch_days ?? '').trim();
    if (days && text) dispatchMap.set(days, text);
  }

  return reportRows.reduce((rows, reportRow) => {
    const shippingDays = String(reportRow.shipping_days ?? '').trim();
    const expected = dispatchMap.get(shippingDays);
    if (!expected) return rows;

    const currentDispatch = String(reportRow.dispatch_days ?? '').trim();
    if (currentDispatch === expected) return rows;

    rows.push({
      id: createRowId(),
      sku: reportRow.sku || reportRow.name || '',
      gemstone2: reportRow.gemstone2 ?? '',
      status: reportRow.status ?? '',
      price: reportRow.price ?? '',
      qty: reportRow.qty ?? '',
      is_in_stock: reportRow.is_in_stock ?? '',
      old_dispatch: currentDispatch,
      new_dispatch: expected,
    });
    return rows;
  }, []);
};

export const buildOriginAuditRows = (reportRows, databaseSheets) => {
  const gemTypeSheet = findDatabaseSheet(databaseSheets, 'gem_type');
  if (!gemTypeSheet) return [];

  const originMap = new Map();
  for (const r of gemTypeSheet.rows) {
    const g2 = normalizeLookupValue(r.gemstone2);
    const origin = String(r.origin || '').trim();
    if (g2 && origin && !originMap.has(g2)) originMap.set(g2, origin);
  }

  return reportRows.reduce((rows, reportRow) => {
    if (normalizeLookupValue(reportRow.attribute_set_id) !== 'gemstones') return rows;
    const g2 = normalizeLookupValue(reportRow.gemstone2);
    const expected = originMap.get(g2);
    if (!expected) return rows;

    const currentOrigin = String(reportRow.origin || '').trim();
    if (currentOrigin.toLowerCase() === expected.toLowerCase()) return rows;

    rows.push({
      id: createRowId(),
      sku: reportRow.sku || reportRow.name || '',
      gemstone2: reportRow.gemstone2 ?? '',
      status: reportRow.status ?? '',
      qty: reportRow.qty ?? '',
      is_in_stock: reportRow.is_in_stock ?? '',
      old_origin: currentOrigin,
      new_origin: expected,
    });
    return rows;
  }, []);
};

export const buildBenefitsAuditRows = (reportRows, databaseSheets) => {
  const gemTypeSheet = findDatabaseSheet(databaseSheets, 'gem_type');
  if (!gemTypeSheet) return [];

  const benefitsMap = new Map();
  for (const r of gemTypeSheet.rows) {
    const g2 = normalizeLookupValue(r.gemstone2);
    const benefits = String(r.gemstone_benifits || '').trim();
    if (g2 && benefits && !benefitsMap.has(g2)) {
      benefitsMap.set(g2, benefits);
    }
  }

  return reportRows.reduce((rows, reportRow) => {
    const sku = reportRow.sku || reportRow.name || '';
    if (!sku) return rows;

    const g2 = normalizeLookupValue(reportRow.gemstone2);
    if (!g2) return rows;

    const expected = benefitsMap.get(g2);
    if (!expected) return rows;

    const currentBenefits = String(reportRow.gemstone_benifits_new || '').trim();
    if (normalizeLookupValue(currentBenefits) === normalizeLookupValue(expected)) return rows;

    rows.push({
      id: createRowId(),
      sku,
      gemstone2: reportRow.gemstone2 ?? '',
      status: reportRow.status ?? '',
      qty: reportRow.qty ?? '',
      is_in_stock: reportRow.is_in_stock ?? '',
      old_benefits: currentBenefits,
      new_benefits: expected,
    });
    return rows;
  }, []);
};

export const buildNameAuditRows = (reportRows) => {
  return reportRows.reduce((rows, reportRow) => {
    const currentName = String(reportRow.name || '').trim();
    if (!currentName) return rows;

    // Clean up multiple spaces, improper hyphen spacings, and trailing spaces
    let normalized = currentName.replace(/\s+/g, ' ').replace(/\s*-\s*/g, ' - ').trim();
    if (normalized === currentName) return rows;

    rows.push({
      id: createRowId(),
      sku: reportRow.sku || reportRow.name || '',
      old_name: currentName,
      new_name: normalized,
    });
    return rows;
  }, []);
};

export const calculateTax = (shape, gemstone) => {
  const shapeStr = String(shape || '');
  const gemstoneStr = String(gemstone || '');
  
  if (['Carving', 'Carved'].includes(shapeStr) && !gemstoneStr.includes('Coral')) {
    return 0.03;
  } else if (gemstoneStr.includes('Coral')) {
    return 0.05;
  } else if (gemstoneStr === 'Pearl') {
    return 0.03;
  } else {
    return 0.0025;
  }
};

export const customRound = (price) => {
  if (price <= 1000) return Math.round(price / 10) * 10;
  if (price <= 5000) return Math.round(price / 50) * 50;
  if (price <= 100000) return Math.round(price / 100) * 100;
  if (price <= 400000) return Math.round(price / 500) * 500;
  if (price <= 699999) return Math.round(price / 1000) * 1000;
  return 700000;
};

export const roundRange = (x) => {
  if (!x || x === 'Call for Price') return x;
  return 500 * Math.round(x / 500);
};

export const calculatePriceRow = (row, ppcInput) => {
  const updatedRow = { ...row };
  const ppc = parseFloat(ppcInput);
  
  updatedRow.ppc = ppcInput;
  
  const todayDate = new Date();
  const yyyy = todayDate.getFullYear();
  const mm = String(todayDate.getMonth() + 1).padStart(2, '0');
  const dd = String(todayDate.getDate()).padStart(2, '0');
  const todayStr = `${dd}-${mm}-${yyyy}`;
  
  const baseComment = row.comment_explation_original ? `${row.comment_explation_original}, ` : '';
  const defaultComment = row.comment_explation_original || '';
  const authorName = (typeof window !== 'undefined' && window.sessionStorage?.getItem('audit_author')) || 'System Audit';
  const calculatedComment = `${baseComment}Price update on ${todayStr} by ${authorName}`;

  if (isNaN(ppc) || ppcInput === '') {
    updatedRow.price = '';
    updatedRow.price_per_carat = '';
    updatedRow.callfor = '';
    updatedRow.price_range = '';
    updatedRow.price_per_carat_range = '';
    updatedRow.offers = '';
    updatedRow.product_category_type = '';
    updatedRow.comment_explation = defaultComment;
    return updatedRow;
  }
  
  const tax = calculateTax(row.shape, row.gemstone);
  const caratWeight = parseFloat(row.carat_weight) || 0;
  
  let rawPrice = ((ppc * tax) + ppc) * caratWeight;
  let price = customRound(rawPrice);
  
  updatedRow.price = price;
  
  let price_per_carat = 0;
  if (price === 700000 && row.gemstone === 'Alexandrite') {
    price_per_carat = 500000;
  } else if (price === 700000) {
    price_per_carat = 0;
  } else if (caratWeight > 0) {
    price_per_carat = Math.round(price / caratWeight);
  }
  updatedRow.price_per_carat = price_per_carat;
  
  updatedRow.callfor = price > 699999 ? 'Call for Price' : '';
  
  let price_range = price === 700000 ? 'Call for Price' : price;
  if (price_range !== 'Call for Price') {
    let rounded = roundRange(price_range);
    if (rounded > price) rounded -= 500;
    price_range = rounded;
  }
  updatedRow.price_range = price_range;
  
  let price_per_carat_range = price === 700000 ? 'Call for Price' : price_per_carat;
  if (price_per_carat_range !== 'Call for Price') {
    let rounded = roundRange(price_per_carat_range);
    if (rounded > price_per_carat) rounded -= 500;
    price_per_carat_range = rounded;
  }
  updatedRow.price_per_carat_range = price_per_carat_range;
  
  updatedRow.offers = price === 700000 ? 'Call for Price' : '';
  if (row.vendor === 'GP' && price < 700000) {
    updatedRow.offers = 'Express Dispatch';
  }
  
  updatedRow.product_category_type = price > 40000 ? 'P' : 'MP';
  updatedRow.comment_explation = calculatedComment;
  
  return updatedRow;
};

export const buildPriceUpdateRows = (reportRows) =>
  reportRows.reduce((rows, reportRow) => {
    if (normalizeLookupValue(reportRow.attribute_set_id) !== 'gemstones') return rows;
    
    rows.push({
      id: createRowId(),
      sku: reportRow.sku || reportRow.name || '',
      ppc: '',
      price: '',
      price_per_carat: '',
      callfor: '',
      price_range: '',
      price_per_carat_range: '',
      offers: '',
      product_category_type: '',
      comment_explation: '',
      shape: reportRow.shape || '',
      gemstone: reportRow.gemstone || '',
      carat_weight: reportRow.carat_weight || '',
      vendor: reportRow.vendor || '',
      comment_explation_original: reportRow.comment_explation || '',
    });
    
    return rows;
  }, []);

export const buildStockUpdateRows = (reportRows, mode) =>
  reportRows
    .filter((row) => (mode === 'in' ? !isRowInStock(row) : isRowInStock(row)))
    .map((row) => ({
      id: createRowId(),
      sku: row.sku || row.name || '',
      stock_action: mode === 'in' ? 'Mark in stock' : 'Mark out of stock',
      current_qty: row.qty ?? '',
      notes: '',
    }));

export const DESIGN_CODE_SETS = [
  'bracelets - config x002',
  'rings - config x002',
  'pendants - config x002',
  'earrings - config x002',
  'brooches - config x002',
  'necklaces - config x002',
  'bracelets',
  'rings',
  'pendants',
  'earrings',
  'brooches',
  'necklaces'
];

export const VALID_DESIGN_CODES = new Map(
  [
    "a", "R1", "R1-Sparkle", "R1-Dazzle", "A1", "A2", "A2-Sparkle", "A2-Dazzle", "A4", "A6", "A7", "A9", "A10", 
    "A11", "A13", "A16", "A18", "A21", "A22", "A23", "A24", "A25", "A26", "AC6", "AC7", "AC8", "AC9", "AC10", 
    "AC11", "AC12", "AC13", "AC14", "AC15", "AC16", "AC18", "AC19", "AC21", "AC17", "AC2", "AC1", "AC3", "AC5", 
    "AO21", "AO22", "AO23", "AO24", "AO25", "AO26", "AO27", "AO28", "AO29", "AO30", "AP8", "AP9", "AP10", 
    "AP11", "AP12", "AP13", "AP14", "AP15", "AP16", "AP17", "A27", "A28", "A29", "A30", "A31", "A32", "A33", 
    "A34", "A35", "A36", "A37", "A38", "A39", "A40", "A41", "A42", "A43", "A44", "A45", "A46", "A47", "A48", 
    "A49", "A50", "A51", "A52", "A53", "A54", "A55", "A56", "A57", "A58", "A59", "A60", "A61", "A62", "A63", 
    "A64", "DC3", "DC4", "DC5", "DC6", "DC7", "DC8", "DC9", "DC10", "DC11", "DC12", "DC13", "DC14", "DC15", 
    "DC16", "DC17", "DC18", "DC19", "DC20", "P1", "D1", "D2", "D3", "D4", "D4-Sparkle", "D5", "D14", "D15", 
    "D16", "D17", "D18", "D19", "D20", "D21", "D22", "D23", "D24", "D25", "D26", "D27", "D28", "D29", "D30", 
    "B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10", "B11", "B12", "B13", "B14", "NK1", "NK2", 
    "NK3", "NK4", "NK5", "NK6", "NK7", "NK8", "D6", "D7", "D8", "D9", "D10", "D11", "E1", "E2", "E3", "E4", 
    "E5", "E6", "E7", "E8", "E9", "E10", "E11", "E12", "E13", "E14", "E15", "E16", "E17", "E18", "E19", "E20", 
    "E21", "E22", "E23", "E24", "E25", "E26", "E27", "E28", "E29", "E30", "E31", "E32", "E33", "E34", "E35", 
    "E36", "E37", "4Prong", "6Prong", "8Prong", "ER1", "ER2", "ER3", "ER4", "ER6", "ER7", "ER8", "ER9", 
    "ER10", "ER11", "ER12", "ER13", "ER14", "ER15", "ER16", "ER17", "ER18", "ER19", "ER20", "ER21", "ER22", 
    "ER23", "ER24", "ER25", "ER26", "ER27", "ER28", "ER29", "ER30", "ER31", "ER32", "ER33", "ER34", "ER35", 
    "ER36", "ER37", "DO7", "DO8", "DO9", "DO10", "DO11", "DO12", "DO13", "DP1", "DP2", "DP3", "DP4", "DP5", 
    "DP6", "DP7", "DP8", "DP9", "DP10", "DP11", "DP12", "DP13", "DP14", "DP15", "DP16", "DP17", "DP18", "DP19", 
    "N1", "N3", "N5", "N6", "N7", "N8", "N9", "N10", "N11", "N12", "N13", "N14", "N15", "N16", "N17", "BR1", 
    "BR2", "BR3", "BR4", "BR5", "BR6", "BR7", "BR8", "BR9", "BR10", "BR11", "BR12", "BR13", "BR14", "BR15", 
    "BR16", "BR17", "BR18", "BR19", "BR20", "BR21", "BR22", "BR23", "BR24", "BR25"
  ].map(code => [code.trim().toUpperCase(), code.trim()])
);

export const enrichReportRow = (row) => {
  const enriched = { ...row };
  const attrSet = normalizeLookupValue(enriched.attribute_set_id);
  if (DESIGN_CODE_SETS.includes(attrSet)) {
    const sku = enriched.sku || '';
    const parts = sku.split('-');
    if (parts.length >= 2) {
      let codeIndex = 1;
      if (parts[1].toUpperCase() === 'NAV' && parts.length > 2) {
        codeIndex = 2;
      }

      const baseCodeOrig = parts[codeIndex];
      const baseCode = baseCodeOrig.toUpperCase();
      let extracted = baseCode;
      let finalCode = baseCodeOrig;
      
      const nextPart = parts[codeIndex + 1] ? parts[codeIndex + 1].toUpperCase() : '';
      if (nextPart === 'SPARK' || nextPart === 'SPARKLE') {
        extracted = `${baseCode}-SPARKLE`;
        finalCode = `${baseCodeOrig}-Sparkle`;
      } else if (nextPart === 'DAZZ' || nextPart === 'DAZZLE') {
        extracted = `${baseCode}-DAZZLE`;
        finalCode = `${baseCodeOrig}-Dazzle`;
      }

      if (VALID_DESIGN_CODES.has(extracted)) {
        enriched.design_code = VALID_DESIGN_CODES.get(extracted);
      } else if (VALID_DESIGN_CODES.has(baseCode)) {
        enriched.design_code = VALID_DESIGN_CODES.get(baseCode);
      } else {
        enriched.design_code = finalCode;
      }
    }
  }
  return normalizeReportNumberFields(enriched);
};

