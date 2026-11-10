const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

function foldHeader(s) {
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

function parseLocaleNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  let str = String(val).trim().replace(/[₺TL]/gi, '').replace(/\s/g, '');
  if (!str) return 0;
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  if (hasComma && hasDot) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) str = str.replace(/\./g, '').replace(',', '.');
    else str = str.replace(/,/g, '');
  } else if (hasComma) {
    const frac = str.split(',')[1] || '';
    str = frac.length === 3 ? str.replace(/,/g, '') : str.replace(',', '.');
  } else if (hasDot) {
    const parts = str.split('.');
    const last = parts[parts.length - 1] || '';
    if (parts.length > 2 || (parts.length === 2 && last.length === 3)) str = parts.join('');
  }
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

function excelColExact(row, names) {
  const keys = Object.keys(row || {});
  for (const name of names) {
    const n = foldHeader(name);
    const hit = keys.find((k) => foldHeader(k) === n);
    if (hit !== undefined && row[hit] !== undefined && String(row[hit]).trim() !== '') return row[hit];
  }
  return '';
}

function excelColFuzzy(row, needles) {
  const keys = Object.keys(row || {});
  for (const n of needles.map(foldHeader).filter(Boolean)) {
    for (const k of keys) {
      const fk = foldHeader(k);
      if (!fk) continue;
      if (fk === n || fk.includes(n)) {
        const v = row[k];
        if (v !== undefined && String(v).trim() !== '') return v;
      }
    }
  }
  return '';
}

function parseWb(fp) {
  const wb = XLSX.readFile(fp, { cellDates: true });
  const names = wb.SheetNames || [];
  const preferred = names.find((n) => foldHeader(n).includes('liste')) || names[0];
  const sheet = wb.Sheets[preferred];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  let headerIdx = 0;
  for (let i = 0; i < Math.min(matrix.length, 20); i++) {
    const cells = (matrix[i] || []).map((c) => foldHeader(c));
    if (cells.some((c) => c.includes('plak'))) {
      headerIdx = i;
      break;
    }
  }
  const headers = (matrix[headerIdx] || []).map((h, i) => String(h || '').replace(/\s+/g, ' ').trim() || `COL${i}`);
  const rows = [];
  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const line = matrix[r] || [];
    if (line.every((c) => String(c ?? '').trim() === '')) continue;
    const obj = {};
    headers.forEach((h, i) => { obj[h] = line[i]; });
    rows.push(obj);
  }
  return { preferred, headers, rows };
}

