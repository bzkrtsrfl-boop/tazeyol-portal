import React, { useMemo, useState } from 'react';
import { Plus, X, Download, Printer } from 'lucide-react';
import { SortTh, sortByColumn, type ColumnSort } from './columnSort';
import { formatMoneyTR } from './money';
import { inferVehicleChargeKind, type VehicleChargeKind } from './vehicleCharge';

const SKIP = new Set([
  'freight_sales',
  'customer_collection',
  'customer_advance',
  'cash_deposit',
  'subcontractor_invoice',
  'opening_balance',
  'salary_payroll'
]);

const CAT_LABELS: Record<string, string> = {
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
  bank_commission: 'Banka masrafı & komisyon'
};

type FleetPageProps = {
  vehicles: any[];
  invoices: any[];
  canEdit: boolean;
  onAdd: () => void;
  onEdit: (v: any) => void;
  onUnlinkPlate?: (invoiceId: any, plate: string) => void | Promise<void>;
  cleanNumber: (val: any) => number;
  formatDateTR: (d: any) => string;
  normalizeVehicleType: (raw: string) => string;
  isActiveVehicle: (v: any) => boolean;
};

function cleanPlate(p: string) {
  return String(p || '').replace(/\s+/g, '').toUpperCase();
}

function catLabel(cat: string) {
  return CAT_LABELS[cat] || String(cat || 'Gider').replace(/_/g, ' ');
}

function invoicesForPlate(invoices: any[], plate: string) {
  const key = cleanPlate(plate);
  if (key.length < 5) return [];
  return (invoices || []).filter((inv: any) => {
    if (SKIP.has(String(inv.category || ''))) return false;
    if (String(inv.direction || '') === 'outgoing') return false;
    const hay = `${inv.invoice_no || ''} ${inv.description || ''}`.replace(/\s+/g, '').toUpperCase();
    return hay.includes(key);
  });
}

function latestPlateCharge(invoices: any[], plate: string, kind: VehicleChargeKind) {
  const rows = invoicesForPlate(invoices, plate)
    .filter(inv => inferVehicleChargeKind(inv) === kind)
    .sort((a, b) => String(b.issue_date || b.created_at || '').localeCompare(String(a.issue_date || a.created_at || '')));
  if (!rows.length) return 0;
  return Number(rows[0].total_amount) || 0;
}

function isRolledPlateCharge(inv: any) {
  return !!inferVehicleChargeKind(inv);
}

