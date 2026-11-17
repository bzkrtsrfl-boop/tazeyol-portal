import React from 'react';
import { Plus } from 'lucide-react';

type FleetPageProps = {
  vehicles: any[];
  invoices: any[];
  canEdit: boolean;
  onAdd: () => void;
  onEdit: (v: any) => void;
  cleanNumber: (val: any) => number;
  formatDateTR: (d: any) => string;
  normalizeVehicleType: (raw: string) => string;
  isActiveVehicle: (v: any) => boolean;
};

export default function FleetPage({
  vehicles,
  invoices,
  canEdit,
  onAdd,
  onEdit,
  cleanNumber,
  formatDateTR,
  normalizeVehicleType,
  isActiveVehicle
}: FleetPageProps) {
  const money = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
  const sigortaTop = vehicles.reduce((sum, v) => sum + cleanNumber(v.insurance_cost || 0), 0);
  const kaskoTop = vehicles.reduce((sum, v) => sum + cleanNumber(v.kasko_cost || 0), 0);
  const yasalTop = vehicles.reduce((sum, v) => sum + cleanNumber(v.last_mtv_cost || 0) + cleanNumber(v.inspection_cost || 0), 0);
  const sabitTop = sigortaTop + kaskoTop + yasalTop;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
      <div className="flex justify-between items-center pb-5 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-lg text-slate-900">Araç Filosu ({vehicles.length} Araç)</h3>
          <p className="text-xs text-slate-500 mt-0.5">Sürücü, muayene, sigorta, kasko ve otomatik MTV bildirimleri.</p>
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
              <th className="py-3 px-3">PLAKA</th>
              <th className="py-3 px-3">TİP</th>
              <th className="py-3 px-3">DURUM</th>
              <th className="py-3 px-3">SÜRÜCÜ</th>
              <th className="py-3 px-3">SİGORTA (TUTAR / BİTİŞ)</th>
              <th className="py-3 px-3">KASKO (TUTAR / BİTİŞ)</th>
              <th className="py-3 px-3">YILLIK MTV</th>
              <th className="py-3 px-3">MUAYENE</th>
              <th className="py-3 px-3 text-right">DİĞER GİDERLER</th>
              <th className="py-3 px-3 text-right">TOPLAM MALİYET</th>
              {canEdit && <th className="py-3 px-3 text-center">İŞLEM</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vehicles.map((v, idx) => {
              const plate = (v.plate_number || '').trim();
              const cleanPlate = plate.replace(/\s+/g, '').toUpperCase();
              const plateExpenses = cleanPlate.length >= 5 ? invoices.filter((inv: any) => {
                const desc = (inv.description || '').replace(/\s+/g, '').toUpperCase();
                const invNo = (inv.invoice_no || '').replace(/\s+/g, '').toUpperCase();
                return (
                  inv.category !== 'freight_sales' &&
                  inv.category !== 'customer_collection' &&
                  (desc.includes(cleanPlate) || invNo.includes(cleanPlate))
                );
              }) : [];
              const otherCost = plateExpenses.reduce((sum: number, e: any) => sum + cleanNumber(e.total_amount), 0);
              const sigortaAmt = cleanNumber(v.insurance_cost || 0);
              const kaskoAmt = cleanNumber(v.kasko_cost || 0);
              const mtvAmt = cleanNumber(v.last_mtv_cost || 0);
              const muayeneAmt = cleanNumber(v.inspection_cost || 0);
              const totalCost = sigortaAmt + kaskoAmt + mtvAmt + muayeneAmt + otherCost;
              const vehType = normalizeVehicleType(v.vehicle_type);
              const active = isActiveVehicle(v);
              return (
                <tr key={v.id || idx} className={`hover:bg-slate-50 transition ${active ? '' : 'opacity-45'}`}>
                  <td className="py-3 px-3 font-mono font-bold text-blue-700">{plate || '-'}</td>
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
    </div>
  );
}