function sqlStr(v) {
  if (v === null || v === undefined || v === '') return 'null';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function monthlyRent(r) {
  if (r.work_group === 'magazalar') return r.rent_amount;
  return r.rent_amount > 15000 ? r.rent_amount : r.rent_amount * r.work_days;
}

function payable(r) {
  const fuel = (r.total_km / 100) * r.fuel_rate * r.fuel_unit_price;
  const brut = monthlyRent(r) + r.visit_prime + r.extra_work + r.hgs + fuel - r.fuel_charge;
  const kdv = brut * 0.2;
  const st = kdv * 0.2;
  return brut + kdv - st;
}

const files = [
  { fp: 'C:/Users/halit/Downloads/Ekim 26 Batı Marmara Yemek.xlsx', g: 'bati_marmara_yemek', rentMode: 'daily', visitUnit: 355, hasHgs: true },
  { fp: 'C:/Users/halit/Downloads/Ekim 26 Doğu Marmara Yemek.xlsx', g: 'dogu_marmara_yemek', rentMode: 'daily', visitUnit: 205, hasHgs: true },
  { fp: 'C:/Users/halit/Downloads/Ekim 26 Mağazalar.xlsx', g: 'magazalar', rentMode: 'monthly', visitUnit: 35, hasHgs: false }
];

const all = [];
for (const f of files) {
  const parsed = parseWb(f.fp);
  const fileName = path.basename(f.fp);
  parsed.rows.forEach((row) => {
    const plate = String(excelColFuzzy(row, ['plaka', 'plak']) || '').trim().toUpperCase();
    const contractor = String(excelColFuzzy(row, ['fatura kesen', 'yuklenici']) || '').trim();
    if (!plate || !contractor) return;
    if (!/[A-Z0-9]{5,}/.test(plate.replace(/\s/g, ''))) return;
    if (/genel toplam|toplam/i.test(foldHeader(contractor))) return;
    const province = String(excelColFuzzy(row, ['bolge', 'il']) || '').trim();
    const dailyRent = excelColExact(row, ['kira']);
    const monthlyRentCol = excelColExact(row, ['aylik kira', 'kira bedeli']);
    const workDays = parseLocaleNumber(excelColExact(row, ['clsm gun', 'calisma gun', 'calisma gunu']));
    const rent_amount = f.rentMode === 'daily'
      ? (dailyRent !== '' ? parseLocaleNumber(dailyRent) : (workDays ? parseLocaleNumber(monthlyRentCol) / workDays : 0))
      : parseLocaleNumber(monthlyRentCol !== '' ? monthlyRentCol : dailyRent);
    const kmRaw = excelColExact(row, ['yapilan km']) || excelColFuzzy(row, ['yapilan km', 'toplam km']);
    const total_km = parseLocaleNumber(kmRaw);
    const stopCount = parseLocaleNumber(excelColExact(row, ['ugrm gun', 'nokta sayisi']) || excelColFuzzy(row, ['nokta sayisi', 'ugrm gun', 'nokta']));
    const visitImported = parseLocaleNumber(excelColExact(row, ['ugrama primi']));
    all.push({
      year_month: '2026-10',
      province: province || null,
      region: province || null,
      plate,
      contractor_name: contractor,
      rent_amount,
      fuel_rate: parseLocaleNumber(excelColExact(row, ['yakit oran']) || excelColFuzzy(row, ['yakit oran'])),
      fuel_unit_price: parseLocaleNumber(excelColExact(row, ['yakit aylik birim']) || excelColFuzzy(row, ['yakit aylik birim', 'aylik birim'])),
      total_km,
      work_days: workDays,
      stop_count: stopCount,
      visit_prime: visitImported || stopCount * f.visitUnit,
      extra_work: parseLocaleNumber(excelColExact(row, ['ek/is', 'ek is', 'ek is / diger'])) + parseLocaleNumber(excelColExact(row, ['arac yani calisan'])),
      hgs: f.hasHgs ? parseLocaleNumber(excelColExact(row, ['hgs'])) : 0,
      fuel_charge: parseLocaleNumber(excelColFuzzy(row, ['yakit kesintisi'])),
      notes: fileName.replace(/\.xlsx?$/i, ''),
      work_group: f.g,
      status: 'draft',
      _kmRaw: kmRaw
    });
  });
}

const byG = {};
all.forEach((r) => { byG[r.work_group] = (byG[r.work_group] || 0) + 1; });
console.log(JSON.stringify({
  rows: all.length,
  byGroup: byG,
  maxKm: Math.max(...all.map((r) => r.total_km)),
  minPositiveKm: Math.min(...all.filter((r) => r.total_km > 0).map((r) => r.total_km)),
  suspectSmallKm: all.filter((r) => r.total_km > 0 && r.total_km < 100).map((r) => ({ plate: r.plate, km: r.total_km, raw: r._kmRaw })),
  sample: all.slice(0, 6).map((r) => ({
    g: r.work_group, plate: r.plate, km: r.total_km, days: r.work_days, rent: r.rent_amount, payable: Number(payable(r).toFixed(2))
  }))
}, null, 2));

const lines = [
  '-- Ekim 2026 kiralık mutabakat (gerçek Excel, ham KM). SQL Editor’da bir kez Run.',
  '-- Önceki Ekim satırları silinir, tekrar yazılır. Fatura/cariye dokunmaz.',
  "delete from public.rental_settlements where year_month in ('2026-10', '2026-10-01') or year_month like '2026-10%';",
  '',
  'insert into public.rental_settlements (',
  '  year_month, province, region, plate, contractor_name, rent_amount, fuel_rate, fuel_unit_price,',
  '  total_km, work_days, stop_count, visit_prime, extra_work, hgs, fuel_charge, notes, work_group, status',
  ') values'
];

const values = all.map((r, i) => {
  const row = `(${[
    sqlStr(r.year_month),
    sqlStr(r.province),
    sqlStr(r.region),
    sqlStr(r.plate),
    sqlStr(r.contractor_name),
    r.rent_amount,
    r.fuel_rate,
    r.fuel_unit_price,
    r.total_km,
    r.work_days,
    r.stop_count,
    r.visit_prime,
    r.extra_work,
    r.hgs,
    r.fuel_charge,
    sqlStr(r.notes),
    sqlStr(r.work_group),
    sqlStr(r.status)
  ].join(', ')})`;
  return row + (i === all.length - 1 ? ';' : ',');
});

const out = path.join(__dirname, '..', 'supabase', 'seed_ekim_2026_rentals.sql');
fs.writeFileSync(out, [...lines, ...values, ''].join('\n'), 'utf8');
console.log('WROTE', out);
