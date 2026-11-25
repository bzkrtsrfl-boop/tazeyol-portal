import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, FileSpreadsheet, Download } from 'lucide-react';
import { writeExcelAoa } from './excelOut';
import { formatMoneyAmountTR } from './money';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from './supabase';
import { COMPANY_IDENTITY } from './companyIdentity';
import {
  DIS_ALIM_KINDS,
  DIS_ALIM_STATUSES,
  DIS_ALIM_UNITS,
  disAlimFee,
  disAlimKindMeta,
  disAlimLineDate,
  disAlimLineYm,
  disAlimStatusLabel,
  previousYearMonth,
  yearMonthTrLabel,
  type DisAlimKind,
  type DisAlimStatus
} from './disAlim';

type Props = {
  rows: any[];
  canEdit: boolean;
  cleanNumber: (v: any) => number;
  formatDateTR: (d: any) => string;
  onReload: () => Promise<void> | void;
};

const emptyForm = {
  kind: 'dis_alim' as DisAlimKind,
  request_date: '',
  unit_name: '',
  waybill_no: '',
  supplier_invoice_no: '',
  order_no: '',
  waybill_date: '',
  invoice_date: '',
  alkan_pay_date: '',
  net_amount: '',
  vat_amount: '',
  subject: '',
  alkan_invoice_no: '',
  migros_invoice_no: '',
  status: 'draft' as DisAlimStatus,
  notes: ''
};

