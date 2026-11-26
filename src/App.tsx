import React, { useState, useEffect, useMemo, useRef, useTransition } from 'react';
import { 
  Plus, 
  X, 
  RefreshCw, 
  FileSpreadsheet, 
  FileUp, 
  LogOut, 
  Edit2, 
  Trash2,
  LayoutDashboard,
  Users,
  Coins,
  Receipt,
  FileCheck2,
  FileText,
  UserCheck,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  Clock,
  AlertTriangle,
  Truck,
  Eye,
  EyeOff,
  BarChart3,
  Calendar,
  Building2,
  Wallet,
  BellRing,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  CheckSquare,
  Square,
  CreditCard,
  PhoneCall,
  Search,
  MoreHorizontal,
  Download,
  ShieldCheck,
  Phone,
  Contact,
  Tag,
  List
} from 'lucide-react';
import { supabase } from './supabase';
import { fetchProfile, PORTAL_MODULES, ACCESS_PRESETS, normalizeGroups, normalizeAccess, roleCanView, needsFinanceData, displayAccess, moduleAccessLevel, type AccessLevel } from './auth';
import { fetchAllRows, matchCustomer, resolveInvoiceCustomer, invoiceBelongsToCustomer, isLegacyCrcInvoice, isCrcTahsilatDoc, isCrcSalesInvoiceDoc, retitleInvoiceCustomer, findCrcCustomer, findMigrosCustomer, findAtifCustomer, findIdealTarimCustomer, eylulMisfiledOwner, isCustomerMoneyInvoice, extractSalesInvoiceKeys, type Customer } from './db';
import {
  normalizeContractorKey,
  extractContractorName,
  extractAdvanceContractorName,
  contractorRecordsMatch
} from './contractorIdentity';
import {
  amountsClose,
  paymentLooksFull,
  termPayLabel,
  payTermFromDesc,
  isAnonymousBankPay,
  isExplodedInvoiceTermPay,
  inSeptPayWave,
  normalizeSeptWavePays,
  collapsePaysWithPersonBankLumps
} from './contractorPays';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import html2canvas from 'html2canvas';
import { COMPANY_IDENTITY } from './companyIdentity';
import {
  RENTAL_WORK_GROUPS,
  rentalAdminGraceUntilMonth,
  rentalAdminCanEditMonth,
  rentalRosterSyncOpen,
  rentalSettlementRowEmpty,
  rentalPlateKey,
  buildRentalFleetRoster,
  rentalRowLockedForUser,
  rentalListeFromWorkbook,
  rentalGroupMeta,
  inferRentalWorkGroup,
  rentalRowGroup,
  rentalMonthlyRent,
  rentalSettlementTotals,
  rentalFisFileName
} from './rentalMath';
import FleetPage from './FleetPage';
import AracFilosuPage from './AracFilosuPage';
import HalSahaPage from './HalSahaPage';
import PortalInput from './PortalInput';
import PortalMenu from './PortalMenu';
import PortalPeriodMenu from './PortalPeriodMenu';
import HalSahaReportPage from './HalSahaReportPage';
import { buildHalCari, halHandoverBookDate, isHalMerkezTahsil } from './halSaha';
import TripSettlementsPage from './TripSettlementsPage';
import DisAlimPage from './DisAlimPage';
import { alkanFiloPlateKeys, filoVisibleDepots, filoWorkDepots, mergeFiloDepots, plateKey as filoPlateKey, type FiloDepotId } from './tripFilo';
import { SortTh, sortByColumn, type ColumnSort } from './columnSort';
import { formatMoneyTR, formatNumTR, moneyInputValue, roundMoney } from './money';
import { writeExcelAoa, excelKeepNumber } from './excelOut';
import { inferVehicleChargeKind, stripVehicleChargeTags, vehicleChargeTag, type VehicleChargeKind } from './vehicleCharge';
import MonthlyViewPage from './MonthlyViewPage';

// KURUMSAL TAZEYOL LOGO + ERP BİLEŞENİ
function PortalTechFooter() {
  return (
    <footer className="bg-slate-50 border-t border-slate-200 px-4 py-6 text-center">
      <p className="text-xs text-slate-400">© 2024 <span className="font-semibold text-slate-500">Flee Aero</span>. Tüm hakları saklıdır.</p>
      <p className="text-[11px] text-slate-300 mt-1">Powered by Flee Aero Technology</p>
    </footer>
  );
}

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  office_expense: 'Ofis & Kırtasiye',
  rent_utility: 'Kira, elektrik, su, doğalgaz',
  software_telecom: 'Yazılım, bilişim & araç takip',
  advocate_consulting: 'Avukat / hukuk & danışmanlık',
  cargo_stationery: 'Kargo, noter & resmi evrak',
  hamaliye_labor: 'Hamaliye / Harcırah / İşçilik',
  general_expense: 'Genel şirket masrafı',
  owner_personal: 'Şirket dışı harcama',
  maintenance: 'Tamir / bakım / servis',
  tires: 'Lastik / yedek parça',
  general_fuel: 'Genel akaryakıt / mazot',
  traffic_fines: 'Trafik cezası',
  insurance_inspection: 'Muayene, sigorta & kasko',
  hgs: 'HGS / OGS',
  taxes_sgk: 'Devlet / vergi / SGK',
  opening_balance: 'Kasa açılış / dengeleme',
  bank_commission: 'Banka masrafı & komisyon',
  supplier_advance: 'Tedarikçi avansı',
  employee_advance_paid: 'Personel avansı'
};

function normalizeExpenseCategory(cat: string) {
  const raw = String(cat || '').trim();
  if (EXPENSE_CATEGORY_LABELS[raw]) return raw;
  const c = raw.toLocaleLowerCase('tr-TR');
  if (['fuel', 'yakit', 'yakıt', 'mazot', 'akaryakit', 'akaryakıt', 'general_fuel'].includes(c)) return 'general_fuel';
  if (['vergi', 'sgk', 'tax', 'taxes', 'mtv', 'vergi_sgk', 'taxes_sgk'].includes(c)) return 'taxes_sgk';
  return '';
}

function expenseCategoryLabel(cat: string) {
  const n = normalizeExpenseCategory(cat) || cat;
  return EXPENSE_CATEGORY_LABELS[n] || 'Gider';
}

function normalizeGiderTitle(no: string) {
  return String(no || '')
    .replace(/^\[KK\]\s*/i, '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('tr-TR');
}

function cleanPlateKey(p: string) {
  return String(p || '').replace(/\s+/g, '').toUpperCase();
}

function isExpensePlateTag(inner: string) {
  const s = cleanPlateKey(inner);
  if (!s || s === 'KK') return false;
  return /[A-Z]/.test(s) && /\d/.test(s) && s.length >= 5;
}

function stripExpensePlateTags(title: string) {
  return stripVehicleChargeTags(
    String(title || '')
      .replace(/^\[KK\]\s*/i, '')
      .replace(/\[[^\]]*\]/g, (m) => (isExpensePlateTag(m.slice(1, -1)) ? ' ' : m))
      .replace(/\s+/g, ' ')
      .replace(/\s*-\s*$/g, '')
      .trim()
  );
}

function lastExpensePlateTag(title: string) {
  const tags = [...String(title || '').matchAll(/\[([^\]]+)\]/g)]
    .map(m => m[1])
    .filter(isExpensePlateTag)
    .map(cleanPlateKey);
  return tags.length ? tags[tags.length - 1] : '';
}

function removeExpensePlateTag(title: string, plate: string) {
  const key = cleanPlateKey(plate);
  const kk = /^\s*\[KK\]/i.test(title);
  let next = String(title || '').replace(/^\[KK\]\s*/i, '');
  next = next.replace(/\[[^\]]*\]/g, (m) => (cleanPlateKey(m.slice(1, -1)) === key ? '' : m));
  next = next.replace(/\s+/g, ' ').trim();
  return kk ? `[KK] ${next}` : next;
}

function dedupeGiderKalemRows(rows: any[], close: (a: number, b: number, t?: number) => boolean) {
  const kept: any[] = [];
  rows.forEach(inv => {
    const cat = normalizeExpenseCategory(inv.category);
    const d = String(inv.issue_date || '').slice(0, 10);
    const amt = Number(inv.total_amount) || 0;
    const title = normalizeGiderTitle(inv.invoice_no);
    const ix = kept.findIndex(k =>
      normalizeExpenseCategory(k.category) === cat &&
      String(k.issue_date || '').slice(0, 10) === d &&
      close(Number(k.total_amount) || 0, amt, 0.51) &&
      normalizeGiderTitle(k.invoice_no) === title
    );
    if (ix < 0) {
      kept.push(inv);
      return;
    }
    if (String(inv.invoice_no || '').length > String(kept[ix].invoice_no || '').length) kept[ix] = inv;
  });
  return kept;
}

function TazeyolBrand() {
  return (
    <div className="flex items-center gap-2.5">
      <img 
        src="/logo.png" 
        alt="Tazeyol" 
        className="h-12 max-h-12 w-auto object-contain drop-shadow-xs" 
      />
      <span className="bg-[#009fe3] text-white text-[11px] font-black tracking-widest px-2 py-0.5 rounded-md uppercase shadow-sm">
        ERP
      </span>
    </div>
  );
}

function turkishMonthName(dateStr: string) {
  const m = Number(String(dateStr || '').slice(5, 7));
  return ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'][m - 1] || '';
}

function pad2(n: number) {
  return n < 10 ? '0' + n : String(n);
}

function shiftYearMonth(year: number, month: number, add: number) {
  const d = new Date(year, month - 1 + add, 1);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

function clampIsoDate(iso: string) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso || '');
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12) return `${m[1]}-${m[2]}-${m[3]}`;
  const last = new Date(y, mo, 0).getDate();
  const day = Math.min(Math.max(d, 1), last);
  return `${m[1]}-${m[2]}-${String(day).padStart(2, '0')}`;
}

function addYearMonth(ym: string, add: number) {
  const [y, m] = String(ym || '').split('-').map(Number);
  if (!y || !m) return '';
  const s = shiftYearMonth(y, m, add);
  return `${s.y}-${pad2(s.m)}`;
}

function calendarMonthRange(ym: string) {
  const [y, m] = String(ym || '').split('-').map(Number);
  if (!y || !m) return { start: '', end: '', ym: '', label: '' };
  const last = new Date(y, m, 0).getDate();
  return { start: `${ym}-01`, end: `${ym}-${pad2(last)}`, ym, label: '' };
}

/** Seçilen ayın bir önceki takvim ayı: Kasım bakınca Ekim faturaları. */
function invoiceMonthForSelectedPeriod(filterStart: string) {
  const prevYm = addYearMonth(String(filterStart || '').slice(0, 7), -1);
  const range = calendarMonthRange(prevYm);
  return { ...range, label: yearMonthTrLabel(prevYm) };
}

const TR_MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const CASH_BOOK_START = '2026-10-07';
const CASH_BOOK_OPENING = 1020622.64;
/** 7 Ekim sabahı açılış + o günden sonraki kasa giriş/çıkış. */
const CASH_APPLY_AFTER_OPENING = true;

/** Banka ekstre: Ekim parası Eylül faturasına, 3.11 avansı Ekim faturasına. */
const MIGROS_BANK_LOCK_UNTIL = '2026-11-03';
const MIGROS_BANK_TRANSFERS: { date: string; amount: number; label: string }[] = [
  { date: '2026-10-06', amount: 9764000, label: 'Eylül 2026 avans' },
  { date: '2026-10-20', amount: 13205597.05, label: 'Eylül fatura ödemesi' },
  { date: '2026-10-23', amount: 1323456.87, label: 'Eylül kapanış' },
  { date: '2026-11-03', amount: 10100000, label: 'Ekim 2026 avans' }
];

function isMainMigrosName(name: string) {
  const n = String(name || '').toLocaleUpperCase('tr-TR');
  if (/DI[ŞS] ALIM/.test(n)) return false;
  return n.includes('MIGROS') || n.includes('MİGROS');
}

function isAtifAltunisikName(name: string) {
  const n = String(name || '').toLocaleUpperCase('tr-TR').replace(/İ/g, 'I');
  return n.includes('ATIF') && n.includes('ALTUN');
}

const MIGROS_EYLUL_BANK_TOTAL = Math.round(
  MIGROS_BANK_TRANSFERS.filter(t => t.date.startsWith('2026-10')).reduce((s, t) => s + t.amount, 0) * 100
) / 100;

function isAppBankReceiptTitle(no: string) {
  const s = String(no || '');
  if (/^\s*THS\s*-.+\s-\s\d{12,}\s*$/i.test(s)) return true;
  if (/^\s*THS\s*-\s*(CARI-|AVANS-)/i.test(s)) return true;
  return false;
}

/** Fatura no gömülü THS (EF/EA/GIB) = kapama, kasa parası değil. */
function isInvoiceLinkedReceiptTitle(no: string) {
  const s = String(no || '').toUpperCase().replace(/\s+/g, '');
  return /(?:THS-)*(?:EA|EF|GIB)\d{8,}/.test(s);
}

function isEArchiveNoiseTitle(no: string) {
  if (isAppBankReceiptTitle(no)) return false;
  return /(?:THS\s*-\s*)?EA\d{10,}/i.test(String(no || ''));
}

function yearMonthTrLabel(ym: string) {
  const [y, m] = String(ym || '').split('-').map(Number);
  if (!y || !m) return ym || '';
  return `${TR_MONTH_NAMES[m - 1]} ${y}`;
}

const PLATE_VEHICLE_TYPES = ['Çekici', 'Dorse', 'Kamyon', 'Kamyonet'] as const;

function normalizePlateVehicleType(raw: any) {
  const s = String(raw || '').trim().toLocaleLowerCase('tr-TR');
  if (s.includes('dorse')) return 'Dorse';
  if (s.includes('kamyonet')) return 'Kamyonet';
  if (s.includes('kamyon')) return 'Kamyon';
  if (s.includes('cekici') || s.includes('çekici')) return 'Çekici';
  return '';
}

function stripPlateTypeTag(notes: any) {
  return String(notes || '').replace(/^\[(Çekici|Dorse|Kamyon|Kamyonet)\]\s*/i, '').trim();
}

function plateVehicleTypeOf(row: any) {
  return normalizePlateVehicleType(row?.vehicle_type)
    || normalizePlateVehicleType((String(row?.notes || '').match(/^\[([^\]]+)\]/) || [])[1])
    || '';
}

function excelCol(row: any, names: string[]) {
  const keys = Object.keys(row || {});
  for (const name of names) {
    const hit = keys.find(k => String(k).trim().toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'));
    if (hit !== undefined && row[hit] !== undefined && String(row[hit]).trim() !== '') return row[hit];
  }
  return '';
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

function excelColFuzzy(row: any, needles: string[]) {
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

function parseLocaleNumber(val: any): number {
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
  return isNaN(n) ? 0 : roundMoney(n);
}

function excelColExact(row: any, names: string[]) {
  const keys = Object.keys(row || {});
  for (const name of names) {
    const n = foldHeader(name);
    const hit = keys.find(k => foldHeader(k) === n);
    if (hit !== undefined && row[hit] !== undefined && String(row[hit]).trim() !== '') return row[hit];
  }
  return '';
}

function escHtml(s: any) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function moneyHtml(n: any) {
  return formatMoneyTR(n);
}

function rentalFisMarkup(row: any) {
  const t = row?.totals || rentalSettlementTotals(row);
  const co = COMPANY_IDENTITY;
  const lines: [string, string][] = [
    ['Fatura kesen / alt yüklenici', String(row?.contractor_name || '—')],
    ['Bölge / il', String(row?.province || row?.region || '—')],
    ['Dönem', String(row?.year_month || '—')],
    ['Plaka', String(row?.plate || '—')],
    ['Kira', moneyHtml(row?.rent_amount)],
    ['Yakıt oranı / birim', `${Number(row?.fuel_rate) || 0}  ·  ${moneyHtml(row?.fuel_unit_price)}`],
    ['KM / gün / uğrama-nokta', `${(Number(row?.total_km) || 0).toLocaleString('tr-TR')}  ·  ${Number(row?.work_days) || 0}  ·  ${Number(row?.stop_count) || 0}`],
    ['Yakıt geliri', moneyHtml(t.fuelIncome)],
    ['Uğrama', moneyHtml(row?.visit_prime)],
    ['Ek', moneyHtml(row?.extra_work)],
    ['HGS', moneyHtml(row?.hgs)],
    ['Yakıt kesintisi', moneyHtml(row?.fuel_charge)],
    ['Brüt hakediş', moneyHtml(t.brut)],
    ['KDV %20', moneyHtml(t.kdv)],
    ['Tevkifat 2/10', moneyHtml(t.stoppage)]
  ];
  const zebra = lines.map(([k, v], i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f1f5f9'}">
      <td style="padding:8px 12px;color:#64748b;font-size:11px;border-bottom:1px solid #e2e8f0">${escHtml(k)}</td>
      <td style="padding:8px 12px;text-align:right;font-weight:700;font-size:11px;border-bottom:1px solid #e2e8f0">${escHtml(v)}</td>
    </tr>`).join('');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const tazeyolSrc = `${origin}${co.tazeyolLogo}`;
  const alkanSrc = `${origin}${co.alkanLogo}`;
  return `
  <div style="width:794px;min-height:1123px;padding:28px 40px;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#ffffff">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:24px;border-bottom:2px solid #009fe3;padding-bottom:14px">
      <img src="${tazeyolSrc}" alt="Tazeyol" style="height:52px;max-width:260px;object-fit:contain" />
      <img src="${alkanSrc}" alt="Alkan Nakliyat" style="height:52px;max-width:260px;object-fit:contain" />
    </div>
    <div style="margin-top:8px;font-size:10px;color:#475569">${escHtml(co.tagline)}</div>
    <div style="text-align:center;margin:20px 0 14px">
      <div style="font-size:11px;font-weight:900;letter-spacing:2.5px;color:#009fe3">ARAÇ MUTABAKAT RAPORU</div>
      <div style="font-size:18px;font-weight:800;margin-top:6px">${escHtml(row?.year_month || '')} · ${escHtml(row?.plate || '')}</div>
    </div>
    <table style="width:100%;border-collapse:collapse">${zebra}</table>
    <div style="margin-top:14px;background:#0f2744;color:#ffffff;padding:16px 18px">
      <div style="font-size:9px;letter-spacing:2px;opacity:.75">ÖDENECEK MUTABAKAT</div>
      <div style="font-size:24px;font-weight:900;margin-top:2px">${escHtml(moneyHtml(t.payable))}</div>
      <div style="font-size:11px;margin-top:6px;opacity:.9">1. ödeme ${escHtml(moneyHtml(t.term1))} &nbsp;·&nbsp; 2. ödeme ${escHtml(moneyHtml(t.term2))}</div>
    </div>
    <div style="margin-top:36px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:9px;color:#64748b;line-height:1.55">
      <div style="font-weight:800;color:#0f2744;font-size:10px">${escHtml(co.legalName)}</div>
      ${escHtml(co.address)}<br/>
      ${escHtml(co.district)} · ${escHtml(co.phone)}<br/>
      Bu fiş bilgi içindir; fatura ve cari bu fişten yazılmaz.
    </div>
  </div>`;
}

async function htmlNodeToPdfBlob(html: string, orientation: 'portrait' | 'landscape' = 'portrait') {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:-14000px;top:0;z-index:-1;';
  wrap.innerHTML = html;
  document.body.appendChild(wrap);
  const node = wrap.firstElementChild as HTMLElement;
  await Promise.all(Array.from(wrap.querySelectorAll('img')).map((img) => (img as HTMLImageElement).decode().catch(() => null)));
  const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  wrap.remove();
  const pageW = orientation === 'landscape' ? 297 : 210;
  const pageH = orientation === 'landscape' ? 210 : 297;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation });
  const imgW = pageW;
  const imgH = (canvas.height * pageW) / canvas.width;
  const img = canvas.toDataURL('image/png');
  let y = 0;
  let first = true;
  while (y < imgH - 0.5) {
    if (!first) doc.addPage();
    first = false;
    doc.addImage(img, 'PNG', 0, -y, imgW, imgH);
    y += pageH;
  }
  return doc.output('blob');
}

async function buildRentalFisPdf(row: any) {
  return htmlNodeToPdfBlob(rentalFisMarkup(row), 'portrait');
}

function profitabilityPdfMarkup(opts: {
  month: string;
  monthLabel: string;
  rows: any[];
  totalRev: number;
  totalCost: number;
  totalNet: number;
  marginPct: number | null;
}) {
  const co = COMPANY_IDENTITY;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const money = (n: number) => `${(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
  const moneyNum = (n: number) => (n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const originUrl = origin;
  const rowsHtml = opts.rows.map((item, i) => {
    const faded = item.included ? '#0f172a' : '#94a3b8';
    const net = item.netProfit >= 0 ? '#059669' : '#e11d48';
    const bg = i % 2 ? '#f8fafc' : '#ffffff';
    return `<tr style="background:${bg};color:${faded}">
      <td style="padding:7px 8px;text-align:center">${item.included ? '✓' : ''}</td>
      <td style="padding:7px 8px">${escHtml(item.vehicleType || '')}</td>
      <td style="padding:7px 8px;font-weight:800;font-family:Consolas,monospace">${escHtml(item.plate_number || '')}</td>
      <td style="padding:7px 8px">${escHtml(item.driver_name || 'Atanmadı')}</td>
      <td style="padding:7px 8px;text-align:right;font-weight:700">${escHtml(moneyNum(item.invoice_rev))}</td>
      <td style="padding:7px 8px;text-align:right">${escHtml(moneyNum(item.fuel))}</td>
      <td style="padding:7px 8px;text-align:right">${escHtml(moneyNum(item.hgs))}</td>
      <td style="padding:7px 8px;text-align:right">${escHtml(moneyNum(item.payroll))}</td>
      <td style="padding:7px 8px;text-align:right">${escHtml(moneyNum(item.sgk))}</td>
      <td style="padding:7px 8px;text-align:right">${escHtml(moneyNum(item.fixed_monthly))}</td>
      <td style="padding:7px 8px;text-align:right">${escHtml(moneyNum(item.bakim))}</td>
      <td style="padding:7px 8px;text-align:right;font-weight:900;color:${item.included ? net : faded}">${escHtml(money(item.netProfit))}</td>
    </tr>`;
  }).join('');
  const marginTxt = opts.marginPct == null ? '—' : `%${opts.marginPct.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  return `
  <div style="width:1400px;padding:28px 32px 36px;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#ffffff">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:24px;border-bottom:2px solid #009fe3;padding-bottom:12px">
      <img src="${originUrl}${co.tazeyolLogo}" alt="Tazeyol" style="height:48px;object-fit:contain" />
      <div style="text-align:center">
        <div style="font-size:11px;font-weight:900;letter-spacing:2px;color:#009fe3">ÖZ MAL ARAÇ KARLILIK</div>
        <div style="font-size:20px;font-weight:800;margin-top:4px">${escHtml(opts.monthLabel)}</div>
      </div>
      <img src="${originUrl}${co.alkanLogo}" alt="Alkan Nakliyat" style="height:48px;object-fit:contain" />
    </div>
    <div style="display:flex;gap:12px;margin:18px 0 16px">
      <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px">
        <div style="font-size:10px;font-weight:800;color:#64748b;letter-spacing:.6px">TOPLAM CİRO</div>
        <div style="font-size:22px;font-weight:900">${escHtml(money(opts.totalRev))}</div>
      </div>
      <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px">
        <div style="font-size:10px;font-weight:800;color:#64748b;letter-spacing:.6px">TOPLAM GİDER</div>
        <div style="font-size:22px;font-weight:900;color:#e11d48">${escHtml(money(opts.totalCost))}</div>
      </div>
      <div style="flex:1;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:12px 14px">
        <div style="font-size:10px;font-weight:800;color:#1e40af;letter-spacing:.6px">NET KÂR / ZARAR</div>
        <div style="font-size:22px;font-weight:900;color:${opts.totalNet >= 0 ? '#059669' : '#e11d48'}">${escHtml(money(opts.totalNet))}</div>
      </div>
      <div style="flex:1;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:12px 14px">
        <div style="font-size:10px;font-weight:800;color:#065f46;letter-spacing:.6px">KARLILIK ORANI</div>
        <div style="font-size:22px;font-weight:900">${escHtml(marginTxt)}</div>
        <div style="font-size:9px;color:#64748b">Net kâr ÷ ciro (dahil araçlar)</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead>
        <tr style="background:#f1f5f9;color:#475569;text-align:left">
          <th style="padding:8px;font-size:9px">BU AY</th>
          <th style="padding:8px;font-size:9px">TİP</th>
          <th style="padding:8px;font-size:9px">PLAKA</th>
          <th style="padding:8px;font-size:9px">ŞOFÖR</th>
          <th style="padding:8px;font-size:9px;text-align:right">CİRO (ELLE)</th>
          <th style="padding:8px;font-size:9px;text-align:right">YAKIT (ELLE)</th>
          <th style="padding:8px;font-size:9px;text-align:right">HGS (ELLE)</th>
          <th style="padding:8px;font-size:9px;text-align:right">MAAŞ + PRİM</th>
          <th style="padding:8px;font-size:9px;text-align:right">SGK</th>
          <th style="padding:8px;font-size:9px;text-align:right">SABİT / AY</th>
          <th style="padding:8px;font-size:9px;text-align:right">BAKIM / AY</th>
          <th style="padding:8px;font-size:9px;text-align:right">NET KÂR</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div style="margin-top:28px;display:flex;justify-content:space-between;gap:40px;font-size:11px;color:#334155">
      <div style="flex:1">
        <div style="border-top:1px solid #94a3b8;padding-top:8px;margin-top:36px">Hazırlayan</div>
      </div>
      <div style="flex:1">
        <div style="border-top:1px solid #94a3b8;padding-top:8px;margin-top:36px">Kontrol / imza</div>
      </div>
    </div>
    <div style="margin-top:18px;font-size:9px;color:#94a3b8;line-height:1.45">
      ${escHtml(co.legalName)} · ${escHtml(co.address)} · ${escHtml(co.phone)}<br/>
      Listede Aktif öz mal kamyonet, kamyon ve TIR. “Bu ay” işareti olmayanlar toplama girmez. Arşiv çıktısı ${escHtml(opts.month)}.
    </div>
  </div>`;
}

function dismissIfBackdrop(e: React.MouseEvent, close: () => void) {
  if (e.target === e.currentTarget) close();
}

function exportAoaExcel(rows: any[][], fileName: string, sheetName: string) {
  writeExcelAoa(rows, fileName, sheetName);
}

function incomeReportPdfMarkup(opts: {
  rangeLabel: string;
  girdi: number;
  cikti: number;
  net: number;
  inLines: { date: string; title: string; amount: number }[];
  outLines: { date: string; title: string; amount: number }[];
}) {
  const co = COMPANY_IDENTITY;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const money = (n: number) => `${(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
  const rowHtml = (lines: { date: string; title: string; amount: number }[], color: string) =>
    lines.map((l, i) => `<tr style="background:${i % 2 ? '#f8fafc' : '#ffffff'}">
      <td style="padding:6px 8px;font-size:11px">${escHtml(l.date)}</td>
      <td style="padding:6px 8px;font-size:11px">${escHtml(l.title)}</td>
      <td style="padding:6px 8px;font-size:11px;text-align:right;font-weight:800;color:${color}">${escHtml(money(l.amount))}</td>
    </tr>`).join('');
  return `
  <div style="width:1100px;padding:28px 32px 36px;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#ffffff">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:24px;border-bottom:2px solid #009fe3;padding-bottom:12px">
      <img src="${origin}${co.tazeyolLogo}" alt="Tazeyol" style="height:48px;object-fit:contain" />
      <div style="text-align:center">
        <div style="font-size:11px;font-weight:900;letter-spacing:2px;color:#009fe3">GENEL GELİR GİDER</div>
        <div style="font-size:18px;font-weight:800;margin-top:4px">${escHtml(opts.rangeLabel)}</div>
      </div>
      <img src="${origin}${co.alkanLogo}" alt="Alkan Nakliyat" style="height:48px;object-fit:contain" />
    </div>
    <div style="display:flex;gap:12px;margin:18px 0 16px">
      <div style="flex:1;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:12px 14px">
        <div style="font-size:10px;font-weight:800;color:#065f46">GİRDİ</div>
        <div style="font-size:22px;font-weight:900;color:#059669">${escHtml(money(opts.girdi))}</div>
      </div>
      <div style="flex:1;background:#fff1f2;border:1px solid #fecdd3;border-radius:12px;padding:12px 14px">
        <div style="font-size:10px;font-weight:800;color:#9f1239">ÇIKTI</div>
        <div style="font-size:22px;font-weight:900;color:#e11d48">${escHtml(money(opts.cikti))}</div>
      </div>
      <div style="flex:1;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:12px 14px">
        <div style="font-size:10px;font-weight:800;color:#1e40af">NET</div>
        <div style="font-size:22px;font-weight:900;color:${opts.net >= 0 ? '#059669' : '#e11d48'}">${escHtml(money(opts.net))}</div>
      </div>
    </div>
    <div style="font-size:12px;font-weight:800;margin:8px 0 6px">Gelirler</div>
    <table style="width:100%;border-collapse:collapse">${rowHtml(opts.inLines, '#059669')}</table>
    <div style="font-size:12px;font-weight:800;margin:16px 0 6px">Giderler</div>
    <table style="width:100%;border-collapse:collapse">${rowHtml(opts.outLines, '#e11d48')}</table>
    <div style="margin-top:22px;font-size:9px;color:#94a3b8;line-height:1.45">
      ${escHtml(co.legalName)} · Ana sayfa Girdi−Çıktı ile aynı kasa motoru. Excel/EA tahsilat kopyası yok.
    </div>
  </div>`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function daysUntilDate(dateStr: string) {
  let d = String(dateStr || '').trim();
  if (!d) return null;
  if (d.includes('T')) d = d.split('T')[0];
  if (d.includes('.')) {
    const parts = d.split('.');
    if (parts.length === 3 && parts[2].length === 4) {
      d = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  d = d.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const [y, m, day] = d.split('-').map(Number);
  const now = new Date();
  const utcToday = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const utcThen = Date.UTC(y, m - 1, day);
  return Math.round((utcThen - utcToday) / 86400000);
}

function lastDateOfMonth(year: number, month: number) {
  const day = new Date(year, month, 0).getDate();
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function defaultContractorTermDates(issueDate: string) {
  const d = String(issueDate || '').slice(0, 10);
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(5, 7));
  if (!y || !m) return { term1: '', term2: '' };
  if (d.startsWith('2026-09')) return { term1: '2026-10-26', term2: '2026-11-05' };
  const n1 = shiftYearMonth(y, m, 1);
  const n2 = shiftYearMonth(y, m, 2);
  return { term1: lastDateOfMonth(n1.y, n1.m), term2: `${n2.y}-${pad2(n2.m)}-05` };
}

function contractorTermPayDate(issueDate: string, term: 'term1' | 'term2', fallback: string) {
  const d = String(issueDate || '').slice(0, 10);
  if (d.startsWith('2026-09')) return term === 'term1' ? '2026-10-26' : '2026-11-05';
  const dates = defaultContractorTermDates(d);
  return (term === 'term1' ? dates.term1 : dates.term2) || fallback;
}

function isBulkHakedisPaymentDesc(desc: string) {
  return /hakedi[sş]\s*ödem|1\.\s*vade|2\.\s*vade|1 nci ödeme|2 nci ödeme/i.test(String(desc || ''));
}

function foldPersonName(s: string) {
  return String(s || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, ' ')
    .trim();
}

function salaryPayrollMatchesEmployee(inv: any, emp: any) {
  if (String(inv?.category || '') !== 'salary_payroll') return false;
  const no = String(inv?.invoice_no || '');
  const id = String(emp?.id || '');
  if (id && new RegExp(`(?:#|\\(#)${id}\\b`).test(no)) return true;
  const empNorm = foldPersonName(emp?.full_name);
  const hay = foldPersonName(no);
  return !!empNorm && empNorm.length >= 3 && hay.includes(empNorm);
}

async function readPortalUserFnError(error: any, data: any, fallback: string) {
  let msg = data?.error || error?.message || fallback;
  try {
    const ctx = error?.context;
    if (ctx && typeof ctx.json === 'function') {
      const j = await ctx.json();
      if (j?.error) msg = j.error;
    }
  } catch { /* ignore */ }
  return String(msg);
}

function isPortalUserFnMissing(msg: string) {
  return /not found|404|Failed to send|FunctionsRelayError|function not found/i.test(msg);
}

export default function App() {
  const [navPending, startNav] = useTransition();
  // 1. KULLANICI GİRİŞ & YETKİLENDİRME (RBAC)
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'reporter' | 'saha' | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [portalUsers, setPortalUsers] = useState<any[]>([]);
  const [portalUsersError, setPortalUsersError] = useState('');
  const [portalUsersBusy, setPortalUsersBusy] = useState(false);
  const [newPortalUser, setNewPortalUser] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'saha' as 'admin' | 'reporter' | 'saha',
    rental_work_group: ''
  });
  const [newPortalUserBusy, setNewPortalUserBusy] = useState(false);
  const [newPortalUserOpen, setNewPortalUserOpen] = useState(false);
  const [newPortalUserHint, setNewPortalUserHint] = useState('');
  const [userDrafts, setUserDrafts] = useState<Record<string, {
    email: string;
    full_name: string;
    role: 'admin' | 'reporter' | 'saha';
    is_active: boolean;
    groups: string[];
    filoDepots: string[];
    access: Record<string, AccessLevel>;
  }>>({});
  const [userSaveBusyId, setUserSaveBusyId] = useState<string | null>(null);
  const [userSaveOkId, setUserSaveOkId] = useState<string | null>(null);
  const [resetPwById, setResetPwById] = useState<Record<string, string>>({});
  const [resetPwBusyId, setResetPwBusyId] = useState<string | null>(null);
  const [resetPwOkId, setResetPwOkId] = useState<string | null>(null);
  const [rentalAssignedGroup, setRentalAssignedGroup] = useState<string | null>(null);
  const [rentalAssignedGroups, setRentalAssignedGroups] = useState<string[]>([]);
  const [filoAssignedDepots, setFiloAssignedDepots] = useState<string[]>([]);
  const [filoDepot, setFiloDepot] = useState<FiloDepotId>('omerli');
  const [portalAccess, setPortalAccess] = useState<Record<string, AccessLevel>>({});
  const [authReady, setAuthReady] = useState(false);
  const isAuthenticated = !!currentUserRole;

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const applySession = async (userId: string | undefined) => {
      if (!userId) {
        if (!cancelled) {
          setCurrentUserRole(null);
          setCurrentUserId(null);
        }
        return;
      }
      const profile = await fetchProfile(userId);
      if (cancelled) return;
      if (!profile) {
        await supabase.auth.signOut();
        setCurrentUserRole(null);
        setCurrentUserId(null);
        setRentalAssignedGroup(null);
        setRentalAssignedGroups([]);
        setFiloAssignedDepots([]);
        setPortalAccess({});
        return;
      }
      if (profile.is_active === false) {
        await supabase.auth.signOut();
        setCurrentUserRole(null);
        setCurrentUserId(null);
        setRentalAssignedGroups([]);
        setFiloAssignedDepots([]);
        setPortalAccess({});
        return;
      }
      setCurrentUserRole(profile.role);
      setCurrentUserId(userId);
      setRentalAssignedGroup(profile.rental_work_groups[0] || profile.rental_work_group);
      setRentalAssignedGroups(profile.rental_work_groups);
      setFiloAssignedDepots(profile.filo_depots || []);
      setPortalAccess(profile.portal_access);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session?.user.id).finally(() => {
        if (!cancelled) setAuthReady(true);
      });
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session?.user.id);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
      setLoginError('');
    setLoginBusy(true);
    try {
      const email = loginUsername.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: loginPassword,
      });
      if (error || !data.user) {
        const msg = (error?.message || '').toLowerCase();
        if (msg.includes('email not confirmed')) {
          setLoginError('E-posta henüz onaylanmamış. Supabase → Authentication → Users içinde kullanıcıya tıklayıp onaylayın (Confirm / Auto Confirm).');
        } else if (msg.includes('invalid login')) {
          setLoginError('E-posta veya şifre eşleşmedi. Users listesindeki tam e-postayı yazın; şifreyi Users ekranından sıfırlayabilirsiniz.');
    } else {
          setLoginError(error?.message || 'Hatalı e-posta veya şifre girdiniz!');
        }
        return;
      }
      const profile = await fetchProfile(data.user.id);
      if (!profile) {
        await supabase.auth.signOut();
        setLoginError('Hesabınıza rol atanmamış. Supabase profiles kaydını kontrol edin.');
        return;
      }
      if (profile.is_active === false) {
        await supabase.auth.signOut();
        setLoginError('Bu hesap pasif. Yönetici Kullanıcılar ekranından aktif etmeli.');
        return;
      }
      localStorage.removeItem('tazeyol_user_role');
      setCurrentUserRole(profile.role);
      setCurrentUserId(data.user.id);
      setRentalAssignedGroup(profile.rental_work_groups[0] || profile.rental_work_group);
      setRentalAssignedGroups(profile.rental_work_groups);
      setFiloAssignedDepots(profile.filo_depots || []);
      setPortalAccess(profile.portal_access);
    } catch {
      setLoginError('Giriş sırasında bir hata oluştu.');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('tazeyol_user_role');
    await supabase.auth.signOut();
    setCurrentUserRole(null);
    setCurrentUserId(null);
    setRentalAssignedGroup(null);
    setRentalAssignedGroups([]);
    setPortalAccess({});
    setPortalDataReady(false);
    setLoading(true);
  };

  const loadPortalUsers = async () => {
    if (currentUserRole !== 'admin') return;
    setPortalUsersBusy(true);
    setPortalUsersError('');
    const { data, error } = await supabase.rpc('list_portal_users');
    setPortalUsersBusy(false);
    if (error) {
      setPortalUsers([]);
      setPortalUsersError('Kullanıcı listesi yok. supabase/setup_users.sql dosyasını SQL Editor’da bir kez Run edin.');
      return;
    }
    let rows = (data || []) as any[];
    if (rows.length) {
      const { data: extras } = await supabase
        .from('profiles')
        .select('id, portal_access, rental_work_groups, rental_work_group, filo_depots, role, full_name, is_active');
      const byId = Object.fromEntries((extras || []).map((p: any) => [p.id, p]));
      rows = rows.map((u: any) => {
        const p = byId[u.id];
        return p ? { ...u, ...p, email: u.email } : u;
      });
    }
    setPortalUsers(rows);
  };

  const handleSavePortalUser = async (user: any, patch: {
    email?: string;
    full_name?: string;
    role?: 'admin' | 'reporter' | 'saha';
    is_active?: boolean;
    rental_work_groups?: string[];
    filo_depots?: string[];
    portal_access?: Record<string, AccessLevel>;
  }) => {
    if (currentUserRole !== 'admin') return false;
    const nextRole = patch.role ?? user.role;
    const nextGroups = normalizeGroups(
      patch.rental_work_groups !== undefined ? patch.rental_work_groups : (user.rental_work_groups || user.rental_work_group)
    );
    const nextAccess = patch.portal_access !== undefined
      ? normalizeAccess(patch.portal_access)
      : normalizeAccess(user.portal_access);
    const nextFilo = normalizeGroups(
      patch.filo_depots !== undefined ? patch.filo_depots : (user.filo_depots || [])
    );
    if (nextRole === 'saha' && nextAccess.rental_settlements && !nextGroups.length) {
      alert('Kiralık mutabakat yetkisi varsa en az bir grup işaretleyin. İzin döneminde birden fazla grup açabilirsiniz.');
      return false;
    }
    if (nextRole === 'saha' && nextAccess.trip_settlements && !nextFilo.length) {
      alert('Filo yetkisi varsa en az bir depo işaretleyin. Ortak tablo otomatik görünür.');
      return false;
    }
    if (user.id === currentUserId && nextRole !== 'admin') {
      const otherAdmins = portalUsers.filter((u: any) => u.role === 'admin' && u.id !== user.id);
      if (!otherAdmins.length) {
        alert('Son yönetici rolü kaldırılamaz.');
        return false;
      }
    }
    const nextActive = patch.is_active !== undefined ? patch.is_active !== false : user.is_active !== false;
    if (!nextActive) {
      if (user.id === currentUserId) {
        alert('Kendi hesabınızı pasif yapamazsınız.');
        return false;
      }
      if (nextRole === 'admin' || user.role === 'admin') {
        const otherAdmins = portalUsers.filter((u: any) => u.role === 'admin' && u.is_active !== false && u.id !== user.id);
        if (!otherAdmins.length) {
          alert('Son aktif yönetici pasif yapılamaz.');
          return false;
        }
      }
    }
    const nextEmail = String(patch.email !== undefined ? patch.email : (user.email || '')).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      alert('Geçerli e-posta yazın.');
      return false;
    }
    const { error: loginErr } = await supabase.rpc('admin_update_portal_login', {
      p_user_id: user.id,
      p_email: nextEmail,
      p_is_active: nextActive
    });
    if (loginErr) {
      alert(
        /admin_update_portal_login|does not exist|schema cache/i.test(loginErr.message || '')
          ? 'E-posta ve aktif/pasif için setup_portal_user_manage.sql dosyasını SQL Editor’da bir kez Run edin.'
          : loginErr.message
      );
      return false;
    }
    const payload: any = {
      full_name: patch.full_name !== undefined ? patch.full_name : user.full_name,
      role: nextRole,
      is_active: nextActive,
      rental_work_groups: nextRole === 'saha' && nextAccess.rental_settlements ? nextGroups : [],
      rental_work_group: nextRole === 'saha' && nextAccess.rental_settlements ? (nextGroups[0] || null) : null,
      filo_depots: nextRole === 'saha' && nextAccess.trip_settlements ? nextFilo : [],
      portal_access: nextRole === 'saha' ? nextAccess : {}
    };
    const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
    if (error) {
      alert('Kullanıcı kaydedilemedi: ' + (error.message || '') + ( /portal_access|rental_work_groups|filo_depots/i.test(error.message || '') ? ' setup_trip_settlements.sql dosyasını bir kez Run edin.' : ''));
      return false;
    }
    setPortalUsers(prev => prev.map((u: any) => u.id === user.id ? { ...u, ...payload, email: nextEmail } : u));
    if (user.id === currentUserId) {
      setRentalAssignedGroups(payload.rental_work_groups);
      setRentalAssignedGroup(payload.rental_work_group);
      setFiloAssignedDepots(payload.filo_depots || []);
      setPortalAccess(payload.portal_access);
    }
    return true;
  };

  const handleCreatePortalUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUserRole !== 'admin') return;
    const email = newPortalUser.email.trim().toLowerCase();
    if (!email || newPortalUser.password.length < 8) {
      alert('E-posta ve en az 8 karakter şifre gerekli.');
      return;
    }
    // Personel (saha) kiralık grup olmadan da açılır; filo gibi menü yetkisi sonra karttan verilir.
    setNewPortalUserBusy(true);
    const createBody = {
      p_email: email,
      p_password: newPortalUser.password,
      p_full_name: newPortalUser.full_name.trim(),
      p_role: newPortalUser.role,
      p_rental_work_group: newPortalUser.role === 'saha' ? (newPortalUser.rental_work_group || null) : null
    };
    const { error: rpcErr } = await supabase.rpc('admin_create_portal_user', createBody);
    if (!rpcErr) {
      setNewPortalUserBusy(false);
      setNewPortalUserHint('');
      setNewPortalUserOpen(false);
      setNewPortalUser({ email: '', password: '', full_name: '', role: 'saha', rental_work_group: 'magazalar' });
      await loadPortalUsers();
      alert(`${email} açıldı. Bu e-posta ve şifre ile giriş yapabilir.`);
      return;
    }
    const missingRpc = /admin_create_portal_user|does not exist|schema cache/i.test(rpcErr.message || '');
    if (!missingRpc) {
      setNewPortalUserBusy(false);
      alert(rpcErr.message);
      return;
    }
    const { data, error } = await supabase.functions.invoke('create-portal-user', {
      body: {
        action: 'create',
        email,
        password: newPortalUser.password,
        full_name: newPortalUser.full_name.trim(),
        role: newPortalUser.role,
        rental_work_group: newPortalUser.role === 'saha' ? (newPortalUser.rental_work_group || null) : null
      }
    });
    setNewPortalUserBusy(false);
    if (error || data?.error) {
      const msg = await readPortalUserFnError(error, data, 'Kullanıcı açılamadı.');
      if (isPortalUserFnMissing(msg)) {
        setNewPortalUserHint(
          `Portaldan otomatik açma henüz kapalı. setup_portal_user_create.sql dosyasını SQL Editor’da bir kez Run edin, sayfayı yenileyin, tekrar deneyin.`
        );
        alert('Hesap açılamadı. setup_portal_user_create.sql dosyasını SQL Editor’da çalıştırın, sonra bu formdan tekrar deneyin.');
        return;
      }
      alert(msg);
      return;
    }
    setNewPortalUserHint('');
    setNewPortalUserOpen(false);
    setNewPortalUser({ email: '', password: '', full_name: '', role: 'saha', rental_work_group: 'magazalar' });
    await loadPortalUsers();
    alert(`${email} açıldı. Bu e-posta ve şifre ile giriş yapabilir.`);
  };

  const handleResetPortalPassword = async (user: any) => {
    if (currentUserRole !== 'admin') return;
    const password = (resetPwById[user.id] || '').trim();
    if (password.length < 8) {
      alert('Yeni şifre en az 8 karakter olsun.');
      return;
    }
    if (!window.confirm(`${user.email} için şifre değişecek. Bu kişi yeni şifreyle girer. Devam?`)) return;
    setResetPwBusyId(user.id);
    setResetPwOkId(null);
    const { error: rpcErr } = await supabase.rpc('admin_reset_portal_password', {
      p_user_id: user.id,
      p_password: password
    });
    if (!rpcErr) {
      setResetPwBusyId(null);
      setResetPwById(prev => ({ ...prev, [user.id]: '' }));
      setResetPwOkId(user.id);
      return;
    }
    const missingRpc = /admin_reset_portal_password|does not exist|schema cache/i.test(rpcErr.message || '');
    if (!missingRpc) {
      setResetPwBusyId(null);
      alert(rpcErr.message);
      return;
    }
    const { data, error } = await supabase.functions.invoke('create-portal-user', {
      body: { action: 'reset', user_id: user.id, password }
    });
    setResetPwBusyId(null);
    if (error || data?.error) {
      const msg = await readPortalUserFnError(error, data, 'Şifre yazılamadı.');
      if (isPortalUserFnMissing(msg)) {
        alert('Şifre sıfırlama için setup_portal_password.sql dosyasını SQL Editor’da bir kez Run edin. Sonra tekrar deneyin.');
        return;
      }
      alert(msg);
      return;
    }
    setResetPwById(prev => ({ ...prev, [user.id]: '' }));
    setResetPwOkId(user.id);
  };

  const handleSavePlateRental = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditMod('plate_rentals')) return;
    if (!plateRentalForm.plate.trim() || !plateRentalForm.owner_name.trim()) {
      alert('Plaka ve plaka sahibi zorunludur.');
      return;
    }
    const row: any = {
      plate: plateRentalForm.plate.trim().toUpperCase(),
      owner_name: plateRentalForm.owner_name.trim(),
      phone: plateRentalForm.phone.trim() || null,
      start_date: sanitizeDate(plateRentalForm.start_date) || null,
      renewal_date: sanitizeDate(plateRentalForm.renewal_date) || null,
      rent_amount: cleanNumber(plateRentalForm.rent_amount),
      government_fee: cleanNumber(plateRentalForm.government_fee),
      collection_kind: plateRentalForm.collection_kind,
      payment_note: plateRentalForm.payment_note.trim() || null,
      next_amount: plateRentalForm.next_amount === '' ? null : cleanNumber(plateRentalForm.next_amount),
      notes: plateRentalForm.vehicle_type
        ? `[${plateRentalForm.vehicle_type}] ${stripPlateTypeTag(plateRentalForm.notes)}`.trim()
        : (stripPlateTypeTag(plateRentalForm.notes) || null),
      vehicle_type: plateRentalForm.vehicle_type || null
    };
    try {
      const save = (payload: any) =>
        editingPlateRentalId
          ? supabase.from('plate_rentals').update(payload).eq('id', editingPlateRentalId)
          : supabase.from('plate_rentals').insert([payload]);
      let { error } = await save(row);
      if (error && /vehicle_type/i.test(error.message || '')) {
        const { vehicle_type: _drop, ...withoutType } = row;
        const retry = await save(withoutType);
        error = retry.error;
      }
      if (error) throw error;
      setIsPlateRentalModalOpen(false);
      setEditingPlateRentalId(null);
      setPlateRentalForm(emptyPlateRentalForm);
      await loadPortalData();
    } catch (err: any) {
      alert('Plaka kaydı hatası: ' + (err.message || 'setup_plate_rentals.sql dosyasını SQL Editor’da çalıştırın.'));
    }
  };

  const handleDeletePlateRental = async (id: string) => {
    if (!canEditMod('plate_rentals')) return;
    if (!window.confirm('Bu plaka kaydını silmek istiyor musunuz? Kasa ve cariye bağlı değildir.')) return;
    const { error } = await supabase.from('plate_rentals').delete().eq('id', id);
    if (error) {
      alert('Silinemedi: ' + error.message);
      return;
    }
    loadPortalData();
  };

  const findRentalTariff = (province: string, vehicleType: string) => {
    const p = String(province || '').trim().toLocaleLowerCase('tr-TR');
    const t = normalizePlateVehicleType(vehicleType);
    if (!p || !t) return null;
    return (dbRentalTariffs || []).find((row: any) =>
      String(row.province || '').trim().toLocaleLowerCase('tr-TR') === p &&
      normalizePlateVehicleType(row.vehicle_type) === t
    ) || null;
  };

  const applyTariffToSettlementForm = (province: string, vehicleType: string, current = rentalSettlementForm) => {
    const hit = findRentalTariff(province, vehicleType);
    if (!hit) return current;
    return {
      ...current,
      province,
      vehicle_type: (normalizePlateVehicleType(vehicleType) as typeof current.vehicle_type) || current.vehicle_type,
      rent_amount: String(hit.rent_amount ?? current.rent_amount),
      fuel_rate: String(hit.fuel_rate ?? current.fuel_rate)
    };
  };

  const handleSaveRentalSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditMod('rental_settlements')) return;
    if (!rentalSettlementForm.plate.trim() || !rentalSettlementForm.contractor_name.trim() || !rentalSettlementForm.year_month) {
      alert('Dönem, plaka ve fatura kesen zorunludur. Yeni unvanı buraya yazmanız yeter.');
      return;
    }
    const plate = rentalSettlementForm.plate.trim().toUpperCase();
    const month = rentalSettlementForm.year_month;
    const dup = (dbRentalSettlements || []).some((r: any) =>
      r.id !== editingRentalSettlementId &&
      String(r.year_month) === month &&
      rentalRowGroup(r) === rentalWorkGroup &&
      String(r.plate || '').toUpperCase() === plate
    );
    if (dup) {
      alert('Bu plaka bu ay ve grupta zaten var. Plaka değiştirmek için satırı açıp “Plaka / unvan” kullanın.');
      return;
    }
    const payload: any = {
      year_month: month,
      province: rentalSettlementForm.province.trim() || null,
      region: rentalSettlementForm.region.trim() || rentalSettlementForm.province.trim() || null,
      plate,
      contractor_name: rentalSettlementForm.contractor_name.trim(),
      vehicle_type: rentalSettlementForm.vehicle_type || null,
      rent_amount: cleanNumber(rentalSettlementForm.rent_amount),
      fuel_rate: cleanNumber(rentalSettlementForm.fuel_rate),
      fuel_unit_price: 0,
      total_km: 0,
      work_days: 0,
      stop_count: 0,
      visit_prime: 0,
      extra_work: 0,
      hgs: 0,
      fuel_charge: 0,
      notes: rentalSettlementForm.notes.trim() || null,
      work_group: rentalWorkGroup,
      status: 'draft'
    };
    try {
      let { error } = editingRentalSettlementId
        ? await supabase.from('rental_settlements').update(payload).eq('id', editingRentalSettlementId)
        : await supabase.from('rental_settlements').insert([payload]);
      if (error && /work_group|status/i.test(error.message || '')) {
        const { work_group: _g, status: _s, ...rest } = payload;
        const retry = editingRentalSettlementId
          ? await supabase.from('rental_settlements').update(rest).eq('id', editingRentalSettlementId)
          : await supabase.from('rental_settlements').insert([rest]);
        error = retry.error;
      }
      if (error) throw error;
      setIsRentalSettlementModalOpen(false);
      setEditingRentalSettlementId(null);
      setRentalSettlementForm(emptyRentalSettlementForm);
      await loadPortalData();
    } catch (err: any) {
      alert('Kayıt hatası: ' + (err.message || 'Önce setup_rental_settlements.sql çalıştırın.'));
    }
  };

  const handleSaveRentalIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !rentalEditRow) return;
    if (rentalRowLockedForUser(rentalEditRow, currentUserRole)) {
      alert(isAdmin
        ? `Bu ayın düzeltme süresi doldu (${yearMonthTrLabel(rentalAdminGraceUntilMonth(rentalEditRow.year_month))} sonu). Plaka veya unvan değişmez.`
        : 'Bu satır sizin için kilitli.');
      return;
    }
    const plate = rentalSettlementForm.plate.trim().toUpperCase();
    const contractor = rentalSettlementForm.contractor_name.trim();
    if (!plate || !contractor) {
      alert('Plaka ve fatura kesen zorunludur.');
      return;
    }
    const payload: any = {
      plate,
      contractor_name: contractor,
      province: rentalSettlementForm.province.trim() || null,
      region: rentalSettlementForm.region.trim() || rentalSettlementForm.province.trim() || null,
      vehicle_type: rentalSettlementForm.vehicle_type || null,
      rent_amount: cleanNumber(rentalSettlementForm.rent_amount),
      fuel_rate: cleanNumber(rentalSettlementForm.fuel_rate)
    };
    const { error } = await supabase.from('rental_settlements').update(payload).eq('id', rentalEditRow.id);
    if (error) {
      alert('Güncellenemedi: ' + error.message);
      return;
    }
    setDbRentalSettlements(prev => prev.map((r: any) => r.id === rentalEditRow.id ? { ...r, ...payload } : r));
    setRentalEditRow((prev: any) => prev ? { ...prev, ...payload } : prev);
    setIsRentalSettlementModalOpen(false);
  };

  const handleDeleteRentalSettlement = async (id: string) => {
    if (!canEditMod('rental_settlements')) return;
    if (!window.confirm('Bu mutabakat satırı silinsin mi? Fatura ve cariye bağlı değildir.')) return;
    const { error } = await supabase.from('rental_settlements').delete().eq('id', id);
    if (error) {
      alert('Silinemedi: ' + error.message);
      return;
    }
    setRentalEditRow(null);
    loadPortalData();
  };

  const handleSaveRentalTariff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!rentalTariffForm.province.trim() || !rentalTariffForm.vehicle_type) {
      alert('İl ve araç tipi zorunludur.');
      return;
    }
    try {
      const { error } = await supabase.from('rental_settlement_tariffs').insert([{
        province: rentalTariffForm.province.trim(),
        vehicle_type: rentalTariffForm.vehicle_type,
        rent_amount: cleanNumber(rentalTariffForm.rent_amount),
        fuel_rate: cleanNumber(rentalTariffForm.fuel_rate)
      }]);
      if (error) throw error;
      setIsRentalTariffModalOpen(false);
      setRentalTariffForm({ province: '', vehicle_type: '', rent_amount: '', fuel_rate: '' });
      await loadPortalData();
    } catch (err: any) {
      alert('Tarife kaydı hatası: ' + (err.message || 'Önce setup_rental_settlements.sql çalıştırın.'));
    }
  };

  const handleDeleteRentalTariff = async (id: string) => {
    if (!isAdmin) return;
    if (!window.confirm('Bu il / araç tipi tarifesi silinsin mi?')) return;
    const { error } = await supabase.from('rental_settlement_tariffs').delete().eq('id', id);
    if (error) {
      alert('Silinemedi: ' + error.message);
      return;
    }
    loadPortalData();
  };

  const handleImportRentalSettlements = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !isAdmin) return;
    const monthFromName = (name: string) => {
      const n = foldHeader(name);
      const year = n.match(/20(\d{2})/) ? `20${n.match(/20(\d{2})/)![1]}` : '';
      const months = ['ocak','subat','mart','nisan','mayis','haziran','temmuz','agustos','eylul','ekim','kasim','aralik'];
      const mi = months.findIndex(m => n.includes(m));
      if (mi >= 0) return `${year || '2026'}-${String(mi + 1).padStart(2, '0')}`;
      return '';
    };
    try {
      const allRows: any[] = [];
      const debug: string[] = [];
      for (const file of files) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const parsed = rentalListeFromWorkbook(workbook);
        const fallbackMonth = rentalSettlementMonth || monthFromName(file.name) || getPreviousYearMonth();
        debug.push(`${file.name} / ${parsed.sheetName}: ${parsed.headers.filter(Boolean).slice(0, 8).join(', ')}`);
        parsed.rows.forEach((row: any) => {
          const plate = String(excelColFuzzy(row, ['plaka', 'plak']) || '').trim().toUpperCase();
          const contractor = String(excelColFuzzy(row, ['fatura kesen', 'yuklenici', 'yuklen', 'alt yuklenici']) || '').trim();
          if (!plate || !contractor) return;
          if (!/[A-Z0-9]{5,}/.test(plate.replace(/\s/g, ''))) return;
          if (/genel toplam|toplam/i.test(foldHeader(contractor))) return;
          const province = String(excelColFuzzy(row, ['bolge', 'il']) || '').trim();
          const workGroup = inferRentalWorkGroup(`${file.name} ${province}`) || rentalWorkGroup || null;
          const meta = rentalGroupMeta(workGroup);
          const vehicleType = normalizePlateVehicleType(excelColFuzzy(row, ['arac tipi', 'cekici', 'dorse', 'kamyonet', 'kamyon']));
          const tariff = findRentalTariff(province, vehicleType);
          const dailyRent = excelColExact(row, ['kira']);
          const monthlyRentCol = excelColExact(row, ['aylik kira', 'kira bedeli']);
          const workDays = parseLocaleNumber(excelColExact(row, ['clsm gun', 'calisma gun', 'calisma gunu']));
          const rent_amount = meta.rentMode === 'daily'
            ? (dailyRent !== '' ? parseLocaleNumber(dailyRent) : (workDays ? parseLocaleNumber(monthlyRentCol) / workDays : parseLocaleNumber(tariff?.rent_amount)))
            : parseLocaleNumber(monthlyRentCol !== '' ? monthlyRentCol : (dailyRent !== '' ? dailyRent : tariff?.rent_amount));
          const rateRaw = excelColExact(row, ['yakit oran']) || excelColFuzzy(row, ['yakit oran']);
          const stopCount = parseLocaleNumber(excelColExact(row, ['ugrm gun', 'nokta sayisi']) || excelColFuzzy(row, ['nokta sayisi', 'ugrm gun', 'nokta']));
          const visitImported = parseLocaleNumber(excelColExact(row, ['ugrama primi']));
          const visitAuto = stopCount * (meta.visitUnit || 0);
          allRows.push({
            year_month: String(excelColFuzzy(row, ['donem', 'ay']) || fallbackMonth).slice(0, 7),
            province: province || null,
            region: province || null,
            plate,
            contractor_name: contractor,
            vehicle_type: vehicleType || null,
            rent_amount,
            fuel_rate: rateRaw !== '' ? parseLocaleNumber(rateRaw) : parseLocaleNumber(tariff?.fuel_rate),
            fuel_unit_price: parseLocaleNumber(excelColExact(row, ['yakit aylik birim']) || excelColFuzzy(row, ['yakit aylik birim', 'aylik birim'])),
            total_km: parseLocaleNumber(excelColExact(row, ['yapilan km']) || excelColFuzzy(row, ['yapilan km', 'toplam km'])),
            work_days: workDays,
            stop_count: stopCount,
            visit_prime: visitImported || visitAuto,
            extra_work: parseLocaleNumber(excelColExact(row, ['ek/is', 'ek is', 'ek is / diger'])) + parseLocaleNumber(excelColExact(row, ['arac yani calisan'])),
            hgs: meta.hasHgs ? parseLocaleNumber(excelColExact(row, ['hgs'])) : 0,
            fuel_charge: parseLocaleNumber(excelColFuzzy(row, ['yakit kesintisi'])),
            notes: file.name.replace(/\.xlsx?$/i, ''),
            work_group: workGroup,
            status: 'draft'
          });
        });
      }
      if (!allRows.length) {
        alert('Plaka + fatura kesen satırı okunamadı.\n' + debug.join('\n'));
        return;
      }
      let { error } = await supabase.from('rental_settlements').insert(allRows);
      if (error && /work_group|status/i.test(error.message || '')) {
        const slim = allRows.map(({ work_group: _g, status: _s, ...rest }) => rest);
        ({ error } = await supabase.from('rental_settlements').insert(slim));
      }
      if (error) throw error;
      alert(`${allRows.length} mutabakat satırı yüklendi (${files.length} dosya). Fatura ve cariye yazılmadı.`);
      loadPortalData();
    } catch (err: any) {
      alert('Mutabakat Excel hatası: ' + (err.message || 'Önce setup_rental_settlements.sql çalıştırın.'));
    } finally {
      e.target.value = '';
    }
  };

  const handlePatchRentalField = async (id: string, field: string, raw: string) => {
    if (!canEditMod('rental_settlements')) return;
    const numeric = !['plate', 'contractor_name', 'status', 'work_group', 'notes', 'year_month', 'province', 'region'].includes(field);
    const value = numeric ? cleanNumber(raw) : raw;
    const payload: any = { [field]: value };
    let { error } = await supabase.from('rental_settlements').update(payload).eq('id', id);
    if (error && /status|work_group/i.test(error.message || '')) {
      alert('Durum sütunu yok. setup_rental_settlements.sql dosyasını bir kez daha Run edin.');
      return;
    }
    if (error) {
      alert('Kayıt yazılamadı: ' + error.message);
      return;
    }
    setDbRentalSettlements(prev => prev.map((r: any) => r.id === id ? { ...r, ...payload } : r));
    if (rentalEditRow?.id === id) setRentalEditRow((prev: any) => prev ? { ...prev, ...payload } : prev);
  };

  const openRentalEdit = (r: any) => {
    setRentalEditRow(r);
    setRentalSettlementForm({
      year_month: r.year_month || '',
      province: r.province || '',
      region: r.region || '',
      plate: r.plate || '',
      contractor_name: r.contractor_name || '',
      vehicle_type: (normalizePlateVehicleType(r.vehicle_type) as typeof rentalSettlementForm.vehicle_type) || '',
      rent_amount: moneyInputValue(r.rent_amount),
      fuel_rate: String(r.fuel_rate ?? ''),
      fuel_unit_price: moneyInputValue(r.fuel_unit_price),
      total_km: String(r.total_km ?? ''),
      work_days: String(r.work_days ?? ''),
      stop_count: String(r.stop_count ?? ''),
      visit_prime: moneyInputValue(r.visit_prime),
      extra_work: moneyInputValue(r.extra_work),
      hgs: moneyInputValue(r.hgs),
      fuel_charge: moneyInputValue(r.fuel_charge),
      notes: r.notes || ''
    });
  };

  const handleSaveRentalEntry = async () => {
    if (!rentalEditRow) return;
    if (!canEditMod('rental_settlements')) return;
    if (rentalRowLockedForUser(rentalEditRow, currentUserRole)) {
      alert(isAdmin
        ? `Bu ay kilitli. Yönetici düzeltmesi ${yearMonthTrLabel(rentalAdminGraceUntilMonth(rentalEditRow.year_month))} sonuna kadardı.`
        : currentUserRole === 'reporter'
          ? 'Rapor kullanıcısı işlem yapamaz; yalnız görüntüleme.'
          : 'Yönetici onayından sonra bu satır kilitlidir.');
      return;
    }
    const meta = rentalGroupMeta(rentalRowGroup(rentalEditRow));
    const stopCount = parseLocaleNumber(rentalSettlementForm.stop_count);
    const visitOverride = parseLocaleNumber(rentalSettlementForm.visit_prime);
    const payload: any = {
      rent_amount: isAdmin ? parseLocaleNumber(rentalSettlementForm.rent_amount) : undefined,
      fuel_rate: isAdmin ? parseLocaleNumber(rentalSettlementForm.fuel_rate) : undefined,
      fuel_unit_price: isAdmin ? parseLocaleNumber(rentalSettlementForm.fuel_unit_price) : undefined,
      total_km: parseLocaleNumber(rentalSettlementForm.total_km),
      work_days: meta.hasWorkDays ? parseLocaleNumber(rentalSettlementForm.work_days) : (rentalEditRow.work_days || 0),
      stop_count: stopCount,
      visit_prime: isAdmin && visitOverride > 0 ? visitOverride : stopCount * (meta.visitUnit || 0),
      extra_work: parseLocaleNumber(rentalSettlementForm.extra_work),
      hgs: meta.hasHgs ? parseLocaleNumber(rentalSettlementForm.hgs) : 0,
      fuel_charge: isAdmin ? parseLocaleNumber(rentalSettlementForm.fuel_charge) : undefined,
      status: rentalEditRow.status === 'approved' ? 'approved' : (rentalEditRow.status === 'draft' ? 'submitted' : rentalEditRow.status)
    };
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
    const { error } = await supabase.from('rental_settlements').update(payload).eq('id', rentalEditRow.id);
    if (error) {
      alert('Kaydedilemedi: ' + error.message);
      return;
    }
    setDbRentalSettlements(prev => prev.map((r: any) => r.id === rentalEditRow.id ? { ...r, ...payload } : r));
    setRentalEditRow(null);
  };

  const handleImportPlateRentals = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const toInsert: any[] = [];
      rows.forEach((row: any) => {
        const plate = String(row['Plaka'] || row['plaka'] || '').trim().toUpperCase();
        const owner = String(row['Yüklenici'] || row['Sahip'] || row['Ad'] || '').trim();
        if (!plate || !owner) return;
        const payNote = String(row['Ödeme'] || '').trim();
        const notes = String(row['Açıklama'] || '').trim();
        const isDevlet = /5k|devlet/i.test(`${payNote} ${notes}`);
        const govFromNote = (payNote.match(/(\d+)\s*k/i) ? Number(RegExp.$1) * 1000 : 0);
        toInsert.push({
          plate,
          owner_name: owner,
          phone: String(row['Telefon'] || '').trim() || null,
          start_date: sanitizeDate(row['Tarih']) || null,
          renewal_date: sanitizeDate(row['Yenileme Tarih'] || row['Yenileme Tarihi']) || null,
          rent_amount: isDevlet ? 0 : cleanNumber(row['Tutar']),
          government_fee: isDevlet ? (govFromNote || cleanNumber(row['Tutar'])) : cleanNumber(row['Devlet'] || 0),
          collection_kind: isDevlet ? 'devlet' : 'kira',
          payment_note: payNote || null,
          next_amount: row['Yenileme Tutar'] !== undefined && row['Yenileme Tutar'] !== '' ? cleanNumber(row['Yenileme Tutar']) : (cleanNumber(row.__EMPTY) || null),
          notes: notes || null,
          vehicle_type: normalizePlateVehicleType(row['Araç Tipi'] || row['Tip'] || row['Araç'] || '') || null
        });
      });
      if (!toInsert.length) {
        alert('Excel’de Plaka ve Yüklenici sütunu olan satır bulunamadı.');
        return;
      }
      let { error } = await supabase.from('plate_rentals').insert(toInsert);
      if (error && /vehicle_type/i.test(error.message)) {
        const retry = await supabase.from('plate_rentals').insert(toInsert.map(({ vehicle_type: _t, ...rest }) => rest));
        error = retry.error;
      }
      if (error) throw error;
      alert(`${toInsert.length} plaka kaydı yüklendi. Kasa ve cariye yazılmadı.`);
      loadPortalData();
    } catch (err: any) {
      alert('Plaka Excel hatası: ' + (err.message || 'Önce setup_plate_rentals.sql çalıştırın.'));
    } finally {
      e.target.value = '';
    }
  };

  const saveAppSetting = async (key: string, value: string) => {
    const { error } = await supabase.from('app_settings').upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    if (error) throw error;
  };

  const isAdmin = currentUserRole === 'admin';
  const isReporter = currentUserRole === 'reporter';
  const isSaha = currentUserRole === 'saha';
  const canViewMod = (mod: string) => {
    if (mod === 'users') return isAdmin;
    if (isAdmin || isReporter) return true;
    if (mod === 'overview') return false;
    if (mod === 'hal_saha_report') {
      const a = moduleAccessLevel(portalAccess, 'hal_saha');
      return a === 'view' || a === 'edit';
    }
    const a = moduleAccessLevel(portalAccess, mod);
    return a === 'view' || a === 'edit';
  };
  const canEditMod = (mod: string) => {
    if (mod === 'users') return isAdmin;
    if (isAdmin) return true;
    if (isReporter) return false;
    return moduleAccessLevel(portalAccess, mod) === 'edit';
  };
  const seesInspectionOverdueAlert = isAdmin || isReporter || (isSaha && canViewMod('payments'));
  const seesPolicyExpiryAlert = canViewMod('fleet');

    // 2. NAVİGASYON & TARİH FİLTRELERİ
 const [activeTab, setActiveTab] = useState<
    'overview' | 'customers' | 'subcontractors' | 'sub_accounts' | 'sub_ibans' | 'sales_customers' | 'dis_alim' | 'employees' | 'fleet' | 'arac_filosu' | 'profitability' | 'collections' | 'credit_cards' | 'payments' | 'general_expenses' | 'monthly_view' | 'income_report' | 'plate_rentals' | 'rental_settlements' | 'trip_settlements' | 'hal_saha' | 'hal_saha_report' | 'users'
  >('overview');

  useEffect(() => {
    if (currentUserRole !== 'saha') return;
    if (canViewMod(activeTab)) return;
    const order = [
      ...(canEditMod('hal_saha') ? ['hal_saha'] : []),
      'arac_filosu', 'fleet', 'plate_rentals', 'profitability', ...PORTAL_MODULES.map(m => m.id)
    ];
    const first = order.find(id => canViewMod(id));
    if (first) setActiveTab(first as typeof activeTab);
  }, [currentUserRole, portalAccess, activeTab]);

  useEffect(() => {
    if (activeTab === 'users' && currentUserRole === 'admin') void loadPortalUsers();
  }, [activeTab, currentUserRole]);

  const [subSearchTerm, setSubSearchTerm] = useState('');
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState('');
  const [ledgerSortField, setLedgerSortField] = useState<'name' | 'tax' | 'balance'>('name');
  const [ledgerSortOrder, setLedgerSortOrder] = useState<'asc' | 'desc'>('asc');
  const [subStatusFilter, setSubStatusFilter] = useState<'all' | 'pending' | 'paid'>('pending');
  const [subSortField, setSubSortField] = useState<'invoice_no' | 'issue_date' | 'total_amount'>('issue_date');
  const [subSortOrder, setSubSortOrder] = useState<'asc' | 'desc'>('desc');
  const [bankSortField, setBankSortField] = useState<'contractorName' | 'iban' | 'dueDate' | 'amount'>('contractorName');
  const [bankSortOrder, setBankSortOrder] = useState<'asc' | 'desc'>('asc');
  const [empSearchTerm, setEmpSearchTerm] = useState('');
  const [empSortField, setEmpSortField] = useState<'name' | 'salary' | 'netPayable'>('name');
  const [empSortOrder, setEmpSortOrder] = useState<'asc' | 'desc'>('asc');
  const [expenseSearchTerm, setExpenseSearchTerm] = useState('');
  const [expenseStatusFilter, setExpenseStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('unpaid');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all');
  const [expenseSortField, setExpenseSortField] = useState<'invoice_no' | 'issue_date' | 'total_amount'>('issue_date');
  const [expenseSortOrder, setExpenseSortOrder] = useState<'asc' | 'desc'>('desc');
  const [incomeInSort, setIncomeInSort] = useState<ColumnSort>({ field: 'date', dir: 'asc' });
  const [incomeOutSort, setIncomeOutSort] = useState<ColumnSort>({ field: 'date', dir: 'asc' });
  const [incomeGiderKalemFilter, setIncomeGiderKalemFilter] = useState<string | null>(null);
  const [collectionSort, setCollectionSort] = useState<ColumnSort>({ field: 'date', dir: 'desc' });
  const [overdueInspectionAlertOpen, setOverdueInspectionAlertOpen] = useState(true);
  const [policyExpiryAlertOpen, setPolicyExpiryAlertOpen] = useState(true);
  const [cardSortField, setCardSortField] = useState<'due' | 'amount' | 'bank' | 'name'>('due');
  const [cardSortOrder, setCardSortOrder] = useState<'asc' | 'desc'>('asc');
  const [cardDueFilter, setCardDueFilter] = useState<'all' | 'week' | 'overdue' | 'clear'>('all');
  const [cardMenuId, setCardMenuId] = useState<string | number | null>(null);
  const getCurrentMonthRange = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDay = new Date(year, month + 1, 0);

    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    const startStr = `${year}-${pad(month + 1)}-01`;
    const endStr = `${year}-${pad(month + 1)}-${pad(lastDay.getDate())}`;

    return { start: startStr, end: endStr };
  };
  const getPreviousMonthRange = () => {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() - 1;
    if (month < 0) { month = 11; year -= 1; }
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    const lastDay = new Date(year, month + 1, 0).getDate();
    return { start: `${year}-${pad(month + 1)}-01`, end: `${year}-${pad(month + 1)}-${pad(lastDay)}` };
  };

  const [filterStartDate, setFilterStartDate] = useState(getCurrentMonthRange().start);
  const [filterEndDate, setFilterEndDate] = useState(getCurrentMonthRange().end);
  const applyPeriod = (start: string, end: string) => {
    setFilterStartDate(start);
    setFilterEndDate(end);
  };
  const getPreviousYearMonth = () => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  };
  const [profitMonth, setProfitMonth] = useState(getPreviousYearMonth);
  const [profitPdfBusy, setProfitPdfBusy] = useState(false);
  const [incomePdfBusy, setIncomePdfBusy] = useState(false);
  const [monthlyInputRows, setMonthlyInputRows] = useState<any[]>([]);

  // 3. VERİTABANI STATE'LERİ
  const [dbVehicles, setDbVehicles] = useState<any[]>([]);
  const [dbInvoices, setDbInvoices] = useState<any[]>([]);
  const [dbEmployees, setDbEmployees] = useState<any[]>([]);
  const [dbAdvances, setDbAdvances] = useState<any[]>([]);
  const [dbCreditCards, setDbCreditCards] = useState<any[]>([]);
  const [dbSubcontractors, setDbSubcontractors] = useState<any[]>([]);
  const [dbSubcontractorsLedger, setDbSubcontractorsLedger] = useState<any[]>([]);
  const [dbPaymentBatches, setDbPaymentBatches] = useState<any[]>([]);
  const [payingBatchId, setPayingBatchId] = useState<string | number | null>(null);
  const [dbAdvanceInstallments, setDbAdvanceInstallments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [portalDataReady, setPortalDataReady] = useState(false);
  const [isExcelUploading, setIsExcelUploading] = useState(false);
  const [dbEmployeeTransactions, setDbEmployeeTransactions] = useState<any[]>([]);
  const [dbCustomers, setDbCustomers] = useState<Customer[]>([]);
  const [dbPlateRentals, setDbPlateRentals] = useState<any[]>([]);
  const [dbHalFirms, setDbHalFirms] = useState<any[]>([]);
  const [dbHalEntries, setDbHalEntries] = useState<any[]>([]);
  const [dbHalHandovers, setDbHalHandovers] = useState<any[]>([]);
  const [dbHalPlates, setDbHalPlates] = useState<any[]>([]);
  const [dbTripSettlements, setDbTripSettlements] = useState<any[]>([]);
  const [dbTripPlates, setDbTripPlates] = useState<any[]>([]);
  const [dbFiloDepots, setDbFiloDepots] = useState<any[]>([]);
  const [dbAracVehicles, setDbAracVehicles] = useState<any[]>([]);
  const [dbAracAssignments, setDbAracAssignments] = useState<any[]>([]);
  const [dbAracJobs, setDbAracJobs] = useState<any[]>([]);
  const [dbAracPlaces, setDbAracPlaces] = useState<any[]>([]);
  const [dbDisAlimLines, setDbDisAlimLines] = useState<any[]>([]);
  const emptyPlateRentalForm = {
    plate: '',
    owner_name: '',
    phone: '',
    start_date: '',
    renewal_date: '',
    rent_amount: '',
    government_fee: '',
    collection_kind: 'kira' as 'kira' | 'devlet',
    payment_note: '',
    next_amount: '',
    notes: '',
    vehicle_type: '' as '' | 'Çekici' | 'Dorse' | 'Kamyon' | 'Kamyonet'
  };
  const [plateRentalForm, setPlateRentalForm] = useState(emptyPlateRentalForm);
  const [editingPlateRentalId, setEditingPlateRentalId] = useState<string | null>(null);
  const [isPlateRentalModalOpen, setIsPlateRentalModalOpen] = useState(false);
  const [plateRentalSearch, setPlateRentalSearch] = useState('');
  const [plateRentalSort, setPlateRentalSort] = useState<'renewal' | 'plate' | 'owner' | 'type' | 'amount'>('renewal');
  const [plateRentalTypeFilter, setPlateRentalTypeFilter] = useState<'all' | 'Çekici' | 'Dorse' | 'Kamyon' | 'Kamyonet'>('all');
  const emptyRentalSettlementForm = {
    year_month: getPreviousYearMonth(),
    province: '',
    region: '',
    plate: '',
    contractor_name: '',
    vehicle_type: '' as '' | 'Çekici' | 'Dorse' | 'Kamyon' | 'Kamyonet',
    rent_amount: '',
    fuel_rate: '',
    fuel_unit_price: '',
    total_km: '',
    work_days: '',
    stop_count: '',
    visit_prime: '',
    extra_work: '',
    hgs: '',
    fuel_charge: '',
    notes: ''
  };
  const [rentalSettlementForm, setRentalSettlementForm] = useState(emptyRentalSettlementForm);
  const [editingRentalSettlementId, setEditingRentalSettlementId] = useState<string | null>(null);
  const [isRentalSettlementModalOpen, setIsRentalSettlementModalOpen] = useState(false);
  const [rentalFleetMode, setRentalFleetMode] = useState<'add' | 'identity'>('add');
  const [dbRentalSettlements, setDbRentalSettlements] = useState<any[]>([]);
  const [dbRentalTariffs, setDbRentalTariffs] = useState<any[]>([]);
  const [rentalSettlementSearch, setRentalSettlementSearch] = useState('');
  const [rentalSettlementMonth, setRentalSettlementMonth] = useState(getPreviousYearMonth);
  const [rentalReportRow, setRentalReportRow] = useState<any | null>(null);
  const [isRentalTariffModalOpen, setIsRentalTariffModalOpen] = useState(false);
  const [rentalTariffForm, setRentalTariffForm] = useState({
    province: '',
    vehicle_type: '' as '' | 'Çekici' | 'Dorse' | 'Kamyon' | 'Kamyonet',
    rent_amount: '',
    fuel_rate: ''
  });
  const [rentalWorkGroup, setRentalWorkGroup] = useState<(typeof RENTAL_WORK_GROUPS)[number]['id']>('magazalar');
  useEffect(() => {
    if (!rentalAssignedGroups.length) return;
    if (!rentalAssignedGroups.includes(rentalWorkGroup)) {
      setRentalWorkGroup(rentalAssignedGroups[0] as (typeof RENTAL_WORK_GROUPS)[number]['id']);
    }
  }, [rentalAssignedGroups, rentalWorkGroup]);
  useEffect(() => {
    const vis = filoVisibleDepots(currentUserRole, filoAssignedDepots, dbFiloDepots);
    if (vis.length && !vis.some(d => d.id === filoDepot)) setFiloDepot(vis[0].id);
  }, [currentUserRole, filoAssignedDepots, filoDepot, dbFiloDepots]);
  const [rentalDownloadContractor, setRentalDownloadContractor] = useState('');
  const [rentalEditRow, setRentalEditRow] = useState<any | null>(null);
  const [rentalListSort, setRentalListSort] = useState<'plate' | 'contractor' | 'status' | 'amount'>('contractor');
  const [rentalStatusFilter, setRentalStatusFilter] = useState<'all' | 'draft' | 'submitted' | 'approved'>('all');
  const [rentalContractorFilter, setRentalContractorFilter] = useState('');
  const rentalSyncingRef = useRef(false);
  const [cashOpening, setCashOpening] = useState(CASH_BOOK_OPENING);
  const [cashOpeningAsOf, setCashOpeningAsOf] = useState(CASH_BOOK_START);
  const [cashOpeningBase, setCashOpeningBase] = useState<number | null>(null);
  const [sgkDriverAmount, setSgkDriverAmount] = useState(11148);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerFormData, setCustomerFormData] = useState({
    name: '',
    tax_id: '',
    tax_office: '',
    address: '',
    phone: '',
    email: '',
    notes: ''
  });
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [selectedCariCustomer, setSelectedCariCustomer] = useState<Customer | null>(null);
  const [selectedPayrollEmp, setSelectedPayrollEmp] = useState<any | null>(null);
  const [payrollFrom, setPayrollFrom] = useState('2026-10');
  const [payrollTo, setPayrollTo] = useState(() => {
    const d = new Date();
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  });

  const loadPortalData = async () => {
    setLoading(true);
    try {
      const load = async (table: string, order?: { column: string; ascending: boolean }) => {
        try {
          return await fetchAllRows(table, order);
        } catch (err) {
          console.error(table, err);
          return [];
        }
      };
      const want = (mod: string) => roleCanView(currentUserRole, portalAccess, mod);
      const finance = needsFinanceData(currentUserRole, portalAccess);
      const loadIf = (ok: boolean, table: string, order?: { column: string; ascending: boolean }) =>
        ok ? load(table, order) : Promise.resolve([]);

      const [
        batchData,
        instData,
        vData,
        invData,
        empData,
        advData,
        ccData,
        subData,
        ledgerData,
        empTxData,
        customerData,
        settingsData,
        monthlyInputData,
        plateRentalData,
        rentalSettlementData,
        rentalTariffData,
        halFirmData,
        halEntryData,
        halHandoverData,
        halPlateData,
        tripSettlementData,
        tripPlateData,
        filoDepotData,
        aracVehicleData,
        aracAssignData,
        aracJobData,
        aracPlaceData,
        disAlimData
      ] = await Promise.all([
        loadIf(want('payments'), 'payment_batches'),
        loadIf(want('payments') || want('subcontractors'), 'advance_installments'),
        loadIf(want('fleet') || want('profitability') || want('plate_rentals') || want('hal_saha') || want('payments'), 'vehicles', { column: 'id', ascending: true }),
        loadIf(finance, 'invoices', { column: 'created_at', ascending: false }),
        loadIf(want('employees') || want('profitability'), 'employees', { column: 'id', ascending: true }),
        loadIf(want('subcontractors') || want('sub_accounts') || want('payments') || want('employees'), 'advance_payments', { column: 'created_at', ascending: false }),
        loadIf(want('credit_cards'), 'credit_cards', { column: 'due_date', ascending: true }),
        loadIf(want('subcontractors') || want('sub_accounts') || want('sub_ibans') || want('payments') || want('arac_filosu'), 'subcontractors', { column: 'name', ascending: true }),
        loadIf(want('sub_accounts'), 'subcontractor_ledger'),
        loadIf(want('employees'), 'employee_transactions', { column: 'created_at', ascending: false }),
        loadIf(want('customers') || want('sales_customers') || want('collections'), 'customers', { column: 'name', ascending: true }),
        loadIf(isAdmin || isReporter, 'app_settings'),
        loadIf(want('profitability') || want('trip_settlements'), 'vehicle_monthly_inputs'),
        loadIf(want('plate_rentals'), 'plate_rentals', { column: 'renewal_date', ascending: true }),
        loadIf(want('rental_settlements'), 'rental_settlements', { column: 'year_month', ascending: false }),
        loadIf(want('rental_settlements'), 'rental_settlement_tariffs', { column: 'province', ascending: true }),
        loadIf(want('hal_saha'), 'hal_firms', { column: 'name', ascending: true }),
        loadIf(want('hal_saha'), 'hal_entries', { column: 'entry_date', ascending: false }),
        loadIf(want('hal_saha'), 'hal_handovers', { column: 'hand_date', ascending: false }),
        loadIf(want('hal_saha'), 'hal_plates', { column: 'sort_order', ascending: true }),
        loadIf(want('trip_settlements'), 'trip_settlements', { column: 'year_month', ascending: false }),
        loadIf(want('trip_settlements') || want('profitability'), 'trip_fleet_plates', { column: 'plate', ascending: true }),
        loadIf(want('trip_settlements') || want('arac_filosu') || isAdmin, 'trip_filo_depots', { column: 'sort_order', ascending: true }),
        loadIf(want('arac_filosu') || (isAdmin && want('rental_settlements')), 'fleet_vehicles', { column: 'plate', ascending: true }),
        loadIf(want('arac_filosu') || (isAdmin && want('rental_settlements')), 'fleet_vehicle_assignments'),
        loadIf(want('arac_filosu') || isAdmin, 'fleet_code_jobs', { column: 'sort_order', ascending: true }),
        loadIf(want('arac_filosu') || isAdmin, 'fleet_code_places', { column: 'sort_order', ascending: true }),
        loadIf(want('dis_alim'), 'dis_alim_lines', { column: 'invoice_date', ascending: false })
      ]);

      if (isAdmin) {
        const dropEa = (invData || []).filter((i: any) => {
          const no = String(i.invoice_no || '').toUpperCase().replace(/\s+/g, '');
          return no.includes('EA12026000000001') && Math.abs(Number(i.total_amount) - 255000) < 0.5;
        });
        for (const inv of dropEa) {
          await supabase.from('invoices').delete().eq('id', inv.id);
          const ix = invData.indexOf(inv);
          if (ix >= 0) invData.splice(ix, 1);
        }
      }

      setDbPaymentBatches(batchData);
      setDbAdvanceInstallments(instData);
      setDbVehicles(vData);
      setDbInvoices(invData);
      setDbEmployees(empData);
      setDbAdvances(advData);
      setDbCreditCards(ccData);
      setDbSubcontractors(subData);
      setDbSubcontractorsLedger(ledgerData);
      setDbEmployeeTransactions(empTxData);
      setDbCustomers(customerData as Customer[]);
      setMonthlyInputRows(monthlyInputData);
      setDbPlateRentals(plateRentalData);
      setDbRentalSettlements(rentalSettlementData);
      setDbRentalTariffs(rentalTariffData);
      setDbHalFirms(halFirmData);
      setDbHalEntries(halEntryData);
      setDbHalHandovers(halHandoverData);
      setDbHalPlates(halPlateData);
      setDbTripSettlements(tripSettlementData);
      setDbTripPlates(tripPlateData);
      setDbFiloDepots(filoDepotData);
      setDbAracVehicles(aracVehicleData);
      setDbAracAssignments(aracAssignData);
      setDbAracJobs(aracJobData);
      setDbAracPlaces(aracPlaceData);
      setDbDisAlimLines(disAlimData);

      const crcCard = isAdmin ? findCrcCustomer(customerData as Customer[]) : null;
      if (crcCard) {
        const moved = [];
        for (const inv of invData || []) {
          if (!isLegacyCrcInvoice(inv)) continue;
          const patch: Record<string, string> = {};
          if (isCrcSalesInvoiceDoc(inv) && String(inv.category || '') !== 'freight_sales') {
            patch.category = 'freight_sales';
          }
          const nextNo = retitleInvoiceCustomer(inv.invoice_no, crcCard.name);
          if (nextNo && nextNo !== inv.invoice_no) patch.invoice_no = nextNo;
          if (!Object.keys(patch).length) continue;
          const { error } = await supabase.from('invoices').update(patch).eq('id', inv.id);
          if (!error) {
            Object.assign(inv, patch);
            moved.push(inv.id);
          }
        }
        if (moved.length) setDbInvoices([...invData]);
      }

      const atifCard = isAdmin ? findAtifCustomer(customerData as Customer[]) : null;
      const idealCard = isAdmin ? findIdealTarimCustomer(customerData as Customer[]) : null;
      const mainMigrosCard = isAdmin ? findMigrosCustomer(customerData as Customer[]) : null;
      if (atifCard || idealCard) {
        const autoTahsil = (invData || []).filter((i: any) => {
          const n = String(i.invoice_no || '');
          if (i.category !== 'customer_collection' && i.category !== 'customer_advance') return false;
          if (/^TAHSILAT-1510\s*-/i.test(n)) return true;
          return /^TAHSILAT\s+-/i.test(n) && /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(n);
        });
        for (const inv of autoTahsil) {
          await supabase.from('invoices').delete().eq('id', inv.id);
          const ix = invData.indexOf(inv);
          if (ix >= 0) invData.splice(ix, 1);
        }

        const atifSales = (invData || []).filter((i: any) => {
          if (i.category !== 'freight_sales' && i.direction !== 'outgoing') return false;
          const resolved = resolveInvoiceCustomer(i, customerData as Customer[], invData);
          return resolved?.id === atifCard?.id || /ATIF/i.test(String(i.invoice_no || ''));
        });
        const keepAtif = new Set<string>();
        const dropAtif: any[] = [];
        atifSales.forEach((inv: any) => {
          const keys = extractSalesInvoiceKeys(inv.invoice_no);
          const d = String(inv.issue_date || '').slice(0, 10);
          const amt = Math.round(Number(inv.total_amount) * 100);
          const k = (keys[0] || '') + '|' + d + '|' + amt;
          if (keepAtif.has(k)) dropAtif.push(inv);
          else keepAtif.add(k);
        });
        for (const inv of dropAtif) {
          await supabase.from('invoices').delete().eq('id', inv.id);
          const ix = invData.indexOf(inv);
          if (ix >= 0) invData.splice(ix, 1);
        }

        const movedSep = [];
        for (const inv of invData || []) {
          const who = eylulMisfiledOwner(inv);
          if (!who) continue;
          const card = who === 'ideal' ? idealCard : atifCard;
          if (!card) continue;
          const no = String(inv.invoice_no || '');
          const resolved = resolveInvoiceCustomer(inv, customerData as Customer[], invData);
          const onMigros = (/MIGROS|MİGROS/i.test(no) && !/DI[ŞS]\s*ALIM/i.test(no)) || resolved?.id === mainMigrosCard?.id;
          if (!onMigros) continue;
          const nextNo = retitleInvoiceCustomer(no, card.name);
          if (!nextNo || nextNo === no) continue;
          const { error } = await supabase.from('invoices').update({ invoice_no: nextNo }).eq('id', inv.id);
          if (!error) {
            inv.invoice_no = nextNo;
            movedSep.push(inv.id);
          }
        }
        if (movedSep.length || autoTahsil.length || dropAtif.length) setDbInvoices([...invData]);
      }

      const migrosCard = isAdmin ? findMigrosCustomer(customerData as Customer[]) : null;
      if (migrosCard) {
        const movedMigros = [];
        for (const inv of invData || []) {
          if (!isCustomerMoneyInvoice(inv)) continue;
          if (isLegacyCrcInvoice(inv)) continue;
          if (resolveInvoiceCustomer(inv, customerData as Customer[], invData)) continue;
          const nextNo = retitleInvoiceCustomer(inv.invoice_no, migrosCard.name);
          if (!nextNo || nextNo === inv.invoice_no) continue;
          const { error } = await supabase.from('invoices').update({ invoice_no: nextNo }).eq('id', inv.id);
          if (!error) {
            inv.invoice_no = nextNo;
            movedMigros.push(inv.id);
          }
        }
        if (movedMigros.length) setDbInvoices([...invData]);
      }

      const settings: Record<string, string> = {};
      settingsData.forEach((row: any) => {
        if (row?.key) settings[row.key] = String(row.value ?? '');
      });
      if (Object.prototype.hasOwnProperty.call(settings, 'cash_opening_base')) {
        setCashOpeningBase(cleanNumber(settings.cash_opening_base));
      }
      const savedAsOf = String(settings.cash_opening_as_of || '').slice(0, 10);
      const hasOpening = Object.prototype.hasOwnProperty.call(settings, 'cash_opening') && String(settings.cash_opening ?? '') !== '';
      const savedOpening = cleanNumber(settings.cash_opening);
      if (savedAsOf === CASH_BOOK_START && hasOpening && Number.isFinite(savedOpening)) {
        setCashOpening(savedOpening);
        setCashOpeningAsOf(CASH_BOOK_START);
      } else {
        setCashOpening(CASH_BOOK_OPENING);
        setCashOpeningAsOf(CASH_BOOK_START);
        if (isAdmin && !hasOpening) {
          try {
            await saveAppSetting('cash_opening', String(CASH_BOOK_OPENING));
            await saveAppSetting('cash_opening_as_of', CASH_BOOK_START);
          } catch {
            /* ayar tablosu yoksa ekranda yine 7 Ekim açılışı durur */
          }
        }
      }
      if (Object.prototype.hasOwnProperty.call(settings, 'sgk_driver_amount')) {
        setSgkDriverAmount(cleanNumber(settings.sgk_driver_amount));
      }
      setPortalDataReady(true);
    } catch (err) {
      console.error('Yükleme hatası:', err);
      alert('Veriler yüklenirken hata oluştu. Sayfayı yenileyin veya bağlantıyı kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadPortalData();
    }
  }, [isAuthenticated]);

  // 4. GELİŞMİŞ VE EXCEL SERİ TARİH DESTEKLİ DÖNÜŞTÜRÜCÜLER
  const cleanNumber = (val: any): number => parseLocaleNumber(val);
// 1. ARKA PLAN İÇİN HESAPLAMA DOSTU TARİH FORMATI (YYYY-MM-DD)
  const sanitizeDate = (d: any): string => {
    if (!d) return '';
    try {
      // Excel Seri Numarası (Örn: 46295)
      if (typeof d === 'number' || (!isNaN(Number(d)) && String(d).trim().length === 5)) {
        const serial = Number(d);
        if (serial > 20000 && serial < 80000) {
          const dateObj = new Date(Math.round((serial - 25569) * 86400 * 1000));
          return dateObj.toISOString().split('T')[0];
        }
      }
      let str = String(d).split('T')[0].trim();
      // 20026 gibi 5 haneli hatalı yılları 2026 yapar
      if (str.startsWith('200') && str.length >= 10) {
        str = str.replace(/^200/, '20');
      }
      // Eğer GG.AA.YYYY / GG/AA/YYYY / GG-AA-YYYY girilmişse YYYY-MM-DD'ye çevir
      if (str.includes('.') || str.includes('/') || /^\d{1,2}-\d{1,2}-\d{4}$/.test(str)) {
        const parts = str.split(/[./-]/);
        if (parts.length === 3 && parts[2].length === 4) {
          return clampIsoDate(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
        }
      }
      return clampIsoDate(str);
    } catch {
      return '';
    }
  };

  const resolveEmployeeStart = (emp: any) => {
    const hire = sanitizeDate(emp?.hire_date);
    if (hire) return { date: hire, label: 'işe giriş' };
    const dates: string[] = [];
    const created = sanitizeDate(emp?.created_at);
    if (created) dates.push(created);
    const empIdStr = String(emp?.id || '');
    const empNorm = String(emp?.full_name || '').toLowerCase().trim();
    (dbEmployeeTransactions || []).forEach((tx: any) => {
      if (String(tx.employee_id) !== empIdStr) return;
      const d = sanitizeDate(tx.transaction_date || tx.created_at);
      if (d) dates.push(d);
    });
    (dbInvoices || []).forEach((inv: any) => {
      if (!salaryPayrollMatchesEmployee(inv, emp)) return;
      const d = sanitizeDate(inv.issue_date || inv.created_at);
      if (d) dates.push(d);
    });
    (dbAdvances || []).forEach((a: any) => {
      if (a.target_type !== 'employee') return;
      const targetId = String(a.target_id || '');
      const targetNorm = String(a.target_name || '').toLowerCase().trim();
      const isMatch =
        (targetId && targetId === empIdStr) ||
        (targetNorm.length >= 3 && empNorm && (targetNorm.includes(empNorm) || empNorm.includes(targetNorm)));
      if (!isMatch) return;
      const d = sanitizeDate(a.created_at || a.payment_date || a.issue_date);
      if (d) dates.push(d);
    });
    dates.sort();
    if (dates[0]) {
      const label = created && dates[0] === created ? 'kayıt tarihi' : 'ilk veri girişi';
      return { date: dates[0], label };
    }
    return { date: '', label: 'yok' };
  };

  const namesMatch = (a: string, b: string) => {
    const n = (s: string) => String(s || '').toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();
    const left = n(a);
    const right = n(b);
    return !!left && !!right && left === right;
  };

  const monthsBetween = (fromYm: string, toYm: string) => {
    const [fy, fm] = fromYm.split('-').map(Number);
    const [ty, tm] = toYm.split('-').map(Number);
    if (!fy || !fm || !ty || !tm) return 999;
    return (ty - fy) * 12 + (tm - fm);
  };

  const currentPayYearMonth = () => {
    const d = new Date();
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  };

  const personnelClosedYearMonth = () => {
    const d = new Date();
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    const prev = new Date(d.getFullYear(), d.getMonth(), 0);
    return `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`;
  };

  const personnelBooksStartYm = '2026-10';

  const yearMonthsBetween = (fromYm: string, toYm: string) => {
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    let from = fromYm || toYm;
    let to = toYm || from;
    if (from > to) return [];
    const months: string[] = [];
    let [y, m] = from.split('-').map(Number);
    const [ty, tm] = to.split('-').map(Number);
    let guard = 0;
    while ((y < ty || (y === ty && m <= tm)) && guard < 36) {
      months.push(`${y}-${pad(m)}`);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      guard += 1;
    }
    return months;
  };

  const employeeMatchesAdvance = (emp: any, a: any) => {
    if (a?.target_type !== 'employee') return false;
    const empIdStr = String(emp?.id || '');
    const targetId = String(a.target_id || '');
    if (empIdStr && targetId && targetId === empIdStr) return true;
    const empNorm = foldPersonName(emp?.full_name);
    const targetNorm = foldPersonName(a.target_name);
    return !!empNorm && empNorm.length >= 3 && !!targetNorm && (targetNorm.includes(empNorm) || empNorm.includes(targetNorm));
  };

  const employeeBooksFromYm = (emp: any) => {
    const hireYm = sanitizeDate(emp?.hire_date).slice(0, 7);
    let from = personnelBooksStartYm;
    if (hireYm && hireYm > from) from = hireYm;
    const empIdStr = String(emp?.id || '');
    let earliest = '';
    const noteYm = (raw: any) => {
      const ym = sanitizeDate(raw).slice(0, 7);
      if (!ym || ym < personnelBooksStartYm) return;
      if (!earliest || ym < earliest) earliest = ym;
    };
    (dbEmployeeTransactions || []).forEach((tx: any) => {
      if (String(tx.employee_id) !== empIdStr) return;
      noteYm(tx.transaction_date || tx.created_at);
    });
    (dbAdvances || []).forEach((a: any) => {
      if (!employeeMatchesAdvance(emp, a)) return;
      noteYm(a.issue_date || a.payment_date || a.created_at);
    });
    if (earliest && earliest < from) from = earliest;
    return from;
  };

  const employeeManualMovementsForMonth = (emp: any, yearMonth: string) => {
    let bonus = 0;
    let advanceCut = 0;
    if (!yearMonth || yearMonth < personnelBooksStartYm) return { bonus, advanceCut };
    if (yearMonth < employeeBooksFromYm(emp)) return { bonus, advanceCut };
    const empIdStr = String(emp?.id || '');

    (dbEmployeeTransactions || []).forEach((tx: any) => {
      if (String(tx.employee_id) !== empIdStr) return;
      const startYm = sanitizeDate(tx.transaction_date || tx.created_at).slice(0, 7);
      if (!startYm || startYm < personnelBooksStartYm) return;
      if (tx.type === 'bonus') {
        if (startYm === yearMonth) bonus += cleanNumber(tx.total_amount);
        return;
      }
      if (tx.type === 'advance') {
        if (startYm === yearMonth) advanceCut += cleanNumber(tx.total_amount);
        return;
      }
      if (tx.type === 'installment_advance') {
        const inst = Math.max(1, Number(tx.installment_count) || 1);
        const elapsed = monthsBetween(startYm, yearMonth);
        if (elapsed >= 0 && elapsed < inst) {
          advanceCut += cleanNumber(tx.monthly_cut || Math.round(cleanNumber(tx.total_amount) / inst));
        }
      }
    });

    (dbAdvances || []).forEach((a: any) => {
      if (!employeeMatchesAdvance(emp, a)) return;
      const startYm = sanitizeDate(a.issue_date || a.payment_date || a.created_at).slice(0, 7);
      if (!startYm || startYm < personnelBooksStartYm) return;
      const tot = cleanNumber(a.total_amount);
      if (a.payment_type === 'employee_bonus') {
        if (startYm === yearMonth) bonus += tot;
        return;
      }
      const remaining = a.remaining_amount === null || a.remaining_amount === undefined ? tot : cleanNumber(a.remaining_amount);
      const inst = Math.max(1, Number(a.total_installments) || 1);
      const isInst = inst > 1;
      if (isInst) {
        const elapsed = monthsBetween(startYm || yearMonth, yearMonth);
        if (elapsed >= 0 && elapsed < inst) {
          advanceCut += Math.min(remaining, tot / inst);
        }
      } else if (startYm === yearMonth) {
        advanceCut += remaining > 0 ? remaining : tot;
      }
    });

    return { bonus, advanceCut };
  };

  const employmentShareForMonth = (startDateRaw: any, yearMonth: string) => {
    const start = sanitizeDate(startDateRaw);
    if (!start || !yearMonth) return { factor: 0, daysWorked: 0, daysInMonth: 0, hireYm: '', startedThisMonth: false };
    const hireYm = start.slice(0, 7);
    const [y, m] = yearMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    if (yearMonth < hireYm) return { factor: 0, daysWorked: 0, daysInMonth, hireYm, startedThisMonth: false };
    if (yearMonth > hireYm) return { factor: 1, daysWorked: daysInMonth, daysInMonth, hireYm, startedThisMonth: false };
    const startDay = Math.max(1, Number(start.slice(8, 10)) || 1);
    const daysWorked = Math.max(0, daysInMonth - startDay + 1);
    return {
      factor: daysInMonth > 0 ? daysWorked / daysInMonth : 1,
      daysWorked,
      daysInMonth,
      hireYm,
      startedThisMonth: startDay > 1
    };
  };

  const employeeSalaryAccruesInMonth = (emp: any, yearMonth: string) => {
    if (!yearMonth || yearMonth < personnelBooksStartYm) return false;
    const hireYm = sanitizeDate(emp?.hire_date).slice(0, 7);
    if (hireYm && yearMonth < hireYm) return false;
    return yearMonth >= employeeBooksFromYm(emp);
  };

  const employeePayForMonth = (emp: any, yearMonth: string) => {
    if (!yearMonth || yearMonth < personnelBooksStartYm || yearMonth < employeeBooksFromYm(emp)) {
      return { base: 0, bonus: 0, advanceCut: 0, gross: 0, net: 0, carried: 0 };
    }
    const extra = employeeManualMovementsForMonth(emp, yearMonth);
    const hire = sanitizeDate(emp?.hire_date);
    const share = hire
      ? employmentShareForMonth(hire, yearMonth)
      : { factor: 1, daysWorked: 0, daysInMonth: 0, hireYm: '', startedThisMonth: false };
    const full = employeeSalaryAccruesInMonth(emp, yearMonth) ? cleanNumber(emp?.base_salary) : 0;
    const base = Math.round(full * (Number(share.factor) || 0) * 100) / 100;
    const bonus = extra.bonus;
    const advanceCut = extra.advanceCut;
    const gross = base + bonus;
    const net = gross - advanceCut;
    const carried = Math.max(0, -net);
    return { base, bonus, advanceCut, gross, net, carried };
  };

  const employeeSalaryPaidTotal = (emp: any) => {
    const from = employeeBooksFromYm(emp);
    return (dbInvoices || [])
      .filter((inv: any) => {
        if (!salaryPayrollMatchesEmployee(inv, emp)) return false;
        const d = sanitizeDate(inv.issue_date || inv.created_at);
        if (!d || d < `${from}-01`) return false;
        return true;
      })
      .reduce((s: number, inv: any) => s + cleanNumber(inv.total_amount), 0);
  };

  const employeeBooksBreakdown = (emp: any) => {
    const from = employeeBooksFromYm(emp);
    const closed = personnelClosedYearMonth();
    const current = currentPayYearMonth();
    let salaryHak = 0;
    let bonus = 0;
    let advanceCut = 0;
    if (closed >= from) {
      yearMonthsBetween(from, closed).forEach(ym => {
        salaryHak += employeePayForMonth(emp, ym).base;
      });
    }
    const moveTo = current >= from ? current : closed;
    if (moveTo >= from) {
      yearMonthsBetween(from, moveTo).forEach(ym => {
        const extra = employeeManualMovementsForMonth(emp, ym);
        bonus += extra.bonus;
        advanceCut += extra.advanceCut;
      });
    }
    const paid = employeeSalaryPaidTotal(emp);
    const balance = Math.round((salaryHak + bonus - advanceCut - paid) * 100) / 100;
    const openExtra = current > closed && current >= from
      ? (() => {
          const extra = employeeManualMovementsForMonth(emp, current);
          return extra.bonus - extra.advanceCut;
        })()
      : 0;
    return {
      from,
      closed,
      current,
      closedHak: Math.round(salaryHak * 100) / 100,
      bonus: Math.round(bonus * 100) / 100,
      advanceCut: Math.round(advanceCut * 100) / 100,
      openExtra: Math.round(openExtra * 100) / 100,
      paid: Math.round(paid * 100) / 100,
      balance,
      unpaid: Math.max(0, balance)
    };
  };

  const employeeUnpaidFromBooks = (emp: any) => employeeBooksBreakdown(emp).unpaid;

// SEÇİLEN ALT YÜKLENİCİ CARİ DETAYI STATE'İ
  const [selectedSubcontractorForDetail, setSelectedSubcontractorForDetail] = useState<any | null>(null);
  
  // 2. SADECE EKRANDA GÖSTERİM İÇİN TÜRKİYE TARİH FORMATI (GG.AA.YYYY)
  const formatDateTR = (d: any): string => {
    if (!d) return '-';
    const clean = sanitizeDate(d);
    if (!clean || !clean.includes('-')) return clean || '-';
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return clean;
  };

  const formatDateForInput = (d: any): string => {
    return sanitizeDate(d);
  };

  const addOneYear = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  };

  const formatIBAN = (val: string) => {
    let clean = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!clean.startsWith('TR')) clean = 'TR' + clean.replace(/^TR/, '');
    const trPart = clean.substring(0, 2);
    const digitsPart = clean.substring(2).replace(/\D/g, '').substring(0, 24);
    const full = trPart + digitsPart;

    const parts = [];
    for (let i = 0; i < full.length; i += 4) {
      parts.push(full.substring(i, i + 4));
    }
    return parts.join(' ');
  };

  // 05XX XXX XX XX TELEFON BİÇİMLENDİRİCİ
  const formatPhone = (val: string) => {
    let numbers = val.replace(/\D/g, '');
    if (!numbers.startsWith('0') && numbers.length > 0) numbers = '0' + numbers;
    numbers = numbers.substring(0, 11);

    let res = '';
    if (numbers.length > 0) res += numbers.substring(0, 4);
    if (numbers.length > 4) res += ' ' + numbers.substring(4, 7);
    if (numbers.length > 7) res += ' ' + numbers.substring(7, 9);
    if (numbers.length > 9) res += ' ' + numbers.substring(9, 11);
    return res;
  };

  // 5. MODAL VE FORM STATE'LERİ
  const [isCreditCardModalOpen, setIsCreditCardModalOpen] = useState(false);
  const [creditCardFormData, setCreditCardFormData] = useState({
    cardName: '',
    bankName: '',
    lastFourDigits: '',
    statementAmount: '',
    minPaymentAmount: '',
    dueDate: '',
    cardKind: 'company'
  });
  const [editingCreditCardId, setEditingCreditCardId] = useState<number | null>(null);

  // Kredi Kartı Düzenleme Penceresini Aç
  const openEditCreditCardModal = (card: any) => {
    setEditingCreditCardId(card.id);
    setCreditCardFormData({
      cardName: card.card_name || '',
      bankName: card.bank_name || '',
      lastFourDigits: card.last_four_digits || '',
      statementAmount: String(card.statement_amount || ''),
      minPaymentAmount: String(card.min_payment_amount || ''),
      dueDate: sanitizeDate(card.due_date),
      cardKind: card.card_kind === 'personal' || /şahsi|sahsi|kişisel|kisisel/i.test(String(card.card_name || '')) ? 'personal' : 'company'
    });
    setIsCreditCardModalOpen(true);
  };

  // Kredi Kartı Ödemesi Yap (Tamamı veya Asgari)
  const handlePayCreditCard = async (card: any, type: 'full' | 'min') => {
    if (!isAdmin) return;
    const fullAmt = cleanNumber(card.statement_amount);
    const minAmt = cleanNumber(card.min_payment_amount);
    const payAmt = type === 'full' ? fullAmt : minAmt;

    if (payAmt <= 0) {
      alert('Ödenecek geçerli bir borç tutarı bulunmuyor.');
      return;
    }

    const typeLabel = type === 'full' ? 'Tamamını' : 'Asgari Tutarını';
    const isPersonal = card.card_kind === 'personal' || /şahsi|sahsi|kişisel|kisisel/i.test(String(card.card_name || ''));
    let cashAmt = payAmt;
    if (isPersonal) {
      const raw = window.prompt(
        `${card.card_name} şahsi kart.\nEkstre ödemesi: ${payAmt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺\n\nŞirket kasasından düşülecek tutar (şahsi harcama 0 yazın):`,
        '0'
      );
      if (raw === null) return;
      cashAmt = Math.max(0, cleanNumber(raw));
    }
    const confirmMsg = isPersonal
      ? `${card.card_name}\nEkstre: ${payAmt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ kapanacak.\nKasadan düşecek: ${cashAmt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`
      : `${card.card_name} (${card.bank_name})\n${typeLabel}: ${payAmt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ kasadan düşecek.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const remainingAmt = Math.max(0, fullAmt - payAmt);

      const { error: cardErr } = await supabase
        .from('credit_cards')
        .update({
          statement_amount: remainingAmt,
          min_payment_amount: type === 'full' ? 0 : Math.max(0, minAmt - payAmt)
        })
        .eq('id', card.id);

      if (cardErr) throw cardErr;

      if (cashAmt > 0) {
      await supabase.from('invoices').insert([{
          invoice_no: `KART ÖDEME - ${card.card_name} ****${String(card.last_four_digits || '').replace(/\D/g, '').slice(-4)} [${card.bank_name}] nakit ödeme yapıldı (${typeLabel})`,
        direction: 'incoming',
        category: 'credit_card_payment',
          total_amount: cashAmt,
        issue_date: todayStr,
        due_date: todayStr,
        status: 'paid'
      }]);
      }

      alert(`Kart ekstresi güncellendi.${cashAmt > 0 ? ` Kasadan ${cashAmt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ düşüldü.` : ' Kasaya dokunulmadı (şahsi).'}${remainingAmt > 0 ? `\nKalan ekstre: ${remainingAmt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : ''}`);
      loadPortalData();
    } catch (err: any) {
      alert('Kart ödeme hatası: ' + err.message);
    }
  };

  const [isNewSaleModalOpen, setIsNewSaleModalOpen] = useState(false);
  const [newSaleFormData, setNewSaleFormData] = useState({
    customerName: '',
    invoiceNo: '',
    amount: '',
    description: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  });

  const [isNewReceiptModalOpen, setIsNewReceiptModalOpen] = useState(false);
  const [newReceiptFormData, setNewReceiptFormData] = useState({
    customerName: '',
    receiptNo: '',
    amount: '',
    targetAccount: 'bank',
    date: new Date().toISOString().split('T')[0],
    kind: 'collection' as 'collection' | 'invoice',
    relatedInvoiceId: null as string | number | null
  });

  const [isCashDepositModalOpen, setIsCashDepositModalOpen] = useState(false);
  const [isCashLedgerOpen, setIsCashLedgerOpen] = useState(false);
  const [cashLedgerFrom, setCashLedgerFrom] = useState('');
  const [cashLedgerTo, setCashLedgerTo] = useState('');
  const [cashDepositFormData, setCashDepositFormData] = useState({
    depositType: 'partner_capital',
    amount: '',
    targetAccount: 'bank',
    title: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [isBulkSalaryModalOpen, setIsBulkSalaryModalOpen] = useState(false);
  const [bulkSalaryItems, setBulkSalaryItems] = useState<{ [empId: number]: { selected: boolean; amount: string; name: string; role: string; iban: string; net: number } }>({});
  const [bulkSalarySource, setBulkSalarySource] = useState<'bank' | 'cash'>('bank');
  const [salaryPayDate, setSalaryPayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isSingleSalaryPayOpen, setIsSingleSalaryPayOpen] = useState(false);
  const [singleSalaryPay, setSingleSalaryPay] = useState({
    empId: 0,
    name: '',
    amount: '',
    net: 0,
    base: 0,
    closedHak: 0,
    openExtra: 0,
    paid: 0
  });

  // TAŞERON IBAN MODALI (EKLE VE DÜZENLE)
  const [isSubIbanModalOpen, setIsSubIbanModalOpen] = useState(false);
  const [editingSubIbanId, setEditingSubIbanId] = useState<number | null>(null);
  const [subIbanFormData, setSubIbanFormData] = useState({
    name: '',
    iban: '',
    phone: '',
    tax_no: ''
  });
  const [subInfoSearchTerm, setSubInfoSearchTerm] = useState('');

  // BANKA TALİMATI: fatura + vade satırı seçimi
  const [bankSelectedLines, setBankSelectedLines] = useState<{ [key: string]: boolean }>({});
  const [bankPayMode, setBankPayMode] = useState<Record<string, 'term1' | 'term2' | 'both'>>({});

  // MANUEL TAŞERON FATURA EKLEME MODALI
  const [isManualSubInvoiceModalOpen, setIsManualSubInvoiceModalOpen] = useState(false);
  const [manualSubInvoiceData, setManualSubInvoiceData] = useState({
    subcontractorName: '',
    invoiceNo: '',
    totalAmount: '',
    issueDate: new Date().toISOString().split('T')[0],
    term1DueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    term2DueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  });

  // TAŞERONA MANUEL ÖDEME / AVANS MODALI
  const [isSubPaymentModalOpen, setIsSubPaymentModalOpen] = useState(false);
  const [subPaymentFormData, setSubPaymentFormData] = useState({
    subcontractorName: '',
    actionType: 'advance',
    amount: '',
    installmentCount: '2',
    targetAccount: 'bank',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });

  // HAKEDİŞ DÜZENLEME MODALI
  const [isEditSubModalOpen, setIsEditSubModalOpen] = useState(false);
  const [editingSubInvoice, setEditingSubInvoice] = useState<any>(null);
  const [subEditFormData, setSubEditFormData] = useState({
    invoiceNo: '',
    totalAmount: '',
    issueDate: '',
    term1DueDate: '',
    term1Amount: '',
    term2DueDate: '',
    term2Amount: '',
    advanceAmount: '',
    advanceInstallmentCount: '1'
  });

  // PERSONEL MODALI (EKLE / DÜZENLE + PRİM ALANI DAHİL)
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | string | null>(null);
  const emptyEmpTx = {
    type: 'bonus' as 'bonus' | 'advance' | 'installment_advance',
    date: new Date().toISOString().split('T')[0],
    title: '',
    amount: '',
    inst: '1'
  };
  const [newEmpTx, setNewEmpTx] = useState(emptyEmpTx);
 const [employeeFormData, setEmployeeFormData] = useState({
    fullName: '',
    roleTitle: 'Kamyon Şoförü / Dağıtım',
    baseSalary: '',
    employerSgk: '',
    phone: '',
    iban: '',
    monthlyBonus: '',
    bonusDescription: '',
    monthlyAdvance: '',
    advanceDescription: '',
    hireDate: ''
  });

  // GENEL GİDER DÜZENLEME / EKLEME MODALI
  const [isGeneralExpenseModalOpen, setIsGeneralExpenseModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [expenseFormData, setExpenseFormData] = useState({
    category: 'maintenance',
    companyName: '',
    plateNumber: '',
    vehicleCharge: '' as '' | VehicleChargeKind,
    invoiceNo: '',
    amount: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    status: 'unpaid',
    paidSource: 'bank'
  });
  const emptySupplierAdvance = {
    companyName: '',
    actionType: 'advance' as 'advance' | 'installment_advance',
    amount: '',
    installmentCount: '2',
    paidSource: 'bank' as 'bank' | 'cash' | 'card',
    date: new Date().toISOString().split('T')[0],
    note: ''
  };
  const [isOutflowPickerOpen, setIsOutflowPickerOpen] = useState(false);
  const [isSupplierAdvanceModalOpen, setIsSupplierAdvanceModalOpen] = useState(false);
  const [supplierAdvanceForm, setSupplierAdvanceForm] = useState(emptySupplierAdvance);
  const [isOverviewEmpAdvanceOpen, setIsOverviewEmpAdvanceOpen] = useState(false);
  const [overviewEmpAdvance, setOverviewEmpAdvance] = useState({
    empId: '' as number | string | '',
    type: 'advance' as 'advance' | 'installment_advance',
    date: new Date().toISOString().split('T')[0],
    title: 'Personel avansı',
    amount: '',
    inst: '1',
    paidSource: 'bank' as 'bank' | 'cash' | 'card'
  });

  // ARAÇ MODALI
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);
  const [vehicleFormData, setVehicleFormData] = useState({
    plateNumber: '',
    driverName: '',
    brandModel: '',
    documentIncluded: 'VAR',
    trackingSystem: 'Var',
    fuelSystem: 'UTTS',
    hgsSystem: 'SHELL',
    vehicleType: 'Kamyon',
    ownershipType: 'Öz Mal',
    isActive: true,
    nextInspectionDate: '',
    inspectionCost: '',
    insuranceCompany: '',
    insuranceCost: '',
    insuranceStartDate: '',
    kaskoCompany: '',
    kaskoCost: '',
    kaskoStartDate: '',
    lastMtvCost: ''
  });

  // ÇEKMECE STATE
  const [drawerData, setDrawerData] = useState<{
    isOpen: boolean;
    type: 'vehicle' | 'employee' | 'contractor' | 'customer';
    title: string;
    subtitle?: string;
    items?: any[];
    vehicleSummary?: any;
    meta?: any;
  }>({
    isOpen: false,
    type: 'vehicle',
    title: ''
  });

 // 6. TAŞERON IBAN EŞLEŞTİRME HARİTASI (TÜRKÇE VE BOŞLUK KORUMALI)
  const subIbanMap = useMemo(() => {
    const map = new Map<string, string>();
    dbSubcontractors.forEach(s => {
      const iban = String(s.iban || '').trim();
      if (!iban) return;
      [s.name, s.company_name].forEach(n => {
        const k = normalizeContractorKey(n || '');
        if (k) map.set(k, iban);
      });
    });
    return map;
  }, [dbSubcontractors]);

  // TOPLU ALTYÜKLENİCİ IBAN EXCELİ YÜKLEME
  const handleImportSubIbanExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      const uniqueMap = new Map<string, string>();
      rawRows.forEach(row => {
        const nameVal = String(row['alt yüklenici'] || row['Alt Yüklenici'] || row['Ad Soyad'] || row['Firma'] || row['Unvanı/Adı Soyadı'] || '').trim();
        let ibanVal = String(row['IBAN'] || row['Iban'] || '').trim().replace(/\t/g, '');

        if (nameVal && ibanVal) {
          uniqueMap.set(nameVal, formatIBAN(ibanVal));
        }
      });

      if (uniqueMap.size === 0) {
        alert('Excel dosyasında "alt yüklenici" ve "IBAN" sütunları bulunamadı!');
        return;
      }

      const insertRows = Array.from(uniqueMap.entries()).map(([name, iban]) => ({ name, iban }));

      const { error } = await supabase.from('subcontractors').upsert(insertRows, { onConflict: 'name' });
      if (error) throw error;

      alert(`${insertRows.length} adet alt yüklenici IBAN bilgisi başarıyla içeri aktarıldı ve eşleştirildi!`);
      loadPortalData();
    } catch (err: any) {
      alert('IBAN Excel yükleme hatası: ' + err.message);
    }
  };

 // MÜKERRER KORUMALI & EXCEL TARİH HATASIZ TAŞERON FATURA AKTARIMI
  const handleImportSubcontractorInvoicesSafe = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const normalizeKey = (text: string) =>
      (text || '').toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]/g, '');
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExcelUploading(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

      // Excel satırlarını dizi olarak alıyoruz (0=A, 1=B, 2=C, 3=D, 4=E, 5=F, 6=G)
      const rawRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

      const existingInvoicesMap = new Map<string, any>();
      dbInvoices
        .filter(i => i.category === 'subcontractor_invoice')
        .forEach(i => existingInvoicesMap.set(normalizeKey(String(i.invoice_no || '')), i));

      const newRowsToInsert: any[] = [];
      let skippedCount = 0;

      // 0. satır başlıklar olduğu için i=1'den başlıyoruz
      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || !Array.isArray(row) || row.length === 0) continue;

        const subName = String(row[1] || '').trim(); // B Sütunu (Ünvan)
        const invNo = String(row[3] || '').trim();   // D Sütunu (Fatura No)
        const rawDate = row[4];                      // E Sütunu (Tarih)
        const totalAmt = cleanNumber(row[6]);         // G Sütunu (ÖDENECEK NET TUTAR)

        if (!invNo || !subName || totalAmt <= 0) continue;

        const rowDate = sanitizeDate(rawDate) || new Date().toISOString().split('T')[0];
        const fullTitle = `${invNo} - ${subName}`.trim();
        const normKey = normalizeKey(fullTitle);

        const t1 = totalAmt / 2;
        const t2 = totalAmt / 2;
        const termDates = defaultContractorTermDates(rowDate);

        if (existingInvoicesMap.has(normKey)) {
          skippedCount++;
          continue;
        } else {
          // Sistemde yoksa: Yeni kayıt olarak ekle
          newRowsToInsert.push({
            invoice_no: fullTitle,
            direction: 'incoming',
            category: 'subcontractor_invoice',
            total_amount: totalAmt,
            issue_date: rowDate,
            due_date: termDates.term1 || rowDate,
            term1_due_date: termDates.term1 || rowDate,
            term1_amount: t1,
            term1_status: 'unpaid',
            term2_due_date: termDates.term2 || rowDate,
            term2_amount: t2,
            term2_status: 'unpaid',
            status: 'unpaid'
          });
          existingInvoicesMap.set(normKey, true);
        }
      }

      if (newRowsToInsert.length > 0) {
        const { error } = await supabase.from('invoices').insert(newRowsToInsert);
        if (error) throw error;
      }

      alert(`İşlem başarılı.\n• ${newRowsToInsert.length} yeni fatura eklendi.\n• ${skippedCount} fatura zaten kayıtlıydı, atlandı (yeniden yüklemeniz gerekmez).`);
      await loadPortalData();
    } catch (err: any) {
      console.error(err);
      alert('Excel aktarım hatası: ' + (err.message || 'Bilinmeyen hata'));
    } finally {
      setIsExcelUploading(false);
      e.target.value = '';
    }
  };

  // TOPLU SATIŞ FATURASI EXCELİ YÜKLEME (Fatura no & Düzenleme tarihi UYUMLU)
  const handleImportSalesInvoicesExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      const existingInvoices = new Set(
        dbInvoices
          .filter(i => i.category === 'freight_sales' || i.direction === 'outgoing')
          .map(i => String(i.invoice_no || '').trim().toUpperCase())
      );

      const parsedRows = rawRows.map((row: any) => {
        const invNo = String(
          row['Fatura no'] || 
          row['Fatura No'] || 
          row['Fatura Numarası'] || 
          row['Belge No'] || 
          ''
        ).trim();
        const excelCust = String(
          row['Müşteri'] || 
          row['Cari'] || 
          row['Unvan'] || 
          row['Firma Adı'] || 
          row['Alıcı'] || 
          row['Müşteri Adı'] ||
          ''
        ).trim();
        const excelTax = String(row['VKN'] || row['Vergi No'] || row['Vergi Numarası'] || row['TCKN'] || '').trim();
        const totalAmt = cleanNumber(row['Genel Toplam'] || row['Tutar'] || row['Toplam Tutar'] || row['Ödenecek Tutar']);
        const rawDate = row['Düzenleme tarihi'] || row['Tarih'] || row['Fatura Tarihi'];
        const rowIssueDate = sanitizeDate(rawDate) || new Date().toISOString().split('T')[0];
        const rawDueDate = row['Vade'] || row['Vade Tarihi'];
        const rowDueDate = sanitizeDate(rawDueDate) || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
        const description = String(
          row['Açıklama'] ||
          row['Fatura Açıklaması'] ||
          row['Fatura aciklamasi'] ||
          row['Mal/Hizmet'] ||
          row['Mal Hizmet'] ||
          row['Konu'] ||
          row['Not'] ||
          row['Fatura Notu'] ||
          row['Açıklamalar'] ||
          row['Description'] ||
          ''
        ).trim();
        return { invNo, excelCust, excelTax, totalAmt, rowIssueDate, rowDueDate, description };
      });

      let customersForMatch: Customer[] = [...dbCustomers];
      const pendingCards = new Map<string, { name: string; tax_id: string | null }>();

      parsedRows.forEach(row => {
        if (!row.excelCust) return;
        if (matchCustomer(row.excelCust, row.excelTax, customersForMatch)) return;
        const key = `${row.excelCust.trim().toLocaleUpperCase('tr-TR')}|${row.excelTax.replace(/\D/g, '')}`;
        if (!pendingCards.has(key)) {
          pendingCards.set(key, {
            name: row.excelCust.trim(),
            tax_id: row.excelTax.replace(/\D/g, '') || null
          });
        }
      });

      let createdCustomerCount = 0;
      if (pendingCards.size > 0) {
        const toInsert = [...pendingCards.values()];
        const { data: created, error: custErr } = await supabase
          .from('customers')
          .upsert(toInsert, { onConflict: 'name' })
          .select('id, name, tax_id, tax_office, address, phone, email, notes');
        if (custErr) throw custErr;
        createdCustomerCount = toInsert.length;
        (created || []).forEach((c: Customer) => {
          const idx = customersForMatch.findIndex(x => x.name === c.name);
          if (idx >= 0) customersForMatch[idx] = c;
          else customersForMatch.push(c);
        });
      }

      const newRowsToInsert: any[] = [];
      let skippedCount = 0;

      parsedRows.forEach(row => {
        const matched = matchCustomer(row.excelCust, row.excelTax, customersForMatch);
        const custName = matched?.name || row.excelCust;
        const fullTitle = `${row.invNo} - ${custName}`.trim();

        if (existingInvoices.has(fullTitle.toUpperCase()) || (row.invNo && existingInvoices.has(row.invNo.toUpperCase()))) {
          skippedCount++;
        } else if (row.invNo && row.totalAmt > 0 && custName) {
          newRowsToInsert.push({
            invoice_no: fullTitle,
            direction: 'outgoing',
            category: 'freight_sales',
            total_amount: row.totalAmt,
            issue_date: row.rowIssueDate,
            due_date: row.rowDueDate,
            status: 'unpaid',
            description: row.description || null
          });
        }
      });

      if (newRowsToInsert.length > 0) {
        let { error } = await supabase.from('invoices').insert(newRowsToInsert);
        if (error && /description/i.test(String(error.message || ''))) {
          const retry = newRowsToInsert.map(({ description: _d, ...rest }) => rest);
          const second = await supabase.from('invoices').insert(retry);
          error = second.error;
          if (!error) {
            alert('Faturalar yüklendi ama açıklama kolonu yok. Supabase SQL Editor’da setup_invoice_description.sql dosyasını bir kez Run deyin, sonra Excel’i tekrar yükleyin.');
          }
        }
        if (error) throw error;
      }

      alert(
        `Satış Faturaları İçe Aktarıldı!\n• ${newRowsToInsert.length} adet yeni satış faturası eklendi.\n• ${skippedCount} adet mevcut fatura mükerrer olmaması için atlandı.` +
        (createdCustomerCount
          ? `\n• ${createdCustomerCount} yeni müşteri kartı otomatik açıldı. Müşteri Kartları menüsünden VKN ve iletişim bilgilerini tamamlayabilirsiniz.`
          : '')
      );
      loadPortalData();
    } catch (err: any) {
      alert('Satış faturası yükleme hatası: ' + err.message);
    } finally {
      e.target.value = '';
    }
  };

  // 7. GENEL GÖRÜNÜM ALARM ANALİZİ (DOKUNULMAYAN SABİT BLOK)
  const alertAnalysis = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayObj = new Date();
    const currentMonth = todayObj.getMonth();

    const overdueSales: any[] = [];
    const pendingDebts: any[] = [];
    const creditCardsAlerts: any[] = [];
    const vehicleAlerts: any[] = [];

    dbInvoices
      .filter(i => (i.category === 'freight_sales' || i.direction === 'outgoing') && i.status !== 'paid' && i.due_date)
      .forEach(s => {
        const diff = Math.ceil((new Date(sanitizeDate(s.due_date)).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 0) overdueSales.push({ ...s, diffDays: diff });
      });

    dbInvoices
      .filter(i => i.status !== 'paid' && i.due_date && ![
        'customer_collection', 'freight_sales', 'cash_deposit', 'customer_advance',
        'subcontractor_advance_paid', 'subcontractor_paid_outflow', 'salary_payroll',
        'subcontractor_invoice', 'opening_balance', 'supplier_advance', 'employee_advance_paid'
      ].includes(i.category))
      .forEach(d => {
        const due = sanitizeDate(d.due_date);
        const diff = daysUntilDate(due);
        if (diff === null || diff > 3) return;
        const alertAmount = cleanNumber(d.total_amount);
        if (alertAmount > 0) pendingDebts.push({ ...d, diffDays: diff, alertAmount, due });
      });
    pendingDebts.sort((a, b) => (a.diffDays - b.diffDays) || (a.due || '').localeCompare(b.due || ''));

   dbCreditCards.forEach(cc => {
      const stmtAmt = cleanNumber(cc.statement_amount);
      if (stmtAmt > 0) {
        let diff = 0;
        if (cc.due_date) {
          diff = Math.ceil((new Date(sanitizeDate(cc.due_date)).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
        }
        // Ekstre borcu varsa ve vadesi geçmiş veya 15 gün içindeyse ana ekranda göster
        if (diff <= 15) {
          creditCardsAlerts.push({ ...cc, diffDays: diff, cleanStmtAmt: stmtAmt });
        }
      }
    });

    dbVehicles.forEach(v => {
      if (v.insurance_expiry_date) {
        const diff = Math.ceil((new Date(sanitizeDate(v.insurance_expiry_date)).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 15) vehicleAlerts.push({ title: `${v.plate_number} Sigortası Bitiyor`, date: v.insurance_expiry_date, diffDays: diff });
      }
      if (v.kasko_expiry_date) {
        const diff = Math.ceil((new Date(sanitizeDate(v.kasko_expiry_date)).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 15) vehicleAlerts.push({ title: `${v.plate_number} Kaskosu Bitiyor`, date: v.kasko_expiry_date, diffDays: diff });
      }
    });

    return {
      overdueSales,
      pendingDebts,
      creditCardsAlerts,
      vehicleAlerts,
      isMtvPeriod: currentMonth === 0 || currentMonth === 6
    };
  }, [dbInvoices, dbCreditCards, dbVehicles]);

 // 8. FİNANSAL FORMÜLLER (KESİN MUTABAKAT VE FİİLİ KASA HESAPLAMA MOTORU)
  const isDateInRange = (dateStr: string | null) => {
    const d = sanitizeDate(dateStr);
    if (!d) return false;
    if (!filterStartDate && !filterEndDate) return true;
    if (filterStartDate && d < filterStartDate) return false;
    if (filterEndDate && d > filterEndDate) return false;
    return true;
  };

  // Dönem KPI: yalnızca belge / tahsilat tarihi (created_at Kasım’a yığılmasın)
  const filteredInvoices = dbInvoices.filter(i => isDateInRange(i.issue_date));

  const isOzMalVehicle = (v: any) => {
    const t = String(v.ownership_type || 'Öz Mal').toLocaleLowerCase('tr-TR');
    return t.includes('öz') || t.includes('oz mal') || t.includes('ozmal') || !String(v.ownership_type || '').trim();
  };

  const isActiveVehicle = (v: any) => v.is_active !== false;

  const normalizeVehicleType = (raw: string) => {
    const t = String(raw || '').toLocaleLowerCase('tr-TR');
    if (t.includes('binek') || t.includes('otomobil')) return 'Binek';
    if (t.includes('kamyonet')) return 'Kamyonet';
    if (t.includes('dorse')) return 'Dorse';
    if (t.includes('tır') || t === 'tir' || t.includes(' tir') || t.startsWith('tir')) return 'TIR';
    if (t.includes('kamyon')) return 'Kamyon';
    return 'Kamyon';
  };

  const isProfitVehicleType = (v: any) => {
    const t = normalizeVehicleType(v.vehicle_type);
    return t === 'Kamyonet' || t === 'Kamyon' || t === 'TIR';
  };

  const defaultProfitIncluded = (vehicleType: string) => {
    const t = normalizeVehicleType(vehicleType);
    return t === 'Kamyonet' || t === 'Kamyon' || t === 'TIR';
  };

  const saveMonthlyProfitInput = async (
    plate: string,
    field: 'invoice_rev' | 'fuel' | 'hgs' | 'included',
    raw: string | boolean
  ) => {
    if (!isAdmin) return;
    const plateKey = String(plate || '').trim();
    if (!plateKey) return;
    if (
      (field === 'invoice_rev' || field === 'fuel')
      && alkanFiloPlateKeys(dbTripPlates).has(filoPlateKey(plate))
    ) {
      return;
    }
    const veh = dbVehicles.find(v => String(v.plate_number).trim() === plateKey);
    const existing = monthlyInputRows.find(
      r => String(r.plate_number).trim() === plateKey && r.year_month === profitMonth
    );
    const includedDefault =
      typeof existing?.included === 'boolean'
        ? existing.included
        : defaultProfitIncluded(veh?.vehicle_type);
    const payload = {
      plate_number: plateKey,
      year_month: profitMonth,
      invoice_rev: field === 'invoice_rev' ? cleanNumber(raw) : cleanNumber(existing?.invoice_rev),
      fuel: field === 'fuel' ? cleanNumber(raw) : cleanNumber(existing?.fuel),
      hgs: field === 'hgs' ? cleanNumber(raw) : cleanNumber(existing?.hgs),
      included: field === 'included' ? !!raw : includedDefault,
      updated_at: new Date().toISOString()
    };
    setMonthlyInputRows(prev => {
      const idx = prev.findIndex(r => String(r.plate_number).trim() === plateKey && r.year_month === profitMonth);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...payload };
        return next;
      }
      return [...prev, payload];
    });
    const { error } = await supabase
      .from('vehicle_monthly_inputs')
      .upsert(payload, { onConflict: 'plate_number,year_month' });
    if (error) {
      alert('Ay verisi kaydedilemedi. setup_profit_month.sql dosyasını SQL Editor’da çalıştırın.\n' + error.message);
    }
  };

  const dbProfitability = useMemo(() => {
    const monthStart = `${profitMonth}-01`;
    const [yy, mm] = profitMonth.split('-').map(Number);
    const monthEndDate = new Date(yy, mm, 0);
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    const monthEnd = `${yy}-${pad(mm)}-${pad(monthEndDate.getDate())}`;

    return dbVehicles
      .filter(v => isOzMalVehicle(v) && isActiveVehicle(v) && isProfitVehicleType(v))
      .map(veh => {
      const plate = String(veh.plate_number || '').trim();
      const cleanPlate = plate.replace(/\s+/g, '').toUpperCase();
      const stored = monthlyInputRows.find(
        r => String(r.plate_number).trim() === plate && r.year_month === profitMonth
      );

      const invoice_rev = cleanNumber(stored?.invoice_rev);
      const fuel = cleanNumber(stored?.fuel);
      const hgs = cleanNumber(stored?.hgs);
      const vehicleType = normalizeVehicleType(veh.vehicle_type);
      const included =
        typeof stored?.included === 'boolean' ? stored.included : defaultProfitIncluded(veh.vehicle_type);

      let driver_sal = 0;
      let bonus = 0;
      let sgk = 0;
      const driver = veh.driver_name
        ? dbEmployees.find(emp => namesMatch(emp.full_name, veh.driver_name))
        : null;
        if (driver) {
        const hire = sanitizeDate(driver.hire_date);
        const share = hire ? employmentShareForMonth(hire, profitMonth) : { factor: 1 };
        if (share.factor > 0) {
          driver_sal = Math.round(cleanNumber(driver.base_salary) * share.factor * 100) / 100;
          bonus = Math.round(cleanNumber(driver.monthly_bonus) * share.factor * 100) / 100;
          const fullSgk =
            driver.employer_sgk === null || driver.employer_sgk === undefined || driver.employer_sgk === ''
              ? sgkDriverAmount
              : cleanNumber(driver.employer_sgk);
          sgk = Math.round(fullSgk * share.factor * 100) / 100;
        }
        (dbEmployeeTransactions || []).forEach((tx: any) => {
          if (String(tx.employee_id) !== String(driver.id) || tx.type !== 'bonus') return;
          const d = sanitizeDate(tx.transaction_date || tx.created_at);
          if (d >= monthStart && d <= monthEnd) bonus += cleanNumber(tx.total_amount);
        });
      }

      const round2 = (n: number) => Math.round(n * 100) / 100;
      const insurance_m = round2(cleanNumber(veh.insurance_cost) / 12);
      const kasko_m = round2(cleanNumber(veh.kasko_cost) / 12);
      const mtv_m = round2(cleanNumber(veh.last_mtv_cost) / 12);
      const inspection_m = round2(cleanNumber(veh.inspection_cost) / 12);
      const fixed_monthly = round2(insurance_m + kasko_m + mtv_m + inspection_m);

      const yearStart = `${yy}-01-01`;
      const yearEnd = `${yy}-12-31`;
      const bakimYear = cleanPlate.length >= 5
        ? dbInvoices
            .filter(inv => {
              const d = sanitizeDate(inv.issue_date || inv.created_at);
              if (d < yearStart || d > yearEnd) return false;
              if (!['maintenance', 'tires'].includes(String(inv.category || ''))) return false;
              const haystack = `${inv.invoice_no || ''} ${inv.description || ''}`.replace(/\s+/g, '').toUpperCase();
              return haystack.includes(cleanPlate);
            })
            .reduce((sum, inv) => sum + cleanNumber(inv.total_amount), 0)
        : 0;
      const bakim = round2(bakimYear / 12);

      const payroll = driver_sal + bonus;
      const totalCost = payroll + sgk + fuel + hgs + fixed_monthly + bakim;
      const netProfit = invoice_rev - totalCost;

      return {
        id: veh.id,
        vehicle: veh,
        month_year: profitMonth,
        plate_number: plate,
        driver_name: veh.driver_name || '',
        invoice_rev,
        fuel,
        hgs,
        driver_sal,
        bonus,
        payroll,
        sgk,
        insurance_m,
        kasko_m,
        mtv_m,
        inspection_m,
        fixed_monthly,
        bakim,
        bakimYear,
        totalCost,
        netProfit,
        included,
        vehicleType
      };
    });
  }, [dbVehicles, dbEmployees, dbEmployeeTransactions, dbInvoices, monthlyInputRows, profitMonth, sgkDriverAmount]);

  // Seçilen dönem satış cirosu
  const totalPeriodSalesRevenue = filteredInvoices
    .filter(i => i.direction === 'outgoing' || i.category === 'freight_sales')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const salesInvoiceKeySet = useMemo(() => {
    const keys = new Set<string>();
    (dbInvoices || []).forEach((i: any) => {
      if (i.category === 'freight_sales' || i.direction === 'outgoing') {
        extractSalesInvoiceKeys(i.invoice_no).forEach(k => keys.add(k));
        const first = String(i.invoice_no || '').split(' - ')[0].trim().toUpperCase().replace(/\s+/g, '');
        if (first.length >= 8) keys.add(first);
      }
    });
    return keys;
  }, [dbInvoices]);

  const isSalesDocumentClone = (inv: any) => {
    if (isCrcTahsilatDoc(inv)) return false;
    const no = String(inv.invoice_no || '');
    const keys = extractSalesInvoiceKeys(no);
    const first = no.replace(/^\s*THS\s*-\s*/i, '').split(' - ')[0].trim().toUpperCase().replace(/\s+/g, '');
    const hitKeys = [
      ...keys.filter(k => salesInvoiceKeySet.has(k)),
      ...(first.length >= 8 && salesInvoiceKeySet.has(first) ? [first] : [])
    ];
    if (!hitKeys.length) return false;
    const cat = String(inv.category || '');
    if (cat !== 'customer_collection' && cat !== 'customer_advance') return true;
    const amt = cleanNumber(inv.total_amount);
    const sameAmount = (dbInvoices || []).some((s: any) => {
      if (s === inv || s?.id === inv?.id) return false;
      if (s.category !== 'freight_sales' && s.direction !== 'outgoing') return false;
      if (isCrcTahsilatDoc(s)) return false;
      if (!amountsClose(cleanNumber(s.total_amount), amt, 0.05)) return false;
      const sk = extractSalesInvoiceKeys(s.invoice_no);
      const sf = String(s.invoice_no || '').split(' - ')[0].trim().toUpperCase().replace(/\s+/g, '');
      return hitKeys.some(k => sk.includes(k) || sf === k);
    });
    return sameAmount;
  };

  // Banka girişi: Para Ekle + ekrandan girilen THS. Excel satış kopyası kasaya yazılmaz.
  const looksLikeSalesInvoiceNo = (no: string) => {
    if (isAppBankReceiptTitle(no) || /^\s*THS\s*-/i.test(String(no || ''))) return false;
    return extractSalesInvoiceKeys(no).length > 0;
  };
  const isBankCashIn = (inv: any) => {
    const cat = String(inv.category || '');
    if (String(inv.id || '').startsWith('migros_bank_')) return true;
    if (cat === 'cash_deposit') return true;
    if (cat !== 'customer_collection' && cat !== 'customer_advance') return false;
    const no = String(inv.invoice_no || '');
    const invoiceLinked = isInvoiceLinkedReceiptTitle(no) || isSalesDocumentClone(inv);
    if (invoiceLinked && (isMainMigrosName(no) || isAtifAltunisikName(no))) return false;
    if (invoiceLinked && !isAppBankReceiptTitle(no)) return false;
    if (isAppBankReceiptTitle(no)) {
      if (isMainMigrosName(no)) {
        const d = sanitizeDate(inv.issue_date);
        if (d && d <= MIGROS_BANK_LOCK_UNTIL) return false;
      }
      return true;
    }
    if (isEArchiveNoiseTitle(inv.invoice_no)) return false;
    const d = sanitizeDate(inv.issue_date);
    if (d && d <= MIGROS_BANK_LOCK_UNTIL) {
      return MIGROS_BANK_TRANSFERS.some(t => t.date === d && amountsClose(cleanNumber(inv.total_amount), t.amount, 1));
    }
    return false;
  };

  const totalOpenSalesAllTime = dbInvoices
      .filter(i => (i.direction === 'outgoing' || i.category === 'freight_sales') && i.status !== 'paid' && !isCrcTahsilatDoc(i))
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  // ÖDENMEMİŞ TAŞERON BORÇLARI (Vadeler ödendikçe buradan düşer)
  let unpaidSubcontractorDebt = 0;
  dbInvoices
    .filter(i => i.category === 'subcontractor_invoice')
    .forEach(inv => {
      const t1 = cleanNumber(inv.term1_amount || (inv.total_amount / 2));
      const t2 = cleanNumber(inv.term2_amount || (inv.total_amount / 2));
      if (inv.term1_status !== 'paid') unpaidSubcontractorDebt += t1;
      if (inv.term2_status !== 'paid') unpaidSubcontractorDebt += t2;
    });

  // DEVLET BORÇLARI
  const totalGovernmentPaymentsDebt = dbInvoices
    .filter(i => i.status !== 'paid' && ['taxes_sgk', 'traffic_fines'].includes(i.category))
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  // TEMEL DİĞER TEDARİK FATURALARI
  const totalGeneralCompanyExpensesDebt = dbInvoices
    .filter(i => i.status !== 'paid' && !['subcontractor_invoice', 'customer_collection', 'freight_sales', 'taxes_sgk', 'traffic_fines', 'salary_payroll', 'cash_deposit', 'customer_advance', 'subcontractor_advance_paid', 'subcontractor_paid_outflow', 'opening_balance', 'supplier_advance', 'employee_advance_paid'].includes(i.category))
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

// PERSONEL GELECEK ÖDEMESİ (Yeni cari defter ve net hakediş ile tam uyumlu)
  const totalEmployeeFutureDebt = useMemo(() => {
    return (dbEmployees || []).reduce((sum, emp) => sum + employeeUnpaidFromBooks(emp), 0);
  }, [dbEmployees, dbAdvances, dbEmployeeTransactions, dbInvoices]);

  const contractorAdvanceRemaining = (dbAdvances || [])
    .filter((a: any) => a.target_type === 'contractor')
    .reduce((sum: number, a: any) => {
      const remaining = a.remaining_amount !== undefined && a.remaining_amount !== null
        ? a.remaining_amount
        : a.total_amount;
      return sum + cleanNumber(remaining);
    }, 0);

  const unpaidSubcontractorNet = Math.max(0, unpaidSubcontractorDebt - contractorAdvanceRemaining);

  const otherPayableDebt = totalGovernmentPaymentsDebt + totalGeneralCompanyExpensesDebt + totalEmployeeFutureDebt;
  const totalConsolidatedDebt = unpaidSubcontractorNet + otherPayableDebt;

  const cashInCategories = new Set(['customer_collection', 'customer_advance', 'cash_deposit']);
  const isExpensePaidByCard = (inv: any) =>
    String(inv.paid_source || '') === 'card' || /\[KK\]/i.test(String(inv.invoice_no || ''));
  const skipCashOut = new Set([
    'customer_collection',
    'customer_advance',
    'cash_deposit',
    'freight_sales',
    'subcontractor_invoice',
    'opening_balance'
  ]);
  const movementDate = (inv: any) => sanitizeDate(inv.issue_date);
  const isCashOutRow = (i: any) =>
    i.status === 'paid' &&
    !skipCashOut.has(String(i.category || '')) &&
    i.direction !== 'outgoing' &&
    !isExpensePaidByCard(i) &&
    !/\[AVANS MAHSUP/i.test(String(i.invoice_no || ''));
  const cashStartDate = CASH_BOOK_START;
  const cashSnapDate = cashStartDate;
  const inCashBook = (inv: any) => {
    const d = movementDate(inv);
    return !!d && d >= cashStartDate;
  };

  const pickUniqueContractorOutflows = (rows: any[]) => {
    const kept: any[] = [];
    rows.forEach(inv => {
      const no = String(inv.invoice_no || '');
      const name = extractContractorName(no);
      const d = sanitizeDate(inv.issue_date || inv.created_at);
      const amt = cleanNumber(inv.total_amount);
      if (kept.some(k =>
        contractorRecordsMatch(name, extractContractorName(k.invoice_no || '')) &&
        sanitizeDate(k.issue_date || k.created_at) === d &&
        amountsClose(cleanNumber(k.total_amount), amt, 0.05)
      )) return;
      kept.push(inv);
    });
    return kept.filter(inv => {
      const no = String(inv.invoice_no || '');
      if (!isExplodedInvoiceTermPay(no)) return true;
      const name = extractContractorName(no);
      const d = sanitizeDate(inv.issue_date || inv.created_at);
      return !kept.some(k =>
        k !== inv &&
        sanitizeDate(k.issue_date || k.created_at) === d &&
        contractorRecordsMatch(name, extractContractorName(k.invoice_no || '')) &&
        isAnonymousBankPay(String(k.invoice_no || ''))
      );
    });
  };

  const cashInRows = (() => {
    const rows: any[] = [];
    const seen = new Set<string>();
    const push = (inv: any) => {
      if (!isBankCashIn(inv) || !inCashBook(inv)) return;
      const d = sanitizeDate(inv.issue_date);
      const no = String(inv.invoice_no || '');
      const kurus = Math.round(cleanNumber(inv.total_amount) * 100);
      const halKasa = /^Hal saha teslim /i.test(no) || /^Hal tahsilat /i.test(no);
      const key = halKasa ? `hal|${inv.id || no}` : `${d}|${kurus}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(inv);
    };
    if (portalDataReady) {
      MIGROS_BANK_TRANSFERS.forEach(t => {
        push({
          id: 'migros_bank_' + t.date,
          invoice_no: `BANKA - ${t.label}`,
          category: 'customer_advance',
          issue_date: t.date,
          total_amount: t.amount,
          status: 'paid'
        });
      });
      (dbInvoices || []).forEach((inv: any) => {
        const no = String(inv.invoice_no || '');
        if (/^Hal saha teslim /i.test(no) || /^Hal tahsilat /i.test(no)) return;
        push(inv);
      });
      (dbHalHandovers || []).forEach((h: any) => {
        const amt = cleanNumber(h.amount);
        if (amt <= 0) return;
        const d = sanitizeDate(halHandoverBookDate(h) || h.hand_date || h.created_at);
        push({
          id: 'hal_hand_' + h.id,
          invoice_no: `Hal saha teslim ${d} ${amt}`,
          category: 'cash_deposit',
          issue_date: d,
          total_amount: amt,
          status: 'paid'
        });
      });
      (dbHalEntries || []).forEach((e: any) => {
        if (!isHalMerkezTahsil(e)) return;
        const amt = cleanNumber(e.collected);
        if (amt <= 0) return;
        push({
          id: 'hal_merkez_' + e.id,
          invoice_no: `Hal tahsilat ${e.id}`,
          category: 'cash_deposit',
          issue_date: sanitizeDate(e.entry_date),
          total_amount: amt,
          status: 'paid'
        });
      });
    }
    return rows;
  })();
  const totalCollectedCash = cashInRows
    .filter((i: any) => isDateInRange(i.issue_date))
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);
  const cashOutCandidates = (dbInvoices || []).filter((i: any) => isCashOutRow(i) && inCashBook(i));
  const cashOutRows = [
    ...cashOutCandidates.filter((i: any) => i.category !== 'subcontractor_paid_outflow'),
    ...pickUniqueContractorOutflows(cashOutCandidates.filter((i: any) => i.category === 'subcontractor_paid_outflow'))
  ];
  const cashInflow = cashInRows.reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);
  const cashOutflow = cashOutRows.reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);
  const openingMatchesStart = sanitizeDate(cashOpeningAsOf) === cashStartDate;
  const cashBookOpening = openingMatchesStart ? cashOpening : CASH_BOOK_OPENING;
  const currentRealCash = CASH_APPLY_AFTER_OPENING
    ? cashBookOpening + cashInflow - cashOutflow
    : cashBookOpening;

  const periodCashOutCandidates = (dbInvoices || []).filter((i: any) =>
    i.status === 'paid' &&
    !skipCashOut.has(String(i.category || '')) &&
    i.direction !== 'outgoing' &&
    isDateInRange(i.issue_date) &&
    !isExpensePaidByCard(i)
  );
  const periodExpenseRows = [
    ...periodCashOutCandidates.filter((i: any) => i.category !== 'subcontractor_paid_outflow'),
    ...pickUniqueContractorOutflows(periodCashOutCandidates.filter((i: any) => i.category === 'subcontractor_paid_outflow'))
  ];
  const totalPeriodPaidExpenses = periodExpenseRows.reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);
  const periodIncomeRows = cashInRows.filter((i: any) => isDateInRange(i.issue_date));

  const cashLedgerView = useMemo(() => {
    const from = cashLedgerFrom || cashStartDate;
    const to = cashLedgerTo || new Date().toISOString().split('T')[0];
    const labelOf = (inv: any, inflow: number) => {
      const cat = String(inv.category || '');
      const no = String(inv.invoice_no || '');
      if (inflow > 0) {
        if (/^Hal saha teslim /i.test(no) || /^Hal tahsilat /i.test(no)) return 'Hal kasa aktarımı';
        if (cat === 'cash_deposit') return 'Kasaya para ekle';
        return 'Müşteri tahsilatı';
      }
      return 'Kasa çıkışı';
    };
    type CashLine = {
      id: any;
      date: string;
      label: string;
      title: string;
      inflow: number;
      outflow: number;
      kind: 'live' | 'ghost' | 'open';
    };
    const txs: CashLine[] = [];
    const pushInv = (inv: any, inflow: number, outflow: number) => {
      const date = sanitizeDate(inv.issue_date);
      if (!date) return;
      const cat = String(inv.category || '');
      const amt = inflow || outflow;
      if (amt <= 0) return;
      let title = String(inv.invoice_no || '');
      const label = labelOf(inv, inflow);
      if (cat === 'credit_card_payment') {
        const no = title;
        const card = (dbCreditCards || []).find((c: any) => no.includes(String(c.card_name || '')) || (c.last_four_digits && no.includes(String(c.last_four_digits))));
        const last4 = String(card?.last_four_digits || '').replace(/\D/g, '').slice(-4);
        title = `${card?.card_name || no} · ${last4 ? `**** ${last4}` : 'kart no yok'} · Nakit ödeme yapıldı`;
      }
      txs.push({ id: inv.id, date, label, title, inflow, outflow, kind: 'live' });
    };
    cashInRows.forEach((inv: any) => pushInv(inv, cleanNumber(inv.total_amount), 0));
    cashOutRows.forEach((inv: any) => pushInv(inv, 0, cleanNumber(inv.total_amount)));

    const live = txs.filter(t => t.kind === 'live' && t.date >= cashStartDate);
    let startBal = cashBookOpening;
    live.forEach(t => {
      if (t.date < from) startBal += t.inflow - t.outflow;
    });

    const inRange = txs.filter(t => t.date >= from && t.date <= to);
    const events: CashLine[] = [...inRange];
    events.push({
      id: 'open',
      date: from < cashStartDate ? cashStartDate : from,
      label: 'Kasa açılış',
      title: `${formatDateTR(cashStartDate)} kasa açılışı. Bu sabahki banka bakiyesi; o günden sonraki giriş eklenir, çıkış düşer.`,
      inflow: 0,
      outflow: 0,
      kind: 'open'
    });
    const rank = (k: CashLine['kind']) => (k === 'ghost' ? 0 : k === 'open' ? 1 : 2);
    events.sort((a, b) => a.date.localeCompare(b.date) || rank(a.kind) - rank(b.kind) || a.title.localeCompare(b.title, 'tr'));

    let run = startBal;
    const lines = events.map(t => {
      if (t.kind === 'ghost') return { ...t, balance: null as number | null, isHist: true, isOpen: false };
      if (t.kind === 'open') {
        return { ...t, balance: run, isHist: false, isOpen: true };
      }
      run += t.inflow - t.outflow;
      return { ...t, balance: run, isHist: false, isOpen: false };
    }).reverse();
    const liveInRange = live.filter(t => t.date >= from && t.date <= to);
    return {
      from,
      to,
      startBal,
      endBal: run,
      periodIn: liveInRange.reduce((s, t) => s + t.inflow, 0),
      periodOut: liveInRange.reduce((s, t) => s + t.outflow, 0),
      lines
    };
  }, [dbInvoices, dbCreditCards, cashLedgerFrom, cashLedgerTo, cashInRows, cashOutRows, cashBookOpening, cashStartDate]);

  // 9. MÜŞTERİ SATIŞLARI (MİGROS & GERÇEK CARİ EŞLEŞMESİ)
  const salesDetailedList = useMemo(() => {
    return dbInvoices
      .filter(i => (i.category === 'freight_sales' || i.direction === 'outgoing') && !isCrcTahsilatDoc(i))
      .map(inv => {
        let cust = '';
        let fNo = inv.invoice_no || '';

        if (fNo.includes(' - ')) {
          const parts = fNo.split(' - ');
          fNo = parts[0].trim();
          cust = parts.slice(1).join(' - ').trim();
        }

        const matched = resolveInvoiceCustomer(inv, dbCustomers, dbInvoices) || matchCustomer(cust || fNo, '', dbCustomers);
        if (matched) cust = matched.name;
        else if (!cust) cust = 'Eşleşmeyen müşteri';

        return {
          ...inv,
          customerName: cust,
          cleanInvoiceNo: fNo
        };
      });
  }, [dbInvoices, dbCustomers]);

  const receiptOpenInvoices = useMemo(() => {
    const name = String(newReceiptFormData.customerName || '').trim();
    if (!name) return [];
    return salesDetailedList
      .filter(s => s.status !== 'paid' && String(s.customerName || '') === name)
      .sort((a, b) => String(b.issue_date || '').localeCompare(String(a.issue_date || '')));
  }, [salesDetailedList, newReceiptFormData.customerName]);

  const customerBalances = useMemo(() => {
    const belongsTo = (inv: any, customer: Customer) =>
      invoiceBelongsToCustomer(inv, customer, dbCustomers, dbInvoices);

    const rows = dbCustomers.map(customer => {
      const salesRaw = dbInvoices.filter(i => {
        if (!belongsTo(i, customer) || isCrcTahsilatDoc(i)) return false;
        if (isCrcSalesInvoiceDoc(i) || looksLikeSalesInvoiceNo(i.invoice_no)) return true;
        return i.category === 'freight_sales' || i.direction === 'outgoing';
      });
      const keysOf = (inv: any) => {
        const ks = extractSalesInvoiceKeys(inv.invoice_no);
        if (ks.length) return ks;
        const first = String(inv.invoice_no || '').split(/\s[-–—]\s/)[0].trim().toUpperCase().replace(/\s+/g, '');
        return first ? [first] : [`id:${inv.id}`];
      };
      const parent = new Map<string, string>();
      const find = (k: string): string => {
        const p = parent.get(k);
        if (!p || p === k) {
          parent.set(k, k);
          return k;
        }
        const r = find(p);
        parent.set(k, r);
        return r;
      };
      salesRaw.forEach(inv => {
        const ks = keysOf(inv);
        ks.forEach(k => find(k));
        for (let i = 1; i < ks.length; i++) {
          const a = find(ks[0]);
          const b = find(ks[i]);
          if (a !== b) parent.set(a, b);
        }
      });
      const groups = new Map<string, any[]>();
      salesRaw.forEach(inv => {
        const root = find(keysOf(inv)[0]);
        const arr = groups.get(root) || [];
        arr.push(inv);
        groups.set(root, arr);
      });
      const sales = Array.from(groups.values()).map(arr =>
        arr.slice().sort((a: any, b: any) => cleanNumber(b.total_amount) - cleanNumber(a.total_amount))[0]
      );

      const isCariReceipt = (i: any) => {
        if (!belongsTo(i, customer)) return false;
        if (isCrcSalesInvoiceDoc(i) || looksLikeSalesInvoiceNo(i.invoice_no)) return false;
        if (isCrcTahsilatDoc(i)) return true;
        const cat = String(i.category || '');
        if (cat !== 'customer_collection' && cat !== 'customer_advance') return false;
        if (isMainMigrosName(customer.name)) {
          const d = sanitizeDate(i.issue_date || i.created_at);
          if (d && d <= MIGROS_BANK_LOCK_UNTIL) return false;
          if (isSalesDocumentClone(i)) return false;
        }
        if (isAppBankReceiptTitle(i.invoice_no)) return true;
        if (isEArchiveNoiseTitle(i.invoice_no)) return false;
        if (isSalesDocumentClone(i)) return false;
        if (cat === 'customer_advance') return true;
        return true;
      };
      const sumAmt = (list: any[]) => list.reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);
      const ymOf = (inv: any) => sanitizeDate(inv.issue_date || inv.created_at).slice(0, 7);
      const receiptsAll = [
        ...(isMainMigrosName(customer.name)
          ? MIGROS_BANK_TRANSFERS.map(t => ({
              id: 'migros_bank_' + t.date,
              issue_date: t.date,
              total_amount: t.amount,
              category: 'customer_advance',
              invoice_no: `BANKA - ${t.label}`
            }))
          : []),
        ...dbInvoices.filter(isCariReceipt)
      ];
      const seenPay = new Set<string>();
      const receiptsUnique = receiptsAll.filter((i: any) => {
        const id = String(i.id || i.invoice_no || '');
        const k = id || `${sanitizeDate(i.issue_date)}|${Math.round(cleanNumber(i.total_amount) * 100)}`;
        if (seenPay.has(k)) return false;
        seenPay.add(k);
        return true;
      });
      const advancesLive = receiptsUnique.filter(i => i.category === 'customer_advance');
      const collectionsLive = receiptsUnique.filter(i => i.category === 'customer_collection');
      const billedAll = sumAmt(sales);
      const receiptsAllTime = sumAmt(receiptsUnique);
      let netLive = Math.round((billedAll - receiptsAllTime) * 100) / 100;
      if (isAtifAltunisikName(customer.name)) netLive = 0;

      const moneyYm = String(filterStartDate || '').slice(0, 7);
      const inSelectedYm = (list: any[]) =>
        !moneyYm ? sumAmt(list) : sumAmt(list.filter(i => ymOf(i) === moneyYm));
      const billedPeriod = inSelectedYm(sales);
      const billed = billedPeriod;
      const collectionsPeriod = inSelectedYm(collectionsLive);
      const advancesPeriod = inSelectedYm(advancesLive);
      const collections = collectionsPeriod;
      const advances = advancesPeriod;
      const receipts = advances + collections;
      const payments = receipts;
      const openSales = netLive;
      const net = netLive;
      return {
        customer,
        billed,
        billedPeriod,
        billedAll,
        receiptsAllTime,
        openSales,
        collections,
        advances,
        collectionsPeriod,
        advancesPeriod,
        receipts,
        payments,
        net,
        netLive
      };
    });

    return rows.sort((a, b) => b.net - a.net);
  }, [dbCustomers, dbInvoices, filterStartDate, filterEndDate]);

  const customerMoneyMonthLabel = yearMonthTrLabel(String(filterStartDate || '').slice(0, 7));

  const bekleyenMusteriAlacaklari = useMemo(
    () => customerBalances.reduce((s, r) => s + r.netLive, 0),
    [customerBalances]
  );
  const periodCustomerReceipts = useMemo(
    () => customerBalances.reduce((s, r) => s + r.advancesPeriod + r.collectionsPeriod, 0),
    [customerBalances]
  );
  const customerReceiptsAllTime = useMemo(
    () => customerBalances.reduce((s, r) => s + r.receiptsAllTime, 0),
    [customerBalances]
  );
  const customerBilledAllTime = useMemo(
    () => customerBalances.reduce((s, r) => s + r.billedAll, 0),
    [customerBalances]
  );
  const halCariKalanAll = useMemo(
    () => buildHalCari(dbHalFirms, dbHalEntries, '1970-01-01', '2099-12-31', cleanNumber)
      .reduce((s, r) => s + r.kalan, 0),
    [dbHalFirms, dbHalEntries]
  );
  const halCariPeriod = useMemo(() => {
    const from = filterStartDate || '1970-01-01';
    const to = filterEndDate || '2099-12-31';
    const rows = buildHalCari(dbHalFirms, dbHalEntries, from, to, cleanNumber);
    return {
      sefer: rows.reduce((s, r) => s + r.sefer, 0),
      tahsilat: rows.reduce((s, r) => s + r.tahsilat, 0)
    };
  }, [dbHalFirms, dbHalEntries, filterStartDate, filterEndDate]);
  const pendingReceivablesAllTime = Math.round((bekleyenMusteriAlacaklari + Math.max(0, halCariKalanAll)) * 100) / 100;

  const selectedCariLedger = useMemo(() => {
    if (!selectedCariCustomer) return [];
    const belongs = (inv: any) => invoiceBelongsToCustomer(inv, selectedCariCustomer, dbCustomers, dbInvoices);
    const lines: { date: string; type: string; title: string; debit: number; credit: number }[] = [];

    const migros = isMainMigrosName(selectedCariCustomer.name);
    dbInvoices.filter(belongs).forEach(inv => {
      const amt = cleanNumber(inv.total_amount);
      const date = sanitizeDate(inv.issue_date || inv.created_at) || '';
      const title = String(inv.invoice_no || '');
      if (isCrcSalesInvoiceDoc(inv) || looksLikeSalesInvoiceNo(title) || inv.category === 'freight_sales') {
        lines.push({ date, type: 'Satış faturası', title, debit: amt, credit: 0 });
        return;
      }
      if (inv.category === 'customer_advance' || inv.category === 'customer_collection' || isCrcTahsilatDoc(inv)) {
        if (isEArchiveNoiseTitle(title)) return;
        if (migros && date && date <= MIGROS_BANK_LOCK_UNTIL) return;
        if (migros && isSalesDocumentClone(inv)) return;
        lines.push({ date, type: 'Tahsilat', title, debit: 0, credit: amt });
      }
    });
    if (migros) {
      MIGROS_BANK_TRANSFERS.forEach(t => {
        lines.push({
          date: t.date,
          type: 'Tahsilat',
          title: t.label,
          debit: 0,
          credit: t.amount
        });
      });
    }

    lines.sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    return lines.map(line => {
      running += line.debit - line.credit;
      return { ...line, balance: running };
    });
  }, [selectedCariCustomer, dbInvoices, dbCustomers]);

  // SATIŞ TABLOSU İÇİN ARAMA VE BAŞLIĞA GÖRE SIRALAMA
  const [salesSearchQuery, setSalesSearchQuery] = useState('');
  const [salesStatusFilter, setSalesStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [salesSortConfig, setSalesSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'issue_date', direction: 'desc' });

  const displayedSalesList = useMemo(() => {
    let list = [...salesDetailedList];

    if (salesSearchQuery.trim()) {
      const q = salesSearchQuery.toLowerCase();
      list = list.filter(item => 
        (item.customerName && item.customerName.toLowerCase().includes(q)) ||
        (item.cleanInvoiceNo && item.cleanInvoiceNo.toLowerCase().includes(q)) ||
        (item.description && String(item.description).toLowerCase().includes(q))
      );
    }
    if (salesStatusFilter !== 'all') {
      list = list.filter(item => {
        const isPaid = item.status === 'paid';
        return salesStatusFilter === 'paid' ? isPaid : !isPaid;
      });
    }

    list.sort((a, b) => {
      let valA = a[salesSortConfig.key] || '';
      let valB = b[salesSortConfig.key] || '';

      if (salesSortConfig.key === 'total_amount') {
        valA = cleanNumber(valA);
        valB = cleanNumber(valB);
      }

      if (valA < valB) return salesSortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return salesSortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [salesDetailedList, salesSearchQuery, salesStatusFilter, salesSortConfig]);

  const handleSalesSort = (key: string) => {
    setSalesSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const openCariByName = (name: string) => {
    const c = matchCustomer(name, '', dbCustomers);
    if (c) setSelectedCariCustomer(c);
  };

  const exportCariExcel = (customer: Customer, ledger: typeof selectedCariLedger) => {
    const header = [
      ['Tazeyol ERP Cari Ekstre'],
      ['Müşteri', customer.name],
      ['VKN', customer.tax_id || ''],
      ['Telefon', customer.phone || ''],
      ['Döküm tarihi', new Date().toLocaleDateString('tr-TR')],
      [],
      ['Tarih', 'İşlem', 'Açıklama', 'Borç (Fatura)', 'Alacak (Ödeme)', 'Bakiye']
    ];
    const body = ledger.map(line => [
      line.date,
      line.type,
      line.title,
      line.debit || 0,
      line.credit || 0,
      line.balance
    ]);
    const kapanis = ledger.length ? ledger[ledger.length - 1].balance : 0;
    const safeName = customer.name.replace(/[\\/:*?"<>|]/g, ' ').slice(0, 40).trim();
    writeExcelAoa([
      ...header,
      ...body,
      [],
      ['', '', 'Kapanış bakiyesi', '', '', kapanis]
    ], `Tazeyol_Cari_${safeName}_${new Date().toISOString().split('T')[0]}.xlsx`, 'Cari');
  };

  const payrollMonthList = useMemo(() => {
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    let from = payrollFrom || '2020-01';
    let to = payrollTo || from;
    if (from > to) {
      const tmp = from;
      from = to;
      to = tmp;
    }
    const months: string[] = [];
    let [y, m] = from.split('-').map(Number);
    const [ty, tm] = to.split('-').map(Number);
    let guard = 0;
    while ((y < ty || (y === ty && m <= tm)) && guard < 120) {
      months.push(`${y}-${pad(m)}`);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      guard += 1;
    }
    return months;
  }, [payrollFrom, payrollTo]);

  const selectedPayrollLedger = useMemo(() => {
    if (!selectedPayrollEmp) return [];
    const emp = selectedPayrollEmp;
    const empIdStr = String(emp.id || '');
    const empNorm = foldPersonName(emp.full_name);
    const months = payrollMonthList;
    if (!months.length) return [];
    const startInfo = resolveEmployeeStart(emp);
    const booksFrom = employeeBooksFromYm(emp);
    const hire = sanitizeDate(emp.hire_date) || `${booksFrom}-01`;
    const hireYm = hire.slice(0, 7);
    const rangeStart = `${months[0]}-01`;
    const lastYm = months[months.length - 1];
    const [ly, lm] = lastYm.split('-').map(Number);
    const lastDay = new Date(ly, lm, 0).getDate();
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    const rangeEnd = `${ly}-${pad(lm)}-${pad(lastDay)}`;
    const inRange = (d: string) => {
      if (!d) return false;
      if (d < `${booksFrom}-01`) return false;
      if (d < `${personnelBooksStartYm}-01`) return false;
      return d >= rangeStart && d <= rangeEnd;
    };

    const lines: { date: string; type: string; title: string; earn: number; cut: number }[] = [];
    const base = cleanNumber(emp.base_salary);

    const closedYm = personnelClosedYearMonth();
    months.forEach(ym => {
      if (ym < personnelBooksStartYm) return;
      if (ym < booksFrom) return;
      const actualHire = sanitizeDate(emp.hire_date);
      const shareDate = actualHire && actualHire.slice(0, 7) === ym ? actualHire : `${ym}-01`;
      const share = employmentShareForMonth(shareDate, ym);
      if (share.factor <= 0) return;
      const date = hireYm === ym && hire ? hire : `${ym}-01`;
      const [yy, mm] = ym.split('-');
      const label = `${mm}.${yy}`;
      const proNote = share.startedThisMonth
        ? ` · ${startInfo.label} ${formatDateTR(hire)}, ${share.daysWorked}/${share.daysInMonth} gün`
        : '';
      const salaryOpen = ym <= closedYm && employeeSalaryAccruesInMonth(emp, ym);
      if (salaryOpen && base > 0) {
        lines.push({
          date,
          type: 'Sabit maaş',
          title: `${label} sözleşmeli maaş${proNote}`,
          earn: Math.round(base * share.factor * 100) / 100,
          cut: 0
        });
      }
    });

    (dbEmployeeTransactions || []).forEach((tx: any) => {
      if (String(tx.employee_id) !== empIdStr) return;
      const d = sanitizeDate(tx.transaction_date || tx.created_at);
      const tot = cleanNumber(tx.total_amount);
      if (tx.type === 'bonus') {
        if (!inRange(d)) return;
        lines.push({ date: d, type: 'Sefer / prim', title: tx.title || 'Prim', earn: tot, cut: 0 });
      } else if (tx.type === 'advance') {
        if (!inRange(d)) return;
        lines.push({ date: d, type: 'Münferit avans', title: tx.title || 'Avans', earn: 0, cut: tot });
      } else if (tx.type === 'installment_advance') {
        const inst = Math.max(1, Number(tx.installment_count) || 1);
        const cutAmt = cleanNumber(tx.monthly_cut || Math.round(tot / inst));
        const startYm = (d || rangeStart).slice(0, 7);
        months.forEach(ym => {
          if (ym < personnelBooksStartYm) return;
          if (ym < startYm) return;
          const [sy, sm] = startYm.split('-').map(Number);
          const [cy, cm] = ym.split('-').map(Number);
          const elapsed = (cy - sy) * 12 + (cm - sm);
          if (elapsed < 0 || elapsed >= inst) return;
          lines.push({
            date: `${ym}-01`,
            type: 'Taksit kesintisi',
            title: `${tx.title || 'Taksitli avans'} (${elapsed + 1}/${inst})`,
            earn: 0,
            cut: cutAmt
          });
        });
      }
    });

    (dbAdvances || []).forEach((a: any) => {
      if (!employeeMatchesAdvance(emp, a)) return;
      const d = sanitizeDate(a.issue_date || a.payment_date || a.created_at);
      const tot = cleanNumber(a.total_amount);
      if (a.payment_type === 'employee_bonus') {
        if (!inRange(d)) return;
        lines.push({
          date: d,
          type: 'Kasa prim',
          title: a.description || a.reason || 'Kasa primi',
          earn: tot,
          cut: 0
        });
        return;
      }
      const inst = Math.max(1, Number(a.total_installments) || 1);
      const isInst = String(a.payment_type || '').includes('installment') || inst > 1;
      if (isInst) {
        const startYm = (d || rangeStart).slice(0, 7);
        const cutAmt = tot / inst;
        months.forEach(ym => {
          if (ym < personnelBooksStartYm) return;
          const elapsed = monthsBetween(startYm, ym);
          if (elapsed < 0 || elapsed >= inst) return;
          lines.push({
            date: `${ym}-01`,
            type: 'Kasa taksit kesintisi',
            title: `${a.description || a.reason || 'Taksitli avans'} (${elapsed + 1}/${inst})`,
            earn: 0,
            cut: Math.round(cutAmt * 100) / 100
          });
        });
        return;
      }
      if (!inRange(d)) return;
      lines.push({
        date: d,
        type: 'Kasa avans',
        title: a.description || a.reason || 'Kasa avansı',
        earn: 0,
        cut: tot
      });
    });

    (dbInvoices || []).forEach((inv: any) => {
      if (!salaryPayrollMatchesEmployee(inv, emp)) return;
      const d = sanitizeDate(inv.issue_date || inv.created_at);
      if (!d) return;
      if (hire && d < hire) return;
      if (d < `${personnelBooksStartYm}-01`) return;
      if (d < rangeStart) return;
      lines.push({
        date: d,
        type: 'Maaş ödemesi',
        title: inv.invoice_no || 'Maaş',
        earn: 0,
        cut: cleanNumber(inv.total_amount)
      });
    });

    lines.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type, 'tr'));
    let running = 0;
    return lines.map(line => {
      running += line.earn - line.cut;
      return { ...line, balance: running };
    });
  }, [selectedPayrollEmp, payrollMonthList, dbEmployeeTransactions, dbAdvances, dbInvoices]);

  const exportPayrollExcel = (emp: any, ledger: typeof selectedPayrollLedger) => {
    const header = [
      ['Tazeyol ERP Personel Hakediş Raporu'],
      ['Personel', emp.full_name || ''],
      ['Görev', emp.role_title || ''],
      ['İşe giriş / başlangıç', emp.hire_date ? formatDateTR(emp.hire_date) : `${resolveEmployeeStart(emp).label}: ${formatDateTR(resolveEmployeeStart(emp).date)}`],
      ['Dönem', `${payrollFrom} — ${payrollTo}`],
      ['Döküm tarihi', new Date().toLocaleDateString('tr-TR')],
      [],
      ['Tarih', 'İşlem', 'Açıklama', 'Hakediş', 'Kesinti / ödeme', 'Bakiye']
    ];
    const body = ledger.map(line => [
      line.date,
      line.type,
      line.title,
      line.earn || 0,
      line.cut || 0,
      line.balance
    ]);
    const kapanis = ledger.length ? ledger[ledger.length - 1].balance : 0;
    const safeName = String(emp.full_name || 'personel').replace(/[\\/:*?"<>|]/g, ' ').slice(0, 40).trim();
    writeExcelAoa([
      ...header,
      ...body,
      [],
      ['', '', 'Kapanış bakiyesi', '', '', kapanis]
    ], `Tazeyol_Hakedis_${safeName}_${payrollFrom}_${payrollTo}.xlsx`, 'Hakedis');
  };

  const openPayrollReport = (emp: any) => {
    let from = employeeBooksFromYm(emp);
    const closed = personnelClosedYearMonth();
    const current = currentPayYearMonth();
    let to = current > closed ? current : closed;
    if (to < from) to = from;
    setPayrollFrom(from);
    setPayrollTo(to);
    setSelectedPayrollEmp(emp);
  };

  const findContractorIban = (contractorName: string, inv?: any) => {
    const key = normalizeContractorKey(contractorName);
    let foundIban = (key && subIbanMap.get(key)) || '';
    if ((!foundIban || foundIban === 'IBAN Eksik') && inv) {
      if (inv.iban && String(inv.iban).trim().length > 10) foundIban = String(inv.iban).trim();
      else if (inv.contractor_iban && String(inv.contractor_iban).trim().length > 10) foundIban = String(inv.contractor_iban).trim();
    }
            if (!foundIban || foundIban === 'IBAN Eksik') {
              const found = dbSubcontractors.find(sub => {
        const names = [sub.name, sub.company_name].filter(Boolean);
        return names.some(n => contractorRecordsMatch(contractorName, n));
      });
      if (found?.iban) foundIban = String(found.iban).trim();
    }
    return foundIban || 'IBAN Eksik';
  };

  const matchesContractor = (sub: any, ...texts: any[]) => {
    const display = String(sub?.company_name || sub?.name || '');
    const id = String(sub?.id || '');
    if (!display && !id) return false;
    return texts.some(t => {
      if (t === undefined || t === null || t === '') return false;
      const s = String(t).trim();
      if (id && s === id) return true;
      const who = extractAdvanceContractorName(s) || extractContractorName(s) || s;
      return (
        contractorRecordsMatch(display, who) ||
        contractorRecordsMatch(String(sub?.name || ''), who) ||
        contractorRecordsMatch(String(sub?.company_name || ''), who)
      );
    });
  };

  const buildContractorAccount = (sub: any) => {
    const lines: { id: string; date: string; type: string; desc: string; debit: number; credit: number; isManual?: boolean; rawId?: any }[] = [];
    const empty = {
      lines: [] as (typeof lines[number] & { balance: number })[],
      openTerms: [] as {
        lineId: string;
        invoiceId: any;
        invoiceNo: string;
        contractorName: string;
        term: 'term1' | 'term2';
        termLabel: string;
        dueDate: string;
        issueDate: string;
        amount: number;
        advanceCut: number;
        netAmount: number;
        iban: string;
      }[],
      invoiceIds: new Set<string>(),
      totalInvoice: 0,
      totalOut: 0,
      balance: 0,
      leftoverAdvance: 0,
      listInvoice: 0,
      listOut: 0,
      listBalance: 0
    };
    if (!sub) return empty;
    const contractorName = String(sub.company_name || sub.name || '');

    const invoices: any[] = [];
    const seenInv = new Set<string>();
    (dbInvoices || []).forEach((inv: any) => {
      if (inv.category !== 'subcontractor_invoice') return;
      const no = String(inv.invoice_no || '');
      if (no.toUpperCase().includes('AVANS')) return;
      const who = extractContractorName(no);
      if (!matchesContractor(sub, who) && !matchesContractor(sub, inv.supplier_name)) return;
      const amt = cleanNumber(inv.total_amount);
      const dupKey = `${normalizeContractorKey(who)}|${sanitizeDate(inv.issue_date)}|${Math.round(amt * 100)}`;
      if (seenInv.has(dupKey)) return;
      seenInv.add(dupKey);
      invoices.push(inv);
      lines.push({
        id: 'inv_' + inv.id,
        date: sanitizeDate(inv.issue_date || inv.created_at),
        type: 'Hakediş faturası',
        desc: no,
        debit: amt,
        credit: 0
      });
    });
    const septTotal = Math.round(
      invoices
        .filter((inv: any) => sanitizeDate(inv.issue_date || inv.created_at).startsWith('2026-09'))
        .reduce((s: number, inv: any) => s + cleanNumber(inv.total_amount), 0) * 100
    ) / 100;
    const divertedPays: { date: string; desc: string; amount: number; type: string }[] = [];

    const advAmounts: number[] = [];
    (dbAdvances || []).forEach((adv: any, idx: number) => {
      if (adv.target_type && adv.target_type !== 'contractor') return;
      if (!matchesContractor(sub, adv.target_name, adv.target_id)) return;
      const amt = cleanNumber(adv.total_amount);
      const inst = Math.max(1, Number(adv.total_installments) || 1);
      if (amt <= 0 || advAmounts.some(x => amountsClose(x, amt))) return;
      const date = sanitizeDate(adv.issue_date || adv.created_at);
      if (inst <= 1 && septTotal > 0.01 && amt > septTotal * 0.5 + 1) {
        divertedPays.push({ date, desc: adv.notes || adv.description || 'ÖDEME', amount: amt, type: 'pay' });
        return;
      }
      advAmounts.push(amt);
      lines.push({
        id: 'adv_' + (adv.id || idx),
        date,
        type: inst > 1 ? `Taksitli avans (${inst} taksit)` : 'Peşin avans',
        desc: (adv.notes || adv.description || 'Verilen avans').replace(/\(\s*1\s*Taksit\s*\)/i, '').trim(),
        debit: 0,
        credit: amt
      });
    });
    (dbInvoices || []).forEach((inv: any) => {
      if (inv.category !== 'subcontractor_advance_paid') return;
      const no = String(inv.invoice_no || '');
      if (!matchesContractor(sub, extractAdvanceContractorName(no))) return;
      const amt = cleanNumber(inv.total_amount);
      const instMatch = no.match(/(\d+)\s*Taksit/i);
      const inst = instMatch ? Number(instMatch[1]) : 1;
      if (amt <= 0 || advAmounts.some(x => amountsClose(x, amt))) return;
      const date = sanitizeDate(inv.issue_date || inv.created_at);
      if (inst <= 1 && septTotal > 0.01 && amt > septTotal * 0.5 + 1) {
        divertedPays.push({ date, desc: no, amount: amt, type: 'pay' });
        return;
      }
      advAmounts.push(amt);
      lines.push({
        id: 'advinv_' + inv.id,
        date,
        type: inst > 1 ? `Taksitli avans (${inst} taksit)` : 'Peşin avans',
        desc: no.replace(/\(\s*1\s*Taksit\s*\)/i, '').trim(),
        debit: 0,
        credit: amt
      });
    });
    type Slot = {
      key: string;
      invoiceId: any;
      invoiceNo: string;
      term: 'term1' | 'term2';
      issueDate: string;
      dueDate: string;
      gross: number;
      net: number;
      paid: boolean;
      remain?: number;
    };
    const slots: Slot[] = [];
    invoices.forEach((inv: any) => {
      const total = cleanNumber(inv.total_amount);
      const t1 = cleanNumber(inv.term1_amount || total / 2);
      const t2 = cleanNumber(inv.term2_amount || Math.max(0, total - t1));
      const issueDate = sanitizeDate(inv.issue_date || inv.created_at);
      const add = (term: 'term1' | 'term2', gross: number) => {
        if (gross <= 0.009) return;
        slots.push({
          key: `${inv.id}-${term}`,
          invoiceId: inv.id,
          invoiceNo: String(inv.invoice_no || ''),
          term,
          issueDate,
          dueDate: contractorTermPayDate(issueDate, term, sanitizeDate(term === 'term1' ? inv.term1_due_date : inv.term2_due_date)),
          gross,
          net: gross,
          paid: false
        });
      };
      add('term1', t1);
      add('term2', t2);
    });
    slots.sort((a, b) => (a.issueDate || '').localeCompare(b.issueDate || '') || (a.term === b.term ? 0 : a.term === 'term1' ? -1 : 1));

    const advanceRows: { date: string; amount: number; inst: number }[] = [];
    (dbAdvances || []).forEach((adv: any) => {
      if (adv.target_type && adv.target_type !== 'contractor') return;
      if (!matchesContractor(sub, adv.target_name, adv.target_id)) return;
      const amt = cleanNumber(adv.total_amount);
      if (amt <= 0) return;
      const inst = Math.max(1, Number(adv.total_installments) || 1);
      if (inst <= 1 && septTotal > 0.01 && amt > septTotal * 0.5 + 1) return;
      advanceRows.push({ date: sanitizeDate(adv.issue_date || adv.created_at), amount: amt, inst });
    });
    (dbInvoices || []).forEach((inv: any) => {
      if (inv.category !== 'subcontractor_advance_paid') return;
      const no = String(inv.invoice_no || '');
      if (!matchesContractor(sub, extractAdvanceContractorName(no))) return;
      const amt = cleanNumber(inv.total_amount);
      const instMatch = no.match(/(\d+)\s*Taksit/i);
      const inst = instMatch ? Number(instMatch[1]) : 1;
      if (amt <= 0) return;
      if (advanceRows.some(x => amountsClose(x.amount, amt))) return;
      if (inst <= 1 && septTotal > 0.01 && amt > septTotal * 0.5 + 1) return;
      advanceRows.push({ date: sanitizeDate(inv.issue_date || inv.created_at), amount: amt, inst });
    });

    const instMonthOk = (advYm: string, invYm: string, inst: number) => {
      if (!advYm || !invYm) return false;
      if (invYm === advYm) return true;
      if (invYm < advYm) {
        const first = addYearMonth(advYm, 1 - inst);
        return !!first && invYm >= first;
      }
      const last = addYearMonth(advYm, inst - 1);
      return !!last && invYm <= last;
    };
    advanceRows.filter(a => a.inst > 1).forEach(a => {
      const slice = Math.round((a.amount / a.inst) * 100) / 100;
      const months = [...new Set(invoices.map((inv: any) => sanitizeDate(inv.issue_date || inv.created_at).slice(0, 7)).filter(Boolean))];
      months.forEach(ym => {
        if (!instMonthOk((a.date || '').slice(0, 7), ym, a.inst)) return;
        let left = slice;
        slots.filter(s => s.term === 'term1' && s.issueDate.startsWith(ym)).forEach(s => {
          if (left <= 0.009 || s.net <= 0.009) return;
          const cut = Math.round(Math.min(s.net, left) * 100) / 100;
          s.net = Math.round((s.net - cut) * 100) / 100;
          left = Math.round((left - cut) * 100) / 100;
        });
      });
    });
    // Peşin avans açık vadeye, ödemeler işlendikten sonra yazılır (ödenmiş 1 nciyi yemez).

    type Pay = { date: string; desc: string; amount: number; type: string; ledgerId?: any };
    const pays: Pay[] = [...divertedPays];
    (dbSubcontractorsLedger || []).forEach((l: any) => {
      if (String(l.subcontractor_id) !== String(sub.id)) return;
      const amt = cleanNumber(l.amount);
      if (amt <= 0) return;
      if (l.transaction_type === 'invoice') {
        lines.push({
          id: 'ledger_' + l.id,
          date: sanitizeDate(l.created_at),
          type: 'Manuel fatura',
          desc: l.description || 'Cari hareket',
          debit: amt,
          credit: 0,
          isManual: true,
          rawId: l.id
        });
        return;
      }
      if (l.transaction_type === 'advance' && advAmounts.some(x => amountsClose(x, amt))) return;
      const desc = l.description || '';
      pays.push({
        date: sanitizeDate(l.created_at),
        desc,
        amount: amt,
        type: String(l.transaction_type || ''),
        ledgerId: l.id
      });
    });
    (dbInvoices || []).forEach((inv: any) => {
      if (inv.category !== 'subcontractor_paid_outflow') return;
      const no = String(inv.invoice_no || '');
      if (!matchesContractor(sub, extractContractorName(no), extractAdvanceContractorName(no))) return;
      const amt = cleanNumber(inv.total_amount);
      if (amt <= 0) return;
      const date = sanitizeDate(inv.issue_date || inv.created_at);
      if (pays.some(p => amountsClose(p.amount, amt, 0.51) && p.date === date)) return;
      pays.push({ date, desc: no, amount: amt, type: /banka|talimat/i.test(no) ? 'bank' : 'pay' });
    });
    const batchPays: Pay[] = [];
    (dbPaymentBatches || []).forEach((b: any) => {
      if (String(b.status) !== 'paid') return;
      const date = sanitizeDate(b.pay_date) || sanitizeDate(b.created_at);
      if (!date) return;
      let payload: any = b.payload || {};
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch { payload = {}; }
      }
      let amt = 0;
      const rows = Array.isArray(payload.rows) ? payload.rows : [];
      rows.forEach((r: any) => {
        if (!contractorRecordsMatch(contractorName, r.contractorName || '')) return;
        amt += cleanNumber(r.amount);
      });
      if (amt <= 0.009 && Array.isArray(payload.lines)) {
        payload.lines.forEach((l: any) => {
          if (!contractorRecordsMatch(contractorName, l.contractorName || '')) return;
          amt += cleanNumber(l.netAmount != null ? l.netAmount : l.amount);
        });
      }
      amt = Math.round(amt * 100) / 100;
      if (amt <= 0.009) return;
      if (batchPays.some(p => p.date === date && amountsClose(p.amount, amt, 0.51))) return;
      batchPays.push({
        date,
        desc: `ÖDEME - Banka talimatı - ${contractorName}`,
        amount: amt,
        type: 'bank'
      });
    });
    const collapsedPays = collapsePaysWithPersonBankLumps(pays, batchPays);
    const pesinAdvanceTotal = Math.round(
      lines
        .filter(l => /pe[sş]in avans/i.test(l.type) && inSeptPayWave(l.date))
        .reduce((s, l) => s + l.credit, 0) * 100
    ) / 100;
    const septInstCut = Math.round(
      lines.filter(l => /taksitli avans/i.test(l.type)).reduce((s, l) => {
        const m = String(l.type).match(/(\d+)\s*taksit/i);
        const n = m ? Number(m[1]) : 0;
        return s + (n > 1 ? l.credit / n : 0);
      }, 0) * 100
    ) / 100;
    const visiblePays = normalizeSeptWavePays(collapsedPays, septTotal, pesinAdvanceTotal, septInstCut);

    slots.forEach(s => { s.remain = s.net; });
    visiblePays.forEach(p => {
      let left = Math.round(p.amount * 100) / 100;
      const payD = String(p.date || '').slice(0, 10);
      const septWave = inSeptPayWave(payD);
      slots.forEach(s => {
        const remain = s.remain || 0;
        if (left <= 0.009 || remain <= 0.009) return;
        if (septWave) {
          if (!(s.issueDate || '').startsWith('2026-09')) return;
        } else {
          if (s.dueDate && payD && s.dueDate > payD) return;
          if (!s.dueDate && s.issueDate && payD && s.issueDate > payD) return;
        }
        const take = Math.round(Math.min(remain, left) * 100) / 100;
        s.remain = Math.round((remain - take) * 100) / 100;
        left = Math.round((left - take) * 100) / 100;
        if ((s.remain || 0) <= 0.009) s.paid = true;
      });
    });

    let leftoverAdvance = 0;
    [...advanceRows].filter(a => a.inst <= 1).sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(a => {
      let left = Math.round(a.amount * 100) / 100;
      slots.forEach(s => {
        const remain = s.remain || 0;
        if (left <= 0.009 || remain <= 0.009) return;
        const cut = Math.round(Math.min(remain, left) * 100) / 100;
        s.remain = Math.round((remain - cut) * 100) / 100;
        left = Math.round((left - cut) * 100) / 100;
        if ((s.remain || 0) <= 0.009) s.paid = true;
      });
      leftoverAdvance = Math.round((leftoverAdvance + left) * 100) / 100;
    });

    visiblePays.forEach((p, idx) => {
      const term = payTermFromDesc(p.desc, p.type);
      const type = term === 'both' || paymentLooksFull(p.desc, p.type)
        ? 'Tamamı ödeme'
        : (term === 'term2' ? '2 nci ödeme' : (term === 'term1' ? '1 nci ödeme' : (p.type === 'bank' || /banka|talimat/i.test(p.desc) ? 'Banka ödemesi' : 'Ödeme')));
      lines.push({
        id: 'wave_pay_' + idx,
        date: p.date,
        type,
        desc: p.desc || 'Ödeme',
        debit: 0,
        credit: Math.round(p.amount * 100) / 100,
        isManual: !!p.ledgerId,
        rawId: p.ledgerId
      });
    });

    lines.sort((a, b) =>
      (a.date || '').localeCompare(b.date || '') ||
      (Number(b.debit > 0) - Number(a.debit > 0)) ||
      a.type.localeCompare(b.type, 'tr')
    );
    let running = 0;
    const withBal = lines.map(line => {
      running += line.debit - line.credit;
      return { ...line, balance: running };
    });
    const totalInvoice = Math.round(withBal.reduce((s, l) => s + l.debit, 0) * 100) / 100;
    const totalOut = Math.round(withBal.reduce((s, l) => s + l.credit, 0) * 100) / 100;
    const iban = findContractorIban(contractorName);
    const invoiceIds = new Set(invoices.map((inv: any) => String(inv.id)));
    const openTerms = slots
      .filter(s => ((s as Slot & { remain?: number }).remain ?? s.net) > 0.009)
      .map(s => {
        const remain = (s as Slot & { remain?: number }).remain ?? s.net;
        return {
          lineId: s.key,
          invoiceId: s.invoiceId,
          invoiceNo: s.invoiceNo,
          contractorName,
          term: s.term,
          termLabel: s.term === 'term2' ? '2 nci ödeme' : '1 nci ödeme',
          dueDate: s.dueDate,
          issueDate: s.issueDate,
          amount: remain,
          advanceCut: Math.round(Math.max(0, s.gross - remain) * 100) / 100,
          netAmount: remain,
          iban
        };
      });
    const balance = Math.round((totalInvoice - totalOut) * 100) / 100;
    return {
      lines: withBal,
      openTerms,
      invoiceIds,
      totalInvoice,
      totalOut,
      balance,
      leftoverAdvance,
      listInvoice: totalInvoice,
      listOut: totalOut,
      listBalance: balance
    };
  };

  const buildSubcontractorLedger = (sub: any) => buildContractorAccount(sub).lines;

  const contractorAccountsBySubId = useMemo(() => {
    const m = new Map<string, ReturnType<typeof buildContractorAccount>>();
    (dbSubcontractors || []).forEach((sub: any) => {
      m.set(String(sub.id), buildContractorAccount(sub));
    });
    return m;
  }, [dbSubcontractors, dbInvoices, dbAdvances, dbSubcontractorsLedger, dbPaymentBatches, subIbanMap]);

  const subcontractorCariRows = useMemo(() => {
    return (dbSubcontractors || []).map((sub: any) => {
      const acc = contractorAccountsBySubId.get(String(sub.id)) || buildContractorAccount(sub);
        return {
        ...sub,
        computedTax: sub.tax_no || sub.tax_number || '',
        totalInvoice: acc.totalInvoice,
        totalOut: acc.totalOut,
        balance: acc.balance
      };
    });
  }, [dbSubcontractors, contractorAccountsBySubId]);

  const selectedSubcontractorLedger = useMemo(
    () => selectedSubcontractorForDetail
      ? (contractorAccountsBySubId.get(String(selectedSubcontractorForDetail.id)) || buildContractorAccount(selectedSubcontractorForDetail)).lines
      : [],
    [selectedSubcontractorForDetail, contractorAccountsBySubId]
  );

  const bankTermLines = useMemo(() => {
    const seen = new Set<string>();
    const lines: {
      lineId: string;
      invoiceId: any;
      invoiceNo: string;
      contractorName: string;
      term: 'term1' | 'term2';
      termLabel: string;
      dueDate: string;
      issueDate: string;
      amount: number;
      advanceCut: number;
      netAmount: number;
      iban: string;
    }[] = [];
    const pushAcc = (acc: ReturnType<typeof buildContractorAccount>) => {
      acc.openTerms.forEach(t => {
        if (seen.has(t.lineId)) return;
        seen.add(t.lineId);
        lines.push(t);
      });
    };
    contractorAccountsBySubId.forEach(pushAcc);
    (dbInvoices || []).forEach((inv: any) => {
      if (inv.category !== 'subcontractor_invoice') return;
      const no = String(inv.invoice_no || '');
      if (no.toUpperCase().includes('AVANS')) return;
      if ([...contractorAccountsBySubId.values()].some(a => a.invoiceIds.has(String(inv.id)))) return;
      const name = extractContractorName(no);
      pushAcc(buildContractorAccount({ id: 'loose_' + normalizeContractorKey(name), name, company_name: name }));
    });
    return lines.sort((a, b) =>
      (a.issueDate || '').localeCompare(b.issueDate || '') ||
      (a.term === b.term ? 0 : a.term === 'term1' ? -1 : 1) ||
      (a.contractorName || '').localeCompare(b.contractorName || '', 'tr-TR', { sensitivity: 'base' })
    );
  }, [contractorAccountsBySubId, dbInvoices, dbSubcontractors, dbAdvances, dbSubcontractorsLedger, subIbanMap]);

  const selectedBankTermLines = useMemo(
    () => bankTermLines.filter(line => bankSelectedLines[line.lineId]),
    [bankTermLines, bankSelectedLines]
  );

  const contractorAdvanceCuts = useMemo(() => {
    const ym = currentPayYearMonth();
    const byKey = new Map<string, { cut: number; applies: { id: any; remaining: number; apply: number; isInst: boolean }[] }>();
    const addCut = (name: string, remaining: number, apply: number, isInst: boolean, id: any) => {
      const key = normalizeContractorKey(name);
      if (key.length < 3 || apply <= 0) return;
      const cur = byKey.get(key) || { cut: 0, applies: [] };
      cur.cut += apply;
      cur.applies.push({ id, remaining, apply, isInst });
      byKey.set(key, cur);
    };

    (dbAdvances || []).forEach((a: any) => {
      const t = String(a.target_type || '');
      if (t && t !== 'contractor' && t !== 'subcontractor') return;
      const remaining = a.remaining_amount === null || a.remaining_amount === undefined
        ? cleanNumber(a.total_amount)
        : cleanNumber(a.remaining_amount);
      if (remaining <= 0) return;
      const inst = Math.max(1, Number(a.total_installments) || 1);
      const isInst = inst > 1;
      if (isInst && String(a.last_applied_month || '') === ym) return;
      const apply = Math.round((isInst ? Math.min(remaining, cleanNumber(a.total_amount) / inst) : remaining) * 100) / 100;
      addCut(String(a.target_name || a.target_id || ''), remaining, apply, isInst, a.id);
    });

    (dbInvoices || []).forEach((inv: any) => {
      const no = String(inv.invoice_no || '');
      const isAdvCat = inv.category === 'subcontractor_advance_paid';
      const isAdvTitle = no.toUpperCase().includes('AVANS');
      if (!isAdvCat && !isAdvTitle) return;
      if (inv.category === 'subcontractor_invoice' || inv.category === 'supplier_advance' || inv.category === 'employee_advance_paid') return;
      if (/TEDARİKÇİ AVANS|PERSONEL AVANS/i.test(no)) return;
      const name = extractAdvanceContractorName(no);
      const hasRow = (dbAdvances || []).some((a: any) => {
        const t = String(a.target_type || '');
        if (t && t !== 'contractor' && t !== 'subcontractor') return false;
        return contractorRecordsMatch(name, a.target_name || '') || contractorRecordsMatch(name, String(a.target_id || ''));
      });
      if (hasRow) return;
      const already = [...byKey.keys()].some(ak => contractorRecordsMatch(ak, name));
      if (already) return;
      const amt = cleanNumber(inv.total_amount);
      if (amt <= 0) return;
      addCut(name, amt, amt, false, 'invadv_' + inv.id);
    });

    return byKey;
  }, [dbAdvances, dbInvoices]);

  const findContractorAdvanceInfo = (contractorName: string) => {
    const k = normalizeContractorKey(contractorName);
    type AdvInfo = { mapKey: string; cut: number; applies: { id: any; remaining: number; apply: number; isInst: boolean }[] };
    if (!k) return undefined as undefined | AdvInfo;
    const direct = contractorAdvanceCuts.get(k);
    if (direct) return { mapKey: k, ...direct };
    let best: AdvInfo | undefined;
    contractorAdvanceCuts.forEach((val, ak) => {
      if (!ak || ak.length < 6) return;
      if (!contractorRecordsMatch(contractorName, ak)) return;
      if (!best || ak.length > best.mapKey.length) best = { mapKey: ak, cut: val.cut, applies: val.applies };
    });
    return best;
  };

  const canonicalContractorKey = (contractorName: string) => {
    const adv = findContractorAdvanceInfo(contractorName);
    if (adv) return adv.mapKey;
    const sub = (dbSubcontractors || []).find(s => matchesContractor(s, contractorName));
    if (sub) return normalizeContractorKey(sub.company_name || sub.name);
    return normalizeContractorKey(contractorName);
  };

  const decorateBankLinesWithAdvance = (lines: typeof bankTermLines) =>
    lines.map(l => ({
      ...l,
      advanceCut: l.advanceCut || 0,
      netAmount: l.netAmount ?? l.amount
    }));

  const allDecoratedBankLines = useMemo(
    () => decorateBankLinesWithAdvance(bankTermLines),
    [bankTermLines]
  );

  const contractorPayableNow = useMemo(
    () => Math.round(allDecoratedBankLines.reduce((s, l) => s + (l.netAmount || 0), 0) * 100) / 100,
    [allDecoratedBankLines]
  );
  const todayIso = new Date().toISOString().split('T')[0];
  const daysUntilIso = (raw: any) => {
    const d = sanitizeDate(raw);
    if (!d) return null;
    const today = new Date(`${todayIso}T12:00:00`);
    const exp = new Date(`${d}T12:00:00`);
    if (Number.isNaN(exp.getTime())) return null;
    return Math.round((exp.getTime() - today.getTime()) / 86400000);
  };
  const overdueInspections = useMemo(
    () =>
      (dbVehicles || [])
        .filter(v => {
          if (v.is_active === false) return false;
          const d = daysUntilIso(v.next_inspection_date);
          return d != null && d <= 30;
        })
        .sort((a, b) => String(a.next_inspection_date).localeCompare(String(b.next_inspection_date))),
    [dbVehicles, todayIso]
  );
  const policyExpiryAlerts = useMemo(() => {
    const rows: { id: string; plate: string; driver: string; kind: string; date: string; days: number }[] = [];
    (dbVehicles || []).forEach(v => {
      if (v.is_active === false) return;
      const plate = String(v.plate_number || '').trim() || 'Plaka yok';
      const driver = v.driver_name || 'Atanmadı';
      const push = (kind: string, raw: any, key: string) => {
        const days = daysUntilIso(raw);
        if (days == null || days > 30) return;
        rows.push({ id: `${v.id || plate}-${key}`, plate, driver, kind, date: sanitizeDate(raw), days });
      };
      push('Muayene', v.next_inspection_date, 'muayene');
      push('Sigorta', v.insurance_expiry_date, 'sigorta');
      push('Kasko', v.kasko_expiry_date, 'kasko');
    });
    return rows.sort((a, b) => a.days - b.days || a.plate.localeCompare(b.plate, 'tr'));
  }, [dbVehicles, todayIso]);
  const payableOtherDebt = totalGovernmentPaymentsDebt + totalGeneralCompanyExpensesDebt + totalEmployeeFutureDebt;
  const payableTotalDebt = contractorPayableNow + payableOtherDebt;
  const periodProfit = totalCollectedCash - totalPeriodPaidExpenses;

  const decoratedBankByLineId = useMemo(() => {
    const m = new Map<string, (typeof allDecoratedBankLines)[number]>();
    allDecoratedBankLines.forEach(l => m.set(l.lineId, l));
    return m;
  }, [allDecoratedBankLines]);

  const installmentCutForHakedis = (inv: any) => {
    const who = extractContractorName(String(inv.invoice_no || ''));
    const invYm = sanitizeDate(inv.issue_date || inv.created_at).slice(0, 7);
    if (!invYm || !who) return 0;
    const inWindow = (advYm: string, inst: number) => {
      if (!advYm) return false;
      if (invYm === advYm) return true;
      if (invYm < advYm) {
        const first = addYearMonth(advYm, 1 - inst);
        return !!first && invYm >= first;
      }
      const last = addYearMonth(advYm, inst - 1);
      return !!last && invYm <= last;
    };
    let cut = 0;
    (dbAdvances || []).forEach((adv: any) => {
      if (adv.target_type && adv.target_type !== 'contractor') return;
      if (!contractorRecordsMatch(who, adv.target_name || '') && !contractorRecordsMatch(who, String(adv.target_id || ''))) return;
      const inst = Math.max(1, Number(adv.total_installments) || 1);
      if (inst <= 1) return;
      const date = sanitizeDate(adv.issue_date || adv.created_at);
      if (!inWindow((date || '').slice(0, 7), inst)) return;
      cut += cleanNumber(adv.total_amount) / inst;
    });
    (dbInvoices || []).forEach((row: any) => {
      if (row.category !== 'subcontractor_advance_paid') return;
      const no = String(row.invoice_no || '');
      if (!contractorRecordsMatch(who, extractAdvanceContractorName(no))) return;
      const instMatch = no.match(/(\d+)\s*Taksit/i);
      const inst = instMatch ? Number(instMatch[1]) : 1;
      if (inst <= 1) return;
      const date = sanitizeDate(row.issue_date || row.created_at);
      if (!inWindow((date || '').slice(0, 7), inst)) return;
      if ((dbAdvances || []).some((a: any) => amountsClose(cleanNumber(a.total_amount), cleanNumber(row.total_amount)))) return;
      cut += cleanNumber(row.total_amount) / inst;
    });
    return Math.round(cut * 100) / 100;
  };

  const visibleHakedisRows = useMemo(() => {
    const term = subSearchTerm.toLocaleLowerCase('tr-TR').trim();
    const parseDate = (d: any) => {
      if (!d) return 0;
      const str = String(d).trim();
      if (str.includes('.')) {
        const [day, month, year] = str.split('.');
        return new Date(`${year}-${month}-${day}`).getTime() || 0;
      }
      return new Date(str).getTime() || 0;
    };
    const list = (dbInvoices || [])
      .filter((i: any) => i.category === 'subcontractor_invoice')
      .filter((inv: any) => !String(inv.invoice_no || '').toUpperCase().includes('AVANS'))
      .filter((inv: any) => {
        const invTitle = (inv.invoice_no || '').toLocaleLowerCase('tr-TR');
        const matchesSearch = !term || invTitle.includes(term);
        const isFullyPaid = inv.term1_status === 'paid' && inv.term2_status === 'paid';
        let matchesStatus = true;
        if (subStatusFilter === 'pending') matchesStatus = !isFullyPaid;
        else if (subStatusFilter === 'paid') matchesStatus = isFullyPaid;
        return matchesSearch && matchesStatus;
      })
      .sort((a: any, b: any) => {
      let comparison = 0;
        if (subSortField === 'invoice_no') {
          const nameA = (a.invoice_no || '').split(' - ')[1] || a.invoice_no || '';
          const nameB = (b.invoice_no || '').split(' - ')[1] || b.invoice_no || '';
          comparison = nameA.trim().localeCompare(nameB.trim(), 'tr-TR', { sensitivity: 'base' });
        } else if (subSortField === 'issue_date') {
          comparison = parseDate(a.issue_date) - parseDate(b.issue_date);
        } else {
          comparison = cleanNumber(a.total_amount) - cleanNumber(b.total_amount);
        }
        return subSortOrder === 'asc' ? comparison : -comparison;
      });
    const instPool = new Map<string, number>();
    list.forEach((inv: any) => {
      const whoKey = normalizeContractorKey(extractContractorName(String(inv.invoice_no || '')));
      const ym = sanitizeDate(inv.issue_date || inv.created_at).slice(0, 7);
      const poolKey = `${whoKey}|${ym}`;
      if (!instPool.has(poolKey)) instPool.set(poolKey, installmentCutForHakedis(inv));
    });
    const rows = list.map((inv: any) => {
        const total = cleanNumber(inv.total_amount);
        const t1Gross = Math.round((total / 2) * 100) / 100;
        const t2Gross = Math.round((total - t1Gross) * 100) / 100;
        const whoKey = normalizeContractorKey(extractContractorName(String(inv.invoice_no || '')));
        const ym = sanitizeDate(inv.issue_date || inv.created_at).slice(0, 7);
        const poolKey = `${whoKey}|${ym}`;
        const pool = instPool.get(poolKey) || 0;
        const instCut = Math.round(Math.min(t1Gross, pool) * 100) / 100;
        if (instCut > 0) instPool.set(poolKey, Math.round((pool - instCut) * 100) / 100);
        const isT1Paid = inv.term1_status === 'paid';
        const isT2Paid = inv.term2_status === 'paid';
        const dynamicT1 = isT1Paid ? 0 : Math.round((t1Gross - instCut) * 100) / 100;
        const dynamicT2 = isT2Paid ? 0 : t2Gross;
        return {
          inv,
          t1: t1Gross,
          t2: t2Gross,
          isT1Paid,
          isT2Paid,
          deductedAdvAmt: instCut,
          deductedAdvForT2: 0,
          dynamicT1,
          dynamicT2,
          total
        };
      });
    const totals = rows.reduce(
      (s, r) => ({
        total: s.total + r.total,
        term1: s.term1 + r.dynamicT1,
        term2: s.term2 + r.dynamicT2
      }),
      { total: 0, term1: 0, term2: 0 }
    );
    return {
      rows,
      totals: {
        total: Math.round(totals.total * 100) / 100,
        term1: Math.round(totals.term1 * 100) / 100,
        term2: Math.round(totals.term2 * 100) / 100
      }
    };
  }, [dbInvoices, dbAdvances, subSearchTerm, subStatusFilter, subSortField, subSortOrder]);

  const visibleGeneralExpenses = useMemo(() => {
    const skip = ['subcontractor_invoice', 'customer_collection', 'freight_sales', 'cash_deposit', 'customer_advance', 'credit_card_payment', 'salary_payroll', 'subcontractor_paid_outflow', 'subcontractor_advance_paid', 'employee_advance_paid'];
    const term = expenseSearchTerm.toLocaleLowerCase('tr-TR').trim();
    const parseDate = (d: any) => {
      const s = sanitizeDate(d);
      if (!s) return 0;
      return new Date(s).getTime() || 0;
    };
    return (dbInvoices || [])
      .filter((i: any) => !skip.includes(i.category))
      .filter((i: any) => isDateInRange(i.issue_date))
      .filter((i: any) => {
        if (expenseStatusFilter === 'unpaid') return i.status !== 'paid';
        if (expenseStatusFilter === 'paid') return i.status === 'paid';
        return true;
      })
      .filter((i: any) => expenseCategoryFilter === 'all' || i.category === expenseCategoryFilter)
      .filter((i: any) => {
        if (!term) return true;
        const catLabel = expenseCategoryLabel(String(i.category || '')).toLocaleLowerCase('tr-TR');
        return String(i.invoice_no || '').toLocaleLowerCase('tr-TR').includes(term)
          || String(i.category || '').toLocaleLowerCase('tr-TR').includes(term)
          || catLabel.includes(term);
      })
      .sort((a: any, b: any) => {
        let cmp = 0;
        if (expenseSortField === 'invoice_no') {
          cmp = String(a.invoice_no || '').localeCompare(String(b.invoice_no || ''), 'tr-TR', { sensitivity: 'base' });
        } else if (expenseSortField === 'total_amount') {
          cmp = cleanNumber(a.total_amount) - cleanNumber(b.total_amount);
        } else {
          cmp = parseDate(a.issue_date) - parseDate(b.issue_date);
        }
        return expenseSortOrder === 'asc' ? cmp : -cmp;
      });
  }, [dbInvoices, expenseSearchTerm, expenseStatusFilter, expenseCategoryFilter, expenseSortField, expenseSortOrder, filterStartDate, filterEndDate]);

  const displayBankTermLines = allDecoratedBankLines;

  const sentBatchLineIds = useMemo(() => {
    const ids = new Set<string>();
    (dbPaymentBatches || []).forEach((b: any) => {
      if (String(b.status) !== 'sent') return;
      const lines = (b.payload && b.payload.lines) || [];
      if (!Array.isArray(lines)) return;
      lines.forEach((l: any) => { if (l.lineId) ids.add(String(l.lineId)); });
    });
    return ids;
  }, [dbPaymentBatches]);

  const payableBankTermLines = useMemo(
    () => displayBankTermLines.filter(l => (l.netAmount || 0) > 0.009 && !sentBatchLineIds.has(l.lineId)),
    [displayBankTermLines, sentBatchLineIds]
  );

  const bankContractorRows = useMemo(() => {
    const map = new Map<string, {
      groupKey: string;
      contractorName: string;
      iban: string;
      invoiceNos: string[];
      dueDate: string;
      term1Ids: string[];
      term2Ids: string[];
      term1Amount: number;
      term2Amount: number;
      term1Cut: number;
      term2Cut: number;
    }>();
    payableBankTermLines.forEach(l => {
      const groupKey = canonicalContractorKey(l.contractorName) || l.contractorName;
      const cur = map.get(groupKey) || {
        groupKey,
        contractorName: l.contractorName,
        iban: l.iban,
        invoiceNos: [] as string[],
        dueDate: l.dueDate || '',
        term1Ids: [] as string[],
        term2Ids: [] as string[],
        term1Amount: 0,
        term2Amount: 0,
        term1Cut: 0,
        term2Cut: 0
      };
      if (l.term === 'term2') {
        cur.term2Ids.push(l.lineId);
        cur.term2Amount += l.netAmount;
        cur.term2Cut += l.advanceCut || 0;
            } else {
        cur.term1Ids.push(l.lineId);
        cur.term1Amount += l.netAmount;
        cur.term1Cut += l.advanceCut || 0;
      }
      if (l.invoiceNo && !cur.invoiceNos.includes(l.invoiceNo)) cur.invoiceNos.push(l.invoiceNo);
      if (l.iban && l.iban !== 'IBAN Eksik' && (cur.iban === 'IBAN Eksik' || !cur.iban)) cur.iban = l.iban;
      if (l.dueDate && (!cur.dueDate || l.dueDate < cur.dueDate)) cur.dueDate = l.dueDate;
      if ((l.contractorName || '').length > (cur.contractorName || '').length) cur.contractorName = l.contractorName;
      map.set(groupKey, cur);
    });
    const rows = Array.from(map.values()).map(cur => {
      const has1 = cur.term1Amount > 0.009;
      const has2 = cur.term2Amount > 0.009;
      let mode: 'term1' | 'term2' | 'both' = bankPayMode[cur.groupKey] || (has1 ? 'term1' : 'term2');
      if (mode === 'term1' && !has1) mode = has2 ? 'term2' : 'term1';
      if (mode === 'term2' && !has2) mode = has1 ? 'term1' : 'term2';
      if (mode === 'both' && !(has1 && has2)) mode = has1 ? 'term1' : 'term2';
      const lineIds = mode === 'both' ? [...cur.term1Ids, ...cur.term2Ids] : (mode === 'term2' ? cur.term2Ids : cur.term1Ids);
      const netAmount = mode === 'both' ? cur.term1Amount + cur.term2Amount : (mode === 'term2' ? cur.term2Amount : cur.term1Amount);
      const advanceCut = mode === 'both' ? cur.term1Cut + cur.term2Cut : (mode === 'term2' ? cur.term2Cut : cur.term1Cut);
      let leftoverAdvance = 0;
      for (const sub of dbSubcontractors || []) {
        if (!contractorRecordsMatch(cur.contractorName, sub.company_name || sub.name || '')) continue;
        leftoverAdvance = contractorAccountsBySubId.get(String(sub.id))?.leftoverAdvance || 0;
        break;
      }
      return { ...cur, mode, has1, has2, lineIds, netAmount, advanceCut, leftoverAdvance };
    });
    rows.sort((a, b) => {
      let comparison = 0;
      if (bankSortField === 'contractorName') {
        comparison = a.contractorName.localeCompare(b.contractorName, 'tr-TR', { sensitivity: 'base' });
      } else if (bankSortField === 'iban') {
        const ia = !a.iban || a.iban === 'IBAN Eksik' ? '0' : '1' + a.iban;
        const ib = !b.iban || b.iban === 'IBAN Eksik' ? '0' : '1' + b.iban;
        comparison = ia.localeCompare(ib, 'tr-TR');
      } else if (bankSortField === 'amount') {
        comparison = a.netAmount - b.netAmount;
      } else {
        comparison = (a.dueDate || '').localeCompare(b.dueDate || '');
      }
      if (!comparison) comparison = a.contractorName.localeCompare(b.contractorName, 'tr-TR', { sensitivity: 'base' });
      return bankSortOrder === 'asc' ? comparison : -comparison;
    });
    return rows;
  }, [payableBankTermLines, bankPayMode, bankSortField, bankSortOrder, contractorAccountsBySubId, dbSubcontractors]);
  // PERSONEL HESAPLAMA, ARAMA VE SIRALAMA MOTORU
  const processedEmployees = useMemo(() => {
    const ym = currentPayYearMonth();
    return (dbEmployees || [])
      .map(emp => {
        const extra = employeeManualMovementsForMonth(emp, ym);
        const books = employeeBooksBreakdown(emp);
        return {
          ...emp,
          baseSalaryNum: cleanNumber(emp.base_salary),
          bonusNum: extra.bonus,
          advanceDeduction: extra.advanceCut,
          netPayable: books.unpaid,
          cariBalance: books.balance,
          booksPaid: books.paid,
          booksClosedHak: books.closedHak,
          booksOpenExtra: books.openExtra,
          carriedOverDebt: Math.max(0, -books.balance)
        };
      })
      .filter(emp => {
        if (!empSearchTerm.trim()) return true;
        const term = empSearchTerm.toLowerCase();
        return (
          (emp.full_name || '').toLowerCase().includes(term) ||
          (emp.role_title || '').toLowerCase().includes(term) ||
          (emp.phone || '').includes(term)
        );
      })
      .sort((a, b) => {
        let comp = 0;
        if (empSortField === 'name') {
          comp = (a.full_name || '').localeCompare(b.full_name || '', 'tr-TR', { sensitivity: 'base' });
        } else if (empSortField === 'salary') {
          comp = a.baseSalaryNum - b.baseSalaryNum;
        } else if (empSortField === 'netPayable') {
          comp = a.cariBalance - b.cariBalance;
        }
        return empSortOrder === 'asc' ? comp : -comp;
      });
  }, [dbEmployees, dbAdvances, dbEmployeeTransactions, dbInvoices, empSearchTerm, empSortField, empSortOrder]);

  // PERSONEL SAYFASI FİNANSAL ÖZET SAYAÇLARI
  const empSummary = useMemo(() => {
    let totalBase = 0;
    let totalBonus = 0;
    let totalAdv = 0;
    let totalNet = 0;
    let totalDebt = 0;

    processedEmployees.forEach(e => {
      totalBase += e.baseSalaryNum;
      totalBonus += e.bonusNum;
      totalAdv += e.advanceDeduction;
      totalNet += e.netPayable;
      totalDebt += e.carriedOverDebt;
    });

    return { totalBase, totalBonus, totalAdv, totalNet, totalDebt, count: processedEmployees.length };
  }, [processedEmployees]);
    
  const resolveDecoratedBankLines = (lines: typeof bankTermLines) =>
    lines
      .map(l => decoratedBankByLineId.get(l.lineId) || { ...l, advanceCut: 0, netAmount: l.amount })
      .filter(l => (l.netAmount || 0) > 0.009);

  const bankLiveSelectionSummary = useMemo(() => {
    const decorated = resolveDecoratedBankLines(selectedBankTermLines);
    const names = new Set(decorated.map(l => l.contractorName));
    const total = decorated.reduce((sum, l) => sum + l.netAmount, 0);
    return { total, count: names.size, lineCount: decorated.length };
  }, [selectedBankTermLines, decoratedBankByLineId]);

  const applyAdvanceUsageToDb = async (lines: { contractorName: string; advanceCut: number }[]) => {
    const ym = currentPayYearMonth();
    const usedByKey = new Map<string, { info: NonNullable<ReturnType<typeof findContractorAdvanceInfo>>; used: number }>();
    for (const line of lines) {
      if (!line.advanceCut) continue;
      const info = findContractorAdvanceInfo(line.contractorName);
      const key = info?.mapKey || canonicalContractorKey(line.contractorName);
      if (!key || !info) continue;
      const cur = usedByKey.get(key) || { info, used: 0 };
      cur.used += line.advanceCut;
      usedByKey.set(key, cur);
    }
    for (const { info, used } of usedByKey.values()) {
      let left = Math.round(used * 100) / 100;
      for (const ap of info.applies) {
        if (left <= 0) break;
        if (!ap.id || String(ap.id).startsWith('invadv_')) continue;
        const take = Math.round(Math.min(ap.remaining, ap.apply, left) * 100) / 100;
        if (take <= 0) continue;
        const nextRemaining = Math.round(Math.max(0, ap.remaining - take) * 100) / 100;
        left = Math.round((left - take) * 100) / 100;
        const payload: any = { remaining_amount: nextRemaining };
        if (ap.isInst) payload.last_applied_month = ym;
        const { error } = await supabase.from('advance_payments').update(payload).eq('id', ap.id);
        if (error && /last_applied_month/i.test(error.message)) {
          await supabase.from('advance_payments').update({ remaining_amount: nextRemaining }).eq('id', ap.id);
        }
      }
    }
  };

  const handleToggleSelectAllBank = () => {
    const allIds = bankContractorRows.flatMap(r => r.lineIds);
    const allSelected = allIds.length > 0 && allIds.every(id => bankSelectedLines[id]);
    const next: { [key: string]: boolean } = {};
    bankContractorRows.forEach(r => {
      [...r.term1Ids, ...r.term2Ids].forEach(id => { next[id] = false; });
      r.lineIds.forEach(id => { next[id] = !allSelected; });
    });
    setBankSelectedLines(next);
  };

  const handleToggleBankContractor = (lineIds: string[], allIds?: string[]) => {
    const allOn = lineIds.length > 0 && lineIds.every(id => bankSelectedLines[id]);
    const next = { ...bankSelectedLines };
    (allIds || lineIds).forEach(id => { next[id] = false; });
    lineIds.forEach(id => { next[id] = !allOn; });
    setBankSelectedLines(next);
  };

  const handleSetBankPayMode = (groupKey: string, mode: 'term1' | 'term2' | 'both', row: { term1Ids: string[]; term2Ids: string[]; lineIds: string[] }) => {
    setBankPayMode(prev => ({ ...prev, [groupKey]: mode }));
    const nextIds = mode === 'both' ? [...row.term1Ids, ...row.term2Ids] : (mode === 'term2' ? row.term2Ids : row.term1Ids);
    const wasOn = row.lineIds.length > 0 && row.lineIds.every(id => bankSelectedLines[id]);
    if (!wasOn) return;
    const next = { ...bankSelectedLines };
    [...row.term1Ids, ...row.term2Ids].forEach(id => { next[id] = false; });
    nextIds.forEach(id => { next[id] = true; });
    setBankSelectedLines(next);
  };

  const handleBulkBankPayMode = (mode: 'term1' | 'term2' | 'both') => {
    const nextMode: Record<string, 'term1' | 'term2' | 'both'> = { ...bankPayMode };
    const nextSel = { ...bankSelectedLines };
    bankContractorRows.forEach(r => {
      const ok = mode === 'both' ? (r.has1 && r.has2) : (mode === 'term2' ? r.has2 : r.has1);
      if (!ok) return;
      nextMode[r.groupKey] = mode;
      const nextIds = mode === 'both' ? [...r.term1Ids, ...r.term2Ids] : (mode === 'term2' ? r.term2Ids : r.term1Ids);
      const wasOn = r.lineIds.length > 0 && r.lineIds.every(id => bankSelectedLines[id]);
      [...r.term1Ids, ...r.term2Ids].forEach(id => { nextSel[id] = false; });
      if (wasOn) nextIds.forEach(id => { nextSel[id] = true; });
    });
    setBankPayMode(nextMode);
    setBankSelectedLines(nextSel);
  };

  const handleDownloadBankExcel = () => {
    if (selectedBankTermLines.length === 0) {
      alert('Lütfen ödemek istediğiniz alt yüklenicileri işaretleyin. Excel’de her kişi için tek tutar çıkar.');
      return;
    }

    const decoratedSelected = resolveDecoratedBankLines(selectedBankTermLines);
    if (decoratedSelected.length === 0) {
      alert('Seçilen ödemelerin tamamı avans ile kapandı. Bankaya gidecek tutar yok.');
      return;
    }
    const grouped = new Map<string, { contractorName: string; iban: string; amount: number; notes: string[] }>();
    decoratedSelected.forEach(line => {
      const key = canonicalContractorKey(line.contractorName) || line.contractorName;
      if (!grouped.has(key)) {
        grouped.set(key, { contractorName: line.contractorName, iban: line.iban, amount: 0, notes: [] });
      }
      const cur = grouped.get(key)!;
      cur.amount += line.netAmount;
      cur.notes.push(`${line.invoiceNo} ${line.termLabel}${line.advanceCut ? ' −avans' : ''}`);
      if (cur.iban === 'IBAN Eksik' && line.iban !== 'IBAN Eksik') cur.iban = line.iban;
    });
    const selectedRows = Array.from(grouped.values()).filter(r => r.amount > 0.009);

    const missingIbans = selectedRows.filter(r => !r.iban || r.iban === 'IBAN Eksik' || r.iban.trim().length < 15);
    if (missingIbans.length > 0) {
      const names = missingIbans.map(m => m.contractorName).join(', ');
      if (!window.confirm(`DİKKAT: Seçilen bazı alt yüklenicilerin IBAN bilgisi eksik veya geçersiz:\n• ${names}\n\nYine de Excel oluşturulsun mu?`)) {
        return;
      }
    }

    const excelData = selectedRows.map(item => ([
      item.contractorName,
      item.iban,
      excelKeepNumber(item.amount),
      `Tazeyol Lojistik Hakediş (${item.notes.slice(0, 3).join('; ')}${item.notes.length > 3 ? '…' : ''})`
    ]));
    const todayStr = new Date().toISOString().split('T')[0];
    writeExcelAoa([
      ['Alıcı Unvanı', 'IBAN', 'Ödeme Tutarı (TL)', 'Açıklama'],
      ...excelData
    ], `Tazeyol_Banka_Odeme_Talimati_${todayStr}.xlsx`, 'Toplu Odeme');

    const cashTotal = selectedRows.reduce((s, r) => s + r.amount, 0);
    const payload = {
      rows: selectedRows.map(r => ({ contractorName: r.contractorName, iban: r.iban, amount: Math.round(r.amount * 100) / 100 })),
      lines: decoratedSelected.map(l => ({
        lineId: l.lineId,
        invoiceId: l.invoiceId,
        invoiceNo: l.invoiceNo,
        term: l.term,
        contractorName: l.contractorName,
        netAmount: l.netAmount,
        advanceCut: l.advanceCut || 0
      }))
    };
    const waveLabel = 'kişisel 1 nci / 2 nci / Tamamı';
    supabase.from('payment_batches').insert([{
      pay_date: todayStr,
      status: 'sent',
      title: `${todayStr} banka talimatı (${waveLabel})`,
      total_amount: Math.round(cashTotal * 100) / 100,
      contractor_count: selectedRows.length,
      batch_reference: `TALIMAT-${todayStr}-${Date.now()}`,
      payload
    }]).then(({ error }) => {
      if (error) {
        alert('Excel indi ama talimat partisi kaydedilemedi. setup_payment_batches.sql dosyasını SQL Editor’da çalıştırın.\n' + error.message);
        return;
      }
      setBankSelectedLines({});
      loadPortalData();
      alert(`Talimat Excel’i indirildi. Ödendi işaretlenmedi.\nBanka başarılı raporu gelince aşağıdaki partiden “Ödendi işle” deyin.\n${selectedRows.length} kişi, ${cashTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`);
    });
  };

  const handleConfirmPaymentBatch = async (batch: any) => {
    if (!isAdmin) {
      alert('Ödendi işle yalnız yönetici hesabıyla yapılır.');
      return;
    }
    if (String(batch.status) === 'paid') {
      alert('Bu parti zaten ödendi işlendi.');
      return;
    }
    let payload: any = batch.payload || {};
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { payload = {}; }
    }
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const lines = Array.isArray(payload.lines) ? payload.lines : [];
    const cashTotal = rows.reduce((s: number, r: any) => s + cleanNumber(r.amount), 0) ||
      lines.reduce((s: number, l: any) => s + cleanNumber(l.netAmount), 0);
    const personCount = rows.length || new Set(lines.map((l: any) => l.contractorName)).size;
    const suggestedPay = sanitizeDate(batch.pay_date) || new Date().toISOString().split('T')[0];
    const typedPay = window.prompt(
      `Banka hangi günde ödedi?\nTalimat: ${formatDateTR(suggestedPay)}\nCariye bu tarih yazılır.`,
      suggestedPay
    );
    if (typedPay === null) return;
    const payDate = sanitizeDate(String(typedPay).trim());
    if (!payDate || !/^\d{4}-\d{2}-\d{2}$/.test(payDate)) {
      alert('Geçerli bir tarih girin. Örn. 24.11.2026');
      return;
    }
    if (!window.confirm(`Banka bu partiyi ödedi.\n${formatDateTR(payDate)} · ${personCount} kişi · ${cashTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺\n\nOnaylayınca carilere bir kez işlenir, kasadan net düşer, vadeler kapanır. Excel tekrar yüklenmez.`)) return;
    setPayingBatchId(batch.id);
    const warn: string[] = [];
    try {
      const activeLines = (lines as any[]).length
        ? (lines as any[])
        : (rows as any[]).map((r: any) => ({
            contractorName: r.contractorName,
            netAmount: r.amount,
            invoiceNo: `Banka talimatı - ${r.contractorName}`,
            term: ''
          }));
      const byInvoice = new Map<string, { term1?: boolean; term2?: boolean }>();
      activeLines.forEach((line: any) => {
        const id = line.invoiceId != null ? String(line.invoiceId) : '';
        if (!id) return;
        const cur = byInvoice.get(id) || {};
        if (line.term === 'term1') cur.term1 = true;
        if (line.term === 'term2') cur.term2 = true;
        byInvoice.set(id, cur);
      });
      for (const [invoiceId, terms] of byInvoice) {
        const inv = dbInvoices.find(i => String(i.id) === invoiceId);
        if (!inv) continue;
        const updates: any = {};
        if (terms.term1) updates.term1_status = 'paid';
        if (terms.term2) updates.term2_status = 'paid';
        const isT1Paid = updates.term1_status === 'paid' || inv.term1_status === 'paid';
        const isT2Paid = updates.term2_status === 'paid' || inv.term2_status === 'paid';
        if (isT1Paid && isT2Paid) updates.status = 'paid';
        if (!Object.keys(updates).length) continue;
        const { error: invErr } = await supabase.from('invoices').update(updates).eq('id', inv.id);
        if (invErr) warn.push('Fatura vade: ' + invErr.message);
      }
      const existing = (dbInvoices || []).filter((i: any) => i.category === 'subcontractor_paid_outflow');
      const personCash = new Map<string, { contractorName: string; amount: number }>();
      (rows as any[]).forEach((r: any) => {
        const name = String(r.contractorName || '').trim();
        if (!name) return;
        const amt = Math.round(cleanNumber(r.amount) * 100) / 100;
        const key = canonicalContractorKey(name) || name;
        const cur = personCash.get(key) || { contractorName: name, amount: 0 };
        cur.amount = Math.round((cur.amount + amt) * 100) / 100;
        personCash.set(key, cur);
      });
      if (!personCash.size) {
        activeLines.forEach((line: any) => {
          const name = String(line.contractorName || '').trim();
          if (!name) return;
          const amt = Math.round(cleanNumber(line.netAmount) * 100) / 100;
          const key = canonicalContractorKey(name) || name;
          const cur = personCash.get(key) || { contractorName: name, amount: 0 };
          cur.amount = Math.round((cur.amount + amt) * 100) / 100;
          personCash.set(key, cur);
        });
      }
      const cashRows = Array.from(personCash.values()).map(person => {
        const amt = Math.round(person.amount * 100) / 100;
        if (amt <= 0.009) return null;
        const invoiceNo = `ÖDEME - Banka talimatı - ${person.contractorName}`.slice(0, 180);
        const sameDay = existing.filter((i: any) =>
          sanitizeDate(i.issue_date) === payDate &&
          contractorRecordsMatch(person.contractorName, extractContractorName(i.invoice_no || ''))
        );
        if (sameDay.some((i: any) => isAnonymousBankPay(String(i.invoice_no || '')) && amountsClose(cleanNumber(i.total_amount), amt, 0.51))) {
          return null;
        }
        const explodedSum = Math.round(sameDay
          .filter((i: any) => isExplodedInvoiceTermPay(String(i.invoice_no || '')))
          .reduce((s: number, i: any) => s + cleanNumber(i.total_amount), 0) * 100) / 100;
        if (explodedSum > 0.009 && amountsClose(explodedSum, amt, 1)) return null;
        return {
          invoice_no: invoiceNo,
          direction: 'incoming',
          category: 'subcontractor_paid_outflow',
          total_amount: amt,
          issue_date: payDate,
          due_date: payDate,
          status: 'paid'
        };
      }).filter(Boolean) as any[];
      for (let i = 0; i < cashRows.length; i += 25) {
        const chunk = cashRows.slice(i, i + 25);
        const { error: cashErr } = await supabase.from('invoices').insert(chunk);
        if (cashErr) {
          for (const row of chunk) {
            const one = await supabase.from('invoices').insert([row]);
            if (one.error) warn.push('Kasa satırı: ' + one.error.message);
          }
        }
      }
      try {
        await applyAdvanceUsageToDb(activeLines.map((l: any) => ({ contractorName: l.contractorName, advanceCut: cleanNumber(l.advanceCut) })));
      } catch (advErr: any) {
        warn.push('Avans mahsup: ' + (advErr?.message || advErr));
      }
      let { error: stErr } = await supabase.from('payment_batches').update({ status: 'paid', pay_date: payDate }).eq('id', batch.id);
      if (stErr && /pay_date/i.test(stErr.message || '')) {
        const retry = await supabase.from('payment_batches').update({ status: 'paid' }).eq('id', batch.id);
        stErr = retry.error;
      }
      if (stErr) {
        throw new Error(
          (stErr.message || 'Parti durumu güncellenemedi') +
          '\n\nSupabase SQL Editor’da setup_payment_batches.sql çalıştırın (status: sent/paid/cancelled).'
        );
      }
      alert(
        `Parti ödendi işlendi. Carilere yazıldı. Kasadan ${cashTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ düşüldü.` +
        (warn.length ? `\n\nUyarı:\n${warn.slice(0, 4).join('\n')}` : '')
      );
      await loadPortalData();
    } catch (err: any) {
      alert('Parti onay hatası: ' + (err.message || err));
    } finally {
      setPayingBatchId(null);
    }
  };

  const handleCancelPaymentBatch = async (batch: any) => {
    if (!isAdmin) return;
    if (String(batch.status) === 'paid') {
      alert('Ödendi işlenmiş parti iptal edilmez.');
      return;
    }
    if (!window.confirm('Bu talimatı iptal edeyim mi? Excel bankaya gitmediyse satırlar tekrar listelenir. Cariye işlem yazılmaz.')) return;
    const { error } = await supabase.from('payment_batches').update({ status: 'cancelled' }).eq('id', batch.id);
    if (error) {
      alert('İptal hatası: ' + error.message);
      return;
    }
    loadPortalData();
  };

  // 11. HAKEDİŞ SATIRINDA ESNEK VADE ÖDEME (1. Vade / 2. Vade / Tümü)
  const handlePaySubcontractorTerm = async (inv: any, term: 'term1' | 'term2' | 'both') => {
    if (!isAdmin) return;
    const t1 = cleanNumber(inv.term1_amount || (inv.total_amount / 2));
    const t2 = cleanNumber(inv.term2_amount || (inv.total_amount / 2));
    const line1 = decoratedBankByLineId.get(`${inv.id}-term1`);
    const line2 = decoratedBankByLineId.get(`${inv.id}-term2`);

    let payAmt = 0;
    if (term === 'term1') payAmt = line1 ? line1.netAmount : t1;
    else if (term === 'term2') payAmt = line2 ? line2.netAmount : t2;
    else if (term === 'both') {
      payAmt =
        (inv.term1_status !== 'paid' ? (line1 ? line1.netAmount : t1) : 0) +
        (inv.term2_status !== 'paid' ? (line2 ? line2.netAmount : t2) : 0);
    }

    const confirmMsg = `${inv.invoice_no}\nÖdenecek tutar (avans mahsubu düşülmüş): ${payAmt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺\nBu ödemeyi onaylıyor musunuz? (Kasadan fiilen düşülecektir)`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const updates: any = {};

      if (term === 'term1') {
        updates.term1_status = 'paid';
        if (inv.term2_status === 'paid') updates.status = 'paid';
      } else if (term === 'term2') {
        updates.term2_status = 'paid';
        if (inv.term1_status === 'paid') updates.status = 'paid';
      } else if (term === 'both') {
        updates.term1_status = 'paid';
        updates.term2_status = 'paid';
        updates.status = 'paid';
      }

      await supabase.from('invoices').update(updates).eq('id', inv.id);

      if (payAmt > 0.009) {
        const contractor = extractContractorName(inv.invoice_no || '');
        const already = (dbInvoices || []).some((i: any) => {
          if (i.category !== 'subcontractor_paid_outflow' || i.status !== 'paid') return false;
          if (!contractorRecordsMatch(contractor, extractContractorName(i.invoice_no || ''))) return false;
          const ia = cleanNumber(i.total_amount);
          const idate = sanitizeDate(i.issue_date);
          if (idate === todayStr && amountsClose(ia, payAmt, 0.05)) return true;
          if (/tamam|1 ve 2/i.test(String(i.invoice_no || '')) && (amountsClose(ia, payAmt, 0.51) || amountsClose(ia, payAmt * 2, 1))) return true;
          return false;
        });
        if (!already) {
      await supabase.from('invoices').insert([{
            invoice_no: `ÖDEME - ${inv.invoice_no} (${term === 'term1' ? '1 nci ödeme' : term === 'term2' ? '2 nci ödeme' : 'Tamamı'})`,
        direction: 'incoming',
        category: 'subcontractor_paid_outflow',
        total_amount: payAmt,
        issue_date: todayStr,
        due_date: todayStr,
        status: 'paid'
      }]);
        }
      }

      const paidCuts = [term === 'term2' ? line2 : line1, term === 'both' ? line2 : null].filter(Boolean) as NonNullable<typeof line1>[];
      await applyAdvanceUsageToDb(paidCuts);

      alert('Ödeme başarıyla işlendi. Avans önce 1 nci ödemeden, gerekirse 2 nci ödemeden mahsup edildi.');
      loadPortalData();
    } catch (err: any) {
      alert('Ödeme hatası: ' + err.message);
    }
  };

  // 12. TAŞERONA MANUEL ÖDEME / AVANS FORMU KAYDETME
  const handleSaveSubPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = cleanNumber(subPaymentFormData.amount);
    if (!subPaymentFormData.subcontractorName || amt <= 0) {
      alert('Lütfen taşeron ve tutar bilgilerini giriniz.');
      return;
    }

    try {
      const todayStr = subPaymentFormData.date || new Date().toISOString().split('T')[0];
      const instCount = Math.max(1, parseInt(subPaymentFormData.installmentCount) || 1);
      const isInstallment = subPaymentFormData.actionType === 'installment_advance';
      const singleDeduction = isInstallment ? amt / instCount : amt;

      const { error: invErr } = await supabase.from('invoices').insert([{
        invoice_no: `AVANS - ${subPaymentFormData.subcontractorName} (${isInstallment ? instCount + ' Taksit' : 'Peşin Avans'})`,
        direction: 'incoming',
        category: 'subcontractor_advance_paid',
        total_amount: amt,
        issue_date: todayStr,
        due_date: todayStr,
        status: 'paid'
      }]);
      if (invErr) throw invErr;

      const advRow: any = {
        target_type: 'contractor',
        target_id: subPaymentFormData.subcontractorName,
        target_name: subPaymentFormData.subcontractorName,
        payment_type: isInstallment ? 'contractor_installment_advance' : 'contractor_advance',
        total_amount: amt,
        total_installments: isInstallment ? instCount : 1,
        remaining_amount: amt,
        last_applied_month: null,
        issue_date: todayStr,
        notes: isInstallment 
          ? `Taksit başı düşüm: ${singleDeduction.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL (Kalan: ${instCount - 1} Taksit / ${(amt - singleDeduction).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL)`
          : 'Peşin avans (Faturadan mahsup edilecek)'
      };
      let { error: advErr } = await supabase.from('advance_payments').insert([advRow]);
      if (advErr && /last_applied_month/i.test(advErr.message)) {
        delete advRow.last_applied_month;
        const retry = await supabase.from('advance_payments').insert([advRow]);
        advErr = retry.error;
      }
      if (advErr) throw advErr;

      alert(`Taşeron avansı (${amt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺) başarıyla işlendi ve ${subPaymentFormData.targetAccount === 'bank' ? 'Banka' : 'Kasa'} çıkışı yapıldı!`);
      setIsSubPaymentModalOpen(false);
      setSubPaymentFormData({
        subcontractorName: '',
        actionType: 'advance',
        amount: '',
        installmentCount: '2',
        targetAccount: 'bank',
        date: new Date().toISOString().split('T')[0],
        note: ''
      });
      loadPortalData();
    } catch (err: any) {
      alert('Avans işlemi hatası: ' + err.message);
    }
  };

  const openContractorAdvance = (sub?: any) => {
    const name = sub ? String(sub.company_name || sub.name || '') : '';
    setSubPaymentFormData({
      subcontractorName: name,
      actionType: 'advance',
      amount: '',
      installmentCount: '2',
      targetAccount: 'bank',
      date: new Date().toISOString().split('T')[0],
      note: ''
    });
    setIsSubPaymentModalOpen(true);
  };

  const canEnterOverviewOutflow =
    canEditMod('general_expenses') || canEditMod('employees') || canEditMod('subcontractors');

  const openNewExpenseFromOverview = () => {
    setIsOutflowPickerOpen(false);
    setEditingExpenseId(null);
    setExpenseFormData({
      category: 'maintenance',
      companyName: '',
      plateNumber: '',
      vehicleCharge: '',
      invoiceNo: '',
      amount: '',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      status: 'unpaid',
      paidSource: 'bank'
    });
    setIsGeneralExpenseModalOpen(true);
  };

  const handleSaveSupplierAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditMod('general_expenses')) {
      alert('Bu hesap tedarikçi avansı yazamaz.');
      return;
    }
    const name = supplierAdvanceForm.companyName.trim();
    const amt = cleanNumber(supplierAdvanceForm.amount);
    if (!name || amt <= 0) {
      alert('Tedarikçi adı ve tutar zorunludur.');
      return;
    }
    const todayStr = supplierAdvanceForm.date || new Date().toISOString().split('T')[0];
    const isInstallment = supplierAdvanceForm.actionType === 'installment_advance';
    const instCount = Math.max(1, parseInt(supplierAdvanceForm.installmentCount, 10) || 1);
    const paidByCard = supplierAdvanceForm.paidSource === 'card';
    const title = `${paidByCard ? '[KK] ' : ''}TEDARİKÇİ AVANS - ${name} (${isInstallment ? instCount + ' taksit' : 'peşin'})`;
    try {
      const invRow: any = {
        invoice_no: title,
        direction: 'incoming',
        category: 'supplier_advance',
        total_amount: amt,
        issue_date: todayStr,
        due_date: todayStr,
        status: 'paid',
        paid_source: paidByCard ? 'card' : (supplierAdvanceForm.paidSource === 'cash' ? 'cash' : 'cash')
      };
      let { error: invErr } = await supabase.from('invoices').insert([invRow]);
      if (invErr && /paid_source/i.test(invErr.message || '')) {
        const { paid_source, ...fallback } = invRow;
        const retry = await supabase.from('invoices').insert([fallback]);
        invErr = retry.error;
      }
      if (invErr) throw invErr;

      const advRow: any = {
        target_type: 'supplier',
        target_id: name,
        target_name: name,
        payment_type: isInstallment ? 'supplier_installment_advance' : 'supplier_advance',
        total_amount: amt,
        total_installments: isInstallment ? instCount : 1,
        remaining_amount: amt,
        last_applied_month: null,
        issue_date: todayStr,
        notes: (supplierAdvanceForm.note || '').trim() || (isInstallment
          ? `Taksit: ${instCount}. E-fatura gelince mahsup.`
          : 'E-fatura gelince mahsup edilecek')
      };
      let { error: advErr } = await supabase.from('advance_payments').insert([advRow]);
      if (advErr && /last_applied_month/i.test(advErr.message || '')) {
        delete advRow.last_applied_month;
        const retry = await supabase.from('advance_payments').insert([advRow]);
        advErr = retry.error;
      }
      if (advErr) throw advErr;

      alert(paidByCard
        ? `Tedarikçi avansı (${amt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺) kartla işlendi. Kasa şimdi düşmez.`
        : `Tedarikçi avansı (${amt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺) işlendi. Kasa / banka çıktı; e-fatura gelince mahsup edilir.`);
      setIsSupplierAdvanceModalOpen(false);
      setSupplierAdvanceForm(emptySupplierAdvance);
      loadPortalData();
    } catch (err: any) {
      alert('Tedarikçi avansı hatası: ' + err.message);
    }
  };

  // 13. MANUEL TAŞERON HAKEDİŞ FATURASI EKLEME
  const handleSaveManualSubInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const tot = cleanNumber(manualSubInvoiceData.totalAmount);
    if (!manualSubInvoiceData.subcontractorName || !manualSubInvoiceData.invoiceNo || tot <= 0) {
      alert('Lütfen taşeron, fatura no ve tutar alanlarını doldurunuz.');
      return;
    }

    try {
      const fullTitle = `${manualSubInvoiceData.invoiceNo} - ${manualSubInvoiceData.subcontractorName}`.trim();
      const t1 = tot / 2;
      const t2 = tot / 2;

      const { error } = await supabase.from('invoices').insert([{
        invoice_no: fullTitle,
        direction: 'incoming',
        category: 'subcontractor_invoice',
        total_amount: tot,
        issue_date: manualSubInvoiceData.issueDate,
        term1_due_date: manualSubInvoiceData.term1DueDate,
        term1_amount: t1,
        term1_status: 'unpaid',
        term2_due_date: manualSubInvoiceData.term2DueDate,
        term2_amount: t2,
        term2_status: 'unpaid',
        status: 'unpaid'
      }]);

      if (error) throw error;
      alert('Taşeron faturası başarıyla eklendi!');
      setIsManualSubInvoiceModalOpen(false);
      setManualSubInvoiceData({
        subcontractorName: '',
        invoiceNo: '',
        totalAmount: '',
        issueDate: new Date().toISOString().split('T')[0],
        term1DueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
        term2DueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
      });
      loadPortalData();
    } catch (err: any) {
      alert('Hakediş ekleme hatası: ' + err.message);
    }
  };

 // 14. DİNAMİK TAKSİTLİ AVANS MAHSUBU VE HAKEDİŞ DÜZENLEME
  const handleSaveSubInvoiceEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubInvoice) return;

    try {
      let tot = cleanNumber(subEditFormData.totalAmount);
      let t1 = cleanNumber(subEditFormData.term1Amount);
      let t2 = cleanNumber(subEditFormData.term2Amount);

      if (t1 === 0 && t2 === 0 && tot > 0) {
        t1 = tot / 2;
        t2 = tot / 2;
      }

      const { error } = await supabase
        .from('invoices')
        .update({
          invoice_no: subEditFormData.invoiceNo.trim(),
          total_amount: tot,
          issue_date: subEditFormData.issueDate,
          term1_due_date: subEditFormData.term1DueDate,
          term1_amount: t1,
          term1_status: (subEditFormData as any).term1Status || 'pending',
          term2_due_date: subEditFormData.term2DueDate,
          term2_amount: t2,
          term2_status: (subEditFormData as any).term2Status || 'pending'
        })
        .eq('id', editingSubInvoice.id);

      if (error) throw error;
      alert('Hakediş faturası güncellendi.');
      setIsEditSubModalOpen(false);
      setEditingSubInvoice(null);
      loadPortalData();
    } catch (err: any) {
      alert('Fatura düzenleme hatası: ' + (err.message || err));
    }
  };

  // 15. TAHSİLAT AÇMA VE KAYDETME
  const handleOpenReceiptFromSale = (saleInvoice: any) => {
    const customerName = saleInvoice.customerName || '';
    const row = customerBalances.find(r => r.customer.name === customerName);
    const remaining = row ? Math.max(0, row.netLive) : cleanNumber(saleInvoice.total_amount);
    const invAmt = cleanNumber(saleInvoice.total_amount);
    setNewReceiptFormData({
      customerName,
      receiptNo: saleInvoice.cleanInvoiceNo || saleInvoice.invoice_no || '',
      amount: remaining > 0 ? String(Math.min(remaining, invAmt || remaining)) : (invAmt ? String(invAmt) : ''),
      targetAccount: 'bank',
      date: new Date().toISOString().split('T')[0],
      kind: 'invoice',
      relatedInvoiceId: saleInvoice.id || null
    });
    setIsNewReceiptModalOpen(true);
  };

  const handleSetSalePaidStatus = async (sale: any, nextStatus: 'paid' | 'unpaid') => {
    if (!isAdmin) return;
    const label = nextStatus === 'paid' ? 'tahsil edildi' : 'tekrar açık';
    if (!window.confirm(`${sale.invoice_no || sale.cleanInvoiceNo}\nBu faturayı ${label} işaretlemek istiyor musunuz?\nKasa hareketi oluşmaz.`)) return;
    try {
      const { error } = await supabase.from('invoices').update({ status: nextStatus }).eq('id', sale.id);
      if (error) throw error;
      await loadPortalData();
    } catch (err: any) {
      alert('Durum güncellenemedi: ' + err.message);
    }
  };

  const handleSaveNewReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = cleanNumber(newReceiptFormData.amount);
    const collectedOn = sanitizeDate(newReceiptFormData.date);
    if (amt <= 0) {
      alert('Lütfen tutar giriniz.');
      return;
    }
    if (!String(newReceiptFormData.customerName || '').trim()) {
      alert('Müşteri seçiniz.');
      return;
    }
    if (!collectedOn) {
      alert('Tahsilat tarihi zorunlu. Paranın bankaya girdiği günü yazın. Bugün kaydetseniz bile 23.10 ise 23.10 seçin.');
      return;
    }
    const isInvoiceKind = newReceiptFormData.kind === 'invoice';
    const selectedInv = isInvoiceKind
      ? salesDetailedList.find(s => String(s.id) === String(newReceiptFormData.relatedInvoiceId))
      : null;
    if (isInvoiceKind && !selectedInv) {
      alert('Açık faturayı seçiniz.');
      return;
    }
    if (!isInvoiceKind && (isEArchiveNoiseTitle(newReceiptFormData.receiptNo) || /^(?:THS\s*-\s*)?(EA|EF|GIB)\d{8,}$/i.test(String(newReceiptFormData.receiptNo || '').trim()))) {
      alert('Fatura numarası tahsilat değildir. Gelen parayı tahsilat olarak girin; açıklamaya dekont notu yazabilirsiniz.');
      return;
    }

    try {
      const migrosPay = isMainMigrosName(newReceiptFormData.customerName);
      const closeOnly = isInvoiceKind && (migrosPay || isAtifAltunisikName(newReceiptFormData.customerName));
      if (closeOnly) {
        if (!selectedInv) {
          alert('Açık faturayı seçiniz.');
          return;
        }
        const { error: stErr } = await supabase.from('invoices').update({ status: 'paid' }).eq('id', selectedInv.id);
        if (stErr) throw stErr;
        alert('Fatura kapatıldı. Kasa yazılmaz. Para ayrı tahsilat kaydındadır.');
        setIsNewReceiptModalOpen(false);
        loadPortalData();
        return;
      }
      const invNo = selectedInv ? String(selectedInv.cleanInvoiceNo || selectedInv.invoice_no || '').trim() : '';
      const note = String(newReceiptFormData.receiptNo || '').replace(/\s+-\s+/g, ' ').trim();
      const recTitle = isInvoiceKind
        ? `THS - ${invNo || 'FATURA'} - ${newReceiptFormData.customerName} - ${Date.now()}`
        : `THS - ${note || 'Tahsilat'} - ${newReceiptFormData.customerName} - ${Date.now()}`;
      const { error: insErr } = await supabase.from('invoices').insert([{
        invoice_no: recTitle,
        direction: 'incoming',
        category: 'customer_collection',
        total_amount: amt,
        issue_date: collectedOn,
        due_date: collectedOn,
        status: 'paid'
      }]);

      if (insErr) throw insErr;

      if (selectedInv && amt + 0.005 >= cleanNumber(selectedInv.total_amount)) {
        const { error: stErr } = await supabase.from('invoices').update({ status: 'paid' }).eq('id', selectedInv.id);
        if (stErr) throw stErr;
      }

      alert(isInvoiceKind
        ? `Fatura tahsil edildi. ${formatDateTR(collectedOn)} tarihinde kasaya girdi.`
        : `Tahsilat ${formatDateTR(collectedOn)} tarihinde kasaya ve cariye işlendi.`);
      setIsNewReceiptModalOpen(false);
      loadPortalData();
    } catch (err: any) {
      alert('Tahsilat hatası: ' + err.message);
    }
  };

  const handleUpdateReceiptDate = async (item: any, nextDate: string) => {
    if (!isAdmin || !item?.id) return;
    const collectedOn = sanitizeDate(nextDate);
    if (!collectedOn) {
      alert('Geçerli bir tahsilat tarihi seçin.');
      return;
    }
    if (collectedOn === sanitizeDate(item.issue_date)) return;
    try {
      const { error } = await supabase.from('invoices').update({
        issue_date: collectedOn,
        due_date: collectedOn
      }).eq('id', item.id);
      if (error) throw error;
      await loadPortalData();
    } catch (err: any) {
      alert('Tarih güncellenemedi: ' + (err.message || err));
    }
  };
// TAHSİLAT SİLME, KASADAN DÜŞME VE FATURAYI GERİ AÇMA
  const handleDeleteReceipt = async (item: any) => {
    if (!isAdmin) return;
    if (!window.confirm(`${item.invoice_no}\nBu tahsilatı silmek istediğinize emin misiniz? Varsa bağlı satış faturası tekrar açık duruma dönecek ve tutar kasadan/bankadan düşülecektir.`)) return;

    try {
      const title = String(item.invoice_no || '');
      let invoiceNoToRevert = '';

      // 1. Başlıktan fatura numarasını ayıkla
      if (title.includes(' - ')) {
        const parts = title.split(' - ');
        if (parts.length > 1) {
          invoiceNoToRevert = parts[1].replace('THS-', '').trim();
        }
      }

      // 2. Varsa bağlı satış faturasını tekrar açık (unpaid) yap
      if (invoiceNoToRevert) {
        const matchedInvoice = dbInvoices.find(inv => 
          (inv.category === 'freight_sales' || inv.direction === 'outgoing') &&
          String(inv.invoice_no || '').toUpperCase().includes(invoiceNoToRevert.toUpperCase())
        );

        if (matchedInvoice) {
          await supabase.from('invoices').update({ status: 'unpaid' }).eq('id', matchedInvoice.id);
        }
      }

      // 3. Kasadaki bağlantılı hareket kayıtlarını temizle (genel giderler/kasa tablosu)
      try {
        await supabase.from('general_expenses').delete().ilike('description', `%${item.invoice_no}%`);
      } catch (e) {
        // Tablo adı farklıysa sessizce devam eder
      }

      // 4. Tahsilat kaydını invoices tablosundan sil
      const { error } = await supabase.from('invoices').delete().eq('id', item.id);
      if (error) throw error;

      alert('Tahsilat silindi, fatura tekrar açık duruma getirildi ve kasa güncellendi!');
      setDbInvoices(prev => prev.filter(inv => inv.id !== item.id));
      await loadPortalData();
    } catch (err: any) {
      alert('Silme hatası: ' + err.message);
    }
  };

  // KASA/BANKA PARA GİRİŞİ (SERMAYE/ORTAK FONU)
  const handleSaveCashDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = cleanNumber(cashDepositFormData.amount);
    if (amt <= 0) {
      alert('Lütfen geçerli bir tutar giriniz.');
      return;
    }

    try {
      const typeLabel = cashDepositFormData.depositType === 'partner_capital' ? 'Ortak Sermaye Fonu' : 'Diğer Para Girişi';
      const fullTitle = `${typeLabel} - ${cashDepositFormData.title || 'Nakit Giriş'} (${cashDepositFormData.targetAccount === 'bank' ? 'Banka' : 'Kasa'})`;

      const { error } = await supabase.from('invoices').insert([{
        invoice_no: fullTitle,
        direction: 'incoming',
        category: 'cash_deposit',
        total_amount: amt,
        issue_date: cashDepositFormData.date,
        due_date: cashDepositFormData.date,
        status: 'paid'
      }]);

      if (error) throw error;
      alert(`Para girişi (${amt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺) başarıyla ${cashDepositFormData.targetAccount === 'bank' ? 'Banka' : 'Kasa'} hesabına eklendi!`);
      setIsCashDepositModalOpen(false);
      setCashDepositFormData({ depositType: 'partner_capital', amount: '', targetAccount: 'bank', title: '', date: new Date().toISOString().split('T')[0] });
      loadPortalData();
    } catch (err: any) {
      alert('Para girişi hatası: ' + err.message);
    }
  };

  // 16. PERSONEL MAAŞ ÖDEMESİ (tek kişi veya toplu)
  const handleOpenBulkSalaryModal = () => {
    const items: any = {};
    dbEmployees.forEach(emp => {
      const books = employeeBooksBreakdown(emp);
      const net = books.unpaid;
      items[emp.id] = {
        selected: net > 0.009,
        amount: net > 0.009 ? String(net) : '0',
        name: emp.full_name,
        role: emp.role_title,
        iban: emp.iban || 'Belirtilmedi',
        net
      };
    });
    setBulkSalaryItems(items);
    setSalaryPayDate(new Date().toISOString().split('T')[0]);
    setIsBulkSalaryModalOpen(true);
  };

  const handleOpenSingleSalaryPay = (emp: any) => {
    const books = employeeBooksBreakdown(emp);
    const net = books.unpaid;
    const base = cleanNumber(emp.base_salary);
    if (net <= 0.009) {
      alert(`${emp.full_name} için ödenecek cari yok. Kapanmamış ayın maaşı 1’inde açılır. Avans personel hareketinden girilir.`);
      return;
    }
    setSingleSalaryPay({
      empId: emp.id,
      name: emp.full_name || '',
      amount: String(net),
      net,
      base,
      closedHak: books.closedHak,
      openExtra: books.openExtra,
      paid: books.paid
    });
    setSalaryPayDate(new Date().toISOString().split('T')[0]);
    setIsSingleSalaryPayOpen(true);
  };

  const insertSalaryPays = async (payRows: { id: any; amount: number; name: string }[]) => {
    const payDate = sanitizeDate(salaryPayDate) || new Date().toISOString().split('T')[0];
    const sourceLabel = bulkSalarySource === 'bank' ? 'Banka' : 'Kasa';
    const invInserts = payRows.map(row => ({
      invoice_no: `MAAŞ - ${row.name} (#${row.id}) (${sourceLabel})`,
      direction: 'incoming',
      category: 'salary_payroll',
      total_amount: row.amount,
      issue_date: payDate,
      due_date: payDate,
      status: 'paid'
    }));
    const { error } = await supabase.from('invoices').insert(invInserts);
    if (error) throw error;
    return { payDate, sourceLabel, total: payRows.reduce((s, r) => s + r.amount, 0) };
  };

  const handleExecuteBulkSalaryPay = async () => {
    if (!isAdmin) return;
    const selectedIds = Object.keys(bulkSalaryItems).filter(id => bulkSalaryItems[Number(id)].selected);
    if (selectedIds.length === 0) {
      alert('Lütfen en az bir personel seçiniz.');
      return;
    }

    const payRows = selectedIds
      .map(id => {
        const item = bulkSalaryItems[Number(id)];
        const amount = Math.round((Number(item.net) || 0) * 100) / 100;
        return { id, amount, name: item.name };
      })
      .filter(row => row.amount > 0.009);
    if (payRows.length === 0) {
      alert('Cari neti olan kimse seçilmedi. Sözleşmeli maaş yazılmaz; yalnız kalan hak ödenir.');
      return;
    }
    const totalBulkAmount = payRows.reduce((sum, row) => sum + row.amount, 0);
    const confirm = window.confirm(`Seçilen ${payRows.length} kişinin kalan carisi ödenecek: ${totalBulkAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺.\nEksik ödenenler listede kalır. Sözleşmeli maaş ayrıca yazılmaz.`);
    if (!confirm) return;

    try {
      const done = await insertSalaryPays(payRows);
      alert(`Ödeme işlendi (${formatDateTR(done.payDate)}). Kasadan ${done.total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ düşüldü.`);
      setIsBulkSalaryModalOpen(false);
      loadPortalData();
    } catch (err: any) {
      alert('Maaş ödeme hatası: ' + err.message);
    }
  };

  const handleExecuteSingleSalaryPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const amount = cleanNumber(singleSalaryPay.amount);
    if (amount <= 0) {
      alert('Ödenecek tutar yok.');
      return;
    }
    if (amount > singleSalaryPay.net + 0.05) {
      alert('Tutar kalan cariden büyük olamaz. Avans ayrı harekettir; sözleşmeli maaşı elle yazmayın.');
      return;
    }
    if (!window.confirm(`${singleSalaryPay.name} için ${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ cari ödenecek ve kasadan düşecek.`)) return;
    try {
      await insertSalaryPays([{ id: singleSalaryPay.empId, amount, name: singleSalaryPay.name }]);
      alert('Ödeme kaydedildi. Net alacak düştü, kasa güncellendi.');
      setIsSingleSalaryPayOpen(false);
      loadPortalData();
    } catch (err: any) {
      alert('Maaş ödeme hatası: ' + err.message);
    }
  };

 // 17. GENEL GİDER / TEDARİKÇİ EKLEME & DÜZENLEME
  const handleSaveGeneralExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = cleanNumber(expenseFormData.amount);
    if (amt <= 0) {
      alert('Lütfen geçerli bir tutar giriniz.');
      return;
    }

    try {
      const desc = stripExpensePlateTags(
        expenseFormData.companyName
        || (expenseFormData.category === 'owner_personal' ? 'Şirket dışı harcama' : 'Genel Şirket Masrafı')
      );
      const invNo = stripExpensePlateTags(expenseFormData.invoiceNo);
      const plateKey = cleanPlateKey(expenseFormData.plateNumber);
      let chargeKind: VehicleChargeKind | '' =
        expenseFormData.category === 'insurance_inspection'
          ? (expenseFormData.vehicleCharge || inferVehicleChargeKind({ invoice_no: `${invNo} ${desc}` }))
          : '';
      if (expenseFormData.category === 'insurance_inspection' && plateKey && !chargeKind) {
        alert('Bu gider muayene, sigorta veya kasko mu? Plaka seçiliyse türü işaretleyin; İç Filo künyesine o sütuna yazılır.');
        return;
      }
      let fullTitle = [invNo, desc].filter(Boolean).join(' - ');
      if (chargeKind) fullTitle = `${fullTitle} ${vehicleChargeTag(chargeKind)}`.trim();
      if (plateKey) fullTitle = `${fullTitle} [${plateKey}]`;
      fullTitle = fullTitle.replace(/^\[KK\]\s*/i, '');
      const paidByCard = expenseFormData.status === 'paid' && expenseFormData.paidSource === 'card';
      if (paidByCard) fullTitle = `[KK] ${fullTitle}`;
      const payload: any = {
        invoice_no: fullTitle,
        direction: 'incoming',
        category: expenseFormData.category || 'other',
        total_amount: amt,
        issue_date: expenseFormData.issueDate,
        due_date: expenseFormData.dueDate || expenseFormData.issueDate,
        status: expenseFormData.status,
        paid_source: expenseFormData.status === 'paid' ? (paidByCard ? 'card' : 'cash') : null
      };

      const saveExpense = async (data: any) => {
        if (editingExpenseId) {
          return supabase.from('invoices').update(data).eq('id', editingExpenseId).select('id').maybeSingle();
        }
        return supabase.from('invoices').insert([data]).select('id').maybeSingle();
      };

      let { data: savedRow, error } = await saveExpense(payload);
      if (error && /paid_source/i.test(error.message)) {
        const { paid_source, ...fallback } = payload;
        const retry = await saveExpense(fallback);
        savedRow = retry.data;
        error = retry.error;
      }
      if (error) throw error;
      const savedExpenseId = editingExpenseId || savedRow?.id;
      if (plateKey && chargeKind) {
        const veh = (dbVehicles || []).find((v: any) => cleanPlateKey(v.plate_number) === plateKey);
        if (veh?.id) {
          const patch: any = {};
          if (chargeKind === 'muayene') {
            patch.inspection_cost = amt;
            const next = addOneYear(expenseFormData.issueDate);
            const cur = sanitizeDate(veh.next_inspection_date);
            if (next && (!cur || cur <= expenseFormData.issueDate)) patch.next_inspection_date = next;
          } else if (chargeKind === 'sigorta') {
            patch.insurance_cost = amt;
            if (expenseFormData.issueDate) {
              patch.insurance_start_date = expenseFormData.issueDate;
              patch.insurance_expiry_date = addOneYear(expenseFormData.issueDate);
            }
          } else if (chargeKind === 'kasko') {
            patch.kasko_cost = amt;
            if (expenseFormData.issueDate) {
              patch.kasko_start_date = expenseFormData.issueDate;
              patch.kasko_expiry_date = addOneYear(expenseFormData.issueDate);
            }
          }
          if (Object.keys(patch).length) {
            const { error: vehErr } = await supabase.from('vehicles').update(patch).eq('id', veh.id);
            if (vehErr) alert('Gider yazıldı ama İç Filo künyesi güncellenemedi: ' + vehErr.message);
          }
        }
      }
      let mahsupNote = '';
      if (!editingExpenseId && savedExpenseId && expenseFormData.category !== 'supplier_advance') {
        const party = foldPersonName(desc);
        const pool = (dbAdvances || [])
          .filter((a: any) => {
            if (String(a.target_type || '') !== 'supplier') return false;
            return foldPersonName(a.target_name || a.target_id) === party;
          })
          .map((a: any) => ({
            ...a,
            rem: cleanNumber(a.remaining_amount != null ? a.remaining_amount : a.total_amount)
          }))
          .filter((a: any) => a.rem > 0)
          .sort((a: any, b: any) => String(a.issue_date || '').localeCompare(String(b.issue_date || '')));
        const poolTotal = pool.reduce((s: number, a: any) => s + a.rem, 0);
        if (party && poolTotal > 0) {
          const take = Math.min(amt, poolTotal);
          const payable = Math.round((amt - take) * 100) / 100;
          if (window.confirm(
            `Bu tedarikçide ${poolTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ avans var.\n` +
            `Fatura ${amt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺.\n` +
            `${take.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ mahsup edilecek, ödenecek ${payable.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺.\n\nMahsup edilsin mi?`
          )) {
            let left = take;
            for (const a of pool) {
              if (left <= 0) break;
              const chunk = Math.min(a.rem, left);
              const newRem = Math.round((a.rem - chunk) * 100) / 100;
              const { error: advUp } = await supabase.from('advance_payments').update({ remaining_amount: newRem }).eq('id', a.id);
              if (advUp) throw advUp;
              left -= chunk;
            }
            const patch: any = {
              invoice_no: `${fullTitle} [AVANS MAHSUP ${take.toLocaleString('tr-TR')}]`
            };
            if (payable <= 0.009) {
              patch.status = 'paid';
            } else {
              patch.total_amount = payable;
            }
            const { error: invUp } = await supabase.from('invoices').update(patch).eq('id', savedExpenseId);
            if (invUp) throw invUp;
            mahsupNote = payable <= 0.009
              ? ` Avans faturayı kapattı; kasa tekrar düşmez.`
              : ` Avans mahsubu ${take.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺. Kalan ödenecek ${payable.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺.`;
          }
        }
      }
      alert(paidByCard
        ? 'Gider kartla kapatıldı. Kasa şimdi düşmez; kart ekstresi ödenince düşer.' + mahsupNote
        : (editingExpenseId ? 'Gider kaydı başarıyla güncellendi!' : 'Gider kaydı başarıyla eklendi!') + mahsupNote);

      setIsGeneralExpenseModalOpen(false);
      setEditingExpenseId(null);
      setExpenseFormData({
        category: 'taxes_sgk',
        companyName: '',
        plateNumber: '',
        vehicleCharge: '',
        invoiceNo: '',
        amount: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        status: 'unpaid',
        paidSource: 'bank'
      });
      loadPortalData();
    } catch (err: any) {
      alert('Gider kaydetme hatası: ' + err.message);
    }
  };

  // PERSONEL CARİ HAREKETİNİ SİL (AVANS / PRİM HATALI GİRİŞ DÜZELTME)
  const openCustomerModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomerId(customer.id);
      setCustomerFormData({
        name: customer.name || '',
        tax_id: customer.tax_id || '',
        tax_office: customer.tax_office || '',
        address: customer.address || '',
        phone: customer.phone || '',
        email: customer.email || '',
        notes: customer.notes || ''
      });
    } else {
      setEditingCustomerId(null);
      setCustomerFormData({
        name: '',
        tax_id: '',
        tax_office: '',
        address: '',
        phone: '',
        email: '',
        notes: ''
      });
    }
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const name = customerFormData.name.trim();
    if (!name) {
      alert('Müşteri unvanı zorunludur.');
      return;
    }
    const payload = {
      name,
      tax_id: customerFormData.tax_id.trim() || null,
      tax_office: customerFormData.tax_office.trim() || null,
      address: customerFormData.address.trim() || null,
      phone: customerFormData.phone.trim() || null,
      email: customerFormData.email.trim() || null,
      notes: customerFormData.notes.trim() || null
    };
    try {
      if (editingCustomerId) {
        const { error } = await supabase.from('customers').update(payload).eq('id', editingCustomerId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('customers').insert([payload]);
        if (error) throw error;
      }
      setIsCustomerModalOpen(false);
      await loadPortalData();
    } catch (err: any) {
      alert('Müşteri kaydedilemedi: ' + (err.message || 'Tablo yoksa supabase/setup_customers.sql dosyasını SQL Editor’da çalıştırın.'));
    }
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    if (!isAdmin) return;
    if (!window.confirm(`${customer.name} kartı silinsin mi? Eski faturalar durur; yeni Excel eşleşmesi bu unvanı bulamaz.`)) return;
    try {
      const { error } = await supabase.from('customers').delete().eq('id', customer.id);
      if (error) throw error;
      await loadPortalData();
    } catch (err: any) {
      alert('Müşteri silinemedi: ' + err.message);
    }
  };

  const handleDeleteAdvanceRecord = async (advId: string | number) => {
    if (!window.confirm('Bu cari kaydı (avans/prim) silmek istediğinize emin misiniz? Bakiye yeniden hesaplanacaktır.')) return;
    try {
      let { error } = await supabase.from('advance_payments').delete().eq('id', advId);
      if (error) {
        const second = await supabase.from('advances').delete().eq('id', advId);
        if (second.error) throw error;
      }
      await loadPortalData();
    } catch (err: any) {
      alert('Kayıt silinemedi: ' + err.message);
    }
  };
// PERSONEL ÇOKLU İŞLEM EKLEME (PRİM, TEKİL AVANS, TAKSİTLİ AVANS - TARİH DESTEKLİ)
  const handleAddEmployeeTransaction = async (
    empId: number | string,
    type: 'bonus' | 'advance' | 'installment_advance',
    title: string,
    totalAmount: number,
    installments: number = 1,
    txDate?: string,
    silent?: boolean,
    paidSource?: 'bank' | 'cash' | 'card'
  ) => {
    if (!canEditMod('employees')) {
      alert('Bu hesap personel primi yazamaz. Yönetici ile girin.');
      return false;
    }
    if (!empId || !title.trim() || totalAmount <= 0) {
      alert('Lütfen geçerli bir açıklama ve 0\'dan büyük bir tutar girin.');
      return false;
    }
    const instCount = Math.max(1, Number(installments) || 1);
    const monthlyCut = type === 'installment_advance' ? Math.round(totalAmount / instCount) : totalAmount;
    const finalDate = txDate || new Date().toISOString().split('T')[0];
    const row: any = {
        employee_id: empId,
      type,
        title: title.trim(),
        total_amount: totalAmount,
        installment_count: instCount,
        monthly_cut: monthlyCut,
        transaction_date: finalDate
    };

    try {
      let { error } = await supabase.from('employee_transactions').insert([row]);
      if (error && /transaction_date|could not find/i.test(error.message || '')) {
        const slim = { ...row };
        delete slim.transaction_date;
        const retry = await supabase.from('employee_transactions').insert([slim]);
        error = retry.error;
      }
      if (error) throw error;
      if (type === 'advance' || type === 'installment_advance') {
        const emp = (dbEmployees || []).find((e: any) => String(e.id) === String(empId));
        const empName = emp?.full_name || 'Personel';
        const byCard = paidSource === 'card';
        const invRow: any = {
          invoice_no: `${byCard ? '[KK] ' : ''}PERSONEL AVANS - ${empName}${title.trim() ? ' - ' + title.trim() : ''}`,
          direction: 'incoming',
          category: 'employee_advance_paid',
          total_amount: totalAmount,
          issue_date: finalDate,
          due_date: finalDate,
          status: 'paid',
          paid_source: byCard ? 'card' : 'cash'
        };
        let inv = await supabase.from('invoices').insert([invRow]);
        if (inv.error && /paid_source/i.test(inv.error.message || '')) {
          const { paid_source, ...fallback } = invRow;
          inv = await supabase.from('invoices').insert([fallback]);
        }
        if (inv.error) {
          alert('Avans personel defterine yazıldı ama kasa çıkışı oluşmadı: ' + inv.error.message);
        }
      }
      setNewEmpTx({ ...emptyEmpTx, date: finalDate });
      await loadPortalData();
      if (!silent) {
        alert(type === 'bonus' ? 'Prim kaydedildi.' : type === 'advance' ? 'Avans kaydedildi, kasa düştü.' : 'Taksitli avans kaydedildi, kasa düştü.');
      }
      return true;
    } catch (err: any) {
      alert('İşlem eklenemedi: ' + (err.message || ''));
      return false;
    }
  };

  // PERSONEL İŞLEMİ SİLME
  const handleDeleteEmployeeTransaction = async (txId: number | string) => {
    if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz? Bordro tutarları otomatik yeniden hesaplanacaktır.')) return;
    try {
      const { error } = await supabase.from('employee_transactions').delete().eq('id', txId);
      if (error) throw error;
      await loadPortalData();
    } catch (err: any) {
      alert('Kayıt silinemedi: ' + err.message);
    }
  };

  const handleDeleteSalaryPayroll = async (invId: number | string) => {
    if (!window.confirm('Bu maaş / hakediş ödemesini silmek istediğinize emin misiniz? Net alacak geri gelir.')) return;
    try {
      const { error } = await supabase.from('invoices').delete().eq('id', invId);
      if (error) throw error;
      await loadPortalData();
    } catch (err: any) {
      alert('Ödeme silinemedi: ' + err.message);
    }
  };
  
  // 18. PERSONEL EKLEME & DÜZENLEME FORMU (PRİM / EK MASRAF DESTEKLİ)
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditMod('employees')) {
      alert('Bu hesap personel kaydı yazamaz. Yönetici ile girin.');
      return;
    }
    if (!employeeFormData.fullName.trim()) return;
    const pendingAmt = cleanNumber(newEmpTx.amount);
    const pendingTitle = (newEmpTx.title || '').trim();
    if (editingEmployeeId && pendingAmt > 0 && !pendingTitle) {
      alert('Prim / avans tutarı yazıldı. Kaydolması için açıklama da yazın, sonra “Hareketi kaydet” veya Kaydet deyin.');
      return;
    }

    try {
    const bonusAmt = cleanNumber(employeeFormData.monthlyBonus);
    const advanceAmt = cleanNumber(employeeFormData.monthlyAdvance);
    const payload = {
      full_name: (employeeFormData.fullName || '').trim(),
      role_title: employeeFormData.roleTitle || 'Kamyon Şoförü / Dağıtım',
      base_salary: cleanNumber(employeeFormData.baseSalary),
      employer_sgk: cleanNumber(employeeFormData.employerSgk),
      hire_date: employeeFormData.hireDate || null,
      phone: (employeeFormData.phone || '').trim(),
      iban: formatIBAN(employeeFormData.iban || ''),
      monthly_bonus: bonusAmt,
      bonus_description: (employeeFormData.bonusDescription || '').trim(),
      monthly_advance: advanceAmt,
      advance_description: (employeeFormData.advanceDescription || '').trim(),
      advance_total: cleanNumber(employeeFormData.advanceTotal || employeeFormData.monthlyAdvance || 0),
      advance_installments: Number(employeeFormData.advanceInstallments) || 1
    };
      
    const savePayload = async (data: typeof payload) => {
    if (editingEmployeeId) {
        return supabase.from('employees').update(data).eq('id', editingEmployeeId);
      }
      return supabase.from('employees').insert([data]);
    };

    let { error } = await savePayload(payload);
    let missingColumn = false;
    if (error && /could not find the/i.test(error.message)) {
      missingColumn = true;
      const fallback: any = { ...payload };
      if (error.message.includes('hire_date')) delete fallback.hire_date;
      if (error.message.includes('employer_sgk')) delete fallback.employer_sgk;
      const retry = await savePayload(fallback);
      error = retry.error;
    }
        if (error) throw error;
    if (editingEmployeeId && pendingTitle && pendingAmt > 0) {
      const txOk = await handleAddEmployeeTransaction(
        editingEmployeeId,
        newEmpTx.type,
        pendingTitle,
        pendingAmt,
        Number(newEmpTx.inst) || 1,
        newEmpTx.date,
        true
      );
      if (!txOk) return;
    }
    alert(
      missingColumn
        ? 'Personel kaydedildi. İşe girişin kalması için setup_employee_sgk.sql dosyasını SQL Editor’da bir kez Run deyin.'
        : editingEmployeeId
          ? 'Personel kartı kaydedildi.'
          : 'Yeni personel başarıyla kaydedildi!'
    );

      setIsEmployeeModalOpen(false);
      setEditingEmployeeId(null);
      setNewEmpTx(emptyEmpTx);
      setEmployeeFormData({ fullName: '', roleTitle: 'Kamyon Şoförü / Dağıtım', baseSalary: '', employerSgk: '', phone: '', iban: '', monthlyBonus: '', bonusDescription: '', monthlyAdvance: '', advanceDescription: '', hireDate: '' });
      loadPortalData();
    } catch (err: any) {
      alert('Personel işlem hatası: ' + err.message + '\nsetup_employee_hire.sql ve setup_employee_sgk.sql dosyalarını SQL Editor’da çalıştırın.');
    }
  };

  // 19. TAŞERON IBAN EKLEME & DÜZENLEME
  const handleSaveSubIban = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditMod('sub_ibans')) return;
    const name = subIbanFormData.name.trim();
    if (!name) {
      alert('Unvan zorunludur.');
      return;
    }
    const payload: Record<string, any> = {
      name,
      iban: formatIBAN(subIbanFormData.iban || ''),
      phone: (subIbanFormData.phone || '').trim() || null,
      tax_no: (subIbanFormData.tax_no || '').trim() || null
    };
    try {
      const save = async (data: Record<string, any>) => {
        if (editingSubIbanId) return supabase.from('subcontractors').update(data).eq('id', editingSubIbanId);
        return supabase.from('subcontractors').upsert([data], { onConflict: 'name' });
      };
      let { error } = await save(payload);
      if (error && /could not find the/i.test(error.message)) {
        const fallback = { ...payload };
        if (error.message.includes('tax_no')) delete fallback.tax_no;
        if (error.message.includes('phone')) delete fallback.phone;
        const retry = await save(fallback);
        error = retry.error;
        if (!error && payload.tax_no) {
          alert('Kart kaydedildi. Vergi no’nun kalması için supabase/setup_subcontractors.sql dosyasını SQL Editor’da bir kez Run deyin.');
        }
      }
      if (error) throw error;
      setIsSubIbanModalOpen(false);
      setEditingSubIbanId(null);
      setSubIbanFormData({ name: '', iban: '', phone: '', tax_no: '' });
      loadPortalData();
    } catch (err: any) {
      alert('Kart kaydedilemedi: ' + err.message);
    }
  };

  // 20. GELİŞMİŞ ARAÇ KAYIT & DÜZENLEME
  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditMod('fleet')) return;
    if (!vehicleFormData.plateNumber.trim()) {
      alert('Lütfen araç plakasını giriniz.');
      return;
    }

    setIsSavingVehicle(true);
    try {
      const insExpiry = vehicleFormData.insuranceStartDate ? addOneYear(vehicleFormData.insuranceStartDate) : null;
      const kaskoExpiry = vehicleFormData.kaskoStartDate ? addOneYear(vehicleFormData.kaskoStartDate) : null;

      const payload = {
        plate_number: vehicleFormData.plateNumber.trim().toUpperCase(),
        driver_name: vehicleFormData.driverName.trim(),
        brand_model: vehicleFormData.brandModel.trim(),
        document_included: vehicleFormData.documentIncluded,
        tracking_system: vehicleFormData.trackingSystem,
        fuel_system: vehicleFormData.fuelSystem,
        hgs_system: vehicleFormData.hgsSystem,
        vehicle_type: vehicleFormData.vehicleType,
        ownership_type: vehicleFormData.ownershipType,
        is_active: vehicleFormData.isActive !== false,
        next_inspection_date: vehicleFormData.nextInspectionDate || null,
        inspection_cost: cleanNumber(vehicleFormData.inspectionCost),
        insurance_company: vehicleFormData.insuranceCompany.trim() || null,
        insurance_cost: cleanNumber(vehicleFormData.insuranceCost),
        insurance_start_date: vehicleFormData.insuranceStartDate || null,
        insurance_expiry_date: insExpiry,
        kasko_company: vehicleFormData.kaskoCompany.trim() || null,
        kasko_cost: cleanNumber(vehicleFormData.kaskoCost),
        kasko_start_date: vehicleFormData.kaskoStartDate || null,
        kasko_expiry_date: kaskoExpiry,
        last_mtv_cost: cleanNumber(vehicleFormData.lastMtvCost)
      };

      if (editingVehicleId) {
        const { error } = await supabase.from('vehicles').update(payload).eq('id', editingVehicleId);
        if (error) throw error;
        alert('Araç ve poliçe bilgileri güncellendi!');
      } else {
        const { error } = await supabase.from('vehicles').insert([payload]);
        if (error) throw error;
        alert('Yeni araç filoya eklendi!');
      }

      setIsVehicleModalOpen(false);
      setEditingVehicleId(null);
      loadPortalData();
    } catch (err: any) {
      alert('Araç işlem hatası: ' + (err.message || err) + '\nGerekirse setup_vehicles.sql dosyasını SQL Editor’da çalıştırın.');
    } finally {
      setIsSavingVehicle(false);
    }
  };

  const openEditVehicleModal = (v: any) => {
    if (!v) return;
    setEditingVehicleId(v.id || null);
    setVehicleFormData({
      plateNumber: v.plate_number || '',
      driverName: v.driver_name || '',
      brandModel: v.brand_model || '',
      documentIncluded: v.document_included || 'VAR',
      trackingSystem: v.tracking_system || 'Var',
      fuelSystem: v.fuel_system || 'UTTS',
      hgsSystem: v.hgs_system || 'SHELL',
      vehicleType: normalizeVehicleType(v.vehicle_type),
      ownershipType: v.ownership_type || 'Öz Mal',
      isActive: v.is_active !== false,
      nextInspectionDate: sanitizeDate(v.next_inspection_date),
      inspectionCost: String(v.inspection_cost || ''),
      insuranceCompany: v.insurance_company || '',
      insuranceCost: String(v.insurance_cost || ''),
      insuranceStartDate: sanitizeDate(v.insurance_start_date),
      kaskoCompany: v.kasko_company || '',
      kaskoCost: String(v.kasko_cost || ''),
      kaskoStartDate: sanitizeDate(v.kasko_start_date),
      lastMtvCost: String(v.last_mtv_cost || '')
    });
    setIsVehicleModalOpen(true);
  };

  // 21. 360° ÇEKMECE PANELİ
  const openVehicle360 = (v: any) => {
    const cleanPlate = String(v.plate_number || '').replace(/\s+/g, '').toUpperCase();
    const relatedProfit = dbProfitability.filter(p => String(p.plate_number || '').replace(/\s+/g, '').toUpperCase() === cleanPlate);
    const relatedExpenses = dbInvoices.filter(i => String(i.invoice_no || '').toUpperCase().includes(cleanPlate));
    const paidFines = relatedExpenses.filter(i => i.category === 'traffic_fines').reduce((s, i) => s + cleanNumber(i.total_amount), 0);

    setDrawerData({
      isOpen: true,
      type: 'vehicle',
      title: `${v.plate_number}`,
      subtitle: `${v.brand_model || ''} • Sürücü: ${v.driver_name || 'Atanmadı'}`,
      meta: v,
      vehicleSummary: {
        lastInsurance: cleanNumber(v.insurance_cost),
        lastKasko: cleanNumber(v.kasko_cost),
        lastInspection: cleanNumber(v.inspection_cost),
        lastMtv: cleanNumber(v.last_mtv_cost),
        paidFines
      },
      items: [
        { label: 'Aylık Karlılık Verileri', data: relatedProfit },
        { label: 'Doğrudan Masraflar & Faturalar', data: relatedExpenses }
      ]
    });
  };

  const plateRentalRows = useMemo(() => {
    const term = plateRentalSearch.toLocaleLowerCase('tr-TR').trim();
    const amountOf = (r: any) => r.collection_kind === 'devlet' ? cleanNumber(r.government_fee) : cleanNumber(r.rent_amount);
    return (dbPlateRentals || [])
      .map((r: any) => {
        const days = daysUntilDate(r.renewal_date);
        let alert: 'overdue' | 'd15' | 'd30' | null = null;
        if (days !== null) {
          if (days <= 0) alert = 'overdue';
          else if (days <= 15) alert = 'd15';
          else if (days <= 30) alert = 'd30';
        }
        return { ...r, days, alert };
      })
      .filter((r: any) => {
        if (plateRentalTypeFilter !== 'all' && plateVehicleTypeOf(r) !== plateRentalTypeFilter) return false;
        if (!term) return true;
        return `${r.plate} ${r.owner_name} ${r.phone || ''} ${plateVehicleTypeOf(r)} ${r.notes || ''}`.toLocaleLowerCase('tr-TR').includes(term);
      })
      .sort((a: any, b: any) => {
        if (plateRentalSort === 'plate') return String(a.plate || '').localeCompare(String(b.plate || ''), 'tr');
        if (plateRentalSort === 'owner') return String(a.owner_name || '').localeCompare(String(b.owner_name || ''), 'tr');
        if (plateRentalSort === 'type') return plateVehicleTypeOf(a).localeCompare(plateVehicleTypeOf(b), 'tr');
        if (plateRentalSort === 'amount') return amountOf(a) - amountOf(b);
        const ar = a.alert ? 0 : 1;
        const br = b.alert ? 0 : 1;
        if (ar !== br) return ar - br;
        return String(a.renewal_date || '9999').localeCompare(String(b.renewal_date || '9999'));
      });
  }, [dbPlateRentals, plateRentalSearch, plateRentalSort, plateRentalTypeFilter]);

  const plateRenewalAlerts = useMemo(() => {
    return (dbPlateRentals || [])
      .map((r: any) => {
        const days = daysUntilDate(r.renewal_date);
        let alert: 'overdue' | 'd15' | 'd30' | null = null;
        if (days !== null) {
          if (days <= 0) alert = 'overdue';
          else if (days <= 15) alert = 'd15';
          else if (days <= 30) alert = 'd30';
        }
        return { plate: r.plate, days, alert };
      })
      .filter((r: any) => r.alert)
      .sort((a: any, b: any) => (a.days ?? 999) - (b.days ?? 999));
  }, [dbPlateRentals]);

  const rentalSettlementRows = useMemo(() => {
    const term = rentalSettlementSearch.toLocaleLowerCase('tr-TR').trim();
    return (dbRentalSettlements || [])
      .map((r: any) => ({ ...r, totals: rentalSettlementTotals(r) }))
      .filter((r: any) => {
        if (rentalWorkGroup && rentalRowGroup(r) !== rentalWorkGroup) return false;
        if (rentalSettlementMonth && String(r.year_month || '') !== rentalSettlementMonth) return false;
        if (rentalStatusFilter !== 'all' && String(r.status || 'draft') !== rentalStatusFilter) return false;
        if (rentalContractorFilter && r.contractor_name !== rentalContractorFilter) return false;
        if (!term) return true;
        return `${r.plate} ${r.contractor_name} ${r.province || ''} ${r.region || ''} ${r.vehicle_type || ''}`.toLocaleLowerCase('tr-TR').includes(term);
      })
      .sort((a: any, b: any) => {
        if (rentalListSort === 'plate') return String(a.plate || '').localeCompare(String(b.plate || ''), 'tr');
        if (rentalListSort === 'status') return String(a.status || 'draft').localeCompare(String(b.status || 'draft'));
        if (rentalListSort === 'amount') return (b.totals?.payable || 0) - (a.totals?.payable || 0);
        return String(a.contractor_name || '').localeCompare(String(b.contractor_name || ''), 'tr') || String(a.plate || '').localeCompare(String(b.plate || ''), 'tr');
      });
  }, [dbRentalSettlements, rentalSettlementSearch, rentalSettlementMonth, rentalWorkGroup, rentalStatusFilter, rentalContractorFilter, rentalListSort]);

  const rentalGroupMonthRows = useMemo(() => {
    return (dbRentalSettlements || [])
      .filter((r: any) => {
        if (rentalWorkGroup && rentalRowGroup(r) !== rentalWorkGroup) return false;
        if (rentalSettlementMonth && String(r.year_month || '') !== rentalSettlementMonth) return false;
        return true;
      })
      .map((r: any) => ({ ...r, totals: rentalSettlementTotals(r) }));
  }, [dbRentalSettlements, rentalWorkGroup, rentalSettlementMonth]);

  const rentalGroupSummary = useMemo(() => {
    return rentalGroupMonthRows.reduce((acc: any, r: any) => {
      const t = r.totals || rentalSettlementTotals(r);
      acc.payable = roundMoney(acc.payable + (t.payable || 0));
      acc.term1 = roundMoney(acc.term1 + (t.term1 || 0));
      acc.term2 = roundMoney(acc.term2 + (t.term2 || 0));
      acc.count += 1;
      return acc;
    }, { payable: 0, term1: 0, term2: 0, count: 0 });
  }, [rentalGroupMonthRows]);

  const rentalRosterOpen = rentalRosterSyncOpen(rentalSettlementMonth);
  const rentalFleetRoster = useMemo(
    () => buildRentalFleetRoster(dbAracVehicles, dbAracAssignments, rentalWorkGroup),
    [dbAracAssignments, dbAracVehicles, rentalWorkGroup]
  );

  const rentalGroupLabel = RENTAL_WORK_GROUPS.find(g => g.id === rentalWorkGroup)?.label || 'Kiralık Araçlar';
  const rentalContractorNames = [...new Set([
    ...(dbRentalSettlements || []).map((r: any) => r.contractor_name),
    ...(dbSubcontractors || []).map((s: any) => s.name || s.full_name || s.title)
  ].filter(Boolean))].sort((a: string, b: string) => a.localeCompare(b, 'tr'));
  const rentalVisibleGroups = isSaha
    ? RENTAL_WORK_GROUPS.filter(g => rentalAssignedGroups.includes(g.id))
    : RENTAL_WORK_GROUPS;
  const rentalContractorsInGroup = [...new Set(
    (dbRentalSettlements || [])
      .filter((r: any) => (!rentalWorkGroup || rentalRowGroup(r) === rentalWorkGroup) && (!rentalSettlementMonth || String(r.year_month || '') === rentalSettlementMonth))
      .map((r: any) => r.contractor_name)
      .filter(Boolean)
  )].sort((a: string, b: string) => a.localeCompare(b, 'tr'));

  const handleAdminSaveAllRental = async () => {
    if (!isAdmin) return;
    const monthOpen = rentalAdminCanEditMonth(rentalSettlementMonth);
    const openRows = (rentalGroupMonthRows || []).filter((r: any) => (r.status || 'draft') !== 'approved');
    const selectedEditable = rentalEditRow && !rentalRowLockedForUser(rentalEditRow, 'admin');
    if (!openRows.length && !selectedEditable) {
      alert(monthOpen
        ? 'Kaydedilecek değişiklik yok. Soldan bir kilitli satır açıp düzeltin, sonra kaydedin.'
        : `Bu ay kilitli. Yönetici düzeltmesi ${yearMonthTrLabel(rentalAdminGraceUntilMonth(rentalSettlementMonth))} sonuna kadardı.`);
      return;
    }
    if (!window.confirm(openRows.length
      ? `${rentalGroupLabel} · ${rentalSettlementMonth}\n${openRows.length} araç kaydedilip onaya alınacak. Saha göndermese de olur.${monthOpen ? ' Onaylı satırları da sonraki ay boyunca düzeltebilirsiniz.' : ''}`
      : `${rentalGroupLabel} · ${rentalSettlementMonth}\nAçık satırdaki düzeltme kaydedilecek. Durum kilitli kalır.`)) return;
    let selectedPayload: any = null;
    if (selectedEditable) {
      const meta = rentalGroupMeta(rentalRowGroup(rentalEditRow));
      const stopCount = parseLocaleNumber(rentalSettlementForm.stop_count);
      const visitOverride = parseLocaleNumber(rentalSettlementForm.visit_prime);
      selectedPayload = {
        rent_amount: parseLocaleNumber(rentalSettlementForm.rent_amount),
        fuel_rate: parseLocaleNumber(rentalSettlementForm.fuel_rate),
        fuel_unit_price: parseLocaleNumber(rentalSettlementForm.fuel_unit_price),
        total_km: parseLocaleNumber(rentalSettlementForm.total_km),
        work_days: meta.hasWorkDays ? parseLocaleNumber(rentalSettlementForm.work_days) : (rentalEditRow.work_days || 0),
        stop_count: stopCount,
        visit_prime: visitOverride > 0 ? visitOverride : stopCount * (meta.visitUnit || 0),
        extra_work: parseLocaleNumber(rentalSettlementForm.extra_work),
        hgs: meta.hasHgs ? parseLocaleNumber(rentalSettlementForm.hgs) : 0,
        fuel_charge: parseLocaleNumber(rentalSettlementForm.fuel_charge),
        status: rentalEditRow.status === 'approved' ? 'approved' : 'submitted'
      };
    }
    const ids = openRows.map((r: any) => r.id);
    const { error } = ids.length
      ? await supabase.from('rental_settlements').update({ status: 'submitted' }).in('id', ids)
      : { error: null } as any;
    if (error) {
      alert('Toplu kayıt yazılamadı: ' + error.message);
      return;
    }
    if (selectedPayload && rentalEditRow) {
      const { error: e2 } = await supabase.from('rental_settlements').update(selectedPayload).eq('id', rentalEditRow.id);
      if (e2) {
        alert('Açık satır kaydedilemedi: ' + e2.message);
        return;
      }
    }
    setDbRentalSettlements(prev => prev.map((r: any) => {
      if (selectedPayload && rentalEditRow && r.id === rentalEditRow.id) return { ...r, ...selectedPayload };
      if (ids.includes(r.id)) return { ...r, status: 'submitted' };
      return r;
    }));
    if (selectedPayload && rentalEditRow) setRentalEditRow((prev: any) => prev ? { ...prev, ...selectedPayload } : prev);
    alert(openRows.length
      ? `${openRows.length} araç kaydedildi. Onay bekliyor.`
      : 'Düzeltme kaydedildi. Satır kilitli kaldı.');
  };

  const handleAdminApproveAllRental = async () => {
    if (!isAdmin) return;
    const openRows = (rentalGroupMonthRows || []).filter((r: any) => (r.status || 'draft') !== 'approved');
    if (!openRows.length) {
      alert('Bu grup ve ayda onaylanacak açık araç yok.');
      return;
    }
    if (!window.confirm(`${rentalGroupLabel} · ${rentalSettlementMonth}\n${openRows.length} araç onaylanıp kilitlenecek. Saha göndermese de olur. Sonra mutabakat indirilebilir.`)) return;
    if (rentalEditRow && rentalEditRow.status !== 'approved') {
      const meta = rentalGroupMeta(rentalRowGroup(rentalEditRow));
      const stopCount = parseLocaleNumber(rentalSettlementForm.stop_count);
      const visitOverride = parseLocaleNumber(rentalSettlementForm.visit_prime);
      const selectedPayload: any = {
        rent_amount: parseLocaleNumber(rentalSettlementForm.rent_amount),
        fuel_rate: parseLocaleNumber(rentalSettlementForm.fuel_rate),
        fuel_unit_price: parseLocaleNumber(rentalSettlementForm.fuel_unit_price),
        total_km: parseLocaleNumber(rentalSettlementForm.total_km),
        work_days: meta.hasWorkDays ? parseLocaleNumber(rentalSettlementForm.work_days) : (rentalEditRow.work_days || 0),
        stop_count: stopCount,
        visit_prime: visitOverride > 0 ? visitOverride : stopCount * (meta.visitUnit || 0),
        extra_work: parseLocaleNumber(rentalSettlementForm.extra_work),
        hgs: meta.hasHgs ? parseLocaleNumber(rentalSettlementForm.hgs) : 0,
        fuel_charge: parseLocaleNumber(rentalSettlementForm.fuel_charge),
        status: 'approved'
      };
      const { error: e2 } = await supabase.from('rental_settlements').update(selectedPayload).eq('id', rentalEditRow.id);
      if (e2) {
        alert('Açık satır kaydedilemedi: ' + e2.message);
        return;
      }
    }
    const ids = openRows.map((r: any) => r.id);
    const { error } = await supabase.from('rental_settlements').update({ status: 'approved' }).in('id', ids);
    if (error) {
      alert('Toplu onay yazılamadı: ' + error.message);
      return;
    }
    setDbRentalSettlements(prev => prev.map((r: any) => ids.includes(r.id) ? { ...r, status: 'approved' } : r));
    if (rentalEditRow && ids.includes(rentalEditRow.id)) setRentalEditRow((prev: any) => prev ? { ...prev, status: 'approved' } : prev);
    alert(`${openRows.length} araç onaylandı ve kilitlendi.`);
  };

  const handleDownloadAllRentalFis = async () => {
    if (!isAdmin && !isReporter) return;
    const rows = rentalGroupMonthRows || [];
    if (!rows.length) {
      alert('Bu grup ve ayda fiş indirilecek araç yok.');
      return;
    }
    const zip = new JSZip();
    const used = new Set<string>();
    for (const r of rows) {
      let name = rentalFisFileName(r);
      if (used.has(name)) name = name.replace(/\.pdf$/i, `_${used.size}.pdf`);
      used.add(name);
      zip.file(name, await buildRentalFisPdf({ ...r, totals: r.totals || rentalSettlementTotals(r) }));
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const folder = `Mutabakat_fisleri_${rentalGroupLabel.replace(/\s+/g, '_')}_${rentalSettlementMonth || 'ay'}.zip`;
    downloadBlob(blob, folder);
  };

  const handleOpenRentalMonth = async (opts?: { silent?: boolean }) => {
    if (!isAdmin) return;
    const silent = !!opts?.silent;
    if (!rentalSettlementMonth) {
      if (!silent) alert('Önce ay seçin.');
      return;
    }
    if (!rentalRosterSyncOpen(rentalSettlementMonth)) {
      if (!silent) {
        alert(`${rentalSettlementMonth} kadrosu kilitli. Filo işareti ancak ayın kendi takvim ayı bitmeden (sonraki ayın 1’i olmadan) eşleşir. Geçmiş ay listesine dokunulmaz.`);
      }
      return;
    }
    if (rentalSyncingRef.current) return;
    rentalSyncingRef.current = true;
    try {
      const prev = addYearMonth(rentalSettlementMonth, -1);
      let vehicles: any[] = [];
      let assignments: any[] = [];
      try {
        vehicles = await fetchAllRows('fleet_vehicles', { column: 'plate', ascending: true });
        assignments = await fetchAllRows('fleet_vehicle_assignments');
      } catch {
        vehicles = dbAracVehicles || [];
        assignments = dbAracAssignments || [];
      }
      setDbAracVehicles(vehicles);
      setDbAracAssignments(assignments);
      const roster = buildRentalFleetRoster(vehicles, assignments, rentalWorkGroup);
      if (!roster.length) {
        if (!silent) {
          alert(`Araç Filosu’nda ${rentalGroupLabel} işaretli plaka yok. Önce künyede kiralık grubu işaretleyin; işaret yokken mevcut liste silinmez.`);
        }
        return;
      }
      const { data: monthSettlements, error: monthErr } = await supabase
        .from('rental_settlements')
        .select('*')
        .in('year_month', [rentalSettlementMonth, prev].filter(Boolean));
      if (monthErr) {
        if (!silent) alert('Kiralık kayıtlar okunamadı: ' + monthErr.message);
        return;
      }
      const allMonth = monthSettlements || [];
      const fleetKeys = new Set(roster.map((v: any) => v.plateKey));
      const currentRows = allMonth.filter((r: any) =>
        rentalRowGroup(r) === rentalWorkGroup && String(r.year_month || '') === rentalSettlementMonth
      );
      const prevByPlate = new Map<string, any>();
      allMonth.forEach((r: any) => {
        if (rentalRowGroup(r) !== rentalWorkGroup || String(r.year_month || '') !== prev) return;
        const k = rentalPlateKey(r.plate);
        if (k && !prevByPlate.has(k)) prevByPlate.set(k, r);
      });
      const currentByPlate = new Set(currentRows.map((r: any) => rentalPlateKey(r.plate)).filter(Boolean));
      const toInsert = roster
        .filter((v: any) => !currentByPlate.has(v.plateKey))
        .map((v: any) => {
          const src = prevByPlate.get(v.plateKey);
          return {
            year_month: rentalSettlementMonth,
            province: src?.province || null,
            region: src?.region || null,
            plate: src?.plate || v.plate,
            contractor_name: src?.contractor_name || v.contractor_name || '-',
            vehicle_type: src?.vehicle_type || null,
            rent_amount: cleanNumber(src?.rent_amount),
            fuel_rate: cleanNumber(src?.fuel_rate),
            fuel_unit_price: 0,
            total_km: 0,
            work_days: 0,
            stop_count: 0,
            visit_prime: 0,
            extra_work: 0,
            hgs: 0,
            fuel_charge: 0,
            notes: src?.notes || v.notes || null,
            work_group: rentalWorkGroup,
            status: 'draft'
          };
        });
      const dropRows = currentRows.filter((r: any) => !fleetKeys.has(rentalPlateKey(r.plate)) && rentalSettlementRowEmpty(r));
      const keptWithData = currentRows.filter((r: any) => !fleetKeys.has(rentalPlateKey(r.plate)) && !rentalSettlementRowEmpty(r));
      if (!toInsert.length && !dropRows.length) {
        if (!silent) {
          alert(keptWithData.length
            ? `Liste filoyla aynı. ${keptWithData.length} plaka filoda yok ama km/gün yazılı veya onaylı; bırakıldı.`
            : 'Liste zaten Araç Filosu işaretleriyle aynı.');
        }
        return;
      }
      let inserted: any[] = [];
      if (toInsert.length) {
        let { data, error } = await supabase.from('rental_settlements').insert(toInsert).select();
        if (error && /work_group|status/i.test(error.message || '')) {
          const slim = toInsert.map(({ work_group: _g, status: _s, ...rest }) => rest);
          ({ data, error } = await supabase.from('rental_settlements').insert(slim).select());
        }
        if (error) {
          if (!silent) alert('Filodan eklenemedi: ' + error.message);
          return;
        }
        inserted = data || [];
      }
      const dropIds = dropRows.map((r: any) => r.id).filter(Boolean);
      if (dropIds.length) {
        const { error } = await supabase.from('rental_settlements').delete().in('id', dropIds);
        if (error) {
          if (!silent) alert('Filoda olmayan boş satırlar silinemedi: ' + error.message);
          return;
        }
      }
      const dropSet = new Set(dropIds);
      setDbRentalSettlements(prevRows => [
        ...(prevRows || []).filter((r: any) => !dropSet.has(r.id)),
        ...inserted
      ]);
      if (!silent) setRentalEditRow(null);
      else if (dropRows.some((r: any) => rentalEditRow && r.id === rentalEditRow.id)) setRentalEditRow(null);
      if (!silent) {
        const bits = [];
        if (toInsert.length) bits.push(`${toInsert.length} plaka eklendi`);
        if (dropRows.length) bits.push(`${dropRows.length} boş plaka listeden düştü`);
        if (keptWithData.length) bits.push(`${keptWithData.length} km’li/onaylı plaka bırakıldı`);
        alert(`${rentalGroupLabel} · ${rentalSettlementMonth}\n${bits.join('. ')}.`);
      }
    } finally {
      rentalSyncingRef.current = false;
    }
  };

  useEffect(() => {
    if (!isAdmin || loading || !rentalSettlementMonth) return;
    if (!rentalRosterSyncOpen(rentalSettlementMonth)) return;
    handleOpenRentalMonth({ silent: true });
  }, [isAdmin, loading, rentalWorkGroup, rentalSettlementMonth]);

  const handleDownloadRentalMutabakat = (contractorName: string) => {
    const rows = rentalSettlementRows.filter((r: any) => r.contractor_name === contractorName);
    const useRows = rows.filter((r: any) => r.status === 'approved');
    if (!useRows.length) {
      alert('Bu alt yüklenicide onaylı satır yok. Yönetici onayından sonra mutabakat kilitlenir ve indirilir.');
      return;
    }
    const header = [['ARAÇ MUTABAKAT RAPORU', rentalGroupLabel, useRows[0].year_month], []];
    const body = useRows.map((r: any) => {
      const t = r.totals || rentalSettlementTotals(r);
      return [
        r.plate,
        r.contractor_name,
        r.province || r.region,
        cleanNumber(r.rent_amount),
        formatNumTR(cleanNumber(r.fuel_rate), 4),
        formatNumTR(cleanNumber(r.total_km), 0),
        t.fuelIncome,
        cleanNumber(r.visit_prime),
        cleanNumber(r.extra_work),
        cleanNumber(r.hgs),
        cleanNumber(r.fuel_charge),
        t.brut,
        t.kdv,
        t.stoppage,
        t.payable,
        t.term1,
        t.term2
      ];
    });
    writeExcelAoa([
      ...header,
      ['Plaka', 'Fatura kesen', 'Bölge', 'Kira', 'Yakıt oran', 'KM', 'Yakıt geliri', 'Uğrama primi', 'Ek iş', 'HGS', 'Yakıt kesintisi', 'Brüt', 'KDV', 'Tevkifat', 'Ödenecek', '1. Ödeme', '2. Ödeme'],
      ...body
    ], `Mutabakat_${contractorName}_${useRows[0].year_month || ''}.xlsx`, 'Mutabakat');
  };

  // GİRİŞ EKRANI (AUTH)
  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <p className="text-white text-sm font-medium">Oturum kontrol ediliyor…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-block"><TazeyolBrand /></div>
            <p className="text-xs text-slate-500">Soğuk Zincir Lojistiği ERP Yönetim Portalı</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-medium">
                {loginError}
              </div>
            )}
            <div>
              <label className="block font-bold text-slate-700 mb-1">E-posta</label>
              <input
                type="email"
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                placeholder="ornek@tazeyol.com.tr"
                autoComplete="username"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Şifre</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginBusy}
              className="w-full py-3 bg-[#009fe3] hover:bg-[#0087c2] disabled:opacity-60 text-white font-bold rounded-xl transition shadow-md">
              {loginBusy ? 'Giriş yapılıyor…' : 'Giriş Yap'}
            </button>
          </form>
        </div>
        </div>
        <PortalTechFooter />
      </div>
    );
  }

  if (!portalDataReady) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="text-white text-sm font-medium">Kayıtlar yükleniyor…</p>
          <p className="text-slate-400 text-xs">Kasa ve hatırlatmalar faturalar gelmeden gösterilmez.</p>
        </div>
      </div>
    );
  }

 const menuItems = [
    { id: 'overview', label: 'Genel Görünüm', icon: LayoutDashboard },
    { id: 'customers', label: 'Müşteri Kartları', badge: dbCustomers.length, icon: Contact },
    { id: 'sales_customers', label: 'Satış Faturaları', badge: salesDetailedList.length, icon: TrendingUp },
    { id: 'dis_alim', label: 'Dış Alım Mutabakatı', badge: dbDisAlimLines.length, icon: FileSpreadsheet },
    { id: 'subcontractors', label: 'Hakediş Faturaları', badge: dbInvoices.filter(i => i.category === 'subcontractor_invoice').length, icon: Users },
    { id: 'sub_accounts', label: 'Cari Kartları', badge: dbSubcontractors.length, icon: Building2 },
    { id: 'payments', label: 'Banka Ödeme Talimatı', icon: FileCheck2 },
    { id: 'sub_ibans', label: 'Alt Yüklenici Tanımları', badge: dbSubcontractors.length, icon: Wallet },
    { id: 'employees', label: 'Personel & Bordro', badge: dbEmployees.length, icon: UserCheck },
    { id: 'credit_cards', label: 'Kredi Kartları', badge: dbCreditCards.length, icon: CreditCard },
    { id: 'arac_filosu', label: 'Araç Filosu (künye)', badge: dbAracVehicles.length, icon: Truck },
    { id: 'fleet', label: 'İç Filo (öz mal)', badge: dbVehicles.length, icon: Truck },
    { id: 'profitability', label: 'Öz Mal Karlılık & Maliyet', badge: dbProfitability.length, icon: BarChart3 },
    { id: 'monthly_view', label: 'Aylık görünüm', icon: Calendar },
    { id: 'income_report', label: 'Gelir Gider Raporu', icon: FileText },
    { id: 'collections', label: 'Müşteri Tahsilatları', badge: dbInvoices.filter(i => i.category === 'customer_collection' || i.category === 'customer_advance').length, icon: Coins },
    { id: 'general_expenses', label: 'Genel Giderler & Tedarik', icon: Receipt },
    { id: 'rental_settlements', label: 'Kiralık Araçlar', badge: dbRentalSettlements.length, icon: FileSpreadsheet },
    { id: 'trip_settlements', label: 'Filo (sefer)', badge: dbTripPlates.length, icon: List },
    { id: 'hal_saha', label: 'Sefer ve tahsilat', badge: dbHalEntries.length, icon: Building2 },
    { id: 'hal_saha_report', label: 'Hal saha takibi', icon: BarChart3 },
    { id: 'plate_rentals', label: 'Belge Plaka Kiraları', badge: dbPlateRentals.length, icon: Tag },
    { id: 'users', label: 'Kullanıcılar', badge: portalUsers.length, icon: ShieldCheck },
  ];
  const sidebarItems = menuItems.filter((item) => canViewMod(item.id));
  const menuById = Object.fromEntries(menuItems.map((item) => [item.id, item]));
  const sidebarGroups = [
    { id: 'reports', label: 'Raporlar', itemIds: ['monthly_view', 'income_report', 'profitability', 'dis_alim', 'hal_saha_report'] },
    { id: 'money', label: 'Para', itemIds: ['sales_customers', 'collections', 'customers', 'credit_cards', 'general_expenses'] },
    { id: 'sub', label: 'Alt yüklenici', itemIds: ['subcontractors', 'sub_accounts', 'payments', 'sub_ibans', 'rental_settlements', 'trip_settlements'] },
    { id: 'fleet', label: 'Araç', itemIds: ['arac_filosu', 'fleet', 'plate_rentals'] },
    { id: 'hal', label: 'Hal saha', itemIds: ['hal_saha'] },
    { id: 'people', label: 'İnsan ve yetki', itemIds: ['employees', 'users'] }
  ].map(g => ({
    ...g,
    items: g.itemIds
      .map(id => menuById[id])
      .filter(item => item && canViewMod(item.id))
      .sort((a, b) => String(a.label).localeCompare(String(b.label), 'tr'))
  }))
    .sort((a, b) => a.label.localeCompare(b.label, 'tr'))
    .filter(g => g.items.length);

  const goTab = (id: typeof activeTab, extra?: { filoDepot?: string; rentalGroup?: string }) => {
    startNav(() => {
      if (id === 'sales_customers') {
        setSalesSearchQuery('');
        setSalesStatusFilter('all');
      }
      if (id === 'general_expenses') setExpenseStatusFilter('unpaid');
      if (extra?.filoDepot) setFiloDepot(extra.filoDepot as FiloDepotId);
      if (extra?.rentalGroup) {
        setRentalWorkGroup(extra.rentalGroup as (typeof RENTAL_WORK_GROUPS)[number]['id']);
        setRentalContractorFilter('');
        setRentalDownloadContractor('');
      }
      setActiveTab(id);
    });
  };
  const filoMenuItems = filoVisibleDepots(currentUserRole, filoAssignedDepots, dbFiloDepots).map(d => ({
    id: d.id,
    label: d.label,
    count: (dbTripPlates || []).filter((p: any) => p.depot === d.id && p.is_active !== false).length
  }));
  const rentalMenuItems = rentalVisibleGroups.map(g => ({
    id: g.id,
    label: g.label,
    count: (dbRentalSettlements || []).filter((r: any) => rentalRowGroup(r) === g.id).length
  }));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      {/* ÜST MENÜ ÇUBUĞU */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <PortalMenu
              brand={<TazeyolBrand />}
              canOverview={canViewMod('overview')}
              activeTab={activeTab}
              filoDepot={filoDepot}
              rentalWorkGroup={rentalWorkGroup}
              sidebarGroups={sidebarGroups}
              filoMenus={filoMenuItems}
              rentalMenus={rentalMenuItems}
              onHome={() => goTab((canViewMod('overview') ? 'overview' : (canViewMod('rental_settlements') ? 'rental_settlements' : (sidebarItems[0]?.id as any) || 'overview')) as typeof activeTab)}
              onNavigate={(id, extra) => goTab(id as typeof activeTab, extra)}
            />
            <button
              type="button"
              onClick={() => goTab((canViewMod('overview') ? 'overview' : (canViewMod('rental_settlements') ? 'rental_settlements' : (sidebarItems[0]?.id as any) || 'overview')) as typeof activeTab)}
              className="border-l border-slate-200 pl-3 text-left hover:opacity-80 transition"
              title="Ana ekran"
            >
              <TazeyolBrand />
            </button>
            {canViewMod('overview') && activeTab !== 'overview' && (
              <button
                type="button"
                onClick={() => goTab('overview')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#009fe3]/10 hover:bg-[#009fe3]/20 text-[#009fe3] font-bold text-xs transition"
              >
                <LayoutDashboard className="w-4 h-4" /> Ana ekran
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            {['overview', 'customers', 'collections', 'income_report', 'sales_customers', 'subcontractors', 'general_expenses', 'employees'].includes(activeTab) && (
              <PortalPeriodMenu
                start={filterStartDate}
                end={filterEndDate}
                formatDateTR={formatDateTR}
                onStart={setFilterStartDate}
                onEnd={setFilterEndDate}
                onPeriod={applyPeriod}
                currentMonth={getCurrentMonthRange}
                previousMonth={getPreviousMonthRange}
              />
            )}
            <span className={`hidden sm:inline text-[11px] font-bold px-2.5 py-1 rounded-full ${isAdmin ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : isReporter ? 'bg-slate-100 text-slate-700 border border-slate-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
              {isAdmin ? 'Yönetici' : isReporter ? 'Rapor · salt okuma' : `Personel${rentalAssignedGroups.length ? ' · ' + rentalAssignedGroups.map(id => RENTAL_WORK_GROUPS.find(g => g.id === id)?.label).filter(Boolean).join(', ') : ''}`}
            </span>
            <button onClick={loadPortalData} title="Verileri Yenile" className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleLogout} title="Güvenli Çıkış" className="p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {seesPolicyExpiryAlert && policyExpiryAlertOpen && policyExpiryAlerts.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm z-[81] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-amber-200">
            <div className="flex items-start gap-3 pb-3 border-b border-amber-100">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-black text-amber-950 text-base">Muayene / sigorta / kasko 1 ay içinde</h3>
                <p className="text-xs text-amber-800 mt-0.5">{policyExpiryAlerts.length} kayıt · 30 gün kala veya tarihi geçmiş</p>
              </div>
            </div>
            <div className="mt-3 max-h-64 overflow-y-auto space-y-1.5">
              {policyExpiryAlerts.slice(0, 16).map(row => (
                <div key={row.id} className={`flex justify-between gap-3 text-xs rounded-lg px-3 py-2 border ${row.days < 0 ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'}`}>
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-slate-900 block">{row.plate}</span>
                    <span className="text-slate-600">{row.kind} · {row.driver}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`font-black block ${row.days < 0 ? 'text-rose-800' : 'text-amber-800'}`}>{formatDateTR(row.date)}</span>
                    <span className="text-[10px] font-semibold text-slate-500">
                      {row.days < 0 ? `${Math.abs(row.days)} gün geçti` : row.days === 0 ? 'Bugün bitiyor' : `${row.days} gün kaldı`}
                    </span>
                  </div>
                </div>
              ))}
              {policyExpiryAlerts.length > 16 && (
                <p className="text-[11px] text-slate-500 px-1">+{policyExpiryAlerts.length - 16} kayıt daha. İç Filo künyesinden bakın.</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPolicyExpiryAlertOpen(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold"
            >
              Tamam
            </button>
          </div>
        </div>
      )}

      {seesInspectionOverdueAlert && !seesPolicyExpiryAlert && overdueInspectionAlertOpen && overdueInspections.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-rose-200">
            <div className="flex items-start gap-3 pb-3 border-b border-rose-100">
              <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-black text-rose-950 text-base">Muayene 1 ay içinde / geçmiş</h3>
                <p className="text-xs text-rose-800 mt-0.5">{overdueInspections.length} plaka · 30 gün kala veya tarihi geçmiş</p>
              </div>
            </div>
            <div className="mt-3 max-h-64 overflow-y-auto space-y-1.5">
              {overdueInspections.slice(0, 12).map(v => (
                <div key={String(v.id || v.plate_number)} className="flex justify-between gap-3 text-xs bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-rose-950 block">{v.plate_number}</span>
                    <span className="text-rose-700">Sürücü: {v.driver_name || 'Atanmadı'}</span>
                  </div>
                  <span className="font-black text-rose-800 whitespace-nowrap">{formatDateTR(v.next_inspection_date)}</span>
                </div>
              ))}
              {overdueInspections.length > 12 && (
                <p className="text-[11px] text-slate-500 px-1">+{overdueInspections.length - 12} araç daha. İç Filo’dan bakın.</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOverdueInspectionAlertOpen(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold"
            >
              Tamam
            </button>
          </div>
        </div>
      )}

      {/* ANA İÇERİK ALANI */}
      <main className={`max-w-7xl mx-auto px-4 py-6 flex-1 w-full ${navPending ? 'portal-nav-pending' : ''}`}>
        {isSaha && !PORTAL_MODULES.some(m => canViewMod(m.id)) && (
          <div className="bg-white rounded-2xl border border-amber-200 p-6 text-sm text-amber-950">
            Bu hesaba açık menü yok. Yönetici Kullanıcılar ekranında şablon seçip <b>Kaydet / uygula</b> basmalı.
          </div>
        )}
{/* 1. GENEL GÖRÜNÜM (DOKUNULMAYAN KİLİTLİ BLOK) */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-rose-200/60 gap-3">
                <div className="flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-rose-600 animate-bounce" />
                  <h3 className="font-bold text-rose-950 text-sm">Finansal Hatırlatma & Kritik Uyarılar</h3>
                </div>
                {canEnterOverviewOutflow && (
                  <button
                    type="button"
                    onClick={() => setIsOutflowPickerOpen(true)}
                    className="shrink-0 bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" /> Gider / avans gir
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div 
                  onClick={() => { setSalesSearchQuery(''); setSalesStatusFilter('all'); setActiveTab('sales_customers'); }}
                  className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-xs cursor-pointer hover:bg-amber-50/50 transition">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5">
                      <PhoneCall className="w-4 h-4 text-amber-600" /> Geciken Müşteri Satışları
                    </span>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {alertAnalysis.overdueSales.length} Fatura
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between items-baseline">
                    <span className="text-[11px] text-slate-500">Müşteriyi arayınız</span>
                    <span className="text-base font-bold text-amber-700">
                      {alertAnalysis.overdueSales.reduce((s, i) => s + cleanNumber(i.total_amount), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                    </span>
                  </div>
                </div>

                <div 
                  onClick={() => { setExpenseStatusFilter('unpaid'); setActiveTab('general_expenses'); }}
                  className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-xs cursor-pointer hover:bg-rose-50/50 transition">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-rose-900 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-600" /> Yaklaşan tedarik borçları
                    </span>
                    <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {alertAnalysis.pendingDebts.length} kayıt
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Vadesi geçmiş veya 3 gün içinde (hakediş değil)</p>
                  <div className="mt-1 flex justify-between items-baseline">
                    <span className="text-[11px] text-slate-500">Genel giderlere git</span>
                    <span className="text-base font-bold text-rose-700">
                      {alertAnalysis.pendingDebts.reduce((s, i) => s + cleanNumber(i.alertAmount ?? i.total_amount), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                    </span>
                  </div>
                  {alertAnalysis.pendingDebts.length > 0 && (
                    <ul className="mt-2 space-y-1 border-t border-rose-100 pt-2">
                      {alertAnalysis.pendingDebts.slice(0, 4).map((d: any) => (
                        <li key={d.id || d.invoice_no} className="flex justify-between gap-2 text-[11px]">
                          <span className="text-slate-700 truncate">
                            {(d.invoice_no || 'Gider').replace(/^\[KK\]\s*/i, '')}
                          </span>
                          <span className="shrink-0 font-semibold text-rose-800">
                            {d.diffDays < 0 ? 'geçti' : d.diffDays === 0 ? 'bugün' : `${d.diffDays} gün`}
                            {' · '}
                            {cleanNumber(d.alertAmount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div 
                  onClick={() => setActiveTab('credit_cards')}
                  className="bg-white p-3.5 rounded-xl border border-purple-200 shadow-xs cursor-pointer hover:bg-purple-50/50 transition">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-purple-900 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-purple-600" /> Yaklaşan Kredi Kartı Ödemesi
                    </span>
                    <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {alertAnalysis.creditCardsAlerts.length} Kart
                    </span>
                  </div>
                  <div className="mt-2 flex flex-col">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[11px] text-slate-500">Vadesi yaklaşan kartlar</span>
                      <span className="text-base font-bold text-purple-700">
                        {alertAnalysis.creditCardsAlerts.reduce((s, i) => s + cleanNumber(i.cleanStmtAmt || i.statement_amount || 0), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                      </span>
                    </div>
                    {alertAnalysis.creditCardsAlerts.some((i: any) => cleanNumber(i.min_payment_amount) > 0) && (
                      <div className="flex justify-between items-baseline mt-0.5">
                        <span className="text-[10px] text-slate-400">Toplam Asgari Ödeme:</span>
                        <span className="text-[11px] font-bold text-amber-600">
                          {alertAnalysis.creditCardsAlerts.reduce((s, i) => s + cleanNumber(i.min_payment_amount || 0), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                        </span>
                      </div>
                    )}
                </div>
              </div>
            </div>

              {plateRenewalAlerts.length > 0 && (
    <button
                  type="button"
                  onClick={() => setActiveTab('plate_rentals')}
                  className="w-full flex items-center gap-3 px-3.5 py-2 bg-white rounded-xl border border-rose-200 text-left hover:bg-rose-50/60 transition"
                >
                  <Tag className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="text-xs font-bold text-rose-950 shrink-0">Plaka yenileme</span>
                  <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                    {plateRenewalAlerts.length} araç
                  </span>
                  <span className="text-[11px] text-rose-800 truncate flex-1">
                    {plateRenewalAlerts.slice(0, 3).map((r: any) => {
                      const when = r.days === 0 ? 'bugün' : (r.days < 0 ? `${Math.abs(r.days)}g geçti` : `${r.days}g`);
                      return `${r.plate} (${when})`;
                    }).join(' · ')}
                    {plateRenewalAlerts.length > 3 ? ` · +${plateRenewalAlerts.length - 3}` : ''}
                  </span>
                  <span className="text-[11px] font-semibold text-rose-600 shrink-0 hidden sm:inline">Belge plakalarına git →</span>
    </button>
              )}
        </div>

            <p className="text-[11px] text-slate-400">
              Dönem üst çubuktan: {filterStartDate && filterEndDate ? `${formatDateTR(filterStartDate)} — ${formatDateTR(filterEndDate)}` : 'tüm dönem'}. Tahsilat ve Girdi−Çıktı bu aralığa göre. Kasa bakiyesi ve bekleyen alacak bugünkü gerçek rakamdır.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
              <button type="button" onClick={() => setActiveTab('collections')} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-emerald-300 hover:shadow-md transition cursor-pointer h-full">
                <span className="text-[11px] text-emerald-600 font-semibold tracking-wider uppercase flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5" /> Alınan tahsilatlar
                </span>
                <div className="text-xl font-bold text-emerald-600 mt-1.5 tabular-nums">
                  +{periodCustomerReceipts.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
        </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {filterStartDate && filterEndDate ? `${formatDateTR(filterStartDate)} — ${formatDateTR(filterEndDate)}` : 'tüm dönem'} · müşteri tahsilatı
                </span>
              </button>

              <button type="button" onClick={() => setActiveTab('customers')} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-blue-300 hover:shadow-md transition cursor-pointer h-full">
                <span className="text-[11px] text-blue-600 font-semibold tracking-wider uppercase flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Bekleyen alacak
                </span>
                <div className="text-xl font-bold text-slate-900 mt-1.5 tabular-nums">
                  {pendingReceivablesAllTime.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Müşteri {bekleyenMusteriAlacaklari.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + hal {Math.max(0, halCariKalanAll).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
          </button>

              <div className="bg-[#009fe3] text-white p-4 rounded-2xl shadow-sm relative overflow-hidden h-full">
                <div className="flex justify-between items-start gap-2">
          <button  
                    type="button"
            onClick={() => {
                      setCashLedgerFrom(cashStartDate);
                      setCashLedgerTo(new Date().toISOString().split('T')[0]);
                      setIsCashLedgerOpen(true);
                    }}
                    className="flex-1 text-left hover:opacity-90 transition min-w-0"
                    title="Kasa hareketleri"
                  >
                    <span className="text-[11px] text-blue-100 font-semibold tracking-wider uppercase flex items-center gap-1">
                      <span className="text-sm font-black leading-none">₺</span> Güncel kasa
                    </span>
                    <div className="text-xl font-bold mt-1.5 tabular-nums">
                      {currentRealCash.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                    </div>
                    <span className="text-[10px] text-blue-100/90 mt-1 block truncate">
                      {formatDateTR(cashStartDate)} açılış {cashBookOpening.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · +{cashInflow.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / −{cashOutflow.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
          </button>
                  {isAdmin && (
                    <div className="flex gap-1 shrink-0">
          <button  
                      onClick={async (e) => {
                        e.stopPropagation();
                        const shown = roundMoney(cashBookOpening);
                        const raw = window.prompt(
                          `${formatDateTR(cashStartDate)} açılış kasası (şu an kayıtlı)\nSonraki giriş/çıkış bu rakamın üstüne eklenir.`,
                          String(shown)
                        );
                        if (raw === null) return;
                        const next = cleanNumber(raw);
                        if (!Number.isFinite(next)) {
                          alert('Geçerli bir tutar yazın.');
                          return;
                        }
                        const asOf = cashStartDate;
                        try {
                          await saveAppSetting('cash_opening', String(next));
                          await saveAppSetting('cash_opening_as_of', asOf);
                          setCashOpening(next);
                          setCashOpeningAsOf(asOf);
                        } catch (err: any) {
                          alert('Kasa kaydedilemedi. setup_cash.sql dosyasını SQL Editor’da bir kez Run deyin.\n' + (err.message || ''));
                        }
                      }}
                      className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-[10px] font-bold transition">
                      Açılış
          </button>
          <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const raw = window.prompt(
                          `BUGÜN bankada gerçekte kaç TL var?\nBüyük mavi rakam buna gelir. 7 Ekim sonrası hareketler durur.`,
                          '1215000'
                        );
                        if (raw === null) return;
                        const target = cleanNumber(raw);
                        if (target <= 0) {
                          alert('Bugünkü kasa sıfır veya eksi olamaz.');
                          return;
                        }
                        const next = roundMoney(target - cashInflow + cashOutflow);
                        if (!window.confirm(
                          `Güncel kasa ${target.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ olacak.\n7 Ekim sabah açılışı ${next.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ yazılacak.\nOnaylıyor musun?`
                        )) return;
                        const asOf = cashStartDate;
                        try {
                          await saveAppSetting('cash_opening', String(next));
                          await saveAppSetting('cash_opening_as_of', asOf);
                          setCashOpening(next);
                          setCashOpeningAsOf(asOf);
                        } catch (err: any) {
                          alert('Kasa kaydedilemedi. setup_cash.sql dosyasını SQL Editor’da bir kez Run deyin.\n' + (err.message || ''));
                        }
                      }}
                      className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-[10px] font-bold transition">
                      Bugün
          </button>
          <button  
                      onClick={(e) => { e.stopPropagation(); setIsCashDepositModalOpen(true); }}
                      className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-[10px] font-bold transition flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Para Ekle
          </button>
      </div>
    )}
  </div>
</div>
              </div>

            {(() => {
              const isHalKasaOpen = (e: any) => /\[(AKTARIM-KASA|KASA-TAHSIL)\]/.test(String(e.notes || '')) || e.firm_name === 'Saha kasa açılışı';
              const isHalCariOnly = (e: any) => /\[(AKTARIM-CARI|DRIVE-GIRIS|MERKEZ-TAHSIL)\]/.test(String(e.notes || ''));
              const seferTutari = (dbHalEntries || []).reduce((s: number, e: any) => {
                if (e.kind !== 'sefer' || isHalKasaOpen(e)) return s;
                const bedel = cleanNumber(e.bedel);
                return s + (e.has_vat ? Math.round(bedel * 1.2 * 100) / 100 : bedel);
              }, 0);
              const nakitCari = (dbHalEntries || []).filter((e: any) => !isHalKasaOpen(e)).reduce((s: number, e: any) => s + cleanNumber(e.collected), 0);
              const nakitKasa = (dbHalEntries || []).filter((e: any) => !isHalCariOnly(e)).reduce((s: number, e: any) => s + cleanNumber(e.collected), 0);
              const teslim = (dbHalHandovers || []).reduce((s: number, h: any) => s + cleanNumber(h.amount), 0);
              const halCariKalan = Math.round((seferTutari - nakitCari) * 100) / 100;
              const personelKasa = Math.round((nakitKasa - teslim) * 100) / 100;
              return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('hal_saha')}
                className="bg-white px-4 py-3.5 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-rose-200 hover:shadow-md transition"
              >
                <span className="text-[11px] text-rose-700 font-semibold tracking-wider uppercase flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> Hal cari kalan
                </span>
                <div className="text-xl font-black text-rose-800 mt-1 tabular-nums">
                  {halCariKalan.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Anlık hal alacağı · sefer − tahsilat</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('hal_saha')}
                className="bg-amber-50 px-4 py-3.5 rounded-2xl border border-amber-100 shadow-sm text-left hover:border-amber-300 hover:shadow-md transition"
              >
                <span className="text-[11px] text-amber-900 font-semibold tracking-wider uppercase flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5" /> Personel kasa
                </span>
                <div className="text-xl font-black text-amber-950 mt-1 tabular-nums">
                  {personelKasa.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
              </div>
                <span className="text-[11px] text-amber-800/70 mt-0.5 block">Saha üzerindeki nakit · merkeze henüz alınmadı</span>
              </button>
            </div>
              );
            })()}

            {(() => {
              const girdi = Math.max(0, totalCollectedCash);
              const cikti = Math.max(0, totalPeriodPaidExpenses);
              const total = girdi + cikti;
              const girdiPct = total > 0 ? (girdi / total) * 100 : 50;
              const ciktiPct = total > 0 ? (cikti / total) * 100 : 50;
              return (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 overflow-hidden">
              <div className="px-5 pt-4 pb-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold tracking-widest uppercase text-slate-400">Seçilen dönemde nakit akışı</p>
                  <p className="text-sm font-semibold text-slate-700 mt-0.5">{filterStartDate && filterEndDate ? `${formatDateTR(filterStartDate)} — ${formatDateTR(filterEndDate)}` : 'Tüm dönem'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold tracking-widest uppercase text-slate-400">Net</p>
                  <p className={`text-2xl font-black tabular-nums ${periodProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {periodProfit >= 0 ? '+' : ''}{periodProfit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </p>
                </div>
              </div>
              <div className="px-5">
                <div className="h-3 rounded-full overflow-hidden flex bg-slate-200">
                  <div className="h-full bg-emerald-500" style={{ width: `${girdiPct}%` }} />
                  <div className="h-full bg-rose-400" style={{ width: `${ciktiPct}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-slate-200">
                <div className="p-5">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <ArrowDownLeft className="w-4 h-4" />
                </span>
                    <span className="text-xs font-bold uppercase tracking-wider">Girdi</span>
              </div>
                  <p className="mt-2 text-xl font-black text-emerald-800 tabular-nums">
                    {girdi.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Kasaya giren tahsilat / para ekle</p>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 text-rose-700">
                    <span className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                      <ArrowUpRight className="w-4 h-4" />
                  </span>
                    <span className="text-xs font-bold uppercase tracking-wider">Çıktı</span>
                </div>
                  <p className="mt-2 text-xl font-black text-rose-800 tabular-nums">
                    {cikti.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Talimat, avans, maaş, gider, kart</p>
                </div>
              </div>
            </div>
              );
            })()}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <button type="button" onClick={() => { setSubStatusFilter('pending'); setSubSearchTerm(''); setActiveTab('subcontractors'); }} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-rose-300 hover:shadow-md transition cursor-pointer">
                <span className="text-xs font-semibold text-rose-700 tracking-wider uppercase flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Ödenecek borç · taşeron
                </span>
                <div className="text-xl font-bold text-rose-600 mt-1.5">
                  {contractorPayableNow.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Açık hakediş − avans · hakediş listesine git</span>
              </button>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-left">
                <span className="text-xs font-semibold text-amber-800 tracking-wider uppercase flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Ödenecek borç · diğer
                </span>
                <div className="text-xl font-bold text-amber-800 mt-1.5">
                  {payableOtherDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Devlet + tedarik + personel (sağdaki kutular)
                </span>
              </div>
              <button type="button" onClick={() => { setExpenseStatusFilter('unpaid'); setActiveTab('general_expenses'); }} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-rose-300 hover:shadow-md transition cursor-pointer">
                <span className="text-xs font-semibold text-rose-700 tracking-wider uppercase flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> Devlet Ödemeleri
                </span>
                <div className="text-xl font-bold text-slate-900 mt-1.5">
                  {totalGovernmentPaymentsDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Giderler menüsüne git</span>
              </button>

              <button type="button" onClick={() => { setExpenseStatusFilter('unpaid'); setActiveTab('general_expenses'); }} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-amber-300 hover:shadow-md transition cursor-pointer">
                <span className="text-xs font-semibold text-amber-700 tracking-wider uppercase flex items-center gap-1">
                  <Receipt className="w-3.5 h-3.5" /> Temel Diğer Faturalar
                </span>
                <div className="text-xl font-bold text-slate-900 mt-1.5">
                  {totalGeneralCompanyExpensesDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Açık tedarik borçları</span>
              </button>

              <button type="button" onClick={() => setActiveTab('employees')} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-indigo-300 hover:shadow-md transition cursor-pointer">
                <span className="text-xs font-semibold text-indigo-700 tracking-wider uppercase flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" /> Personel Gelecek Ödemesi
                </span>
                <div className="text-xl font-bold text-slate-900 mt-1.5">
                  {totalEmployeeFutureDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Personel & bordroya git</span>
              </button>

              <button type="button" onClick={() => { setExpenseStatusFilter('paid'); setActiveTab('general_expenses'); }} className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm bg-emerald-50/20 text-left hover:border-emerald-400 hover:shadow-md transition cursor-pointer">
                <span className="text-xs font-semibold text-emerald-800 tracking-wider flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5" /> DÖNEM İÇİ FİİLİ MASRAF
                </span>
                <div className="text-xl font-bold text-emerald-800 mt-1.5">
                  {totalPeriodPaidExpenses.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </div>
                <span className="text-[11px] text-emerald-600 mt-1 block">
                  Seçilen ayda kasadan çıkan · ay neti {(totalCollectedCash - totalPeriodPaidExpenses).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-rose-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Yaklaşan Kritik Taşeron Ödemeleri</h3>
                  </div>
                  <button 
                    onClick={() => setActiveTab('subcontractors')}
                    className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-1">
                    Tümünü Gör <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2">
                  {[...allDecoratedBankLines]
                    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
                    .filter(l => l.netAmount > 0)
                    .slice(0, 5)
                    .map((line) => (
                      <div key={line.lineId} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs shadow-xs">
                        <div>
                          <span className="font-bold text-slate-900 block truncate max-w-[200px]" title={line.invoiceNo}>
                            {line.invoiceNo}
                          </span>
                          <span className={`text-[11px] font-semibold mt-0.5 block ${line.dueDate && new Date(sanitizeDate(line.dueDate)) < new Date() ? 'text-rose-600' : 'text-slate-500'}`}>
                            {line.termLabel}: {formatDateTR(line.dueDate)}
                          </span>
                        </div>
                        <span className="font-bold text-rose-600 text-sm">
                          {line.netAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-amber-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Muayenesi Yaklaşan Araçlar</h3>
                  </div>
                  <button 
                    onClick={() => setActiveTab('fleet')}
                    className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-1">
                    Filoya Git <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2">
                  {dbVehicles
                    .filter(v => v.next_inspection_date)
                    .sort((a, b) => new Date(a.next_inspection_date).getTime() - new Date(b.next_inspection_date).getTime())
                    .slice(0, 5)
                    .map((veh, idx) => {
                      const d = sanitizeDate(veh.next_inspection_date);
                      const overdue = !!d && d < todayIso;
                      return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl flex justify-between items-center text-xs border ${
                          overdue
                            ? 'bg-rose-100 border-rose-400 ring-1 ring-rose-300'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div>
                          <span className={`font-mono font-bold block ${overdue ? 'text-rose-950' : 'text-blue-700'}`}>{veh.plate_number}</span>
                          <span className={`text-[11px] ${overdue ? 'text-rose-800' : 'text-slate-500'}`}>Sürücü: {veh.driver_name || 'Atanmadı'}</span>
                        </div>
                        <div className="text-right">
                          <span className={`font-bold px-2 py-0.5 rounded text-[11px] block ${overdue ? 'bg-rose-600 text-white' : 'bg-amber-100 text-amber-800'}`}>
                            {formatDateTR(veh.next_inspection_date)}
                          </span>
                          <span className={`text-[10px] mt-0.5 block ${overdue ? 'text-rose-700 font-semibold' : 'text-slate-400'}`}>
                            {overdue ? 'Süresi geçti' : 'Muayene Tarihi'}
                          </span>
                        </div>
                      </div>
                    );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'customers' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Müşteri Kartları</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Fatura alacak, tahsilat düşer. Cari kalan = fatura − tahsilat. Gelen her para tahsilattır. Ana ekran bekleyen = bu toplam + hal.
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => openCustomerModal()}
                  className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Yeni Müşteri
                </button>
              )}
            </div>
            <PortalInput
              type="text"
              commit="live"
              placeholder="Unvan, VKN veya telefon ara..."
              value={customerSearchTerm}
              onChange={e => setCustomerSearchTerm(e.target.value)}
              className="w-full sm:w-80 px-3.5 py-2 border border-slate-200 rounded-xl text-xs"
            />
            {dbCustomers.length === 0 ? (
              <p className="text-sm text-slate-500 bg-amber-50 border border-amber-100 rounded-xl p-4">
                Henüz müşteri yok. Önce Supabase SQL Editor’da <b>setup_customers.sql</b> dosyasını çalıştırın, sonra buradan kart ekleyin.
              </p>
            ) : (
              <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <span className="text-[11px] text-amber-800 font-semibold block">Dönem fatura ({customerMoneyMonthLabel || 'tüm dönem'})</span>
                  <span className="text-lg font-bold text-slate-900">{customerBalances.reduce((s, r) => s + r.billedPeriod, 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  <span className="text-[11px] text-emerald-800 font-semibold block">Dönem tahsilat ({customerMoneyMonthLabel})</span>
                  <span className="text-lg font-bold text-emerald-800">{periodCustomerReceipts.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[11px] text-slate-600 font-semibold block">Cari kalan (müşteri + hal)</span>
                  <span className={`text-lg font-bold ${pendingReceivablesAllTime >= 0 ? 'text-amber-800' : 'text-rose-700'}`}>
                    {pendingReceivablesAllTime.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Müşteri {bekleyenMusteriAlacaklari.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · hal {Math.max(0, halCariKalanAll).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-100">
                      <th className="py-2 pr-3">Unvan</th>
                      <th className="py-2 pr-3 text-right">Dönem fatura</th>
                      <th className="py-2 pr-3 text-right">Tahsilat {customerMoneyMonthLabel}</th>
                      <th className="py-2 pr-3 text-right">Cari kalan</th>
                      <th className="py-2 pr-3">Durum</th>
                      <th className="py-2 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerBalances
                      .filter(row => {
                        const q = customerSearchTerm.trim().toLocaleLowerCase('tr-TR');
                        if (!q) return true;
                        const c = row.customer;
                        return [c.name, c.tax_id, c.phone, c.email].join(' ').toLocaleLowerCase('tr-TR').includes(q);
                      })
                      .map(row => {
                        const c = row.customer;
                        const durum = row.net > 0.5 ? 'Alacak' : row.net < -0.5 ? 'Fazla dekont' : 'Kapalı';
                        return (
                        <tr key={c.id} className="border-b border-slate-50">
                          <td className="py-2.5 pr-3">
                            <button
                              type="button"
                              onClick={() => setSelectedCariCustomer(c)}
                              className="font-semibold text-[#009fe3] hover:underline text-left"
                              title="Cari dökümü aç"
                            >
                              {c.name}
                            </button>
                            <div className="text-[10px] text-slate-400">{c.tax_id || 'VKN yok'}{c.phone ? ` · ${c.phone}` : ''}</div>
                          </td>
                          <td className="py-2.5 pr-3 text-right font-semibold">{row.billedPeriod.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</td>
                          <td className="py-2.5 pr-3 text-right text-emerald-800">{(row.advancesPeriod + row.collectionsPeriod).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</td>
                          <td className={`py-2.5 pr-3 text-right font-black ${row.net > 0.5 ? 'text-amber-800' : row.net < -0.5 ? 'text-rose-700' : 'text-slate-500'}`}>
                            {row.net.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${durum === 'Alacak' ? 'bg-amber-100 text-amber-800' : durum === 'Kapalı' ? 'bg-slate-100 text-slate-600' : 'bg-rose-100 text-rose-700'}`}>
                              {durum}
                            </span>
                          </td>
                          <td className="py-2.5 text-center space-x-1 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setSelectedCariCustomer(c)}
                                className="text-[10px] font-bold text-slate-800 hover:underline"
                              >
                                Cari döküm
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSalesSearchQuery(c.name);
                                  setActiveTab('sales_customers');
                                }}
                                className="text-[10px] font-bold text-[#009fe3] hover:underline"
                              >
                                Faturalar
                              </button>
                              {isAdmin && (
                                <>
                              <button type="button" onClick={() => openCustomerModal(c)} className="p-1.5 text-slate-500 hover:text-blue-600"><Edit2 className="w-4 h-4 inline" /></button>
                              <button type="button" onClick={() => handleDeleteCustomer(c)} className="p-1.5 text-slate-500 hover:text-rose-600"><Trash2 className="w-4 h-4 inline" /></button>
                                </>
                              )}
                            </td>
                        </tr>
                        );
                      })}
                    <tr className="border-t-2 border-rose-100 bg-rose-50/60">
                      <td className="py-2.5 pr-3">
                        <div className="font-semibold text-rose-900">Hal alacakları</div>
                        <div className="text-[10px] text-rose-700/70">Saha carisi · sefer − tahsilat</div>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-semibold">{halCariPeriod.sefer.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</td>
                      <td className="py-2.5 pr-3 text-right text-emerald-800">{halCariPeriod.tahsilat.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</td>
                      <td className="py-2.5 pr-3 text-right font-black text-rose-800">
                        {Math.max(0, halCariKalanAll).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">Hal</span>
                      </td>
                      <td className="py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => setActiveTab('hal_saha')}
                          className="text-[10px] font-bold text-rose-800 hover:underline"
                        >
                          Hal saha
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        )}
        
        {activeTab === 'dis_alim' && canViewMod('dis_alim') && (
          <div className="space-y-3">
            <div>
              <h3 className="font-bold text-lg text-slate-900">Dış Alım Mutabakatı</h3>
              <p className="text-xs text-slate-500 mt-0.5">Dış alım %10 · yansıtma %5. Birebir faturalar ilgili cariye; nakliye payı onay sonrası normal Migros’a. Dış Alım carisine yüzde yazılmaz.</p>
            </div>
            <DisAlimPage
              rows={dbDisAlimLines}
              canEdit={canEditMod('dis_alim')}
              cleanNumber={cleanNumber}
              formatDateTR={formatDateTR}
              onReload={loadPortalData}
            />
          </div>
        )}

        {activeTab === 'sales_customers' && (
        <div className="space-y-4">
          
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-white/10">
              <div>
                <span className="bg-blue-500/30 text-blue-200 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Cari Havuz</span>
                <h4 className="text-lg font-black tracking-tight mt-0.5">{dbCustomers.length} kayıtlı müşteri</h4>
                <p className="text-blue-100 text-[11px] mt-1">Excel yüklemeden önce Müşteri Kartları menüsünden unvanları tanıtın.</p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setNewReceiptFormData({
                      customerName: dbCustomers[0]?.name || '',
                      receiptNo: '',
                      amount: '',
                      targetAccount: 'bank',
                      date: new Date().toISOString().split('T')[0],
                      kind: 'collection',
                      relatedInvoiceId: null
                    });
                    setIsNewReceiptModalOpen(true);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md transition">
                  <Plus className="w-4 h-4" /> Tahsilat ekle
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
                <span className="text-blue-200 text-[11px] block">Kayıtlı satış (cari)</span>
                <span className="text-lg font-bold block mt-0.5">{customerBilledAllTime.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                <span className="text-blue-200/70 text-[10px] block mt-1">Müşteri kartlarındaki fatura toplamı. Tahsilat hem kasayı hem cari kalanı değiştirir.</span>
              </div>
              <div className="bg-emerald-500/20 backdrop-blur-xs p-3 rounded-xl border border-emerald-400/20">
                <span className="text-emerald-200 text-[11px] block">Müşteri tahsilatı (cari)</span>
                <span className="text-lg font-bold text-emerald-300 block mt-0.5">+{customerReceiptsAllTime.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                <span className="text-emerald-100/80 text-[10px] block mt-1">Müşteriden gelen para. Kasaya para ekle / Hal aktarım yok.</span>
              </div>
              <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
                <span className="text-amber-200 text-[11px] block">Net cari alacak</span>
                <span className="text-lg font-black text-amber-300 block mt-0.5">{bekleyenMusteriAlacaklari.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                <span className="text-amber-100/70 text-[10px] block mt-1">Müşteri kartları cari kalan ile aynı. Hal ayrı.</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Müşteri Satış & Cari Takip</h3>
                <p className="text-xs text-slate-500 mt-0.5">Müşteri unvanı, fatura tarihi ve tek tıkla tahsilat kapama.</p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                    <FileUp className="w-4 h-4" /> Satış Faturası Exceli Yükle (Toplu)
                    <input type="file" accept=".xlsx,.xls" onChange={handleImportSalesInvoicesExcel} className="hidden" />
                  </label>
                  <button 
                    onClick={() => setIsNewSaleModalOpen(true)}
                    className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                    <Plus className="w-4 h-4" /> Manuel Satış Ekle
                  </button>
                </div>
              )}
            </div>
           <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="relative flex-1 sm:w-80">
                <PortalInput
                  type="text"
                  commit="live"
                  placeholder="Müşteri adı veya fatura no ile filtrele..."
                  value={salesSearchQuery}
                  onChange={e => setSalesSearchQuery(e.target.value)}
                  className="w-full px-3.5 py-2 pl-9 pr-8 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white outline-none"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                {salesSearchQuery.trim() ? (
                  <button
                    type="button"
                    onClick={() => setSalesSearchQuery('')}
                    className="absolute right-2 top-1.5 p-1 text-slate-400 hover:text-slate-700"
                    title="Filtreyi temizle"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : null}
              </div>

              <select
                value={salesStatusFilter}
                onChange={e => setSalesStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white font-semibold text-slate-700 outline-none">
                <option value="all">Tüm Faturalar</option>
                <option value="unpaid">⏳ Sadece Açık (Tahsil Edilecekler)</option>
                <option value="paid">✅ Sadece Tahsil Edilenler</option>
              </select>
            </div>
        {(() => {
          const uncollected = displayedSalesList.filter((i: any) => i.status !== 'paid');
          const totalUncollectedAmt = uncollected.reduce((acc: number, cur: any) => acc + cleanNumber(cur.total_amount), 0);
          return (
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold shadow-md">
                  ₺
                </div>
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                    Listelenen açık fatura
                  </span>
                  <span className="text-2xl font-black text-slate-900 tracking-tight">
                    {totalUncollectedAmt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Tahsil edilmemiş faturalar. Cari kalan = fatura − tahsilat (üstteki net kutu).
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="bg-white/90 border border-emerald-200 text-emerald-800 font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-xs">
                  {uncollected.length} Açık fatura
                </span>
                <span className="bg-slate-100 text-slate-600 font-semibold text-xs px-3 py-1.5 rounded-xl">
                  Listede: {displayedSalesList.length}
                </span>
              </div>
            </div>
          );
        })()}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th onClick={() => handleSalesSort('customerName')} className="py-3 px-3 cursor-pointer hover:text-blue-600 select-none">
                  Müşteri / Firma Adı ⇕
                </th>
                <th onClick={() => handleSalesSort('cleanInvoiceNo')} className="py-3 px-3 cursor-pointer hover:text-blue-600 select-none">
                  Fatura Numarası ⇕
                </th>
                <th onClick={() => handleSalesSort('description')} className="py-3 px-3 cursor-pointer hover:text-blue-600 select-none">
                  Açıklama ⇕
                </th>
                <th onClick={() => handleSalesSort('issue_date')} className="py-3 px-3 cursor-pointer hover:text-blue-600 select-none">
                  Fatura Tarihi ⇕
                </th>
                <th onClick={() => handleSalesSort('due_date')} className="py-3 px-3 cursor-pointer hover:text-blue-600 select-none">
                  Vade Tarihi ⇕
                </th>
                <th onClick={() => handleSalesSort('total_amount')} className="py-3 px-3 text-right cursor-pointer hover:text-blue-600 select-none">
                  Toplam Satış Tutarı ⇕
                </th>
                <th onClick={() => handleSalesSort('status')} className="py-3 px-3 text-center cursor-pointer hover:text-blue-600 select-none">
                  Durum / İşlem ⇕
                </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedSalesList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 px-3 text-center text-slate-400">
                        Bu arama / durumda fatura yok. Kutuyu “Tüm Faturalar” yapın veya aramayı silin.
                      </td>
                    </tr>
                  )}
                  {displayedSalesList.map((sale, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 font-bold text-sm">
                        <button
                          type="button"
                          onClick={() => openCariByName(sale.customerName)}
                          className="text-[#009fe3] hover:underline text-left"
                          title="Cari dökümü aç"
                        >
                          {sale.customerName}
                        </button>
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-blue-700">{sale.cleanInvoiceNo}</td>
                      <td className="py-3 px-3 text-slate-500 max-w-[220px] truncate" title={String(sale.description || '')}>{sale.description || '—'}</td>
                      <td className="py-3 px-3 text-slate-600">{formatDateTR(sale.issue_date)}</td>
                      <td className="py-3 px-3 text-slate-600">{formatDateTR(sale.due_date)}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 text-sm">
                        {cleanNumber(sale.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                      </td>
                      <td className="py-3 px-3 text-center">
                        {sale.status === 'paid' ? (
                          <div className="flex flex-col items-center gap-1">
                          <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-full">
                              Tahsil edildi
                          </span>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleSetSalePaidStatus(sale, 'unpaid')}
                                className="text-[10px] font-bold text-slate-500 hover:text-slate-800 underline"
                              >
                                Açığa al
                              </button>
                            )}
                          </div>
                        ) : (
                          isAdmin && (
                            <div className="flex flex-col items-center gap-1">
                            <button 
                                type="button"
                              onClick={() => handleOpenReceiptFromSale(sale)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition"
                              >
                                <Coins className="w-3.5 h-3.5" /> Tahsil et
                            </button>
                            </div>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )}

        {/* 3. ALT YÜKLENİCİ HAKEDİŞLERİ */}
        {activeTab === 'subcontractors' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Hakediş Faturaları</h3>
                <p className="text-xs text-slate-500 mt-0.5">Güncel açık borçlar. Ana ekrandaki ay seçimi bu listeyi daraltmaz. Avans mahsubu verildiği aydaki faturaya yazılır; kalan avans caridedir. Ödeme Banka Talimatı’ndan.</p>
              </div>
              {isAdmin && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className={`cursor-pointer ${isExcelUploading ? 'bg-slate-500 pointer-events-none opacity-80' : 'bg-slate-800 hover:bg-slate-900'} text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition`}>
              <FileUp className={`w-4 h-4 ${isExcelUploading ? 'animate-bounce' : ''}`} />
              <span>{isExcelUploading ? 'Faturalar Güncelleniyor, Lütfen Bekleyin...' : 'Taşeron Fatura Exceli Yükle'}</span>
              <input type="file" accept=".xlsx, .xls" disabled={isExcelUploading} onChange={handleImportSubcontractorInvoicesSafe} className="hidden" />
            </label>
                  <button 
                    onClick={() => setIsManualSubInvoiceModalOpen(true)}
                    className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                    <Plus className="w-4 h-4" /> Manuel Hakediş Ekle
                  </button>
                </div>
              )}
            </div>
{/* ARAMA VE FİLTRELEME ÇUBUĞU */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mb-4">
          <div className="relative w-full sm:w-80">
            <PortalInput
              type="text"
              placeholder="Taşeron adı veya fatura no ile filtrele..."
              value={subSearchTerm}
              onChange={(e) => setSubSearchTerm(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="w-full sm:w-auto">
            <select
              value={subStatusFilter}
              onChange={(e: any) => setSubStatusFilter(e.target.value)}
              className="w-full sm:w-48 text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Tüm Faturalar</option>
              <option value="pending">Ödenmemiş / Bekleyenler</option>
              <option value="paid">Tamamı Ödenenler</option>
            </select>
          </div>
        </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
              <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-rose-700">Güncel ödenecek</div>
                <div className="mt-1 text-lg font-black text-rose-800">
                  {contractorPayableNow.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </div>
                <div className="text-[10px] text-rose-600/80 mt-0.5">Açık vade − avans (ana ekranla aynı)</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Listelenen fatura</div>
                <div className="mt-1 text-lg font-black text-slate-900">
                  {visibleHakedisRows.totals.total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </div>
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-blue-700">1 nci ödeme (açık)</div>
                <div className="mt-1 text-lg font-black text-blue-800">
                  {visibleHakedisRows.totals.term1.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </div>
              </div>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-indigo-700">2 nci ödeme (açık)</div>
                <div className="mt-1 text-lg font-black text-indigo-800">
                  {visibleHakedisRows.totals.term2.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </div>
          </div>
        </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                   <th 
                className="py-3 px-3 cursor-pointer select-none hover:text-blue-600 transition-colors"
                onClick={() => {
                  if (subSortField === 'invoice_no') {
                    setSubSortOrder(subSortOrder === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSubSortField('invoice_no');
                    setSubSortOrder('asc');
                  }
                }}
              >
                Fatura No / Taşeron {subSortField === 'invoice_no' ? (subSortOrder === 'asc' ? '↑' : '↓') : '↕'}
              </th>
              <th 
                className="py-3 px-3 cursor-pointer select-none hover:text-blue-600 transition-colors"
                onClick={() => {
                  if (subSortField === 'issue_date') {
                    setSubSortOrder(subSortOrder === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSubSortField('issue_date');
                    setSubSortOrder('desc');
                  }
                }}
              >
                Tarih {subSortField === 'issue_date' ? (subSortOrder === 'asc' ? '↑' : '↓') : '↕'}
              </th>
              <th 
                className="py-3 px-3 cursor-pointer select-none hover:text-blue-600 transition-colors"
                onClick={() => {
                  if (subSortField === 'total_amount') {
                    setSubSortOrder(subSortOrder === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSubSortField('total_amount');
                    setSubSortOrder('desc');
                  }
                }}
              >
                Toplam Tutar {subSortField === 'total_amount' ? (subSortOrder === 'asc' ? '↑' : '↓') : '↕'}
              </th>
                    <th className="py-3 px-3">1 nci ödeme</th>
                    <th className="py-3 px-3">2 nci ödeme</th>
                    {isAdmin && <th className="py-3 px-3 text-center">İşlem</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!visibleHakedisRows.rows.length && (
                    <tr>
                      <td colSpan={isAdmin ? 6 : 5} className="py-10 text-center text-slate-400">
                        Bu süzgeçte hakediş faturası yok. Üstten “Tüm Faturalar”ı deneyin.
                      </td>
                    </tr>
                  )}
                  {visibleHakedisRows.rows.map(({ inv, isT1Paid, isT2Paid, dynamicT1, dynamicT2, deductedAdvAmt, deductedAdvForT2 }) => {
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-3 font-mono font-medium text-slate-800">{inv.invoice_no}</td>
                        <td className="py-3 px-3 text-slate-500">{formatDateTR(inv.issue_date)}</td>
                        <td className="py-3 px-3 font-bold text-slate-900">{cleanNumber(inv.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</td>
                        <td className="py-3 px-3">
                          <span className={`font-semibold block ${isT1Paid ? 'text-emerald-600 line-through' : 'text-blue-700'}`}>
                  {dynamicT1.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </span>
                {deductedAdvAmt > 0 && (
                  <span className="block text-[10px] text-amber-600 font-normal">
                    (-{deductedAdvAmt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ Avans Mahsubu)
                  </span>
                )}
                          <span className="text-[10px] text-slate-400">{isT1Paid ? 'Ödendi' : formatDateTR(contractorTermPayDate(sanitizeDate(inv.issue_date), 'term1', inv.term1_due_date))}</span>
                        </td>
                      <td className="py-3 px-3">
            <span className={`font-semibold block ${isT2Paid ? 'text-emerald-600 line-through' : 'text-blue-700'}`}>
              {dynamicT2.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
            </span>
            {deductedAdvForT2 > 0 && (
              <span className="block text-[10px] text-amber-600 font-normal">
                (-{deductedAdvForT2.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ Avans Mahsubu)
              </span>
            )}
            <span className="text-[10px] text-slate-400">{isT2Paid ? 'Ödendi' : formatDateTR(contractorTermPayDate(sanitizeDate(inv.issue_date), 'term2', inv.term2_due_date))}</span>
          </td>
                        {isAdmin && (
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <button 
                                onClick={() => {
                                  setEditingSubInvoice(inv);
                                  setSubEditFormData({
          invoiceNo: inv.invoice_no || '',
          totalAmount: String(inv.total_amount || ''),
          issueDate: sanitizeDate(inv.issue_date),
          term1DueDate: sanitizeDate(inv.term1_due_date),
          term1Amount: String(inv.term1_amount || ''),
          term1Status: inv.term1_status || 'pending',
          term2DueDate: sanitizeDate(inv.term2_due_date),
          term2Amount: String(inv.term2_amount || ''),
          term2Status: inv.term2_status || 'pending',
          advanceAmount: '',
          advanceInstallmentCount: '1'
        } as any);
                                  setIsEditSubModalOpen(true);
                                }}
                                className="bg-slate-100 hover:bg-blue-50 text-blue-700 border border-slate-200 font-semibold px-2 py-1 rounded text-[11px] inline-flex items-center gap-1 transition">
                                <Edit2 className="w-3 h-3" /> Düzenle
                              </button>
                              <button 
                                onClick={async () => {
                                  if (window.confirm(`${inv.invoice_no} kaydını silmek istediğinize emin misiniz?`)) {
                                    await supabase.from('invoices').delete().eq('id', inv.id);
                                    loadPortalData();
                                  }
                                }}
                                className="bg-slate-100 hover:bg-rose-50 text-rose-700 border border-slate-200 font-semibold px-2 py-1 rounded text-[11px] inline-flex items-center gap-1 transition">
                                <Trash2 className="w-3 h-3" /> Sil
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
{/* ALT YÜKLENİCİ CARİ KARTLARI */}
        {activeTab === 'sub_accounts' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Alt Yüklenici Cari Kartları</h3>
                <p className="text-xs text-slate-500 mt-0.5">Liste kalan bakiyedir. Ödemeler kartın içinde. Avans için kartı açın veya Tanımlar’dan Avans verin.</p>
              </div>
            </div>

            {/* ARAMA VE FİLTRE ÇUBUĞU */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mb-2 mt-2">
              <div className="relative w-full sm:w-80">
                <PortalInput
                  type="text"
                  placeholder="Taşeron adı veya vergi no ile filtrele..."
                  value={ledgerSearchTerm}
                  onChange={(e) => setLedgerSearchTerm(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th 
                      className="py-3 px-3 cursor-pointer select-none hover:text-blue-600 transition-colors"
                      onClick={() => {
                        if (ledgerSortField === 'name') setLedgerSortOrder(ledgerSortOrder === 'asc' ? 'desc' : 'asc');
                        else { setLedgerSortField('name'); setLedgerSortOrder('asc'); }
                      }}>
                      Firma / Taşeron Adı {ledgerSortField === 'name' ? (ledgerSortOrder === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th 
                      className="py-3 px-3 cursor-pointer select-none hover:text-blue-600 transition-colors"
                      onClick={() => {
                        if (ledgerSortField === 'tax') setLedgerSortOrder(ledgerSortOrder === 'asc' ? 'desc' : 'asc');
                        else { setLedgerSortField('tax'); setLedgerSortOrder('asc'); }
                      }}>
                      Vergi Numarası {ledgerSortField === 'tax' ? (ledgerSortOrder === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="py-3 px-3">Kayıtlı IBAN</th>
                    <th 
                      className="py-3 px-3 text-right cursor-pointer select-none hover:text-blue-600 transition-colors"
                      onClick={() => {
                        if (ledgerSortField === 'balance') setLedgerSortOrder(ledgerSortOrder === 'asc' ? 'desc' : 'asc');
                        else { setLedgerSortField('balance'); setLedgerSortOrder('desc'); }
                      }}>
                      Kalan bakiye {ledgerSortField === 'balance' ? (ledgerSortOrder === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subcontractorCariRows
                    .filter((item: any) => {
                      if (!ledgerSearchTerm) return true;
                      const term = ledgerSearchTerm.toLowerCase();
                      return (item.name || '').toLowerCase().includes(term) || (item.computedTax || '').toLowerCase().includes(term);
                    })
                    .sort((a: any, b: any) => {
                      let comp = 0;
                      if (ledgerSortField === 'name') comp = (a.company_name || a.name || '').localeCompare(b.company_name || b.name || '', 'tr-TR', { sensitivity: 'base' });
                      else if (ledgerSortField === 'tax') {
                         const taxA = a.tax_no || a.computedTax || '';
                         const taxB = b.tax_no || b.computedTax || '';
                         comp = taxA.localeCompare(taxB, 'tr-TR');
                        }
                      else if (ledgerSortField === 'balance') comp = a.balance - b.balance;
                      return ledgerSortOrder === 'asc' ? comp : -comp;
                    })
                    .map((sub: any) => (
                      <tr key={sub.id} onClick={() => setSelectedSubcontractorForDetail(sub)} className="hover:bg-blue-50/50 cursor-pointer transition">
                        <td className="py-3 px-3 font-bold text-slate-900 text-sm">{sub.company_name || sub.name}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{sub.tax_no || sub.computedTax || '-'}</td>
                        <td className="py-3 px-3 font-mono text-blue-700">{sub.iban || 'IBAN Eksik'}</td>
                        <td className={`py-3 px-3 text-right font-black text-sm ${sub.balance < -0.009 ? 'text-amber-600' : 'text-emerald-700'}`}>{sub.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
                
        {/* 4. TAŞERON IBAN YÖNETİMİ */}
        {activeTab === 'sub_ibans' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Alt Yüklenici Tanımları ({dbSubcontractors.length} kart)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Unvan, vergi no, telefon ve IBAN. Yeni kart açın, düzeltin. Avans vermek için satırdaki Avans’ı kullanın; faturalar silinmez.</p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                    <FileUp className="w-4 h-4" /> IBAN Exceli Yükle
                    <input type="file" accept=".xlsx,.xls" onChange={handleImportSubIbanExcel} className="hidden" />
                  </label>
                  <button 
                    onClick={() => {
                      setEditingSubIbanId(null);
                      setSubIbanFormData({ name: '', iban: '', phone: '', tax_no: '' });
                      setIsSubIbanModalOpen(true);
                    }}
                    className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                    <Plus className="w-4 h-4" /> Yeni kart
                  </button>
                </div>
              )}
            </div>

            <PortalInput
              type="text"
              placeholder="Unvan, vergi no, IBAN veya telefon ara..."
              value={subInfoSearchTerm}
              onChange={e => setSubInfoSearchTerm(e.target.value)}
              className="w-full sm:w-80 px-3.5 py-2 border border-slate-200 rounded-xl text-xs"
            />

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Unvan</th>
                    <th className="py-3 px-3">Vergi no</th>
                    <th className="py-3 px-3">Telefon</th>
                    <th className="py-3 px-3">IBAN</th>
                    {isAdmin && <th className="py-3 px-3 text-center">İşlem</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dbSubcontractors
                    .filter(s => {
                      const q = subInfoSearchTerm.trim().toLocaleLowerCase('tr-TR');
                      if (!q) return true;
                      return [s.name, s.company_name, s.tax_no, s.tax_number, s.phone, s.iban].join(' ').toLocaleLowerCase('tr-TR').includes(q);
                    })
                    .map(s => (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 font-bold text-slate-800 text-sm">{s.company_name || s.name}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{s.tax_no || s.tax_number || '—'}</td>
                      <td className="py-3 px-3 text-slate-600">{s.phone || '—'}</td>
                      <td className="py-3 px-3 font-mono font-medium text-blue-700">{s.iban || 'IBAN eksik'}</td>
                      {isAdmin && (
                        <td className="py-3 px-3 text-center space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openContractorAdvance(s)}
                            className="px-2 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition"
                            title="Peşin veya taksitli avans">
                            Avans
                          </button>
                          <button 
                            onClick={() => {
                              setEditingSubIbanId(s.id);
                              setSubIbanFormData({
                                name: s.company_name || s.name,
                                iban: s.iban || '',
                                phone: s.phone || '',
                                tax_no: s.tax_no || s.tax_number || ''
                              });
                              setIsSubIbanModalOpen(true);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition" title="Düzenle">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={async () => {
                              if (window.confirm(`${s.name} kartı silinsin mi? Faturalar durur; banka talimatında IBAN eşleşmez.`)) {
                                await supabase.from('subcontractors').delete().eq('id', s.id);
                                loadPortalData();
                              }
                            }}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition" title="Sil">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. BANKA ÖDEME TALİMATI */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Banka Toplu Ödeme Talimatı (Excel)</h3>
                <p className="text-xs text-slate-500 mt-0.5">İşaretledikleriniz Excel’e yazılır; cariye henüz işlemez. Banka “transfer edildi” deyince sarı kutudaki <b>Ödendi işle</b> tek onaydır. Ödenen Excel tekrar yüklenmez.</p>
              </div>

              {isAdmin ? (
                <div className="flex flex-wrap items-center gap-2">
                <button 
                  onClick={handleDownloadBankExcel}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition">
                  <Download className="w-4 h-4" /> Seçilenleri Banka Exceli Olarak İndir
                </button>
                </div>
              ) : isReporter ? (
                <span className="text-xs text-slate-500 font-semibold">Liste açık. Banka talimat Excel’i ve ödendi işlemi yalnızca yöneticide.</span>
              ) : (
                <span className="text-xs text-rose-600 font-bold">Bu menüde işlem yetkisi yok.</span>
              )}
            </div>

            {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-500 font-semibold">Toplu uygula:</span>
              <button type="button" onClick={() => handleBulkBankPayMode('term1')} className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-white text-slate-600 border-slate-200 hover:border-blue-300">Tümüne 1 nci</button>
              <button type="button" onClick={() => handleBulkBankPayMode('term2')} className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-white text-slate-600 border-slate-200 hover:border-blue-300">Tümüne 2 nci</button>
              <button type="button" onClick={() => handleBulkBankPayMode('both')} className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-white text-slate-600 border-slate-200 hover:border-blue-300">Tümüne Tamamı</button>
            </div>
            )}

            {(dbPaymentBatches || []).filter((b: any) => String(b.status) === 'sent').length > 0 && (
              <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-amber-900">Bankaya giden, henüz ödendi işlenmeyen talimatlar</p>
                {(dbPaymentBatches || [])
                  .filter((b: any) => String(b.status) === 'sent')
                  .sort((a: any, b: any) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
                  .map((b: any) => (
                    <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 bg-white border border-amber-100 rounded-lg px-3 py-2">
                      <div>
                        <div className="text-sm font-bold text-slate-800">{b.title || 'Banka talimatı'}</div>
                        <div className="text-[11px] text-slate-500">
                          {formatDateTR(b.pay_date)} · {b.contractor_count || (Array.isArray(b.payload?.rows) ? b.payload.rows.length : 0)} kişi · {cleanNumber(b.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={payingBatchId === b.id}
                            onClick={() => handleConfirmPaymentBatch(b)}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                          >
                            {payingBatchId === b.id ? 'İşleniyor…' : 'Ödendi işle'}
                          </button>
                          <button
                            onClick={() => handleCancelPaymentBatch(b)}
                            className="bg-white border border-slate-200 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-slate-50"
                          >
                            İptal
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-blue-900 block">Bankadan Çıkacak Seçili Toplam Tutar:</span>
                <span className="text-2xl font-black text-blue-700">
                  {bankLiveSelectionSummary.total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </span>
                {displayBankTermLines.some(l => l.advanceCut > 0) && (
                  <span className="text-[11px] font-semibold text-amber-700 mt-1 block">
                    Listede avans mahsubu: −{displayBankTermLines.reduce((s, l) => s + (l.advanceCut || 0), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </span>
                )}
              </div>
              <span className="bg-blue-200 text-blue-900 font-bold px-3 py-1 rounded-full text-xs">
                {bankLiveSelectionSummary.count} alt yüklenici
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 text-center w-12">
                      <button 
                        onClick={handleToggleSelectAllBank}
                        className="font-bold text-blue-600 hover:underline">
                        {bankContractorRows.length > 0 && bankContractorRows.every(r => r.lineIds.every(id => bankSelectedLines[id])) ? 'Bırak' : 'Tümü'}
                      </button>
                    </th>
                    <th 
                      className="py-3 px-3 cursor-pointer select-none hover:text-blue-600 transition-colors"
                      onClick={() => {
                        if (bankSortField === 'contractorName') setBankSortOrder(bankSortOrder === 'asc' ? 'desc' : 'asc');
                        else { setBankSortField('contractorName'); setBankSortOrder('asc'); }
                      }}
                    >
                      Alt yüklenici {bankSortField === 'contractorName' ? (bankSortOrder === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="py-3 px-3">Faturalar</th>
                    <th className="py-3 px-3">Bu talimatta</th>
                    <th 
                      className="py-3 px-3 cursor-pointer select-none hover:text-blue-600 transition-colors"
                      onClick={() => {
                        if (bankSortField === 'dueDate') setBankSortOrder(bankSortOrder === 'asc' ? 'desc' : 'asc');
                        else { setBankSortField('dueDate'); setBankSortOrder('asc'); }
                      }}
                    >
                      En yakın vade {bankSortField === 'dueDate' ? (bankSortOrder === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th
                      className="py-3 px-3 cursor-pointer select-none hover:text-blue-600 transition-colors"
                      onClick={() => {
                        if (bankSortField === 'iban') setBankSortOrder(bankSortOrder === 'asc' ? 'desc' : 'asc');
                        else { setBankSortField('iban'); setBankSortOrder('asc'); }
                      }}
                    >
                      IBAN {bankSortField === 'iban' ? (bankSortOrder === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th 
                      className="py-3 px-3 text-right cursor-pointer select-none hover:text-blue-600 transition-colors"
                      onClick={() => {
                        if (bankSortField === 'amount') setBankSortOrder(bankSortOrder === 'asc' ? 'desc' : 'asc');
                        else { setBankSortField('amount'); setBankSortOrder('desc'); }
                      }}
                    >
                      Tutar {bankSortField === 'amount' ? (bankSortOrder === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bankContractorRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">Bankaya gidecek açık tutar yok.</td>
                    </tr>
                  )}
                  {bankContractorRows.map(row => {
                    const isChecked = row.lineIds.length > 0 && row.lineIds.every(id => bankSelectedLines[id]);
                    const overdue = row.dueDate && new Date(row.dueDate) < new Date(new Date().toISOString().split('T')[0]);
                    const modeBtn = (id: 'term1' | 'term2' | 'both', label: string, enabled: boolean) => (
                      <button
                        type="button"
                        disabled={!enabled}
                        onClick={() => handleSetBankPayMode(row.groupKey, id, row)}
                        className={`px-2 py-1 rounded text-[10px] font-bold border ${
                          !enabled ? 'opacity-30 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-100'
                            : row.mode === id ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        {label}
                      </button>
                    );
                    return (
                      <tr key={row.groupKey} className={`hover:bg-slate-50 transition ${isChecked ? 'bg-blue-50/60' : ''}`}>
                        <td className="py-3 px-3 text-center">
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleBankContractor(row.lineIds, [...row.term1Ids, ...row.term2Ids])}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">{row.contractorName}</td>
                        <td className="py-3 px-3 text-slate-600">
                          {row.invoiceNos.length} fatura
                          <span className="block text-[10px] text-slate-400 truncate max-w-[280px]" title={row.invoiceNos.join(' · ')}>
                            {row.invoiceNos.slice(0, 2).join(' · ')}{row.invoiceNos.length > 2 ? '…' : ''}
                      </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            {modeBtn('term1', '1 nci', row.has1)}
                            {modeBtn('term2', '2 nci', row.has2)}
                            {modeBtn('both', 'Tamamı', row.has1 && row.has2)}
                  </div>
                          <span className="block text-[10px] text-slate-400 mt-1">
                            1 nci {row.term1Amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · 2 nci {row.term2Amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                </td>
                        <td className={`py-3 px-3 whitespace-nowrap ${overdue ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                          {formatDateTR(row.dueDate)}
                        </td>
                        <td className={`py-3 px-3 font-mono ${row.iban === 'IBAN Eksik' ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                          {row.iban}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-700">
                          {row.netAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                          {row.leftoverAdvance > 0.01 && (
                            <span className="block text-[10px] font-semibold text-amber-700">
                              Kalan avans {row.leftoverAdvance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ gelecek faturaya
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. PERSONEL & BORDRO */}
        {activeTab === 'employees' && (
<div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        {/* ÜST BAŞLIK VE BUTONLAR */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
          <div>
            <h3 className="font-bold text-lg text-slate-900">
              Personel & Maaş Yönetimi ({empSummary.count} Personel)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Girişten önceki aya maaş yok. Giriş ayı: o ayın günü / ay günü × sabit maaş; 1’inde (ay kapanınca) caride açılır. Bu ay giren için bugün maaş 0’dır.
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenBulkSalaryModal}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition"
              >
                <CheckSquare className="w-4 h-4" /> Kalan carileri öde
              </button>
              <button
                onClick={() => {
                  setEditingEmployeeId(null);
                  setEmployeeFormData({ fullName: '', roleTitle: 'Kamyon Şoförü / Dağıtım', baseSalary: '', employerSgk: '', phone: '', iban: '', monthlyBonus: '', bonusDescription: '', monthlyAdvance: '', advanceDescription: '', hireDate: '' });
                  setNewEmpTx(emptyEmpTx);
                  setIsEmployeeModalOpen(true);
                }}
                className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition"
              >
                <Plus className="w-4 h-4" /> Yeni Personel Ekle
              </button>
            </div>
          )}
        </div>

        {/* FİNANSAL ÖZET SAYAÇLARI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Toplam Sözleşmeli Maaş</span>
            <span className="text-base font-extrabold text-slate-800 mt-0.5 block">
              {empSummary.totalBase.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
            </span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Açık ay sefer primi</span>
            <span className="text-base font-extrabold text-emerald-800 mt-0.5 block">
              +{empSummary.totalBonus.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
            </span>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Açık ay avansı</span>
            <span className="text-base font-extrabold text-amber-800 mt-0.5 block">
              -{empSummary.totalAdv.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
            </span>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">Personele kalan (alacak)</span>
            <span className="text-base font-black text-blue-900 mt-0.5 block">
              {empSummary.totalNet.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
            </span>
          </div>
        </div>

        {/* ARAMA VE SIRALAMA ÇUBUĞU */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 max-w-md">
            <PortalInput
              type="text"
              placeholder="Personel adı, görev veya telefon ile filtrele..."
              value={empSearchTerm}
              onChange={(e) => setEmpSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <span className="text-xs text-slate-500 font-medium mr-1">Sırala:</span>
            <button
              type="button"
              onClick={() => {
                if (empSortField === 'name') setEmpSortOrder(empSortOrder === 'asc' ? 'desc' : 'asc');
                else { setEmpSortField('name'); setEmpSortOrder('asc'); }
              }}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${
                empSortField === 'name' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Ad Soyad {empSortField === 'name' && (empSortOrder === 'asc' ? '↑' : '↓')}
            </button>

            <button
              type="button"
              onClick={() => {
                if (empSortField === 'salary') setEmpSortOrder(empSortOrder === 'asc' ? 'desc' : 'asc');
                else { setEmpSortField('salary'); setEmpSortOrder('desc'); }
              }}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${
                empSortField === 'salary' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Sabit Maaş {empSortField === 'salary' && (empSortOrder === 'asc' ? '↑' : '↓')}
            </button>

            <button
              type="button"
              onClick={() => {
                if (empSortField === 'netPayable') setEmpSortOrder(empSortOrder === 'asc' ? 'desc' : 'asc');
                else { setEmpSortField('netPayable'); setEmpSortOrder('desc'); }
              }}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${
                empSortField === 'netPayable' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Net Alacak {empSortField === 'netPayable' && (empSortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>
        </div>

        {/* TABLO */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
           <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200 select-none">
              <tr>
                <th 
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition group"
                  onClick={() => {
                    if (empSortField === 'name') setEmpSortOrder(empSortOrder === 'asc' ? 'desc' : 'asc');
                    else { setEmpSortField('name'); setEmpSortOrder('asc'); }
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Personel Bilgisi</span>
                    <span className="text-xs text-blue-600">{empSortField === 'name' ? (empSortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th 
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100 transition group"
                  onClick={() => {
                    if (empSortField === 'salary') setEmpSortOrder(empSortOrder === 'asc' ? 'desc' : 'asc');
                    else { setEmpSortField('salary'); setEmpSortOrder('desc'); }
                  }}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Sabit Maaş</span>
                    <span className="text-xs text-blue-600">{empSortField === 'salary' ? (empSortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th className="py-3 px-3 text-right">SGK işveren</th>
                <th className="py-3 px-3 text-right">Açık ay prim</th>
                <th className="py-3 px-3 text-right">Açık ay avans</th>
                <th 
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100 transition group"
                  onClick={() => {
                    if (empSortField === 'netPayable') setEmpSortOrder(empSortOrder === 'asc' ? 'desc' : 'asc');
                    else { setEmpSortField('netPayable'); setEmpSortOrder('desc'); }
                  }}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Cari (alacak / verecek)</span>
                    <span className="text-xs text-blue-600">{empSortField === 'netPayable' ? (empSortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th className="py-3 px-3 text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 text-sm">{emp.full_name}</span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {emp.role_title} • {formatPhone(emp.phone || '') || 'Tel Yok'}
                        {emp.hire_date
                          ? ` • Giriş: ${formatDateTR(emp.hire_date)}`
                          : emp.created_at
                            ? ` • Kayıt: ${formatDateTR(emp.created_at)}`
                            : ''}
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-3 text-right font-medium text-slate-700">
                    {emp.baseSalaryNum.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </td>

                  <td className="py-3 px-3 text-right font-medium text-slate-600">
                    {cleanNumber(emp.employer_sgk) > 0
                      ? `${cleanNumber(emp.employer_sgk).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`
                      : <span className="text-slate-400">-</span>}
                  </td>

                  <td className="py-3 px-3 text-right">
                    {emp.bonusNum > 0 ? (
                      <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        +{emp.bonusNum.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-right">
                    {emp.advanceDeduction > 0 ? (
                      <span className="inline-flex items-center text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        -{emp.advanceDeduction.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-right">
                    <div className="flex flex-col items-end">
                      <span className={`font-extrabold text-sm ${emp.cariBalance < -0.009 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {emp.cariBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                      </span>
                      {emp.booksPaid > 0 && (
                        <span className="mt-0.5 text-[10px] text-slate-500">
                          Ödenen {emp.booksPaid.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                        </span>
                      )}
                      {emp.cariBalance < -0.009 && (
                        <span className="mt-0.5 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                          Personel borçlu
                        </span>
                      )}
                    </div>
                  </td>

                    <td className="py-3 px-3 text-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => openPayrollReport(emp)}
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition"
                        title="Hakediş raporu (PDF / Excel)"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <>
                      <button
                        type="button"
                        onClick={() => handleOpenSingleSalaryPay(emp)}
                        className="px-2 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                        title="Bu kişiye maaş / prim öde"
                      >
                        Öde
                      </button>
                      <button
                        onClick={() => {
                          setEditingEmployeeId(emp.id);
                    setEmployeeFormData({
                      fullName: emp.full_name || '',
                      roleTitle: emp.role_title || 'Kamyon Şoförü / Dağıtım',
                      baseSalary: String(emp.base_salary || ''),
                      employerSgk: emp.employer_sgk !== undefined && emp.employer_sgk !== null ? String(emp.employer_sgk) : '',
                      hireDate: sanitizeDate(emp.hire_date),
                      phone: formatPhone(emp.phone || ''),
                      iban: emp.iban || '',
                      monthlyBonus: String(emp.monthly_bonus || ''),
                      bonusDescription: emp.bonus_description || '',
                     advanceTotal: emp.advance_total !== undefined && emp.advance_total !== null ? String(emp.advance_total) : (emp.monthly_advance ? String(emp.monthly_advance) : ''),
                      advanceInstallments: String(emp.advance_installments || '1'),
                    monthlyAdvance: String(emp.monthly_advance || ''),
                   advanceDescription: emp.advance_description || ''
                    });
                          setNewEmpTx(emptyEmpTx);
                          setIsEmployeeModalOpen(true);
                        }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                        title="Düzenle / Prim Gir"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (window.confirm(`${emp.full_name} personelini silmek istediğinize emin misiniz?`)) {
                            await supabase.from('employees').delete().eq('id', emp.id);
                            loadPortalData();
                          }
                        }}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition"
                        title="Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                        </>
                  )}
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
)}
        {/* 7. KREDİ KARTLARI */}
        {activeTab === 'credit_cards' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Kredi Kartları</h3>
                <p className="text-xs text-slate-500 mt-0.5">Gider kartla kapanırsa kasa düşmez. Kasa, kart ekstresi ödenince çıkar. Şahsi kartta şirket payını siz yazarsınız.</p>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => {
                    setEditingCreditCardId(null);
                    setCreditCardFormData({ cardName: '', bankName: '', lastFourDigits: '', statementAmount: '', minPaymentAmount: '', dueDate: '', cardKind: 'company' });
                    setIsCreditCardModalOpen(true);
                  }}
                  className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                  <Plus className="w-4 h-4" /> Yeni Kredi Kartı Ekle
                </button>
              )}
            </div>

            {(() => {
              const today = new Date().toISOString().split('T')[0];
              const dueDiff = (c: any) => {
                const due = sanitizeDate(c.due_date);
                if (!due) return 999;
                return Math.ceil((new Date(due).getTime() - new Date(today).getTime()) / 86400000);
              };
              const totalStmt = dbCreditCards.reduce((s, c) => s + cleanNumber(c.statement_amount), 0);
              const overdue = dbCreditCards.filter(c => dueDiff(c) < 0 && cleanNumber(c.statement_amount) > 0);
              const week = dbCreditCards.filter(c => {
                const d = dueDiff(c);
                return cleanNumber(c.statement_amount) > 0 && d >= 0 && d <= 7;
              });
              const bankAccent = (name: string) => {
                const n = (name || '').toLocaleLowerCase('tr-TR');
                if (n.includes('garanti')) return { bar: 'bg-[#00a651]', chip: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
                if (n.includes('iş bank') || n.includes('isbank') || n.includes('işbank')) return { bar: 'bg-[#003d82]', chip: 'bg-blue-50 text-blue-800 border-blue-200' };
                if (n.includes('yapı') || n.includes('yapi kredi') || n.includes('yapikredi')) return { bar: 'bg-[#7b1fa2]', chip: 'bg-purple-50 text-purple-800 border-purple-200' };
                if (n.includes('akbank')) return { bar: 'bg-[#e31e24]', chip: 'bg-red-50 text-red-700 border-red-200' };
                if (n.includes('ziraat')) return { bar: 'bg-[#e30613]', chip: 'bg-rose-50 text-rose-800 border-rose-200' };
                if (n.includes('halk')) return { bar: 'bg-[#1b4f9c]', chip: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
                if (n.includes('vakıf') || n.includes('vakif')) return { bar: 'bg-[#f9b000]', chip: 'bg-amber-50 text-amber-900 border-amber-200' };
                if (n.includes('qnb') || n.includes('finans')) return { bar: 'bg-[#6c1d5f]', chip: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200' };
                if (n.includes('deniz')) return { bar: 'bg-[#00a0df]', chip: 'bg-sky-50 text-sky-800 border-sky-200' };
                if (n.includes('ing') || n.includes('enpara')) return { bar: 'bg-[#ff6200]', chip: 'bg-orange-50 text-orange-800 border-orange-200' };
                if (n.includes('teb')) return { bar: 'bg-[#6d2c91]', chip: 'bg-violet-50 text-violet-800 border-violet-200' };
                return { bar: 'bg-slate-400', chip: 'bg-slate-100 text-slate-700 border-slate-200' };
              };
              const toggleSort = (field: typeof cardSortField) => {
                if (cardSortField === field) setCardSortOrder(cardSortOrder === 'asc' ? 'desc' : 'asc');
                else { setCardSortField(field); setCardSortOrder(field === 'amount' ? 'desc' : 'asc'); }
              };
              const rows = [...dbCreditCards]
                .filter(c => {
                  const amt = cleanNumber(c.statement_amount);
                  const d = dueDiff(c);
                  if (cardDueFilter === 'overdue') return amt > 0 && d < 0;
                  if (cardDueFilter === 'week') return amt > 0 && d >= 0 && d <= 7;
                  if (cardDueFilter === 'clear') return amt <= 0;
                  return true;
                })
                .sort((a, b) => {
                  let cmp = 0;
                  if (cardSortField === 'amount') cmp = cleanNumber(a.statement_amount) - cleanNumber(b.statement_amount);
                  else if (cardSortField === 'bank') cmp = String(a.bank_name || '').localeCompare(String(b.bank_name || ''), 'tr');
                  else if (cardSortField === 'name') cmp = String(a.card_name || '').localeCompare(String(b.card_name || ''), 'tr');
                  else cmp = dueDiff(a) - dueDiff(b);
                  return cardSortOrder === 'asc' ? cmp : -cmp;
                });
              const sortMark = (field: typeof cardSortField) => cardSortField === field ? (cardSortOrder === 'asc' ? ' ↑' : ' ↓') : '';
              return (
                <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
                    <span className="text-[11px] text-rose-800 font-semibold block">Toplam ekstre borcu</span>
                    <span className="text-lg font-black text-slate-900">{totalStmt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                  </div>
                  <button type="button" onClick={() => setCardDueFilter(cardDueFilter === 'week' ? 'all' : 'week')} className={`text-left rounded-xl p-3 border ${cardDueFilter === 'week' ? 'bg-amber-100 border-amber-300' : 'bg-amber-50 border-amber-100'}`}>
                    <span className="text-[11px] text-amber-800 font-semibold block">Bu hafta son ödeme</span>
                    <span className="text-lg font-black text-slate-900">{week.length} kart</span>
                  </button>
                  <button type="button" onClick={() => setCardDueFilter(cardDueFilter === 'overdue' ? 'all' : 'overdue')} className={`text-left rounded-xl p-3 border ${cardDueFilter === 'overdue' ? 'bg-rose-100 border-rose-300' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[11px] text-slate-600 font-semibold block">Geciken</span>
                    <span className="text-lg font-black text-rose-700">{overdue.length} kart</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {([
                    ['all', 'Tümü'],
                    ['week', 'Bu hafta'],
                    ['overdue', 'Geciken'],
                    ['clear', 'Borcu yok']
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setCardDueFilter(id)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border ${cardDueFilter === id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3 cursor-pointer select-none" onClick={() => toggleSort('name')}>Kart{sortMark('name')}</th>
                        <th className="py-3 px-3 cursor-pointer select-none" onClick={() => toggleSort('bank')}>Banka{sortMark('bank')}</th>
                        <th className="py-3 px-3">Tür</th>
                        <th className="py-3 px-3 text-right cursor-pointer select-none" onClick={() => toggleSort('amount')}>Kalan ekstre{sortMark('amount')}</th>
                        <th className="py-3 px-3 text-right">Asgari</th>
                        <th className="py-3 px-3 cursor-pointer select-none" onClick={() => toggleSort('due')}>Son ödeme{sortMark('due')}</th>
                        <th className="py-3 px-3 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {rows.length === 0 ? (
                        <tr><td colSpan={7} className="py-8 text-center text-slate-400">Bu filtrede kart yok.</td></tr>
                      ) : rows.map((cc, idx) => {
                const stmtAmt = cleanNumber(cc.statement_amount);
                const minAmt = cleanNumber(cc.min_payment_amount);
                const hasDebt = stmtAmt > 0;
                        const diff = dueDiff(cc);
                        const isPersonal = cc.card_kind === 'personal' || /şahsi|sahsi|kişisel|kisisel/i.test(String(cc.card_name || ''));
                        const accent = bankAccent(cc.bank_name);
                        const open = cardMenuId === (cc.id ?? idx);
                return (
                          <tr key={cc.id || idx} className={`hover:bg-slate-50 ${hasDebt && diff < 0 ? 'bg-rose-50/40' : hasDebt && diff <= 3 ? 'bg-amber-50/30' : ''}`}>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-8 rounded-full shrink-0 ${accent.bar}`} />
                    <div>
                                  <div className="font-bold text-slate-900 text-sm">{cc.card_name}</div>
                                  {cc.last_four_digits ? <div className="text-[10px] text-slate-400 font-mono">•••• {cc.last_four_digits}</div> : null}
                      </div>
                        </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold border ${accent.chip}`}>{cc.bank_name || '-'}</span>
                            </td>
                            <td className="py-3 px-3 text-slate-600">{isPersonal ? 'Şahsi' : 'Şirket'}</td>
                            <td className={`py-3 px-3 text-right font-black ${hasDebt ? 'text-rose-700' : 'text-emerald-700'}`}>
                              {stmtAmt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                            </td>
                            <td className="py-3 px-3 text-right text-amber-800 font-semibold">
                              {minAmt > 0 ? `${minAmt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : '—'}
                            </td>
                            <td className="py-3 px-3">
                              <div className={`font-bold ${hasDebt && diff < 0 ? 'text-rose-700' : hasDebt && diff <= 3 ? 'text-amber-800' : 'text-slate-800'}`}>{formatDateTR(cc.due_date)}</div>
                              {hasDebt ? (
                                <div className="text-[10px] text-slate-500">
                                  {diff < 0 ? `${Math.abs(diff)} gün gecikti` : diff === 0 ? 'Bugün' : `${diff} gün kaldı`}
                        </div>
                              ) : null}
                            </td>
                            <td className="py-3 px-3 text-right relative">
                    {isAdmin && (
                            <>
                              <button
                                type="button"
                                    onClick={() => setCardMenuId(open ? null : (cc.id ?? idx))}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                                    title="İşlemler"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                              </button>
                                  {open && (
                                    <div className="absolute right-3 top-12 z-20 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 text-left">
                                      {hasDebt && (
                                        <>
                                          <button type="button" className="w-full px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50" onClick={() => { setCardMenuId(null); handlePayCreditCard(cc, 'full'); }}>Tamamını öde</button>
                              {minAmt > 0 && minAmt < stmtAmt && (
                                            <button type="button" className="w-full px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50" onClick={() => { setCardMenuId(null); handlePayCreditCard(cc, 'min'); }}>Asgariyi öde</button>
                              )}
                            </>
                          )}
                                      <button type="button" className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => { setCardMenuId(null); openEditCreditCardModal(cc); }}>Düzenle / ekstre</button>
                                      <button type="button" className="w-full px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50" onClick={async () => {
                                        setCardMenuId(null);
                                        if (!window.confirm(`${cc.card_name} kartını silmek istiyor musunuz?`)) return;
                                await supabase.from('credit_cards').delete().eq('id', cc.id);
                                loadPortalData();
                                      }}>Sil</button>
                      </div>
                    )}
                                </>
                              )}
                            </td>
                          </tr>
                );
              })}
                    </tbody>
                  </table>
            </div>
                </>
              );
            })()}
          </div>
        )}

        {/* 8. ARAÇ FİLOSU */}
        {activeTab === 'trip_settlements' && canViewMod('trip_settlements') && (
          <TripSettlementsPage
            depot={filoDepot}
            plates={dbTripPlates}
            rows={dbTripSettlements}
            isAdmin={isAdmin}
            canEditModule={canEditMod('trip_settlements')}
            role={currentUserRole}
            cleanNumber={cleanNumber}
            depots={filoVisibleDepots(currentUserRole, filoAssignedDepots, dbFiloDepots)}
            allDepots={mergeFiloDepots(dbFiloDepots)}
            onSelectDepot={setFiloDepot}
            onReload={loadPortalData}
          />
        )}

        {activeTab === 'hal_saha' && canViewMod('hal_saha') && (
          <HalSahaPage
            firms={dbHalFirms}
            entries={dbHalEntries}
            handovers={dbHalHandovers}
            plates={dbHalPlates}
            canEdit={canEditMod('hal_saha')}
            canTakeToCash={isAdmin}
            formatDateTR={formatDateTR}
            cleanNumber={cleanNumber}
            onReload={loadPortalData}
          />
        )}

        {activeTab === 'hal_saha_report' && canViewMod('hal_saha_report') && (
          <HalSahaReportPage
            firms={dbHalFirms}
            entries={dbHalEntries}
            handovers={dbHalHandovers}
            formatDateTR={formatDateTR}
            cleanNumber={cleanNumber}
          />
        )}

        {activeTab === 'arac_filosu' && canViewMod('arac_filosu') && (
          <AracFilosuPage
            vehicles={dbAracVehicles}
            assignments={dbAracAssignments}
            jobs={dbAracJobs}
            places={dbAracPlaces}
            subcontractors={dbSubcontractors}
            filoDepots={mergeFiloDepots(dbFiloDepots)}
            isAdmin={isAdmin}
            canEdit={canEditMod('arac_filosu')}
            onReload={loadPortalData}
          />
        )}

        {activeTab === 'fleet' && (
          <FleetPage
            vehicles={dbVehicles}
            invoices={dbInvoices}
            canEdit={canEditMod('fleet')}
            onAdd={() => {
                    setEditingVehicleId(null);
                    setVehicleFormData({
                      plateNumber: '',
                      driverName: '',
                      brandModel: '',
                      documentIncluded: 'VAR',
                      trackingSystem: 'Var',
                      fuelSystem: 'UTTS',
                      hgsSystem: 'SHELL',
                vehicleType: 'Kamyon',
                      ownershipType: 'Öz Mal',
                isActive: true,
                      nextInspectionDate: '',
                      inspectionCost: '',
                      insuranceCompany: '',
                      insuranceCost: '',
                      insuranceStartDate: '',
                      kaskoCompany: '',
                      kaskoCost: '',
                      kaskoStartDate: '',
                      lastMtvCost: ''
                    });
                    setIsVehicleModalOpen(true);
                  }}
            onEdit={openEditVehicleModal}
            onUnlinkPlate={isAdmin ? async (invId, plate) => {
              const inv = (dbInvoices || []).find((i: any) => String(i.id) === String(invId));
              if (!inv) return;
              const next = removeExpensePlateTag(inv.invoice_no, plate);
              if (next === String(inv.invoice_no || '').trim()) return;
              if (!window.confirm(`${plate} bu giderden çıksın mı? Kayıt ${next || 'plakasız'} olur.`)) return;
              const { error } = await supabase.from('invoices').update({ invoice_no: next }).eq('id', inv.id);
              if (error) alert('Plaka çıkarılamadı: ' + error.message);
              else await loadPortalData();
            } : undefined}
            cleanNumber={cleanNumber}
            formatDateTR={formatDateTR}
            normalizeVehicleType={normalizeVehicleType}
            isActiveVehicle={isActiveVehicle}
          />
        )}

{/* 9. ÖZ MAL KARLILIK & MALİYET */}
        {activeTab === 'profitability' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 border-b border-slate-100 gap-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Öz Mal Araç Karlılık</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ayın ilk haftasında bir önceki ay kapanır. Alkan öz mal ciro ve yakıt yalnızca Filo’dan gelir; HGS burada elle girilir. Maaş+prim, SGK, sigorta/kasko/MTV/muayene ve bakım-lastik (yıllık÷12) sistemden gelir.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700">
                  <Calendar className="w-4 h-4 text-[#009fe3]" />
                  <span>Ay</span>
                  <input
                    type="month"
                    value={profitMonth}
                    onChange={e => setProfitMonth(e.target.value)}
                    className="bg-transparent outline-none font-bold"
                  />
                </label>
                <button
                  type="button"
                  disabled={profitPdfBusy || !dbProfitability.length}
                  onClick={async () => {
                    const included = dbProfitability.filter((p: any) => p.included);
                    const totalRev = included.reduce((sum: number, p: any) => sum + p.invoice_rev, 0);
                    const totalCost = included.reduce((sum: number, p: any) => sum + p.totalCost, 0);
                    const totalNet = included.reduce((sum: number, p: any) => sum + p.netProfit, 0);
                    const marginPct = totalRev > 0 ? (totalNet / totalRev) * 100 : null;
                    setProfitPdfBusy(true);
                    try {
                      const blob = await htmlNodeToPdfBlob(profitabilityPdfMarkup({
                        month: profitMonth,
                        monthLabel: yearMonthTrLabel(profitMonth),
                        rows: dbProfitability,
                        totalRev,
                        totalCost,
                        totalNet,
                        marginPct
                      }), 'landscape');
                      downloadBlob(blob, `Oz_Mal_Karlilik_${profitMonth}.pdf`);
                    } catch (err: any) {
                      alert('PDF hazırlanamadı: ' + (err.message || ''));
                    } finally {
                      setProfitPdfBusy(false);
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Download className="w-4 h-4" />
                  {profitPdfBusy ? 'PDF hazırlanıyor…' : 'PDF arşiv'}
                </button>
                <button
                  type="button"
                  disabled={!dbProfitability.length}
                  onClick={() => {
                    const included = dbProfitability.filter((p: any) => p.included);
                    const totalRev = included.reduce((sum: number, p: any) => sum + p.invoice_rev, 0);
                    const totalCost = included.reduce((sum: number, p: any) => sum + p.totalCost, 0);
                    const totalNet = included.reduce((sum: number, p: any) => sum + p.netProfit, 0);
                    const marginPct = totalRev > 0 ? (totalNet / totalRev) * 100 : null;
                    const money = (n: number) => Number(n || 0);
                    exportAoaExcel([
                      ['Tazeyol ERP — Öz Mal Karlılık'],
                      ['Ay', yearMonthTrLabel(profitMonth)],
                      [],
                      ['Toplam ciro', money(totalRev)],
                      ['Toplam gider', money(totalCost)],
                      ['Net kâr / zarar', money(totalNet)],
                      ['Karlılık oranı %', marginPct == null ? '' : `${formatNumTR(marginPct, 1)} %`],
                      [],
                      ['Bu ay', 'Tip', 'Plaka', 'Şoför', 'Ciro', 'Yakıt', 'HGS', 'Maaş + prim', 'SGK', 'Sabit / ay', 'Bakım / ay', 'Toplam gider', 'Net kâr'],
                      ...dbProfitability.map((p: any) => [
                        p.included ? 'Dahil' : 'Hariç',
                        p.vehicleType,
                        p.plate_number,
                        p.driver_name || '',
                        money(p.invoice_rev),
                        money(p.fuel),
                        money(p.hgs),
                        money(p.payroll),
                        money(p.sgk),
                        money(p.fixed_monthly),
                        money(p.bakim),
                        money(p.totalCost),
                        money(p.netProfit)
                      ])
                    ], `Oz_Mal_Karlilik_${profitMonth}.xlsx`, 'Oz mal');
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Excel
                </button>
                </div>
            </div>

              {(() => {
                const included = dbProfitability.filter(p => p.included);
                const totalRev = included.reduce((sum, p) => sum + p.invoice_rev, 0);
                const totalCost = included.reduce((sum, p) => sum + p.totalCost, 0);
                const totalNet = included.reduce((sum, p) => sum + p.netProfit, 0);
                const marginPct = totalRev > 0 ? (totalNet / totalRev) * 100 : null;
                const marginColor = marginPct == null ? 'text-slate-400' : marginPct >= 0 ? 'text-emerald-600' : 'text-rose-600';
                const money = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Toplam ciro</span>
                  <span className="text-2xl font-black text-slate-900 mt-1 block">
                    {money(totalRev)} ₺
                </span>
              </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Toplam gider</span>
                  <span className="text-2xl font-black text-rose-600 mt-1 block">
                    {money(totalCost)} ₺
                </span>
              </div>
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <span className="text-xs font-bold text-blue-800 uppercase tracking-wider block">Net kâr / zarar</span>
                  <span className={`text-2xl font-black mt-1 block ${totalNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {money(totalNet)} ₺
                </span>
              </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Karlılık oranı</span>
                  <span className={`text-2xl font-black mt-1 block ${marginColor}`}>
                    {marginPct == null ? '—' : `%${marginPct.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`}
                </span>
                  <span className="text-[10px] text-slate-500 mt-1 block">Net kâr ÷ ciro (bu ay, dahil araçlar)</span>
              </div>
            </div>
                );
              })()}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                      <th className="py-3 px-3">Bu ay</th>
                      <th className="py-3 px-3">Tip</th>
                      <th className="py-3 px-3">Plaka</th>
                      <th className="py-3 px-3">Şoför</th>
                      <th className="py-3 px-3 text-right">Ciro</th>
                      <th className="py-3 px-3 text-right">Yakıt</th>
                      <th className="py-3 px-3 text-right">HGS (elle)</th>
                      <th className="py-3 px-3 text-right">Maaş + prim</th>
                      <th className="py-3 px-3 text-right">SGK</th>
                      <th className="py-3 px-3 text-right">Sabit / ay</th>
                      <th className="py-3 px-3 text-right">Bakım / ay</th>
                      <th className="py-3 px-3 text-right">Net kâr</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {dbProfitability.map(item => {
                      const stored = monthlyInputRows.find(
                        r => String(r.plate_number).trim() === item.plate_number && r.year_month === profitMonth
                      );
                      const fmtInput = (n: number) => (n ? String(n) : '');
                      const fromFilo = alkanFiloPlateKeys(dbTripPlates).has(filoPlateKey(item.plate_number));
                    return (
                        <tr key={item.id || item.plate_number} className={`hover:bg-slate-50 ${item.included ? '' : 'opacity-40'}`}>
                        <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={item.included}
                              disabled={!isAdmin}
                              onChange={e => saveMonthlyProfitInput(item.plate_number, 'included', e.target.checked)}
                              title="Bu ay kârlılığa dahil et"
                            />
                        </td>
                          <td className="py-3 px-3 text-slate-600">{item.vehicleType}</td>
                          <td
                            onClick={() => openVehicle360(item.vehicle)}
                            className="py-3 px-3 font-mono font-bold text-blue-700 cursor-pointer underline decoration-blue-300"
                          >
                            {item.plate_number}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-700">{item.driver_name || 'Atanmadı'}</td>
                          <td className="py-3 px-3 text-right">
                            {fromFilo ? (
                              <span className="block w-28 ml-auto px-2 py-1 rounded bg-slate-100 text-right font-bold" title="Filo Alkan satırından gelir">
                                {item.invoice_rev ? `${item.invoice_rev.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : '—'}
                          </span>
                            ) : (
                            <PortalInput
                              type="text"
                              disabled={!isAdmin}
                              defaultValue={fmtInput(item.invoice_rev)}
                              key={`rev-${item.plate_number}-${profitMonth}-${stored?.updated_at || ''}`}
                              onBlur={e => saveMonthlyProfitInput(item.plate_number, 'invoice_rev', e.target.value)}
                              className="w-28 px-2 py-1 border border-slate-200 rounded text-right font-bold bg-white"
                            />
                          )}
                        </td>
                          <td className="py-3 px-3 text-right">
                            {fromFilo ? (
                              <span className="block w-24 ml-auto px-2 py-1 rounded bg-slate-100 text-right font-bold" title="Filo Alkan satırından gelir">
                                {item.fuel ? `${item.fuel.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : '—'}
                          </span>
                            ) : (
                            <PortalInput
                              type="text"
                              disabled={!isAdmin}
                              defaultValue={fmtInput(item.fuel)}
                              key={`fuel-${item.plate_number}-${profitMonth}-${stored?.updated_at || ''}`}
                              onBlur={e => saveMonthlyProfitInput(item.plate_number, 'fuel', e.target.value)}
                              className="w-24 px-2 py-1 border border-slate-200 rounded text-right bg-white"
                            />
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                            <PortalInput
                              type="text"
                              disabled={!isAdmin}
                              defaultValue={fmtInput(item.hgs)}
                              key={`hgs-${item.plate_number}-${profitMonth}-${stored?.updated_at || ''}`}
                              onBlur={e => saveMonthlyProfitInput(item.plate_number, 'hgs', e.target.value)}
                              className="w-24 px-2 py-1 border border-slate-200 rounded text-right bg-white"
                            />
                        </td>
                          <td className="py-3 px-3 text-right text-slate-700" title={`Maaş ${item.driver_sal.toLocaleString('tr-TR')} + prim ${item.bonus.toLocaleString('tr-TR')}`}>
                            {item.payroll.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                        </td>
                          <td className="py-3 px-3 text-right text-slate-700">{item.sgk.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</td>
                          <td className="py-3 px-3 text-right text-slate-700" title={`Sigorta ${item.insurance_m.toFixed(0)} + kasko ${item.kasko_m.toFixed(0)} + MTV ${item.mtv_m.toFixed(0)} + muayene ${item.inspection_m.toFixed(0)}`}>
                            {item.fixed_monthly.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                          </td>
                          <td
                            className="py-3 px-3 text-right text-slate-700"
                            title={`Bu yılın bakım+lastik toplamı ${item.bakimYear.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ ÷ 12`}
                          >
                            {item.bakim.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                          </td>
                          <td className={`py-3 px-3 text-right font-black ${item.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {item.netProfit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                          </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
              <p className="text-[11px] text-slate-400">Listede yalnızca filoda Aktif işaretli öz mal kamyonet, kamyon ve TIR görünür. Binek ve dorse burada yer almaz. “Bu ay” kutusu kamyonet gibi araçları bazı aylar toplamdan çıkarır. Bakım ve lastik, o yılın toplamının 12’ye bölümüdür; faturanın kesildiği aya tam yazılmaz.</p>
              {dbProfitability.length === 0 && (
                <p className="text-sm text-slate-500">Gösterilecek araç yok. Filoda tipi Kamyonet/Kamyon/TIR, sahiplik Öz Mal ve durum Aktif olsun.</p>
              )}
          </div>
        )}

        {activeTab === 'monthly_view' && (
          <MonthlyViewPage
            invoices={dbInvoices}
            cleanNumber={cleanNumber}
            formatDateTR={formatDateTR}
          />
        )}

        {activeTab === 'income_report' && (() => {
          const money = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const girdi = Math.max(0, totalCollectedCash);
          const cikti = Math.max(0, totalPeriodPaidExpenses);
          const flowTotal = girdi + cikti;
          const girdiShare = flowTotal > 0 ? (girdi / flowTotal) * 100 : 50;
          const barMax = Math.max(girdi, cikti, 1);
          const rangeLabel = filterStartDate && filterEndDate ? `${formatDateTR(filterStartDate)} — ${formatDateTR(filterEndDate)}` : 'Tüm dönem';
          const cashLineGetters = {
            date: (l: { sortDate: string }) => l.sortDate,
            title: (l: { title: string }) => l.title,
            amount: (l: { amount: number }) => l.amount
          };
          const inLines = sortByColumn(periodIncomeRows.map((inv: any) => ({
            date: formatDateTR(inv.issue_date),
            sortDate: sanitizeDate(inv.issue_date) || '',
            title: String(inv.invoice_no || '').trim() || String(inv.category || 'Gelir'),
            amount: cleanNumber(inv.total_amount)
          })), incomeInSort, cashLineGetters);
          const outLines = sortByColumn(periodExpenseRows.map((inv: any) => ({
            date: formatDateTR(inv.issue_date),
            sortDate: sanitizeDate(inv.issue_date) || '',
            title: String(inv.invoice_no || '').trim() || String(inv.category || 'Gider'),
            amount: cleanNumber(inv.total_amount),
            category: String(inv.category || '')
          })), incomeOutSort, cashLineGetters);
          const giderKalemKayitlar = dedupeGiderKalemRows(
            (dbInvoices || []).filter((inv: any) => {
              if (inv.direction === 'outgoing') return false;
              if (!isDateInRange(inv.issue_date)) return false;
              const cat = normalizeExpenseCategory(inv.category);
              return !!cat && cat !== 'opening_balance';
            }),
            amountsClose
          );
          const giderKalemOzet = (() => {
            const sums = new Map<string, number>();
            giderKalemKayitlar.forEach((inv: any) => {
              const cat = normalizeExpenseCategory(inv.category);
              if (!cat) return;
              sums.set(cat, (sums.get(cat) || 0) + cleanNumber(inv.total_amount));
            });
            const rows = [...sums.entries()]
              .map(([cat, amount]) => ({ cat, label: expenseCategoryLabel(cat), amount }))
              .filter(r => r.amount > 0.009)
              .sort((a, b) => b.amount - a.amount);
            const total = rows.reduce((s, r) => s + r.amount, 0);
            const maxAmt = Math.max(...rows.map(r => r.amount), 1);
            return { rows, total, maxAmt };
          })();
          const giderKalemDetay = (cat: string) => giderKalemKayitlar
            .filter((inv: any) => normalizeExpenseCategory(inv.category) === cat)
            .map((inv: any) => ({
              id: inv.id,
              date: formatDateTR(inv.issue_date),
              title: String(inv.invoice_no || '').trim() || expenseCategoryLabel(inv.category),
              amount: cleanNumber(inv.total_amount),
              kart: isExpensePaidByCard(inv),
              odendi: inv.status === 'paid'
            }))
            .sort((a: { amount: number }, b: { amount: number }) => b.amount - a.amount);
          const exportExcel = () => {
            exportAoaExcel([
              ['Tazeyol ERP — Genel Gelir Gider'],
              ['Dönem', rangeLabel],
              [],
              ['Girdi', totalCollectedCash],
              ['Çıktı', totalPeriodPaidExpenses],
              ['Net', periodProfit],
              [],
              ['Genel gider kırılımı'],
              ['Kalem', 'Tutar'],
              ...giderKalemOzet.rows.map(r => [r.label, r.amount]),
              ['Genel gider toplam', giderKalemOzet.total],
              [],
              ['Gelirler'],
              ['Tarih', 'Açıklama', 'Tutar'],
              ...inLines.map(l => [l.date, l.title, l.amount]),
              ['Toplam gelir', '', totalCollectedCash],
              [],
              ['Giderler'],
              ['Tarih', 'Açıklama', 'Tutar'],
              ...outLines.map(l => [l.date, l.title, l.amount]),
              ['Toplam gider', '', totalPeriodPaidExpenses]
            ], `Gelir_Gider_${filterStartDate}_${filterEndDate}.xlsx`, 'Gelir gider');
          };
          const exportPdf = async () => {
            setIncomePdfBusy(true);
            try {
              const blob = await htmlNodeToPdfBlob(incomeReportPdfMarkup({
                rangeLabel,
                girdi: totalCollectedCash,
                cikti: totalPeriodPaidExpenses,
                net: periodProfit,
                inLines,
                outLines
              }), 'landscape');
              downloadBlob(blob, `Gelir_Gider_${filterStartDate}_${filterEndDate}.pdf`);
            } catch (err: any) {
              alert('PDF hazırlanamadı: ' + (err.message || ''));
            } finally {
              setIncomePdfBusy(false);
            }
          };
          return (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 border-b border-slate-100 gap-4">
                <div>
                <h3 className="font-bold text-lg text-slate-900">Genel Gelir Gider</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Aylık özet. Üstteki tarih ile ana sayfa Girdi−Çıktı aynı. Nakit; fatura projeye ayrılmaz.
                </p>
                </div>
              <div className="flex flex-wrap items-center gap-2">
                  <button
                  type="button"
                  disabled={incomePdfBusy}
                  onClick={exportPdf}
                  className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Download className="w-4 h-4" />
                  {incomePdfBusy ? 'PDF hazırlanıyor…' : 'PDF'}
                  </button>
                <button
                  type="button"
                  onClick={exportExcel}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-bold flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Excel
                </button>
                      </div>
                      </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 flex flex-col sm:flex-row items-center gap-8">
              <div className="relative w-36 h-36 shrink-0">
                <div
                  className="w-full h-full rounded-full"
                  style={{ background: `conic-gradient(#10b981 0% ${girdiShare}%, #fb7185 ${girdiShare}% 100%)` }}
                />
                <div className="absolute inset-7 rounded-full bg-white flex flex-col items-center justify-center text-center px-2">
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider">NET</span>
                  <span className={`text-sm font-black leading-tight ${periodProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {periodProfit >= 0 ? '+' : ''}{money(periodProfit)}
                  </span>
                    </div>
                </div>
              <div className="flex-1 w-full space-y-5">
                <div>
                  <div className="flex justify-between items-baseline text-xs font-bold mb-1.5">
                    <span className="text-emerald-700 uppercase tracking-wider">Girdi</span>
                    <span className="text-emerald-800 text-sm tabular-nums">{money(girdi)} ₺</span>
              </div>
                  <div className="h-4 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(girdi / barMax) * 100}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-baseline text-xs font-bold mb-1.5">
                    <span className="text-rose-700 uppercase tracking-wider">Çıktı</span>
                    <span className="text-rose-800 text-sm tabular-nums">{money(cikti)} ₺</span>
                  </div>
                  <div className="h-4 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full rounded-full bg-rose-400" style={{ width: `${(cikti / barMax) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>
            {(() => {
              const pieColors = ['#2563eb', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#f97316', '#64748b'];
              let pieAcc = 0;
              const pieStops = giderKalemOzet.rows.map((r, i) => {
                const pct = giderKalemOzet.total > 0 ? (r.amount / giderKalemOzet.total) * 100 : 0;
                const from = pieAcc;
                pieAcc += pct;
                return { ...r, color: pieColors[i % pieColors.length], from, to: pieAcc, pct };
              });
              const pieCss = pieStops.length
                ? `conic-gradient(${pieStops.map(s => `${s.color} ${s.from.toFixed(2)}% ${s.to.toFixed(2)}%`).join(', ')})`
                : '#e2e8f0';
              const kalanKalem = [
                { label: 'Alt yüklenici', amount: unpaidSubcontractorNet, color: '#1d4ed8' },
                { label: 'Devlet / vergi', amount: totalGovernmentPaymentsDebt, color: '#b45309' },
                { label: 'Açık genel gider', amount: totalGeneralCompanyExpensesDebt, color: '#be123c' },
                { label: 'Personel', amount: totalEmployeeFutureDebt, color: '#0f766e' }
              ].filter(k => k.amount > 0.009);
              const kalanMax = Math.max(...kalanKalem.map(k => k.amount), 1);
              return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 p-5 flex flex-col justify-center min-h-[180px]">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Net</span>
                <div className={`text-3xl sm:text-4xl font-black tabular-nums mt-2 ${periodProfit >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
                  {periodProfit >= 0 ? '' : '−'}{money(Math.abs(periodProfit))} ₺
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Satışlar</span>
                    <b className="text-emerald-700 tabular-nums">{money(girdi)} ₺</b>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Giderler</span>
                    <b className="text-rose-700 tabular-nums">{money(cikti)} ₺</b>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Gider dağılımı</span>
                <p className="text-[10px] text-slate-400 mt-0.5">Girilen gider faturaları — nakit, kart ve henüz ödenmemiş.</p>
                <div className="flex items-center gap-4 mt-3">
                  <div className="w-28 h-28 rounded-full shrink-0 border border-slate-100" style={{ background: pieCss }} />
                  <div className="flex-1 space-y-1 min-w-0">
                    {pieStops.slice(0, 6).map(s => (
                      <div key={s.cat} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="flex items-center gap-1.5 min-w-0 truncate">
                          <span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ background: s.color }} />
                          <span className="truncate">{s.label}</span>
                        </span>
                        <span className="tabular-nums text-slate-600 shrink-0">{s.pct.toFixed(0)}%</span>
                      </div>
                    ))}
                    {!pieStops.length && <span className="text-xs text-slate-400">Bu ay genel gider yok.</span>}
                  </div>
                </div>
              </div>
              {kalanKalem.length > 0 && (
                <div className="rounded-2xl border border-slate-200 p-5 lg:col-span-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Açık borçlar (şimdi)</span>
                  <p className="text-[11px] text-slate-400 mt-0.5 mb-3">Aya göre değil; ödenmemiş kalan. Proje ayrımı yok.</p>
                  <div className="space-y-2">
                    {kalanKalem.map(k => (
                      <div key={k.label}>
                        <div className="flex justify-between text-[11px] font-semibold mb-1">
                          <span className="text-slate-700">{k.label}</span>
                          <span className="tabular-nums">{money(k.amount)} ₺</span>
                        </div>
                        <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.max((k.amount / kalanMax) * 100, 3)}%`, background: k.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
              );
            })()}
            <div>
              <div className="flex items-end justify-between gap-3 mb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Genel gider kırılımı</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Girdiğiniz gider türleri (kasa, kart ve henüz ödenmemiş). Maaş ve taşeron yok. Toplam {money(giderKalemOzet.total)} ₺ · kaleme basınca altındaki kayıtlar açılır
                  </p>
                </div>
              </div>
              {giderKalemOzet.rows.length === 0 ? (
                <p className="text-xs text-slate-400 py-4">Bu aralıkta genel gider türünde kasa çıkışı yok.</p>
              ) : (
                <div className="space-y-2">
                  {giderKalemOzet.rows.map(r => {
                    const share = giderKalemOzet.total > 0 ? (r.amount / giderKalemOzet.total) * 100 : 0;
                    const bar = (r.amount / giderKalemOzet.maxAmt) * 100;
                    const on = incomeGiderKalemFilter === r.cat;
                    const detay = on ? giderKalemDetay(r.cat) : [];
                    return (
                      <div
                        key={r.cat}
                        className={`rounded-xl border overflow-hidden ${on ? 'border-rose-300 bg-rose-50' : 'border-slate-100 bg-slate-50'}`}
                      >
                        <button
                          type="button"
                          onClick={() => setIncomeGiderKalemFilter(on ? null : r.cat)}
                          className="w-full text-left px-3 py-2.5 hover:bg-rose-50/80 transition"
                        >
                          <div className="flex items-baseline justify-between gap-3 mb-1.5">
                            <span className="text-xs font-bold text-slate-800">{r.label}</span>
                            <span className="text-xs font-black tabular-nums text-rose-700 whitespace-nowrap">
                              {money(r.amount)} ₺
                              <span className="text-[10px] font-semibold text-slate-400 ml-1.5">{share.toFixed(0)}%</span>
                            </span>
                          </div>
                          <div className="h-2.5 rounded-full bg-white overflow-hidden border border-rose-100">
                            <div className="h-full rounded-full bg-rose-400" style={{ width: `${Math.max(bar, 3)}%` }} />
                          </div>
                        </button>
                        {on && (
                          <div className="border-t border-rose-100 bg-white px-3 py-2 space-y-1.5">
                            {detay.map(d => (
                              <div key={String(d.id)} className="flex items-start justify-between gap-3 text-[11px]">
                                <div className="min-w-0">
                                  <span className="text-slate-400 mr-2 whitespace-nowrap">{d.date}</span>
                                  <span className="text-slate-700">{d.title}</span>
                                  {d.kart ? <span className="ml-1.5 text-purple-600 font-semibold">kart</span> : null}
                                  {!d.odendi ? <span className="ml-1.5 text-amber-600 font-semibold">açık</span> : null}
                                </div>
                                <span className="font-bold tabular-nums text-rose-700 whitespace-nowrap">{money(d.amount)} ₺</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 mb-2">Gelirler ({inLines.length})</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                    <tr>
                      <SortTh label="Tarih" field="date" sort={incomeInSort} onSort={setIncomeInSort} />
                      <SortTh label="Açıklama" field="title" sort={incomeInSort} onSort={setIncomeInSort} />
                      <SortTh label="Tutar" field="amount" sort={incomeInSort} onSort={setIncomeInSort} align="right" firstDir="desc" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inLines.map((l, i) => (
                      <tr key={'in-' + i}>
                        <td className="py-2 px-3 whitespace-nowrap">{l.date}</td>
                        <td className="py-2 px-3">{l.title}</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700">{money(l.amount)} ₺</td>
                        </tr>
                    ))}
                    {!inLines.length && (
                      <tr><td colSpan={3} className="py-6 px-3 text-center text-slate-400">Bu aralıkta kasa girişi yok.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 mb-2">Giderler ({outLines.length})</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                      <SortTh label="Tarih" field="date" sort={incomeOutSort} onSort={setIncomeOutSort} />
                      <SortTh label="Açıklama" field="title" sort={incomeOutSort} onSort={setIncomeOutSort} />
                      <SortTh label="Tutar" field="amount" sort={incomeOutSort} onSort={setIncomeOutSort} align="right" firstDir="desc" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {outLines.map((l, i) => (
                      <tr key={'out-' + i}>
                        <td className="py-2 px-3 whitespace-nowrap">{l.date}</td>
                        <td className="py-2 px-3">{l.title}</td>
                        <td className="py-2 px-3 text-right font-bold text-rose-600">{money(l.amount)} ₺</td>
                      </tr>
                    ))}
                    {!outLines.length && (
                      <tr><td colSpan={3} className="py-6 px-3 text-center text-slate-400">Bu aralıkta kasa çıkışı yok.</td></tr>
                    )}
                </tbody>
              </table>
            </div>
          </div>
          </div>
          );
        })()}

        {/* 10. MÜŞTERİ TAHSİLATLARI */}
        {activeTab === 'collections' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center pb-5 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Müşteri Tahsilatları</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Müşteri tahsilatı ve personel kasasından merkeze alınan Hal nakit. Kasaya para ekle burada yok. Aralık: {filterStartDate && filterEndDate ? `${formatDateTR(filterStartDate)} — ${formatDateTR(filterEndDate)}` : 'tüm dönem'}. Müşteri {periodCustomerReceipts.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  {(() => {
                    const isHalCash = (i: any) => {
                      const id = String(i?.id || '');
                      const no = String(i?.invoice_no || '');
                      return id.startsWith('hal_hand_') || id.startsWith('hal_merkez_') || /^Hal saha teslim /i.test(no) || /^Hal tahsilat /i.test(no);
                    };
                    const hal = cashInRows.filter((i: any) => isHalCash(i) && isDateInRange(i.issue_date)).reduce((s: number, i: any) => s + cleanNumber(i.total_amount), 0);
                    return hal > 0.005 ? ` · Hal kasa ${hal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : '';
                  })()}
                </p>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => setIsNewReceiptModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                  <Coins className="w-4 h-4" /> Manuel Tahsilat Ekle
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <SortTh className="py-3 px-4" label="Makbuz / Dekont No" field="title" sort={collectionSort} onSort={setCollectionSort} />
                    <SortTh className="py-3 px-4" label="Tahsilat Tarihi" field="date" sort={collectionSort} onSort={setCollectionSort} firstDir="desc" />
                    <th className="py-3 px-4">Durum</th>
                    <SortTh className="py-3 px-4" label="Tahsil Edilen Tutar" field="amount" sort={collectionSort} onSort={setCollectionSort} align="right" firstDir="desc" />
                    {isAdmin && <th className="py-3 px-4 text-center">İşlem</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortByColumn(
                    (() => {
                      const seen = new Set<string>();
                      const rows: any[] = [];
                      const push = (inv: any) => {
                        const id = String(inv?.id || inv?.invoice_no || '');
                        if (!id || seen.has(id)) return;
                        if (!isDateInRange(inv.issue_date || inv.created_at)) return;
                        seen.add(id);
                        rows.push(inv);
                      };
                      cashInRows.filter(i => {
                        const id = String(i?.id || '');
                        const no = String(i?.invoice_no || '');
                        const hal = id.startsWith('hal_hand_') || id.startsWith('hal_merkez_') || /^Hal saha teslim /i.test(no) || /^Hal tahsilat /i.test(no);
                        return i.category !== 'cash_deposit' || hal;
                      }).forEach(push);
                      (dbInvoices || []).forEach((i: any) => {
                        if (isCrcTahsilatDoc(i) && !looksLikeSalesInvoiceNo(i.invoice_no)) push(i);
                      });
                      return rows;
                    })(),
                    collectionSort,
                    {
                      title: (i: any) => String(i.invoice_no || ''),
                      date: (i: any) => sanitizeDate(i.issue_date),
                      amount: (i: any) => cleanNumber(i.total_amount)
                    }
                  ).map((item) => {
                    const lockedBank = String(item.id || '').startsWith('migros_bank_');
                    const lockedHal = String(item.id || '').startsWith('hal_hand_') || String(item.id || '').startsWith('hal_merkez_') || /^Hal saha teslim /i.test(String(item.invoice_no || '')) || /^Hal tahsilat /i.test(String(item.invoice_no || ''));
                    return (
                    <tr key={String(item.id)} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">{item.invoice_no}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {isAdmin && !lockedBank && !lockedHal ? (
                          <input
                            type="date"
                            defaultValue={sanitizeDate(item.issue_date)}
                            key={`${item.id}-${sanitizeDate(item.issue_date)}`}
                            onBlur={e => handleUpdateReceiptDate(item, e.target.value)}
                            className="px-2 py-1 border border-slate-200 rounded-lg bg-white text-xs font-semibold"
                            title="Paranın bankaya girdiği gün"
                          />
                        ) : (
                          formatDateTR(item.issue_date)
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`${lockedHal ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'} text-[11px] px-2.5 py-0.5 rounded-full font-semibold`}>
                          {lockedBank ? 'Banka ekstresi' : lockedHal ? 'Hal kasa' : 'Tahsil edildi'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 text-sm">
                        +{cleanNumber(item.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-center">
                          {lockedBank || lockedHal ? (
                            <span className="text-[10px] text-slate-400">Kilitli</span>
                          ) : (
                          <button
                            onClick={() => handleDeleteReceipt(item)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Tahsilatı Sil ve Faturayı Geri Aç">
                            <Trash2 className="w-4 h-4" />
                          </button>
                          )}
                        </td>
                      )}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 11. GENEL GİDERLER & TEDARİK */}
        {activeTab === 'general_expenses' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Genel Giderler & Tedarikçi Borçları</h3>
                <p className="text-xs text-slate-500 mt-0.5">Bakım, yedek parça, lastik, vergi, hamaliye/harcırah/işçilik ve fiili masraf dökümü.</p>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => {
                    setEditingExpenseId(null);
                    setExpenseFormData({
                      category: 'maintenance',
                      companyName: '',
                      plateNumber: '',
                      vehicleCharge: '',
                      invoiceNo: '',
                      amount: '',
                      issueDate: new Date().toISOString().split('T')[0],
                      dueDate: new Date().toISOString().split('T')[0],
                      status: 'unpaid',
                      paidSource: 'bank'
                    });
                    setIsGeneralExpenseModalOpen(true);
                  }}
                  className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                  <Plus className="w-4 h-4" /> Yeni Gider / Fatura Ekle
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <PortalInput
                  type="text"
                  placeholder="Açıklama veya belge ile filtrele..."
                  value={expenseSearchTerm}
                  onChange={(e) => setExpenseSearchTerm(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <select
                value={expenseCategoryFilter}
                onChange={(e: any) => setExpenseCategoryFilter(e.target.value)}
                className="w-full sm:w-56 text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Tüm gider türleri</option>
                <option value="hamaliye_labor">Hamaliye / Harcırah / İşçilik</option>
                <option value="office_expense">Ofis & Kırtasiye</option>
                <option value="rent_utility">Kira, elektrik, su</option>
                <option value="software_telecom">Yazılım / bilişim</option>
                <option value="advocate_consulting">Avukat / danışmanlık</option>
                <option value="cargo_stationery">Kargo / noter</option>
                <option value="general_expense">Genel şirket masrafı</option>
                <option value="owner_personal">Şirket dışı harcama</option>
                <option value="maintenance">Tamir / bakım</option>
                <option value="tires">Lastik / yedek parça</option>
                <option value="general_fuel">Akaryakıt</option>
                <option value="traffic_fines">Trafik cezası</option>
                <option value="insurance_inspection">Muayene / sigorta</option>
                <option value="hgs">HGS / OGS</option>
                <option value="taxes_sgk">Vergi / SGK</option>
                <option value="bank_commission">Banka masrafı</option>
                <option value="supplier_advance">Tedarikçi avansı</option>
              </select>
              <select
                value={expenseStatusFilter}
                onChange={(e: any) => setExpenseStatusFilter(e.target.value)}
                className="w-full sm:w-52 text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:border-blue-500"
              >
                <option value="unpaid">Ödenecekler</option>
                <option value="paid">Ödenenler</option>
                <option value="all">Tümü</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th
                      className="py-3 px-4 cursor-pointer select-none hover:text-blue-600"
                      onClick={() => {
                        if (expenseSortField === 'invoice_no') setExpenseSortOrder(expenseSortOrder === 'asc' ? 'desc' : 'asc');
                        else { setExpenseSortField('invoice_no'); setExpenseSortOrder('asc'); }
                      }}
                    >
                      Açıklama / Belge {expenseSortField === 'invoice_no' ? (expenseSortOrder === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="py-3 px-4">Tür</th>
                    <th
                      className="py-3 px-4 cursor-pointer select-none hover:text-blue-600"
                      onClick={() => {
                        if (expenseSortField === 'issue_date') setExpenseSortOrder(expenseSortOrder === 'asc' ? 'desc' : 'asc');
                        else { setExpenseSortField('issue_date'); setExpenseSortOrder('desc'); }
                      }}
                    >
                      Tarih {expenseSortField === 'issue_date' ? (expenseSortOrder === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="py-3 px-4">Durum</th>
                    <th
                      className="py-3 px-4 text-right cursor-pointer select-none hover:text-blue-600"
                      onClick={() => {
                        if (expenseSortField === 'total_amount') setExpenseSortOrder(expenseSortOrder === 'asc' ? 'desc' : 'asc');
                        else { setExpenseSortField('total_amount'); setExpenseSortOrder('desc'); }
                      }}
                    >
                      Tutar {expenseSortField === 'total_amount' ? (expenseSortOrder === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    {isAdmin && <th className="py-3 px-4 text-center">İşlem</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleGeneralExpenses.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 6 : 5} className="py-8 px-4 text-center text-slate-400">
                        {expenseStatusFilter === 'unpaid' ? 'Ödenecek gider yok.' : 'Kayıt yok.'}
                      </td>
                    </tr>
                  )}
                  {visibleGeneralExpenses.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-medium text-slate-800">{item.invoice_no}</td>
                      <td className="py-3 px-4 text-slate-500">{expenseCategoryLabel(String(item.category || ''))}</td>
                      <td className="py-3 px-4 text-slate-600">{formatDateTR(item.issue_date)}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${item.status === 'paid' ? (isExpensePaidByCard(item) ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800') : 'bg-rose-100 text-rose-800'}`}>
                          {item.status === 'paid' ? (isExpensePaidByCard(item) ? 'Kartla ödendi' : 'Kasa / banka') : 'Ödenecek'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 text-sm">
                        {cleanNumber(item.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-center space-x-2">
                          <button 
                            onClick={() => {
                              setEditingExpenseId(item.id);
                              const tagged = lastExpensePlateTag(item.invoice_no);
                              const veh = (dbVehicles || []).find((v: any) => cleanPlateKey(v.plate_number) === tagged);
                              setExpenseFormData({
                                category: item.category || 'maintenance',
                                companyName: stripExpensePlateTags(item.invoice_no || ''),
                                plateNumber: veh ? String(veh.plate_number || '') : tagged,
                                vehicleCharge: inferVehicleChargeKind(item) || '',
                                invoiceNo: '',
                                amount: String(item.total_amount || ''),
                                issueDate: sanitizeDate(item.issue_date),
                                dueDate: sanitizeDate(item.due_date),
                                status: item.status || 'unpaid',
                                paidSource: isExpensePaidByCard(item) ? 'card' : 'bank'
                              });
                              setIsGeneralExpenseModalOpen(true);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition" title="Düzenle">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={async () => {
                              if (window.confirm(`${item.invoice_no} kaydını silmek istiyor musunuz?`)) {
                                await supabase.from('invoices').delete().eq('id', item.id);
                                loadPortalData();
                              }
                            }}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition" title="Sil">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      
      {/* MODAL: PERSONEL EKLE & DÜZENLE (PRİM / EK MASRAF DESTEKLİ) */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => setIsEmployeeModalOpen(false))}>
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">{editingEmployeeId ? 'Personeli Düzenle' : 'Yeni Personel Ekle'}</h3>
              <button onClick={() => setIsEmployeeModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveEmployee} className="mt-4 space-y-3 text-sm">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Adı Soyadı</label>
                <PortalInput type="text" placeholder="Örn: Ahmet Yılmaz" value={employeeFormData.fullName} onChange={e => setEmployeeFormData({ ...employeeFormData, fullName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Görevi</label>
                  <select 
                    value={employeeFormData.roleTitle} 
                    onChange={e => setEmployeeFormData({ ...employeeFormData, roleTitle: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-medium">
                    <option value="Kamyon Şoförü / Dağıtım">Kamyon Şoförü / Dağıtım</option>
                    <option value="Kamyon Şoförü (10 Palet)">Kamyon Şoförü (10 Palet)</option>
                    <option value="Tır Kaptanı / Frigo">Tır Kaptanı / Frigo</option>
                    <option value="Muhasebe & Finans">Muhasebe & Finans</option>
                    <option value="Operasyon Sorumlusu">Operasyon Sorumlusu</option>
                    <option value="Yönetici / İdari İşler">Yönetici / İdari İşler</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Aylık Sabit Maaş</label>
                  <PortalInput type="text" placeholder="56000" value={employeeFormData.baseSalary} onChange={e => setEmployeeFormData({ ...employeeFormData, baseSalary: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-indigo-700" required />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">İşe giriş tarihi</label>
                <input
                  type="date"
                  value={employeeFormData.hireDate}
                  onChange={e => setEmployeeFormData({ ...employeeFormData, hireDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
                <p className="text-[10px] text-slate-400 mt-1">Yıl doğru olsun (5.11.2026 → 2026). Girişten önceki aylara maaş yok. Giriş ayı: (ayın gün sayısı − giriş günü + 1) / ay günü × maaş. Örn. 5 Kasım, 45.000 → 26/30 × 45.000 = 39.000, 1 Aralık’ta cariye yazılır.</p>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">SGK işveren maliyeti (aylık)</label>
                <PortalInput
                  type="text"
                  placeholder="11148"
                  value={employeeFormData.employerSgk}
                  onChange={e => setEmployeeFormData({ ...employeeFormData, employerSgk: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-800"
                />
                <p className="text-[10px] text-slate-400 mt-1">Asgari ücret / tarife değişince bu kişiyi düzenleyip yeni tutarı yazın. Öz mal kârlılık bu alanı kullanır.</p>
              </div>
          
   {/* PERSONEL CARİ HAREKETLERİ (ÇOKLU PRİM, ÇOKLU TEKİL AVANS, ÇOKLU TAKSİTLİ AVANS YÖNETİMİ) */}
              {editingEmployeeId && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">Personel Cari & Hakediş Defteri</span>
                      <span className="text-[10px] text-slate-500">Liste en yeni üstte. Ayın 1’inde oluşan maaş otomatik satırdır (silinmez). Prim/avans buradan, ödeme Öde ile.</span>
                    </div>
                  </div>
                  {(() => {
                    const empObj = (dbEmployees || []).find((e: any) => String(e.id) === String(editingEmployeeId));
                    if (!empObj) return null;
                    const books = employeeBooksBreakdown(empObj);
                    const closedLabel = yearMonthTrLabel(books.closed);
                    return (
                      <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1">
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">Sabit maaş (kapanmış aylar, son {closedLabel})</span>
                          <span className="font-bold text-slate-800">+{books.closedHak.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">Prim − avans (Ekim’den beri)</span>
                          <span className="font-bold text-slate-800">{(books.bonus - books.advanceCut).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">Ödenen</span>
                          <span className="font-bold text-emerald-700">−{books.paid.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                        </div>
                        <div className="flex justify-between gap-2 pt-1 border-t border-slate-100">
                          <span className="font-semibold text-slate-700">Cari</span>
                          <span className={`font-extrabold ${books.balance < -0.009 ? 'text-rose-700' : 'text-emerald-800'}`}>
                            {books.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                 {/* 1. HIZLI HAREKET EKLEME PANELİ (TARİH SEÇİCİLİ) */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                    <div>
                      <span className="text-sm font-bold text-slate-800 block">Yeni hareket ekle</span>
                      <span className="text-xs text-slate-500">Prim, münferit avans veya taksitli avans. Taksit sayısı yalnızca taksitli avansta kullanılır.</span>
                    </div>
                    <div
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                      onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
                    >
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">İşlem türü</label>
                        <select
                          value={newEmpTx.type}
                          onChange={e => setNewEmpTx({ ...newEmpTx, type: e.target.value as typeof newEmpTx.type })}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white font-medium"
                        >
                          <option value="bonus">Sefer / prim (maaşa ek)</option>
                          <option value="advance">Münferit avans (tek sefer kesilir)</option>
                          <option value="installment_advance">Taksitli avans (aylara bölünür)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Tarih</label>
                        <input
                          type="date"
                          value={newEmpTx.date}
                          onChange={e => setNewEmpTx({ ...newEmpTx, date: e.target.value })}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-700"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Açıklama</label>
                        <PortalInput
                          type="text"
                          value={newEmpTx.title}
                          onChange={e => setNewEmpTx({ ...newEmpTx, title: e.target.value })}
                          placeholder="Örn: Ankara seferi, ramazan avansı"
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Tutar (TL)</label>
                        <PortalInput
                          type="text"
                          value={newEmpTx.amount}
                          onChange={e => setNewEmpTx({ ...newEmpTx, amount: e.target.value })}
                          placeholder="5000"
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Taksit sayısı</label>
                        <select
                          value={newEmpTx.inst}
                          onChange={e => setNewEmpTx({ ...newEmpTx, inst: e.target.value })}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white"
                        >
                          <option value="1">1 (tek sefer)</option>
                          <option value="2">2 ay</option>
                          <option value="3">3 ay</option>
                          <option value="4">4 ay</option>
                          <option value="5">5 ay</option>
                          <option value="6">6 ay</option>
                        </select>
                      </div>
                    </div>
                        <button
                          type="button"
                          onClick={async () => {
                        if (!editingEmployeeId) return;
                        await handleAddEmployeeTransaction(
                          editingEmployeeId,
                          newEmpTx.type,
                          newEmpTx.title,
                          cleanNumber(newEmpTx.amount),
                          Number(newEmpTx.inst) || 1,
                          newEmpTx.date
                        );
                      }}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition"
                    >
                      Hareketi kaydet
                        </button>
                  </div>
                  {/* 2. KAYITLI CARİ HAREKETLER LİSTESİ */}
                  {(() => {
                    const empObj = (dbEmployees || []).find((e: any) => String(e.id) === String(editingEmployeeId));
                    const empName = empObj ? (empObj.full_name || '').toLowerCase().trim() : '';
                    const empIdStr = String(editingEmployeeId || '');
                    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
                    const firstOfNextMonth = (ym: string) => {
                      let [y, m] = ym.split('-').map(Number);
                      m += 1;
                      if (m > 12) {
                        m = 1;
                        y += 1;
                      }
                      return `${y}-${pad(m)}-01`;
                    };
                    type CariLine = {
                      key: string;
                      date: string;
                      kind: 'salary' | 'tx' | 'pay' | 'adv';
                      label: string;
                      title: string;
                      amount: number;
                      plus: boolean;
                      onDelete?: () => void;
                      extra?: string;
                    };
                    const lines: CariLine[] = [];
                    if (empObj) {
                      const from = employeeBooksFromYm(empObj);
                      const closed = personnelClosedYearMonth();
                      if (closed >= from) {
                        yearMonthsBetween(from, closed).forEach(ym => {
                          const amt = employeePayForMonth(empObj, ym).base;
                          if (amt <= 0.009) return;
                          lines.push({
                            key: 'sal-' + ym,
                            date: firstOfNextMonth(ym),
                            kind: 'salary',
                            label: 'MAAŞ',
                            title: `${yearMonthTrLabel(ym)} sözleşmeli maaş`,
                            amount: amt,
                            plus: true
                          });
                        });
                      }
                    }
                    (dbEmployeeTransactions || []).forEach((tx: any) => {
                      if (String(tx.employee_id) !== empIdStr) return;
                      const d = sanitizeDate(tx.transaction_date || tx.created_at);
                      const ym = d.slice(0, 7);
                      if (ym && ym < personnelBooksStartYm) return;
                      const isBonus = tx.type === 'bonus';
                      const isInst = tx.type === 'installment_advance';
                      const totAmt = cleanNumber(tx.total_amount);
                      const mCut = cleanNumber(tx.monthly_cut || Math.round(totAmt / Math.max(1, tx.installment_count || 1)));
                      lines.push({
                        key: 'tx-' + tx.id,
                        date: d,
                        kind: 'tx',
                        label: isBonus ? 'PRİM' : isInst ? `TAKSİT (${tx.installment_count} Ay)` : 'MÜNFERİT AVANS',
                        title: tx.title || (isBonus ? 'Prim' : 'Avans'),
                        amount: totAmt,
                        plus: isBonus,
                        extra: isInst ? `(Aylık kesinti: ${mCut.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺)` : '',
                        onDelete: () => handleDeleteEmployeeTransaction(tx.id)
                      });
                    });
                    (dbAdvances || []).forEach((a: any) => {
                      if (a.target_type !== 'employee') return;
                      const ym = sanitizeDate(a.issue_date || a.created_at).slice(0, 7);
                      if (ym && ym < personnelBooksStartYm) return;
                      const tName = String(a.target_name || '').toLowerCase().trim();
                      const tId = String(a.target_id || '');
                      if (!((tId && tId === empIdStr) || (tName.length >= 3 && (tName.includes(empName) || empName.includes(tName))))) return;
                      const isBonus = a.payment_type === 'employee_bonus';
                      const amt = cleanNumber(a.remaining_amount !== undefined ? a.remaining_amount : a.total_amount);
                      lines.push({
                        key: 'adv-' + a.id,
                        date: sanitizeDate(a.issue_date || a.created_at),
                        kind: 'adv',
                        label: isBonus ? 'KASA PRİM' : 'KASA AVANS',
                        title: a.description || a.reason || 'Kasa hareketi',
                        amount: amt,
                        plus: isBonus,
                        onDelete: () => handleDeleteAdvanceRecord(a.id)
                      });
                    });
                    (dbInvoices || []).forEach((inv: any) => {
                      if (!empObj || !salaryPayrollMatchesEmployee(inv, empObj)) return;
                      const d = sanitizeDate(inv.issue_date || inv.created_at);
                      if (!d || d < `${personnelBooksStartYm}-01`) return;
                      lines.push({
                        key: 'pay-' + inv.id,
                        date: d,
                        kind: 'pay',
                        label: 'ÖDEME',
                        title: inv.invoice_no || 'Maaş / hakediş ödemesi',
                        amount: cleanNumber(inv.total_amount),
                        plus: false,
                        onDelete: () => handleDeleteSalaryPayroll(inv.id)
                      });
                    });
                    lines.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.key.localeCompare(b.key));
                    if (!lines.length) {
                      return <p className="text-[11px] text-slate-400 italic py-1 text-center bg-white rounded-lg border border-dashed border-slate-200">Henüz girilmiş bir cari hareket bulunmuyor.</p>;
                    }
                    return (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {lines.map(line => {
                          const badge =
                            line.kind === 'salary' ? 'bg-sky-100 text-sky-800' :
                            line.kind === 'pay' ? 'bg-emerald-100 text-emerald-800' :
                            line.plus ? 'bg-amber-100 text-amber-800' :
                            line.label.startsWith('TAKSİT') ? 'bg-purple-100 text-purple-800' :
                            'bg-rose-100 text-rose-800';
                          const amtCls =
                            line.kind === 'salary' ? 'text-sky-800' :
                            line.kind === 'pay' ? 'text-emerald-700' :
                            line.plus ? 'text-amber-700' :
                            'text-rose-700';
                          return (
                            <div key={line.key} className={`flex items-center justify-between gap-3 p-3 bg-white rounded-lg border text-sm shadow-xs ${line.kind === 'salary' ? 'border-sky-200' : line.kind === 'pay' ? 'border-emerald-200' : 'border-slate-200'}`}>
                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${badge}`}>{line.label}</span>
                                <span className="font-medium text-slate-700">{line.title}</span>
                                <span className="text-[10px] text-slate-400">{formatDateTR(line.date)}</span>
                                {line.extra ? <span className="text-[10px] text-purple-600 font-semibold">{line.extra}</span> : null}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`font-bold ${amtCls}`}>
                                  {line.plus ? '+' : '−'}{line.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                                </span>
                                {line.onDelete ? (
                                  <button
                                    type="button"
                                    onClick={line.onDelete}
                                    className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition font-bold text-xs"
                                    title="Sil"
                                  >
                                    ✕
                                  </button>
                                ) : (
                                  <span className="w-5 text-center text-[9px] text-slate-300" title="Otomatik, silinmez">•</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
              
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cep Telefonu</label>
                <PortalInput 
                  type="text" 
                  placeholder="05XX XXX XX XX" 
                  value={employeeFormData.phone} 
                  onChange={e => setEmployeeFormData({ ...employeeFormData, phone: formatPhone(e.target.value) })} 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium" 
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">IBAN Numarası</label>
                <PortalInput type="text" placeholder="TR87 0006 ..." value={employeeFormData.iban} onChange={e => setEmployeeFormData({ ...employeeFormData, iban: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-medium" />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsEmployeeModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-blue-600 text-white font-medium">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TAŞERONA MANUEL ÖDEME / AVANS YAP */}
      {isSubPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => setIsSubPaymentModalOpen(false))}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Alt yükleniciye avans ver</h3>
              <button onClick={() => setIsSubPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveSubPayment} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alt Yüklenici / Taşeron Seçin</label>
                <select 
                  value={subPaymentFormData.subcontractorName} 
                  onChange={e => setSubPaymentFormData({ ...subPaymentFormData, subcontractorName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white" required>
                  <option value="">-- Taşeron Seçiniz --</option>
                  {dbSubcontractors.map(s => (
                    <option key={s.id} value={s.company_name || s.name}>{s.company_name || s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">İşlem Türü</label>
                <select 
                  value={subPaymentFormData.actionType} 
                  onChange={e => setSubPaymentFormData({ ...subPaymentFormData, actionType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-medium">
                  <option value="advance">Peşin avans</option>
                  <option value="installment_advance">Taksitli avans</option>
                </select>
              </div>

              {subPaymentFormData.actionType === 'installment_advance' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Taksit Sayısı</label>
                  <select 
                    value={subPaymentFormData.installmentCount} 
                    onChange={e => setSubPaymentFormData({ ...subPaymentFormData, installmentCount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-bold text-blue-700">
                    <option value="2">2 Taksit</option>
                    <option value="3">3 Taksit</option>
                    <option value="4">4 Taksit</option>
                    <option value="5">5 Taksit</option>
                    <option value="6">6 Taksit</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tutar (TL)</label>
                  <PortalInput 
                    type="text" 
                    placeholder="50000" 
                    value={subPaymentFormData.amount} 
                    onChange={e => setSubPaymentFormData({ ...subPaymentFormData, amount: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-rose-600 text-sm" 
                    required 
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">İşlem Tarihi</label>
                  <input 
                    type="date" 
                    value={subPaymentFormData.date} 
                    onChange={e => setSubPaymentFormData({ ...subPaymentFormData, date: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white" 
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ödeme Yapılan Hesap</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setSubPaymentFormData({ ...subPaymentFormData, targetAccount: 'bank' })} className={`p-2 rounded-lg border text-center transition ${subPaymentFormData.targetAccount === 'bank' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200'}`}>🏦 Banka Hesabı</button>
                  <button type="button" onClick={() => setSubPaymentFormData({ ...subPaymentFormData, targetAccount: 'cash' })} className={`p-2 rounded-lg border text-center transition ${subPaymentFormData.targetAccount === 'cash' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200'}`}>💵 Elden Kasa</button>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsSubPaymentModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-emerald-600 text-white font-medium">Avansı kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANUEL TAŞERON HAKEDİŞ FATURASI EKLE */}
      {isManualSubInvoiceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => setIsManualSubInvoiceModalOpen(false))}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Manuel Hakediş / Fatura Ekle</h3>
              <button onClick={() => setIsManualSubInvoiceModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveManualSubInvoice} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alt Yüklenici / Taşeron Adı</label>
                <PortalInput 
                  type="text" 
                  placeholder="Örn: Umut Nakliyat" 
                  value={manualSubInvoiceData.subcontractorName} 
                  onChange={e => setManualSubInvoiceData({ ...manualSubInvoiceData, subcontractorName: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg" 
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fatura Numarası</label>
                  <PortalInput 
                    type="text" 
                    placeholder="GIB2026..." 
                    value={manualSubInvoiceData.invoiceNo} 
                    onChange={e => setManualSubInvoiceData({ ...manualSubInvoiceData, invoiceNo: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-medium" 
                    required 
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Toplam Tutar (TL)</label>
                  <PortalInput 
                    type="text" 
                    placeholder="125000" 
                    value={manualSubInvoiceData.totalAmount} 
                    onChange={e => setManualSubInvoiceData({ ...manualSubInvoiceData, totalAmount: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-900" 
                    required 
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-600">Fatura Tarihi</label>
                  <input type="date" value={manualSubInvoiceData.issueDate} onChange={e => {
                    const issueDate = e.target.value;
                    const dates = defaultContractorTermDates(issueDate);
                    setManualSubInvoiceData({
                      ...manualSubInvoiceData,
                      issueDate,
                      term1DueDate: dates.term1 || manualSubInvoiceData.term1DueDate,
                      term2DueDate: dates.term2 || manualSubInvoiceData.term2DueDate
                    });
                  }} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white text-[11px]" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-600">1 nci ödeme (Yarısı)</label>
                  <input type="date" value={manualSubInvoiceData.term1DueDate} onChange={e => setManualSubInvoiceData({ ...manualSubInvoiceData, term1DueDate: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white text-[11px]" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-600">2 nci ödeme (Kalan)</label>
                  <input type="date" value={manualSubInvoiceData.term2DueDate} onChange={e => setManualSubInvoiceData({ ...manualSubInvoiceData, term2DueDate: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white text-[11px]" />
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsManualSubInvoiceModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-blue-600 text-white font-medium">Hakedişi Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ALT YÜKLENİCİ KARTI */}
      {isSubIbanModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => setIsSubIbanModalOpen(false))}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">{editingSubIbanId ? 'Alt yüklenici düzenle' : 'Yeni alt yüklenici'}</h3>
              <button onClick={() => setIsSubIbanModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveSubIban} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Unvan</label>
                <PortalInput type="text" placeholder="Örn: Ahmet Aksu" value={subIbanFormData.name} onChange={e => setSubIbanFormData({ ...subIbanFormData, name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
              <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vergi no</label>
                  <PortalInput type="text" value={subIbanFormData.tax_no} onChange={e => setSubIbanFormData({ ...subIbanFormData, tax_no: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Telefon</label>
                  <PortalInput type="text" value={subIbanFormData.phone} onChange={e => setSubIbanFormData({ ...subIbanFormData, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">IBAN</label>
                <PortalInput type="text" placeholder="TR87 0006 ..." value={subIbanFormData.iban} onChange={e => setSubIbanFormData({ ...subIbanFormData, iban: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-medium" />
                <p className="text-[10px] text-slate-400 mt-1">Boş bırakılabilir; banka talimatında IBAN eksik uyarısı çıkar.</p>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsSubIbanModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-[#009fe3] text-white font-medium">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isOutflowPickerOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => setIsOutflowPickerOpen(false))}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Gider / avans gir</h3>
              <button type="button" onClick={() => setIsOutflowPickerOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-500 mt-3 mb-3">Ne gireceğinizi seçin. Müşteri avansı buradan açılmaz.</p>
            <div className="space-y-2">
              {canEditMod('general_expenses') && (
                <button type="button" onClick={openNewExpenseFromOverview} className="w-full text-left p-3 rounded-xl border border-slate-200 hover:bg-slate-50">
                  <span className="block font-bold text-slate-900 text-sm">Normal gider / e-fatura</span>
                  <span className="text-[11px] text-slate-500">Ofis, filo, vergi… Kart veya kasa. Tedarikçi avansı varsa mahsup sorulur.</span>
                </button>
              )}
              {canEditMod('general_expenses') && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOutflowPickerOpen(false);
                    setSupplierAdvanceForm({ ...emptySupplierAdvance, date: new Date().toISOString().split('T')[0] });
                    setIsSupplierAdvanceModalOpen(true);
                  }}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 hover:bg-slate-50"
                >
                  <span className="block font-bold text-slate-900 text-sm">Tedarikçi avansı</span>
                  <span className="text-[11px] text-slate-500">Para şimdi çıkar. E-fatura gelince kalanı ödersiniz.</span>
                </button>
              )}
              {canEditMod('employees') && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOutflowPickerOpen(false);
                    setOverviewEmpAdvance({
                      empId: '',
                      type: 'advance',
                      date: new Date().toISOString().split('T')[0],
                      title: 'Personel avansı',
                      amount: '',
                      inst: '1',
                      paidSource: 'bank'
                    });
                    setIsOverviewEmpAdvanceOpen(true);
                  }}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 hover:bg-slate-50"
                >
                  <span className="block font-bold text-slate-900 text-sm">Personel avansı</span>
                  <span className="text-[11px] text-slate-500">Peşin veya taksitli. Bordrodan düşer, kasa çıkar.</span>
                </button>
              )}
              {canEditMod('subcontractors') && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOutflowPickerOpen(false);
                    openContractorAdvance();
                  }}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 hover:bg-slate-50"
                >
                  <span className="block font-bold text-slate-900 text-sm">Alt yüklenici avansı</span>
                  <span className="text-[11px] text-slate-500">Mevcut taşeron avans motoru. Hakedişten mahsup.</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isSupplierAdvanceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => setIsSupplierAdvanceModalOpen(false))}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Tedarikçi avansı</h3>
              <button type="button" onClick={() => setIsSupplierAdvanceModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveSupplierAdvance} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tedarikçi / firma adı</label>
                <PortalInput
                  type="text"
                  required
                  placeholder="Örn: Brisa Lastikçilik"
                  value={supplierAdvanceForm.companyName}
                  onChange={e => setSupplierAdvanceForm({ ...supplierAdvanceForm, companyName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
                <p className="text-[10px] text-slate-400 mt-1">E-fatura girerken aynı adı yazın ki mahsup eşleşsin.</p>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Avans türü</label>
                <select
                  value={supplierAdvanceForm.actionType}
                  onChange={e => setSupplierAdvanceForm({ ...supplierAdvanceForm, actionType: e.target.value as typeof supplierAdvanceForm.actionType })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="advance">Peşin avans</option>
                  <option value="installment_advance">Taksitli avans</option>
                </select>
              </div>
              {supplierAdvanceForm.actionType === 'installment_advance' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Taksit sayısı</label>
                  <select
                    value={supplierAdvanceForm.installmentCount}
                    onChange={e => setSupplierAdvanceForm({ ...supplierAdvanceForm, installmentCount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                    <option value="6">6</option>
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tutar (TL)</label>
                  <PortalInput
                    type="text"
                    required
                    value={supplierAdvanceForm.amount}
                    onChange={e => setSupplierAdvanceForm({ ...supplierAdvanceForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-rose-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tarih</label>
                  <input
                    type="date"
                    value={supplierAdvanceForm.date}
                    onChange={e => setSupplierAdvanceForm({ ...supplierAdvanceForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ödeme kaynağı</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['bank', 'Banka'],
                    ['cash', 'Kasa'],
                    ['card', 'Kart']
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSupplierAdvanceForm({ ...supplierAdvanceForm, paidSource: id })}
                      className={`p-2 rounded-lg border text-center ${supplierAdvanceForm.paidSource === id ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Not (isteğe bağlı)</label>
                <PortalInput
                  type="text"
                  value={supplierAdvanceForm.note}
                  onChange={e => setSupplierAdvanceForm({ ...supplierAdvanceForm, note: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsSupplierAdvanceModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-emerald-600 text-white font-medium">Avansı kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isOverviewEmpAdvanceOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => setIsOverviewEmpAdvanceOpen(false))}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Personel avansı</h3>
              <button type="button" onClick={() => setIsOverviewEmpAdvanceOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form
              className="mt-4 space-y-3 text-xs"
              onSubmit={async e => {
                e.preventDefault();
                const ok = await handleAddEmployeeTransaction(
                  overviewEmpAdvance.empId,
                  overviewEmpAdvance.type,
                  overviewEmpAdvance.title,
                  cleanNumber(overviewEmpAdvance.amount),
                  Number(overviewEmpAdvance.inst) || 1,
                  overviewEmpAdvance.date,
                  false,
                  overviewEmpAdvance.paidSource
                );
                if (ok) setIsOverviewEmpAdvanceOpen(false);
              }}
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Personel</label>
                <select
                  required
                  value={overviewEmpAdvance.empId}
                  onChange={e => setOverviewEmpAdvance({ ...overviewEmpAdvance, empId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">-- Personel seçin --</option>
                  {(dbEmployees || []).map((emp: any) => (
                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tür</label>
                <select
                  value={overviewEmpAdvance.type}
                  onChange={e => setOverviewEmpAdvance({ ...overviewEmpAdvance, type: e.target.value as typeof overviewEmpAdvance.type })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="advance">Peşin avans</option>
                  <option value="installment_advance">Taksitli avans</option>
                </select>
              </div>
              {overviewEmpAdvance.type === 'installment_advance' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Taksit sayısı</label>
                  <input
                    type="number"
                    min={2}
                    value={overviewEmpAdvance.inst}
                    onChange={e => setOverviewEmpAdvance({ ...overviewEmpAdvance, inst: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              )}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Açıklama</label>
                <PortalInput
                  type="text"
                  required
                  value={overviewEmpAdvance.title}
                  onChange={e => setOverviewEmpAdvance({ ...overviewEmpAdvance, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tutar (TL)</label>
                  <PortalInput
                    type="text"
                    required
                    value={overviewEmpAdvance.amount}
                    onChange={e => setOverviewEmpAdvance({ ...overviewEmpAdvance, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-rose-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tarih</label>
                  <input
                    type="date"
                    value={overviewEmpAdvance.date}
                    onChange={e => setOverviewEmpAdvance({ ...overviewEmpAdvance, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ödeme kaynağı</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['bank', 'Banka'],
                    ['cash', 'Kasa'],
                    ['card', 'Kart']
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setOverviewEmpAdvance({ ...overviewEmpAdvance, paidSource: id })}
                      className={`p-2 rounded-lg border text-center ${overviewEmpAdvance.paidSource === id ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsOverviewEmpAdvanceOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-emerald-600 text-white font-medium">Avansı kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GENEL GİDER EKLE & DÜZENLE */}
      {isGeneralExpenseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => setIsGeneralExpenseModalOpen(false))}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">{editingExpenseId ? 'Gider Kaydını Düzenle' : 'Yeni Gider / Fatura Ekle'}</h3>
              <button onClick={() => setIsGeneralExpenseModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveGeneralExpense} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Gider Türü / Kategori</label>
                <select 
            value={expenseFormData.category} 
            onChange={e => setExpenseFormData({ ...expenseFormData, category: e.target.value })} 
            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-medium text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <optgroup label="🏢 Genel Şirket & Ofis Giderleri">
              <option value="office_expense">Ofis & Kırtasiye Masrafları</option>
              <option value="rent_utility">Kira, Elektrik, Su, Doğalgaz</option>
              <option value="software_telecom">Yazılım, Bilişim & Araç Takip (Arvento vb.)</option>
              <option value="advocate_consulting">Avukat / Hukuk & Danışmanlık</option>
              <option value="cargo_stationery">Kargo, Noter & Resmi Evrak</option>
              <option value="hamaliye_labor">Hamaliye / Harcırah / İşçilik</option>
              <option value="general_expense">Genel Şirket Masrafı (Diğer)</option>
            </optgroup>

            <optgroup label="🏠 Şirket Dışı Harcamalar">
              <option value="owner_personal">Şirket dışı harcama</option>
            </optgroup>

            <optgroup label="🚚 Filo & Araç Giderleri">
              <option value="maintenance">Tamir / Bakım / Servis</option>
              <option value="tires">Lastik / Yedek Parça</option>
              <option value="general_fuel">Genel Akaryakıt / Mazot</option>
              <option value="traffic_fines">Trafik Cezası / Ceza</option>
              <option value="insurance_inspection">Muayene, Sigorta & Kasko</option>
              <option value="hgs">HGS / OGS Geçişleri</option>
            </optgroup>

            <optgroup label="⚖️ Resmi & Finansal Dengeleme">
              <option value="taxes_sgk">Devlet / Vergi / SGK Primleri</option>
              <option value="opening_balance">Kasa Açılış / Geçmiş Dönem Kasa Dengeleme</option>
              <option value="bank_commission">Banka Masrafı & Komisyonlar</option>
            </optgroup>
          </select>
              </div>
              {/* Sadece Araç / Filo Gideri Seçildiğinde Görünen Plaka Seçimi */}
            {['maintenance', 'tires', 'general_fuel', 'traffic_fines', 'insurance_inspection', 'hgs'].includes(expenseFormData.category) && (
              <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
                <label className="block font-bold text-blue-900 text-[11px]">İlgili Araç / Plaka Seçimi</label>
                <select
                  value={expenseFormData.plateNumber || ''}
                  onChange={e => setExpenseFormData({ ...expenseFormData, plateNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg text-xs bg-white font-semibold text-slate-800"
                >
                  <option value="">Plaka Seçiniz (Opsiyonel / Genel)</option>
                  {dbVehicles && dbVehicles.map((v: any) => (
                    <option key={v.id || v.plate_number} value={v.plate_number}>
                      {v.plate_number} {v.brand ? `(${v.brand})` : ''}
                    </option>
                  ))}
                </select>
                {expenseFormData.category === 'insurance_inspection' && (
                  <div className="pt-1">
                    <span className="block font-bold text-blue-900 text-[11px] mb-1">Künyeye yazılacak tür</span>
                    <div className="grid grid-cols-3 gap-1">
                      {(['muayene', 'sigorta', 'kasko'] as VehicleChargeKind[]).map(kind => (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => setExpenseFormData({ ...expenseFormData, vehicleCharge: kind })}
                          className={`py-1.5 rounded-lg border text-[11px] font-bold ${expenseFormData.vehicleCharge === kind ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-blue-200'}`}
                        >
                          {kind === 'muayene' ? 'Muayene' : kind === 'sigorta' ? 'Sigorta' : 'Kasko'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tedarikçi / Firma / Açıklama</label>
              <PortalInput 
                type="text" 
                placeholder="Örn: Brisa Lastikçilik / Bakım" 
                value={expenseFormData.companyName} 
                onChange={e => setExpenseFormData({ ...expenseFormData, companyName: e.target.value })} 
                className="w-full px-3 py-2 border border-slate-200 rounded-lg" 
                required 
              />
              {(() => {
                const party = foldPersonName(expenseFormData.companyName);
                if (!party) return null;
                const rem = (dbAdvances || [])
                  .filter((a: any) => String(a.target_type || '') === 'supplier' && foldPersonName(a.target_name || a.target_id) === party)
                  .reduce((s: number, a: any) => s + cleanNumber(a.remaining_amount != null ? a.remaining_amount : a.total_amount), 0);
                if (rem <= 0) return null;
                return (
                  <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                    Bu tedarikçide {rem.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ mahsup edilecek avans var. Kaydedince sorulacak.
                  </p>
                );
              })()}
            </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tutar (TL)</label>
                  <PortalInput type="text" placeholder="15000" value={expenseFormData.amount} onChange={e => setExpenseFormData({ ...expenseFormData, amount: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-rose-600" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fatura / İşlem Tarihi</label>
                  <input type="date" value={expenseFormData.issueDate} onChange={e => setExpenseFormData({ ...expenseFormData, issueDate: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ödeme Durumu</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setExpenseFormData({ ...expenseFormData, status: 'unpaid' })} className={`p-2 rounded-lg border text-center transition ${expenseFormData.status === 'unpaid' ? 'bg-rose-50 border-rose-500 text-rose-700 font-bold' : 'bg-white border-slate-200'}`}>Ödenecek (Açık)</button>
                  <button type="button" onClick={() => setExpenseFormData({ ...expenseFormData, status: 'paid' })} className={`p-2 rounded-lg border text-center transition ${expenseFormData.status === 'paid' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold' : 'bg-white border-slate-200'}`}>Ödendi (Kapandı)</button>
                </div>
              </div>
              {expenseFormData.status === 'paid' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nasıl ödendi?</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setExpenseFormData({ ...expenseFormData, paidSource: 'bank' })} className={`p-2 rounded-lg border text-center transition ${expenseFormData.paidSource !== 'card' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200'}`}>Kasa / Banka</button>
                    <button type="button" onClick={() => setExpenseFormData({ ...expenseFormData, paidSource: 'card' })} className={`p-2 rounded-lg border text-center transition ${expenseFormData.paidSource === 'card' ? 'bg-purple-50 border-purple-500 text-purple-700 font-bold' : 'bg-white border-slate-200'}`}>Kredi kartı</button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {expenseFormData.paidSource === 'card'
                      ? 'Tedarikçi kapanır, kasa şimdi düşmez. Kartı ödeyince kasa düşer.'
                      : 'Tutar şimdi kasadan / bankadan çıkar.'}
                  </p>
                </div>
              )}
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsGeneralExpenseModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-blue-600 text-white font-medium">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DİĞER MODALLAR: SATIŞ, TAHSİLAT, KASA, ARAÇ, KREDİ KARTI, HAKEDİŞ DÜZENLEME, TOPLU MAAŞ */}
      {selectedCariCustomer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:bg-white print:static print:p-0" onMouseDown={e => dismissIfBackdrop(e, () => setSelectedCariCustomer(null))}>
          <div id="cari-dokum-print" className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl border border-slate-100 print:shadow-none print:border-0 print:max-h-none print:rounded-none">
            <div className="flex justify-between items-start pb-4 border-b border-slate-100 print:border-black">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-[#009fe3] uppercase">Tazeyol ERP · Cari ekstre</p>
                <h3 className="font-bold text-slate-900 text-lg mt-1">{selectedCariCustomer.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedCariCustomer.tax_id ? `VKN: ${selectedCariCustomer.tax_id}` : 'VKN yok'}
                  {selectedCariCustomer.phone ? ` · ${selectedCariCustomer.phone}` : ''}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Döküm tarihi: {new Date().toLocaleDateString('tr-TR')} · Faturalar ve ödemeler işlenmiş kayıtlardır.</p>
              </div>
              <div className="flex gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => exportCariExcel(selectedCariCustomer, selectedCariLedger)}
                  className="px-3 py-2 rounded-lg bg-[#009fe3] text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Excel'e aktar
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold"
                >
                  Yazdır
                </button>
                <button type="button" onClick={() => setSelectedCariCustomer(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <table className="w-full text-xs mt-4 border-collapse">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-2">Tarih</th>
                  <th className="py-2 pr-2">İşlem</th>
                  <th className="py-2 pr-2">Açıklama</th>
                  <th className="py-2 pr-2 text-right">Borç (fatura)</th>
                  <th className="py-2 pr-2 text-right">Alacak (ödeme)</th>
                  <th className="py-2 text-right">Bakiye</th>
                </tr>
              </thead>
              <tbody>
                {selectedCariLedger.length === 0 ? (
                  <tr><td colSpan={6} className="py-6 text-center text-slate-400">Bu müşteriye işlenmiş fatura veya ödeme yok.</td></tr>
                ) : selectedCariLedger.map((line, idx) => (
                  <tr key={idx} className="border-b border-slate-50">
                    <td className="py-2 pr-2 whitespace-nowrap">{formatDateTR(line.date)}</td>
                    <td className="py-2 pr-2 font-semibold">{line.type}</td>
                    <td className="py-2 pr-2 text-slate-600">{line.title}</td>
                    <td className="py-2 pr-2 text-right">{line.debit ? line.debit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺' : '—'}</td>
                    <td className="py-2 pr-2 text-right text-emerald-700">{line.credit ? line.credit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺' : '—'}</td>
                    <td className={`py-2 text-right font-bold ${line.balance >= 0 ? 'text-amber-800' : 'text-rose-700'}`}>
                      {line.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedCariLedger.length > 0 && (
              <div className="mt-4 flex justify-end">
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">Kapanış bakiyesi</span>
                  <span className="text-lg font-black text-slate-900">
                    {selectedCariLedger[selectedCariLedger.length - 1].balance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </span>
                  <span className="text-[11px] text-slate-400 block">Artı: müşteriden alacak · Eksi: fazla ödeme/avans</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedPayrollEmp && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:bg-white print:static print:p-0" onMouseDown={e => dismissIfBackdrop(e, () => setSelectedPayrollEmp(null))}>
          <div id="personel-hakedis-print" className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl border border-slate-100 print:shadow-none print:border-0 print:max-h-none print:rounded-none">
            <div className="flex justify-between items-start pb-4 border-b border-slate-100 print:border-black gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-[#009fe3] uppercase">Tazeyol ERP · Personel hakediş raporu</p>
                <h3 className="font-bold text-slate-900 text-lg mt-1">{selectedPayrollEmp.full_name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedPayrollEmp.role_title || 'Görev yok'}
                  {selectedPayrollEmp.hire_date
                    ? ` · İşe giriş: ${formatDateTR(selectedPayrollEmp.hire_date)}`
                    : ` · Başlangıç (${resolveEmployeeStart(selectedPayrollEmp).label}): ${formatDateTR(resolveEmployeeStart(selectedPayrollEmp).date)}`}
                  {selectedPayrollEmp.iban ? ` · IBAN: ${selectedPayrollEmp.iban}` : ''}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Personel cari Ekim 2026’dan başlar. Ekim öncesi maaş ve avans bu rapora yazılmaz.
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 print:hidden">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <span>Dönem</span>
                  <input type="month" value={payrollFrom} onChange={e => setPayrollFrom(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1" />
                  <span>—</span>
                  <input type="month" value={payrollTo} onChange={e => setPayrollTo(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1" />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => exportPayrollExcel(selectedPayrollEmp, selectedPayrollLedger)}
                    className="px-3 py-2 rounded-lg bg-[#009fe3] text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold"
                  >
                    PDF / Yazdır
                  </button>
                  <button type="button" onClick={() => setSelectedPayrollEmp(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                </div>
              </div>
            </div>
            <table className="w-full text-xs mt-4 border-collapse">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-2">Tarih</th>
                  <th className="py-2 pr-2">İşlem</th>
                  <th className="py-2 pr-2">Açıklama</th>
                  <th className="py-2 pr-2 text-right">Hakediş</th>
                  <th className="py-2 pr-2 text-right">Kesinti / ödeme</th>
                  <th className="py-2 text-right">Bakiye</th>
                </tr>
              </thead>
              <tbody>
                {selectedPayrollLedger.length === 0 ? (
                  <tr><td colSpan={6} className="py-6 text-center text-slate-400">Bu dönemde hakediş kaydı yok.</td></tr>
                ) : selectedPayrollLedger.map((line, idx) => (
                  <tr key={idx} className="border-b border-slate-50">
                    <td className="py-2 pr-2 whitespace-nowrap">{formatDateTR(line.date)}</td>
                    <td className="py-2 pr-2 font-semibold">{line.type}</td>
                    <td className="py-2 pr-2 text-slate-600">{line.title}</td>
                    <td className="py-2 pr-2 text-right text-emerald-700">{line.earn ? line.earn.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺' : '—'}</td>
                    <td className="py-2 pr-2 text-right text-rose-700">{line.cut ? line.cut.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺' : '—'}</td>
                    <td className={`py-2 text-right font-bold ${line.balance >= 0 ? 'text-slate-800' : 'text-rose-700'}`}>
                      {line.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedPayrollLedger.length > 0 && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-3">
                  <span className="text-[11px] text-slate-500 block">Toplam hakediş</span>
                  <span className="font-black text-emerald-700">
                    {selectedPayrollLedger.reduce((s, l) => s + l.earn, 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </span>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <span className="text-[11px] text-slate-500 block">Toplam kesinti / ödeme</span>
                  <span className="font-black text-rose-700">
                    {selectedPayrollLedger.reduce((s, l) => s + l.cut, 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </span>
                </div>
                <div className="bg-blue-50 rounded-xl p-3">
                  <span className="text-[11px] text-blue-700 block">Kapanış bakiyesi</span>
                  <span className="font-black text-slate-900">
                    {selectedPayrollLedger[selectedPayrollLedger.length - 1].balance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </span>
                  <span className="text-[11px] text-slate-400 block">Artı: personele kalan · Eksi: fazla avans</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => setIsCustomerModalOpen(false))}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">{editingCustomerId ? 'Müşteri Düzenle' : 'Yeni Müşteri'}</h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveCustomer} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Unvan</label>
                <PortalInput value={customerFormData.name} onChange={e => setCustomerFormData({ ...customerFormData, name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" required placeholder="Örn: MİGROS TİCARET A.Ş." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">VKN</label>
                  <PortalInput value={customerFormData.tax_id} onChange={e => setCustomerFormData({ ...customerFormData, tax_id: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vergi Dairesi</label>
                  <PortalInput value={customerFormData.tax_office} onChange={e => setCustomerFormData({ ...customerFormData, tax_office: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Adres</label>
                <PortalInput value={customerFormData.address} onChange={e => setCustomerFormData({ ...customerFormData, address: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Telefon</label>
                  <PortalInput value={customerFormData.phone} onChange={e => setCustomerFormData({ ...customerFormData, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">E-posta</label>
                  <PortalInput type="email" value={customerFormData.email} onChange={e => setCustomerFormData({ ...customerFormData, email: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Not</label>
                <PortalInput value={customerFormData.notes} onChange={e => setCustomerFormData({ ...customerFormData, notes: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-[#009fe3] text-white font-medium">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isNewSaleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => setIsNewSaleModalOpen(false))}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Yeni Satış Faturası Ekle</h3>
              <button onClick={() => setIsNewSaleModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={async e => {
              e.preventDefault();
              const amt = cleanNumber(newSaleFormData.amount);
              if (!newSaleFormData.invoiceNo || amt <= 0) return;
              try {
                const invTitle = newSaleFormData.customerName ? `${newSaleFormData.invoiceNo} - ${newSaleFormData.customerName}` : newSaleFormData.invoiceNo;
                const row: any = {
                  invoice_no: invTitle,
                  direction: 'outgoing',
                  category: 'freight_sales',
                  total_amount: amt,
                  issue_date: newSaleFormData.issueDate,
                  due_date: newSaleFormData.dueDate,
                  status: 'unpaid',
                  description: (newSaleFormData.description || '').trim() || null
                };
                let { error } = await supabase.from('invoices').insert([row]);
                if (error && /description/i.test(String(error.message || ''))) {
                  const { description: _d, ...rest } = row;
                  const second = await supabase.from('invoices').insert([rest]);
                  error = second.error;
                }
                if (error) throw error;
                alert('Satış faturası eklendi!');
                setIsNewSaleModalOpen(false);
                loadPortalData();
              } catch (err: any) { alert('Hata: ' + err.message); }
            }} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Müşteri</label>
                {dbCustomers.length > 0 ? (
                  <select
                    value={newSaleFormData.customerName}
                    onChange={e => setNewSaleFormData({ ...newSaleFormData, customerName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    required
                  >
                    <option value="">Müşteri seçin</option>
                    {dbCustomers.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <PortalInput type="text" placeholder="Önce Müşteri Kartları menüsünden ekleyin" value={newSaleFormData.customerName} onChange={e => setNewSaleFormData({ ...newSaleFormData, customerName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" required />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fatura Numarası</label>
                  <PortalInput type="text" placeholder="EF12026..." value={newSaleFormData.invoiceNo} onChange={e => setNewSaleFormData({ ...newSaleFormData, invoiceNo: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-medium" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tutar (TL)</label>
                  <PortalInput type="text" placeholder="250000" value={newSaleFormData.amount} onChange={e => setNewSaleFormData({ ...newSaleFormData, amount: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-blue-700" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fatura Tarihi</label>
                  <input type="date" value={newSaleFormData.issueDate} onChange={e => setNewSaleFormData({ ...newSaleFormData, issueDate: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vade Tarihi</label>
                  <input type="date" value={newSaleFormData.dueDate} onChange={e => setNewSaleFormData({ ...newSaleFormData, dueDate: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Açıklama</label>
                <PortalInput type="text" placeholder="Fatura açıklaması" value={newSaleFormData.description} onChange={e => setNewSaleFormData({ ...newSaleFormData, description: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsNewSaleModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-blue-600 text-white font-medium">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isNewReceiptModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => setIsNewReceiptModalOpen(false))}>
          <div className={`bg-white rounded-2xl w-full p-6 shadow-xl border border-slate-100 ${newReceiptFormData.kind === 'invoice' ? 'max-w-lg' : 'max-w-md'}`}>
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Müşteri tahsilatı</h3>
              <button onClick={() => setIsNewReceiptModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveNewReceipt} className="mt-4 space-y-3 text-xs">
              <p className="text-[11px] text-slate-500 bg-amber-50 border border-amber-100 rounded-lg p-2">
                {newReceiptFormData.kind === 'invoice' && (isMainMigrosName(newReceiptFormData.customerName) || isAtifAltunisikName(newReceiptFormData.customerName))
                  ? 'Bu caride fatura yalnızca kapanır. Gelen para ayrı tahsilat kaydındadır; kasa ikinci kez yazılmaz.'
                  : newReceiptFormData.kind === 'invoice'
                  ? 'Fatura tahsilatı: seçilen fatura kapanır, tutar kasaya ve cariye bir kez girer.'
                  : 'Gelen her para tahsilattır. Açıklama boşsa kayıt tahsilat olur; avans notu gerekirse açıklamaya yazın.'}
              </p>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kayıt türü</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setNewReceiptFormData({ ...newReceiptFormData, kind: 'collection', relatedInvoiceId: null })} className={`p-2 rounded-lg border text-center transition ${newReceiptFormData.kind !== 'invoice' ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold' : 'bg-white border-slate-200'}`}>Tahsilat</button>
                  <button type="button" onClick={() => setNewReceiptFormData({ ...newReceiptFormData, kind: 'invoice', relatedInvoiceId: null, amount: '' })} className={`p-2 rounded-lg border text-center transition ${newReceiptFormData.kind === 'invoice' ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold' : 'bg-white border-slate-200'}`}>Fatura kapat</button>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-800 mb-1">Tahsil edildiği tarih (banka günü)</label>
                <input
                  type="date"
                  required
                  value={newReceiptFormData.date}
                  onChange={e => setNewReceiptFormData({ ...newReceiptFormData, date: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-emerald-300 rounded-lg bg-white font-bold text-sm"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Bugünün tarihi otomatik gelir; gerçek gün farklıysa değiştirin.</span>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Müşteri / Cari Adı</label>
                {dbCustomers.length > 0 ? (
                  <select
                    value={newReceiptFormData.customerName}
                    onChange={e => setNewReceiptFormData({ ...newReceiptFormData, customerName: e.target.value, relatedInvoiceId: null, amount: newReceiptFormData.kind === 'invoice' ? '' : newReceiptFormData.amount })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    required
                  >
                    <option value="">Müşteri seçin</option>
                    {dbCustomers.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                <PortalInput type="text" value={newReceiptFormData.customerName} onChange={e => setNewReceiptFormData({ ...newReceiptFormData, customerName: e.target.value, relatedInvoiceId: null })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" required />
                )}
              </div>
              {newReceiptFormData.kind === 'invoice' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Açık faturalar</label>
                  {!newReceiptFormData.customerName ? (
                    <p className="text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-lg p-3">Önce müşteri seçin.</p>
                  ) : receiptOpenInvoices.length === 0 ? (
                    <p className="text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-lg p-3">Bu müşterinin açık faturası yok.</p>
                  ) : (
                    <div className="max-h-48 overflow-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {receiptOpenInvoices.map(inv => {
                        const selected = String(newReceiptFormData.relatedInvoiceId) === String(inv.id);
                        const tutar = cleanNumber(inv.total_amount);
                        return (
                          <button
                            key={inv.id}
                            type="button"
                            onClick={() => setNewReceiptFormData({
                              ...newReceiptFormData,
                              relatedInvoiceId: inv.id,
                              receiptNo: inv.cleanInvoiceNo || inv.invoice_no || '',
                              amount: String(tutar)
                            })}
                            className={`w-full text-left px-3 py-2.5 transition ${selected ? 'bg-emerald-50' : 'bg-white hover:bg-slate-50'}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-mono font-bold text-blue-700">{inv.cleanInvoiceNo || inv.invoice_no}</span>
                              <span className="font-black text-slate-900 tabular-nums">{tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{formatDateTR(inv.issue_date)}{inv.description ? ` · ${inv.description}` : ''}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tahsilat Hesabı</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setNewReceiptFormData({ ...newReceiptFormData, targetAccount: 'bank' })} className={`p-2 rounded-lg border text-center transition ${newReceiptFormData.targetAccount === 'bank' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200'}`}>🏦 Banka Hesabı</button>
                  <button type="button" onClick={() => setNewReceiptFormData({ ...newReceiptFormData, targetAccount: 'cash' })} className={`p-2 rounded-lg border text-center transition ${newReceiptFormData.targetAccount === 'cash' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200'}`}>💵 Kasa (Elden Nakit)</button>
                </div>
              </div>
              {newReceiptFormData.kind !== 'invoice' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Açıklama</label>
                <PortalInput type="text" placeholder="Boş bırakılırsa tahsilat. Gerekirse: haftalık avans, dekont no…" value={newReceiptFormData.receiptNo} onChange={e => setNewReceiptFormData({ ...newReceiptFormData, receiptNo: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              )}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tutar (TL)</label>
                  <PortalInput type="text" value={newReceiptFormData.amount} onChange={e => setNewReceiptFormData({ ...newReceiptFormData, amount: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-emerald-600 text-sm" required />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsNewReceiptModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-emerald-600 text-white font-medium">{newReceiptFormData.kind === 'invoice' && (isMainMigrosName(newReceiptFormData.customerName) || isAtifAltunisikName(newReceiptFormData.customerName)) ? 'Faturayı kapat' : newReceiptFormData.kind === 'invoice' ? 'Tahsil et' : 'Tahsilatı kaydet'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCashLedgerOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => setIsCashLedgerOpen(false))}>
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-xl border border-slate-100">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Kasa / banka hareketleri</h3>
                <p className="text-xs text-slate-500 mt-0.5">{formatDateTR(cashStartDate)} açılış {cashBookOpening.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺. Sonrası giriş eklenir, çıkış düşer.</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-semibold text-slate-500">Başlangıç
                  <input type="date" value={cashLedgerFrom || cashSnapDate} onChange={e => setCashLedgerFrom(e.target.value)} className="ml-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
                </label>
                <label className="text-[11px] font-semibold text-slate-500">Bitiş
                  <input type="date" value={cashLedgerTo || ''} onChange={e => setCashLedgerTo(e.target.value)} className="ml-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
                </label>
                <button onClick={() => setIsCashLedgerOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-slate-100">
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Dönem başı</span>
                <span className="text-sm font-black text-slate-800">{cashLedgerView.startBal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3">
                <span className="text-[10px] font-bold text-emerald-600 uppercase block">Giriş</span>
                <span className="text-sm font-black text-emerald-700">+{cashLedgerView.periodIn.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
              </div>
              <div className="bg-rose-50 rounded-xl p-3">
                <span className="text-[10px] font-bold text-rose-600 uppercase block">Çıkış</span>
                <span className="text-sm font-black text-rose-700">−{cashLedgerView.periodOut.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <span className="text-[10px] font-bold text-blue-600 uppercase block">Dönem sonu</span>
                <span className="text-sm font-black text-blue-800">{cashLedgerView.endBal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
              </div>
            </div>
            <div className="overflow-auto flex-1 p-5">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase sticky top-0">
                  <tr>
                    <th className="py-2 px-2">Tarih</th>
                    <th className="py-2 px-2">Tür</th>
                    <th className="py-2 px-2">Açıklama</th>
                    <th className="py-2 px-2 text-right">Giriş</th>
                    <th className="py-2 px-2 text-right">Çıkış</th>
                    <th className="py-2 px-2 text-right">Bakiye</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashLedgerView.lines.map(line => (
                    <tr key={String(line.id)} className={line.isHist ? 'bg-amber-50/40 text-slate-400' : line.isOpen ? 'bg-slate-50' : 'hover:bg-slate-50'}>
                      <td className="py-2 px-2 whitespace-nowrap text-slate-600">{formatDateTR(line.date)}</td>
                      <td className="py-2 px-2 font-semibold text-slate-800">
                        {line.label}
                        {line.isHist && <span className="block text-[10px] font-semibold text-amber-700">Açılışa dahil</span>}
                      </td>
                      <td className="py-2 px-2 text-slate-500 max-w-[280px] truncate" title={line.title}>{line.title}</td>
                      <td className="py-2 px-2 text-right font-bold text-emerald-600">{line.inflow ? line.inflow.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺' : '—'}</td>
                      <td className="py-2 px-2 text-right font-bold text-rose-600">{line.outflow ? line.outflow.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺' : '—'}</td>
                      <td className="py-2 px-2 text-right font-black text-slate-900">{line.balance == null ? '—' : line.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isCashDepositModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => setIsCashDepositModalOpen(false))}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Kasaya / Bankaya Para Girişi</h3>
              <button onClick={() => setIsCashDepositModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveCashDeposit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Giriş Türü</label>
                <select value={cashDepositFormData.depositType} onChange={e => setCashDepositFormData({ ...cashDepositFormData, depositType: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white">
                  <option value="partner_capital">Ortak Sermaye Fonu (Nakit Katkı)</option>
                  <option value="other_deposit">Diğer Nakit Para Girişi</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Yatırılan Hesap</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setCashDepositFormData({ ...cashDepositFormData, targetAccount: 'bank' })} className={`p-2 rounded-lg border text-center transition ${cashDepositFormData.targetAccount === 'bank' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200'}`}>🏦 Banka Hesabı</button>
                  <button type="button" onClick={() => setCashDepositFormData({ ...cashDepositFormData, targetAccount: 'cash' })} className={`p-2 rounded-lg border text-center transition ${cashDepositFormData.targetAccount === 'cash' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200'}`}>💵 Elden Kasa</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tutar (TL)</label>
                  <PortalInput type="text" placeholder="1000000" value={cashDepositFormData.amount} onChange={e => setCashDepositFormData({ ...cashDepositFormData, amount: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-blue-700 text-sm" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tarih</label>
                  <input type="date" value={cashDepositFormData.date} onChange={e => setCashDepositFormData({ ...cashDepositFormData, date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Açıklama</label>
                <PortalInput type="text" placeholder="Örn: Ortak Sermaye Katkısı" value={cashDepositFormData.title} onChange={e => setCashDepositFormData({ ...cashDepositFormData, title: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsCashDepositModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-slate-800 text-white font-medium">Hesaba İşle</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSingleSalaryPayOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => setIsSingleSalaryPayOpen(false))}>
          <form onSubmit={handleExecuteSingleSalaryPay} className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-3 text-sm">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Maaş / prim öde</h3>
              <button type="button" onClick={() => setIsSingleSalaryPayOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-600">
              <span className="font-bold text-slate-900 block">{singleSalaryPay.name}</span>
              Kapanmış hak {singleSalaryPay.closedHak.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
              {singleSalaryPay.openExtra ? ` · Bu ay prim/avans ${singleSalaryPay.openExtra.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : ''}
              {singleSalaryPay.paid > 0 ? ` · Ödenen ${singleSalaryPay.paid.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : ''}
            </p>
            <p className="text-sm font-bold text-emerald-800">Kalan cari: {singleSalaryPay.net.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</p>
            <p className="text-[11px] text-slate-500">Varsayılan tüm kalandır. Kısmi ödeme için düşürün; cariden fazla yazılmaz. Avans bu ekrandan girilmez.</p>
            <div>
              <label className="block font-semibold text-slate-700 mb-1 text-xs">Ödenecek (en fazla kalan)</label>
              <PortalInput type="text" value={singleSalaryPay.amount} onChange={e => setSingleSalaryPay({ ...singleSalaryPay, amount: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-right" required />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1 text-xs">Tarih</label>
              <input type="date" value={salaryPayDate} onChange={e => setSalaryPayDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setBulkSalarySource('bank')} className={`flex-1 py-2 rounded-lg border text-xs font-bold ${bulkSalarySource === 'bank' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200'}`}>Banka</button>
              <button type="button" onClick={() => setBulkSalarySource('cash')} className={`flex-1 py-2 rounded-lg border text-xs font-bold ${bulkSalarySource === 'cash' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200'}`}>Kasa</button>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setIsSingleSalaryPayOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200 text-xs">İptal</button>
              <button type="submit" className="w-1/2 py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs">Öde</button>
            </div>
          </form>
        </div>
      )}

      {isBulkSalaryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => setIsBulkSalaryModalOpen(false))}>
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Toplu cari ödeme</h3>
              <button onClick={() => setIsBulkSalaryModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Her satırdaki tutar o kişinin kalan carisidir (kapanmış maaş + prim − avans − önceki ödemeler). Sözleşmeli maaş yazılmaz. Cari 0 olanlar işaretlenmez. İstemediğinizi işaretten çıkarın.</p>
            <div className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <label className="font-semibold text-slate-700 flex items-center gap-2">
                Ödeme tarihi
                <input type="date" value={salaryPayDate} onChange={e => setSalaryPayDate(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 font-medium" />
              </label>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Kaynak:</span>
                <button type="button" onClick={() => setBulkSalarySource('bank')} className={`px-3 py-1.5 rounded-lg border font-bold transition ${bulkSalarySource === 'bank' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200'}`}>Banka</button>
                <button type="button" onClick={() => setBulkSalarySource('cash')} className={`px-3 py-1.5 rounded-lg border font-bold transition ${bulkSalarySource === 'cash' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200'}`}>Kasa</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 py-2">
              {Object.keys(bulkSalaryItems).map(idStr => {
                const id = Number(idStr);
                const item = bulkSalaryItems[id];
                return (
                  <div key={id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs gap-3">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={item.selected} onChange={e => setBulkSalaryItems({ ...bulkSalaryItems, [id]: { ...item, selected: e.target.checked } })} className="w-4 h-4 rounded text-blue-600" />
                      <div>
                        <span className="font-bold text-slate-900 block">{item.name}</span>
                        <span className="text-[10px] text-slate-400">{item.role}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-[10px]">Kalan cari:</span>
                      <span className={`w-28 px-2 py-1 rounded font-bold text-right ${item.net > 0.009 ? 'bg-white text-indigo-700 border border-slate-200' : 'bg-slate-100 text-slate-400'}`}>
                        {item.net.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span>₺</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="pt-3 border-t border-slate-100 flex gap-3">
              <button type="button" onClick={() => setIsBulkSalaryModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200 text-xs">İptal</button>
              <button type="button" onClick={handleExecuteBulkSalaryPay} className="w-1/2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">Maaşları Öde ve Kasadan Düş</button>
            </div>
          </div>
        </div>
      )}

      {isVehicleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => setIsVehicleModalOpen(false))}>
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">{editingVehicleId ? 'Araç ve Poliçe Bilgilerini Düzenle' : 'Filoya Yeni Araç Ekle'}</h3>
              <button onClick={() => setIsVehicleModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveVehicle} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Araç Plakası</label>
                  <PortalInput type="text" placeholder="34 TZY 101" value={vehicleFormData.plateNumber} onChange={e => setVehicleFormData({ ...vehicleFormData, plateNumber: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg uppercase font-mono font-bold" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sürücü Adı Soyadı</label>
                  <PortalInput type="text" placeholder="Örn: Ercan Çelik" value={vehicleFormData.driverName} onChange={e => setVehicleFormData({ ...vehicleFormData, driverName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Araç tipi</label>
                  <select
                    value={normalizeVehicleType(vehicleFormData.vehicleType)}
                    onChange={e => setVehicleFormData({ ...vehicleFormData, vehicleType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Binek">Binek</option>
                    <option value="Kamyonet">Kamyonet</option>
                    <option value="Kamyon">Kamyon</option>
                    <option value="TIR">TIR</option>
                    <option value="Dorse">Dorse</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sahiplik</label>
                  <select
                    value={vehicleFormData.ownershipType}
                    onChange={e => setVehicleFormData({ ...vehicleFormData, ownershipType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Öz Mal">Öz Mal</option>
                    <option value="Kiralık">Kiralık</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Durum</label>
                  <select
                    value={vehicleFormData.isActive ? 'aktif' : 'pasif'}
                    onChange={e => setVehicleFormData({ ...vehicleFormData, isActive: e.target.value === 'aktif' })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="aktif">Aktif</option>
                    <option value="pasif">Pasif</option>
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 -mt-2">Öz mal kârlılıkta yalnızca aktif kamyonet, kamyon ve TIR görünür. Binek ve dorse o menüde listelenmez.</p>
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2">
                <span className="font-bold text-blue-900 block text-xs">Trafik Sigortası Poliçesi</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-600">Sigorta Şirketi</label>
                    <PortalInput type="text" placeholder="AXA" value={vehicleFormData.insuranceCompany} onChange={e => setVehicleFormData({ ...vehicleFormData, insuranceCompany: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">Sigorta Bedeli (TL)</label>
                    <PortalInput type="text" placeholder="12500" value={vehicleFormData.insuranceCost} onChange={e => setVehicleFormData({ ...vehicleFormData, insuranceCost: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">Yapıldığı Tarih</label>
                    <input type="date" value={vehicleFormData.insuranceStartDate} onChange={e => setVehicleFormData({ ...vehicleFormData, insuranceStartDate: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white" />
                  </div>
                </div>
              </div>
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200 space-y-2">
                <span className="font-bold text-purple-900 block text-xs">Kasko Poliçesi</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-600">Kasko Şirketi</label>
                    <PortalInput type="text" placeholder="ALLIANZ" value={vehicleFormData.kaskoCompany} onChange={e => setVehicleFormData({ ...vehicleFormData, kaskoCompany: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">Kasko Bedeli (TL)</label>
                    <PortalInput type="text" placeholder="45000" value={vehicleFormData.kaskoCost} onChange={e => setVehicleFormData({ ...vehicleFormData, kaskoCost: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">Yapıldığı Tarih</label>
                    <input type="date" value={vehicleFormData.kaskoStartDate} onChange={e => setVehicleFormData({ ...vehicleFormData, kaskoStartDate: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white" />
                  </div>
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 block text-xs">Muayene ve MTV Takvimi</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-600">Sonraki Muayene</label>
                    <input type="date" value={vehicleFormData.nextInspectionDate} onChange={e => setVehicleFormData({ ...vehicleFormData, nextInspectionDate: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">Muayene Harcı (TL)</label>
                    <PortalInput type="text" placeholder="2800" value={vehicleFormData.inspectionCost} onChange={e => setVehicleFormData({ ...vehicleFormData, inspectionCost: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">Son MTV Tutarı (TL)</label>
                    <PortalInput type="text" placeholder="3500" value={vehicleFormData.lastMtvCost} onChange={e => setVehicleFormData({ ...vehicleFormData, lastMtvCost: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white" />
                  </div>
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsVehicleModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" disabled={isSavingVehicle} className="w-1/2 py-2 rounded-lg bg-blue-600 text-white font-medium">{isSavingVehicle ? 'Kaydediliyor...' : 'Kaydet'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCreditCardModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => { setIsCreditCardModalOpen(false); setEditingCreditCardId(null); })}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-base">
                {editingCreditCardId ? 'Kredi Kartı Düzenle & Ekstre Güncelle' : 'Yeni Kredi Kartı Ekle'}
              </h3>
              <button 
                onClick={() => {
                  setIsCreditCardModalOpen(false);
                  setEditingCreditCardId(null);
                }} 
                className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={async e => {
              e.preventDefault();
              if (!creditCardFormData.cardName || !creditCardFormData.dueDate) return;
              try {
                const payload: any = {
                  card_name: creditCardFormData.cardName.trim(),
                  bank_name: creditCardFormData.bankName.trim(),
                  last_four_digits: creditCardFormData.lastFourDigits.trim(),
                  statement_amount: cleanNumber(creditCardFormData.statementAmount),
                  min_payment_amount: cleanNumber(creditCardFormData.minPaymentAmount),
                  due_date: creditCardFormData.dueDate,
                  card_kind: creditCardFormData.cardKind
                };

                const saveCard = async (data: any) => {
                  if (editingCreditCardId) return supabase.from('credit_cards').update(data).eq('id', editingCreditCardId);
                  return supabase.from('credit_cards').insert([data]);
                };

                let { error } = await saveCard(payload);
                if (error && /card_kind/i.test(error.message)) {
                  const { card_kind, ...fallback } = payload;
                  ({ error } = await saveCard(fallback));
                }
                if (error) throw error;
                alert(editingCreditCardId ? 'Kredi kartı ve ekstre kaydedildi.' : 'Yeni kredi kartı eklendi.');

                setIsCreditCardModalOpen(false);
                setEditingCreditCardId(null);
                setCreditCardFormData({
                  cardName: '',
                  bankName: '',
                  lastFourDigits: '',
                  statementAmount: '',
                  minPaymentAmount: '',
                  dueDate: '',
                  cardKind: 'company'
                });
                loadPortalData();
              } catch (err: any) { 
                alert('Kart kaydetme hatası: ' + err.message); 
              }
            }} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kart türü</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setCreditCardFormData({ ...creditCardFormData, cardKind: 'company' })} className={`p-2 rounded-lg border text-center ${creditCardFormData.cardKind !== 'personal' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200'}`}>Şirket kartı</button>
                  <button type="button" onClick={() => setCreditCardFormData({ ...creditCardFormData, cardKind: 'personal' })} className={`p-2 rounded-lg border text-center ${creditCardFormData.cardKind === 'personal' ? 'bg-slate-100 border-slate-500 text-slate-800 font-bold' : 'bg-white border-slate-200'}`}>Şahsi kart</button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{creditCardFormData.cardKind === 'personal' ? 'Öderken şirket kasasından düşülecek tutarı siz yazarsınız. Şahsi harcama kasayı bozmaz.' : 'Ekstre ödemesi tamamı kasadan düşer.'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kart Adı / Sahibi</label>
                  <PortalInput type="text" placeholder="Şirket Kartı" value={creditCardFormData.cardName} onChange={e => setCreditCardFormData({ ...creditCardFormData, cardName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Banka Adı</label>
                  <PortalInput type="text" placeholder="Garanti BBVA" value={creditCardFormData.bankName} onChange={e => setCreditCardFormData({ ...creditCardFormData, bankName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" required />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Son 4 Hane</label>
                  <PortalInput type="text" placeholder="3533" maxLength={4} value={creditCardFormData.lastFourDigits} onChange={e => setCreditCardFormData({ ...creditCardFormData, lastFourDigits: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-center" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ekstre (TL)</label>
                  <PortalInput type="text" placeholder="45000" value={creditCardFormData.statementAmount} onChange={e => setCreditCardFormData({ ...creditCardFormData, statementAmount: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-rose-600" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Asgari (TL)</label>
                  <PortalInput type="text" placeholder="9000" value={creditCardFormData.minPaymentAmount} onChange={e => setCreditCardFormData({ ...creditCardFormData, minPaymentAmount: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-amber-700" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Son Ödeme Tarihi</label>
                <input type="date" value={creditCardFormData.dueDate} onChange={e => setCreditCardFormData({ ...creditCardFormData, dueDate: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white" required />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => { setIsCreditCardModalOpen(false); setEditingCreditCardId(null); }} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-blue-600 text-white font-medium">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditSubModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => setIsEditSubModalOpen(false))}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Hakediş faturası düzenle</h3>
              <button onClick={() => setIsEditSubModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveSubInvoiceEdit} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fatura No / Taşeron</label>
                  <PortalInput type="text" value={subEditFormData.invoiceNo} onChange={e => setSubEditFormData({ ...subEditFormData, invoiceNo: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-medium" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fatura Toplam Tutar (TL)</label>
                  <PortalInput type="text" value={subEditFormData.totalAmount} onChange={e => setSubEditFormData({ ...subEditFormData, totalAmount: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-900" required />
                </div>
              </div>
          <p className="text-[11px] text-slate-500">Burada yalnız fatura bilgisi düzeltilir. Avans cari karttan, ödeme Banka Talimatı’ndan işlenir.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-blue-900 text-xs">1 nci ödeme tutarı</span>
                <select
                  value={(subEditFormData as any).term1Status || 'pending'}
                  onChange={e => setSubEditFormData({ ...subEditFormData, term1Status: e.target.value } as any)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    (subEditFormData as any).term1Status === 'paid' 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}
                >
                  <option value="pending">Bekliyor (Açık)</option>
                  <option value="paid">Ödendi (Kapalı)</option>
                </select>
              </div>
              <PortalInput 
                type="text" 
                value={subEditFormData.term1Amount} 
                onChange={e => setSubEditFormData({ ...subEditFormData, term1Amount: e.target.value })} 
                className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-semibold" 
              />
              <input 
                type="date" 
                value={subEditFormData.term1DueDate} 
                onChange={e => setSubEditFormData({ ...subEditFormData, term1DueDate: e.target.value })} 
                className="w-full px-2 py-1 border border-slate-200 rounded text-[11px] text-slate-600" 
              />
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-blue-900 text-xs">2 nci ödeme tutarı</span>
                <select
                  value={(subEditFormData as any).term2Status || 'pending'}
                  onChange={e => setSubEditFormData({ ...subEditFormData, term2Status: e.target.value } as any)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    (subEditFormData as any).term2Status === 'paid' 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}
                >
                  <option value="pending">Bekliyor (Açık)</option>
                  <option value="paid">Ödendi (Kapalı)</option>
                </select>
              </div>
              <PortalInput 
                type="text" 
                value={subEditFormData.term2Amount} 
                onChange={e => setSubEditFormData({ ...subEditFormData, term2Amount: e.target.value })} 
                className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-semibold" 
              />
              <input 
                type="date" 
                value={subEditFormData.term2DueDate} 
                onChange={e => setSubEditFormData({ ...subEditFormData, term2DueDate: e.target.value })} 
                className="w-full px-2 py-1 border border-slate-200 rounded text-[11px] text-slate-600" 
              />
            </div>
          </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsEditSubModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-blue-600 text-white font-medium">Değişiklikleri Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 360° ÇEKMECE PANELİ */}
      {drawerData.isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div onClick={() => setDrawerData({ ...drawerData, isOpen: false })} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-from-right duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">{drawerData.title}</h3>
                {drawerData.subtitle && <p className="text-xs text-slate-500 mt-0.5">{drawerData.subtitle}</p>}
              </div>
              <button onClick={() => setDrawerData({ ...drawerData, isOpen: false })} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {drawerData.type === 'vehicle' && drawerData.vehicleSummary && (
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Son Sigorta Bedeli</span>
                    <span className="font-bold text-slate-800">{drawerData.vehicleSummary.lastInsurance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Son Kasko Bedeli</span>
                    <span className="font-bold text-slate-800">{drawerData.vehicleSummary.lastKasko.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Son Muayene Harcı</span>
                    <span className="font-bold text-slate-800">{drawerData.vehicleSummary.lastInspection.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Son MTV Tutarı</span>
                    <span className="font-bold text-slate-800">{drawerData.vehicleSummary.lastMtv.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Ödenmiş Toplam Ceza</span>
                    <span className="font-bold text-rose-600">{drawerData.vehicleSummary.paidFines.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                  </div>
                </div>
              )}

{drawerData.items?.map((group, gIdx) => (
            <div key={gIdx} className="space-y-2">
              <span className="font-bold text-slate-700 uppercase tracking-wider block text-[11px] pb-1 border-b border-slate-100">
                {group.label} ({group.data?.length || 0})
              </span>
              <div className="space-y-2">
                {group.data?.length === 0 && <p className="text-slate-400 italic">Kayıt bulunamadı.</p>}
                {group.data?.map((item: any, iIdx: number) => (
                  <div key={iIdx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>{item.invoice_no || item.month_year || 'Kayıt'}</span>
                      <span className="text-blue-700">{(item.total_amount || item.invoice_rev || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Tarih: {item.due_date || item.issue_date || '-'}</span>
                      <span className={item.status === 'paid' ? 'text-emerald-600 font-semibold' : 'text-amber-600'}>
                        {item.status === 'paid' ? 'Ödendi' : 'Açık'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
         ))}
        </div>
      </div>
    </div>
 )}

        {activeTab === 'rental_settlements' && canViewMod('rental_settlements') && (() => {
          const meta = rentalGroupMeta(rentalWorkGroup);
          const approved = rentalEditRow?.status === 'approved';
          const adminGrace = isAdmin && rentalAdminCanEditMonth(rentalEditRow?.year_month || rentalSettlementMonth);
          const locked = !canEditMod('rental_settlements') || rentalRowLockedForUser(rentalEditRow, currentUserRole);
          const stopCount = parseLocaleNumber(rentalSettlementForm.stop_count);
          const live = rentalEditRow ? rentalSettlementTotals({
            ...rentalEditRow,
            work_group: rentalWorkGroup,
            rent_amount: parseLocaleNumber(rentalSettlementForm.rent_amount || rentalEditRow.rent_amount),
            fuel_rate: parseLocaleNumber(rentalSettlementForm.fuel_rate || rentalEditRow.fuel_rate),
            fuel_unit_price: parseLocaleNumber(rentalSettlementForm.fuel_unit_price),
            total_km: parseLocaleNumber(rentalSettlementForm.total_km),
            work_days: parseLocaleNumber(rentalSettlementForm.work_days),
            stop_count: stopCount,
            visit_prime: isAdmin ? (parseLocaleNumber(rentalSettlementForm.visit_prime) || stopCount * meta.visitUnit) : stopCount * meta.visitUnit,
            extra_work: parseLocaleNumber(rentalSettlementForm.extra_work),
            hgs: parseLocaleNumber(rentalSettlementForm.hgs),
            fuel_charge: parseLocaleNumber(rentalSettlementForm.fuel_charge)
          }) : null;
          const money = (n: number) => formatMoneyTR(n);
          const kmTxt = (n: any) => parseLocaleNumber(n).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
          const entryCls = 'w-full px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-sm font-semibold text-right tabular-nums disabled:bg-slate-100 disabled:border-slate-200';
          const adminCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-right tabular-nums disabled:bg-slate-100';
          return (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-wrap gap-2 items-center">
              {rentalVisibleGroups.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => { setRentalWorkGroup(g.id); setRentalEditRow(null); setRentalContractorFilter(''); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${rentalWorkGroup === g.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {g.label}
                </button>
              ))}
              <div className="flex-1" />
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRentalSettlementId(null);
                      setRentalFleetMode('add');
                      setRentalSettlementForm({
                        ...emptyRentalSettlementForm,
                        year_month: rentalSettlementMonth || getPreviousYearMonth()
                      });
                      setIsRentalSettlementModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#009fe3] text-white text-xs font-bold"
                  >
                    Yeni araç / unvan
                  </button>
                  <button type="button" onClick={() => setIsRentalTariffModalOpen(true)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold">Tarife</button>
                </>
              )}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Araç</div>
                <div className="text-lg font-black tabular-nums text-slate-900">{rentalGroupSummary.count}</div>
                <div className="text-[10px] text-slate-400">{rentalGroupLabel} · {rentalSettlementMonth || 'ay'}</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">KDV dahil toplam</div>
                <div className="text-lg font-black tabular-nums text-slate-900">{money(rentalGroupSummary.payable)}</div>
                <div className="text-[10px] text-slate-400">{rentalGroupLabel} · {rentalSettlementMonth || 'ay'}</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">1. ödeme</div>
                <div className="text-lg font-black tabular-nums text-slate-900">{money(rentalGroupSummary.term1)}</div>
                <div className="text-[10px] text-slate-400">Mutabakatın yarısı</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">2. ödeme</div>
                <div className="text-lg font-black tabular-nums text-slate-900">{money(rentalGroupSummary.term2)}</div>
                <div className="text-[10px] text-slate-400">Müşteri mutabakatı ile burayı kıyaslayın</div>
              </div>
            </div>
            {(isAdmin || isReporter) && (
              <div className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-xl border border-slate-200 px-4 py-2.5">
                <p className="text-[11px] text-slate-500">
                  {isAdmin
                    ? 'Tablodaki tutarlar bu grubun açık ayıdır. Liste, ay bitmeden Araç Filosu kiralık işaretine göre eşleşir; km’siz fazla plaka düşer, geçmiş ay durur. Kaydet: onaya alır. Onayla: kilitler. Yönetici kilitli olsa da mutabakat ayının sonraki takvim ayı boyunca düzeltme yapabilir. Saha kilitli kalır.'
                    : 'Salt okuma: kaydet / onay yok. Fiş PDF’lerini indirebilirsiniz.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {isAdmin && (
                    <>
                  {rentalRosterOpen && (
                    <button type="button" onClick={() => handleOpenRentalMonth()} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs font-bold whitespace-nowrap">
                      Filodan eşleştir
                    </button>
                  )}
                  <button type="button" onClick={handleAdminSaveAllRental} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold whitespace-nowrap">
                    Tümünü kaydet
                  </button>
                  <button type="button" onClick={handleAdminApproveAllRental} className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-bold whitespace-nowrap">
                    Tümünü onayla
                  </button>
                    </>
                  )}
                  <button type="button" onClick={handleDownloadAllRentalFis} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs font-bold whitespace-nowrap">
                    Tüm fişler (PDF)
                  </button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] gap-3 items-start">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-100 flex flex-wrap gap-2 items-center">
                  <input type="month" value={rentalSettlementMonth} onChange={e => setRentalSettlementMonth(e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold" />
                  <div className="relative flex-1 min-w-[140px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                    <PortalInput commit="live" value={rentalSettlementSearch} onChange={e => setRentalSettlementSearch(e.target.value)} placeholder="Plaka / fatura kesen" className="w-full pl-7 pr-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
                  </div>
                  <select value={rentalContractorFilter} onChange={e => setRentalContractorFilter(e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white max-w-[180px]">
                    <option value="">Fatura kesen</option>
                    {rentalContractorsInGroup.map((n: string) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <select value={rentalStatusFilter} onChange={e => setRentalStatusFilter(e.target.value as any)} className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white">
                    <option value="all">Durum</option>
                    <option value="draft">Giriş açık</option>
                    <option value="submitted">Onay bekler</option>
                    <option value="approved">Kilitli</option>
                  </select>
                  {(isAdmin || isReporter) && (
                    <>
                      <select value={rentalDownloadContractor} onChange={e => setRentalDownloadContractor(e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white max-w-[160px]">
                        <option value="">İndirilecek unvan</option>
                        {rentalContractorsInGroup.map((n: string) => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <button type="button" onClick={() => rentalDownloadContractor && handleDownloadRentalMutabakat(rentalDownloadContractor)} className="px-2 py-1.5 rounded-lg bg-emerald-700 text-white text-[11px] font-bold">Mutabakat</button>
                    </>
                  )}
                </div>
                <div className="overflow-auto max-h-[70vh]">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-slate-500 font-bold">
                      <tr>
                        <th className="py-2 px-3 cursor-pointer" onClick={() => setRentalListSort('plate')}>Plaka</th>
                        <th className="py-2 px-3 cursor-pointer" onClick={() => setRentalListSort('contractor')}>Fatura kesen</th>
                        <th className="py-2 px-3 text-right">KM</th>
                        {meta.hasWorkDays && <th className="py-2 px-3 text-right">Gün</th>}
                        <th className="py-2 px-3 text-right">{meta.stopLabel}</th>
                        <th className="py-2 px-3">Durum</th>
                        <th className="py-2 px-3 text-right cursor-pointer" onClick={() => setRentalListSort('amount')}>Fatura toplamı</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rentalSettlementRows.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-slate-500">
                            <div>Bu ayda {rentalGroupLabel} satırı yok. Araç Filosu’nda bu gruba işaretli plakalar, ay bitmeden buraya boş açılır; kira önceki aydan gelir.</div>
                            {isAdmin && rentalRosterOpen && rentalFleetRoster.length > 0 && (
                              <button type="button" onClick={() => handleOpenRentalMonth()} className="mt-3 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold">
                                Filodan {rentalFleetRoster.length} plakayı aç
                              </button>
                            )}
                            {isAdmin && rentalRosterOpen && rentalFleetRoster.length === 0 && (
                              <div className="text-[11px] text-slate-400 mt-2">Künyede {rentalGroupLabel} işareti yok. Araç menüsü → Araç Filosu.</div>
                            )}
                            {(!isAdmin || !rentalRosterOpen) && (
                              <div className="text-[11px] text-slate-400 mt-2">
                                {rentalRosterOpen ? 'Yönetici filodan eşleştirir.' : 'Bu ayın kadrosu kilitli. Yönetici Excel veya tek plaka ekler.'}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                      {rentalSettlementRows.map((r: any, idx: number) => {
                        const t = r.totals || rentalSettlementTotals(r);
                        const st = r.status || 'draft';
                        const on = rentalEditRow?.id === r.id;
                        const showGroup = rentalListSort === 'contractor' && (idx === 0 || r.contractor_name !== rentalSettlementRows[idx - 1].contractor_name);
                        return (
                          <React.Fragment key={r.id}>
                            {showGroup && (
                              <tr className="bg-slate-50"><td colSpan={7} className="py-1 px-3 text-[10px] font-bold tracking-wide text-slate-500">{r.contractor_name}</td></tr>
                            )}
                            <tr onClick={() => openRentalEdit(r)} className={`cursor-pointer ${on ? 'bg-blue-50' : st === 'approved' ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}`}>
                              <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">{r.plate}</td>
                              <td className="py-2 px-3 font-semibold text-slate-800">{r.contractor_name}<span className="block text-[10px] font-medium text-slate-400">{r.province || r.region}</span></td>
                              <td className="py-2 px-3 text-right tabular-nums">{kmTxt(r.total_km)}</td>
                              {meta.hasWorkDays && <td className="py-2 px-3 text-right tabular-nums">{parseLocaleNumber(r.work_days)}</td>}
                              <td className="py-2 px-3 text-right tabular-nums">{parseLocaleNumber(r.stop_count)}</td>
                              <td className="py-2 px-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st === 'approved' ? 'bg-emerald-100 text-emerald-800' : st === 'submitted' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{st === 'approved' ? 'Kilitli' : st === 'submitted' ? 'Onay bekler' : 'Giriş açık'}</span></td>
                              <td className="py-2 px-3 text-right font-bold tabular-nums whitespace-nowrap">{money(t.payable)}</td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 min-h-[420px]">
                {!rentalEditRow && (
                  <div className="h-full flex items-center justify-center text-sm text-slate-400 px-6 text-center">Soldan plaka veya fatura kesen satırına tıklayın. Google tablodaki ARAC_RAPOR gibi giriş burada açılır; menü kapanmaz.</div>
                )}
                {rentalEditRow && (
                  <div className="space-y-4">
                    <div className="flex justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{rentalGroupLabel}</div>
                        <div className="font-mono font-black text-lg">{rentalEditRow.plate}</div>
                        <div className="text-sm font-semibold text-slate-700">{rentalEditRow.contractor_name}</div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {meta.rentMode === 'daily'
                            ? `Günlük kira ${money(parseLocaleNumber(rentalSettlementForm.rent_amount || rentalEditRow.rent_amount))} · aylık ${money(rentalMonthlyRent({ ...rentalEditRow, rent_amount: parseLocaleNumber(rentalSettlementForm.rent_amount || rentalEditRow.rent_amount), work_days: parseLocaleNumber(rentalSettlementForm.work_days), work_group: rentalWorkGroup }))}`
                            : `Aylık kira ${money(parseLocaleNumber(rentalSettlementForm.rent_amount || rentalEditRow.rent_amount))}`}
                          {' · '}yakıt oran {parseLocaleNumber(rentalSettlementForm.fuel_rate || rentalEditRow.fuel_rate)}
                        </div>
                      </div>
                      <button type="button" onClick={() => setRentalEditRow(null)} className="text-slate-400 h-7"><X className="w-4 h-4" /></button>
                    </div>
                    {isReporter && <div className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">Rapor hesabı: her şeyi görürsünüz, kayıt / onay / silme yok.</div>}
                    {approved && !adminGrace && !isReporter && <div className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">Yönetici onayladı. Mutabakat kilitli.</div>}
                    {approved && adminGrace && <div className="text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">Saha kilitli. Yönetici {yearMonthTrLabel(rentalAdminGraceUntilMonth(rentalEditRow.year_month))} sonuna kadar düzeltme yapabilir.</div>}
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-amber-800 mb-2">Saha girişi</div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block"><span className="text-[10px] font-bold text-slate-500">Yapılan KM</span><PortalInput value={rentalSettlementForm.total_km} disabled={locked} onChange={e => setRentalSettlementForm({ ...rentalSettlementForm, total_km: e.target.value })} className={entryCls} inputMode="numeric" /></label>
                        {meta.hasWorkDays && <label className="block"><span className="text-[10px] font-bold text-slate-500">Çalışma gün</span><PortalInput value={rentalSettlementForm.work_days} disabled={locked} onChange={e => setRentalSettlementForm({ ...rentalSettlementForm, work_days: e.target.value })} className={entryCls} inputMode="numeric" /></label>}
                        <label className="block"><span className="text-[10px] font-bold text-slate-500">{meta.stopLabel}</span><PortalInput value={rentalSettlementForm.stop_count} disabled={locked} onChange={e => setRentalSettlementForm({ ...rentalSettlementForm, stop_count: e.target.value, visit_prime: moneyInputValue(parseLocaleNumber(e.target.value) * meta.visitUnit) })} className={entryCls} inputMode="numeric" /></label>
                        {meta.hasHgs && <label className="block"><span className="text-[10px] font-bold text-slate-500">HGS ₺</span><PortalInput value={rentalSettlementForm.hgs} disabled={locked} onChange={e => setRentalSettlementForm({ ...rentalSettlementForm, hgs: e.target.value })} className={entryCls} inputMode="decimal" /></label>}
                        <label className="block"><span className="text-[10px] font-bold text-slate-500">Ek iş ₺</span><PortalInput value={rentalSettlementForm.extra_work} disabled={locked} onChange={e => setRentalSettlementForm({ ...rentalSettlementForm, extra_work: e.target.value })} onBlur={e => setRentalSettlementForm(f => ({ ...f, extra_work: moneyInputValue(e.target.value) }))} className={entryCls} inputMode="decimal" /></label>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">{meta.stopLabel} × {meta.visitUnit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ = {money(stopCount * meta.visitUnit)} uğrama (otomatik)</p>
                    </div>
                    {isAdmin && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">Yönetici · zam / tarife</div>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block">
                            <span className="text-[10px] font-bold text-slate-500">{meta.rentMode === 'daily' ? 'Günlük kira ₺' : 'Aylık kira ₺'}</span>
                            <PortalInput value={rentalSettlementForm.rent_amount} disabled={locked} onChange={e => setRentalSettlementForm({ ...rentalSettlementForm, rent_amount: e.target.value })} className={adminCls} inputMode="decimal" />
                            {meta.rentMode === 'daily' && (
                              <span className="block text-[10px] text-slate-400 mt-0.5">Aylık = günlük × çalışma gün</span>
                            )}
                          </label>
                          <label className="block"><span className="text-[10px] font-bold text-slate-500">Yakıt oranı</span><PortalInput value={rentalSettlementForm.fuel_rate} disabled={locked} onChange={e => setRentalSettlementForm({ ...rentalSettlementForm, fuel_rate: e.target.value })} className={adminCls} inputMode="decimal" /></label>
                          <label className="block"><span className="text-[10px] font-bold text-slate-500">Yakıt birim ₺</span><PortalInput value={rentalSettlementForm.fuel_unit_price} disabled={locked} onChange={e => setRentalSettlementForm({ ...rentalSettlementForm, fuel_unit_price: e.target.value })} className={adminCls} inputMode="decimal" /></label>
                          <label className="block"><span className="text-[10px] font-bold text-slate-500">Yakıt kesintisi ₺</span><PortalInput value={rentalSettlementForm.fuel_charge} disabled={locked} onChange={e => setRentalSettlementForm({ ...rentalSettlementForm, fuel_charge: e.target.value })} className={adminCls} inputMode="decimal" /></label>
                          <label className="block col-span-2"><span className="text-[10px] font-bold text-slate-500">Uğrama primi override ₺</span><PortalInput value={rentalSettlementForm.visit_prime} disabled={locked} onChange={e => setRentalSettlementForm({ ...rentalSettlementForm, visit_prime: e.target.value })} className={adminCls} inputMode="decimal" /></label>
                        </div>
                      </div>
                    )}
                    {live && (
                      <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Ödenecek mutabakat</div>
                        <div className="text-xl font-black tabular-nums">{money(live.payable)}</div>
                        <div className="text-[11px] text-slate-500 mt-1">Yakıt geliri {money(live.fuelIncome)} · brüt {money(live.brut)} · KDV {money(live.kdv)} · tevkifat {money(live.stoppage)}</div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {!locked && <button type="button" onClick={handleSaveRentalEntry} className="flex-1 py-2 rounded-lg bg-[#009fe3] text-white text-sm font-bold">{approved ? 'Düzeltmeyi kaydet' : 'Kaydet ve onaya gönder'}</button>}
                      {isAdmin && rentalEditRow.status === 'submitted' && (
                        <button type="button" onClick={() => { handlePatchRentalField(rentalEditRow.id, 'status', 'approved'); }} className="px-3 py-2 rounded-lg bg-emerald-700 text-white text-sm font-bold">Onayla ve kilitle</button>
                      )}
                      {isAdmin && !locked && (
                        <button
                          type="button"
                          onClick={() => { setRentalFleetMode('identity'); setIsRentalSettlementModalOpen(true); }}
                          className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold"
                        >
                          Plaka / unvan
                        </button>
                      )}
                      {isAdmin && !locked && (
                        <button type="button" onClick={() => handleDeleteRentalSettlement(rentalEditRow.id)} className="px-3 py-2 rounded-lg border border-rose-200 text-rose-700 text-xs font-bold">Bu aydan çıkar</button>
                      )}
                      <button type="button" onClick={() => setRentalReportRow({ ...rentalEditRow, totals: live })} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold">Fiş</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          );
        })()}

        {activeTab === 'plate_rentals' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Belge Plaka Kiraları ({dbPlateRentals.length} araç)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lojistik belgeye kayıtlı plakalar. Kira veya yalnız devlet ödemesi. 0 bedel yine yenilemeye girer. Kasa ve cariye yazılmaz. Yenilemeye 30 ve 15 gün kala kırmızı uyarı.
                </p>
              </div>
              {isAdmin && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm">
                    <FileUp className="w-4 h-4" /> Excel yükle
                    <input type="file" accept=".xlsx,.xls" onChange={handleImportPlateRentals} className="hidden" />
                  </label>
                  <button
                    onClick={() => {
                      setEditingPlateRentalId(null);
                      setPlateRentalForm(emptyPlateRentalForm);
                      setIsPlateRentalModalOpen(true);
                    }}
                    className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Yeni plaka
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {(['all', ...PLATE_VEHICLE_TYPES] as const).map(t => {
                    const count = t === 'all' ? dbPlateRentals.length : dbPlateRentals.filter((r: any) => plateVehicleTypeOf(r) === t).length;
                const on = plateRentalTypeFilter === t;
                return (
                  <button
                    key={t}
                    onClick={() => setPlateRentalTypeFilter(t)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
                  >
                    {t === 'all' ? `Tümü (${count})` : `${t} (${count})`}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  value={plateRentalSearch}
                  onChange={e => setPlateRentalSearch(e.target.value)}
                  placeholder="Plaka, sahip, telefon, tip ara"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <select
                value={plateRentalSort}
                onChange={e => setPlateRentalSort(e.target.value as typeof plateRentalSort)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="renewal">Sıra: yenileme / uyarı</option>
                <option value="plate">Sıra: plaka</option>
                <option value="owner">Sıra: sahip</option>
                <option value="type">Sıra: araç tipi</option>
                <option value="amount">Sıra: tutar</option>
              </select>
              <span className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                Listede {plateRentalRows.length} / {dbPlateRentals.length} araç
              </span>
              <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl">
                {plateRentalRows.filter((r: any) => r.alert).length} yaklaşan / geçmiş yenileme
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Plaka</th>
                    <th className="py-3 px-3">Araç tipi</th>
                    <th className="py-3 px-3">Sahip / telefon</th>
                    <th className="py-3 px-3">Tahsilat</th>
                    <th className="py-3 px-3 text-right">Tutar</th>
                    <th className="py-3 px-3">Yenileme</th>
                    <th className="py-3 px-3">Not</th>
                    {isAdmin && <th className="py-3 px-3 text-center">İşlem</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {plateRentalRows.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="py-8 text-center text-slate-400">
                        Kayıt yok. SQL’de setup_plate_rentals.sql çalıştırıp Excel yükleyin veya yeni plaka ekleyin.
                      </td>
                    </tr>
                  )}
                  {plateRentalRows.map((r: any) => {
                    const amt = r.collection_kind === 'devlet' ? cleanNumber(r.government_fee) : cleanNumber(r.rent_amount);
                    const warn = r.alert;
                    return (
                      <tr key={r.id} className={warn ? 'bg-rose-100 text-rose-900' : 'hover:bg-slate-50'}>
                        <td className="py-3 px-3 font-mono font-bold">{r.plate}</td>
                        <td className="py-3 px-3 font-semibold">{plateVehicleTypeOf(r) || '—'}</td>
                        <td className="py-3 px-3">
                          <span className={`font-bold block ${warn ? 'text-rose-900' : 'text-slate-800'}`}>{r.owner_name}</span>
                          <span className={`text-[11px] ${warn ? 'text-rose-700' : 'text-slate-500'}`}>{r.phone || 'Telefon yok'}</span>
                        </td>
                        <td className="py-3 px-3">
                          {r.collection_kind === 'devlet' ? 'Yalnız devlet' : (amt === 0 ? '0 bedel kira' : 'Yıllık kira')}
                        </td>
                        <td className="py-3 px-3 text-right font-bold">
                          {amt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={warn ? 'font-black' : ''}>{formatDateTR(r.renewal_date) || '—'}</span>
                          {warn === 'overdue' && (
                            <span className="block text-[10px] font-bold">
                              {r.days === 0 ? 'Bugün yenileme' : `${Math.abs(r.days)} gün geçti`}
                            </span>
                          )}
                          {warn === 'd15' && <span className="block text-[10px] font-bold">15 gün kala</span>}
                          {warn === 'd30' && <span className="block text-[10px] font-bold">30 gün kala</span>}
                        </td>
                        <td className="py-3 px-3 text-slate-600 max-w-[220px]">
                          {[r.payment_note, stripPlateTypeTag(r.notes)].filter(Boolean).join(' · ') || '—'}
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-3 text-center space-x-1">
                            <button
                              onClick={() => {
                                setEditingPlateRentalId(r.id);
                                setPlateRentalForm({
                                  plate: r.plate || '',
                                  owner_name: r.owner_name || '',
                                  phone: r.phone || '',
                                  start_date: sanitizeDate(r.start_date),
                                  renewal_date: sanitizeDate(r.renewal_date),
                                  rent_amount: String(r.rent_amount ?? ''),
                                  government_fee: String(r.government_fee ?? ''),
                                  collection_kind: r.collection_kind === 'devlet' ? 'devlet' : 'kira',
                                  payment_note: r.payment_note || '',
                                  next_amount: r.next_amount === null || r.next_amount === undefined ? '' : String(r.next_amount),
                                  notes: stripPlateTypeTag(r.notes),
                                  vehicle_type: (plateVehicleTypeOf(r) as typeof plateRentalForm.vehicle_type) || ''
                                });
                                setIsPlateRentalModalOpen(true);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                              title="Düzenle"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePlateRental(r.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isRentalTariffModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => setIsRentalTariffModalOpen(false))}>
            <form onSubmit={handleSaveRentalTariff} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-3 text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-900">İl ve araç tipi tarife</h3>
                <button type="button" onClick={() => setIsRentalTariffModalOpen(false)} className="text-slate-400"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-[11px] text-slate-500">Aynı ilde tüm araçlar aynı olabilir; başka ilde veya çekici/kamyonda kira ve yakıt oranı ayrı girilir. Satıra özel tutar yine satırda değiştirilebilir.</p>
              <PortalInput value={rentalTariffForm.province} onChange={e => setRentalTariffForm({ ...rentalTariffForm, province: e.target.value })} placeholder="İl / bölge (ör. Batı Marmara, Bursa)" className="w-full px-3 py-2 border border-slate-200 rounded-lg" required />
              <select value={rentalTariffForm.vehicle_type} onChange={e => setRentalTariffForm({ ...rentalTariffForm, vehicle_type: e.target.value as any })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" required>
                <option value="">Araç tipi</option>
                {PLATE_VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <PortalInput value={rentalTariffForm.rent_amount} onChange={e => setRentalTariffForm({ ...rentalTariffForm, rent_amount: e.target.value })} placeholder="Kira bedeli" className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              <PortalInput value={rentalTariffForm.fuel_rate} onChange={e => setRentalTariffForm({ ...rentalTariffForm, fuel_rate: e.target.value })} placeholder="Yakıt oranı (100 km/lt)" className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setIsRentalTariffModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-[#009fe3] text-white font-bold">Kaydet</button>
              </div>
            </form>
          </div>
        )}

        {isRentalSettlementModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => setIsRentalSettlementModalOpen(false))}>
            <form
              onSubmit={rentalFleetMode === 'identity' ? handleSaveRentalIdentity : handleSaveRentalSettlement}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-3 text-sm"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-900">{rentalFleetMode === 'identity' ? 'Plaka / fatura kesen' : `Yeni araç · ${rentalGroupLabel}`}</h3>
                <button type="button" onClick={() => setIsRentalSettlementModalOpen(false)} className="text-slate-400"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-[11px] text-slate-500">
                {rentalFleetMode === 'identity'
                  ? 'Bu ayın satırında plaka veya fatura kesen değişir. Yeni unvanı yazmanız yeter; ayrı cari açılmaz.'
                  : 'KM ve gün boş açılır. Mevcut unvanı listeden seçin veya yeni alt yüklenici adını yazın.'}
              </p>
              <datalist id="rental-contractor-names">
                {rentalContractorNames.map((n: string) => <option key={n} value={n} />)}
              </datalist>
              <div className="grid grid-cols-2 gap-2">
                {rentalFleetMode === 'add' && (
                  <input type="month" value={rentalSettlementForm.year_month} onChange={e => setRentalSettlementForm({ ...rentalSettlementForm, year_month: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg col-span-2" required />
                )}
                <PortalInput value={rentalSettlementForm.plate} onChange={e => setRentalSettlementForm({ ...rentalSettlementForm, plate: e.target.value })} placeholder="Plaka" className="px-3 py-2 border border-slate-200 rounded-lg uppercase font-mono" required />
                <PortalInput value={rentalSettlementForm.contractor_name} onChange={e => setRentalSettlementForm({ ...rentalSettlementForm, contractor_name: e.target.value })} list="rental-contractor-names" placeholder="Fatura kesen / yeni unvan" className="px-3 py-2 border border-slate-200 rounded-lg" required />
                <PortalInput value={rentalSettlementForm.province} onChange={e => setRentalSettlementForm(applyTariffToSettlementForm(e.target.value, rentalSettlementForm.vehicle_type, { ...rentalSettlementForm, province: e.target.value }))} placeholder="Bölge / il" className="px-3 py-2 border border-slate-200 rounded-lg col-span-2" />
                <select
                  value={rentalSettlementForm.vehicle_type}
                  onChange={e => setRentalSettlementForm(applyTariffToSettlementForm(rentalSettlementForm.province, e.target.value, { ...rentalSettlementForm, vehicle_type: e.target.value as any }))}
                  className="px-3 py-2 border border-slate-200 rounded-lg col-span-2"
                >
                  <option value="">Araç tipi (tarifeden kira/oran)</option>
                  {PLATE_VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <PortalInput value={rentalSettlementForm.rent_amount} onChange={e => setRentalSettlementForm({ ...rentalSettlementForm, rent_amount: e.target.value })} placeholder={rentalGroupMeta(rentalWorkGroup).rentMode === 'daily' ? 'Günlük kira' : 'Aylık kira'} className="px-3 py-2 border border-slate-200 rounded-lg" />
                <PortalInput value={rentalSettlementForm.fuel_rate} onChange={e => setRentalSettlementForm({ ...rentalSettlementForm, fuel_rate: e.target.value })} placeholder="Yakıt oranı" className="px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsRentalSettlementModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-[#009fe3] text-white font-bold">{rentalFleetMode === 'identity' ? 'Değiştir' : 'Ekle'}</button>
              </div>
            </form>
          </div>
        )}

        {rentalReportRow && (() => {
          const r = rentalReportRow;
          const t = r.totals || rentalSettlementTotals(r);
          const money = (n: number) => `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
          return (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => setRentalReportRow(null))}>
              <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-100 space-y-4">
                <div className="relative pb-3 border-b-2 border-[#009fe3]">
                  <button type="button" onClick={() => setRentalReportRow(null)} className="absolute -top-1 -right-1 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
                  <div className="flex items-center justify-between gap-4 pr-8">
                    <img src={COMPANY_IDENTITY.tazeyolLogo} alt="Tazeyol" className="h-10 object-contain" />
                    <img src={COMPANY_IDENTITY.alkanLogo} alt="Alkan Nakliyat" className="h-10 object-contain" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">{COMPANY_IDENTITY.tagline}</p>
                </div>
                <div className="text-center">
                  <div className="text-xs font-black tracking-wider text-[#009fe3]">ARAÇ MUTABAKAT RAPORU</div>
                  <div className="text-sm font-bold">{r.year_month} · {r.plate}</div>
                </div>
                <div className="text-xs overflow-hidden rounded-lg border border-slate-100">
                  {[
                    ['Fatura kesen', r.contractor_name],
                    ['İl / bölge', r.province || r.region || '—'],
                    ['Kira', money(cleanNumber(r.rent_amount))],
                    ['Yakıt oranı / birim', `${cleanNumber(r.fuel_rate)} · ${money(cleanNumber(r.fuel_unit_price))}`],
                    ['KM / gün / nokta', `${cleanNumber(r.total_km).toLocaleString('tr-TR')} · ${cleanNumber(r.work_days)} · ${cleanNumber(r.stop_count)}`],
                    ['Yakıt geliri', money(t.fuelIncome)],
                    ['Uğrama', money(cleanNumber(r.visit_prime))],
                    ['Ek', money(cleanNumber(r.extra_work))],
                    ['HGS', money(cleanNumber(r.hgs))],
                    ['Yakıt kesintisi', money(cleanNumber(r.fuel_charge))],
                    ['Brüt / KDV / tevkifat', `${money(t.brut)} · ${money(t.kdv)} · ${money(t.stoppage)}`]
                  ].map(([k, v], i) => (
                    <div key={k} className={`flex justify-between px-3 py-1.5 ${i % 2 ? 'bg-slate-100' : 'bg-white'}`}>
                      <span className="text-slate-500">{k}</span><b>{v}</b>
                    </div>
                  ))}
                </div>
                <div className="bg-[#0f2744] text-white rounded-xl px-4 py-3">
                  <div className="text-[10px] tracking-widest text-white/70">ÖDENECEK MUTABAKAT</div>
                  <div className="text-xl font-black">{money(t.payable)}</div>
                  <div className="text-[11px] text-white/80 mt-1">1. ödeme {money(t.term1)} · 2. ödeme {money(t.term2)}</div>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  <b className="text-slate-800">{COMPANY_IDENTITY.legalName}</b><br />
                  {COMPANY_IDENTITY.address}<br />
                  {COMPANY_IDENTITY.district} · {COMPANY_IDENTITY.phone}<br />
                  PDF eki: {rentalFisFileName(r)}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => downloadBlob(await buildRentalFisPdf(r), rentalFisFileName(r))}
                    className="flex-1 py-2 rounded-lg bg-slate-800 text-white text-xs font-bold"
                  >
                    PDF indir
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {isPlateRentalModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => setIsPlateRentalModalOpen(false))}>
            <form onSubmit={handleSavePlateRental} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 space-y-3 text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-900">{editingPlateRentalId ? 'Plaka kaydını düzenle' : 'Yeni plaka'}</h3>
                <button type="button" onClick={() => setIsPlateRentalModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Plaka</label>
                  <input required value={plateRentalForm.plate} onChange={e => setPlateRentalForm({ ...plateRentalForm, plate: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Araç tipi</label>
                  <select
                    value={plateRentalForm.vehicle_type}
                    onChange={e => setPlateRentalForm({ ...plateRentalForm, vehicle_type: e.target.value as typeof plateRentalForm.vehicle_type })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value="">Seçin</option>
                    {PLATE_VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Plaka sahibi</label>
                <input required value={plateRentalForm.owner_name} onChange={e => setPlateRentalForm({ ...plateRentalForm, owner_name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Telefon</label>
                <PortalInput value={plateRentalForm.phone} onChange={e => setPlateRentalForm({ ...plateRentalForm, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ne alıyoruz?</label>
                <select
                  value={plateRentalForm.collection_kind}
                  onChange={e => setPlateRentalForm({ ...plateRentalForm, collection_kind: e.target.value as 'kira' | 'devlet' })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="kira">Yıllık kira (0 bedel olabilir)</option>
                  <option value="devlet">Yalnız devlet ödemesi</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kira tutarı</label>
                  <PortalInput value={plateRentalForm.rent_amount} onChange={e => setPlateRentalForm({ ...plateRentalForm, rent_amount: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" placeholder="0" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Devlet tutarı</label>
                  <PortalInput value={plateRentalForm.government_fee} onChange={e => setPlateRentalForm({ ...plateRentalForm, government_fee: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" placeholder="5000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Başlangıç</label>
                  <input type="date" value={plateRentalForm.start_date} onChange={e => setPlateRentalForm({ ...plateRentalForm, start_date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Yenileme tarihi</label>
                  <input type="date" value={plateRentalForm.renewal_date} onChange={e => setPlateRentalForm({ ...plateRentalForm, renewal_date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ödeme notu</label>
                  <PortalInput value={plateRentalForm.payment_note} onChange={e => setPlateRentalForm({ ...plateRentalForm, payment_note: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" placeholder="Ödendi / 5K ödedi" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sonraki tutar</label>
                  <PortalInput value={plateRentalForm.next_amount} onChange={e => setPlateRentalForm({ ...plateRentalForm, next_amount: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Açıklama (plaka değişimi vb.)</label>
                <PortalInput value={plateRentalForm.notes} onChange={e => setPlateRentalForm({ ...plateRentalForm, notes: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl">Kaydet</button>
            </form>
    </div>
 )}

{/* MODAL: ALT YÜKLENİCİ CARİ DETAYI VE AVANS YÖNETİMİ */}
  {selectedSubcontractorForDetail && (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={e => dismissIfBackdrop(e, () => setSelectedSubcontractorForDetail(null))}>
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">{selectedSubcontractorForDetail.company_name || selectedSubcontractorForDetail.name}</h3>
            <span className="text-sm text-slate-500 font-mono">Vergi No: {selectedSubcontractorForDetail.computedTax || '-'} • IBAN: {selectedSubcontractorForDetail.iban || 'Belirtilmedi'}</span>
          </div>
          <div className="flex items-center gap-2">
          <button
              type="button"
              onClick={() => {
                const subName = selectedSubcontractorForDetail.company_name || selectedSubcontractorForDetail.name || '';
                const taxNo = selectedSubcontractorForDetail.tax_no || selectedSubcontractorForDetail.computedTax || 'Belirtilmedi';
                const ibanVal = selectedSubcontractorForDetail.iban || 'Belirtilmedi';
                const ledger = selectedSubcontractorLedger;
                let csvContent = "\uFEFF";
                csvContent += "Firma Adı;Vergi Numarası;IBAN;Tarih;İşlem Türü;Açıklama;Borç (Fatura);Alacak (Ödeme/Avans);Bakiye\n";
                ledger.forEach(tx => {
                  csvContent += `"${subName}";"${taxNo}";"${ibanVal}";"${tx.date ? formatDateTR(tx.date) : '-'}";"${tx.type}";"${tx.desc}";"${formatMoneyTR(tx.debit)}";"${formatMoneyTR(tx.credit)}";"${formatMoneyTR(tx.balance)}"\n`;
                });
                const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `${subName.replace(/[^a-zA-Z0-9]/g, '_')}_cari_mutabakat.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
              📥 Mutabakat Raporunu İndir (Excel)
            </button>
            <button onClick={() => setSelectedSubcontractorForDetail(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition">Kapat</button>
          </div>
        </div>

        <div className="py-4 flex-1 overflow-y-auto space-y-4 text-sm">
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex justify-between items-center">
            <div>
              <span className="text-blue-900 font-semibold block text-base">Cari Hesap Özeti</span>
              <span className="text-xs text-blue-700">Artı bakiye: taşerona borcunuz. Eksi: avans / fazla ödeme.</span>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-blue-900">{(selectedSubcontractorLedger.length ? selectedSubcontractorLedger[selectedSubcontractorLedger.length - 1].balance : 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
              <span className="text-xs text-blue-700 block mt-0.5">Güncel Bakiye</span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-slate-800 block">➕ Yeni Cari Hareket Ekle</span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => openContractorAdvance(selectedSubcontractorForDetail)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg">
                  Peşin / taksitli avans ver
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select id="sub_tx_type" className="px-3 py-2 border border-slate-200 rounded-lg bg-white font-medium text-sm">
                <option value="payment">Düzeltme notu (alacak)</option>
                <option value="invoice">Düzeltme notu (borç)</option>
              </select>
              <input id="sub_tx_amount" type="number" placeholder="Tutar (TL)" className="px-3 py-2 border border-slate-200 rounded-lg bg-white font-bold text-slate-800 text-sm" />
              <PortalInput id="sub_tx_desc" type="text" placeholder="Açıklama / Belge No" className="px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm" />
            </div>
            <button
              type="button"
              onClick={async () => {
                const typeEl = document.getElementById('sub_tx_type') as HTMLSelectElement;
                const amountEl = document.getElementById('sub_tx_amount') as HTMLInputElement;
                const descEl = document.getElementById('sub_tx_desc') as HTMLInputElement;
                const amt = cleanNumber(amountEl.value);
                if (amt <= 0) return alert('Lütfen geçerli bir tutar giriniz.');
                try {
                  const { error } = await supabase.from('subcontractor_ledger').insert([{
                    subcontractor_id: selectedSubcontractorForDetail.id,
                    transaction_type: typeEl.value,
                    amount: amt,
                    description: descEl.value || 'Cari Hareket'
                  }]);
                  if (error) throw error;
                  alert('Hareket başarıyla kaydedildi!');
                  amountEl.value = ''; descEl.value = '';
                  await loadPortalData();
                } catch (err: any) { alert('Hata: ' + err.message); }
              }}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition shadow-sm">
              Hareketi Kaydet
            </button>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-slate-800">Geçmiş Cari Hareketler</h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Tarih</th>
                    <th className="py-2.5 px-3">İşlem Türü</th>
                    <th className="py-2.5 px-3">Açıklama</th>
                    <th className="py-2.5 px-3 text-right">Borç</th>
                    <th className="py-2.5 px-3 text-right">Alacak</th>
                    <th className="py-2.5 px-3 text-right">Bakiye</th>
                    <th className="py-2.5 px-3 text-center">İşlem</th>
                  </tr>
                </thead>
               <tbody className="divide-y divide-slate-100 bg-white">
                  {(() => {
                    const ledger = selectedSubcontractorLedger;
                    if (ledger.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-400 italic">Bu taşerona ait kayıt bulunamadı.</td>
                        </tr>
                      );
                    }
                    return ledger.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 text-slate-500">{tx.date ? formatDateTR(tx.date) : '-'}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-700">{tx.type}</td>
                        <td className="py-2.5 px-3 text-slate-600">{tx.desc}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">{tx.debit ? tx.debit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺' : '—'}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-amber-700">{tx.credit ? tx.credit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺' : '—'}</td>
                        <td className={`py-2.5 px-3 text-right font-black ${tx.balance >= 0 ? 'text-blue-900' : 'text-rose-700'}`}>{tx.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</td>
                        <td className="py-2.5 px-3 text-center">
                          {tx.isManual ? (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm('Bu hareketi silmek istediğinize emin misiniz?')) return;
                                try {
                                  const { error } = await supabase.from('subcontractor_ledger').delete().eq('id', tx.rawId);
                                  if (error) throw error;
                                  alert('Hareket silindi.');
                                  await loadPortalData();
                                } catch (err: any) { alert('Silme hatası: ' + err.message); }
                              }}
                              className="text-red-500 hover:text-red-700 font-bold px-2 py-1 rounded bg-red-50 hover:bg-red-100 transition">
                              Sil
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs">Otomatik</span>
                      )}
                    </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )}

        {activeTab === 'users' && isAdmin && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900">Kullanıcı yetkileri</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-3xl">
                    <b>Kullanıcı ekle</b> ile e-posta ve şifreyi yazın; hesap burada açılır. Karttan e-posta, ad ve <b>aktif / pasif</b> değişir. Pasif hesap giriş yapamaz. Unutan kişi için karttaki <b>yeni şifre</b> kutusuna yazıp sıfırlayın.
                    Her satırda menüler <b>Kapalı / Görür / İşler</b> olarak görünür: yönetici tümünde İşler, rapor tümünde Görür (kilitli). Personelde her menü ayrı seçilir.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void loadPortalUsers()} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold">Listeyi yenile</button>
                  <button type="button" onClick={() => { setNewPortalUserOpen(v => !v); setNewPortalUserHint(''); }} className="px-3 py-2 rounded-lg bg-[#009fe3] text-white text-xs font-bold">
                    {newPortalUserOpen ? 'Vazgeç' : 'Kullanıcı ekle'}
                  </button>
                </div>
              </div>
              {newPortalUserOpen && (
                <form onSubmit={handleCreatePortalUser} className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end border-t border-slate-100 pt-3">
                  <label className="block lg:col-span-2">
                    <span className="text-[10px] font-bold text-slate-500">E-posta</span>
                    <PortalInput value={newPortalUser.email} onChange={e => setNewPortalUser({ ...newPortalUser, email: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm" type="email" required />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold text-slate-500">Şifre (min 8)</span>
                    <PortalInput value={newPortalUser.password} onChange={e => setNewPortalUser({ ...newPortalUser, password: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm" type="text" minLength={8} required />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold text-slate-500">Ad</span>
                    <PortalInput value={newPortalUser.full_name} onChange={e => setNewPortalUser({ ...newPortalUser, full_name: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm" />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold text-slate-500">Rol</span>
                    <select value={newPortalUser.role} onChange={e => setNewPortalUser({ ...newPortalUser, role: e.target.value as 'admin' | 'reporter' | 'saha' })} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white">
                      <option value="saha">Personel</option>
                      <option value="reporter">Rapor</option>
                      <option value="admin">Yönetici</option>
                    </select>
                  </label>
                  <button type="submit" disabled={newPortalUserBusy} className="sm:col-span-2 lg:col-span-5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold disabled:opacity-60">
                    {newPortalUserBusy ? 'Açılıyor…' : 'Kaydet / oluştur'}
                  </button>
                </form>
              )}
              {newPortalUserHint && (
                <pre className="mt-3 text-[11px] bg-amber-50 border border-amber-200 text-amber-950 rounded-xl p-3 whitespace-pre-wrap font-sans">{newPortalUserHint}</pre>
              )}
            </div>
            {portalUsersError && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-xl px-4 py-3">{portalUsersError}</div>
            )}
            {portalUsersBusy && <div className="text-sm text-slate-400 p-6">Yükleniyor…</div>}
            <div className="space-y-3">
              {portalUsers.map((u: any) => {
                const liveGroups = normalizeGroups(u.rental_work_groups, u.rental_work_group);
                const liveAccess = normalizeAccess(u.portal_access);
                const liveFilo = normalizeGroups(u.filo_depots);
                const draft = userDrafts[u.id] || {
                  email: u.email || '',
                  full_name: u.full_name || '',
                  role: u.role as 'admin' | 'reporter' | 'saha',
                  is_active: u.is_active !== false,
                  groups: liveGroups,
                  filoDepots: liveFilo,
                  access: liveAccess
                };
                const groups = draft.groups;
                const access = draft.access;
                const patchDraft = (part: Partial<typeof draft>) => {
                  setUserSaveOkId(prev => prev === u.id ? null : prev);
                  setUserDrafts(prev => ({
                    ...prev,
                    [u.id]: { ...draft, ...part }
                  }));
                };
                const saveUser = async () => {
                  setUserSaveBusyId(u.id);
                  const ok = await handleSavePortalUser(u, {
                    email: draft.email,
                    full_name: draft.full_name,
                    role: draft.role,
                    is_active: draft.is_active,
                    rental_work_groups: draft.groups,
                    filo_depots: draft.filoDepots,
                    portal_access: draft.access
                  });
                  setUserSaveBusyId(null);
                  if (ok) {
                    setUserDrafts(prev => {
                      const next = { ...prev };
                      delete next[u.id];
                      return next;
                    });
                    await loadPortalUsers();
                    setUserSaveOkId(u.id);
                  }
                };
                return (
                  <div key={u.id} className={`bg-white rounded-2xl border p-4 space-y-3 ${draft.is_active === false ? 'opacity-70 border-slate-200' : u.id === currentUserId ? 'border-[#009fe3]' : 'border-slate-200'}`}>
                    <div className="flex flex-wrap gap-2 items-center">
                      {u.id === currentUserId ? <span className="text-[10px] font-bold text-[#009fe3]">Siz</span> : null}
                      <input
                        type="email"
                        value={draft.email}
                        onChange={e => patchDraft({ email: e.target.value })}
                        className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm min-w-[220px] font-semibold"
                      />
                      <input
                        value={draft.full_name}
                        onChange={e => patchDraft({ full_name: e.target.value })}
                        placeholder="Ad"
                        className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm min-w-[140px]"
                      />
                      <select
                        value={draft.role}
                        onChange={e => patchDraft({ role: e.target.value as 'admin' | 'reporter' | 'saha' })}
                        className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white"
                      >
                        <option value="admin">Yönetici</option>
                        <option value="reporter">Rapor (salt okuma)</option>
                        <option value="saha">Personel (yetkili)</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => patchDraft({ is_active: !draft.is_active })}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border ${draft.is_active !== false ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}
                      >
                        {draft.is_active !== false ? 'Aktif' : 'Pasif'}
                      </button>
                    </div>
                    {draft.role === 'saha' && (
                      <>
                        <div className="flex flex-wrap gap-1.5">
                          {ACCESS_PRESETS.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => patchDraft({ access: { ...p.access } })}
                              className="px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-50"
                            >
                              Şablon: {p.label}
                            </button>
                          ))}
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Kiralık gruplar (birden fazla işaretlenebilir)</div>
                          <div className="flex flex-wrap gap-2">
                            {RENTAL_WORK_GROUPS.map(g => (
                              <label key={g.id} className={`text-xs font-semibold px-2 py-1 rounded-lg border cursor-pointer ${groups.includes(g.id) ? 'bg-[#009fe3] text-white border-[#009fe3]' : 'bg-white text-slate-600 border-slate-200'}`}>
                                <input type="checkbox" className="hidden" checked={groups.includes(g.id)} onChange={() => {
                                  const next = groups.includes(g.id) ? groups.filter((x: string) => x !== g.id) : [...groups, g.id];
                                  patchDraft({ groups: next });
                                }} />
                                {g.label}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Filo depolar (Ortak tablo otomatik)</div>
                          <div className="flex flex-wrap gap-2">
                            {filoWorkDepots(dbFiloDepots).map(g => (
                              <label key={g.id} className={`text-xs font-semibold px-2 py-1 rounded-lg border cursor-pointer ${(draft.filoDepots || []).includes(g.id) ? 'bg-[#009fe3] text-white border-[#009fe3]' : 'bg-white text-slate-600 border-slate-200'}`}>
                                <input type="checkbox" className="hidden" checked={(draft.filoDepots || []).includes(g.id)} onChange={() => {
                                  const cur = draft.filoDepots || [];
                                  const next = cur.includes(g.id) ? cur.filter((x: string) => x !== g.id) : [...cur, g.id];
                                  patchDraft({ filoDepots: next });
                                }} />
                                {g.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Menüler · kapalı / görür / işler</div>
                      <p className="text-[10px] text-slate-500 mb-1">
                        {draft.role === 'saha'
                          ? 'Personelde menü kapalıysa o kişi görmez. Gece saha için Hal saha = İşler; yalnız bakacak hesapta Görür veya Kapalı.'
                          : draft.role === 'reporter'
                            ? 'Rapor hesabında tüm menüler Görür, kayıt yok. Bu kilit rolün kendisinden gelir.'
                            : 'Yöneticide tüm menüler İşler. Bu kilit rolün kendisinden gelir.'}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                        {(() => {
                          const shown = displayAccess(draft.role, access);
                          const locked = draft.role !== 'saha';
                          return PORTAL_MODULES.map(m => (
                            <label key={m.id} className="flex items-center justify-between gap-2 text-[11px] px-2 py-1 rounded-lg bg-slate-50">
                              <span className="text-slate-700">{m.label}</span>
                              <select
                                value={shown[m.id] || ''}
                                disabled={locked}
                                onChange={e => {
                                  const next = { ...access };
                                  const level = e.target.value as '' | AccessLevel;
                                  if (!level) delete next[m.id];
                                  else next[m.id] = level;
                                  patchDraft({ access: next });
                                }}
                                className="text-[11px] font-semibold border border-slate-200 rounded px-1 py-0.5 bg-white disabled:bg-slate-100 disabled:text-slate-500"
                              >
                                <option value="">Kapalı</option>
                                <option value="view">Görür</option>
                                <option value="edit">İşler</option>
                              </select>
                            </label>
                          ));
                        })()}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        disabled={userSaveBusyId === u.id}
                        onClick={() => void saveUser()}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-60"
                      >
                        {userSaveBusyId === u.id ? 'Kaydediliyor…' : 'Kaydet / uygula'}
                      </button>
                      {userSaveOkId === u.id && (
                        <span className="text-xs font-bold text-emerald-700">Kaydedildi. Kullanıcı çıkıp tekrar girerse menü güncellenir.</span>
                      )}
                      <label className="ml-auto">
                        <span className="block text-[10px] font-bold text-slate-500">Yeni şifre (min 8)</span>
                        <PortalInput
                          type="text"
                          autoComplete="new-password"
                          value={resetPwById[u.id] || ''}
                          onChange={e => setResetPwById(prev => ({ ...prev, [u.id]: e.target.value }))}
                          className="w-40 px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={resetPwBusyId === u.id}
                        onClick={() => void handleResetPortalPassword(u)}
                        className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {resetPwBusyId === u.id ? 'Yazılıyor…' : 'Şifreyi sıfırla'}
                      </button>
                      {resetPwOkId === u.id && (
                        <span className="text-xs font-bold text-emerald-700">Şifre değişti. Kullanıcı yeni şifreyle girer.</span>
                      )}
                    </div>
                  </div>
                );
              })}
      </div>
    </div>
  )}
  </main>
      <PortalTechFooter />
</div>
  );
} 
