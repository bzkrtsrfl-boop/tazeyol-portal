import { previousYearMonth, yearMonthTrLabel } from './disAlim';

/** Bu menüye özel. Kasa / Gelir Gider formüllerine bağlanmaz. */

const SKIP_OPERATING_OUT = new Set([
  'customer_collection',
  'customer_advance',
  'cash_deposit',
  'freight_sales',
  'subcontractor_invoice',
  'subcontractor_paid_outflow',
  'subcontractor_advance_paid',
  'opening_balance',
  'credit_card_payment'
]);

const CAT_LABELS: Record<string, string> = {
  office_expense: 'Ofis & Kırtasiye',
  general_office: 'Ofis & Kırtasiye',
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
  salary_payroll: 'Maaş / bordro',
  bank_commission: 'Banka masrafı & komisyon'
};

export type MonthlyViewLine = {
  id: any;
  date: string;
  title: string;
  amount: number;
  bucket: 'sales' | 'subcontractor' | 'cash' | 'card' | 'personnel';
  category: string;
};

export type MonthlyViewModel = {
  currentYm: string;
  prevYm: string;
  currentLabel: string;
  prevLabel: string;
  salesTotal: number;
  subcontractorTotal: number;
  personnelTotal: number;
  cashOutTotal: number;
  cardOutTotal: number;
  giderler: number;
  net: number;
  salesLines: MonthlyViewLine[];
  subcontractorLines: MonthlyViewLine[];
  personnelLines: MonthlyViewLine[];
  monthOutLines: MonthlyViewLine[];
  pieRows: { key: string; label: string; amount: number }[];
};

function isoDate(d: any): string {
  const s = String(d || '');
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return '';
}

function inYearMonth(d: any, ym: string) {
  const x = isoDate(d);
  return !!ym && x.startsWith(ym);
}

function isSalesInvoice(inv: any) {
  return String(inv?.category || '') === 'freight_sales' || String(inv?.direction || '') === 'outgoing';
}

function isSubcontractorInvoice(inv: any) {
  return String(inv?.category || '') === 'subcontractor_invoice';
}

function isCardPaid(inv: any) {
  return String(inv?.paid_source || '') === 'card' || /\[KK\]/i.test(String(inv?.invoice_no || ''));
}

function isPersonnelPay(inv: any) {
  return String(inv?.category || '') === 'salary_payroll';
}

/** Ekim hakedişi: Ekim’deki maaş + sonraki ayın 1–7’si (fatura primi o hafta kapanır). Yalnız bu menü. */
function isPersonnelForPrevHakedis(date: string, prevYm: string, currentYm: string) {
  if (!date) return false;
  if (inYearMonth(date, prevYm)) return true;
  if (!inYearMonth(date, currentYm)) return false;
  const day = Number(date.slice(8, 10));
  return day >= 1 && day <= 7;
}

function isOperatingOutflow(inv: any) {
  if (String(inv?.direction || '') === 'outgoing') return false;
  const cat = String(inv?.category || '');
  if (SKIP_OPERATING_OUT.has(cat)) return false;
  if (isSalesInvoice(inv) || isSubcontractorInvoice(inv) || isPersonnelPay(inv)) return false;
  if (isCardPaid(inv)) return true;
  return String(inv?.status || '') === 'paid';
}

function lineTitle(inv: any) {
  return String(inv?.invoice_no || '').trim() || String(inv?.description || '').trim() || String(inv?.category || 'Kayıt');
}

function catLabel(cat: string) {
  if (CAT_LABELS[cat]) return CAT_LABELS[cat];
  if (!cat) return 'Diğer';
  return cat.replace(/_/g, ' ');
}

