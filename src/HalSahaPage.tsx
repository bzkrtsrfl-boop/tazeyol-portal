import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { supabase } from './supabase';
import { formatMoneyAmountTR } from './money';
import PortalInput from './PortalInput';
import { buildHalCari, cmpHalMove, halHandoverBookDate, isHalCariOnly, isHalFirmActive, isHalKasaOnly, isHalMerkezTahsil, personelKasaFrom, seferTotal, type HalMoveSortField } from './halSaha';

function daysAgo(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - d.getTime()) / 86400000);
}

function asUuidOrNull(id: any) {
  const s = String(id || '');
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s) ? s : null;
}

type HalSahaPageProps = {
  firms: any[];
  entries: any[];
  handovers: any[];
  plates?: any[];
  canEdit: boolean;
  canTakeToCash: boolean;
  formatDateTR: (d: any) => string;
  cleanNumber: (v: any) => number;
  onReload: () => Promise<void> | void;
};

function HalSahaPage({
  firms,
  entries,
  handovers,
  plates = [],
  canEdit,
  canTakeToCash,
  formatDateTR,
  cleanNumber,
  onReload
}: HalSahaPageProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState<'form' | 'list' | 'cari' | 'kasa' | 'tanim'>(canEdit ? 'form' : 'list');
  const [ym, setYm] = useState(today.slice(0, 7));
  const [firmFilter, setFirmFilter] = useState('');
  const [kind, setKind] = useState<'sefer' | 'tahsilat'>('sefer');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: today,
    firm: '',
    plate: '',
    notes: '',
    bedel: '',
    vat: false,
    collected: ''
  });
  const [newFirm, setNewFirm] = useState({ name: '', shop: '' });
  const [newPlate, setNewPlate] = useState({ plate: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [handoverAmt, setHandoverAmt] = useState('');
  const [listSort, setListSort] = useState<{ field: HalMoveSortField; dir: 'asc' | 'desc' }>({ field: 'date', dir: 'desc' });
  const [kasaSort, setKasaSort] = useState<{ field: 'date' | 'kind' | 'who' | 'note' | 'inAmt' | 'outAmt'; dir: 'asc' | 'desc' }>({ field: 'date', dir: 'desc' });
  const toggleSort = <F extends string>(
    cur: { field: F; dir: 'asc' | 'desc' },
    field: F
  ) => (cur.field === field ? { field, dir: (cur.dir === 'asc' ? 'desc' : 'asc') as 'asc' | 'desc' } : { field, dir: (field === 'date' ? 'desc' : 'asc') as 'asc' | 'desc' });
  const sortMark = (cur: { field: string; dir: string }, field: string) =>
    cur.field !== field ? ' ↕' : cur.dir === 'asc' ? ' ↑' : ' ↓';
  const thSort = 'py-2 px-3 cursor-pointer select-none hover:text-blue-600';
  const definedPlates = [...(plates || [])]
    .filter((p: any) => p.is_active !== false)
    .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0) || String(a.plate).localeCompare(String(b.plate), 'tr'));

  const money = (n: number) => formatMoneyAmountTR(n);
  const activeFirms = (firms || []).filter((f: any) => isHalFirmActive(f));
  const listedFirms = [...(firms || [])].sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || ''), 'tr'));
  const inMonth = (d: string) => String(d || '').slice(0, 7) === ym;

  const monthEntries = useMemo(
    () => (entries || []).filter((e: any) => inMonth(e.entry_date)),
    [entries, ym]
  );

  const listed = useMemo(() => {
    const rows = (firmFilter
      ? monthEntries.filter((e: any) => e.firm_name === firmFilter)
      : monthEntries
    ).filter((e: any) => !isHalKasaOnly(e));
    return [...rows].sort((a, b) => {
      let cmp = cmpHalMove(a, b, listSort.field, cleanNumber);
      if (cmp === 0) cmp = String(a.id || '').localeCompare(String(b.id || ''));
      return listSort.dir === 'asc' ? cmp : -cmp;
    });
  }, [monthEntries, firmFilter, listSort, cleanNumber]);

  const kasaDefter = useMemo(() => {
    const nakit = (entries || [])
      .filter((e: any) => !isHalCariOnly(e) && cleanNumber(e.collected) > 0)
      .map((e: any) => ({
        id: e.id,
        date: String(e.entry_date).slice(0, 10),
        kind: 'nakit' as const,
        who: e.firm_name,
        note: String(e.notes || '').replace(/\s*\[(DRIVE-GIRIS|KASA-TAHSIL|AKTARIM-KASA|AKTARIM-CARI)\]/g, '').trim(),
        inAmt: cleanNumber(e.collected),
        outAmt: 0
      }));
    const cikis = (handovers || []).map((h: any) => ({
      id: h.id,
      invoice_id: h.invoice_id,
      date: halHandoverBookDate(h),
      kind: 'teslim' as const,
      who: '',
      note: h.note || 'Merkeze teslim',
      inAmt: 0,
      outAmt: cleanNumber(h.amount)
    }));
    const rows = [...nakit, ...cikis];
    return rows.sort((a, b) => {
      let cmp = 0;
      if (kasaSort.field === 'kind') cmp = (a.kind === 'teslim' ? 'Merkeze teslim' : 'Nakit').localeCompare(b.kind === 'teslim' ? 'Merkeze teslim' : 'Nakit', 'tr');
      else if (kasaSort.field === 'who') cmp = String(a.who || '').localeCompare(String(b.who || ''), 'tr');
      else if (kasaSort.field === 'note') cmp = String(a.note || '').localeCompare(String(b.note || ''), 'tr', { sensitivity: 'base' });
      else if (kasaSort.field === 'inAmt') cmp = a.inAmt - b.inAmt;
      else if (kasaSort.field === 'outAmt') cmp = a.outAmt - b.outAmt;
      else cmp = String(a.date || '').localeCompare(String(b.date || ''));
      if (cmp === 0) cmp = String(a.id || '').localeCompare(String(b.id || ''));
      return kasaSort.dir === 'asc' ? cmp : -cmp;
    });
  }, [entries, handovers, cleanNumber, kasaSort]);

  const cari = useMemo(
    () => buildHalCari(firms, entries, `${ym}-01`, `${ym}-31`, cleanNumber),
    [firms, entries, ym, cleanNumber]
  );

  const genel = cari.reduce((a, r) => ({
    devir: a.devir + r.devir,
    sefer: a.sefer + r.sefer,
    kdv: a.kdv + r.kdv,
    tahsilat: a.tahsilat + r.tahsilat,
    kalan: a.kalan + r.kalan
  }), { devir: 0, sefer: 0, kdv: 0, tahsilat: 0, kalan: 0 });

  const personelKasa = personelKasaFrom(entries, handovers, cleanNumber);
  const aySefer = monthEntries.reduce((s: number, e: any) => s + (e.kind === 'sefer' ? seferTotal(cleanNumber(e.bedel), !!e.has_vat) : 0), 0);

  const locked = (row: any) => !canTakeToCash && daysAgo(String(row.entry_date).slice(0, 10)) > 2;

  const resetForm = () => {
    setEditingId(null);
    setKind('sefer');
    setForm({ date: today, firm: firmFilter || '', plate: '', notes: '', bedel: '', vat: false, collected: '' });
  };

  const saveFirm = async () => {
    const name = newFirm.name.trim();
    if (!name || !canTakeToCash) return;
    setBusy(true);
    const { error } = await supabase.from('hal_firms').insert([{ name, shop: newFirm.shop.trim(), sort_order: (firms || []).length }]);
    setBusy(false);
    if (error) {
      alert('Firma yazılamadı: ' + error.message);
      return;
    }
    setNewFirm({ name: '', shop: '' });
    await onReload();
  };

  const savePlateDef = async () => {
    const plate = newPlate.plate.trim();
    if (!plate || !canTakeToCash) return;
    setBusy(true);
    const { error } = await supabase.from('hal_plates').insert([{ plate, note: newPlate.note.trim(), sort_order: (plates || []).length }]);
    setBusy(false);
    if (error) {
      alert('Plaka yazılamadı: ' + (error.message.includes('hal_plates') ? 'setup_hal_saha.sql dosyasını tekrar çalıştırın.' : error.message));
      return;
    }
    setNewPlate({ plate: '', note: '' });
    await onReload();
  };

  const setFirmActive = async (id: string, is_active: boolean) => {
    if (!canTakeToCash) return;
    if (!is_active && !window.confirm('Firma pasif olsun mu? Bundan sonra yeni kayıt ve güncel tablolarda görünmez. Eski hareketler geçmiş dönemde durur.')) return;
    const todayCut = new Date().toISOString().slice(0, 10);
    const payload = is_active ? { is_active: true, inactive_at: null } : { is_active: false, inactive_at: todayCut };
    let { error } = await supabase.from('hal_firms').update(payload).eq('id', id);
    if (error && /inactive_at/i.test(error.message || '')) {
      ({ error } = await supabase.from('hal_firms').update({ is_active }).eq('id', id));
    }
    if (error) alert(error.message);
    else await onReload();
  };

  const setPlateActive = async (id: string, is_active: boolean) => {
    if (!canTakeToCash) return;
    const { error } = await supabase.from('hal_plates').update({ is_active }).eq('id', id);
    if (error) alert(error.message);
    else await onReload();
  };

  const saveFirmShop = async (id: string, shop: string) => {
    if (!canTakeToCash) return;
    const { error } = await supabase.from('hal_firms').update({ shop: shop.trim() }).eq('id', id);
    if (error) alert(error.message);
    else await onReload();
  };

  const importPlatesFromEntries = async () => {
    if (!canTakeToCash) return;
    const have = new Set((plates || []).map((p: any) => String(p.plate || '').trim().toLocaleLowerCase('tr-TR')));
    const uniq = [...new Set((entries || []).map((e: any) => String(e.plate || '').trim()).filter(Boolean))]
      .filter(p => !have.has(p.toLocaleLowerCase('tr-TR')));
    if (!uniq.length) {
      alert('Eklenecek yeni plaka yok.');
      return;
    }
    if (!window.confirm(`${uniq.length} plaka tanıma eklensin mi?`)) return;
    setBusy(true);
    const { error } = await supabase.from('hal_plates').insert(uniq.map((plate, i) => ({ plate, note: 'kayıtlardan', sort_order: (plates || []).length + i })));
    setBusy(false);
    if (error) alert('Plaka yazılamadı: ' + error.message);
    else await onReload();
  };

  const saveEntry = async () => {
    if (!canEdit) return;
    const firm = (form.firm || '').trim();
    if (!firm) {
      alert('Firma seçin. Tüm firmalar seçiliyken kayıt girilmez.');
      return;
    }
    if (!activeFirms.some((f: any) => f.name === firm)) {
      alert('Bu firma pasif. Yeni kayıt girilmez. Geçmiş hareketler rapor döneminde durur.');
      return;
    }
    const bedel = kind === 'sefer' ? cleanNumber(form.bedel) : 0;
    const collected = cleanNumber(form.collected);
    if (kind === 'sefer' && bedel <= 0 && collected <= 0) {
      alert('Sefer tutarı veya tahsilat yazın.');
      return;
    }
    if (kind === 'tahsilat' && collected <= 0) {
      alert('Tahsilat tutarı yazın.');
      return;
    }
    if (kind === 'sefer' && definedPlates.length && !(form.plate || '').trim()) {
      alert('Plaka seçin. Listeyi yönetici Tanımlar’dan doldurur.');
      return;
    }
    if (editingId) {
      const row = (entries || []).find((e: any) => String(e.id) === String(editingId));
      if (row && locked(row)) {
        alert('2 günü geçmiş kayıtlar saha hesabından değişmez. Yönetici Drive yerine buradan düzeltir.');
        return;
      }
    }
    const firmRow = activeFirms.find((f: any) => f.name === firm);
    const prev = editingId ? (entries || []).find((e: any) => String(e.id) === String(editingId)) : null;
    let notesOut = (form.notes || '').trim();
    const keepTags = ['[DRIVE-GIRIS]', '[KASA-TAHSIL]', '[AKTARIM-KASA]', '[AKTARIM-CARI]', '[MERKEZ-TAHSIL]'];
    for (const tag of keepTags) {
      if (prev && String(prev.notes || '').includes(tag) && !notesOut.includes(tag)) {
        notesOut = notesOut ? `${notesOut} ${tag}` : tag;
      }
    }
    const toMerkez = canTakeToCash && kind === 'tahsilat' && collected > 0 && (!prev || isHalMerkezTahsil(prev));
    if (toMerkez && !notesOut.includes('[MERKEZ-TAHSIL]')) {
      notesOut = notesOut ? `${notesOut} [MERKEZ-TAHSIL]` : '[MERKEZ-TAHSIL]';
    }
    const payload: any = {
      entry_date: form.date || today,
      kind,
      firm_id: firmRow?.id || null,
      firm_name: firm,
      plate: kind === 'sefer' ? (form.plate || '').trim() : '',
      notes: notesOut,
      bedel,
      has_vat: kind === 'sefer' ? !!form.vat : false,
      collected
    };
    setBusy(true);
    const { data: saved, error } = editingId
      ? await supabase.from('hal_entries').update(payload).eq('id', editingId).select('id, kasa_invoice_id').maybeSingle()
      : await supabase.from('hal_entries').insert([{ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id || null }]).select('id, kasa_invoice_id').maybeSingle();
    if (error) {
      setBusy(false);
      const noCol = /kasa_invoice_id/i.test(error.message || '');
      if (noCol) {
        const retry = editingId
          ? await supabase.from('hal_entries').update(payload).eq('id', editingId).select('id').maybeSingle()
          : await supabase.from('hal_entries').insert([{ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id || null }]).select('id').maybeSingle();
        if (retry.error) {
          alert('Kayıt yazılamadı. setup_hal_saha.sql dosyasını bir kez Run edin.\n' + retry.error.message);
          return;
        }
        if (toMerkez && retry.data?.id) {
          const kasaErr = await writeHalKasaInvoice(retry.data.id, collected, payload.entry_date, firm, null);
          if (kasaErr) alert('Cari yazıldı ama kasa satırı oluşmadı: ' + kasaErr);
        }
        setBusy(false);
        resetForm();
        setTab('list');
        await onReload();
        return;
      }
      alert('Kayıt yazılamadı. setup_hal_saha.sql dosyasını bir kez Run edin.\n' + error.message);
      return;
    }
    if (toMerkez && saved?.id) {
      const kasaErr = await writeHalKasaInvoice(saved.id, collected, payload.entry_date, firm, saved.kasa_invoice_id || null);
      if (kasaErr) alert('Cari yazıldı ama kasa satırı oluşmadı: ' + kasaErr);
    }
    setBusy(false);
    resetForm();
    setTab('list');
    await onReload();
  };

  const writeHalKasaInvoice = async (entryId: string, amount: number, date: string, firm: string, invoiceId: string | null) => {
    const no = `Hal tahsilat ${entryId}`;
    const row: any = {
      invoice_no: no,
      direction: 'incoming',
      category: 'cash_deposit',
      total_amount: amount,
      issue_date: date,
      due_date: date,
      status: 'paid'
    };
    let id = invoiceId;
    if (id) {
      const { error } = await supabase.from('invoices').update(row).eq('id', id);
      if (error) return error.message;
    } else {
      const found = await supabase.from('invoices').select('id').eq('invoice_no', no).maybeSingle();
      if (found.data?.id) {
        id = found.data.id;
        const { error } = await supabase.from('invoices').update(row).eq('id', id);
        if (error) return error.message;
      } else {
        const ins = await supabase.from('invoices').insert([row]).select('id').maybeSingle();
        if (ins.error || !ins.data?.id) return ins.error?.message || 'Kasa satırı açılamadı';
        id = ins.data.id;
      }
    }
    const linkId = asUuidOrNull(id);
    if (linkId) await supabase.from('hal_entries').update({ kasa_invoice_id: linkId }).eq('id', entryId);
    return '';
  };

  const removeEntry = async (row: any) => {
    if (!canTakeToCash) {
      alert('Saha kaydı silemez. Yanlışsa son 2 gün içinde düzeltin; silmeyi yönetici yapar.');
      return;
    }
    if (!window.confirm('Bu satır silinsin mi? Kasaya yazılmış tahsilat da kasadan düşer.')) return;
    if (row.kasa_invoice_id) await supabase.from('invoices').delete().eq('id', row.kasa_invoice_id);
    else if (isHalMerkezTahsil(row)) await supabase.from('invoices').delete().eq('invoice_no', `Hal tahsilat ${row.id}`);
    const { error } = await supabase.from('hal_entries').delete().eq('id', row.id);
    if (error) {
      alert(error.message);
      return;
    }
    await onReload();
  };

  const toggleVat = async (row: any) => {
    if (!canTakeToCash || row.kind !== 'sefer') return;
    const next = !row.has_vat;
    const base = cleanNumber(row.bedel);
    const withVat = seferTotal(base, true);
    if (next && !window.confirm(`Bu sefere %20 KDV eklensin mi?\n${money(base)} ₺ → ${money(withVat)} ₺ cariye yazılır. Saha nakit kasası değişmez.`)) return;
    if (!next && !window.confirm('KDV kaldırılsın mı? Cari sefer tutarı KDV’siz bedele döner.')) return;
    setBusy(true);
    const { error } = await supabase.from('hal_entries').update({ has_vat: next }).eq('id', row.id);
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    await onReload();
  };

  const startEdit = (row: any) => {
    if (locked(row)) {
      alert('2 günü geçmiş. Yalnızca yönetici değiştirir.');
      return;
    }
    setEditingId(row.id);
    setKind(row.kind === 'tahsilat' ? 'tahsilat' : 'sefer');
    setForm({
      date: String(row.entry_date).slice(0, 10),
      firm: row.firm_name || '',
      plate: row.plate || '',
      notes: String(row.notes || '').replace(/\s*\[(DRIVE-GIRIS|KASA-TAHSIL|AKTARIM-KASA|AKTARIM-CARI|MERKEZ-TAHSIL)\]/g, '').trim(),
      bedel: String(row.bedel || ''),
      vat: !!row.has_vat,
      collected: String(row.collected || '')
    });
    setFirmFilter(row.firm_name || '');
    setTab('form');
  };

  const takeToCash = async () => {
    if (!canTakeToCash) return;
    const amt = cleanNumber(handoverAmt || personelKasa);
    if (amt <= 0) {
      alert('Teslim edilecek nakit yok.');
      return;
    }
    if (!window.confirm(`${money(amt)} ₺ merkez kasaya alınsın mı? Saha personel kasa kalanı bu kadar düşer.`)) return;
    setBusy(true);
    const handDate = today;
    const invoiceNo = `Hal saha teslim ${handDate} ${amt}`;
    let invId: any = null;
    let existing = await supabase.from('invoices').select('id, total_amount').eq('invoice_no', invoiceNo).maybeSingle();
    if (!existing.data) {
      const oldNo = await supabase.from('invoices').select('id, total_amount').eq('invoice_no', `Hal saha teslim ${handDate}`).maybeSingle();
      if (oldNo.data && Number(oldNo.data.total_amount) === amt) existing = oldNo;
    }
    if (existing.data?.id) {
      invId = existing.data.id;
    } else {
      const { data: inv, error: invErr } = await supabase.from('invoices').insert([{
        invoice_no: invoiceNo,
        direction: 'incoming',
        category: 'cash_deposit',
        total_amount: amt,
        issue_date: handDate,
        due_date: handDate,
        status: 'paid'
      }]).select('id').maybeSingle();
      if (invErr) {
        setBusy(false);
        alert('Kasa yazılamadı: ' + invErr.message);
        return;
      }
      invId = inv?.id;
    }
    const handPayload: any = {
      hand_date: handDate,
      amount: amt,
      note: 'Merkez kasa teslimi',
      invoice_id: asUuidOrNull(invId),
      created_by: (await supabase.auth.getUser()).data.user?.id || null
    };
    let { error } = await supabase.from('hal_handovers').insert([handPayload]);
    if (error && /uuid/i.test(error.message || '')) {
      const retry = await supabase.from('hal_handovers').insert([{ ...handPayload, invoice_id: null }]);
      error = retry.error;
    }
    setBusy(false);
    if (error) {
      if (invId && !existing.data?.id) await supabase.from('invoices').delete().eq('id', invId);
      alert('Teslim kaydı yazılamadı: ' + error.message);
      return;
    }
    setHandoverAmt('');
    await onReload();
    alert('Merkez kasaya alındı.');
  };

  const setTeslimDate = async (row: any, date: string) => {
    if (!canTakeToCash || row.kind !== 'teslim' || !date || date === row.date) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.from('hal_handovers').update({ hand_date: date }).eq('id', row.id).select('id').maybeSingle();
      if (error || !data) {
        alert(
          error?.message
          || 'Tarih yazılamadı. Yönetici olarak SQL Editor’da hal_handovers UPDATE kuralını bir kez çalıştırın (setup_hal_saha.sql).'
        );
        return;
      }
      const invId = asUuidOrNull(row.invoice_id);
      const invPatch = { issue_date: date, due_date: date };
      if (invId) {
        await supabase.from('invoices').update(invPatch).eq('id', invId);
      } else {
        await supabase.from('invoices').update(invPatch).eq('invoice_no', `Hal saha teslim ${row.date} ${row.outAmt}`);
      }
      await onReload();
    } finally {
      setBusy(false);
    }
  };

  const tabBtn = (id: typeof tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`px-3 py-2 rounded-xl text-xs font-bold ${tab === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-lg text-slate-900">Hal saha</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Gece saha sefer ve nakit tahsilatı personel kasadadır; yönetici Saha kasası’ndan merkeze alır. Ofiste girilen tahsilat (personelin getirdiği veya firmanın doğrudan ödediği) cariden düşer ve şirket kasasına yazılır.
          </p>
        </div>
        <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold">
          Ay
          <input type="month" value={ym} onChange={e => setYm(e.target.value)} className="bg-transparent outline-none font-bold" />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {canEdit && tabBtn('form', 'Yeni giriş')}
        {tabBtn('list', 'Hareketler')}
        {tabBtn('cari', 'Aylık cari')}
        {tabBtn('kasa', 'Saha kasası')}
        {canTakeToCash && tabBtn('tanim', 'Tanımlar')}
      </div>

      {tab !== 'tanim' && tab !== 'form' && (
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-xs font-semibold text-slate-600">
          Firma
          <select
            value={firmFilter}
            onChange={e => setFirmFilter(e.target.value)}
            className="mt-1 block min-w-[220px] px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm font-bold"
          >
            <option value="">Tüm firmalar</option>
            {listedFirms.map((f: any) => (
              <option key={f.id} value={f.name}>{f.name}{isHalFirmActive(f) ? '' : ' (pasif)'}</option>
            ))}
          </select>
        </label>
      </div>
      )}

      {tab === 'form' && (
        <div className="max-w-lg space-y-3 p-4 rounded-2xl border border-slate-200 bg-slate-50">
          {!canEdit && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">Salt okuma. Kayıt için “işler” yetkisi gerekir.</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setKind('sefer')} className={`flex-1 py-2 rounded-xl text-xs font-bold ${kind === 'sefer' ? 'bg-[#009fe3] text-white' : 'bg-white border border-slate-200'}`}>Sefer</button>
            <button type="button" onClick={() => setKind('tahsilat')} className={`flex-1 py-2 rounded-xl text-xs font-bold ${kind === 'tahsilat' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200'}`}>Sadece tahsilat</button>
          </div>
          <label className="block text-xs font-semibold">Tarih
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg" />
          </label>
          <label className="block text-xs font-semibold">Firma
            <select value={form.firm} onChange={e => setForm({ ...form, firm: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white">
              <option value="">Seçin</option>
              {activeFirms.map((f: any) => <option key={f.id} value={f.name}>{f.name}</option>)}
            </select>
          </label>
          {kind === 'sefer' && (
            <>
              <label className="block text-xs font-semibold">Plaka
                <select
                  value={form.plate}
                  onChange={e => setForm({ ...form, plate: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg bg-white uppercase"
                >
                  <option value="">{definedPlates.length ? 'Seçin' : 'Önce yönetici plaka tanımlasın'}</option>
                  {definedPlates.map((p: any) => <option key={p.id} value={p.plate}>{p.plate}{p.note ? ` — ${p.note}` : ''}</option>)}
                  {form.plate && !definedPlates.some((p: any) => p.plate === form.plate) ? <option value={form.plate}>{form.plate} (eski)</option> : null}
                </select>
              </label>
              <label className="block text-xs font-semibold">Sefer tutarı
                <PortalInput value={form.bedel} onChange={e => setForm({ ...form, bedel: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg font-bold" inputMode="decimal" />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input type="checkbox" checked={form.vat} onChange={e => setForm({ ...form, vat: e.target.checked })} />
                + %20 fatura KDV (cariye eklenir, saha nakit kasasına yazılmaz)
              </label>
            </>
          )}
          <label className="block text-xs font-semibold">Açıklama
            <PortalInput value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg" placeholder="Güzergah / nakit notu" />
          </label>
          <label className="block text-xs font-semibold">Nakit tahsilat
            <PortalInput value={form.collected} onChange={e => setForm({ ...form, collected: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg font-bold text-emerald-700" inputMode="decimal" />
            <span className="text-[10px] text-slate-400 font-normal">
              {canTakeToCash && kind === 'tahsilat'
                ? 'Firma carisi düşer, şirket kasasına girer. Personelin sefer satırındaki nakit için burayı kullanmayın; Saha kasası → Merkeze al.'
                : 'Tek satır: hem firmanın carisini düşer hem personel kasaya girer.'}
            </span>
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={busy || !canEdit} onClick={saveEntry} className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:opacity-50">
              {editingId ? 'Değişikliği kaydet' : 'Kaydet'}
            </button>
            {editingId && <button type="button" onClick={resetForm} className="px-4 rounded-xl border text-sm">Vazgeç</button>}
          </div>
        </div>
      )}

      {tab === 'list' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold">
              <tr>
                <th className={thSort} onClick={() => setListSort(s => toggleSort(s, 'date'))}>Tarih{sortMark(listSort, 'date')}</th>
                <th className={thSort} onClick={() => setListSort(s => toggleSort(s, 'kind'))}>İşlem{sortMark(listSort, 'kind')}</th>
                <th className={thSort} onClick={() => setListSort(s => toggleSort(s, 'firm'))}>Firma{sortMark(listSort, 'firm')}</th>
                <th className={thSort} onClick={() => setListSort(s => toggleSort(s, 'plate'))}>Plaka{sortMark(listSort, 'plate')}</th>
                <th className={thSort} onClick={() => setListSort(s => toggleSort(s, 'note'))}>Açıklama{sortMark(listSort, 'note')}</th>
                <th className={`${thSort} text-right`} onClick={() => setListSort(s => toggleSort(s, 'sefer'))}>Sefer{sortMark(listSort, 'sefer')}</th>
                <th className="py-2 px-3 text-center">KDV</th>
                <th className={`${thSort} text-right`} onClick={() => setListSort(s => toggleSort(s, 'collected'))}>Nakit{sortMark(listSort, 'collected')}</th>
                {canEdit && <th className="py-2 px-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listed.map((e: any) => {
                const tot = e.kind === 'sefer' ? seferTotal(cleanNumber(e.bedel), !!e.has_vat) : 0;
                const lock = locked(e);
                const firmRow = (firms || []).find((x: any) => x.name === e.firm_name);
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 whitespace-nowrap">{formatDateTR(e.entry_date)}</td>
                    <td className="py-2 px-3 font-bold">{e.kind === 'tahsilat' ? (isHalMerkezTahsil(e) ? 'Tahsilat · kasa' : 'Tahsilat') : 'Sefer'}</td>
                    <td className="py-2 px-3 font-semibold">{e.firm_name}{firmRow && !isHalFirmActive(firmRow) ? ' (pasif)' : ''}</td>
                    <td className="py-2 px-3 font-mono">{e.plate || '—'}</td>
                    <td className="py-2 px-3 text-slate-500">{String(e.notes || '').replace(/\s*\[(DRIVE-GIRIS|KASA-TAHSIL|AKTARIM-KASA|AKTARIM-CARI|MERKEZ-TAHSIL)\]/g, '').trim() || '—'}</td>
                    <td className="py-2 px-3 text-right">{tot ? `${money(tot)} ₺` : '—'}</td>
                    <td className="py-2 px-3 text-center">
                      {e.kind === 'sefer' ? (
                        <label className={`inline-flex items-center gap-1 ${canTakeToCash ? 'cursor-pointer' : 'opacity-70'}`} title="Fatura KDV: cariye %20 eklenir, saha kasasına yazılmaz">
                          <input
                            type="checkbox"
                            disabled={!canTakeToCash || busy}
                            checked={!!e.has_vat}
                            onChange={() => toggleVat(e)}
                          />
                          <span className={`text-[10px] font-bold ${e.has_vat ? 'text-amber-700' : 'text-slate-400'}`}>%20</span>
                        </label>
                      ) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-700 font-bold">{cleanNumber(e.collected) ? `${money(cleanNumber(e.collected))} ₺` : '—'}</td>
                    {canEdit && (
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        {lock ? <span className="text-[10px] text-slate-400">kilit</span> : (
                          <button type="button" onClick={() => startEdit(e)} className="p-1 text-blue-600"><Edit2 className="w-3.5 h-3.5 inline" /></button>
                        )}
                        {canTakeToCash && (
                          <button type="button" onClick={() => removeEntry(e)} className="p-1 text-rose-600"><Trash2 className="w-3.5 h-3.5 inline" /></button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {!listed.length && <tr><td colSpan={9} className="py-8 text-center text-slate-400">Bu ayda kayıt yok.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'cari' && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-slate-900 text-white p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div>Devir<div className="text-lg font-black">{money(genel.devir)} ₺</div></div>
            <div>Sefer<div className="text-lg font-black">{money(genel.sefer)} ₺</div></div>
            <div>KDV %20<div className="text-lg font-black text-amber-200">{money(genel.kdv)} ₺</div><div className="text-[10px] text-slate-400 font-normal">Cariye dahil · kasaya yazılmaz</div></div>
            <div>Tahsilat<div className="text-lg font-black text-emerald-300">{money(genel.tahsilat)} ₺</div></div>
            <div>Kalan<div className="text-lg font-black text-rose-300">{money(genel.kalan)} ₺</div></div>
          </div>
          {cari.map(r => (
            <div key={r.name} className="border border-slate-200 rounded-xl p-3 flex flex-wrap justify-between gap-2 text-xs">
              <div>
                <div className="font-bold text-slate-900">{r.name}{r.inactive ? ' (pasif)' : ''}</div>
                {r.shop ? <div className="text-slate-400">{r.shop}</div> : null}
              </div>
              <div className="flex gap-4 font-semibold">
                <span>Devir {money(r.devir)}</span>
                <span className="text-[#009fe3]">Sefer {money(r.sefer)}</span>
                <span className="text-amber-800">KDV {money(r.kdv)}</span>
                <span className="text-emerald-700">Tahsilat {money(r.tahsilat)}</span>
                <span className="text-rose-700">Kalan {money(r.kalan)} ₺</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'tanim' && canTakeToCash && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="font-bold text-sm">Hal firmaları</h4>
            <p className="text-[11px] text-slate-500">Pasif firmaya yeni sefer/tahsilat girilmez. Aylık caride o ayın sefer ve tahsilatı durur.</p>
            <div className="flex flex-wrap gap-2">
              <input value={newFirm.name} onChange={e => setNewFirm(f => ({ ...f, name: e.target.value }))} placeholder="Firma adı" className="flex-1 min-w-[140px] px-3 py-2 border rounded-lg text-xs" />
              <input value={newFirm.shop} onChange={e => setNewFirm(f => ({ ...f, shop: e.target.value }))} placeholder="Dükkan no" className="w-28 px-3 py-2 border rounded-lg text-xs" />
              <button type="button" disabled={busy} onClick={saveFirm} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold">Ekle</button>
            </div>
            <div className="border rounded-xl divide-y text-xs">
              {(firms || []).map((f: any) => (
                <div key={f.id} className={`p-3 flex flex-wrap items-center gap-2 ${f.is_active === false ? 'opacity-50' : ''}`}>
                  <span className="font-bold flex-1">{f.name}</span>
                  <input
                    defaultValue={f.shop || ''}
                    onBlur={e => { if (e.target.value.trim() !== String(f.shop || '')) saveFirmShop(f.id, e.target.value); }}
                    placeholder="Dükkan"
                    className="w-24 px-2 py-1 border rounded text-xs"
                  />
                  <button type="button" onClick={() => setFirmActive(f.id, f.is_active === false)} className="text-[11px] font-bold text-[#009fe3]">
                    {f.is_active === false ? 'Aktif yap' : 'Pasif'}
                  </button>
                </div>
              ))}
              {!(firms || []).length && <div className="p-4 text-slate-400">Firma yok.</div>}
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="font-bold text-sm">Plakalar</h4>
            <p className="text-[11px] text-slate-500">Gece saha yalnız bu listeden seçer. Eski Excel kısaltmalarını buraya yazın (KSY, AAE…) veya kayıtlardan alın.</p>
            <div className="flex flex-wrap gap-2">
              <input value={newPlate.plate} onChange={e => setNewPlate(p => ({ ...p, plate: e.target.value }))} placeholder="Plaka" className="flex-1 min-w-[120px] px-3 py-2 border rounded-lg text-xs uppercase" />
              <input value={newPlate.note} onChange={e => setNewPlate(p => ({ ...p, note: e.target.value }))} placeholder="Not (isteğe bağlı)" className="flex-1 min-w-[120px] px-3 py-2 border rounded-lg text-xs" />
              <button type="button" disabled={busy} onClick={savePlateDef} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold">Ekle</button>
            </div>
            <button type="button" disabled={busy} onClick={importPlatesFromEntries} className="text-[11px] font-bold text-[#009fe3]">Kayıtlardaki plakaları al</button>
            <div className="border rounded-xl divide-y text-xs">
              {(plates || []).map((p: any) => (
                <div key={p.id} className={`p-3 flex items-center gap-2 ${p.is_active === false ? 'opacity-50' : ''}`}>
                  <span className="font-mono font-bold flex-1">{p.plate}</span>
                  {p.note ? <span className="text-slate-400">{p.note}</span> : null}
                  <button type="button" onClick={() => setPlateActive(p.id, p.is_active === false)} className="text-[11px] font-bold text-[#009fe3]">
                    {p.is_active === false ? 'Aç' : 'Kapat'}
                  </button>
                </div>
              ))}
              {!(plates || []).length && <div className="p-4 text-slate-400">Plaka yok. SQL çalıştıktan sonra ekleyin.</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'kasa' && (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-500">Personel kasa, Excel Tahsilatlar defteri + bundan sonraki tek satırlı gece girişleridir. Hareketlerdeki firma tahsilatı caridir; burada tekrarlanmaz.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
            <div className="border rounded-xl p-4 flex justify-between items-center bg-amber-50 border-amber-100 min-h-[72px]">
              <span className="text-xs font-semibold text-amber-900">Personel kasa bakiyesi</span>
              <b className="text-amber-900 text-lg tabular-nums">{money(personelKasa)} ₺</b>
            </div>
            <div className="border rounded-xl p-4 flex justify-between items-center bg-emerald-50 border-emerald-100 min-h-[72px]">
              <span className="text-xs font-semibold text-emerald-800">Mevcut ay tahsilatları</span>
              <b className="text-emerald-800 text-lg tabular-nums">{money(genel.tahsilat)} ₺</b>
            </div>
            <div className="border border-slate-200 rounded-xl p-4 flex justify-between items-center min-h-[72px] bg-white">
              <span className="text-xs font-semibold text-slate-500">Mevcut ay sefer toplamı</span>
              <b className="text-slate-900 text-lg tabular-nums">{money(aySefer)} ₺</b>
            </div>
            <div className="border rounded-xl p-4 flex justify-between items-center bg-rose-50 border-rose-200 min-h-[72px]">
              <span className="text-xs font-semibold text-rose-800">Kalan toplam alacak</span>
              <b className="text-rose-700 text-lg tabular-nums">{money(genel.kalan)} ₺</b>
            </div>
          </div>
          {canTakeToCash && (
            <div className="flex gap-2 items-end pt-2 max-w-xl">
              <label className="text-xs font-semibold flex-1">Merkeze alınacak ₺
                <input value={handoverAmt} onChange={e => setHandoverAmt(e.target.value)} placeholder={String(personelKasa || '')} className="mt-1 w-full px-3 py-2 border rounded-lg font-bold" />
              </label>
              <button type="button" disabled={busy} onClick={takeToCash} className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Merkeze al
              </button>
            </div>
          )}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold">
                <tr>
                  <th className={thSort} onClick={() => setKasaSort(s => toggleSort(s, 'date'))}>Tarih{sortMark(kasaSort, 'date')}</th>
                  <th className={thSort} onClick={() => setKasaSort(s => toggleSort(s, 'kind'))}>İşlem{sortMark(kasaSort, 'kind')}</th>
                  <th className={thSort} onClick={() => setKasaSort(s => toggleSort(s, 'who'))}>Kim{sortMark(kasaSort, 'who')}</th>
                  <th className={thSort} onClick={() => setKasaSort(s => toggleSort(s, 'note'))}>Not{sortMark(kasaSort, 'note')}</th>
                  <th className={`${thSort} text-right`} onClick={() => setKasaSort(s => toggleSort(s, 'inAmt'))}>Giren{sortMark(kasaSort, 'inAmt')}</th>
                  <th className={`${thSort} text-right`} onClick={() => setKasaSort(s => toggleSort(s, 'outAmt'))}>Çıkan{sortMark(kasaSort, 'outAmt')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {kasaDefter.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 whitespace-nowrap">
                      {canTakeToCash && r.kind === 'teslim' ? (
                        <input
                          type="date"
                          disabled={busy}
                          value={r.date}
                          onChange={e => setTeslimDate(r, e.target.value)}
                          className="border border-slate-200 rounded px-1 py-0.5 bg-white"
                        />
                      ) : formatDateTR(r.date)}
                    </td>
                    <td className="py-2 px-3 font-bold">{r.kind === 'teslim' ? 'Merkeze teslim' : 'Nakit'}</td>
                    <td className="py-2 px-3">{r.who || '—'}</td>
                    <td className="py-2 px-3 text-slate-500">{r.note || '—'}</td>
                    <td className="py-2 px-3 text-right text-emerald-700 font-bold">{r.inAmt ? `${money(r.inAmt)} ₺` : '—'}</td>
                    <td className="py-2 px-3 text-right text-rose-700 font-bold">{r.outAmt ? `${money(r.outAmt)} ₺` : '—'}</td>
                  </tr>
                ))}
                {!kasaDefter.length && <tr><td colSpan={6} className="py-8 text-center text-slate-400">Kasa hareketi yok.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(HalSahaPage);
