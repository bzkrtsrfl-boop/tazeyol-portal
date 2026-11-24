import * as XLSX from 'xlsx';
import { formatMoneyTR } from './money';

/** Banka talimatı gibi sayı kalması gereken hücreler */
export function excelKeepNumber(n: number) {
  return { __excelKeepNumber: true as const, n: Number(n) || 0 };
}

function excelCell(cell: any) {
  if (cell && typeof cell === 'object' && cell.__excelKeepNumber) return cell.n;
  if (typeof cell === 'number' && Number.isFinite(cell)) return formatMoneyTR(cell);
  if (cell == null) return '';
  return cell;
}

export function writeExcelAoa(rows: any[][], fileName: string, sheetName: string) {
  const aoa = (rows || []).map(row => (Array.isArray(row) ? row : [row]).map(excelCell));
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, String(sheetName || 'Sayfa').slice(0, 31));
  XLSX.writeFile(workbook, fileName);
}
