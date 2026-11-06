import { supabase } from './supabase';

export type Customer = {
  id: string;
  name: string;
  tax_id: string | null;
  tax_office: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export function normalizeName(value: string): string {
  return String(value || '')
    .trim()
    .toLocaleUpperCase('tr-TR')
    .replace(/\s+/g, ' ');
}

export async function fetchAllRows(
  table: string,
  order?: { column: string; ascending: boolean }
): Promise<any[]> {
  const pageSize = 1000;
  let from = 0;
  const all: any[] = [];

  while (true) {
    let query = supabase.from(table).select('*').range(from, from + pageSize - 1);
    if (order) {
      query = query.order(order.column, { ascending: order.ascending });
    }
    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

export function matchCustomer(
  rawName: string,
  rawTaxId: string,
  customers: Customer[]
): Customer | null {
  const tax = String(rawTaxId || '').replace(/\D/g, '');
  if (tax.length >= 10) {
    const byTax = customers.find(c => String(c.tax_id || '').replace(/\D/g, '') === tax);
    if (byTax) return byTax;
  }

  const needle = normalizeName(rawName);
  if (!needle) return null;

  const exact = customers.find(c => normalizeName(c.name) === needle);
  if (exact) return exact;

  const ranked = [...customers]
    .filter(c => {
      const n = normalizeName(c.name);
      return n.length >= 3 && (needle.includes(n) || n.includes(needle));
    })
    .sort((a, b) => normalizeName(b.name).length - normalizeName(a.name).length);

  return ranked[0] || null;
}

/** Eski dönemde tüm cariler Migros yazıldığı için fatura no → gerçek müşteri. */
export const INVOICE_CUSTOMER_OVERRIDES: { key: string; customer: string }[] = [
  { key: 'EF2202600000011', customer: 'CRC' }
];

export function extractSalesInvoiceKeys(text: string): string[] {
  const s = String(text || '').toUpperCase();
  const keys = new Set<string>();
  for (const m of s.matchAll(/\bEF\d{8,}\b/g)) keys.add(m[0]);
  return [...keys];
}

export function parseInvoiceCustomerParts(invoiceNo: string): { invoiceKey: string; customerHint: string } {
  const raw = String(invoiceNo || '').trim();
  const ths = raw.match(/^THS\s*-\s*(.+?)\s*-\s*(.+?)\s*-\s*\d+\s*$/i);
  if (ths) return { invoiceKey: ths[1].trim(), customerHint: ths[2].trim() };
  const idx = raw.indexOf(' - ');
  if (idx > 0) {
    return { invoiceKey: raw.slice(0, idx).trim(), customerHint: raw.slice(idx + 3).trim() };
  }
  return { invoiceKey: raw, customerHint: '' };
}

function overrideCustomerForKeys(keys: string[], customers: Customer[]): Customer | null {
  for (const key of keys) {
    const hit = INVOICE_CUSTOMER_OVERRIDES.find(o => key.includes(o.key) || o.key.includes(key));
    if (!hit) continue;
    const matched =
      matchCustomer(hit.customer, '', customers) ||
      customers.find(c => normalizeName(c.name).includes(normalizeName(hit.customer))) ||
      null;
    if (matched) return matched;
  }
  return null;
}

function invoiceAmount(inv: any) {
  const n = Number(String(inv?.total_amount ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function isLegacyCrcInvoice(inv: any) {
  const no = String(inv?.invoice_no || '').toUpperCase();
  if (no.includes('EF2202600000011') || no.includes('2202600000011')) return true;
  const cat = String(inv?.category || '');
  const isMoneyDoc =
    cat === 'freight_sales' ||
    cat === 'customer_collection' ||
    cat === 'customer_advance' ||
    inv?.direction === 'outgoing';
  return isMoneyDoc && Math.abs(invoiceAmount(inv) - 1383480) < 0.05;
}

export function retitleInvoiceCustomer(invoiceNo: string, customerName: string) {
  const no = String(invoiceNo || '').trim();
  const name = String(customerName || '').trim();
  if (!no || !name) return no;
  const ths = no.match(/^(THS\s*-\s*.+?)\s*-\s*(.+?)\s*-\s*(\d+)\s*$/i);
  if (ths) return `${ths[1].trim()} - ${name} - ${ths[3]}`;
  const idx = no.indexOf(' - ');
  if (idx > 0) return `${no.slice(0, idx).trim()} - ${name}`;
  return `${no} - ${name}`;
}

export function findCrcCustomer(customers: Customer[]) {
  const hits = (customers || []).filter(c => /CRC/i.test(String(c.name || '')));
  hits.sort((a, b) => String(b.name || '').length - String(a.name || '').length);
  return hits[0] || null;
}

export function findMigrosCustomer(customers: Customer[]) {
  const hits = (customers || []).filter(c => {
    const n = normalizeName(c.name);
    return n.includes('MIGROS') || n.includes('MİGROS');
  });
  hits.sort((a, b) => String(b.name || '').length - String(a.name || '').length);
  return hits[0] || null;
}

export function isCustomerMoneyInvoice(inv: any) {
  const cat = String(inv?.category || '');
  return cat === 'freight_sales' || cat === 'customer_collection' || cat === 'customer_advance' || inv?.direction === 'outgoing';
}

export function resolveInvoiceCustomer(
  inv: any,
  customers: Customer[],
  invoices: any[] = [],
  depth = 0
): Customer | null {
  if (!inv || !customers?.length || depth > 2) return null;
  const no = String(inv.invoice_no || '');
  if (isLegacyCrcInvoice(inv)) {
    const crc = findCrcCustomer(customers);
    if (crc) return crc;
  }
  const keys = extractSalesInvoiceKeys(no);
  const overridden = overrideCustomerForKeys(keys, customers);
  if (overridden) return overridden;

  if (keys.length && invoices.length) {
    for (const key of keys) {
      const sale = invoices.find(s => {
        if (s === inv || s?.id === inv?.id) return false;
        const cat = String(s?.category || '');
        const isSale = cat === 'freight_sales' || s?.direction === 'outgoing';
        if (!isSale) return false;
        return String(s?.invoice_no || '').toUpperCase().includes(key);
      });
      if (!sale) continue;
      const via = resolveInvoiceCustomer(sale, customers, invoices, depth + 1);
      if (via) return via;
    }
  }

  const { customerHint, invoiceKey } = parseInvoiceCustomerParts(no);
  return matchCustomer(customerHint || invoiceKey, '', customers);
}

export function invoiceBelongsToCustomer(
  inv: any,
  customer: Customer,
  allCustomers: Customer[],
  allInvoices: any[] = []
): boolean {
  if (!customer) return false;
  const resolved = resolveInvoiceCustomer(inv, allCustomers, allInvoices);
  return !!resolved && String(resolved.id) === String(customer.id);
}
