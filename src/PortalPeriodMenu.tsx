import React, { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';

type Props = {
  start: string;
  end: string;
  formatDateTR: (d: any) => string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
  onPeriod: (start: string, end: string) => void;
  currentMonth: () => { start: string; end: string };
  previousMonth: () => { start: string; end: string };
};

/** Dönem kutusunu açmak tüm portalı çizmez; tarihi uygulayınca sayfa yenilenir. */
export default function PortalPeriodMenu({
  start,
  end,
  formatDateTR,
  onStart,
  onEnd,
  onPeriod,
  currentMonth,
  previousMonth
}: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const apply = (a: string, b: string) => {
    setOpen(false);
    onPeriod(a, b);
  };

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-2.5 sm:px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-semibold text-xs transition"
        title="Dönem filtresi"
      >
        <Calendar className="w-4 h-4 text-[#009fe3] shrink-0" />
        <span className="tabular-nums whitespace-nowrap">
          {start && end ? `${formatDateTR(start)} — ${formatDateTR(end)}` : 'Tüm dönem'}
        </span>
        <span className="text-slate-400 hidden sm:inline">▼</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl p-4 z-50 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-bold text-slate-800 text-xs">Tarih aralığı</span>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={start} onChange={e => onStart(e.target.value)} className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none" />
            <span className="text-slate-400 font-bold">—</span>
            <input type="date" value={end} onChange={e => onEnd(e.target.value)} className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button type="button" onClick={() => { const r = currentMonth(); apply(r.start, r.end); }} className="px-3 py-2 bg-slate-50 hover:bg-[#009fe3] hover:text-white text-slate-700 rounded-xl font-semibold text-xs transition text-center">Bu Ay</button>
            <button type="button" onClick={() => { const r = previousMonth(); apply(r.start, r.end); }} className="px-3 py-2 bg-slate-50 hover:bg-[#009fe3] hover:text-white text-slate-700 rounded-xl font-semibold text-xs transition text-center">Geçen Ay</button>
            <button type="button" onClick={() => { const endD = new Date(); const startD = new Date(); startD.setDate(endD.getDate() - 30); apply(startD.toISOString().split('T')[0], endD.toISOString().split('T')[0]); }} className="px-3 py-2 bg-slate-50 hover:bg-[#009fe3] hover:text-white text-slate-700 rounded-xl font-semibold text-xs transition text-center">Son 30 Gün</button>
            <button type="button" onClick={() => { const endD = new Date(); const startD = new Date(); startD.setMonth(endD.getMonth() - 3); apply(startD.toISOString().split('T')[0], endD.toISOString().split('T')[0]); }} className="px-3 py-2 bg-slate-50 hover:bg-[#009fe3] hover:text-white text-slate-700 rounded-xl font-semibold text-xs transition text-center">Son 3 Ay</button>
            <button type="button" onClick={() => apply('', '')} className="col-span-2 px-3 py-2 bg-slate-50 hover:bg-[#009fe3] hover:text-white text-slate-700 rounded-xl font-semibold text-xs transition text-center">Tüm dönem</button>
          </div>
        </div>
      )}
    </div>
  );
}
