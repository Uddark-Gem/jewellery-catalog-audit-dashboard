import fs from 'fs';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDir = config.paths.data;
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const DB_PATH = path.join(dbDir, 'audit.db');

export async function getDb() {
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      attribute_set_id TEXT,
      sku TEXT,
      name TEXT,
      meta_title TEXT,
      url_key TEXT,
      treatment TEXT,
      carat_weight TEXT,
      classification TEXT,
      cutting_style TEXT,
      dimensions TEXT,
      j_colour TEXT,
      name2 TEXT,
      offers TEXT,
      weight_ratti TEXT,
      shipping_days TEXT,
      hsn_code TEXT,
      price TEXT,
      price_per_carat TEXT,
      status TEXT,
      tax_class_id TEXT,
      gemstone TEXT,
      shape TEXT,
      certification TEXT,
      colour TEXT,
      cut TEXT,
      dimension_type TEXT,
      dispatch_days TEXT,
      gemstone2 TEXT,
      vendor TEXT,
      origin TEXT,
      product_type TEXT,
      comment_explation TEXT,
      qty TEXT,
      is_in_stock TEXT,
      gemstone3 TEXT,
      image TEXT,
      news_from_date TEXT,
      stickers TEXT,
      callfor TEXT,
      quality_config_gem TEXT,
      redirect_select_for_quality TEXT,
      select_for_quality TEXT,
      mainproduct_forjewlrypage TEXT,
      gemstone2_type TEXT,
      price_per_carat_range TEXT,
      metal_config TEXT,
      ideal_design TEXT,
      price_for_jewelry TEXT,
      promotion_baseprice_jewlery TEXT,
      product_discount_percentage TEXT,
      specific_gravity TEXT,
      refractive_index TEXT,
      show_pricing_table TEXT,
      callfor_price_wanto_show TEXT,
      automatic_video_link TEXT,
      calibrated_size_range TEXT,
      quality_grade TEXT,
      dimension_approx TEXT,
      certificate_number1 TEXT,
      price_range TEXT,
      gemstone_benifits_new TEXT,
      product_category_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}
