import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

/**
 * Loads key-value pairs from an env file into process.env if not already set.
 */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const [key, ...rest] = line.split('=');
      const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
      const trimmedKey = key.trim();
      if (trimmedKey && process.env[trimmedKey] === undefined) {
        process.env[trimmedKey] = val;
      }
    }
  } catch (err) {
    console.warn(`[Config] Failed to load ${filePath}: ${err.message}`);
  }
}

// 1. Try .env.local first (highest local precedence)
loadEnvFile(path.join(rootDir, '.env.local'));
// 2. Try .env as fallback
loadEnvFile(path.join(rootDir, '.env'));

const isVercel = Boolean(process.env.VERCEL);

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number.parseInt(process.env.PORT || '3000', 10),
  google: {
    serviceAccountPath: process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH || './secrets/google-service-account.json',
    serviceAccountBase64: process.env.GOOGLE_SERVICE_ACCOUNT_BASE64 || '',
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || '1wKfFadJlQrMli9GTBljjb3m6HUJmazFG_uXAvFPsQlY',
    exportSpreadsheetId: process.env.GOOGLE_SHEET_EXPORT_DATA_ID || '1gF5LTrq7u81-bk0F5C5LBjhYMqE5UtuQt43MIMj6LWI',
    mediaSpreadsheetId: process.env.GOOGLE_SHEET_MEDIA_ID || '1ffR337uw0Uu2gCirNjdLSx12UP1z-ebS9Sr6hacoSdg',
    customOptionsSpreadsheetId: process.env.GOOGLE_SHEET_CUSTOM_OPTIONS_ID || '1fMYF2bFljbvamNYVN_dFUmYDOj4yXzwdtG69CYoIXKw',
    sheetName: process.env.GOOGLE_SHEET_NAME || 'Products',
    driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
  },
  staging: {
    reportUrl: process.env.GEMPUNDIT_REPORT_URL || 'https://staging.gempundit.com/var/export/report.csv',
    username: process.env.GEMPUNDIT_REPORT_USERNAME || '',
    password: process.env.GEMPUNDIT_REPORT_PASSWORD || '',
  },
  paths: {
    root: rootDir,
    data: isVercel ? '/tmp/data' : path.join(rootDir, 'data'),
    backups: isVercel ? '/tmp/backups' : path.join(rootDir, 'data/backups'),
    database: path.join(rootDir, 'Database'),
    secrets: path.join(rootDir, 'secrets'),
  },
};

export default config;
