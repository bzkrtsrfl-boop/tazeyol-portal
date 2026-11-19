import React, { useMemo, useState } from 'react';
import { Edit2, Trash2, X } from 'lucide-react';
import { supabase } from './supabase';
import {
  filoDepotLabel,
  filoDepotSlug,
  isAlkanContractor,
  isFiloSharedDepot,
  mergeFiloDepots,
  tripMonthLockedForSaha,
  type FiloDepot,
  type FiloDepotId
} from './tripFilo';

type Props = {
  depot: FiloDepotId;
  plates: any[];
  rows: any[];
  isAdmin: boolean;
  canEditModule: boolean;
  role: 'admin' | 'reporter' | 'saha' | null;
  cleanNumber: (v: any) => number;
  depots: FiloDepot[];
  allDepots: FiloDepot[];
  onSelectDepot?: (id: FiloDepotId) => void;
  onReload: () => Promise<void> | void;
};

export default function TripSettlementsPage({
  depot,
  plates,
  rows,
  isAdmin,
  canEditModule,
  role,
  cleanNumber,
  depots,
  allDepots,
  onSelectDepot,
  onReload
}: Props) {
  const catalog = mergeFiloDepots(allDepots);
  const visible = depots?.length ? depots : catalog;
  const todayYm = new Date().toISOString().slice(0, 7);
  const [ym, setYm] = useState(todayYm);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'list' | 'tanim'>('list');
  const [drafts, setDrafts] = useState<Record<string, { fuel: string; total: string }>>({});
  const [plateForm, setPlateForm] = useState({ plate: '', driver: '', contractor_name: '', depot });
  const [editingPlateId, setEditingPlateId] = useState<string | null>(null);
  const [depotName, setDepotName] = useState('');
  const [depotEdits, setDepotEdits] = useState<Record<string, string>>({});

  const money = (n: number) => (Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sahaLocked = role === 'saha' && tripMonthLockedForSaha(ym);
  const canWriteMonth = canEditModule && (isAdmin || (role === 'saha' && !sahaLocked));

  const depotPlates = useMemo(
    () => (plates || []).filter((p: any) => p.is_active !== false && p.depot === depot),
    [plates, depot]
  );

  const monthByPlate = useMemo(() => {
    const map = new Map<string, any>();
    (rows || []).forEach((r: any) => {
      if (String(r.year_month || '').slice(0, 7) !== ym) return;
      map.set(String(r.plate || '').toUpperCase().replace(/\s+/g, ''), r);
    });
    return map;
  }, [rows, ym]);

  const listed = useMemo(() => {
    return [...depotPlates]
      .sort((a, b) => String(a.contractor_name || '').localeCompare(String(b.contractor_name || ''), 'tr')
        || String(a.plate || '').localeCompare(String(b.plate || ''), 'tr'))
      .map((p: any) => {
        const key = String(p.plate || '').toUpperCase().replace(/\s+/g, '');
        const row = monthByPlate.get(key);
        return { plate: p, row };
      });
  }, [depotPlates, monthByPlate]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof listed>();
    listed.forEach(item => {
      const k = String(item.plate.contractor_name || '').trim() || '—';
      const arr = map.get(k) || [];
      arr.push(item);
      map.set(k, arr);
    });
    return [...map.entries()].map(([name, items]) => ({
      name,
      items,
      fuel: items.reduce((s, it) => s + cleanNumber(it.row?.fuel_amount), 0),
      total: items.reduce((s, it) => s + cleanNumber(it.row?.total_amount), 0)
    }));
  }, [listed, cleanNumber]);

  const depotOrder = useMemo(() => visible.map(d => d.id), [visible]);
  const labelOf = (id: string) => filoDepotLabel(id, catalog);

  const monthDepotTotals = useMemo(() => {
    const map: Record<string, { fuel: number; total: number }> = {};
    depotOrder.forEach(id => { map[id] = { fuel: 0, total: 0 }; });
    (rows || []).forEach((r: any) => {
      if (String(r.year_month || '').slice(0, 7) !== ym) return;
      const d = String(r.depot || '');
      if (!map[d]) map[d] = { fuel: 0, total: 0 };
      map[d].fuel += cleanNumber(r.fuel_amount);
      map[d].total += cleanNumber(r.total_amount);
    });
    const grand = Object.values(map).reduce((a, v) => ({ fuel: a.fuel + v.fuel, total: a.total + v.total }), { fuel: 0, total: 0 });
    return { map, grand };
  }, [rows, ym, depotOrder, cleanNumber]);

  const valFor = (plate: string, field: 'fuel' | 'total', current: any) => {
    const d = drafts[plate];
    if (d && d[field] !== undefined && d[field] !== '') return d[field];
    if (d && d[field] === '') return '';
    const n = field === 'fuel' ? current?.fuel_amount : current?.total_amount;
    return n || n === 0 ? String(n) : '';
  };

  const saveLine = async (p: any) => {
    if (!canWriteMonth) return;
    const key = String(p.plate || '').toUpperCase().replace(/\s+/g, '');
    const fuel = cleanNumber(valFor(key, 'fuel', monthByPlate.get(key)));
    const total = cleanNumber(valFor(key, 'total', monthByPlate.get(key)));
    const existing = monthByPlate.get(key);
    const payload: any = {
      year_month: ym,
      plate: key,
      driver: p.driver || null,
      contractor_name: p.contractor_name || '',
      depot,
      fuel_amount: fuel,
      total_amount: total
    };
    setBusy(true);
    const q = existing
      ? supabase.from('trip_settlements').update(payload).eq('id', existing.id)
      : supabase.from('trip_settlements').insert([{ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id || null }]);
    const { error } = await q;
    if (error) {
      setBusy(false);
      alert('Yazılamadı. setup_trip_settlements.sql çalıştırın.\n' + error.message);
      return;
    }
    if (isAlkanContractor(p.contractor_name)) {
      const { error: syncErr } = await supabase.rpc('sync_filo_profit_amounts', {
        p_year_month: ym,
        p_plate: key,
        p_fuel: fuel,
        p_invoice_rev: total
      });
      if (syncErr) {
        setBusy(false);
        alert('Filo kaydedildi ama öz mal kârlılığa yazılamadı. setup_trip_settlements.sql dosyasını tekrar Run edin.\n' + syncErr.message);
        await onReload();
        return;
      }
    }
    setBusy(false);
    setDrafts(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    await onReload();
  };

  const resetPlateForm = () => {
    setEditingPlateId(null);
    setPlateForm({ plate: '', driver: '', contractor_name: '', depot });
  };

  const addDepot = async () => {
    if (!isAdmin) return;
    const label = depotName.trim();
    if (!label) {
      alert('Depo adı yazın.');
      return;
    }
    let id = filoDepotSlug(label);
    const taken = new Set(catalog.map(d => d.id));
    if (taken.has(id)) {
      let n = 2;
      while (taken.has(`${id}_${n}`)) n += 1;
      id = `${id}_${n}`;
    }
    const maxSort = Math.max(0, ...catalog.filter(d => !isFiloSharedDepot(d)).map(d => d.sort_order || 0));
    setBusy(true);
    const { error } = await supabase.from('trip_filo_depots').insert([{ id, label, is_shared: false, sort_order: maxSort + 1, is_active: true }]);
    setBusy(false);
    if (error) {
      alert('Depo eklenemedi. setup_trip_settlements.sql dosyasını tekrar Run edin.\n' + error.message);
      return;
    }
    setDepotName('');
    await onReload();
  };

  const renameDepot = async (d: FiloDepot) => {
    if (!isAdmin) return;
    const label = (depotEdits[d.id] ?? d.label).trim();
    if (!label) {
      alert('Depo adı boş olamaz.');
      return;
    }
    if (label === d.label) return;
    setBusy(true);
    const { error } = await supabase.from('trip_filo_depots').update({ label }).eq('id', d.id);
    setBusy(false);
    if (error) {
      alert('İsim değişmedi: ' + error.message);
      return;
    }
    setDepotEdits(prev => {
      const next = { ...prev };
      delete next[d.id];
      return next;
    });
    await onReload();
  };

  const savePlate = async () => {
    if (!isAdmin) return;
    const plate = plateForm.plate.trim().toUpperCase().replace(/\s+/g, '');
    const contractor_name = plateForm.contractor_name.trim();
    if (!plate || !contractor_name || !plateForm.depot) {
      alert('Plaka, yüklenici ve depo zorunlu.');
      return;
    }
    const payload = {
      plate,
      driver: plateForm.driver.trim() || null,
      contractor_name,
      depot: plateForm.depot
    };
    const prev = (plates || []).find((p: any) => p.id === editingPlateId);
    setBusy(true);
    const q = editingPlateId
      ? supabase.from('trip_fleet_plates').update(payload).eq('id', editingPlateId)
      : supabase.from('trip_fleet_plates').insert([payload]);
    const { error } = await q;
    if (error) {
      setBusy(false);
      alert('Plaka yazılamadı: ' + error.message);
      return;
    }
    if (prev) {
      const oldKey = String(prev.plate || '').toUpperCase().replace(/\s+/g, '');
      const plateKeys = [...new Set([oldKey, String(prev.plate || '').trim()].filter(Boolean))];
      const { error: rowErr } = await supabase
        .from('trip_settlements')
        .update({ plate, driver: payload.driver, contractor_name, depot: payload.depot })
        .in('plate', plateKeys);
      if (rowErr) {
        setBusy(false);
        alert('Plaka tanımı değişti ama aylık satırlar güncellenemedi: ' + rowErr.message);
        await onReload();
        return;
      }
    }
    setBusy(false);
    resetPlateForm();
    await onReload();
  };

  const deletePlate = async (p: any) => {
    if (!isAdmin) return;
    const key = String(p.plate || '').toUpperCase().replace(/\s+/g, '');
    const plateKeys = [...new Set([key, String(p.plate || '').trim()].filter(Boolean))];
    if (!window.confirm(`${p.plate} silinsin mi? Aylık yakıt/toplam satırları da silinir. Kasa ve cariye bağlı değildir.`)) return;
    setBusy(true);
    const { error: rowErr } = await supabase.from('trip_settlements').delete().in('plate', plateKeys);
    if (rowErr) {
      setBusy(false);
      alert('Aylık satırlar silinemedi: ' + rowErr.message);
      return;
    }
    const { error } = await supabase.from('trip_fleet_plates').delete().eq('id', p.id);
    setBusy(false);
    if (error) {
      alert('Plaka silinemedi: ' + error.message);
      return;
    }
    if (editingPlateId === p.id) resetPlateForm();
    await onReload();
  };

  const allPlatesAdmin = useMemo(
    () => [...(plates || [])].sort((a, b) => String(a.plate).localeCompare(String(b.plate), 'tr')),
    [plates]
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-lg text-slate-900">Filo · {labelOf(depot)}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Saha yakıt ve toplam yazar; sonraki ayın 5’inde kilitlenir. Alkan satırındaki yakıt ve toplam, Öz mal kârlılığa gider ve orada elle değiştirilmez.
          </p>
          {sahaLocked && <p className="text-xs text-amber-800 mt-1 font-semibold">Bu ay kilitli (ayın 5’i geçti). Yalnız görüntü.</p>}
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold">
            Ay
            <input type="month" value={ym} onChange={e => { setYm(e.target.value); setDrafts({}); }} className="bg-transparent outline-none font-bold" />
          </label>
          {isAdmin && (
            <button type="button" onClick={() => setTab(tab === 'tanim' ? 'list' : 'tanim')} className="px-3 py-2 rounded-xl border text-xs font-bold">
              {tab === 'tanim' ? 'Listeye dön' : 'Plaka ve depolar'}
            </button>
          )}
        </div>
      </div>

      {tab === 'tanim' && isAdmin && (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-slate-50 border space-y-2">
            <div className="text-xs font-bold text-slate-700">Depolar</div>
            <div className="space-y-2">
              {catalog.map(d => (
                <div key={d.id} className="flex flex-wrap gap-2 items-center">
                  <input
                    value={depotEdits[d.id] ?? d.label}
                    onChange={e => setDepotEdits(prev => ({ ...prev, [d.id]: e.target.value }))}
                    className="flex-1 min-w-[160px] px-2 py-1.5 border rounded-lg text-sm font-semibold"
                  />
                  <span className="text-[10px] text-slate-400">{isFiloSharedDepot(d) ? 'Ortak tablo' : 'Depo'}</span>
                  <button type="button" disabled={busy} onClick={() => void renameDepot(d)} className="px-2 py-1.5 rounded-lg border text-[11px] font-bold">
                    İsmi kaydet
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-end pt-1">
              <label className="text-xs font-semibold flex-1 min-w-[180px]">Yeni depo adı
                <input value={depotName} onChange={e => setDepotName(e.target.value)} className="mt-1 w-full px-2 py-1.5 border rounded-lg text-sm" placeholder="Örn. Gebze Depo" />
              </label>
              <button type="button" disabled={busy} onClick={() => void addDepot()} className="px-3 py-2 rounded-xl bg-white border text-xs font-bold">
                Depo ekle
              </button>
            </div>
            <p className="text-[11px] text-slate-500">İsim değişince menü ve saha ataması güncellenir. Ortak tablo her Filo sahasına açık kalır.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end p-3 rounded-xl bg-slate-50 border">
            <label className="text-xs font-semibold">Plaka
              <input value={plateForm.plate} onChange={e => setPlateForm({ ...plateForm, plate: e.target.value })} className="mt-1 w-full px-2 py-1.5 border rounded-lg uppercase font-mono text-sm" />
            </label>
            <label className="text-xs font-semibold">Şoför
              <input value={plateForm.driver} onChange={e => setPlateForm({ ...plateForm, driver: e.target.value })} className="mt-1 w-full px-2 py-1.5 border rounded-lg text-sm" />
            </label>
            <label className="text-xs font-semibold">Alt yüklenici
              <input value={plateForm.contractor_name} onChange={e => setPlateForm({ ...plateForm, contractor_name: e.target.value })} className="mt-1 w-full px-2 py-1.5 border rounded-lg text-sm" />
            </label>
            <label className="text-xs font-semibold">Depo
              <select value={plateForm.depot} onChange={e => setPlateForm({ ...plateForm, depot: e.target.value })} className="mt-1 w-full px-2 py-1.5 border rounded-lg text-sm bg-white">
                {catalog.map(d => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => void savePlate()} className="flex-1 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold">
                {editingPlateId ? 'Değişikliği kaydet' : 'Plaka ekle'}
              </button>
              {editingPlateId && (
                <button type="button" disabled={busy} onClick={resetPlateForm} className="px-3 py-2 rounded-xl border text-xs font-bold">
                  <X className="w-3.5 h-3.5 inline" /> İptal
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold">
                <tr>
                  <th className="py-2 px-3">Plaka</th>
                  <th className="py-2 px-3">Şoför</th>
                  <th className="py-2 px-3">Yüklenici</th>
                  <th className="py-2 px-3">Depo</th>
                  <th className="py-2 px-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {allPlatesAdmin.map((p: any) => (
                  <tr key={p.id} className={p.depot ? '' : 'bg-amber-50'}>
                    <td className="py-2 px-3 font-mono font-bold">{p.plate}</td>
                    <td className="py-2 px-3">{p.driver || '—'}</td>
                    <td className="py-2 px-3">{p.contractor_name}</td>
                    <td className="py-2 px-3">{p.depot ? labelOf(p.depot) : 'Atanmadı'}</td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button type="button" className="px-2 py-1 text-blue-700 font-bold" onClick={() => {
                        setEditingPlateId(p.id);
                        setPlateForm({ plate: p.plate, driver: p.driver || '', contractor_name: p.contractor_name || '', depot: p.depot || depot });
                      }}><Edit2 className="w-3.5 h-3.5 inline mr-1" />Değiştir</button>
                      <button type="button" disabled={busy} className="px-2 py-1 text-rose-700 font-bold" onClick={() => void deletePlate(p)}>
                        <Trash2 className="w-3.5 h-3.5 inline mr-1" />Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-slate-500 mt-2">Sarı satır: depo yok. Plakayı Araç Filosu’ndan tanımlayıp depoya atayın.</p>
          </div>
        </div>
      )}

      {tab === 'list' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
            {depotOrder.map(id => {
              const t = monthDepotTotals.map[id] || { fuel: 0, total: 0 };
              const on = id === depot;
              return (
                <div
                  key={id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectDepot?.(id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelectDepot?.(id); }}
                  className={`border rounded-xl p-3 text-left ${onSelectDepot ? 'cursor-pointer' : ''} ${on ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'}`}
                >
                  <span className="text-slate-500 font-semibold block">{labelOf(id)}{on ? ' · bu depo' : ''}</span>
                  <div className="mt-1 text-slate-500">Yakıt <span className="font-black text-slate-900">{money(t.fuel)} ₺</span></div>
                  <div className="text-slate-500">Toplam <span className="font-black text-slate-900">{money(t.total)} ₺</span></div>
                </div>
              );
            })}
            <div className="border rounded-xl p-3 bg-slate-900 text-white col-span-2 sm:col-span-1">
              <span className="text-slate-300 font-semibold block">Genel toplam</span>
              <div className="mt-1 text-slate-300">Yakıt <span className="font-black text-white">{money(monthDepotTotals.grand.fuel)} ₺</span></div>
              <div className="text-slate-300">Toplam <span className="font-black text-white">{money(monthDepotTotals.grand.total)} ₺</span></div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold">
                <tr>
                  <th className="py-2 px-3">Plaka</th>
                  <th className="py-2 px-3">Şoför</th>
                  <th className="py-2 px-3">Alt yüklenici</th>
                  <th className="py-2 px-3 text-right">Yakıt</th>
                  <th className="py-2 px-3 text-right">Toplam</th>
                  <th className="py-2 px-3 text-right">Gnl. toplam</th>
                  {canWriteMonth && <th className="py-2 px-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groups.map(g => g.items.map((it, idx) => {
                  const key = String(it.plate.plate || '').toUpperCase().replace(/\s+/g, '');
                  return (
                    <tr key={it.plate.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-bold whitespace-nowrap">{it.plate.plate}</td>
                      <td className="py-2 px-3">{it.plate.driver || '—'}</td>
                      <td className="py-2 px-3 font-semibold">
                        {it.plate.contractor_name}
                        {isAlkanContractor(it.plate.contractor_name) ? (
                          <span className="ml-1 text-[10px] font-bold text-emerald-700">kârlılık</span>
                        ) : null}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {canWriteMonth ? (
                          <input
                            value={valFor(key, 'fuel', it.row)}
                            onChange={e => setDrafts(prev => ({ ...prev, [key]: { fuel: e.target.value, total: prev[key]?.total ?? valFor(key, 'total', it.row) } }))}
                            className="w-28 ml-auto block px-2 py-1 border rounded text-right font-bold"
                            inputMode="decimal"
                          />
                        ) : (cleanNumber(it.row?.fuel_amount) ? `${money(cleanNumber(it.row?.fuel_amount))} ₺` : '—')}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {canWriteMonth ? (
                          <input
                            value={valFor(key, 'total', it.row)}
                            onChange={e => setDrafts(prev => ({ ...prev, [key]: { total: e.target.value, fuel: prev[key]?.fuel ?? valFor(key, 'fuel', it.row) } }))}
                            className="w-28 ml-auto block px-2 py-1 border rounded text-right font-bold"
                            inputMode="decimal"
                          />
                        ) : (cleanNumber(it.row?.total_amount) ? `${money(cleanNumber(it.row?.total_amount))} ₺` : '—')}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-500">{idx === 0 ? `${money(g.total)} ₺` : ''}</td>
                      {canWriteMonth && (
                        <td className="py-2 px-3 text-right">
                          <button type="button" disabled={busy} onClick={() => void saveLine(it.plate)} className="px-2 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-bold">Kaydet</button>
                        </td>
                      )}
                    </tr>
                  );
                }))}
                {!listed.length && (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400">
                    {isFiloSharedDepot(depot) ? 'Ortak plaka yok. Yönetici tanımlardan Ortak atar.' : 'Bu depoda plaka yok. Yönetici Liste plakalarını depoya atar.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
