import * as XLSX from 'xlsx';

function pad2(n: number) {
  return n < 10 ? '0' + n : String(n);
}

function addYearMonth(ym: string, add: number) {
  const [y, m] = String(ym || '').split('-').map(Number);
  if (!y || !m) return '';
  const d = new Date(y, m - 1 + add, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function foldHeader(s: any) {
  return String(s || '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mutabakat ayı + sonraki takvim ayı (Ekim → Kasım sonu). */
export function rentalAdminGraceUntilMonth(yearMonth: string) {
  return addYearMonth(String(yearMonth || '').slice(0, 7), 1);
}

export function rentalAdminCanEditMonth(yearMonth: string, now = new Date()) {
  const ym = String(yearMonth || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(ym)) return false;
  const current = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  return current <= rentalAdminGraceUntilMonth(ym);
}

export function rentalRowLockedForUser(row: any, role: string | null) {
  if (role === 'admin') {
    if ((row?.status || 'draft') !== 'approved') return false;
    return !rentalAdminCanEditMonth(row.year_month);
  }
  if (role === 'saha') return (row?.status || 'draft') === 'approved';
  return true;
}

export function rentalListeFromWorkbook(workbook: XLSX.WorkBook) {
  const names = workbook.SheetNames || [];
  const preferred = names.find(n => foldHeader(n).includes('liste')) || names[0];
  const sheet = workbook.Sheets[preferred];
  const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  let headerIdx = 0;
  for (let i = 0; i < Math.min(matrix.length, 20); i++) {
    const cells = (matrix[i] || []).map(c => foldHeader(c));
    const hasPlate = cells.some(c => c.includes('plak'));
    const hasContractor = cells.some(c => c.includes('yuklen') || c.includes('kesen') || c.includes('sofor') || c.includes('unvan'));
    if (hasPlate && hasContractor) {
      headerIdx = i;
      break;
    }
    if (hasPlate) headerIdx = i;
  }
  const headers = (matrix[headerIdx] || []).map((h, i) => String(h || '').replace(/\s+/g, ' ').trim() || `COL${i}`);
  const rows: any[] = [];
  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const line = matrix[r] || [];
    if (line.every(c => String(c ?? '').trim() === '')) continue;
    const obj: any = {};
    headers.forEach((h, i) => { obj[h] = line[i]; });
    rows.push(obj);
  }
  return { sheetName: preferred, headers, rows };
}

export function rentalFuelIncome(km: any, rate: any, unit: any) {
  return (Number(km) || 0) / 100 * (Number(rate) || 0) * (Number(unit) || 0);
}

export const RENTAL_WORK_GROUPS = [
  { id: 'magazalar', label: 'Mağazalar', rentMode: 'monthly' as const, visitUnit: 35, hasHgs: false, hasWorkDays: false, stopLabel: 'Nokta sayısı' },
  { id: 'bati_marmara_yemek', label: 'Batı Marmara Yemek', rentMode: 'daily' as const, visitUnit: 355, hasHgs: true, hasWorkDays: true, stopLabel: 'Uğrama gün' },
  { id: 'dogu_marmara_yemek', label: 'Doğu Marmara Yemek', rentMode: 'daily' as const, visitUnit: 205, hasHgs: true, hasWorkDays: true, stopLabel: 'Uğrama gün' }
] as const;

export function rentalGroupMeta(id: string | undefined | null) {
  return RENTAL_WORK_GROUPS.find(g => g.id === id) || RENTAL_WORK_GROUPS[0];
}

export function inferRentalWorkGroup(text: string) {
  const n = foldHeader(text);
  if (n.includes('magaza')) return 'magazalar';
  if (n.includes('dogu') && n.includes('marmara')) return 'dogu_marmara_yemek';
  if (n.includes('bati') && n.includes('marmara')) return 'bati_marmara_yemek';
  if (n.includes('dogu marmara')) return 'dogu_marmara_yemek';
  if (n.includes('bati marmara')) return 'bati_marmara_yemek';
  return '';
}

export function rentalRowGroup(row: any) {
  return row?.work_group
    || inferRentalWorkGroup(`${row?.notes || ''} ${row?.region || ''} ${row?.province || ''}`);
}

export function rentalMonthlyRent(row: any) {
  const meta = rentalGroupMeta(rentalRowGroup(row));
  const rent = Number(row?.rent_amount) || 0;
  const days = Number(row?.work_days) || 0;
  if (meta.rentMode === 'daily') return rent > 15000 ? rent : rent * days;
  return rent;
}

export function rentalVisitMoney(row: any) {
  const stored = Number(row?.visit_prime) || 0;
  if (stored > 0) return stored;
  const meta = rentalGroupMeta(rentalRowGroup(row));
  return (Number(row?.stop_count) || 0) * (meta.visitUnit || 0);
}

export function rentalSettlementTotals(row: any) {
  const fuelIncome = rentalFuelIncome(row?.total_km, row?.fuel_rate, row?.fuel_unit_price);
  const brut = rentalMonthlyRent(row)
    + rentalVisitMoney(row)
    + (Number(row?.extra_work) || 0)
    + (Number(row?.hgs) || 0)
    + fuelIncome
    - (Number(row?.fuel_charge) || 0);
  const kdv = brut * 0.2;
  const stoppage = kdv * 0.2;
  const payable = brut + kdv - stoppage;
  return {
    fuelIncome,
    brut,
    kdv,
    stoppage,
    payable,
    term1: payable / 2,
    term2: payable / 2
  };
}

export function rentalFisFileName(row: any) {
  const plate = String(row?.plate || 'plaka').replace(/\s+/g, '').replace(/[\\/:*?"<>|]/g, '-');
  const name = String(row?.contractor_name || 'unvan').trim().replace(/\s+/g, '_').replace(/[\\/:*?"<>|]/g, '-');
  const ym = String(row?.year_month || '').slice(0, 7) || 'ay';
  return `${plate}_${name}_${ym}.pdf`;
}
