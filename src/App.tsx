import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Plus, 
  X, 
  RefreshCw, 
  FileSpreadsheet, 
  FileUp 
} from 'lucide-react';
import { supabase } from './supabase';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'fleet' | 'subcontractors' | 'payments' | 'general_expenses'>('dashboard');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImportingExcel, setIsImportingExcel] = useState(false);

  const [formData, setFormData] = useState({
    category: 'subcontractor_invoice',
    companyName: '',
    plateNumber: '',
    invoiceNo: '',
    amount: '',
    dueDate: new Date().toISOString().split('T')[0],
    term1Date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    term2Date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  });

  const [dbVehicles, setDbVehicles] = useState<any[]>([]);
  const [dbInvoices, setDbInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // SUPABASE'DEN VERİLERİ ÇEKME
  const loadPortalData = async () => {
    setLoading(true);
    try {
      const { data: vData } = await supabase.from('vehicles').select('*').order('id', { ascending: true });
      const { data: invData, error: invErr } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (invErr) {
        console.error('Fatura çekme hatası:', invErr);
      }

      if (vData) setDbVehicles(vData);
      if (invData) setDbInvoices(invData);
    } catch (err) {
      console.error('Yükleme hatası:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortalData();
  }, []);

  // TÜRKÇE PARA & SAYI TEMİZLEYİCİ
  const cleanNumber = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    let str = String(val).trim().replace('₺', '').replace('TL', '').trim();
    if (str.includes(',') && str.includes('.')) {
      if (str.indexOf('.') < str.indexOf(',')) {
        str = str.replace(/\./g, '').replace(',', '.');
      } else {
        str = str.replace(/,/g, '');
      }
    } else if (str.includes(',')) {
      str = str.replace(',', '.');
    }
    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : parsed;
  };

  // TOPLU SATIŞ EXCEL'İ YÜKLEME (MÜKERRER KORUMALI / UPSERT)
  const handleDirectExcelImport = async (file: File) => {
    setIsImportingExcel(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        if (!data || data.length === 0) {
          alert('Excel dosyasında satır bulunamadı.');
          setIsImportingExcel(false);
          return;
        }

        const parseDate = (d: any) => {
          if (!d) return new Date().toISOString().split('T')[0];
          if (d instanceof Date) return d.toISOString().split('T')[0];
          return String(d).split('T')[0];
        };

        const invoicesToInsert = [];

        for (const row of data) {
          const invNo = row['Fatura no'] || row['Fatura No'] || row['fatura_no'];
          const totalRaw = row['Genel Toplam'] || row['Tutar'] || row['genel_toplam'];
          const issueDate = parseDate(row['Düzenleme tarihi'] || row['Tarih']);
          const dueDate = parseDate(row['Son tahsilat tarihi'] || row['Vade Tarihi'] || issueDate);

          if (invNo && totalRaw !== undefined) {
            invoicesToInsert.push({
              invoice_no: String(invNo).trim(),
              direction: 'outgoing',
              category: 'freight_sales',
              total_amount: cleanNumber(totalRaw),
              issue_date: issueDate,
              due_date: dueDate,
              status: 'unpaid'
            });
          }
        }

        if (invoicesToInsert.length > 0) {
          const { error } = await supabase
            .from('invoices')
            .upsert(invoicesToInsert, { onConflict: 'invoice_no' });

          if (error) throw error;
          alert(`Aktarım Tamamlandı! ${invoicesToInsert.length} adet satış faturası işlendi (Mükerrer faturalar filtrelendi).`);
          setIsModalOpen(false);
          loadPortalData();
        }
      } catch (err: any) {
        alert('Aktarım hatası: ' + (err.message || err));
      } finally {
        setIsImportingExcel(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  // TEKİL GİRİŞ KAYDET (ALT YÜKLENİCİ VEYA ÖZ MAL)
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount) {
      alert('Lütfen tutar girin.');
      return;
    }

    setIsSaving(true);
    try {
      const parsedAmount = cleanNumber(formData.amount);
      const isSub = formData.category === 'subcontractor_invoice';
      
      let companyId: any = null;
      if (formData.companyName) {
        const { data: comp } = await supabase.from('companies').select('id').eq('name', formData.companyName).maybeSingle();
        if (comp) {
          companyId = comp.id;
        } else {
          const { data: newComp } = await supabase.from('companies').insert([{
            name: formData.companyName,
            type: isSub ? 'subcontractor' : 'supplier'
          }]).select();
          if (newComp) companyId = newComp[0].id;
        }
      }

      const matchedVehicle = dbVehicles.find(v => v.plate_number === formData.plateNumber);
      const halfAmount = parsedAmount / 2;

      const { error } = await supabase.from('invoices').insert([{
        invoice_no: formData.invoiceNo || `BELGE-${Date.now().toString().slice(-6)}`,
        company_id: companyId,
        vehicle_id: matchedVehicle ? matchedVehicle.id : null,
        direction: formData.category === 'freight_sales' ? 'outgoing' : 'incoming',
        category: formData.category,
        issue_date: new Date().toISOString().split('T')[0],
        due_date: formData.dueDate,
        total_amount: parsedAmount,
        term1_due_date: isSub ? formData.term1Date : null,
        term1_amount: isSub ? halfAmount : 0,
        term2_due_date: isSub ? formData.term2Date : null,
        term2_amount: isSub ? halfAmount : 0,
        status: 'unpaid'
      }]);

      if (error) throw error;

      alert('Kayıt başarıyla işlendi!');
      setIsModalOpen(false);
      setFormData({
        category: 'subcontractor_invoice',
        companyName: '',
        plateNumber: '',
        invoiceNo: '',
        amount: '',
        dueDate: new Date().toISOString().split('T')[0],
        term1Date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
        term2Date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
      });
      loadPortalData();
    } catch (err: any) {
      alert('Kayıt hatası: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // BANKA TALİMATI EXCEL ÇIKTISI
  const handleExportBankExcel = () => {
    const pendingPayments: any[] = [];

    dbInvoices
      .filter(i => i.category === 'subcontractor_invoice')
      .forEach(inv => {
        if (inv.term1_status !== 'paid' && inv.term1_amount > 0) {
          pendingPayments.push({
            subcontractor: inv.invoice_no,
            term: '1/2 Taksit',
            dueDate: inv.term1_due_date,
            amount: cleanNumber(inv.term1_amount)
          });
        }
        if (inv.term2_status !== 'paid' && inv.term2_amount > 0) {
          pendingPayments.push({
            subcontractor: inv.invoice_no,
            term: '2/2 Taksit',
            dueDate: inv.term2_due_date,
            amount: cleanNumber(inv.term2_amount)
          });
        }
      });

    if (pendingPayments.length === 0) {
      alert('Bekleyen alt yüklenici ödemesi bulunamadı.');
      return;
    }

    const excelData = pendingPayments.map((p, idx) => ({
      'Sıra No': idx + 1,
      'Açıklama / Belge': p.subcontractor,
      'Ödeme Dilimi': p.term,
      'Vade Tarihi': p.dueDate,
      'Net Transfer Tutarı (TL)': p.amount,
      'İşlem Tipi': 'EFT/Havale'
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Banka Talimati');
    ws['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 15 }];

    const todayStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Banka_Toplu_Odeme_${todayStr}.xlsx`);
  };

  // GERÇEK VERİTABANI HESAPLAMALARI
  const realSalesTotal = dbInvoices
    .filter(i => i.direction === 'outgoing')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const realSubcontractorDebt = dbInvoices
    .filter(i => i.category === 'subcontractor_invoice')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const realFleetExpenses = dbInvoices
    .filter(i => i.vehicle_id !== null)
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const realGeneralExpenses = dbInvoices
    .filter(i => ['taxes_sgk', 'salary_payroll', 'traffic_fines', 'general_office'].includes(i.category))
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const baseCash = 845200;
  const totalOutgoingExpenses = realSubcontractorDebt + realFleetExpenses + realGeneralExpenses;
  const realNetCash = baseCash + realSalesTotal - totalOutgoingExpenses;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* ÜST BAŞLIK */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-sm">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight">OPERASYON ERP</span>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full ml-2">Canlı Sistem</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-3.5 py-2 rounded-lg font-medium flex items-center gap-2 transition shadow-sm">
              <FileUp className="w-4 h-4" /> 
              {isImportingExcel ? 'Aktarılıyor...' : 'Toplu Satış Exceli Yükle'}
              <input 
                type="file" 
                accept=".xlsx,.xls" 
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleDirectExcelImport(f);
                }} 
                disabled={isImportingExcel}
                className="hidden" 
              />
            </label>

            <button onClick={loadPortalData} title="Yenile" className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition shadow-sm">
              <Plus className="w-4 h-4" /> Masraf / Fatura Girişi
            </button>
          </div>
        </div>

        {/* MENÜ TABLARI */}
        <div className="max-w-7xl mx-auto px-4 flex gap-8 text-sm font-medium border-t border-slate-100">
          <button onClick={() => setActiveTab('dashboard')} className={`py-3 border-b-2 ${activeTab === 'dashboard' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500'}`}>
            Genel Kokpit & Finans
          </button>
          <button onClick={() => setActiveTab('fleet')} className={`py-3 border-b-2 ${activeTab === 'fleet' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500'}`}>
            Öz Mal Araç Masrafları ({dbVehicles.length})
          </button>
          <button onClick={() => setActiveTab('subcontractors')} className={`py-3 border-b-2 ${activeTab === 'subcontractors' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500'}`}>
            Alt Yüklenici 1/2 Hakedişler
          </button>
          <button onClick={() => setActiveTab('payments')} className={`py-3 border-b-2 ${activeTab === 'payments' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500'}`}>
            Banka Talimatı (Excel Export)
          </button>
          <button onClick={() => setActiveTab('general_expenses')} className={`py-3 border-b-2 ${activeTab === 'general_expenses' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500'}`}>
            Şirket Giderleri & Vergiler
          </button>
        </div>
      </header>

      {/* İÇERİK ALANI */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 font-semibold tracking-wider uppercase">Mevcut Kasa / Banka</span>
                <div className="text-2xl font-bold text-slate-900 mt-2">{baseCash.toLocaleString('tr-TR')} ₺</div>
                <span className="text-xs text-slate-400 mt-1 block">Başlangıç Bakiyesi</span>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 font-semibold tracking-wider uppercase">Gerçek Satış Cirosu</span>
                <div className="text-2xl font-bold text-emerald-600 mt-2">
                  +{realSalesTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-emerald-700 mt-1 block font-medium">
                  {dbInvoices.filter(i => i.direction === 'outgoing').length} Adet Satış Faturası
                </span>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 font-semibold tracking-wider uppercase">Toplam Borç & Masraf</span>
                <div className="text-2xl font-bold text-rose-600 mt-2">
                  -{totalOutgoingExpenses.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-slate-400 mt-1 block">Taşeron + Öz Mal + Vergiler</span>
              </div>
              <div className="bg-blue-600 text-white p-5 rounded-xl shadow-sm">
                <span className="text-xs text-blue-200 font-semibold tracking-wider uppercase">Tahmini Net Nakit</span>
                <div className="text-2xl font-bold mt-2">
                  {realNetCash.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-blue-100 mt-1 block">Tahsilat & Ödemeler Sonrası</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">Veritabanındaki Faturalar</h3>
                  <span className="text-xs text-slate-400">Excel ve formdan işlenen fatura dökümü</span>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
                  Toplam {dbInvoices.length} Kayıt
                </span>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase sticky top-0">
                    <tr>
                      <th className="py-3 px-4">Fatura No</th>
                      <th className="py-3 px-4">Kategori</th>
                      <th className="py-3 px-4">Tarih</th>
                      <th className="py-3 px-4">Vade</th>
                      <th className="py-3 px-4 text-right">Tutar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {dbInvoices.map((inv, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-medium">{inv.invoice_no}</td>
                        <td className="py-3 px-4 capitalize text-slate-500">{inv.category.replace('_', ' ')}</td>
                        <td className="py-3 px-4 text-slate-500">{inv.issue_date}</td>
                        <td className="py-3 px-4 text-slate-500">{inv.due_date}</td>
                        <td className={`py-3 px-4 text-right font-bold ${inv.direction === 'outgoing' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {inv.direction === 'outgoing' ? '+' : '-'}{cleanNumber(inv.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'fleet' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-lg text-slate-900 mb-2">Öz Mal Araç Masrafları</h3>
            <p className="text-xs text-slate-500 mb-6">Yalnızca şirkete ait plakaların mazot, servis ve şoför harcamaları.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {dbVehicles.map(v => {
                const costs = dbInvoices.filter(i => i.vehicle_id === v.id);
                const total = costs.reduce((s, i) => s + cleanNumber(i.total_amount), 0);
                return (
                  <div key={v.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                    <span className="font-bold text-slate-900 block">{v.plate_number}</span>
                    <span className="text-xs text-slate-500 block mb-2">{v.vehicle_type}</span>
                    <span className="text-xs text-slate-500">Toplam Harcama:</span>
                    <span className="font-bold text-rose-600 block text-lg">{total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'subcontractors' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-lg text-slate-900 mb-2">Alt Yüklenici 1/2 Vadeli Faturaları</h3>
            <p className="text-xs text-slate-500 mb-6">Mutabakat sonucu işlenen taşeron faturaları 2 taksit olarak takip edilir.</p>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Fatura No</th>
                  <th className="py-3 px-4">Toplam Tutar</th>
                  <th className="py-3 px-4">1. Vade (1/2)</th>
                  <th className="py-3 px-4">2. Vade (1/2)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {dbInvoices.filter(i => i.category === 'subcontractor_invoice').map((inv, idx) => (
                  <tr key={idx}>
                    <td className="py-3 px-4 font-mono font-medium">{inv.invoice_no}</td>
                    <td className="py-3 px-4 font-bold">{cleanNumber(inv.total_amount).toLocaleString('tr-TR')} ₺</td>
                    <td className="py-3 px-4 text-blue-700 font-semibold">{cleanNumber(inv.term1_amount).toLocaleString('tr-TR')} ₺ ({inv.term1_due_date})</td>
                    <td className="py-3 px-4 text-blue-700 font-semibold">{cleanNumber(inv.term2_amount).toLocaleString('tr-TR')} ₺ ({inv.term2_due_date})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex justify-between items-center pb-6 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Banka Toplu Ödeme Talimatı (Excel Export)</h3>
                <span className="text-xs text-slate-500">1/2 taksiti gelen taşeron ödemelerini banka formatında indirin.</span>
              </div>
              <button onClick={handleExportBankExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition">
                <FileSpreadsheet className="w-4 h-4" /> Banka Excel Dosyası İndir
              </button>
            </div>
          </div>
        )}

        {activeTab === 'general_expenses' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-lg text-slate-900 mb-2">Şirket Genel Giderleri & Vergiler</h3>
            <p className="text-xs text-slate-500 mb-6">SGK, Muhtasar, Geçici Vergi ve genel şirket harcamaları.</p>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Açıklama / Belge</th>
                  <th className="py-3 px-4">Vade</th>
                  <th className="py-3 px-4 text-right">Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {dbInvoices.filter(i => ['taxes_sgk', 'salary_payroll', 'traffic_fines', 'general_office'].includes(i.category)).map((g, idx) => (
                  <tr key={idx}>
                    <td className="py-3 px-4 font-semibold capitalize">{g.category.replace('_', ' ')}</td>
                    <td className="py-3 px-4">{g.invoice_no}</td>
                    <td className="py-3 px-4">{g.due_date}</td>
                    <td className="py-3 px-4 text-right font-bold text-rose-600">-{cleanNumber(g.total_amount).toLocaleString('tr-TR')} ₺</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* FORM PENCERESİ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">Yeni Belge / Fatura Girişi</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} className="mt-4 space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Kategori</label>
                <select 
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs">
                  <option value="subcontractor_invoice">Alt Yüklenici Hakediş Faturası (1/2 Vadeli)</option>
                  <option value="fuel">Öz Mal Yakıt (TTS)</option>
                  <option value="maintenance_repair">Öz Mal Bakım & Servis & Lastik</option>
                  <option value="driver_expense">Öz Mal Şoför Harcırah / Hal / Otopark</option>
                  <option value="salary_payroll">Personel Maaş & Prim</option>
                  <option value="taxes_sgk">SGK / Vergi / Muhtasar</option>
                  <option value="traffic_fines">Trafik Cezası</option>
                </select>
              </div>

              {['fuel', 'maintenance_repair', 'driver_expense'].includes(formData.category) && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">İlgili Öz Mal Plakamız</label>
                  <select 
                    value={formData.plateNumber}
                    onChange={e => setFormData({ ...formData, plateNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs">
                    <option value="">Plaka Seçiniz...</option>
                    {dbVehicles.map(v => (
                      <option key={v.id} value={v.plate_number}>{v.plate_number} ({v.vehicle_type})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cari / Kurum Adı</label>
                <input 
                  type="text" 
                  value={formData.companyName}
                  onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Fatura / Belge No</label>
                  <input 
                    type="text" 
                    value={formData.invoiceNo}
                    onChange={e => setFormData({ ...formData, invoiceNo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tutar (TL)</label>
                  <input 
                    type="text" 
                    placeholder="Örn: 125.000,50"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-xs" 
                    required
                  />
                </div>
              </div>

              {formData.category === 'subcontractor_invoice' && (
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2">
                  <span className="text-xs font-bold text-blue-900 block">1/2 Vadeli Ödeme Planı (Otomatik)</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">1. Taksit Vadesi (1/2)</label>
                      <input 
                        type="date" 
                        value={formData.term1Date}
                        onChange={e => setFormData({ ...formData, term1Date: e.target.value })}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-white" 
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">2. Taksit Vadesi (1/2)</label>
                      <input 
                        type="date" 
                        value={formData.term2Date}
                        onChange={e => setFormData({ ...formData, term2Date: e.target.value })}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-white" 
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200 text-xs">İptal</button>
                <button type="submit" disabled={isSaving} className="w-1/2 py-2 rounded-lg bg-blue-600 text-white font-medium text-xs">
                  {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
