import { getDb } from '../db.js';
import { googleSheetsRepo } from './googleSheetsRepo.js';
import { getGoogleIntegrationStatus } from '../config/google.js';
import { config } from '../config/env.js';

export const ALLOWED_COLUMNS = new Set([
  'attribute_set_id', 'sku', 'name', 'meta_title', 'url_key', 'treatment', 'carat_weight',
  'classification', 'cutting_style', 'dimensions', 'j_colour', 'name2', 'offers', 'weight_ratti',
  'shipping_days', 'hsn_code', 'price', 'price_per_carat', 'status', 'tax_class_id', 'gemstone',
  'shape', 'certification', 'colour', 'cut', 'dimension_type', 'dispatch_days', 'gemstone2', 'vendor',
  'origin', 'product_type', 'comment_explation', 'qty', 'is_in_stock', 'gemstone3', 'image',
  'news_from_date', 'stickers', 'callfor', 'quality_config_gem', 'redirect_select_for_quality',
  'select_for_quality', 'mainproduct_forjewlrypage', 'gemstone2_type', 'price_per_carat_range',
  'metal_config', 'ideal_design', 'price_for_jewelry', 'promotion_baseprice_jewlery',
  'product_discount_percentage', 'specific_gravity', 'refractive_index', 'show_pricing_table',
  'callfor_price_wanto_show', 'automatic_video_link', 'calibrated_size_range', 'quality_grade',
  'dimension_approx', 'certificate_number1', 'price_range', 'gemstone_benifits_new', 'product_category_type'
]);

export class ProductRepository {
  /**
   * Retrieves products with pagination, search, and sorting.
   */
  async getProducts({ page = 1, pageSize = 100, search = '', sort = '', direction = 'asc' }) {
    const db = await getDb();
    let query = 'SELECT * FROM reports';
    const params = [];

    if (search) {
      query += ` WHERE sku LIKE ? OR name LIKE ? OR url_key LIKE ?`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (sort) {
      const safeSort = sort.replace(/[^a-zA-Z0-9_]/g, '');
      if (ALLOWED_COLUMNS.has(safeSort)) {
        const safeDir = direction.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
        query += ` ORDER BY ${safeSort} ${safeDir}`;
      }
    }

    const offset = (Number(page) - 1) * Number(pageSize);
    query += ` LIMIT ? OFFSET ?`;
    params.push(Number(pageSize), offset);

    const rows = await db.all(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM reports';
    const countParams = [];
    if (search) {
      countQuery += ` WHERE sku LIKE ? OR name LIKE ? OR url_key LIKE ?`;
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const { count } = await db.get(countQuery, countParams);

    return { rows, total: count };
  }

  /**
   * Updates a single product field by ID or SKU.
   */
  async updateProductField(idOrSku, field, value) {
    if (!field || typeof field !== 'string') {
      throw new Error('Field name is required.');
    }

    const safeField = field.trim();
    if (!ALLOWED_COLUMNS.has(safeField)) {
      return { success: true, ignored: true, reason: 'Field not in reports schema' };
    }

    const db = await getDb();
    await db.run(
      `UPDATE reports SET ${safeField} = ? WHERE id = ? OR sku = ?`,
      [value, idOrSku, idOrSku]
    );

    return { success: true };
  }

  /**
   * Syncs current products to the Google Sheet 'Products' tab if Google Sheets is connected.
   */
  async syncToGoogleSheet() {
    const status = await getGoogleIntegrationStatus();
    if (!status.ready) {
      throw new Error(`Google Sheets not connected: ${status.error || 'Check configuration'}`);
    }

    const db = await getDb();
    const rows = await db.all('SELECT * FROM reports LIMIT 10000');
    if (rows.length === 0) {
      throw new Error('No product records available in database to sync.');
    }

    const headers = Array.from(ALLOWED_COLUMNS);
    const result = await googleSheetsRepo.saveWorksheet(config.google.sheetName, headers, rows);
    return {
      syncedRows: rows.length,
      updatedRange: result,
      sheetName: config.google.sheetName,
    };
  }
}

export const productRepo = new ProductRepository();
export default productRepo;
