import { defaultSheetsService } from '../services/googleSheetsService.js';

export class GoogleSheetsRepository {
  constructor(sheetsService = defaultSheetsService) {
    this.service = sheetsService;
  }

  async getWorksheet(sheetTitle, range = 'A1:ZZ') {
    return this.service.readSheet(`${sheetTitle}!${range}`);
  }

  async saveWorksheet(sheetTitle, headers, rows) {
    return this.service.overwriteSheet(sheetTitle, headers, rows);
  }

  async appendRecords(sheetTitle, rows, headers = null) {
    return this.service.appendRows(sheetTitle, rows, headers);
  }

  async updateCell(sheetTitle, cellRange, value) {
    return this.service.updateRange(`${sheetTitle}!${cellRange}`, [[value]]);
  }
}

export const googleSheetsRepo = new GoogleSheetsRepository();
export default googleSheetsRepo;
