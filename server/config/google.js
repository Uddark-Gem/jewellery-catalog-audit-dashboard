import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { config } from './env.js';

let cachedAuthClient = null;
let cachedSheets = null;
let cachedDrive = null;

/**
 * Parses and returns the Google Service Account credentials.
 * Throws a descriptive error if configuration or files are missing.
 */
export function getServiceAccountCredentials() {
  // Option 1: Base64 string in environment (useful in cloud/serverless deployments)
  if (config.google.serviceAccountBase64) {
    try {
      const decoded = Buffer.from(config.google.serviceAccountBase64, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      validateCredentialFields(parsed);
      return parsed;
    } catch (err) {
      throw new Error(`Invalid GOOGLE_SERVICE_ACCOUNT_BASE64: ${err.message}`);
    }
  }

  // Option 2: Local JSON file on disk
  const resolvedPath = path.isAbsolute(config.google.serviceAccountPath)
    ? config.google.serviceAccountPath
    : path.resolve(config.paths.root, config.google.serviceAccountPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Google Service Account credentials file not found at: ${resolvedPath}. ` +
      `Please place your service account JSON file into './secrets/google-service-account.json' ` +
      `or set GOOGLE_SERVICE_ACCOUNT_JSON_PATH in your .env.local file.`
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
  const scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly',
  ];

  const auth = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    scopes
  );

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
