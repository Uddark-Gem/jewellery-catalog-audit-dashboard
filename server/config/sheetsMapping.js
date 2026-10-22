import { config } from './env.js';

export const SHEETS_MAPPING = {
  report: {
    spreadsheetId: config.google.exportSpreadsheetId || '1gF5LTrq7u81-bk0F5C5LBjhYMqE5UtuQt43MIMj6LWI',
    sheetName: 'Export Data',
    label: 'Export Data',
  },
  q3_processed_images: {
    spreadsheetId: config.google.mediaSpreadsheetId || '1ffR337uw0Uu2gCirNjdLSx12UP1z-ebS9Sr6hacoSdg',
    sheetName: 'Image Database',
    label: 'Image Database',
  },
  videodata_new: {
    spreadsheetId: config.google.mediaSpreadsheetId || '1ffR337uw0Uu2gCirNjdLSx12UP1z-ebS9Sr6hacoSdg',
    sheetName: 'Video Database',
    label: 'Video Database',
  },
  templatetagproduct_gemstone: {
    spreadsheetId: config.google.customOptionsSpreadsheetId || '1fMYF2bFljbvamNYVN_dFUmYDOj4yXzwdtG69CYoIXKw',
    sheetName: 'Gemstone Option Data',
    fallbackSheetName: 'Gemstone',
    label: 'Gemstone Option Data',
  },
  templatetagproduct_jewellery: {
    spreadsheetId: config.google.customOptionsSpreadsheetId || '1fMYF2bFljbvamNYVN_dFUmYDOj4yXzwdtG69CYoIXKw',
    sheetName: 'Jewellery Option Data',
    fallbackSheetName: 'Jewellery',
    label: 'Jewellery Option Data',
  },
  custom_option_issues: {
    spreadsheetId: config.google.customOptionsSpreadsheetId || '1fMYF2bFljbvamNYVN_dFUmYDOj4yXzwdtG69CYoIXKw',
    sheetName: 'Custom Option Issues',
    label: 'Custom Option Issues',
  },
  templatetagproduct: {
    spreadsheetId: config.google.customOptionsSpreadsheetId || '1fMYF2bFljbvamNYVN_dFUmYDOj4yXzwdtG69CYoIXKw',
    sheetName: 'Custom Option',
    label: 'Custom Option',
  },
};