export function buildMonthlyView(
  invoices: any[],
  currentYm: string,
  cleanNumber: (v: any) => number
): MonthlyViewModel {
  const ym = /^\d{4}-\d{2}$/.test(currentYm) ? currentYm : new Date().toISOString().slice(0, 7);
  const prevYm = previousYearMonth(ym);
  const salesLines: MonthlyViewLine[] = [];
  const subcontractorLines: MonthlyViewLine[] = [];
  const personnelLines: MonthlyViewLine[] = [];
  const monthOutLines: MonthlyViewLine[] = [];

  (invoices || []).forEach(inv => {
    const date = isoDate(inv.issue_date);
    const amount = cleanNumber(inv.total_amount);
    if (amount <= 0) return;
    const title = lineTitle(inv);
    const category = String(inv.category || '');

    if (isSalesInvoice(inv) && inYearMonth(date, prevYm)) {
      salesLines.push({ id: inv.id, date, title, amount, bucket: 'sales', category });
      return;
    }
    if (isSubcontractorInvoice(inv) && inYearMonth(date, prevYm)) {
      subcontractorLines.push({ id: inv.id, date, title, amount, bucket: 'subcontractor', category });
      return;
    }
    if (isPersonnelPay(inv) && String(inv.status || '') === 'paid' && isPersonnelForPrevHakedis(date, prevYm, ym)) {
      personnelLines.push({ id: inv.id, date, title, amount, bucket: 'personnel', category: 'salary_payroll' });
      return;
    }
    if (isOperatingOutflow(inv) && inYearMonth(date, prevYm)) {
      const card = isCardPaid(inv);
      monthOutLines.push({
        id: inv.id,
        date,
        title,
        amount,
        bucket: card ? 'card' : 'cash',
        category
      });
    }
  });

  const byDateDesc = (a: MonthlyViewLine, b: MonthlyViewLine) => (b.date || '').localeCompare(a.date || '');
  salesLines.sort(byDateDesc);
  subcontractorLines.sort(byDateDesc);
  personnelLines.sort(byDateDesc);
  monthOutLines.sort(byDateDesc);

  const salesTotal = salesLines.reduce((s, l) => s + l.amount, 0);
  const subcontractorTotal = subcontractorLines.reduce((s, l) => s + l.amount, 0);
  const personnelTotal = personnelLines.reduce((s, l) => s + l.amount, 0);
  const cashOutTotal = monthOutLines.filter(l => l.bucket === 'cash').reduce((s, l) => s + l.amount, 0);
  const cardOutTotal = monthOutLines.filter(l => l.bucket === 'card').reduce((s, l) => s + l.amount, 0);
  const giderler = subcontractorTotal + personnelTotal + cashOutTotal + cardOutTotal;

  const pieMap = new Map<string, number>();
  if (subcontractorTotal > 0.009) pieMap.set('taşeron', subcontractorTotal);
  if (personnelTotal > 0.009) pieMap.set('personel', personnelTotal);
  monthOutLines.forEach(l => {
    const key = l.bucket === 'card' ? `kart:${l.category}` : l.category;
    pieMap.set(key, (pieMap.get(key) || 0) + l.amount);
  });
  const pieRows = [...pieMap.entries()]
    .map(([key, amount]) => ({
      key,
      label: key === 'taşeron'
        ? `Alt yüklenici ödemeleri (${yearMonthTrLabel(prevYm)})`
        : key === 'personel'
          ? `Personel ödemeleri (${yearMonthTrLabel(prevYm)} + ${yearMonthTrLabel(ym).split(' ')[0]} 1–7)`
        : key.startsWith('kart:')
          ? `${catLabel(key.slice(5))} (kart)`
          : catLabel(key),
      amount
    }))
    .filter(r => r.amount > 0.009)
    .sort((a, b) => b.amount - a.amount);

  return {
    currentYm: ym,
    prevYm,
    currentLabel: yearMonthTrLabel(ym),
    prevLabel: yearMonthTrLabel(prevYm),
    salesTotal,
    subcontractorTotal,
    personnelTotal,
    cashOutTotal,
    cardOutTotal,
    giderler,
    net: salesTotal - giderler,
    salesLines,
    subcontractorLines,
    personnelLines,
    monthOutLines,
    pieRows
  };
}