function isoDate(v: any) {
  if (!v) return '';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return '';
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DisAlimPage({ rows, canEdit, cleanNumber, formatDateTR, onReload }: Props) {
  const todayYm = new Date().toISOString().slice(0, 7);
  const [ym, setYm] = useState(todayYm);
  const [allMonths, setAllMonths] = useState(false);
  const [kindFilter, setKindFilter] = useState<'' | DisAlimKind>('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const money = (n: number) => formatMoneyAmountTR(n);
  const entryCls = 'w-full px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-sm font-semibold disabled:bg-slate-100 disabled:border-slate-200';

  const units = useMemo(() => {
    const extra = [...new Set((rows || []).map((r: any) => String(r.unit_name || '').trim()).filter(Boolean))];
    return [...new Set([...DIS_ALIM_UNITS, ...extra])];
  }, [rows]);

  const listed = useMemo(() => {
    const term = search.trim().toLocaleUpperCase('tr-TR');
    return [...(rows || [])]
      .filter((r: any) => {
        if (!allMonths && disAlimLineYm(r) !== ym) return false;
        if (kindFilter && r.kind !== kindFilter) return false;
        if (!term) return true;
        const blob = `${r.unit_name || ''} ${r.waybill_no || ''} ${r.supplier_invoice_no || ''} ${r.migros_invoice_no || ''} ${r.subject || ''} ${r.alkan_invoice_no || ''}`.toLocaleUpperCase('tr-TR');
        return blob.includes(term);
      })
      .sort((a: any, b: any) =>
        disAlimLineDate(b).localeCompare(disAlimLineDate(a))
        || String(a.kind).localeCompare(String(b.kind))
      );
  }, [rows, ym, allMonths, kindFilter, search]);

  const prevYm = previousYearMonth(todayYm);
  const prevMonthRows = useMemo(
    () => (rows || []).filter((r: any) => disAlimLineYm(r) === prevYm),
    [rows, prevYm]
  );
  const prevOpen = prevMonthRows.filter((r: any) => r.status === 'draft');
  const showPrevMutabakat = prevMonthRows.length > 0 && prevOpen.length > 0;
  const prevDisNet = prevMonthRows.filter((r: any) => r.kind === 'dis_alim').reduce((s: number, r: any) => s + cleanNumber(r.net_amount), 0);
  const prevYanNet = prevMonthRows.filter((r: any) => r.kind === 'yansitma').reduce((s: number, r: any) => s + cleanNumber(r.net_amount), 0);
  const prevNakliye = Math.round((prevDisNet * 0.1 + prevYanNet * 0.05) * 100) / 100;

  const goPrevMonth = () => {
    setAllMonths(false);
    setKindFilter('');
    setYm(prevYm);
  };

  const disRows = listed.filter((r: any) => r.kind === 'dis_alim');
  const yanRows = listed.filter((r: any) => r.kind === 'yansitma');
  const disNet = disRows.reduce((s: number, r: any) => s + cleanNumber(r.net_amount), 0);
  const yanNet = yanRows.reduce((s: number, r: any) => s + cleanNumber(r.net_amount), 0);
  const disFee = Math.round(disNet * 0.1 * 100) / 100;
  const yanFee = Math.round(yanNet * 0.05 * 100) / 100;
  const nakliye = Math.round((disFee + yanFee) * 100) / 100;

  const selected = listed.find((r: any) => r.id === selectedId) || null;

  useEffect(() => {
    if (!selected) return;
    setForm({
      kind: selected.kind === 'yansitma' ? 'yansitma' : 'dis_alim',
      request_date: isoDate(selected.request_date),
      unit_name: selected.unit_name || '',
      waybill_no: selected.waybill_no || '',
      supplier_invoice_no: selected.supplier_invoice_no || '',
      order_no: selected.order_no || '',
      waybill_date: isoDate(selected.waybill_date),
      invoice_date: isoDate(selected.invoice_date),
      alkan_pay_date: isoDate(selected.alkan_pay_date),
      net_amount: selected.net_amount || selected.net_amount === 0 ? String(selected.net_amount) : '',
      vat_amount: selected.vat_amount || selected.vat_amount === 0 ? String(selected.vat_amount) : '',
      subject: selected.subject || '',
      alkan_invoice_no: selected.alkan_invoice_no || '',
      migros_invoice_no: selected.migros_invoice_no || '',
      status: (DIS_ALIM_STATUSES.some(s => s.id === selected.status) ? selected.status : 'draft') as DisAlimStatus,
      notes: selected.notes || ''
    });
  }, [selectedId, selected]);

  const openNew = (kind: DisAlimKind) => {
    setSelectedId(null);
    setForm({
      ...emptyForm,
      kind,
      request_date: new Date().toISOString().slice(0, 10),
      invoice_date: new Date().toISOString().slice(0, 10)
    });
  };

  const netN = cleanNumber(form.net_amount);
  const vatN = cleanNumber(form.vat_amount);
  const grossN = Math.round((netN + vatN) * 100) / 100;
  const feeN = disAlimFee(form.kind, netN);
  const meta = disAlimKindMeta(form.kind);

  const save = async () => {
    if (!canEdit) return;
    if (!form.unit_name.trim() || !netN) {
      alert('Birim ve KDV’siz tutar zorunlu.');
      return;
    }
    const payload: any = {
      kind: form.kind,
      request_date: form.request_date || null,
      unit_name: form.unit_name.trim(),
      waybill_no: form.waybill_no.trim() || null,
      supplier_invoice_no: form.supplier_invoice_no.trim() || null,
      order_no: form.order_no.trim() || null,
      waybill_date: form.waybill_date || null,
      invoice_date: form.invoice_date || form.request_date || null,
      alkan_pay_date: form.alkan_pay_date || null,
      net_amount: netN,
      vat_amount: vatN,
      gross_amount: grossN,
      subject: form.subject.trim() || null,
      alkan_invoice_no: form.alkan_invoice_no.trim() || null,
      migros_invoice_no: form.migros_invoice_no.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString()
    };
    setBusy(true);
    const q = selectedId
      ? supabase.from('dis_alim_lines').update(payload).eq('id', selectedId)
      : supabase.from('dis_alim_lines').insert([{ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id || null }]);
    const { error } = await q;
    setBusy(false);
    if (error) {
      alert('Yazılamadı. setup_dis_alim.sql çalıştırın.\n' + error.message);
      return;
    }
    await onReload();
  };

  const remove = async () => {
    if (!canEdit || !selectedId) return;
    if (!window.confirm('Bu satır silinsin mi?')) return;
    setBusy(true);
    const { error } = await supabase.from('dis_alim_lines').delete().eq('id', selectedId);
    setBusy(false);
    if (error) {
      alert('Silinemedi: ' + error.message);
      return;
    }
    setSelectedId(null);
    setForm(emptyForm);
    await onReload();
  };

  const dumpRows = listed.map((r: any) => ({
    Tür: disAlimKindMeta(r.kind).label,
    Tarih: formatDateTR(disAlimLineDate(r)),
    Birim: r.unit_name || '',
    'İrsaliye / alınan fatura': r.waybill_no || r.supplier_invoice_no || '',
    'Migros fatura no': r.migros_invoice_no || '',
    Konu: r.subject || '',
    'KDV’siz': cleanNumber(r.net_amount),
    KDV: cleanNumber(r.vat_amount),
    Toplam: cleanNumber(r.gross_amount),
    'Hizmet payı': disAlimFee(r.kind, r.net_amount),
    Durum: disAlimStatusLabel(r.status),
    Cari: disAlimKindMeta(r.kind).cari
  }));

  const exportExcel = () => {
    const headers = dumpRows[0] ? Object.keys(dumpRows[0]) : ['Tür'];
    const aoa = [
      ['Tazeyol ERP — Dış Alım Mutabakatı'],
      [allMonths ? 'Tüm aylar' : ym, `Nakliye teklifi ${money(nakliye)} ₺`],
      [],
      headers,
      ...dumpRows.map(r => headers.map(h => (r as any)[h])),
      [],
      ['Dış alım KDV’siz', disNet, '%10', disFee],
      ['Yansıtma KDV’siz', yanNet, '%5', yanFee],
      ['Nakliye hizmet (normal Migros)', nakliye]
    ];
    writeExcelAoa(aoa, `Dis_Alim_Mutabakat_${allMonths ? 'tumu' : ym}.xlsx`, 'Mutabakat');
  };

  const exportPdf = async () => {
    setPdfBusy(true);
    try {
      const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const block = (title: string, list: any[], rateLbl: string) => `
        <div style="margin-top:16px;font-size:13px;font-weight:800">${esc(title)}</div>
        <table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:6px">
          <thead><tr>
            ${['Tarih', 'Birim', 'Belge', 'Migros fatura', 'Konu', 'KDV’siz', rateLbl, 'Durum'].map(h =>
              `<th style="text-align:left;padding:5px;border-bottom:1px solid #cbd5e1;background:#f8fafc">${h}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${list.length ? list.map(r => `<tr>
              <td style="padding:4px;border-bottom:1px solid #e2e8f0">${esc(formatDateTR(disAlimLineDate(r)))}</td>
              <td style="padding:4px;border-bottom:1px solid #e2e8f0">${esc(r.unit_name)}</td>
              <td style="padding:4px;border-bottom:1px solid #e2e8f0">${esc(r.supplier_invoice_no || r.waybill_no || '')}</td>
              <td style="padding:4px;border-bottom:1px solid #e2e8f0">${esc(r.migros_invoice_no || '')}</td>
              <td style="padding:4px;border-bottom:1px solid #e2e8f0">${esc(r.subject || '')}</td>
              <td style="padding:4px;border-bottom:1px solid #e2e8f0;text-align:right">${money(cleanNumber(r.net_amount))}</td>
              <td style="padding:4px;border-bottom:1px solid #e2e8f0;text-align:right">${money(disAlimFee(r.kind, r.net_amount))}</td>
              <td style="padding:4px;border-bottom:1px solid #e2e8f0">${esc(disAlimStatusLabel(r.status))}</td>
            </tr>`).join('') : `<tr><td colspan="8" style="padding:8px;color:#94a3b8">Satır yok.</td></tr>`}
          </tbody>
        </table>`;
      const html = `<div style="width:1100px;padding:28px;background:#fff;font-family:Arial,sans-serif;color:#0f172a">
        <div style="display:flex;justify-content:space-between;align-items:flex-end">
          <div>
            <div style="font-size:11px;letter-spacing:.12em;font-weight:800;color:#009fe3">TAZEYOL ERP</div>
            <div style="font-size:22px;font-weight:900">Dış Alım Mutabakatı</div>
            <div style="font-size:11px;color:#64748b">${esc(allMonths ? 'Tüm aylar' : ym)} · ${esc(COMPANY_IDENTITY.shortName)}</div>
          </div>
          <div style="text-align:right;font-size:11px;color:#64748b">${esc(COMPANY_IDENTITY.legalName)}<br/>Onayınızı talep ederiz.</div>
        </div>
        ${block('1. Dış alımlar — birebir fatura Migros Dış Alım carisine · pay %10 (nakliyeye)', disRows, '%10')}
        ${block('2. Yansıtma / yapım — birebir fatura normal Migros carisine · pay %5 (nakliyeye)', yanRows, '%5')}
        <div style="margin-top:18px;padding:12px;background:#0f172a;color:#fff;border-radius:12px">
          <div style="font-size:11px;opacity:.8">3. Nakliye hizmet faturası (normal Migros carisi — Dış Alım carisine yazılmaz)</div>
          <div style="display:flex;gap:24px;margin-top:8px;font-size:13px">
            <div>Dış alım %10<br/><b>${money(disFee)} ₺</b></div>
            <div>Yansıtma %5<br/><b>${money(yanFee)} ₺</b></div>
            <div>Toplam nakliye teklifi<br/><b style="font-size:18px">${money(nakliye)} ₺</b></div>
          </div>
        </div>
      </div>`;
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;left:-14000px;top:0;z-index:-1;';
      wrap.innerHTML = html;
      document.body.appendChild(wrap);
      const node = wrap.firstElementChild as HTMLElement;
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff' });
      wrap.remove();
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
      const pageW = 297;
      const pageH = 210;
      const imgH = (canvas.height * pageW) / canvas.width;
      const img = canvas.toDataURL('image/png');
      let y = 0;
      let first = true;
      while (y < imgH - 0.5) {
        if (!first) doc.addPage();
        first = false;
        doc.addImage(img, 'PNG', 0, -y, pageW, imgH);
        y += pageH;
      }
      downloadBlob(doc.output('blob'), `Dis_Alim_Mutabakat_${allMonths ? 'tumu' : ym}.pdf`);
    } catch (err: any) {
      alert('PDF hazırlanamadı: ' + (err.message || ''));
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {showPrevMutabakat && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5">
          <span>
            {yearMonthTrLabel(prevYm)} tarihli {prevMonthRows.length} satır var.
            Sonraki ayın 1’inde önceki ayın toplamı için mutabakat alınır.
            Nakliye teklifi {money(prevNakliye)} ₺ · {prevOpen.length} satır hâlâ taslak.
          </span>
          <button type="button" onClick={goPrevMonth} className="px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-amber-900 font-bold">
            {yearMonthTrLabel(prevYm)} listesine git
          </button>
        </div>
      )}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-wrap gap-2 items-center">
        {(['', ...DIS_ALIM_KINDS.map(k => k.id)] as const).map(k => {
          const on = kindFilter === k;
          const count = k === '' ? (rows || []).length : (rows || []).filter((r: any) => r.kind === k).length;
          const label = k === '' ? `Tümü (${count})` : `${disAlimKindMeta(k).label} (${count})`;
          return (
            <button
              key={k || 'all'}
              type="button"
              onClick={() => setKindFilter(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {label}
            </button>
          );
        })}
        <div className="flex-1" />
        {canEdit && (
          <>
            <button type="button" onClick={() => openNew('dis_alim')} className="px-3 py-1.5 rounded-lg bg-[#009fe3] text-white text-xs font-bold">Dış alım satırı</button>
            <button type="button" onClick={() => openNew('yansitma')} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold">Yansıtma satırı</button>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Dış alım KDV’siz</div>
          <div className="text-lg font-black tabular-nums">{money(disNet)} ₺</div>
          <div className="text-[10px] text-slate-400">Migros Dış Alım cari · birebir</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">%10 nakliye payı</div>
          <div className="text-lg font-black tabular-nums">{money(disFee)} ₺</div>
          <div className="text-[10px] text-slate-400">Normal Migros’a (Dış Alım’a yazılmaz)</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Yansıtma KDV’siz / %5</div>
          <div className="text-lg font-black tabular-nums">{money(yanNet)} ₺</div>
          <div className="text-[10px] text-slate-400">Pay {money(yanFee)} ₺ · birebir normal Migros</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-900 px-4 py-3 bg-slate-900 text-white">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-300">Nakliye teklifi</div>
          <div className="text-lg font-black tabular-nums">{money(nakliye)} ₺</div>
          <div className="text-[10px] text-slate-400">%10 + %5 · onay sonrası kesilir</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] gap-3 items-start">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 flex flex-wrap gap-2 items-center">
            <input type="month" value={ym} disabled={allMonths} onChange={e => setYm(e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold disabled:bg-slate-50" />
            <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
              <input type="checkbox" checked={allMonths} onChange={e => setAllMonths(e.target.checked)} /> Tüm aylar
            </label>
            <div className="relative flex-1 min-w-[140px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Belge / birim" className="w-full pl-7 pr-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
            </div>
            <button type="button" disabled={!listed.length} onClick={exportExcel} className="px-2 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 disabled:opacity-50">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Excel
            </button>
            <button type="button" disabled={pdfBusy} onClick={() => void exportPdf()} className="px-2 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold flex items-center gap-1">
              <Download className="w-3.5 h-3.5" /> {pdfBusy ? 'PDF…' : 'Migros PDF'}
            </button>
          </div>
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500 font-bold">
                <tr>
                  <th className="py-2 px-3">Tür</th>
                  <th className="py-2 px-3">Tarih</th>
                  <th className="py-2 px-3">Birim / belge</th>
                  <th className="py-2 px-3 text-right">KDV’siz</th>
                  <th className="py-2 px-3 text-right">Pay</th>
                  <th className="py-2 px-3">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!listed.length && (
                  <tr><td colSpan={6} className="py-10 text-center text-slate-400">Satır yok. Dış alım veya yansıtma ekleyin. SQL: setup_dis_alim.sql</td></tr>
                )}
                {listed.map((r: any) => {
                  const on = selectedId === r.id;
                  return (
                    <tr key={r.id} onClick={() => setSelectedId(r.id)} className={`cursor-pointer ${on ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                      <td className="py-2 px-3 font-semibold">{disAlimKindMeta(r.kind).label}</td>
                      <td className="py-2 px-3 whitespace-nowrap">{formatDateTR(disAlimLineDate(r))}</td>
                      <td className="py-2 px-3">
                        {r.unit_name}
                        <span className="block text-[10px] font-medium text-slate-400">{r.migros_invoice_no || r.supplier_invoice_no || r.waybill_no || '—'}</span>
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">{money(cleanNumber(r.net_amount))} ₺</td>
                      <td className="py-2 px-3 text-right font-bold tabular-nums">{money(disAlimFee(r.kind, r.net_amount))} ₺</td>
                      <td className="py-2 px-3">{disAlimStatusLabel(r.status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 min-h-[420px]">
          {!canEdit && !selected && (
            <div className="h-full flex items-center justify-center text-sm text-slate-400 px-6 text-center">Soldan satıra tıklayın.</div>
          )}
          {canEdit && !selected && !form.request_date && form.net_amount === '' && (
            <div className="h-full flex items-center justify-center text-sm text-slate-400 px-6 text-center">
              Soldan satır seçin veya üstten Dış alım / Yansıtma satırı açın.
            </div>
          )}
          {(selected || (canEdit && (form.request_date || form.net_amount !== '' || form.unit_name))) && (
            <div className="space-y-3 text-xs">
              <div className="flex justify-between gap-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{meta.cari}</div>
                  <div className="font-black text-base">{selected ? 'Satır' : 'Yeni satır'} · {meta.label}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{meta.feeNote}</div>
                </div>
                <button type="button" onClick={() => { setSelectedId(null); setForm(emptyForm); }} className="text-slate-400 h-7"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="font-semibold col-span-2">Tür
                  <select value={form.kind} disabled={!canEdit} onChange={e => setForm({ ...form, kind: e.target.value as DisAlimKind })} className={entryCls}>
                    {DIS_ALIM_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                  </select>
                </label>
                <label className="font-semibold">Tarih
                  <input type="date" value={form.request_date} disabled={!canEdit} onChange={e => setForm({ ...form, request_date: e.target.value })} className={entryCls} />
                </label>
                <label className="font-semibold">Fatura tarihi
                  <input type="date" value={form.invoice_date} disabled={!canEdit} onChange={e => setForm({ ...form, invoice_date: e.target.value })} className={entryCls} />
                </label>
                <label className="font-semibold col-span-2">Birim / depo
                  <input list="dis-alim-unit" value={form.unit_name} disabled={!canEdit} onChange={e => setForm({ ...form, unit_name: e.target.value })} className={entryCls} />
                  <datalist id="dis-alim-unit">{units.map(u => <option key={u} value={u} />)}</datalist>
                </label>
                {form.kind === 'dis_alim' ? (
                  <>
                    <label className="font-semibold">İrsaliye no
                      <input value={form.waybill_no} disabled={!canEdit} onChange={e => setForm({ ...form, waybill_no: e.target.value })} className={entryCls} />
                    </label>
                    <label className="font-semibold">Tedarik fatura no
                      <input value={form.supplier_invoice_no} disabled={!canEdit} onChange={e => setForm({ ...form, supplier_invoice_no: e.target.value })} className={entryCls} />
                    </label>
                    <label className="font-semibold">İrsaliye tarihi
                      <input type="date" value={form.waybill_date} disabled={!canEdit} onChange={e => setForm({ ...form, waybill_date: e.target.value })} className={entryCls} />
                    </label>
                    <label className="font-semibold">Sipariş no
                      <input value={form.order_no} disabled={!canEdit} onChange={e => setForm({ ...form, order_no: e.target.value })} className={entryCls} />
                    </label>
                  </>
                ) : (
                  <>
                    <label className="font-semibold">Alınan fatura no
                      <input value={form.supplier_invoice_no} disabled={!canEdit} onChange={e => setForm({ ...form, supplier_invoice_no: e.target.value })} className={entryCls} />
                    </label>
                    <label className="font-semibold">Alkan fatura no
                      <input value={form.alkan_invoice_no} disabled={!canEdit} onChange={e => setForm({ ...form, alkan_invoice_no: e.target.value })} className={entryCls} />
                    </label>
                    <label className="font-semibold col-span-2">Konu
                      <input value={form.subject} disabled={!canEdit} onChange={e => setForm({ ...form, subject: e.target.value })} className={entryCls} placeholder="Et nakliyesi, inşaat…" />
                    </label>
                  </>
                )}
                <label className="font-semibold">KDV’siz ₺
                  <input value={form.net_amount} disabled={!canEdit} onChange={e => setForm({ ...form, net_amount: e.target.value })} className={`${entryCls} text-right tabular-nums`} inputMode="decimal" />
                </label>
                <label className="font-semibold">KDV ₺
                  <input value={form.vat_amount} disabled={!canEdit} onChange={e => setForm({ ...form, vat_amount: e.target.value })} className={`${entryCls} text-right tabular-nums`} inputMode="decimal" />
                </label>
                <div className="rounded-lg bg-slate-50 border px-3 py-2">
                  <div className="text-[10px] text-slate-400 font-bold">Toplam</div>
                  <div className="font-black">{money(grossN)} ₺</div>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                  <div className="text-[10px] text-amber-800 font-bold">Hizmet payı</div>
                  <div className="font-black">{money(feeN)} ₺</div>
                </div>
                <label className="font-semibold col-span-2">Birebir Migros fatura no
                  <input value={form.migros_invoice_no} disabled={!canEdit} onChange={e => setForm({ ...form, migros_invoice_no: e.target.value })} className={entryCls} placeholder={form.kind === 'dis_alim' ? 'Dış Alım carisine kestğiniz no' : 'Normal Migros’a kestğiniz no'} />
                </label>
                <label className="font-semibold">Alkan ödeme tarihi
                  <input type="date" value={form.alkan_pay_date} disabled={!canEdit} onChange={e => setForm({ ...form, alkan_pay_date: e.target.value })} className={entryCls} />
                </label>
                <label className="font-semibold">Durum
                  <select value={form.status} disabled={!canEdit} onChange={e => setForm({ ...form, status: e.target.value as DisAlimStatus })} className={entryCls}>
                    {DIS_ALIM_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </label>
                <label className="font-semibold col-span-2">Not
                  <input value={form.notes} disabled={!canEdit} onChange={e => setForm({ ...form, notes: e.target.value })} className={entryCls} />
                </label>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => void save()} className="flex-1 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-bold">Kaydet</button>
                  {selectedId && (
                    <button type="button" disabled={busy} onClick={() => void remove()} className="px-3 py-2.5 rounded-lg border text-xs font-bold text-rose-700">Sil</button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
