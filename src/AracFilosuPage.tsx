import React, { useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, X, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from './supabase';
import { COMPANY_IDENTITY } from './companyIdentity';
import {
  ARAC_COOLING,
  ARAC_VEHICLE_TYPES,
  aracVehicleCode,
  coolingLabel,
  defaultMutabakatForPrefix,
  plateKeyArac
} from './aracFilo';
import { filoDepotLabel, isFiloSharedDepot, mergeFiloDepots, type FiloDepot } from './tripFilo';
import { RENTAL_WORK_GROUPS } from './rentalMath';

type Props = {
  vehicles: any[];
  assignments: any[];
  jobs: any[];
  places: any[];
  subcontractors: any[];
  filoDepots: FiloDepot[];
  isAdmin: boolean;
  canEdit: boolean;
  onReload: () => Promise<void> | void;
};

const emptyForm = {
  plate: '',
  job_code: 'OM',
  place_code: 'FL',
  contractor_name: '',
  driver_name: '',
  driver_phone: '',
  assistant_name: '',
  assistant_phone: '',
  emergency_phone: '',
  tracker_id: '',
  tracker_gsm: '',
  camera_id: '',
  camera_gsm: '',
  vehicle_type: 'OrtaKamyon',
  cooling: 'plus4',
  notes: '',
  filoGroups: [] as string[],
  kiralikGroups: [] as string[]
};

type SortKey = 'code' | 'plate' | 'type' | 'cooling' | 'contractor' | 'driver' | 'groups';

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AracFilosuPage({
  vehicles,
  assignments,
  jobs,
  places,
  subcontractors,
  filoDepots,
  isAdmin,
  canEdit,
  onReload
}: Props) {
  const catalog = mergeFiloDepots(filoDepots);
  const jobList = jobs?.length ? [...jobs].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) : [];
  const placeList = places?.length ? [...places].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) : [];
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [filterJob, setFilterJob] = useState('');
  const [filterPlace, setFilterPlace] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCool, setFilterCool] = useState('');
  const [newJob, setNewJob] = useState({ code: '', label: '' });
  const [newPlace, setNewPlace] = useState({ code: '', label: '' });
  const [sortKey, setSortKey] = useState<SortKey>('plate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [col, setCol] = useState({
    code: '',
    plate: '',
    type: '',
    cooling: '',
    contractor: '',
    driver: '',
    groups: ''
  });
  const [pdfBusy, setPdfBusy] = useState(false);

  const asgByVehicle = useMemo(() => {
    const m = new Map<string, any[]>();
    (assignments || []).forEach((a: any) => {
      const arr = m.get(a.vehicle_id) || [];
      arr.push(a);
      m.set(a.vehicle_id, arr);
    });
    return m;
  }, [assignments]);

  const labelFilo = (id: string) => filoDepotLabel(id, catalog);
  const labelKiralik = (id: string) => RENTAL_WORK_GROUPS.find(g => g.id === id)?.label || id;

  const groupsOf = (id: string) => {
    const asg = asgByVehicle.get(id) || [];
    const filo = asg.filter(a => a.kind === 'filo').map(a => a.group_id);
    const kiralik = asg.filter(a => a.kind === 'kiralik').map(a => a.group_id);
    return { filo, kiralik, asg };
  };

  const groupText = (id: string) => {
    const g = groupsOf(id);
    const tags = [...g.filo.map(labelFilo), ...g.kiralik.map(labelKiralik)];
    return tags.join(' · ') || 'Atanmadı';
  };

  const rowFields = (v: any) => ({
    code: v.vehicle_code || '',
    plate: v.plate || '',
    type: v.vehicle_type || '',
    cooling: coolingLabel(v.cooling),
    contractor: v.contractor_name || '',
    driver: v.driver_name || '',
    groups: groupText(v.id)
  });

  const listed = useMemo(() => {
    const term = q.trim().toLocaleUpperCase('tr-TR');
    const hit = (s: string, f: string) => !f || String(s || '').toLocaleUpperCase('tr-TR').includes(f.trim().toLocaleUpperCase('tr-TR'));
    const rows = [...(vehicles || [])].filter((v: any) => {
      if (filterJob && v.job_code !== filterJob) return false;
      if (filterPlace && v.place_code !== filterPlace) return false;
      if (filterType && v.vehicle_type !== filterType) return false;
      if (filterCool && v.cooling !== filterCool) return false;
      const f = rowFields(v);
      if (!hit(f.code, col.code)) return false;
      if (!hit(f.plate, col.plate)) return false;
      if (col.type && f.type !== col.type) return false;
      if (col.cooling && v.cooling !== col.cooling) return false;
      if (!hit(f.contractor, col.contractor)) return false;
      if (!hit(f.driver, col.driver)) return false;
      if (!hit(f.groups, col.groups)) return false;
      if (!term) return true;
      const blob = `${f.code} ${f.plate} ${f.contractor} ${f.driver} ${f.groups}`.toLocaleUpperCase('tr-TR');
      return blob.includes(term);
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const fa = rowFields(a);
      const fb = rowFields(b);
      return String(fa[sortKey] || '').localeCompare(String(fb[sortKey] || ''), 'tr', { numeric: true }) * dir;
    });
    return rows;
  }, [vehicles, q, filterJob, filterPlace, filterType, filterCool, col, sortKey, sortDir, asgByVehicle, catalog]);

  const clickSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortMark = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  const dumpRows = listed.map((v: any) => {
    const g = groupsOf(v.id);
    return {
      Kod: v.vehicle_code || '',
      Plaka: v.plate,
      Tip: v.vehicle_type,
      Soğutma: coolingLabel(v.cooling),
      Ruhsat: v.contractor_name || '',
      'Şoför Adı': v.driver_name || '',
      'Şoför Tel No': v.driver_phone || '',
      'Muavin Adı': v.assistant_name || '',
      'Muavin Tel No': v.assistant_phone || '',
      'Şoför Yakını Tel No': v.emergency_phone || '',
      'Araç Takip ID': v.tracker_id || '',
      'Araç Takip GSM': v.tracker_gsm || '',
      'Kamera ID': v.camera_id || '',
      'Kamera GSM': v.camera_gsm || '',
      Mutabakat: groupText(v.id),
      Filo: g.filo.map(labelFilo).join(', '),
      Kiralık: g.kiralik.map(labelKiralik).join(', ')
    };
  });

  const exportExcel = () => {
    if (!dumpRows.length) {
      alert('İndirilecek satır yok.');
      return;
    }
    const headers = Object.keys(dumpRows[0]);
    const aoa = [['Tazeyol ERP — Araç Filosu'], [`${dumpRows.length} araç · görünen liste`], [], headers, ...dumpRows.map(r => headers.map(h => (r as any)[h]))];
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Arac filosu');
    XLSX.writeFile(workbook, 'Arac_Filosu.xlsx');
  };

  const exportPdf = async () => {
    if (!dumpRows.length) {
      alert('İndirilecek satır yok.');
      return;
    }
    setPdfBusy(true);
    try {
      const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const html = `<div style="width:1400px;padding:24px;background:#fff;font-family:Arial,sans-serif;color:#0f172a">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:12px">
          <div>
            <div style="font-size:11px;letter-spacing:.12em;font-weight:800;color:#009fe3">TAZEYOL ERP</div>
            <div style="font-size:22px;font-weight:900">Araç Filosu</div>
            <div style="font-size:11px;color:#64748b">${dumpRows.length} araç · ${esc(COMPANY_IDENTITY.shortName)}</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:10px">
          <thead>
            <tr>
              ${['Kod','Plaka','Tip','Soğutma','Ruhsat','Şoför Adı','Mutabakat'].map(h => `<th style="text-align:left;padding:6px 5px;border-bottom:1px solid #cbd5e1;background:#f8fafc">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${dumpRows.map(r => `<tr>
              <td style="padding:5px;border-bottom:1px solid #e2e8f0;font-family:Consolas,monospace;font-weight:800">${esc(r.Kod)}</td>
              <td style="padding:5px;border-bottom:1px solid #e2e8f0;font-family:Consolas,monospace;font-weight:800">${esc(r.Plaka)}</td>
              <td style="padding:5px;border-bottom:1px solid #e2e8f0">${esc(r.Tip)}</td>
              <td style="padding:5px;border-bottom:1px solid #e2e8f0">${esc(r.Soğutma)}</td>
              <td style="padding:5px;border-bottom:1px solid #e2e8f0">${esc(r.Ruhsat)}</td>
              <td style="padding:5px;border-bottom:1px solid #e2e8f0">${esc(r['Şoför Adı'])}</td>
              <td style="padding:5px;border-bottom:1px solid #e2e8f0">${esc(r.Mutabakat)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
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
      downloadBlob(doc.output('blob'), 'Arac_Filosu.pdf');
    } catch (err: any) {
      alert('PDF hazırlanamadı: ' + (err.message || ''));
    } finally {
      setPdfBusy(false);
    }
  };

  const applyPrefixDefaults = (job: string, place: string, current: typeof emptyForm) => {
    const next = { ...current, job_code: job, place_code: place };
    const defs = defaultMutabakatForPrefix(job, place);
    if (!defs.length) return next;
    return {
      ...next,
      filoGroups: [...new Set([...current.filoGroups, ...defs.filter(d => d.kind === 'filo').map(d => d.groupId)])],
      kiralikGroups: [...new Set([...current.kiralikGroups, ...defs.filter(d => d.kind === 'kiralik').map(d => d.groupId)])]
    };
  };

  const openNew = () => {
    if (!isAdmin) return;
    setEditingId(null);
    setForm(applyPrefixDefaults('OM', 'FL', { ...emptyForm }));
    setOpen(true);
  };

  const openEdit = (v: any) => {
    const g = groupsOf(v.id);
    setEditingId(v.id);
    setForm({
      plate: v.plate || '',
      job_code: v.job_code || 'OM',
      place_code: v.place_code || 'FL',
      contractor_name: v.contractor_name || '',
      driver_name: v.driver_name || '',
      driver_phone: v.driver_phone || '',
      assistant_name: v.assistant_name || '',
      assistant_phone: v.assistant_phone || '',
      emergency_phone: v.emergency_phone || '',
      tracker_id: v.tracker_id || '',
      tracker_gsm: v.tracker_gsm || '',
      camera_id: v.camera_id || '',
      camera_gsm: v.camera_gsm || '',
      vehicle_type: v.vehicle_type || 'OrtaKamyon',
      cooling: v.cooling || 'plus4',
      notes: v.notes || '',
      filoGroups: g.filo,
      kiralikGroups: g.kiralik
    });
    setOpen(true);
  };

  const nextSeq = (job: string, place: string, exceptId?: string | null) => {
    const same = (vehicles || []).filter((v: any) => v.job_code === job && v.place_code === place && v.id !== exceptId);
    const max = same.reduce((m: number, v: any) => Math.max(m, Number(v.seq) || 0), 0);
    return max + 1;
  };

  const syncFiloPlates = async (plate: string, driver: string | null, contractor: string, filoGroups: string[]) => {
    const key = plateKeyArac(plate);
    const { data: existing, error: readErr } = await supabase.from('trip_fleet_plates').select('id, plate, depot');
    if (readErr) return readErr.message;
    const mine = (existing || []).filter((p: any) => plateKeyArac(p.plate) === key);
    const want = new Set(filoGroups);
    for (const row of mine) {
      if (!want.has(row.depot)) {
        const { error } = await supabase.from('trip_fleet_plates').delete().eq('id', row.id);
        if (error) return error.message;
      }
    }
    for (const depot of filoGroups) {
      const hit = mine.find((p: any) => p.depot === depot);
      const payload = { plate: key, driver, contractor_name: contractor, depot, is_active: true };
      const q = hit
        ? supabase.from('trip_fleet_plates').update(payload).eq('id', hit.id)
        : supabase.from('trip_fleet_plates').insert([payload]);
      const { error } = await q;
      if (error) return error.message;
    }
    return null;
  };

  const save = async () => {
    if (!canEdit) return;
    if (!editingId && !isAdmin) return;
    const plate = plateKeyArac(form.plate);
    const contractor_name = form.contractor_name.trim();
    if (!plate || !contractor_name || !form.job_code || !form.place_code || !form.vehicle_type || !form.cooling) {
      alert('Plaka, ruhsat sahibi, iş/yer kodu, tip ve soğutma zorunlu.');
      return;
    }
    const keepSeq = editingId
      ? (vehicles || []).find((v: any) => v.id === editingId)
      : null;
    const samePrefix = keepSeq && keepSeq.job_code === form.job_code && keepSeq.place_code === form.place_code;
    const seq = samePrefix && keepSeq.seq ? Number(keepSeq.seq) : nextSeq(form.job_code, form.place_code, editingId);
    const vehicle_code = aracVehicleCode(form.job_code, form.place_code, seq);
    const payload: any = {
      plate,
      vehicle_code,
      job_code: form.job_code,
      place_code: form.place_code,
      seq,
      contractor_name,
      driver_name: form.driver_name.trim() || null,
      driver_phone: form.driver_phone.trim() || null,
      assistant_name: form.assistant_name.trim() || null,
      assistant_phone: form.assistant_phone.trim() || null,
      emergency_phone: form.emergency_phone.trim() || null,
      tracker_id: form.tracker_id.trim() || null,
      tracker_gsm: form.tracker_gsm.trim() || null,
      camera_id: form.camera_id.trim() || null,
      camera_gsm: form.camera_gsm.trim() || null,
      vehicle_type: form.vehicle_type,
      cooling: form.cooling,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString()
    };
    setBusy(true);
    let vehicleId = editingId;
    if (editingId) {
      const body = isAdmin
        ? payload
        : {
            contractor_name,
            driver_name: payload.driver_name,
            driver_phone: payload.driver_phone,
            assistant_name: payload.assistant_name,
            assistant_phone: payload.assistant_phone,
            emergency_phone: payload.emergency_phone,
            tracker_id: payload.tracker_id,
            tracker_gsm: payload.tracker_gsm,
            camera_id: payload.camera_id,
            camera_gsm: payload.camera_gsm,
            vehicle_type: payload.vehicle_type,
            cooling: payload.cooling,
            notes: payload.notes,
            updated_at: payload.updated_at
          };
      const { error } = await supabase.from('fleet_vehicles').update(body).eq('id', editingId);
      if (error) {
        setBusy(false);
        alert('Kayıt yazılamadı. setup_arac_filosu.sql çalıştırın.\n' + error.message);
        return;
      }
    } else {
      const { data, error } = await supabase.from('fleet_vehicles').insert([payload]).select('id').single();
      if (error || !data) {
        setBusy(false);
        alert('Kayıt yazılamadı. setup_arac_filosu.sql çalıştırın.\n' + (error?.message || ''));
        return;
      }
      vehicleId = data.id;
    }
    if (canEdit) {
      await supabase.from('fleet_vehicle_assignments').delete().eq('vehicle_id', vehicleId);
      const rows = [
        ...form.filoGroups.map(group_id => ({ vehicle_id: vehicleId, kind: 'filo', group_id })),
        ...form.kiralikGroups.map(group_id => ({ vehicle_id: vehicleId, kind: 'kiralik', group_id }))
      ];
      if (rows.length) {
        const { error: aErr } = await supabase.from('fleet_vehicle_assignments').insert(rows);
        if (aErr) {
          setBusy(false);
          alert('Gruplar yazılamadı: ' + aErr.message);
          return;
        }
      }
      const syncErr = await syncFiloPlates(plate, payload.driver_name, contractor_name, form.filoGroups);
      if (syncErr) {
        setBusy(false);
        alert('Künye kaydedildi ama Filo plakası yazılamadı. setup_arac_filosu.sql dosyasını Run edin.\n' + syncErr);
        await onReload();
        return;
      }
    }
    setBusy(false);
    setOpen(false);
    await onReload();
  };

  const remove = async (v: any) => {
    if (!isAdmin) return;
    if (!window.confirm(`${v.plate} künyeden silinsin mi? Filo plaka tanımı da kalkar. Aylık yakıt satırı durur.`)) return;
    setBusy(true);
    await syncFiloPlates(v.plate, null, '', []);
    const { error } = await supabase.from('fleet_vehicles').delete().eq('id', v.id);
    setBusy(false);
    if (error) {
      alert('Silinemedi: ' + error.message);
      return;
    }
    await onReload();
  };

  const addCode = async (kind: 'job' | 'place') => {
    if (!isAdmin) return;
    const src = kind === 'job' ? newJob : newPlace;
    const code = src.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    const label = src.label.trim();
    if (!code || !label) {
      alert('Harf ve ad zorunlu.');
      return;
    }
    const table = kind === 'job' ? 'fleet_code_jobs' : 'fleet_code_places';
    const { error } = await supabase.from(table).upsert([{ code, label, sort_order: 99 }]);
    if (error) {
      alert('Eklenemedi: ' + error.message);
      return;
    }
    if (kind === 'job') setNewJob({ code: '', label: '' });
    else setNewPlace({ code: '', label: '' });
    await onReload();
  };

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-lg text-slate-900">Araç Filosu</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Tüm plakalar burada tanımlanır. İşler Değiştir ile künyeyi ve Filo/kiralık grubunu günceller; grup seçmeden de kaydedebilir. Plaka ekleme/silme yalnız yönetici.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!listed.length} onClick={exportExcel} className="px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
          </button>
          <button type="button" disabled={!listed.length || pdfBusy} onClick={() => void exportPdf()} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
            <Download className="w-4 h-4" /> {pdfBusy ? 'PDF…' : 'PDF'}
          </button>
          {isAdmin && (
            <button type="button" onClick={openNew} className="px-3 py-2 rounded-xl bg-[#009fe3] text-white text-xs font-bold flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Plaka tanımla
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Plaka / kod / şoför" className="px-2 py-1.5 border rounded-lg min-w-[160px]" />
        <select value={filterJob} onChange={e => setFilterJob(e.target.value)} className="px-2 py-1.5 border rounded-lg bg-white">
          <option value="">İş</option>
          {jobList.map((j: any) => <option key={j.code} value={j.code}>{j.code} · {j.label}</option>)}
        </select>
        <select value={filterPlace} onChange={e => setFilterPlace(e.target.value)} className="px-2 py-1.5 border rounded-lg bg-white">
          <option value="">Yer</option>
          {placeList.map((p: any) => <option key={p.code} value={p.code}>{p.code} · {p.label}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-2 py-1.5 border rounded-lg bg-white">
          <option value="">Tip</option>
          {ARAC_VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterCool} onChange={e => setFilterCool(e.target.value)} className="px-2 py-1.5 border rounded-lg bg-white">
          <option value="">Soğutma</option>
          {ARAC_COOLING.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs p-3 rounded-xl bg-slate-50 border">
          <div className="flex flex-wrap gap-2 items-end">
            <label>İş harfi<input value={newJob.code} onChange={e => setNewJob({ ...newJob, code: e.target.value })} className="mt-1 w-20 px-2 py-1 border rounded uppercase" /></label>
            <label className="flex-1">Ad<input value={newJob.label} onChange={e => setNewJob({ ...newJob, label: e.target.value })} className="mt-1 w-full px-2 py-1 border rounded" /></label>
            <button type="button" disabled={busy} onClick={() => void addCode('job')} className="px-2 py-1.5 border rounded-lg font-bold">İş ekle</button>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <label>Yer harfi<input value={newPlace.code} onChange={e => setNewPlace({ ...newPlace, code: e.target.value })} className="mt-1 w-20 px-2 py-1 border rounded uppercase" /></label>
            <label className="flex-1">Ad<input value={newPlace.label} onChange={e => setNewPlace({ ...newPlace, label: e.target.value })} className="mt-1 w-full px-2 py-1 border rounded" /></label>
            <button type="button" disabled={busy} onClick={() => void addCode('place')} className="px-2 py-1.5 border rounded-lg font-bold">Yer ekle</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 font-bold">
            <tr>
              {([
                ['code', 'Kod'],
                ['plate', 'Plaka'],
                ['type', 'Tip'],
                ['cooling', 'Soğutma'],
                ['contractor', 'Ruhsat'],
                ['driver', 'Şoför Adı'],
                ['groups', 'Mutabakat']
              ] as [SortKey, string][]).map(([key, label]) => (
                <th key={key} className="py-2 px-3 align-top min-w-[110px]">
                  <button type="button" className="font-bold uppercase tracking-wide text-left" onClick={() => clickSort(key)}>
                    {label}{sortMark(key)}
                  </button>
                  {key === 'type' ? (
                    <select value={col.type} onChange={e => setCol({ ...col, type: e.target.value })} className="mt-1 w-full px-1 py-1 border rounded bg-white font-medium text-slate-700">
                      <option value="">Tümü</option>
                      {ARAC_VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : key === 'cooling' ? (
                    <select value={col.cooling} onChange={e => setCol({ ...col, cooling: e.target.value })} className="mt-1 w-full px-1 py-1 border rounded bg-white font-medium text-slate-700">
                      <option value="">Tümü</option>
                      {ARAC_COOLING.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  ) : (
                    <input
                      value={(col as any)[key]}
                      onChange={e => setCol({ ...col, [key]: e.target.value })}
                      placeholder="Filtre"
                      className="mt-1 w-full px-1 py-1 border rounded font-medium text-slate-700"
                    />
                  )}
                </th>
              ))}
              {canEdit && <th className="py-2 px-3" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {listed.map((v: any) => {
              const g = groupsOf(v.id);
              const tags = [
                ...g.filo.map(labelFilo),
                ...g.kiralik.map(labelKiralik)
              ];
              return (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-mono font-bold">{v.vehicle_code || '—'}</td>
                  <td className="py-2 px-3 font-mono font-bold">{v.plate}</td>
                  <td className="py-2 px-3">{v.vehicle_type}</td>
                  <td className="py-2 px-3">{coolingLabel(v.cooling)}</td>
                  <td className="py-2 px-3">{v.contractor_name || '—'}</td>
                  <td className="py-2 px-3">{v.driver_name || '—'}</td>
                  <td className="py-2 px-3 text-[11px]">{tags.join(' · ') || 'Atanmadı'}</td>
                  {canEdit && (
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button type="button" className="px-2 py-1 text-blue-700 font-bold" onClick={() => openEdit(v)}>
                        <Edit2 className="w-3.5 h-3.5 inline mr-1" />Değiştir
                      </button>
                      {isAdmin && (
                        <button type="button" disabled={busy} className="px-2 py-1 text-rose-700 font-bold" onClick={() => void remove(v)}>
                          <Trash2 className="w-3.5 h-3.5 inline mr-1" />Sil
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {!listed.length && (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">Kayıt yok. setup_arac_filosu.sql çalıştırın veya plaka tanımlayın.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl border shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-bold">{editingId ? 'Plaka künyesi' : 'Yeni plaka'}</h4>
              <button type="button" onClick={() => setOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <label className="font-semibold">İş
                <select disabled={!isAdmin} value={form.job_code} onChange={e => setForm(applyPrefixDefaults(e.target.value, form.place_code, form))} className="mt-1 w-full px-2 py-1.5 border rounded-lg bg-white disabled:bg-slate-50">
                  {jobList.map((j: any) => <option key={j.code} value={j.code}>{j.code} · {j.label}</option>)}
                </select>
              </label>
              <label className="font-semibold">Yer
                <select disabled={!isAdmin} value={form.place_code} onChange={e => setForm(applyPrefixDefaults(form.job_code, e.target.value, form))} className="mt-1 w-full px-2 py-1.5 border rounded-lg bg-white disabled:bg-slate-50">
                  {placeList.map((p: any) => <option key={p.code} value={p.code}>{p.code} · {p.label}</option>)}
                </select>
              </label>
              <div className="font-semibold">Kod
                <div className="mt-1 px-2 py-1.5 border rounded-lg font-mono font-bold bg-slate-50">
                  {aracVehicleCode(form.job_code, form.place_code, editingId && (vehicles.find((v: any) => v.id === editingId)?.job_code === form.job_code && vehicles.find((v: any) => v.id === editingId)?.place_code === form.place_code) ? (Number(vehicles.find((v: any) => v.id === editingId)?.seq) || nextSeq(form.job_code, form.place_code, editingId)) : nextSeq(form.job_code, form.place_code, editingId))}
                </div>
              </div>
              <label className="font-semibold">Plaka
                <input disabled={!isAdmin} value={form.plate} onChange={e => setForm({ ...form, plate: e.target.value })} className="mt-1 w-full px-2 py-1.5 border rounded-lg uppercase font-mono disabled:bg-slate-50" />
              </label>
              <label className="font-semibold sm:col-span-2">Ruhsat sahibi (alt yüklenici)
                <input list="arac-ruhsat" value={form.contractor_name} onChange={e => setForm({ ...form, contractor_name: e.target.value })} className="mt-1 w-full px-2 py-1.5 border rounded-lg" />
                <datalist id="arac-ruhsat">
                  {(subcontractors || []).map((s: any) => <option key={s.id || s.name} value={s.name} />)}
                </datalist>
              </label>
              <label className="font-semibold">Tip
                <select value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })} className="mt-1 w-full px-2 py-1.5 border rounded-lg bg-white">
                  {ARAC_VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="font-semibold">Soğutma
                <select value={form.cooling} onChange={e => setForm({ ...form, cooling: e.target.value })} className="mt-1 w-full px-2 py-1.5 border rounded-lg bg-white">
                  {ARAC_COOLING.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </label>
              <label className="font-semibold">Şoför Adı
                <input value={form.driver_name} onChange={e => setForm({ ...form, driver_name: e.target.value })} className="mt-1 w-full px-2 py-1.5 border rounded-lg" />
              </label>
              <label className="font-semibold">Şoför Tel No
                <input value={form.driver_phone} onChange={e => setForm({ ...form, driver_phone: e.target.value })} className="mt-1 w-full px-2 py-1.5 border rounded-lg" />
              </label>
              <label className="font-semibold">Muavin Adı
                <input value={form.assistant_name} onChange={e => setForm({ ...form, assistant_name: e.target.value })} className="mt-1 w-full px-2 py-1.5 border rounded-lg" />
              </label>
              <label className="font-semibold">Muavin Tel No
                <input value={form.assistant_phone} onChange={e => setForm({ ...form, assistant_phone: e.target.value })} className="mt-1 w-full px-2 py-1.5 border rounded-lg" />
              </label>
              <label className="font-semibold">Şoför Yakını Tel No
                <input value={form.emergency_phone} onChange={e => setForm({ ...form, emergency_phone: e.target.value })} className="mt-1 w-full px-2 py-1.5 border rounded-lg" />
              </label>
              <label className="font-semibold">Araç Takip ID
                <input value={form.tracker_id} onChange={e => setForm({ ...form, tracker_id: e.target.value })} className="mt-1 w-full px-2 py-1.5 border rounded-lg" />
              </label>
              <label className="font-semibold">Araç Takip GSM
                <input value={form.tracker_gsm} onChange={e => setForm({ ...form, tracker_gsm: e.target.value })} className="mt-1 w-full px-2 py-1.5 border rounded-lg" />
              </label>
              <label className="font-semibold">Kamera ID
                <input value={form.camera_id} onChange={e => setForm({ ...form, camera_id: e.target.value })} className="mt-1 w-full px-2 py-1.5 border rounded-lg" />
              </label>
              <label className="font-semibold">Kamera GSM
                <input value={form.camera_gsm} onChange={e => setForm({ ...form, camera_gsm: e.target.value })} className="mt-1 w-full px-2 py-1.5 border rounded-lg" />
              </label>
              <label className="font-semibold sm:col-span-3">Not
                <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full px-2 py-1.5 border rounded-lg" />
              </label>
            </div>
            <div className="text-xs space-y-2">
              <div className="font-bold text-slate-600">Filo mutabakatı (isteğe bağlı)</div>
              <div className="flex flex-wrap gap-2">
                {catalog.filter(d => !isFiloSharedDepot(d) && d.id !== 'gross').map(d => (
                  <label key={d.id} className={`px-2 py-1 rounded-lg border font-semibold ${canEdit ? 'cursor-pointer' : 'cursor-default opacity-80'} ${form.filoGroups.includes(d.id) ? 'bg-[#009fe3] text-white border-[#009fe3]' : 'bg-white'}`}>
                    <input type="checkbox" className="hidden" disabled={!canEdit} checked={form.filoGroups.includes(d.id)} onChange={() => canEdit && setForm({ ...form, filoGroups: toggle(form.filoGroups, d.id) })} />
                    {d.label}
                  </label>
                ))}
              </div>
              <div className="font-bold text-slate-600 pt-1">Kiralık mutabakatı (isteğe bağlı)</div>
              <div className="flex flex-wrap gap-2">
                {RENTAL_WORK_GROUPS.map(g => (
                  <label key={g.id} className={`px-2 py-1 rounded-lg border font-semibold ${canEdit ? 'cursor-pointer' : 'cursor-default opacity-80'} ${form.kiralikGroups.includes(g.id) ? 'bg-[#009fe3] text-white border-[#009fe3]' : 'bg-white'}`}>
                    <input type="checkbox" className="hidden" disabled={!canEdit} checked={form.kiralikGroups.includes(g.id)} onChange={() => canEdit && setForm({ ...form, kiralikGroups: toggle(form.kiralikGroups, g.id) })} />
                    {g.label}
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">Hiç işaretlemeden Kaydet olur. İşaretlenen grup Filo veya kiralık listesine düşer.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 rounded-xl border text-xs font-bold">Vazgeç</button>
              <button type="button" disabled={busy} onClick={() => void save()} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold">Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
