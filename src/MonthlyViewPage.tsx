import React, { useMemo, useState } from 'react';
import { Calendar, ChevronRight } from 'lucide-react';
import { yearMonthTrLabel } from './disAlim';
import { buildMonthlyView, type MonthlyViewLine } from './monthlyView';

type Props = {
  invoices: any[];
  cleanNumber: (v: any) => number;
  formatDateTR: (d: any) => string;
};

const PIE_COLORS = ['#2563eb', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#f97316', '#64748b', '#db2777'];

function money(n: number) {
  return (Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function LineTable({
  rows,
  formatDateTR,
  empty
}: {
  rows: MonthlyViewLine[];
  formatDateTR: (d: any) => string;
  empty: string;
}) {
  const total = rows.reduce((s, l) => s + l.amount, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
          <tr>
            <th className="py-2 px-3">Tarih</th>
            <th className="py-2 px-3">Açıklama</th>
            <th className="py-2 px-3 text-right">Tutar</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((l, i) => (
            <tr key={String(l.id) + '-' + i}>
              <td className="py-2 px-3 whitespace-nowrap">{formatDateTR(l.date)}</td>
              <td className="py-2 px-3">
                {l.title}
                {l.bucket === 'card' ? <span className="ml-1.5 text-purple-600 font-semibold">kart</span> : null}
              </td>
              <td className="py-2 px-3 text-right font-bold tabular-nums">{money(l.amount)} ₺</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={3} className="py-6 px-3 text-center text-slate-400">{empty}</td>
            </tr>
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50">
              <td className="py-2.5 px-3" colSpan={2}>
                <span className="font-bold text-slate-800">Toplam</span>
                <span className="text-slate-400 font-normal ml-1.5">({rows.length} kayıt)</span>
              </td>
              <td className="py-2.5 px-3 text-right font-black tabular-nums text-slate-900">{money(total)} ₺</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function FoldBlock({
  id,
  title,
  rows,
  formatDateTR,
  empty,
  open,
  onToggle
}: {
  id: string;
  title: string;
  rows: MonthlyViewLine[];
  formatDateTR: (d: any) => string;
  empty: string;
  open: boolean;
  onToggle: () => void;
}) {

  const total = rows.reduce((s, l) => s + l.amount, 0);
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition"
      >
        <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="flex-1 min-w-0 text-sm font-bold text-slate-800 truncate">{title}</span>
        <span className="text-[11px] text-slate-400 shrink-0">{rows.length} kayıt</span>
        <span className="text-sm font-black tabular-nums text-slate-900 shrink-0">{money(total)} ₺</span>
      </button>
      {open && (
        <div className="border-t border-slate-100">
          <LineTable rows={rows} formatDateTR={formatDateTR} empty={empty} />
        </div>
      )}
    </div>
  );
}

export default function MonthlyViewPage({ invoices, cleanNumber, formatDateTR }: Props) {
  const [ym, setYm] = useState(() => new Date().toISOString().slice(0, 7));
  const [openFolds, setOpenFolds] = useState<Record<string, boolean>>({});
  const toggleFold = (id: string) => setOpenFolds(s => ({ ...s, [id]: !s[id] }));
  const model = useMemo(() => buildMonthlyView(invoices, ym, cleanNumber), [invoices, ym, cleanNumber]);
  const girdi = Math.max(0, model.salesTotal);
  const cikti = Math.max(0, model.giderler);
  const flowTotal = girdi + cikti;
  const girdiShare = flowTotal > 0 ? (girdi / flowTotal) * 100 : 50;
  const barMax = Math.max(girdi, cikti, 1);

  let pieAcc = 0;
  const pieStops = model.pieRows.map((r, i) => {
    const pct = model.giderler > 0 ? (r.amount / model.giderler) * 100 : 0;
    const from = pieAcc;
    pieAcc += pct;
    return { ...r, color: PIE_COLORS[i % PIE_COLORS.length], from, to: pieAcc, pct };
  });
  const pieCss = pieStops.length
    ? `conic-gradient(${pieStops.map(s => `${s.color} ${s.from.toFixed(2)}% ${s.to.toFixed(2)}%`).join(', ')})`
    : '#e2e8f0';
  const pieMain = pieStops.filter(s => s.pct >= 1).slice(0, 6);
  const pieRestAmt = pieStops.filter(s => !pieMain.includes(s)).reduce((s, r) => s + r.amount, 0);
  const pieLegend = pieRestAmt > 0.009
    ? [...pieMain, {
        key: 'diger',
        label: 'Diğer',
        amount: pieRestAmt,
        color: '#94a3b8',
        pct: model.giderler > 0 ? (pieRestAmt / model.giderler) * 100 : 0
      }]
    : pieMain;

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    set.add(new Date().toISOString().slice(0, 7));
    (invoices || []).forEach((inv: any) => {
      const d = String(inv?.issue_date || '').slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(d)) set.add(d);
    });
    const list = [...set].sort().reverse();
    if (ym && !list.includes(ym)) list.unshift(ym);
    return list.slice(0, 36);
  }, [invoices, ym]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 border-b border-slate-100 gap-4">
        <div>
          <h3 className="font-bold text-lg text-slate-900">Aylık görünüm</h3>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Yalnız bu menü. Satışlar, taşeron ve kasa/kart {model.prevLabel} üzerinden.
            Personel yalnız burada: {model.prevLabel} maaşları + {model.currentLabel} ilk haftası (1–7), Ekim hakedişi fatura primiyle kapanır.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <Calendar className="w-4 h-4 text-[#009fe3]" />
          Mevcut ay
          <select
            value={ym}
            onChange={e => setYm(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold"
          >
            {monthOptions.map(m => (
              <option key={m} value={m}>{yearMonthTrLabel(m)}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 flex flex-col sm:flex-row items-center gap-8">
        <div className="relative w-36 h-36 shrink-0">
          <div
            className="w-full h-full rounded-full"
            style={{ background: `conic-gradient(#10b981 0% ${girdiShare}%, #fb7185 ${girdiShare}% 100%)` }}
          />
          <div className="absolute inset-7 rounded-full bg-white flex flex-col items-center justify-center text-center px-2">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider">NET</span>
            <span className={`text-sm font-black leading-tight ${model.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {model.net >= 0 ? '+' : ''}{money(model.net)}
            </span>
          </div>
        </div>
        <div className="flex-1 w-full space-y-5">
          <div>
            <div className="flex justify-between items-baseline text-xs font-bold mb-1.5">
              <span className="text-emerald-700 uppercase tracking-wider">Satışlar</span>
              <span className="text-emerald-800 text-sm tabular-nums">{money(girdi)} ₺</span>
            </div>
            <div className="h-4 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(girdi / barMax) * 100}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">{model.prevLabel} satış faturaları</p>
          </div>
          <div>
            <div className="flex justify-between items-baseline text-xs font-bold mb-1.5">
              <span className="text-rose-700 uppercase tracking-wider">Giderler</span>
              <span className="text-rose-800 text-sm tabular-nums">{money(cikti)} ₺</span>
            </div>
            <div className="h-4 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full rounded-full bg-rose-400" style={{ width: `${(cikti / barMax) * 100}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {model.prevLabel}: taşeron {money(model.subcontractorTotal)} · personel {money(model.personnelTotal)} · kasa {money(model.cashOutTotal)} · kart {money(model.cardOutTotal)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <div className="rounded-2xl border border-slate-200 px-4 py-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Net</span>
          <div className={`text-2xl font-black tabular-nums mt-1 ${model.net >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
            {model.net >= 0 ? '' : '−'}{money(Math.abs(model.net))} ₺
          </div>
          <div className="mt-2 flex gap-6 text-[11px]">
            <div>
              <span className="text-slate-400">Satışlar </span>
              <b className="text-emerald-700 tabular-nums">{money(model.salesTotal)} ₺</b>
            </div>
            <div>
              <span className="text-slate-400">Giderler </span>
              <b className="text-rose-700 tabular-nums">{money(model.giderler)} ₺</b>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 px-4 py-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gider dağılımı</span>
          <div className="flex items-start gap-3 mt-2">
            <div className="w-16 h-16 rounded-full shrink-0 border border-slate-100" style={{ background: pieCss }} />
            <div className="flex-1 min-w-0 space-y-0.5">
              {pieLegend.map(s => (
                <div key={s.key} className="grid grid-cols-[minmax(0,1fr)_auto_2.25rem] items-center gap-x-2 text-[11px] leading-5">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ background: s.color }} />
                    <span className="text-slate-700 truncate">{s.label}</span>
                  </span>
                  <span className="tabular-nums font-semibold text-slate-800 whitespace-nowrap">{money(s.amount)} ₺</span>
                  <span className="tabular-nums font-semibold text-slate-600 text-right">{s.pct.toFixed(0)}%</span>
                </div>
              ))}
              {!pieLegend.length && <span className="text-xs text-slate-400">O ay gider yok.</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <FoldBlock
          id="sales"
          title={`Satış faturaları — ${model.prevLabel}`}
          rows={model.salesLines}
          formatDateTR={formatDateTR}
          empty="Önceki ay satış faturası yok."
          open={!!openFolds.sales}
          onToggle={() => toggleFold('sales')}
        />
        <FoldBlock
          id="sub"
          title={`Alt yüklenici faturaları — ${model.prevLabel}`}
          rows={model.subcontractorLines}
          formatDateTR={formatDateTR}
          empty="Önceki ay alt yüklenici faturası yok."
          open={!!openFolds.sub}
          onToggle={() => toggleFold('sub')}
        />
        <FoldBlock
          id="personnel"
          title={`Personel ödemeleri — ${model.prevLabel} + ${model.currentLabel} 1–7`}
          rows={model.personnelLines}
          formatDateTR={formatDateTR}
          empty="O dönem için personel ödemesi yok."
          open={!!openFolds.personnel}
          onToggle={() => toggleFold('personnel')}
        />
        <FoldBlock
          id="cash"
          title={`Kasa ve kart çıkışları — ${model.prevLabel}`}
          rows={model.monthOutLines}
          formatDateTR={formatDateTR}
          empty="O ay kasa veya kart çıkışı yok."
          open={!!openFolds.cash}
          onToggle={() => toggleFold('cash')}
        />
      </div>
    </div>
  );
}
