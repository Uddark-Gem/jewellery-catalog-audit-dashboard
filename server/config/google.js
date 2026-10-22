import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { config } from './env.js';

let cachedAuthClient = null;
let cachedSheets = null;
let cachedDrive = null;
let runtimeCredentials = null;

export function resetGoogleClientCache() {
  cachedAuthClient = null;
  cachedSheets = null;
  cachedDrive = null;
}

export function setRuntimeCredentials(creds) {
  if (creds) {
    validateCredentialFields(creds);
  }
  runtimeCredentials = creds;
  resetGoogleClientCache();
}

export function setRuntimeSpreadsheetId(id) {
  config.google.spreadsheetId = id ? id.trim() : '';
  resetGoogleClientCache();
}

/**
 * Parses and returns the Google Service Account credentials.
 * Throws a descriptive error if configuration or files are missing.
 */
export function getServiceAccountCredentials() {
  if (runtimeCredentials) {
    return runtimeCredentials;
  }

  // Option 1: Direct JSON or Base64 string in environment
  const possibleEnvKeys = [
    'GOOGLE_SHEET',
    'GOOGLE_SERVICE_ACCOUNT_KEY',
    'GOOGLE_SERVICE_ACCOUNT_JSON',
    'GOOGLE_SERVICE_ACCOUNT',
    'GOOGLE_CREDENTIALS',
    'GOOGLE_APPLICATION_CREDENTIALS_JSON',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'SERVICE_ACCOUNT_KEY',
    'GCP_SA_KEY',
    'GOOGLE_SERVICE_ACCOUNT_BASE64',
  ];

  let envSecret = null;
  for (const key of possibleEnvKeys) {
    if (process.env[key] && process.env[key].trim()) {
      envSecret = process.env[key].trim();
      break;
    }
  }

  if (!envSecret && config.google.serviceAccountBase64) {
    envSecret = config.google.serviceAccountBase64.trim();
  }

  if (envSecret) {
    try {
      let parsed;
      if (envSecret.startsWith('{')) {
        parsed = JSON.parse(envSecret);
      } else if (envSecret.endsWith('.json') && fs.existsSync(envSecret)) {
        parsed = JSON.parse(fs.readFileSync(envSecret, 'utf8'));
      } else {
        const decoded = Buffer.from(envSecret, 'base64').toString('utf8');
        parsed = JSON.parse(decoded);
      }
      validateCredentialFields(parsed);
      return parsed;
    } catch (err) {
      throw new Error(`Invalid Google Service Account JSON from environment: ${err.message}`);
    }
  }

  // Option 2: Local JSON file on disk (or auto-detect any .json in ./secrets/)
  let resolvedPath = path.isAbsolute(config.google.serviceAccountPath)
    ? config.google.serviceAccountPath
    : path.resolve(config.paths.root, config.google.serviceAccountPath);

  if (!fs.existsSync(resolvedPath)) {
    const secretsDir = path.resolve(config.paths.root, 'secrets');
    if (fs.existsSync(secretsDir)) {
      const jsonFiles = fs.readdirSync(secretsDir).filter((f) => f.endsWith('.json'));
      if (jsonFiles.length > 0) {
        resolvedPath = path.join(secretsDir, jsonFiles[0]);
      }
    }
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Google Service Account credentials file not found at: ${resolvedPath}. ` +
      `Please place your service account JSON file into './secrets/google-service-account.json' ` +
      `or set GOOGLE_SERVICE_ACCOUNT_JSON_PATH (or GOOGLE_SHEET) in your .env.local file.`
    );
  }

  try {
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    const parsed = JSON.parse(raw);
    validateCredentialFields(parsed);
    return parsed;
  } catch (err) {
    throw new Error(`Failed to parse Google credentials at ${resolvedPath}: ${err.message}`);
  }
}

function validateCredentialFields(creds) {
  if (!creds.client_email) {
    throw new Error("Missing 'client_email' in Google Service Account credentials JSON.");
  }
  if (!creds.private_key) {
    throw new Error("Missing 'private_key' in Google Service Account credentials JSON.");
  }
}

/**
 * Returns an authenticated Google JWT Auth Client.
 */
export async function getGoogleAuthClient() {
  if (cachedAuthClient) return cachedAuthClient;

  const credentials = getServiceAccountCredentials();
  const formattedKey = credentials.private_key
    ? credentials.private_key.replace(/\\n/g, '\n')
    : '';

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: formattedKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  await auth.authorize();
  cachedAuthClient = auth;
  return auth;
}

/**
 * Returns an authorized Google Sheets API v4 instance.
 */
export async function getGoogleSheetsClient() {
  if (cachedSheets) return cachedSheets;
  const auth = await getGoogleAuthClient();
  cachedSheets = google.sheets({ version: 'v4', auth });
  return cachedSheets;
}

/**
 * Returns an authorized Google Drive API v3 instance.
 */
export async function getGoogleDriveClient() {
  if (cachedDrive) return cachedDrive;
  const auth = await getGoogleAuthClient();
  cachedDrive = google.drive({ version: 'v3', auth });
  return cachedDrive;
}

/**
 * Validates the current Google Sheets setup without throwing.
 * Returns an informative status object for UI diagnostics.
 */
export async function getGoogleIntegrationStatus() {
  try {
    const credentials = getServiceAccountCredentials();
    const spreadsheetId = config.google.spreadsheetId;

    if (!spreadsheetId) {
      return {
        configured: false,
        ready: false,
        clientEmail: credentials.client_email,
        spreadsheetId: null,
        error: 'GOOGLE_SPREADSHEET_ID is not set in environment or .env.local.',
      };
    }

    const sheets = await getGoogleSheetsClient();
    // Test API call to verify read permission on target spreadsheet
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title,sheets.properties.title',
    });

    const sheetTitles = (metadata.data.sheets || []).map((s) => s.properties?.title).filter(Boolean);

    return {
      configured: true,
      ready: true,
      clientEmail: credentials.client_email,
      spreadsheetId,
      spreadsheetTitle: metadata.data.properties?.title || 'Untitled',
      sheets: sheetTitles,
      error: null,
    };
  } catch (err) {
    return {
      configured: false,
      ready: false,
      clientEmail: null,
      spreadsheetId: config.google.spreadsheetId || null,
      error: err.message,
    };
  }
}
