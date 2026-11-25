import React, { useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { formatMoneyAmountTR, roundMoney } from './money';
import { writeExcelAoa, excelKeepNumber } from './excelOut';
import {
  HAL_REPORT_PRESETS,
  buildHalCari,
  cleanHalNote,
  halReportRange,
  inHalRange,
  isHalCariOnly,
  isHalEntryShown,
  isHalKasaOnly,
  isHalMerkezTahsil,
  seferTotal,
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
  const range = useMemo(() => halReportRange(preset), [preset]);

  const money = (n: number) => formatMoneyAmountTR(n);
  const activeFirms = (firms || []).filter((f: any) => f.is_active !== false);
  const rangeEntries = useMemo(
    () => (entries || []).filter((e: any) => inHalRange(e.entry_date, range.from, range.to)),
    [entries, range.from, range.to]
  );

  const cari = useMemo(
    () => {
      const rows = buildHalCari(firms, entries, range.from, range.to, cleanNumber);
      return firmFilter ? rows.filter(r => r.name === firmFilter) : rows;
    },
    [firms, entries, range.from, range.to, cleanNumber, firmFilter]
  );

  const genel = cari.reduce((a, r) => ({
    devir: roundMoney(a.devir + r.devir),
    sefer: roundMoney(a.sefer + r.sefer),
    tahsilat: roundMoney(a.tahsilat + r.tahsilat),
    kalan: roundMoney(a.kalan + r.kalan)
  }), { devir: 0, sefer: 0, tahsilat: 0, kalan: 0 });

  const hareketler = useMemo(() => {
    return rangeEntries
      .filter((e: any) => !isHalKasaOnly(e) && isHalEntryShown(e, firms, range.from, range.to))
      .filter((e: any) => !firmFilter || e.firm_name === firmFilter)
      .slice()
      .sort((a: any, b: any) => String(a.entry_date || '').localeCompare(String(b.entry_date || '')) || String(a.firm_name || '').localeCompare(String(b.firm_name || ''), 'tr'));
  }, [rangeEntries, firmFilter, firms, range.from, range.to]);

  const nakitToplanan = (entries || []).filter((e: any) => !isHalCariOnly(e)).reduce((s: number, e: any) => s + cleanNumber(e.collected), 0);
  const teslim = (handovers || []).reduce((s: number, h: any) => s + cleanNumber(h.amount), 0);
  const personelKasa = roundMoney(nakitToplanan - teslim);

  const rangeHandovers = (handovers || []).filter((h: any) => inHalRange(h.hand_date, range.from, range.to));

  const download = () => {
    const donem = `${formatDateTR(range.from)} — ${formatDateTR(range.to)}`;
    writeExcelAoa([
      ['Hal saha takip raporu', range.label, donem],
      [],
      ['Özet'],
      ['Devir', excelKeepNumber(genel.devir)],
      ['Sefer', excelKeepNumber(genel.sefer)],
      ['Tahsilat', excelKeepNumber(genel.tahsilat)],
      ['Kalan alacak', excelKeepNumber(genel.kalan)],
      ['Personel kasa (tüm zaman)', excelKeepNumber(personelKasa)],
      ['Dönemde merkeze teslim', excelKeepNumber(rangeHandovers.reduce((s: number, h: any) => s + cleanNumber(h.amount), 0))],
      [],
      ['Firma cari'],
      ['Firma', 'Dükkan', 'Devir', 'Sefer', 'Tahsilat', 'Kalan'],
      ...cari.map(r => [r.name, r.shop || '', excelKeepNumber(r.devir), excelKeepNumber(r.sefer), excelKeepNumber(r.tahsilat), excelKeepNumber(r.kalan)]),
      [],
      ['Hareketler'],
      ['Tarih', 'İşlem', 'Firma', 'Plaka', 'Açıklama', 'Sefer', 'Nakit'],
      ...hareketler.map((e: any) => [
        formatDateTR(e.entry_date),
        e.kind === 'tahsilat' ? (isHalMerkezTahsil(e) ? 'Tahsilat · kasa' : 'Tahsilat') : 'Sefer',
        e.firm_name,
        e.plate || '',
        cleanHalNote(e.notes),
        excelKeepNumber(e.kind === 'sefer' ? seferTotal(cleanNumber(e.bedel), !!e.has_vat) : 0),
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
              {activeFirms.map((f: any) => <option key={f.id} value={f.name}>{f.name}</option>)}
            </select>
            <button type="button" onClick={download} className="px-3 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Devir</div>
            <div className="text-lg font-black tabular-nums text-slate-900">{money(genel.devir)} ₺</div>
          </div>
          <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Sefer</div>
            <div className="text-lg font-black tabular-nums text-slate-900">{money(genel.sefer)} ₺</div>
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
                <th className="py-2 px-3">Firma</th>
                <th className="py-2 px-3">Dükkan</th>
                <th className="py-2 px-3 text-right">Devir</th>
                <th className="py-2 px-3 text-right">Sefer</th>
                <th className="py-2 px-3 text-right">Tahsilat</th>
                <th className="py-2 px-3 text-right">Kalan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cari.map(r => (
                <tr key={r.name} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-900">{r.name}</td>
                  <td className="py-2.5 px-3 text-slate-500">{r.shop || '—'}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{money(r.devir)} ₺</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-[#009fe3] font-semibold">{money(r.sefer)} ₺</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700 font-semibold">{money(r.tahsilat)} ₺</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-black text-rose-700">{money(r.kalan)} ₺</td>
                </tr>
              ))}
              {!cari.length && (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400">Bu dönemde cari yok.</td></tr>
              )}
            </tbody>
            {cari.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200 font-black">
                  <td className="py-2.5 px-3" colSpan={2}>Toplam</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{money(genel.devir)} ₺</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{money(genel.sefer)} ₺</td>
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
                <th className="py-2 px-3">Tarih</th>
                <th className="py-2 px-3">İşlem</th>
                <th className="py-2 px-3">Firma</th>
                <th className="py-2 px-3">Plaka</th>
                <th className="py-2 px-3">Açıklama</th>
                <th className="py-2 px-3 text-right">Sefer</th>
                <th className="py-2 px-3 text-right">Nakit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hareketler.map((e: any) => {
                const tot = e.kind === 'sefer' ? seferTotal(cleanNumber(e.bedel), !!e.has_vat) : 0;
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 whitespace-nowrap">{formatDateTR(e.entry_date)}</td>
                    <td className="py-2 px-3 font-bold">{e.kind === 'tahsilat' ? (isHalMerkezTahsil(e) ? 'Tahsilat · kasa' : 'Tahsilat') : 'Sefer'}</td>
                    <td className="py-2 px-3 font-semibold">{e.firm_name}</td>
                    <td className="py-2 px-3 font-mono">{e.plate || '—'}</td>
                    <td className="py-2 px-3 text-slate-500">{cleanHalNote(e.notes) || '—'}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{tot ? `${money(tot)} ₺` : '—'}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-emerald-700 font-bold">{cleanNumber(e.collected) ? `${money(cleanNumber(e.collected))} ₺` : '—'}</td>
                  </tr>
                );
              })}
              {!hareketler.length && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">Bu dönemde hareket yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
