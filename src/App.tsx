import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Plus, 
  X, 
  RefreshCw, 
  FileSpreadsheet, 
  FileUp, 
  Lock, 
  LogOut, 
  ShieldCheck, 
  Edit2, 
  Paperclip, 
  ExternalLink,
  LayoutDashboard,
  Users,
  Coins,
  Receipt,
  FileCheck2
} from 'lucide-react';
import { supabase } from './supabase';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export default function App() {
  // GÜVENLİK VE OTURUM
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('tazeyol_auth') === 'true';
  });
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const AUTH_USER = 'yonetim';
  const AUTH_PASS = 'Tazeyol2026!';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginUsername.trim().toLowerCase() === AUTH_USER && loginPassword === AUTH_PASS) {
      localStorage.setItem('tazeyol_auth', 'true');
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Hatalı kullanıcı adı veya şifre girdiniz!');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tazeyol_auth');
    setIsAuthenticated(false);
  };

  // PORTAL SEKMELERİ
  const [activeTab, setActiveTab] = useState<'dashboard' | 'subcontractors' | 'fleet' | 'collections' | 'payments' | 'general_expenses'>('dashboard');
  
  // Masraf & Fatura Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [isImportingSubcontractors, setIsImportingSubcontractors] = useState(false);

  // Araç Ekleme & Düzenleme Modal State
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);

  const [vehicleFormData, setVehicleFormData] = useState({
    plateNumber: '',
    driverName: '',
    brandModel: '',
    documentIncluded: 'VAR',
    trackingSystem: 'Var',
    fuelSystem: 'UTTS',
    hgsSystem: 'SHELL',
    nextInspectionDate: '',
    insuranceCompany: '',
    insuranceDate: '',
    vehicleType: 'Kamyon Frigo (10 Palet)',
    ownershipType: 'Öz Mal'
  });

  const [formData, setFormData] = useState({
    category: 'subcontractor_invoice',
    companyName: '',
    plateNumber: '',
    invoiceNo: '',
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    term1Date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    term2Date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

      if (invErr) console.error('Fatura çekme hatası:', invErr);

      if (vData) setDbVehicles(vData);
      if (invData) setDbInvoices(invData);
    } catch (err) {
      console.error('Yükleme hatası:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadPortalData();
    }
  }, [isAuthenticated]);

  // PARA FORMATI
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

  // KALAN GÜN VE MUAYENE HESABI
  const calculateDaysLeft = (targetDateStr: string | null) => {
    if (!targetDateStr) return { text: 'Belirtilmedi', color: 'text-slate-400 bg-slate-100' };
    const target = new Date(targetDateStr).getTime();
    const today = new Date().setHours(0, 0, 0, 0);
    const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

    if (diff < 0) {
      return { text: `Süresi Geçti (${Math.abs(diff)} gün)`, color: 'text-rose-700 bg-rose-100 font-bold' };
    } else if (diff <= 30) {
      return { text: `${diff} gün kaldı`, color: 'text-amber-800 bg-amber-100 font-bold' };
    } else {
      return { text: `Geçerli (${diff} gün)`, color: 'text-emerald-800 bg-emerald-100 font-semibold' };
    }
  };

  const openEditVehicleModal = (v: any) => {
    setEditingVehicleId(v.id);
    setVehicleFormData({
      plateNumber: v.plate_number || '',
      driverName: v.driver_name || '',
      brandModel: v.brand_model || '',
      documentIncluded: v.document_included || 'VAR',
      trackingSystem: v.tracking_system || 'Var',
      fuelSystem: v.fuel_system || 'UTTS',
      hgsSystem: v.hgs_system || 'SHELL',
      nextInspectionDate: v.next_inspection_date || '',
      insuranceCompany: v.insurance_company || '',
      insuranceDate: v.insurance_date || '',
      vehicleType: v.vehicle_type || 'Kamyon Frigo (10 Palet)',
      ownershipType: v.ownership_type || 'Öz Mal'
    });
    setIsVehicleModalOpen(true);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleFormData.plateNumber.trim()) {
      alert('Lütfen araç plakasını giriniz.');
      return;
    }

    setIsSavingVehicle(true);
    try {
      const payload = {
        plate_number: vehicleFormData.plateNumber.trim().toUpperCase(),
        driver_name: vehicleFormData.driverName.trim(),
        brand_model: vehicleFormData.brandModel.trim(),
        document_included: vehicleFormData.documentIncluded,
        tracking_system: vehicleFormData.trackingSystem,
        fuel_system: vehicleFormData.fuelSystem,
        hgs_system: vehicleFormData.hgsSystem,
        next_inspection_date: vehicleFormData.nextInspectionDate || null,
        insurance_company: vehicleFormData.insuranceCompany.trim() || null,
        insurance_date: vehicleFormData.insuranceDate || null,
        vehicle_type: vehicleFormData.vehicleType,
        ownership_type: vehicleFormData.ownershipType
      };

      if (editingVehicleId) {
        const { error } = await supabase.from('vehicles').update(payload).eq('id', editingVehicleId);
        if (error) throw error;
        alert('Araç bilgileri güncellendi!');
      } else {
        const { error } = await supabase.from('vehicles').insert([payload]);
        if (error) throw error;
        alert('Yeni araç filoya eklendi!');
      }

      setIsVehicleModalOpen(false);
      setEditingVehicleId(null);
      loadPortalData();
    } catch (err: any) {
      alert('Araç işlem hatası: ' + (err.message || err));
    } finally {
      setIsSavingVehicle(false);
    }
  };

  // TOPLU SATIŞ EXCEL'İ YÜKLEME
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
          alert(`Aktarım Tamamlandı! ${invoicesToInsert.length} adet satış faturası işlendi.`);
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

  // TOPLU ALT YÜKLENİCİ EXCEL'İ YÜKLEME
  const handleSubcontractorExcelImport = async (file: File) => {
    setIsImportingSubcontractors(true);
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
          setIsImportingSubcontractors(false);
          return;
        }

        const parseDate = (d: any) => {
          if (!d) return new Date().toISOString().split('T')[0];
          if (d instanceof Date) return d.toISOString().split('T')[0];
          return String(d).split('T')[0];
        };

        const invoicesToInsert = [];
        const seenInvoices = new Set<string>();

        for (let idx = 0; idx < data.length; idx++) {
          const row = data[idx];
          const contractorName = String(row['Unvanı/Adı Soyadı'] || row['Unvanı'] || row['Tedarikçi'] || '').trim();
          let rawInvNo = String(row['Fatura No'] || row['fatura_no'] || '').trim();
          const totalRaw = row['Ödenecek Tutar'] || row['Tutar'] || row['Genel Toplam'];
          const issueDate = parseDate(row['Tarih'] || row['Fatura Tarihi']);

          if (contractorName && rawInvNo && totalRaw !== undefined && cleanNumber(totalRaw) > 0) {
            const totalAmt = cleanNumber(totalRaw);
            const halfAmt = totalAmt / 2;

            let uniqueInvoiceNo = `${rawInvNo} - ${contractorName}`;
            if (seenInvoices.has(uniqueInvoiceNo)) {
              uniqueInvoiceNo = `${uniqueInvoiceNo} (#${idx + 1})`;
            }
            seenInvoices.add(uniqueInvoiceNo);

            const t1 = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
            const t2 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

            invoicesToInsert.push({
              invoice_no: uniqueInvoiceNo,
              direction: 'incoming',
              category: 'subcontractor_invoice',
              total_amount: totalAmt,
              issue_date: issueDate,
              due_date: t2,
              term1_due_date: t1,
              term1_amount: halfAmt,
              term2_due_date: t2,
              term2_amount: halfAmt,
              status: 'unpaid'
            });
          }
        }

        if (invoicesToInsert.length > 0) {
          const { error } = await supabase
            .from('invoices')
            .upsert(invoicesToInsert, { onConflict: 'invoice_no' });

          if (error) throw error;
          alert(`Harika! ${invoicesToInsert.length} adet Alt Yüklenici faturası başarıyla işlendi ve taksitlendirildi.`);
          loadPortalData();
        } else {
          alert('Ödenecek tutarı olan geçerli fatura satırı bulunamadı.');
        }
      } catch (err: any) {
        alert('Taşeron aktarım hatası: ' + (err.message || err));
      } finally {
        setIsImportingSubcontractors(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  // TEKİL GİRİŞ KAYDET
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
      const isCollection = formData.category === 'customer_collection';
      
      let documentUrl: string | null = null;

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('invoice_files')
          .upload(fileName, selectedFile);

        if (uploadError) {
          console.warn('Dosya yüklenemedi:', uploadError.message);
        } else if (uploadData) {
          const { data: publicUrlData } = supabase.storage
            .from('invoice_files')
            .getPublicUrl(fileName);
          documentUrl = publicUrlData?.publicUrl || null;
        }
      }

      let companyId: any = null;
      if (formData.companyName) {
        const { data: comp } = await supabase.from('companies').select('id').eq('name', formData.companyName).maybeSingle();
        if (comp) {
          companyId = comp.id;
        } else {
          const { data: newComp } = await supabase.from('companies').insert([{
            name: formData.companyName,
            type: isCollection ? 'customer' : (isSub ? 'subcontractor' : 'supplier')
          }]).select();
          if (newComp) companyId = newComp[0].id;
        }
      }

      const matchedVehicle = dbVehicles.find(v => v.plate_number === formData.plateNumber);
      const halfAmount = parsedAmount / 2;
      const direction = isCollection ? 'incoming' : (formData.category === 'freight_sales' ? 'outgoing' : 'incoming');

      const { error } = await supabase.from('invoices').insert([{
        invoice_no: formData.invoiceNo || (isCollection ? `THS-${Date.now().toString().slice(-6)}` : `BLG-${Date.now().toString().slice(-6)}`),
        company_id: companyId,
        vehicle_id: matchedVehicle ? matchedVehicle.id : null,
        direction: direction,
        category: formData.category,
        issue_date: formData.paymentDate,
        due_date: formData.dueDate,
        total_amount: parsedAmount,
        term1_due_date: isSub ? formData.term1Date : null,
        term1_amount: isSub ? halfAmount : 0,
        term2_due_date: isSub ? formData.term2Date : null,
        term2_amount: isSub ? halfAmount : 0,
        status: isCollection ? 'paid' : 'unpaid',
        document_url: documentUrl
      }]);

      if (error) throw error;

      alert(isCollection ? 'Tahsilat işlendi ve kasaya yansıtıldı!' : 'Kayıt başarıyla işlendi!');
      setIsModalOpen(false);
      setSelectedFile(null);
      setFormData({
        category: 'subcontractor_invoice',
        companyName: '',
        plateNumber: '',
        invoiceNo: '',
        amount: '',
        paymentDate: new Date().toISOString().split('T')[0],
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

  const handleExportBankExcel = () => {
    const pendingPayments: any[] = [];

    dbInvoices
      .filter(i => i.category === 'subcontractor_invoice')
      .forEach(inv => {
        if (inv.term1_status !== 'paid' && inv.term1_amount > 0) {
          pendingPayments.push({
            subcontractor: inv.invoice_no,
            term: '1. Taksit',
            dueDate: inv.term1_due_date,
            amount: cleanNumber(inv.term1_amount)
          });
        }
        if (inv.term2_status !== 'paid' && inv.term2_amount > 0) {
          pendingPayments.push({
            subcontractor: inv.invoice_no,
            term: '2. Taksit',
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
      'Açıklama / Belge / Taşeron': p.subcontractor,
      'Ödeme Dilimi': p.term,
      'Vade Tarihi': p.dueDate,
      'Net Transfer Tutarı (TL)': p.amount,
      'İşlem Tipi': 'EFT/Havale'
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Banka Talimati');
    ws['!cols'] = [{ wch: 8 }, { wch: 45 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 15 }];

    const todayStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Banka_Toplu_Odeme_${todayStr}.xlsx`);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl border border-slate-100">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
              <Truck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">OPERASYON PORTALI</h1>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center justify-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Yetkili Yönetim Girişi
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kullanıcı Adı</label>
              <input 
                type="text" 
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                placeholder="yonetim"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" 
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Şifre</label>
              <input 
                type="password" 
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" 
                required
              />
            </div>

            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                {loginError}
              </div>
            )}

            <button 
              type="submit" 
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2">
              <Lock className="w-4 h-4" /> Güvenli Giriş Yap
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-400">Tazeyol & Alkan Nakliyat Operasyon ERP Sistemi</span>
          </div>
        </div>
      </div>
    );
  }

  const realSalesTotal = dbInvoices
    .filter(i => i.category === 'freight_sales')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const realCollectionsTotal = dbInvoices
    .filter(i => i.category === 'customer_collection')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const pendingSalesReceivable = Math.max(0, realSalesTotal - realCollectionsTotal);

  const realSubcontractorDebt = dbInvoices
    .filter(i => i.category === 'subcontractor_invoice')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const realFleetExpenses = dbInvoices
    .filter(i => i.vehicle_id !== null && i.category !== 'customer_collection')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const realGeneralExpenses = dbInvoices
    .filter(i => ['taxes_sgk', 'salary_payroll', 'traffic_fines', 'general_office'].includes(i.category))
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const baseCash = 845200;
  const totalOutgoingExpenses = realSubcontractorDebt + realFleetExpenses + realGeneralExpenses;
  const currentActualCash = baseCash + realCollectionsTotal - totalOutgoingExpenses;

  // HIZLI FORM AÇMA YARDIMCISI
  const openActionModal = (cat: string) => {
    setFormData({
      ...formData,
      category: cat,
      companyName: '',
      plateNumber: '',
      invoiceNo: '',
      amount: '',
      paymentDate: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0]
    });
    setSelectedFile(null);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* KURUMSAL ÜST BAŞLIK */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-sm">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight">OPERASYON ERP</span>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full ml-2">Yetkili Oturumu</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={loadPortalData} title="Verileri Yenile" className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={handleLogout}
              title="Güvenli Çıkış"
              className="p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition ml-1">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ANA GEZİNME MENÜSÜ */}
        <div className="max-w-7xl mx-auto px-4 flex gap-2 text-xs font-semibold border-t border-slate-100 overflow-x-auto py-1.5">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' : 'text-slate-600 hover:bg-slate-100'}`}>
            <LayoutDashboard className="w-4 h-4" /> Genel & Finans
          </button>
          <button 
            onClick={() => setActiveTab('subcontractors')} 
            className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition ${activeTab === 'subcontractors' ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Users className="w-4 h-4" /> Alt Yüklenici Hakedişleri ({dbInvoices.filter(i => i.category === 'subcontractor_invoice').length})
          </button>
          <button 
            onClick={() => setActiveTab('fleet')} 
            className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition ${activeTab === 'fleet' ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Truck className="w-4 h-4" /> Araç Filosu ({dbVehicles.length})
          </button>
          <button 
            onClick={() => setActiveTab('collections')} 
            className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition ${activeTab === 'collections' ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Coins className="w-4 h-4" /> Müşteri Tahsilatları ({dbInvoices.filter(i => i.category === 'customer_collection').length})
          </button>
          <button 
            onClick={() => setActiveTab('payments')} 
            className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition ${activeTab === 'payments' ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' : 'text-slate-600 hover:bg-slate-100'}`}>
            <FileSpreadsheet className="w-4 h-4" /> Banka Talimatı (Excel)
          </button>
          <button 
            onClick={() => setActiveTab('general_expenses')} 
            className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition ${activeTab === 'general_expenses' ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Receipt className="w-4 h-4" /> Genel Giderler & Tedarik
          </button>
        </div>
      </header>

      {/* İÇERİK ALANI */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        
        {/* 1. GENEL & FİNANS SEKMESİ */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Genel Finans ve Operasyon Kokpiti</h2>
                <p className="text-xs text-slate-500 mt-0.5">Şirketin anlık nakit durumu, toplam cirosu ve gider dökümü.</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3.5 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition shadow-sm">
                  <FileUp className="w-4 h-4" /> 
                  {isImportingExcel ? 'Aktarılıyor...' : 'Satış Exceli Yükle'}
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
                <button 
                  onClick={() => openActionModal('customer_collection')}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3.5 py-2.5 rounded-xl font-semibold flex items-center gap-1.5 transition shadow-sm">
                  <Plus className="w-4 h-4" /> Yeni İşlem Ekle
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 font-semibold tracking-wider uppercase">Toplam Satış Cirosu</span>
                <div className="text-2xl font-bold text-slate-900 mt-2">
                  {realSalesTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-slate-400 mt-1 block">
                  {dbInvoices.filter(i => i.category === 'freight_sales').length} Adet Kesilen Satış Faturası
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-emerald-600 font-semibold tracking-wider uppercase">Alınan Tahsilatlar</span>
                <div className="text-2xl font-bold text-emerald-600 mt-2">
                  +{realCollectionsTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-slate-400 mt-1 block">
                  Kalan Alacak: {pendingSalesReceivable.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 font-semibold tracking-wider uppercase">Toplam Gider & Masraf</span>
                <div className="text-2xl font-bold text-rose-600 mt-2">
                  -{totalOutgoingExpenses.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-slate-400 mt-1 block">Taşeron + Araçlar + Şirket</span>
              </div>

              <div className="bg-blue-600 text-white p-5 rounded-2xl shadow-sm">
                <span className="text-xs text-blue-200 font-semibold tracking-wider uppercase">Güncel Kasa / Banka</span>
                <div className="text-2xl font-bold mt-2">
                  {currentActualCash.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-blue-100 mt-1 block">Net Mevcut Nakit</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Tüm Faturalar & Tahsilatlar</h3>
                  <span className="text-xs text-slate-400">Veritabanına işlenen satış, taşeron ve masraf kayıtları</span>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
                  Toplam {dbInvoices.length} Kayıt
                </span>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase sticky top-0">
                    <tr>
                      <th className="py-3 px-4">Belge / Fatura No</th>
                      <th className="py-3 px-4">Kategori</th>
                      <th className="py-3 px-4">Tarih</th>
                      <th className="py-3 px-4">Vade</th>
                      <th className="py-3 px-4 text-center">Dosya / PDF</th>
                      <th className="py-3 px-4 text-right">Tutar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {dbInvoices.map((inv, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-medium">{inv.invoice_no}</td>
                        <td className="py-3 px-4 capitalize text-slate-600">
                          {inv.category === 'customer_collection' ? (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold">Müşteri Tahsilatı</span>
                          ) : (
                            inv.category.replace('_', ' ')
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500">{inv.issue_date}</td>
                        <td className="py-3 px-4 text-slate-500">{inv.due_date || '-'}</td>
                        <td className="py-3 px-4 text-center">
                          {inv.document_url ? (
                            <a href={inv.document_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium">
                              <Paperclip className="w-3.5 h-3.5" /> Belge
                            </a>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className={`py-3 px-4 text-right font-bold ${inv.category === 'customer_collection' || inv.category === 'freight_sales' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {inv.category === 'customer_collection' ? '+' : (inv.category === 'freight_sales' ? '' : '-')}{cleanNumber(inv.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 2. ALT YÜKLENİCİ HAKEDİŞLERİ SEKMESİ */}
        {activeTab === 'subcontractors' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Alt Yüklenici Hakedişleri</h3>
                <p className="text-xs text-slate-500 mt-0.5">Taşeron mutabakat faturaları ve taksitli ödeme takvimi.</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition">
                  <FileSpreadsheet className="w-4 h-4" /> 
                  {isImportingSubcontractors ? 'İşleniyor...' : 'Toplu Taşeron Exceli Yükle'}
                  <input 
                    type="file" 
                    accept=".xlsx,.xls" 
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleSubcontractorExcelImport(f);
                    }} 
                    disabled={isImportingSubcontractors}
                    className="hidden" 
                  />
                </label>
                <button 
                  onClick={() => openActionModal('subcontractor_invoice')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                  <Plus className="w-4 h-4" /> Yeni Hakediş Girişi
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase">
                  <tr>
                    <th className="py-3 px-4">Fatura No / Taşeron</th>
                    <th className="py-3 px-4">Fatura Tarihi</th>
                    <th className="py-3 px-4">Toplam Tutar</th>
                    <th className="py-3 px-4">1. Vade</th>
                    <th className="py-3 px-4">2. Vade</th>
                    <th className="py-3 px-4 text-center">Fatura Belgesi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {dbInvoices.filter(i => i.category === 'subcontractor_invoice').map((inv, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">{inv.invoice_no}</td>
                      <td className="py-3 px-4 text-slate-500">{inv.issue_date}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{cleanNumber(inv.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                      <td className="py-3 px-4 text-blue-700 font-semibold">{cleanNumber(inv.term1_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺ <span className="text-[11px] text-slate-400">({inv.term1_due_date})</span></td>
                      <td className="py-3 px-4 text-blue-700 font-semibold">{cleanNumber(inv.term2_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺ <span className="text-[11px] text-slate-400">({inv.term2_due_date})</span></td>
                      <td className="py-3 px-4 text-center">
                        {inv.document_url ? (
                          <a href={inv.document_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 font-medium">
                            <ExternalLink className="w-3.5 h-3.5" /> Görüntüle
                          </a>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                  {dbInvoices.filter(i => i.category === 'subcontractor_invoice').length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">Henüz hakediş faturası yok. Yukarıdaki butondan Excel dosyanızı yükleyebilirsiniz.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. ARAÇ FİLOSU SEKMESİ */}
        {activeTab === 'fleet' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Araç Filosu ({dbVehicles.length} Araç)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Sürücü, marka, muayene kalan gün ve yakıt otomasyon dökümü.</p>
              </div>
              <button 
                onClick={() => {
                  setEditingVehicleId(null);
                  setVehicleFormData({
                    plateNumber: '',
                    driverName: '',
                    brandModel: '',
                    documentIncluded: 'VAR',
                    trackingSystem: 'Var',
                    fuelSystem: 'UTTS',
                    hgsSystem: 'SHELL',
                    nextInspectionDate: '',
                    insuranceCompany: '',
                    insuranceDate: '',
                    vehicleType: 'Kamyon Frigo (10 Palet)',
                    ownershipType: 'Öz Mal'
                  });
                  setIsVehicleModalOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                <Plus className="w-4 h-4" /> Yeni Araç Ekle
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Plaka</th>
                    <th className="py-3 px-3">Sürücü</th>
                    <th className="py-3 px-3">Marka / Model</th>
                    <th className="py-3 px-3">Kasa / Tip</th>
                    <th className="py-3 px-3 text-center">Taşıt Tanıma</th>
                    <th className="py-3 px-3">Sonraki Muayene</th>
                    <th className="py-3 px-3">Muayene Durumu</th>
                    <th className="py-3 px-3">Trafik Sigortası</th>
                    <th className="py-3 px-3 text-right">Toplam Masraf</th>
                    <th className="py-3 px-3 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dbVehicles.map(v => {
                    const costs = dbInvoices.filter(i => i.vehicle_id === v.id);
                    const totalCost = costs.reduce((s, i) => s + cleanNumber(i.total_amount), 0);
                    const daysInfo = calculateDaysLeft(v.next_inspection_date);

                    return (
                      <tr key={v.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-3 font-mono font-bold text-blue-700 text-sm whitespace-nowrap">
                          {v.plate_number}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                          {v.driver_name || '-'}
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {v.brand_model || '-'}
                        </td>
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                          {v.vehicle_type}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${v.fuel_system === 'UTTS' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                            {v.fuel_system || 'UTTS'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {v.next_inspection_date || '-'}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] ${daysInfo.color}`}>
                            {daysInfo.text}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {v.insurance_company ? `${v.insurance_company} (${v.insurance_date || ''})` : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-rose-600 whitespace-nowrap">
                          {totalCost > 0 ? `-${totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : '0,00 ₺'}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button 
                            onClick={() => openEditVehicleModal(v)}
                            title="Bilgileri Düzenle"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition inline-flex items-center gap-1 font-medium">
                            <Edit2 className="w-3.5 h-3.5" /> Düzenle
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. MÜŞTERİ TAHSİLATLARI SEKMESİ */}
        {activeTab === 'collections' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Müşteri Tahsilatları</h3>
                <p className="text-xs text-slate-500 mt-0.5">Müşterilerden tahsil edilen banka ve nakit girişleri.</p>
              </div>
              <button 
                onClick={() => openActionModal('customer_collection')} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                <Plus className="w-4 h-4" /> Yeni Tahsilat Girişi
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase">
                  <tr>
                    <th className="py-3 px-4">Makbuz / Dekont No</th>
                    <th className="py-3 px-4">Tahsilat Tarihi</th>
                    <th className="py-3 px-4">Durum</th>
                    <th className="py-3 px-4 text-center">Belge</th>
                    <th className="py-3 px-4 text-right">Tahsil Edilen Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {dbInvoices.filter(i => i.category === 'customer_collection').map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-medium">{item.invoice_no}</td>
                      <td className="py-3 px-4 text-slate-600">{item.issue_date}</td>
                      <td className="py-3 px-4">
                        <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2.5 py-0.5 rounded-full font-semibold">Tahsil Edildi</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.document_url ? (
                          <a href={item.document_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 font-medium">
                            <ExternalLink className="w-3.5 h-3.5" /> Dekont
                          </a>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 text-sm">
                        +{cleanNumber(item.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </td>
                    </tr>
                  ))}
                  {dbInvoices.filter(i => i.category === 'customer_collection').length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400">Henüz müşteri tahsilatı işlenmedi.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. BANKA TALİMATI SEKMESİ */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Banka Toplu Ödeme Talimatı (Excel)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Vadesi gelen alt yüklenici hakedişlerini tek tıkla banka formatında indirin.</p>
              </div>
              <button onClick={handleExportBankExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition">
                <FileCheck2 className="w-4 h-4" /> Banka Excel Dosyası İndir
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Bu ekran, sisteme işlenen alt yüklenici faturalarının 1. ve 2. taksitlerini banka transfer listesi olarak hazırlar.
            </p>
          </div>
        )}

        {/* 6. GENEL GİDERLER & TEDARİK SEKMESİ */}
        {activeTab === 'general_expenses' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Genel Giderler & Tedarik</h3>
                <p className="text-xs text-slate-500 mt-0.5">Ofis, kira, SGK, vergi ve genel şirket masrafları (Plakasız veya plakalı).</p>
              </div>
              <button 
                onClick={() => openActionModal('general_office')} 
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                <Plus className="w-4 h-4" /> Yeni Gider Girişi
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase">
                  <tr>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Açıklama / Belge No</th>
                    <th className="py-3 px-4">Vade Tarihi</th>
                    <th className="py-3 px-4 text-center">Fatura / Belge</th>
                    <th className="py-3 px-4 text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {dbInvoices.filter(i => ['taxes_sgk', 'salary_payroll', 'traffic_fines', 'general_office'].includes(i.category)).map((g, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold capitalize text-slate-700">{g.category.replace('_', ' ')}</td>
                      <td className="py-3 px-4 font-mono">{g.invoice_no}</td>
                      <td className="py-3 px-4 text-slate-500">{g.due_date || '-'}</td>
                      <td className="py-3 px-4 text-center">
                        {g.document_url ? (
                          <a href={g.document_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 font-medium">
                            <ExternalLink className="w-3.5 h-3.5" /> Görüntüle
                          </a>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600">-{cleanNumber(g.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                    </tr>
                  ))}
                  {dbInvoices.filter(i => ['taxes_sgk', 'salary_payroll', 'traffic_fines', 'general_office'].includes(i.category)).length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400">Henüz genel şirket gideri işlenmedi.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ARAÇ EKLEME / DÜZENLEME MODAL */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">
                {editingVehicleId ? 'Araç Bilgilerini Düzenle' : 'Filoya Yeni Araç Ekle'}
              </h3>
              <button onClick={() => setIsVehicleModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Araç Plakası</label>
                  <input 
                    type="text" 
                    placeholder="34 TZY 101"
                    value={vehicleFormData.plateNumber}
                    onChange={e => setVehicleFormData({ ...vehicleFormData, plateNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg uppercase font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sürücü Adı Soyadı</label>
                  <input 
                    type="text" 
                    placeholder="Örn: Ercan Çelik"
                    value={vehicleFormData.driverName}
                    onChange={e => setVehicleFormData({ ...vehicleFormData, driverName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Marka / Model</label>
                  <input 
                    type="text" 
                    placeholder="Örn: Axtor, Doblo, NPR10"
                    value={vehicleFormData.brandModel}
                    onChange={e => setVehicleFormData({ ...vehicleFormData, brandModel: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kasa / Araç Tipi</label>
                  <select 
                    value={vehicleFormData.vehicleType}
                    onChange={e => setVehicleFormData({ ...vehicleFormData, vehicleType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white">
                    <option value="Çekici / Tır">Çekici / Tır</option>
                    <option value="Dorse Frigo">Dorse Frigo (-18 / +4)</option>
                    <option value="Kamyon Frigo (10 Palet)">Kamyon Frigo (10 Palet)</option>
                    <option value="Kamyon Frigo (8 Palet)">Kamyon Frigo (8 Palet)</option>
                    <option value="Kamyonet / Hafif Ticari">Kamyonet / Hafif Ticari</option>
                    <option value="Binek Otomobil">Binek Otomobil</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Taşıt Tanıma</label>
                  <select 
                    value={vehicleFormData.fuelSystem}
                    onChange={e => setVehicleFormData({ ...vehicleFormData, fuelSystem: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white">
                    <option value="UTTS">UTTS</option>
                    <option value="Kart">Kart</option>
                    <option value="YOK">YOK</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Araç Takip</label>
                  <select 
                    value={vehicleFormData.trackingSystem}
                    onChange={e => setVehicleFormData({ ...vehicleFormData, trackingSystem: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white">
                    <option value="Var">Var</option>
                    <option value="Yok">Yok</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">HGS</label>
                  <select 
                    value={vehicleFormData.hgsSystem}
                    onChange={e => setVehicleFormData({ ...vehicleFormData, hgsSystem: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white">
                    <option value="SHELL">SHELL</option>
                    <option value="DİĞER">DİĞER</option>
                    <option value="YOK">YOK</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 block text-xs">Muayene & Sigorta Takvimi</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Sonraki Muayene Tarihi</label>
                    <input 
                      type="date" 
                      value={vehicleFormData.nextInspectionDate}
                      onChange={e => setVehicleFormData({ ...vehicleFormData, nextInspectionDate: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Sigorta Şirketi</label>
                    <input 
                      type="text" 
                      placeholder="Örn: QUICK, ETHICA, AXA"
                      value={vehicleFormData.insuranceCompany}
                      onChange={e => setVehicleFormData({ ...vehicleFormData, insuranceCompany: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsVehicleModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" disabled={isSavingVehicle} className="w-1/2 py-2 rounded-lg bg-blue-600 text-white font-medium">
                  {isSavingVehicle ? 'Kaydediliyor...' : (editingVehicleId ? 'Güncelle' : 'Filoya Ekle')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* İŞLEM / FATURA GİRİŞ MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">İşlem / Belge Girişi</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} className="mt-4 space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">İşlem Türü</label>
                <select 
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-medium">
                  <option value="subcontractor_invoice">🚚 Alt Yüklenici Hakediş Faturası</option>
                  <option value="customer_collection" className="font-semibold text-emerald-700">💰 Müşteri Satış Tahsilatı (Kasa/Banka Girişi)</option>
                  <option value="general_office">🏢 Genel Tedarik / Ofis / Hizmet Masrafı (Plakasız)</option>
                  <option value="fuel">⛽ Öz Mal Yakıt (TTS)</option>
                  <option value="maintenance_repair">🔧 Öz Mal Bakım & Servis & Lastik</option>
                  <option value="driver_expense">👤 Öz Mal Şoför Harcırah / Hal / Otopark</option>
                  <option value="salary_payroll">💼 Personel Maaş & Prim</option>
                  <option value="taxes_sgk">🏛️ SGK / Vergi / Muhtasar</option>
                  <option value="traffic_fines">⚠️ Trafik Cezası</option>
                </select>
              </div>

              {formData.category === 'customer_collection' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tahsilat Tarihi</label>
                  <input 
                    type="date" 
                    value={formData.paymentDate}
                    onChange={e => setFormData({ ...formData, paymentDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white" 
                  />
                </div>
              )}

              {['fuel', 'maintenance_repair', 'driver_expense', 'traffic_fines'].includes(formData.category) && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">İlgili Araç Plakası (Opsiyonel)</label>
                  <select 
                    value={formData.plateNumber}
                    onChange={e => setFormData({ ...formData, plateNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs">
                    <option value="">Plakasız / Genel Şirket Masrafı</option>
                    {dbVehicles.map(v => (
                      <option key={v.id} value={v.plate_number}>{v.plate_number} ({v.brand_model || v.vehicle_type})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {formData.category === 'customer_collection' ? 'Tahsilat Yapılan Müşteri' : (formData.category === 'subcontractor_invoice' ? 'Alt Yüklenici / Taşeron Adı' : 'Cari / Tedarikçi / Kurum Adı')}
                </label>
                <input 
                  type="text" 
                  placeholder={formData.category === 'customer_collection' ? 'Örn: MİGROS TİCARET A.Ş.' : 'Örn: Ahmet Aksu, Shell A.Ş.'}
                  value={formData.companyName}
                  onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {formData.category === 'customer_collection' ? 'Dekont / Belge No' : 'Fatura / Belge No'}
                  </label>
                  <input 
                    type="text" 
                    placeholder={formData.category === 'customer_collection' ? 'Örn: EFT-847291' : 'Örn: GIB2026...'}
                    value={formData.invoiceNo}
                    onChange={e => setFormData({ ...formData, invoiceNo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {formData.category === 'customer_collection' ? 'Tahsil Edilen Tutar (TL)' : 'Tutar (TL)'}
                  </label>
                  <input 
                    type="text" 
                    placeholder="Örn: 250.000,00"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-xs" 
                    required
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Paperclip className="w-3.5 h-3.5 text-blue-600" /> Fatura Görseli / PDF Ekleyin (Opsiyonel)
                </label>
                <input 
                  type="file" 
                  accept=".pdf,image/*" 
                  onChange={(e) => {
                    if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                  }}
                  className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {selectedFile && (
                  <span className="text-[11px] text-emerald-600 font-medium block mt-1">
                    Seçilen Dosya: {selectedFile.name}
                  </span>
                )}
              </div>

              {formData.category === 'subcontractor_invoice' && (
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2">
                  <span className="text-xs font-bold text-blue-900 block">Vadeli Ödeme Planı (Otomatik İki Taksit)</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">1. Taksit Vadesi</label>
                      <input 
                        type="date" 
                        value={formData.term1Date}
                        onChange={e => setFormData({ ...formData, term1Date: e.target.value })}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-white" 
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">2. Taksit Vadesi</label>
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
