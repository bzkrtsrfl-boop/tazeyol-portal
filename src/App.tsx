import React, { useState, useEffect } from 'react';
import { 
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
  FileCheck2,
  UserCheck,
  CreditCard,
  DollarSign,
  ArrowDownCircle,
  TrendingUp,
  AlertCircle,
  Menu,
  ChevronRight,
  Clock,
  AlertTriangle,
  Truck
} from 'lucide-react';
import { supabase } from './supabase';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// YENİ TAZEYOL DAİRESEL LOGO BİLEŞENİ
function TazeyolLogo({ size = 24 }: { size?: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 512 512" 
      width={size} 
      height={size}
      className="shrink-0"
    >
      <rect width="512" height="512" rx="110" fill="#0b1426"/>
      <circle cx="256" cy="256" r="62" fill="#00a8fe"/>
      <circle cx="256" cy="256" r="112" fill="none" stroke="#00a8fe" strokeWidth="28"/>
      <path d="M 116 142 A 176 176 0 0 1 420 202" fill="none" stroke="#96dffe" strokeWidth="28" strokeLinecap="butt"/>
      <path d="M 92 310 A 176 176 0 0 0 396 370" fill="none" stroke="#96dffe" strokeWidth="28" strokeLinecap="butt"/>
    </svg>
  );
}

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

  // YAN MENÜ STATE
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'subcontractors' | 'employees' | 'fleet' | 'collections' | 'payments' | 'general_expenses'>('dashboard');
  
  // Modal State'leri
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [isImportingSubcontractors, setIsImportingSubcontractors] = useState(false);

  // Personel Ekleme Modal
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [employeeFormData, setEmployeeFormData] = useState({
    fullName: '',
    roleTitle: 'Tır Kaptanı / Frigo',
    baseSalary: '',
    phone: '',
    iban: ''
  });

  // Avans & Ödeme Modal State
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advanceFormData, setAdvanceFormData] = useState({
    targetType: 'subcontractor',
    targetName: '',
    paymentType: 'advance',
    totalAmount: '',
    installments: '1',
    notes: '',
    issueDate: new Date().toISOString().split('T')[0]
  });

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
  const [dbEmployees, setDbEmployees] = useState<any[]>([]);
  const [dbAdvances, setDbAdvances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // SUPABASE'DEN VERİLERİ ÇEKME
  const loadPortalData = async () => {
    setLoading(true);
    try {
      const { data: vData } = await supabase.from('vehicles').select('*').order('id', { ascending: true });
      const { data: invData } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
      const { data: empData } = await supabase.from('employees').select('*').order('id', { ascending: true });
      const { data: advData } = await supabase.from('advance_payments').select('*').order('created_at', { ascending: false });

      if (vData) setDbVehicles(vData);
      if (invData) setDbInvoices(invData);
      if (empData) setDbEmployees(empData);
      if (advData) setDbAdvances(advData);
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
    if (!targetDateStr) return { diff: 999, text: 'Belirtilmedi', color: 'text-slate-400 bg-slate-100' };
    const target = new Date(targetDateStr).getTime();
    const today = new Date().setHours(0, 0, 0, 0);
    const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

    if (diff < 0) {
      return { diff, text: `Süresi Geçti (${Math.abs(diff)} gün)`, color: 'text-rose-700 bg-rose-100 font-bold' };
    } else if (diff <= 30) {
      return { diff, text: `${diff} gün kaldı`, color: 'text-amber-800 bg-amber-100 font-bold' };
    } else {
      return { diff, text: `Geçerli (${diff} gün)`, color: 'text-emerald-800 bg-emerald-100 font-semibold' };
    }
  };

  // PERSONEL EKLEME
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeFormData.fullName.trim()) return;

    try {
      const { error } = await supabase.from('employees').insert([{
        full_name: employeeFormData.fullName.trim(),
        role_title: employeeFormData.roleTitle.trim(),
        base_salary: cleanNumber(employeeFormData.baseSalary),
        phone: employeeFormData.phone.trim(),
        iban: employeeFormData.iban.trim()
      }]);

      if (error) throw error;
      alert('Personel başarıyla kaydedildi!');
      setIsEmployeeModalOpen(false);
      setEmployeeFormData({ fullName: '', roleTitle: 'Tır Kaptanı / Frigo', baseSalary: '', phone: '', iban: '' });
      loadPortalData();
    } catch (err: any) {
      alert('Personel ekleme hatası: ' + err.message);
    }
  };

  // AVANS / ÖDEME / PRİM GİRİŞİ
  const handleSaveAdvancePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceFormData.targetName.trim() || !advanceFormData.totalAmount) {
      alert('Lütfen kişi/firma adı ve tutar giriniz.');
      return;
    }

    try {
      const amt = cleanNumber(advanceFormData.totalAmount);
      const inst = parseInt(advanceFormData.installments) || 1;

      let documentUrl: string | null = null;
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `adv_${Date.now()}.${fileExt}`;
        const { data: uploadData } = await supabase.storage.from('invoice_files').upload(fileName, selectedFile);
        if (uploadData) {
          const { data: pUrl } = supabase.storage.from('invoice_files').getPublicUrl(fileName);
          documentUrl = pUrl?.publicUrl || null;
        }
      }

      const { error: advErr } = await supabase.from('advance_payments').insert([{
        target_type: advanceFormData.targetType,
        target_id: advanceFormData.targetName,
        target_name: advanceFormData.targetName,
        payment_type: advanceFormData.paymentType,
        total_amount: amt,
        total_installments: inst,
        remaining_amount: amt,
        issue_date: advanceFormData.issueDate,
        document_url: documentUrl,
        notes: advanceFormData.notes
      }]);

      if (advErr) throw advErr;

      await supabase.from('invoices').insert([{
        invoice_no: `ODM-${Date.now().toString().slice(-6)}`,
        direction: 'incoming',
        category: advanceFormData.targetType === 'employee' ? 'salary_payroll' : 'subcontractor_invoice',
        total_amount: amt,
        issue_date: advanceFormData.issueDate,
        due_date: advanceFormData.issueDate,
        status: 'paid',
        document_url: documentUrl
      }]);

      alert('Ödeme başarıyla işlendi ve kasadan düşürüldü!');
      setIsAdvanceModalOpen(false);
      setSelectedFile(null);
      loadPortalData();
    } catch (err: any) {
      alert('İşlem hatası: ' + err.message);
    }
  };

  // TAKSİTİ ÖDENDİ OLARAK KAPATMA
  const handleMarkInvoicePaid = async (inv: any, term: 1 | 2) => {
    const termAmount = term === 1 ? cleanNumber(inv.term1_amount) : cleanNumber(inv.term2_amount);
    const confirmPay = window.confirm(`${inv.invoice_no} belgesinin ${term}. taksiti olan ${termAmount.toLocaleString('tr-TR')} ₺ ödendi olarak işaretlensin ve kasadan düşülsün mü?`);
    if (!confirmPay) return;

    try {
      const updateData: any = {};
      if (term === 1) updateData.term1_status = 'paid';
      if (term === 2) updateData.term2_status = 'paid';

      const otherPaid = term === 1 ? inv.term2_status === 'paid' : inv.term1_status === 'paid';
      if (otherPaid) {
        updateData.status = 'paid';
      }

      const { error } = await supabase.from('invoices').update(updateData).eq('id', inv.id);
      if (error) throw error;
      alert(`${term}. Taksit başarıyla ödendi!`);
      loadPortalData();
    } catch (err: any) {
      alert('Güncelleme hatası: ' + err.message);
    }
  };

  // TOPLU SATIŞ EXCEL'İ
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

  // TOPLU TAŞERON EXCEL'İ
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
          await supabase.from('invoices').delete().eq('category', 'subcontractor_invoice');
          const { error } = await supabase.from('invoices').insert(invoicesToInsert);

          if (error) throw error;
          alert(`Harika! ${invoicesToInsert.length} adet Alt Yüklenici faturası borç olarak işlendi.`);
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

  // TEKİL FATURA / MASRAF
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
        const { data: uploadData } = await supabase.storage.from('invoice_files').upload(fileName, selectedFile);
        if (uploadData) {
          const { data: publicUrlData } = supabase.storage.from('invoice_files').getPublicUrl(fileName);
          documentUrl = publicUrlData?.publicUrl || null;
        }
      }

      const matchedVehicle = dbVehicles.find(v => v.plate_number === formData.plateNumber);
      const halfAmount = parsedAmount / 2;
      const direction = isCollection ? 'incoming' : (formData.category === 'freight_sales' ? 'outgoing' : 'incoming');

      const { error } = await supabase.from('invoices').insert([{
        invoice_no: formData.invoiceNo || (isCollection ? `THS-${Date.now().toString().slice(-6)}` : `BLG-${Date.now().toString().slice(-6)}`),
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

      alert(isCollection ? 'Tahsilat işlendi ve kasaya eklendi!' : 'Fatura borç olarak kaydedildi!');
      setIsModalOpen(false);
      setSelectedFile(null);
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
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center drop-shadow-md">
              <TazeyolLogo size={64} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">TAZEYOL ERP</h1>
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

  // GERÇEK ERP HESAPLAMALARI
  const totalSalesRevenue = dbInvoices
    .filter(i => i.category === 'freight_sales')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const totalCollectedCash = dbInvoices
    .filter(i => i.category === 'customer_collection')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const pendingReceivables = Math.max(0, totalSalesRevenue - totalCollectedCash);

  let unpaidSubcontractorDebt = 0;
  dbInvoices
    .filter(i => i.category === 'subcontractor_invoice')
    .forEach(inv => {
      if (inv.term1_status !== 'paid') unpaidSubcontractorDebt += cleanNumber(inv.term1_amount || (inv.total_amount / 2));
      if (inv.term2_status !== 'paid') unpaidSubcontractorDebt += cleanNumber(inv.term2_amount || (inv.total_amount / 2));
    });

  const unpaidGeneralExpensesDebt = dbInvoices
    .filter(i => i.status !== 'paid' && i.category !== 'freight_sales' && i.category !== 'subcontractor_invoice' && i.category !== 'customer_collection')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const now = new Date();
  const currentDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgressRatio = Math.min(1, currentDay / daysInMonth);

  let accruedEmployeeSalaryDebt = 0;
  dbEmployees.forEach(emp => {
    const salary = cleanNumber(emp.base_salary);
    accruedEmployeeSalaryDebt += (salary * monthProgressRatio);
  });

  const accruedEmployeeBonusesDebt = dbAdvances
    .filter(a => a.target_type === 'employee' && ['bonus', 'special_bonus'].includes(a.payment_type))
    .reduce((sum, a) => sum + cleanNumber(a.total_amount), 0);

  const totalEmployeeDebt = accruedEmployeeSalaryDebt + accruedEmployeeBonusesDebt;
  const totalPayableDebt = unpaidSubcontractorDebt + unpaidGeneralExpensesDebt + totalEmployeeDebt;

  const baseCash = 845200;
  const actualPaidOutflows = dbInvoices
    .filter(i => i.status === 'paid' && i.category !== 'customer_collection' && i.category !== 'freight_sales')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const currentRealCash = baseCash + totalCollectedCash - actualPaidOutflows;

  const upcomingPayments = dbInvoices
    .filter(i => i.category === 'subcontractor_invoice' && (i.term1_status !== 'paid' || i.term2_status !== 'paid'))
    .slice(0, 5);

  const urgentVehicles = dbVehicles
    .map(v => ({ ...v, daysInfo: calculateDaysLeft(v.next_inspection_date) }))
    .filter(v => v.daysInfo.diff <= 45)
    .sort((a, b) => a.daysInfo.diff - b.daysInfo.diff)
    .slice(0, 5);

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

  const openAdvanceForSubcontractor = (contractorName: string) => {
    setAdvanceFormData({
      targetType: 'subcontractor',
      targetName: contractorName,
      paymentType: 'advance',
      totalAmount: '',
      installments: '1',
      notes: `${contractorName} avans ödemesi`,
      issueDate: new Date().toISOString().split('T')[0]
    });
    setIsAdvanceModalOpen(true);
  };

  const openAdvanceForEmployee = (empName: string) => {
    setAdvanceFormData({
      targetType: 'employee',
      targetName: empName,
      paymentType: 'advance',
      totalAmount: '',
      installments: '1',
      notes: `${empName} maaş avansı`,
      issueDate: new Date().toISOString().split('T')[0]
    });
    setIsAdvanceModalOpen(true);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Genel & Finans Kokpiti', icon: LayoutDashboard },
    { id: 'subcontractors', label: 'Alt Yüklenici Hakedişleri', badge: dbInvoices.filter(i => i.category === 'subcontractor_invoice').length, icon: Users },
    { id: 'employees', label: 'Personel & Bordro', badge: dbEmployees.length, icon: UserCheck },
    { id: 'fleet', label: 'Araç Filosu', badge: dbVehicles.length, icon: Truck },
    { id: 'collections', label: 'Müşteri Tahsilatları', badge: dbInvoices.filter(i => i.category === 'customer_collection').length, icon: Coins },
    { id: 'payments', label: 'Banka Talimatı (Excel)', icon: FileSpreadsheet },
    { id: 'general_expenses', label: 'Genel Giderler & Tedarik', icon: Receipt },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      {/* ÜST BAR (YENİ LOGOLU VE SADE) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* 3 ÇİZGİ / HAMBURGER MENÜ BUTONU */}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-2 font-bold text-xs shadow-sm">
              <Menu className="w-5 h-5 text-blue-600" />
              <span>MENÜ</span>
            </button>

            {/* YENİ LOGO VE BAŞLIK */}
            <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
              <div className="rounded-xl overflow-hidden shadow-sm flex items-center justify-center">
                <TazeyolLogo size={34} />
              </div>
              <span className="font-bold text-base text-slate-900 tracking-tight">TAZEYOL ERP</span>
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
      </header>

      {/* SOLDAN AÇILIR ÇEKMECE MENÜ */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div 
            onClick={() => setIsSidebarOpen(false)} 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
          />

          <div className="relative w-80 bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <TazeyolLogo size={36} />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">TAZEYOL ERP</h3>
                  <span className="text-[11px] text-slate-400">Yönetim & Operasyon</span>
                </div>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* MENÜ İÇİ HIZLI İŞLEM BUTONLARI */}
            <div className="p-4 border-b border-slate-100 space-y-2 bg-slate-50">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Hızlı İşlemler</span>
              <button 
                onClick={() => {
                  setIsSidebarOpen(false);
                  openActionModal('customer_collection');
                }}
                className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition shadow-sm">
                <Plus className="w-4 h-4" /> Yeni İşlem Ekle
              </button>

              <label className="cursor-pointer w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition shadow-sm">
                <FileUp className="w-4 h-4" /> 
                {isImportingExcel ? 'Aktarılıyor...' : 'Satış Exceli Yükle'}
                <input 
                  type="file" 
                  accept=".xlsx,.xls" 
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setIsSidebarOpen(false);
                      handleDirectExcelImport(f);
                    }
                  }} 
                  disabled={isImportingExcel}
                  className="hidden" 
                />
              </label>
            </div>

            {/* SAYFA MENÜLERİ */}
            <nav className="p-3 space-y-1 flex-1 overflow-y-auto text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block px-3 py-1">Modüller</span>
              {menuItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl font-semibold transition ${
                      isActive 
                        ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}>
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-500'}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-400 text-center">
              Tazeyol & Alkan Nakliyat • v2.6
            </div>
          </div>
        </div>
      )}

      {/* ANA İÇERİK ALANI */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
        
        {/* 1. GENEL & FİNANS KOKPİTİ */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* DÖRT ANA FİNANSAL KART */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-emerald-600 font-semibold tracking-wider uppercase flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5" /> Alınan Tahsilatlar
                </span>
                <div className="text-2xl font-bold text-emerald-600 mt-2">
                  +{totalCollectedCash.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-slate-400 mt-1 block">Kasaya Fiilen Giren Nakit</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-blue-600 font-semibold tracking-wider uppercase flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Bekleyen Müşteri Alacakları
                </span>
                <div className="text-2xl font-bold text-slate-900 mt-2">
                  {pendingReceivables.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-slate-400 mt-1 block">
                  Toplam Satış Cirosu: {totalSalesRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-rose-600 font-semibold tracking-wider uppercase flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Ödenecek Toplam Borçlar
                </span>
                <div className="text-2xl font-bold text-rose-600 mt-2">
                  {totalPayableDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-slate-400 mt-1 block">
                  Taşeron: {unpaidSubcontractorDebt.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺ | Personel: {totalEmployeeDebt.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                </span>
              </div>

              <div className="bg-blue-600 text-white p-5 rounded-2xl shadow-sm">
                <span className="text-xs text-blue-200 font-semibold tracking-wider uppercase flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" /> Güncel Kasa / Banka
                </span>
                <div className="text-2xl font-bold mt-2">
                  {currentRealCash.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-blue-100 mt-1 block">Net Mevcut Nakit</span>
              </div>
            </div>

            {/* İKİ KRİTİK KONTROL KUTUSU */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* KUTU 1: YAKLAŞAN KRİTİK ÖDEMELER */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Yaklaşan Kritik Taşeron Ödemeleri</h3>
                  </div>
                  <button 
                    onClick={() => setActiveTab('subcontractors')}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5">
                    Tümünü Gör <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2">
                  {upcomingPayments.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 text-xs">
                      <div>
                        <span className="font-mono font-bold text-slate-800 block truncate max-w-[240px]">{p.invoice_no}</span>
                        <span className="text-[11px] text-slate-400">Vade: {p.term1_due_date || p.due_date}</span>
                      </div>
                      <span className="font-bold text-rose-600 text-sm">
                        {cleanNumber(p.term1_amount || p.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </span>
                    </div>
                  ))}
                  {upcomingPayments.length === 0 && (
                    <div className="text-center py-6 text-slate-400 text-xs">Bekleyen vadesi gelmiş ödeme bulunmuyor.</div>
                  )}
                </div>
              </div>

              {/* KUTU 2: KRİTİK MUAYENE UYARILARI */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Muayenesi Yaklaşan Araçlar</h3>
                  </div>
                  <button 
                    onClick={() => setActiveTab('fleet')}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5">
                    Filoya Git <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2">
                  {urgentVehicles.map((v, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 text-xs">
                      <div>
                        <span className="font-mono font-bold text-blue-700 block">{v.plate_number}</span>
                        <span className="text-[11px] text-slate-500">{v.driver_name || 'Şoför Atanmadı'} • {v.brand_model || v.vehicle_type}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] ${v.daysInfo.color}`}>
                        {v.daysInfo.text}
                      </span>
                    </div>
                  ))}
                  {urgentVehicles.length === 0 && (
                    <div className="text-center py-6 text-slate-400 text-xs">Önümüzdeki 45 gün içinde muayenesi bitecek araç yok.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. PERSONEL & BORDRO */}
        {activeTab === 'employees' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Personel & Bordro Yönetimi</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bugün ayın <b>{currentDay}.</b> günü. Reel sabit maaşlar, işleyen gün tahakkuku, primler ve avans kesintileri.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setAdvanceFormData({
                      targetType: 'employee',
                      targetName: '',
                      paymentType: 'advance',
                      totalAmount: '',
                      installments: '3',
                      notes: 'Taksitli avans talebi',
                      issueDate: new Date().toISOString().split('T')[0]
                    });
                    setIsAdvanceModalOpen(true);
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                  <CreditCard className="w-4 h-4" /> Taksitli Avans / Prim Gir
                </button>
                <button 
                  onClick={() => setIsEmployeeModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                  <Plus className="w-4 h-4" /> Yeni Personel Ekle
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Personel Adı Soyadı</th>
                    <th className="py-3 px-3">Görevi / Pozisyon</th>
                    <th className="py-3 px-3 text-right">Sabit Net Maaş</th>
                    <th className="py-3 px-3 text-right">{currentDay} Günlük Hak Ediş</th>
                    <th className="py-3 px-3 text-right">Primler (+)</th>
                    <th className="py-3 px-3 text-right">Avanslar (-)</th>
                    <th className="py-3 px-3 text-right">Ay Sonu Kalan Maaş</th>
                    <th className="py-3 px-3 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dbEmployees.map(emp => {
                    const empAdvances = dbAdvances.filter(a => a.target_name === emp.full_name && a.target_type === 'employee');
                    const totalAdvances = empAdvances.filter(a => a.payment_type === 'advance').reduce((s, a) => s + cleanNumber(a.total_amount), 0);
                    const totalBonuses = empAdvances.filter(a => ['bonus', 'special_bonus'].includes(a.payment_type)).reduce((s, a) => s + cleanNumber(a.total_amount), 0);
                    const currentAccrued = (cleanNumber(emp.base_salary) * monthProgressRatio);
                    const netPayableEndOfMonth = cleanNumber(emp.base_salary) + totalBonuses - totalAdvances;

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                          {emp.full_name}
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {emp.role_title}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                          {cleanNumber(emp.base_salary).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-amber-700 whitespace-nowrap">
                          {currentAccrued.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-emerald-600 whitespace-nowrap">
                          {totalBonuses > 0 ? `+${totalBonuses.toLocaleString('tr-TR')} ₺` : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-rose-600 whitespace-nowrap">
                          {totalAdvances > 0 ? `-${totalAdvances.toLocaleString('tr-TR')} ₺` : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-blue-700 whitespace-nowrap text-sm">
                          {netPayableEndOfMonth.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button 
                            onClick={() => openAdvanceForEmployee(emp.full_name)}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold px-2.5 py-1 rounded-lg transition inline-flex items-center gap-1">
                            <DollarSign className="w-3 h-3" /> Avans / Prim
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {dbEmployees.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-400">Henüz personel kaydı bulunmuyor.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. ALT YÜKLENİCİ HAKEDİŞLERİ */}
        {activeTab === 'subcontractors' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Alt Yüklenici Hakedişleri (Ödenecek Borçlarımız)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Taşeron mutabakat faturaları, taksit kapatma ve avans mahsupları.</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setAdvanceFormData({
                      targetType: 'subcontractor',
                      targetName: '',
                      paymentType: 'advance',
                      totalAmount: '',
                      installments: '1',
                      notes: 'Taşeron avans ödemesi',
                      issueDate: new Date().toISOString().split('T')[0]
                    });
                    setIsAdvanceModalOpen(true);
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                  <ArrowDownCircle className="w-4 h-4" /> Avans / Ara Ödeme Düş
                </button>
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
                    <th className="py-3 px-4">Tarih</th>
                    <th className="py-3 px-4">Toplam Tutar</th>
                    <th className="py-3 px-4">1. Vade</th>
                    <th className="py-3 px-4">2. Vade</th>
                    <th className="py-3 px-4 text-center">İşlem / Avans</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {dbInvoices.filter(i => i.category === 'subcontractor_invoice').map((inv, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">{inv.invoice_no}</td>
                      <td className="py-3 px-4 text-slate-500">{inv.issue_date}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{cleanNumber(inv.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                      
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={inv.term1_status === 'paid' ? 'line-through text-slate-400' : 'text-blue-700 font-semibold'}>
                            {cleanNumber(inv.term1_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                          </span>
                          {inv.term1_status === 'paid' ? (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded font-bold">ÖDENDİ</span>
                          ) : (
                            <button 
                              onClick={() => handleMarkInvoicePaid(inv, 1)}
                              className="text-[10px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 px-1.5 py-0.5 rounded transition">
                              Öde
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block">{inv.term1_due_date}</span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={inv.term2_status === 'paid' ? 'line-through text-slate-400' : 'text-blue-700 font-semibold'}>
                            {cleanNumber(inv.term2_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                          </span>
                          {inv.term2_status === 'paid' ? (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded font-bold">ÖDENDİ</span>
                          ) : (
                            <button 
                              onClick={() => handleMarkInvoicePaid(inv, 2)}
                              className="text-[10px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 px-1.5 py-0.5 rounded transition">
                              Öde
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block">{inv.term2_due_date}</span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button 
                          onClick={() => openAdvanceForSubcontractor(inv.invoice_no)}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold px-2 py-1 rounded text-[11px] inline-flex items-center gap-1 transition">
                          <Coins className="w-3 h-3" /> Avans Düş
                        </button>
                      </td>
                    </tr>
                  ))}
                  {dbInvoices.filter(i => i.category === 'subcontractor_invoice').length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">Henüz hakediş faturası yok.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. ARAÇ FİLOSU */}
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

        {/* 5. MÜŞTERİ TAHSİLATLARI */}
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

        {/* 6. BANKA TALİMATI */}
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
              Bu ekran, sisteme işlenen alt yüklenici faturalarının ödenmemiş taksitlerini banka transfer listesi olarak hazırlar.
            </p>
          </div>
        )}

        {/* 7. GENEL GİDERLER & TEDARİK */}
        {activeTab === 'general_expenses' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Genel Giderler & Tedarik</h3>
                <p className="text-xs text-slate-500 mt-0.5">Ofis, kira, SGK, vergi ve genel şirket masrafları.</p>
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

      {/* MODAL 1: PERSONEL EKLEME */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">Yeni Personel Kaydı</h3>
              <button onClick={() => setIsEmployeeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ad Soyad</label>
                <input 
                  type="text" 
                  placeholder="Örn: Ahmet Yılmaz"
                  value={employeeFormData.fullName}
                  onChange={e => setEmployeeFormData({ ...employeeFormData, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Görevi / Pozisyonu</label>
                <select 
                  value={employeeFormData.roleTitle}
                  onChange={e => setEmployeeFormData({ ...employeeFormData, roleTitle: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white">
                  <option value="Tır Kaptanı / Frigo">Tır Kaptanı / Frigo (-18 / +4)</option>
                  <option value="Kamyon Şoförü">Kamyon Şoförü (10 Palet)</option>
                  <option value="Kamyonet Şoförü / Dağıtım">Kamyonet Şoförü / Dağıtım</option>
                  <option value="Operasyon Sorumlusu">Operasyon Sorumlusu</option>
                  <option value="Filo & Bakım Sorumlusu">Filo & Bakım Sorumlusu</option>
                  <option value="Muhasebe & Finans">Muhasebe & Finans</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Aylık Sabit Net Maaş (TL)</label>
                <input 
                  type="text" 
                  placeholder="Örn: 45.000"
                  value={employeeFormData.baseSalary}
                  onChange={e => setEmployeeFormData({ ...employeeFormData, baseSalary: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Telefon</label>
                  <input 
                    type="text" 
                    placeholder="0532..."
                    value={employeeFormData.phone}
                    onChange={e => setEmployeeFormData({ ...employeeFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">IBAN No</label>
                  <input 
                    type="text" 
                    placeholder="TR..."
                    value={employeeFormData.iban}
                    onChange={e => setEmployeeFormData({ ...employeeFormData, iban: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg uppercase"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsEmployeeModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-blue-600 text-white font-medium">Personeli Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: AVANS / ARA ÖDEME / PRİM */}
      {isAdvanceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">
                {advanceFormData.targetType === 'employee' ? 'Personel Avans & Prim Girişi' : 'Taşeron Avans & Ara Ödeme'}
              </h3>
              <button onClick={() => setIsAdvanceModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdvancePayment} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">İşlem Yapılan Kişi / Firma</label>
                <input 
                  type="text" 
                  placeholder={advanceFormData.targetType === 'employee' ? 'Personel Adı' : 'Taşeron Adı / Fatura'}
                  value={advanceFormData.targetName}
                  onChange={e => setAdvanceFormData({ ...advanceFormData, targetName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ödeme Türü</label>
                <select 
                  value={advanceFormData.paymentType}
                  onChange={e => setAdvanceFormData({ ...advanceFormData, paymentType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white">
                  <option value="advance">Avans (Gelecek Hakedişten/Maaştan Kesilecek)</option>
                  <option value="interim">Ara Ödeme (Fatura Mahsubu)</option>
                  <option value="bonus">Sefer / KM Primi</option>
                  <option value="special_bonus">Özel Başarı / Bayram Primi</option>
                  <option value="expense_reimbursement">Harcırah & Masraf İadesi</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ödenen Tutar (TL)</label>
                  <input 
                    type="text" 
                    placeholder="Örn: 25.000"
                    value={advanceFormData.totalAmount}
                    onChange={e => setAdvanceFormData({ ...advanceFormData, totalAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-sm text-rose-600"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kesinti Taksit Sayısı</label>
                  <select 
                    value={advanceFormData.installments}
                    onChange={e => setAdvanceFormData({ ...advanceFormData, installments: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white">
                    <option value="1">Tek Seferde (1 Ay / İlk Hakediş)</option>
                    <option value="2">2 Taksit Halinde</option>
                    <option value="3">3 Taksit Halinde</option>
                    <option value="4">4 Taksit Halinde</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ödeme / Dekont Tarihi</label>
                <input 
                  type="date" 
                  value={advanceFormData.issueDate}
                  onChange={e => setAdvanceFormData({ ...advanceFormData, issueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Açıklama / Sefer Bilgisi</label>
                <input 
                  type="text" 
                  placeholder="Örn: Antalya seferi mazot/harcırah avansı"
                  value={advanceFormData.notes}
                  onChange={e => setAdvanceFormData({ ...advanceFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Paperclip className="w-3.5 h-3.5 text-blue-600" /> Banka Dekontu / Fiş Ekle (Opsiyonel)
                </label>
                <input 
                  type="file" 
                  accept=".pdf,image/*" 
                  onChange={(e) => {
                    if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                  }}
                  className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsAdvanceModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-amber-600 text-white font-medium">Ödemeyi İşle & Kasadan Düş</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ARAÇ EKLEME / DÜZENLEME */}
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

      {/* MODAL 4: GENEL FATURA GİRİŞİ */}
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
                  className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700"
                />
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
