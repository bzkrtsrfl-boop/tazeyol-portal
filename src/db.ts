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
      return n.length >= 4 && (needle.includes(n) || n.includes(needle));
    })
    .sort((a, b) => normalizeName(b.name).length - normalizeName(a.name).length);

  return ranked[0] || null;
}
