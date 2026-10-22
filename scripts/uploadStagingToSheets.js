import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { uploadDatasetToSheet } from '../server/services/overviewSheetsService.js';
import { SHEETS_MAPPING } from '../server/config/sheetsMapping.js';

const __filename = fileURLToPath(import.meta.url);

// Allow running from CLI directly: node scripts/uploadStagingToSheets.js [targetId] [limit]
const argTarget = process.argv[2] || 'all';
const argLimit = process.argv[3] ? Number.parseInt(process.argv[3], 10) : null;

(async () => {
  try {
    if (argTarget === 'all') {
      console.log('Uploading all staging datasets to Google Sheets in small packets...');
      for (const t of Object.keys(SHEETS_MAPPING)) {
        try {
          await uploadDatasetToSheet(t, argLimit);
        } catch (e) {
          console.error(`Error uploading ${t}:`, e.message);
        }
      }
    } else {
      await uploadDatasetToSheet(argTarget, argLimit);
    }
    console.log('\nAll operations completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Fatal upload error:', err);
    process.exit(1);
  }
})();