function money(n: number) {
  return (Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function downloadCsv(name: string, rows: string[][]) {
  const csv = '\uFEFF' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function FleetPage({
  vehicles,
  invoices,
  canEdit,
  onAdd,
  onEdit,
  onUnlinkPlate,
  cleanNumber,
  formatDateTR,
  normalizeVehicleType,
  isActiveVehicle
}: FleetPageProps) {
  const [openVeh, setOpenVeh] = useState<any | null>(null);
  const [year, setYear] = useState('all');
  const [sort, setSort] = useState<ColumnSort>({ field: 'plate', dir: 'asc' });
  const sigortaTop = vehicles.reduce((sum, v) => sum + cleanNumber(v.insurance_cost || 0), 0);
  const kaskoTop = vehicles.reduce((sum, v) => sum + cleanNumber(v.kasko_cost || 0), 0);
  const yasalTop = vehicles.reduce((sum, v) => sum + cleanNumber(v.last_mtv_cost || 0) + cleanNumber(v.inspection_cost || 0), 0);
  const sabitTop = sigortaTop + kaskoTop + yasalTop;

  const plateLines = useMemo(() => {
    if (!openVeh) return [];
    return invoicesForPlate(invoices, openVeh.plate_number)
      .map((inv: any) => ({
        id: inv.id,
        date: String(inv.issue_date || inv.created_at || '').slice(0, 10),
        title: String(inv.invoice_no || '').trim() || 'Gider',
        cat: catLabel(inv.category),
        amount: cleanNumber(inv.total_amount),
        extraPlates: [...String(inv.invoice_no || '').matchAll(/\[([^\]]+)\]/g)]
          .map(m => String(m[1]).replace(/\s+/g, '').toUpperCase())
          .filter(t => t !== 'KK' && t !== cleanPlate(openVeh.plate_number))
      }))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [openVeh, invoices, cleanNumber]);

  const years = useMemo(() => {
    const set = new Set<string>();
    plateLines.forEach(l => {
      const y = (l.date || '').slice(0, 4);
      if (/^\d{4}$/.test(y)) set.add(y);
    });
    return [...set].sort().reverse();
  }, [plateLines]);

  const visibleLines = year === 'all' ? plateLines : plateLines.filter(l => l.date.startsWith(year));
  const linesTotal = visibleLines.reduce((s, l) => s + l.amount, 0);
  const sabit =
    cleanNumber(openVeh?.insurance_cost) +
    cleanNumber(openVeh?.kasko_cost) +
    cleanNumber(openVeh?.last_mtv_cost) +
    cleanNumber(openVeh?.inspection_cost);

  const fleetRows = useMemo(() => {
    const rows = (vehicles || []).map((v, idx) => {
      const plate = (v.plate_number || '').trim();
      const plateInvs = invoicesForPlate(invoices, plate);
      const otherCost = plateInvs
        .filter(e => !isRolledPlateCharge(e))
        .reduce((sum: number, e: any) => sum + cleanNumber(e.total_amount), 0);
      const billedMuayene = latestPlateCharge(invoices, plate, 'muayene');
      const billedSigorta = latestPlateCharge(invoices, plate, 'sigorta');
      const billedKasko = latestPlateCharge(invoices, plate, 'kasko');
      const sigortaAmt = billedSigorta || cleanNumber(v.insurance_cost || 0);
      const kaskoAmt = billedKasko || cleanNumber(v.kasko_cost || 0);
      const mtvAmt = cleanNumber(v.last_mtv_cost || 0);
      const muayeneAmt = billedMuayene || cleanNumber(v.inspection_cost || 0);
      return {
        v,
        idx,
        plate,
        vehType: normalizeVehicleType(v.vehicle_type),
        active: isActiveVehicle(v),
        driver: v.driver_name || '',
        sigortaAmt,
        kaskoAmt,
        mtvAmt,
        muayeneAmt,
        inspectDate: String(v.next_inspection_date || ''),
        otherCost,
        totalCost: sigortaAmt + kaskoAmt + mtvAmt + muayeneAmt + otherCost
      };
    });
    return sortByColumn(rows, sort, {
      plate: r => r.plate,
      type: r => r.vehType,
      status: r => (r.active ? 'Aktif' : 'Pasif'),
      driver: r => r.driver,
      insurance: r => r.sigortaAmt,
      kasko: r => r.kaskoAmt,
      mtv: r => r.mtvAmt,
      inspection: r => r.inspectDate,
      other: r => r.otherCost,
      total: r => r.totalCost
    });
  }, [vehicles, invoices, cleanNumber, normalizeVehicleType, isActiveVehicle, sort]);

  const openPlate = (v: any) => {
    setYear('all');
    setOpenVeh(v);
  };

  const printDossier = () => {
    if (!openVeh) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const plate = openVeh.plate_number || '';
    const rows = visibleLines.map(l =>
      `<tr><td>${formatDateTR(l.date)}</td><td>${l.cat}</td><td>${l.title}</td><td style="text-align:right">${money(l.amount)} ₺</td></tr>`
    ).join('');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${plate} masraf</title>
      <style>
        body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#0f172a}
        h1{font-size:18px;margin:0}
        p{color:#64748b;font-size:12px;margin:4px 0 16px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border-bottom:1px solid #e2e8f0;padding:8px 6px;text-align:left}
        th{font-size:10px;text-transform:uppercase;color:#64748b}
        .box{display:flex;gap:16px;margin:12px 0 20px;font-size:12px}
        .box b{display:block;font-size:16px}
      </style></head><body>
      <h1>Tazeyol ERP — Plaka masraf dökümü</h1>
      <p>${plate} · ${openVeh.driver_name || 'sürücü yok'} · ${year === 'all' ? 'Tüm dönem' : year} · ${new Date().toLocaleDateString('tr-TR')}</p>
      <div class="box">
        <div>Künye yıllık sabit<b>${money(sabit)} ₺</b></div>
        <div>Fatura / gider kalemleri<b>${money(linesTotal)} ₺</b></div>
        <div>Genel toplam<b>${money(sabit + linesTotal)} ₺</b></div>
      </div>
      <table><thead><tr><th>Tarih</th><th>Tür</th><th>Açıklama</th><th style="text-align:right">Tutar</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">Bu dönemde plakalı gider faturası yok.</td></tr>'}</tbody>
      <tfoot><tr><th colspan="3">Toplam</th><th style="text-align:right">${money(linesTotal)} ₺</th></tr></tfoot>
      </table></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  const excelDossier = () => {
    if (!openVeh) return;
    const plate = String(openVeh.plate_number || 'plaka').replace(/\s+/g, '');
    downloadCsv(`Plaka_masraf_${plate}_${year === 'all' ? 'tum' : year}.csv`, [
      ['Tazeyol ERP — Plaka masraf dökümü'],
      ['Plaka', openVeh.plate_number || ''],
      ['Sürücü', openVeh.driver_name || ''],
      ['Dönem', year === 'all' ? 'Tüm dönem' : year],
      [],
      ['Künye yıllık sigorta', formatMoneyTR(openVeh.insurance_cost)],
      ['Künye yıllık kasko', formatMoneyTR(openVeh.kasko_cost)],
      ['Künye yıllık MTV', formatMoneyTR(openVeh.last_mtv_cost)],
      ['Künye muayene', formatMoneyTR(openVeh.inspection_cost)],
      [],
      ['Tarih', 'Tür', 'Açıklama', 'Tutar'],
      ...visibleLines.map(l => [formatDateTR(l.date), l.cat, l.title, formatMoneyTR(l.amount)]),
      ['', '', 'Gider toplam', formatMoneyTR(linesTotal)]
    ]);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
      <div className="flex justify-between items-center pb-5 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-lg text-slate-900">İç Filo ({vehicles.length} Araç)</h3>
          <p className="text-xs text-slate-500 mt-0.5">Şirket öz malı. Muayene / sigorta / kasko sütunu son kaydı gösterir; eski ödemeler plaka dökümünde durur. Plakaya basınca masraf açılır.</p>
        </div>
        {canEdit && (
          <button
            onClick={onAdd}
            className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
            <Plus className="w-4 h-4" /> Yeni Araç Ekle
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-[11px] font-medium text-slate-500 uppercase block">Toplam Sigorta (Yıllık)</span>
          <span className="text-base font-bold text-slate-800 block mt-1">{money(sigortaTop)} ₺</span>
          <span className="text-[10px] text-slate-400">{vehicles.length} Öz Mal Araç</span>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-[11px] font-medium text-slate-500 uppercase block">Toplam Kasko (Yıllık)</span>
          <span className="text-base font-bold text-slate-800 block mt-1">{money(kaskoTop)} ₺</span>
          <span className="text-[10px] text-slate-400">Poliçe Toplamı</span>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-[11px] font-medium text-slate-500 uppercase block">Toplam MTV & Muayene</span>
          <span className="text-base font-bold text-slate-800 block mt-1">{money(yasalTop)} ₺</span>
          <span className="text-[10px] text-slate-400">Yıllık Yasal Yük</span>
        </div>
        <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-[11px] font-semibold text-blue-700 uppercase block">FİLO SABİT GİDER TOPLAMI</span>
          <span className="text-base font-black text-blue-900 block mt-1">{money(sabitTop)} ₺</span>
          <span className="text-[11px] font-medium text-blue-600">
            Aylık: {(sabitTop / 12).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺ / ay
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
            <tr>
              <SortTh className="py-3 px-3" label="Plaka" field="plate" sort={sort} onSort={setSort} />
              <SortTh className="py-3 px-3" label="Tip" field="type" sort={sort} onSort={setSort} />
              <SortTh className="py-3 px-3" label="Durum" field="status" sort={sort} onSort={setSort} />
              <SortTh className="py-3 px-3" label="Sürücü" field="driver" sort={sort} onSort={setSort} />
              <SortTh className="py-3 px-3" label="Sigorta" field="insurance" sort={sort} onSort={setSort} firstDir="desc" />
              <SortTh className="py-3 px-3" label="Kasko" field="kasko" sort={sort} onSort={setSort} firstDir="desc" />
              <SortTh className="py-3 px-3" label="Yıllık MTV" field="mtv" sort={sort} onSort={setSort} firstDir="desc" />
              <SortTh className="py-3 px-3" label="Muayene" field="inspection" sort={sort} onSort={setSort} />
              <SortTh className="py-3 px-3" label="Diğer giderler" field="other" sort={sort} onSort={setSort} align="right" firstDir="desc" />
              <SortTh className="py-3 px-3" label="Toplam maliyet" field="total" sort={sort} onSort={setSort} align="right" firstDir="desc" />
              {canEdit && <th className="py-3 px-3 text-center">İşlem</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fleetRows.map((row) => {
              const { v, idx, plate, vehType, active, sigortaAmt, kaskoAmt, mtvAmt, muayeneAmt, otherCost, totalCost } = row;
              return (
                <tr key={v.id || idx} className={`hover:bg-slate-50 transition ${active ? '' : 'opacity-45'}`}>
                  <td className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => openPlate(v)}
                      className="font-mono font-bold text-blue-700 hover:underline"
                      title="Masraf dökümü"
                    >
                      {plate || '-'}
                    </button>
                  </td>
                  <td className="py-3 px-3 text-slate-600">{vehType}</td>
                  <td className="py-3 px-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {active ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-700 font-medium">{v.driver_name || '-'}</td>
                  <td className="py-3 px-3">
                    <span className="font-semibold text-slate-800">
                      {sigortaAmt > 0 ? `${sigortaAmt.toLocaleString('tr-TR')} ₺` : '-'}
                    </span>
                    {(v.insurance_expiry_date || v.insurance_start_date) && (
                      <span className="block text-[10px] text-slate-400">
                        Bitiş: {formatDateTR(v.insurance_expiry_date || v.insurance_start_date)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-semibold text-slate-800">
                      {kaskoAmt > 0 ? `${kaskoAmt.toLocaleString('tr-TR')} ₺` : '-'}
                    </span>
                    {(v.kasko_expiry_date || v.kasko_start_date) && (
                      <span className="block text-[10px] text-slate-400">
                        Bitiş: {formatDateTR(v.kasko_expiry_date || v.kasko_start_date)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-800">
                    {mtvAmt > 0 ? `${mtvAmt.toLocaleString('tr-TR')} ₺` : '-'}
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-semibold text-slate-800">
                      {muayeneAmt > 0 ? `${muayeneAmt.toLocaleString('tr-TR')} ₺` : '-'}
                    </span>
                    {v.next_inspection_date && (
                      <span className="block text-[10px] text-slate-400">
                        Tarih: {formatDateTR(v.next_inspection_date)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={`font-bold ${otherCost > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {otherCost > 0 ? `${money(otherCost)} ₺` : '-'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-black text-slate-900 text-sm">
                    {money(totalCost)} ₺
                  </td>
                  {canEdit && (
                    <td className="py-3 px-3 text-center">
                      <button onClick={() => onEdit(v)} className="text-blue-600 hover:text-blue-800 font-medium text-xs">
                        Düzenle
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {openVeh && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) setOpenVeh(null); }}>
          <div className="bg-white rounded-2xl max-w-3xl w-full p-5 shadow-xl border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-lg font-mono">{openVeh.plate_number}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {normalizeVehicleType(openVeh.vehicle_type)} · {openVeh.driver_name || 'sürücü yok'} · açıklama veya fatura no’da bu plaka geçen giderler
                </p>
              </div>
              <button type="button" onClick={() => setOpenVeh(null)} className="p-1.5 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex flex-wrap items-center gap-2 py-3">
              <select
                value={year}
                onChange={e => setYear(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
              >
                <option value="all">Tüm yıllar</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <button type="button" onClick={printDossier} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5" /> Yazdır / PDF
              </button>
              <button type="button" onClick={excelDossier} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-emerald-600" /> Excel
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-[11px]">
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">Sigorta <b className="block text-sm">{money(cleanNumber(openVeh.insurance_cost))} ₺</b></div>
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">Kasko <b className="block text-sm">{money(cleanNumber(openVeh.kasko_cost))} ₺</b></div>
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">MTV <b className="block text-sm">{money(cleanNumber(openVeh.last_mtv_cost))} ₺</b></div>
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">Muayene <b className="block text-sm">{money(cleanNumber(openVeh.inspection_cost))} ₺</b></div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Tarih</th>
                    <th className="py-2 px-3">Tür</th>
                    <th className="py-2 px-3">Açıklama</th>
                    <th className="py-2 px-3 text-right">Tutar</th>
                    {onUnlinkPlate ? <th className="py-2 px-3"></th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleLines.map(l => (
                    <tr key={String(l.id)}>
                      <td className="py-2 px-3 whitespace-nowrap">{formatDateTR(l.date)}</td>
                      <td className="py-2 px-3 text-slate-600">{l.cat}</td>
                      <td className="py-2 px-3">{l.title}</td>
                      <td className="py-2 px-3 text-right font-bold tabular-nums">{money(l.amount)} ₺</td>
                      {onUnlinkPlate ? (
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => void onUnlinkPlate(l.id, openVeh.plate_number)}
                            className="text-[10px] font-bold text-rose-600 hover:underline whitespace-nowrap"
                            title="Yanlış plaka seçildiyse bu kayıttan çıkar"
                          >
                            Bu plakadan çıkar
                          </button>
                          {l.extraPlates.length > 0 && (
                            <span className="block text-[10px] text-amber-700">+ {l.extraPlates.join(', ')}</span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  {!visibleLines.length && (
                    <tr><td colSpan={onUnlinkPlate ? 5 : 4} className="py-8 text-center text-slate-400">Bu plakada faturalı gider yok. Genel giderde plakayı açıklamaya yazın.</td></tr>
                  )}
                </tbody>
                {visibleLines.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td className="py-2.5 px-3 font-bold" colSpan={onUnlinkPlate ? 4 : 3}>Gider toplam ({visibleLines.length})</td>
                      <td className="py-2.5 px-3 text-right font-black">{money(linesTotal)} ₺</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">
              Künye sabitleri yıllık kart tutarıdır; alttaki liste Genel Gider / tedarik faturalarıdır. Genel toplam {money(sabit + linesTotal)} ₺.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
