import React, { useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { formatMoneyAmountTR, roundMoney } from './money';
import { writeExcelAoa, excelKeepNumber } from './excelOut';
import {
  HAL_REPORT_PRESETS,
  buildHalCari,
  cleanHalNote,
  cmpHalMove,
  halReportRange,
  inHalRange,
  isHalKasaOnly,
  isHalMerkezTahsil,
  halHandoverBookDate,
  personelKasaFrom,
  seferTotal,
  type HalMoveSortField,
  type HalReportPreset
} from './halSaha';

type Props = {
  firms: any[];
  entries: any[];
  handovers: any[];
  formatDateTR: (d: any) => string;
  cleanNumber: (v: any) => number;
};

export default function HalSahaReportPage({ firms, entries, handovers, formatDateTR, cleanNumber }: Props) {
  const [preset, setPreset] = useState<HalReportPreset>('bu_ay');
  const [firmFilter, setFirmFilter] = useState('');
  const [moveSort, setMoveSort] = useState<{ field: HalMoveSortField; dir: 'asc' | 'desc' }>({ field: 'date', dir: 'desc' });
  const [cariSort, setCariSort] = useState<{ field: 'name' | 'shop' | 'devir' | 'sefer' | 'kdv' | 'tahsilat' | 'kalan'; dir: 'asc' | 'desc' }>({ field: 'name', dir: 'asc' });
  const range = useMemo(() => halReportRange(preset), [preset]);
  const toggleSort = <F extends string>(cur: { field: F; dir: 'asc' | 'desc' }, field: F) =>
    cur.field === field ? { field, dir: (cur.dir === 'asc' ? 'desc' : 'asc') as 'asc' | 'desc' } : { field, dir: (field === 'date' ? 'desc' : 'asc') as 'asc' | 'desc' };
  const sortMark = (cur: { field: string; dir: string }, field: string) =>
    cur.field !== field ? ' ↕' : cur.dir === 'asc' ? ' ↑' : ' ↓';
  const thSort = 'py-2 px-3 cursor-pointer select-none hover:text-blue-600';

  const money = (n: number) => formatMoneyAmountTR(n);
  const listedFirms = [...(firms || [])].sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || ''), 'tr'));
  const rangeEntries = useMemo(
    () => (entries || []).filter((e: any) => inHalRange(e.entry_date, range.from, range.to)),
    [entries, range.from, range.to]
  );

  const cari = useMemo(
    () => {
      const rows = buildHalCari(firms, entries, range.from, range.to, cleanNumber);
      const filtered = firmFilter ? rows.filter(r => r.name === firmFilter) : rows;
      return [...filtered].sort((a, b) => {
        let cmp = 0;
        if (cariSort.field === 'shop') cmp = String(a.shop || '').localeCompare(String(b.shop || ''), 'tr');
        else if (cariSort.field === 'devir') cmp = a.devir - b.devir;
        else if (cariSort.field === 'sefer') cmp = a.sefer - b.sefer;
        else if (cariSort.field === 'kdv') cmp = a.kdv - b.kdv;
        else if (cariSort.field === 'tahsilat') cmp = a.tahsilat - b.tahsilat;
        else if (cariSort.field === 'kalan') cmp = a.kalan - b.kalan;
        else cmp = a.name.localeCompare(b.name, 'tr');
        return cariSort.dir === 'asc' ? cmp : -cmp;
      });
    },
    [firms, entries, range.from, range.to, cleanNumber, firmFilter, cariSort]
  );

  const genel = cari.reduce((a, r) => ({
    devir: roundMoney(a.devir + r.devir),
    sefer: roundMoney(a.sefer + r.sefer),
    kdv: roundMoney(a.kdv + r.kdv),
    tahsilat: roundMoney(a.tahsilat + r.tahsilat),
    kalan: roundMoney(a.kalan + r.kalan)
  }), { devir: 0, sefer: 0, kdv: 0, tahsilat: 0, kalan: 0 });

  const hareketler = useMemo(() => {
    return rangeEntries
      .filter((e: any) => !isHalKasaOnly(e))
      .filter((e: any) => !firmFilter || e.firm_name === firmFilter)
      .slice()
      .sort((a: any, b: any) => {
        let cmp = cmpHalMove(a, b, moveSort.field, cleanNumber);
        if (cmp === 0) cmp = String(a.id || '').localeCompare(String(b.id || ''));
        return moveSort.dir === 'asc' ? cmp : -cmp;
      });
  }, [rangeEntries, firmFilter, moveSort, cleanNumber]);

  const personelKasa = personelKasaFrom(entries, handovers, cleanNumber);

  const rangeHandovers = (handovers || []).filter((h: any) => inHalRange(halHandoverBookDate(h), range.from, range.to));

  const download = () => {
    const donem = `${formatDateTR(range.from)} — ${formatDateTR(range.to)}`;
    writeExcelAoa([
      ['Hal saha takip raporu', range.label, donem],
      [],
      ['Özet'],
      ['Devir', excelKeepNumber(genel.devir)],
      ['Sefer', excelKeepNumber(genel.sefer)],
      ['KDV %20 (cari, kasa değil)', excelKeepNumber(genel.kdv)],
      ['Tahsilat', excelKeepNumber(genel.tahsilat)],
      ['Kalan alacak', excelKeepNumber(genel.kalan)],
      ['Personel kasa (tüm zaman)', excelKeepNumber(personelKasa)],
      ['Dönemde merkeze teslim', excelKeepNumber(rangeHandovers.reduce((s: number, h: any) => s + cleanNumber(h.amount), 0))],
      [],
      ['Firma cari'],
      ['Firma', 'Dükkan', 'Devir', 'Sefer', 'KDV', 'Tahsilat', 'Kalan'],
      ...cari.map(r => [r.name, r.shop || '', excelKeepNumber(r.devir), excelKeepNumber(r.sefer), excelKeepNumber(r.kdv), excelKeepNumber(r.tahsilat), excelKeepNumber(r.kalan)]),
      [],
      ['Hareketler'],
      ['Tarih', 'İşlem', 'Firma', 'Plaka', 'Açıklama', 'Sefer', 'KDV', 'Nakit'],
      ...hareketler.map((e: any) => [
        formatDateTR(e.entry_date),
        e.kind === 'tahsilat' ? (isHalMerkezTahsil(e) ? 'Tahsilat · kasa' : 'Tahsilat') : 'Sefer',
        e.firm_name,
        e.plate || '',
        cleanHalNote(e.notes),
        excelKeepNumber(e.kind === 'sefer' ? seferTotal(cleanNumber(e.bedel), !!e.has_vat) : 0),
        e.kind === 'sefer' && e.has_vat ? '%20' : '',
        excelKeepNumber(cleanNumber(e.collected))
      ])
    ], `Hal_saha_takip_${range.file}.xlsx`, 'Takip');
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-lg text-slate-900">Hal saha takibi</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {range.label}: {formatDateTR(range.from)} — {formatDateTR(range.to)}. Kayıt buradan yazılmaz; giriş Hal saha → Sefer ve tahsilat’tadır.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex flex-wrap gap-1">
              {HAL_REPORT_PRESETS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold ${preset === p.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <select
              value={firmFilter}
              onChange={e => setFirmFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs font-bold max-w-[220px]"
            >
              <option value="">Tüm firmalar</option>
              {listedFirms.map((f: any) => (
                <option key={f.id} value={f.name}>{f.name}{f.is_active === false ? ' (pasif)' : ''}</option>
              ))}
            </select>
            <button type="button" onClick={download} className="px-3 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
          <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Devir</div>
            <div className="text-lg font-black tabular-nums text-slate-900">{money(genel.devir)} ₺</div>
          </div>
          <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Sefer</div>
            <div className="text-lg font-black tabular-nums text-slate-900">{money(genel.sefer)} ₺</div>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-100 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-amber-800">KDV %20</div>
            <div className="text-lg font-black tabular-nums text-amber-900">{money(genel.kdv)} ₺</div>
            <div className="text-[10px] text-amber-700">Cariye dahil · kasaya yazılmaz</div>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-100 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Tahsilat</div>
            <div className="text-lg font-black tabular-nums text-emerald-800">{money(genel.tahsilat)} ₺</div>
          </div>
          <div className="bg-rose-50 rounded-xl border border-rose-100 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-rose-700">Kalan alacak</div>
            <div className="text-lg font-black tabular-nums text-rose-800">{money(genel.kalan)} ₺</div>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-100 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Personel kasa</div>
            <div className="text-lg font-black tabular-nums text-amber-900">{money(personelKasa)} ₺</div>
            <div className="text-[10px] text-amber-700">Tüm zaman · merkeze alınmamış nakit</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h4 className="font-bold text-sm text-slate-900">Firma cari</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold">
              <tr>
                <th className={thSort} onClick={() => setCariSort(s => toggleSort(s, 'name'))}>Firma{sortMark(cariSort, 'name')}</th>
                <th className={thSort} onClick={() => setCariSort(s => toggleSort(s, 'shop'))}>Dükkan{sortMark(cariSort, 'shop')}</th>
                <th className={`${thSort} text-right`} onClick={() => setCariSort(s => toggleSort(s, 'devir'))}>Devir{sortMark(cariSort, 'devir')}</th>
                <th className={`${thSort} text-right`} onClick={() => setCariSort(s => toggleSort(s, 'sefer'))}>Sefer{sortMark(cariSort, 'sefer')}</th>
                <th className={`${thSort} text-right`} onClick={() => setCariSort(s => toggleSort(s, 'kdv'))}>KDV{sortMark(cariSort, 'kdv')}</th>
                <th className={`${thSort} text-right`} onClick={() => setCariSort(s => toggleSort(s, 'tahsilat'))}>Tahsilat{sortMark(cariSort, 'tahsilat')}</th>
                <th className={`${thSort} text-right`} onClick={() => setCariSort(s => toggleSort(s, 'kalan'))}>Kalan{sortMark(cariSort, 'kalan')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cari.map(r => (
                <tr key={r.name} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-900">{r.name}{r.inactive ? ' (pasif)' : ''}</td>
                  <td className="py-2.5 px-3 text-slate-500">{r.shop || '—'}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{money(r.devir)} ₺</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-[#009fe3] font-semibold">{money(r.sefer)} ₺</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-amber-800">{money(r.kdv)} ₺</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700 font-semibold">{money(r.tahsilat)} ₺</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-black text-rose-700">{money(r.kalan)} ₺</td>
                </tr>
              ))}
              {!cari.length && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">Bu dönemde cari yok.</td></tr>
              )}
            </tbody>
            {cari.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200 font-black">
                  <td className="py-2.5 px-3" colSpan={2}>Toplam</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{money(genel.devir)} ₺</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{money(genel.sefer)} ₺</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{money(genel.kdv)} ₺</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{money(genel.tahsilat)} ₺</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-rose-700">{money(genel.kalan)} ₺</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h4 className="font-bold text-sm text-slate-900">Hareketler</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold">
              <tr>
                <th className={thSort} onClick={() => setMoveSort(s => toggleSort(s, 'date'))}>Tarih{sortMark(moveSort, 'date')}</th>
                <th className={thSort} onClick={() => setMoveSort(s => toggleSort(s, 'kind'))}>İşlem{sortMark(moveSort, 'kind')}</th>
                <th className={thSort} onClick={() => setMoveSort(s => toggleSort(s, 'firm'))}>Firma{sortMark(moveSort, 'firm')}</th>
                <th className={thSort} onClick={() => setMoveSort(s => toggleSort(s, 'plate'))}>Plaka{sortMark(moveSort, 'plate')}</th>
                <th className={thSort} onClick={() => setMoveSort(s => toggleSort(s, 'note'))}>Açıklama{sortMark(moveSort, 'note')}</th>
                <th className={`${thSort} text-right`} onClick={() => setMoveSort(s => toggleSort(s, 'sefer'))}>Sefer{sortMark(moveSort, 'sefer')}</th>
                <th className="py-2 px-3 text-center">KDV</th>
                <th className={`${thSort} text-right`} onClick={() => setMoveSort(s => toggleSort(s, 'collected'))}>Nakit{sortMark(moveSort, 'collected')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hareketler.map((e: any) => {
                const tot = e.kind === 'sefer' ? seferTotal(cleanNumber(e.bedel), !!e.has_vat) : 0;
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 whitespace-nowrap">{formatDateTR(e.entry_date)}</td>
                    <td className="py-2 px-3 font-bold">{e.kind === 'tahsilat' ? (isHalMerkezTahsil(e) ? 'Tahsilat · kasa' : 'Tahsilat') : 'Sefer'}</td>
                    <td className="py-2 px-3 font-semibold">{e.firm_name}{(firms || []).some((f: any) => f.name === e.firm_name && f.is_active === false) ? ' (pasif)' : ''}</td>
                    <td className="py-2 px-3 font-mono">{e.plate || '—'}</td>
                    <td className="py-2 px-3 text-slate-500">{cleanHalNote(e.notes) || '—'}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{tot ? `${money(tot)} ₺` : '—'}</td>
                    <td className="py-2 px-3 text-center text-[10px] font-bold">{e.kind === 'sefer' && e.has_vat ? <span className="text-amber-700">%20</span> : '—'}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-emerald-700 font-bold">{cleanNumber(e.collected) ? `${money(cleanNumber(e.collected))} ₺` : '—'}</td>
                  </tr>
                );
              })}
              {!hareketler.length && (
                <tr><td colSpan={8} className="py-8 text-center text-slate-400">Bu dönemde hareket yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
