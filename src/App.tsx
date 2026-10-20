import React, { useState, useEffect, useMemo } from 'react';
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
  LayoutDashboard,
  Users,
  Coins,
  Receipt,
  FileCheck2,
  UserCheck,
  CreditCard,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Menu,
  ChevronRight,
  Clock,
  AlertTriangle,
  Truck,
  Eye,
  EyeOff,
  BarChart3,
  Calendar,
  Building2,
  Wallet,
  BellRing,
  CheckCircle2,
  FileText,
  History,
  Wrench,
  Fuel
} from 'lucide-react';
import { supabase } from './supabase';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

function TazeyolBrand() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center">
        <span className="font-extrabold text-xl tracking-tight text-[#0f2341]">taze</span>
        <div className="relative flex items-center justify-center font-extrabold text-xl text-[#009fe3]">
          y
          <span className="relative inline-flex items-center justify-center ml-0.5 mr-0.5">
            <span className="w-5 h-5 rounded-full border-[2.5px] border-[#97dcfc] flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-[#009fe3]"></span>
            </span>
          </span>
          l
        </div>
      </div>
      <span className="bg-[#009fe3] text-white text-[11px] font-black tracking-widest px-2 py-0.5 rounded-md uppercase ml-1 shadow-sm">
        ERP
      </span>
    </div>
  );
}

export default function App() {
  // GÜVENLİK, ROL VE OTURUM
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'reporter' | null>(() => {
    return (localStorage.getItem('tazeyol_user_role') as 'admin' | 'reporter') || null;
  });
  const isAuthenticated = !!currentUserRole;

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const u = loginUsername.trim().toLowerCase();
    const p = loginPassword;

    if (u === 'admin' && p === 'Flee3533!') {
      localStorage.setItem('tazeyol_user_role', 'admin');
      setCurrentUserRole('admin');
      setLoginError('');
    } else if (u === 'rapor' && p === 'Rapor2026!') {
      localStorage.setItem('tazeyol_user_role', 'reporter');
      setCurrentUserRole('reporter');
      setLoginError('');
    } else {
      setLoginError('Hatalı kullanıcı adı veya şifre girdiniz!');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tazeyol_user_role');
    setCurrentUserRole(null);
  };

  // YAN MENÜ VE SEKME STATE'LERİ
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'subcontractors' | 'employees' | 'fleet' | 'profitability' | 'collections' | 'payments' | 'general_expenses'>('overview');

  // GENEL GÖRÜNÜM TARİH FİLTRESİ
  const getCurrentMonthRange = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDay = new Date(year, month + 1, 0);

    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    const startStr = `${year}-${pad(month + 1)}-01`;
    const endStr = `${year}-${pad(month + 1)}-${pad(lastDay.getDate())}`;

    return { start: startStr, end: endStr };
  };

  const [filterStartDate, setFilterStartDate] = useState(getCurrentMonthRange().start);
  const [filterEndDate, setFilterEndDate] = useState(getCurrentMonthRange().end);

  // MODAL VE İŞLEM STATE'LERİ
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [isImportingSubcontractors, setIsImportingSubcontractors] = useState(false);
  const [isImportingHgsExcel, setIsImportingHgsExcel] = useState(false);

  // BANKA EXCEL İNDİRME SEÇİM MODALI
  const [isBankExportModalOpen, setIsBankExportModalOpen] = useState(false);
  const [bankExportTermChoice, setBankExportTermChoice] = useState<'term1' | 'term2' | 'both'>('both');

  // TAŞERON FATURA DÜZENLEME MODAL STATE
  const [isEditSubModalOpen, setIsEditSubModalOpen] = useState(false);
  const [editingSubInvoice, setEditingSubInvoice] = useState<any>(null);
  const [subEditFormData, setSubEditFormData] = useState({
    invoiceNo: '',
    totalAmount: '',
    issueDate: '',
    term1DueDate: '',
    term1Amount: '',
    term2DueDate: '',
    term2Amount: ''
  });

  // PERSONEL EKLEME MODAL
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [employeeFormData, setEmployeeFormData] = useState({
    fullName: '',
    roleTitle: 'Tır Kaptanı / Frigo',
    baseSalary: '',
    phone: '',
    iban: ''
  });

  // PERSONEL HIZLI AVANS / MASRAF İADESİ POP-UP
  const [isQuickPayModalOpen, setIsQuickPayModalOpen] = useState(false);
  const [quickPayTargetEmployee, setQuickPayTargetEmployee] = useState<any>(null);
  const [quickPayFormData, setQuickPayFormData] = useState({
    amount: '',
    payType: 'advance',
    paySource: 'cash',
    notes: ''
  });

  // 360° ÇEKMECE (DRAWER) STATE'LERİ
  const [drawerType, setDrawerType] = useState<'vehicle' | 'employee' | 'entity' | null>(null);
  const [selectedDrawerEntity, setSelectedDrawerEntity] = useState<any>(null);

  // ARAÇ EKLEME & DÜZENLEME MODAL STATE
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

  // ÖZ MAL ARAÇ AYLIK KARLILIK KAYIT MODAL STATE
  const [isProfitModalOpen, setIsProfitModalOpen] = useState(false);
  const [profitFormData, setProfitFormData] = useState({
    monthYear: 'Eyl.26',
    plateNumber: '',
    reconNetRevenue: '',
    invoiceRevenue: '',
    driverSalary: '',
    fuelExVat: '',
    hgsExVat: '',
    bonus: '',
    sgk: '',
    otherExpense: ''
  });

  // İŞLEM / BELGE GİRİŞİ DİNAMİK FORM STATE'İ
  const [formData, setFormData] = useState({
    category: 'general_fuel',
    companyName: '',
    plateNumber: '',
    invoiceNo: '',
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    term1Date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    term2Date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    paymentStatus: 'unpaid',
    paidSource: 'cash',
    paidEmployeeName: ''
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [dbVehicles, setDbVehicles] = useState<any[]>([]);
  const [dbInvoices, setDbInvoices] = useState<any[]>([]);
  const [dbEmployees, setDbEmployees] = useState<any[]>([]);
  const [dbAdvances, setDbAdvances] = useState<any[]>([]);
  const [dbProfitability, setDbProfitability] = useState<any[]>([
    { id: 1, month_year: 'Eyl.26', plate_number: '34BHC220', recon_net: 283691.96, invoice_rev: 329082.67, driver_sal: 82500.00, fuel_ex_vat: 78408.74, hgs_ex_vat: 31397.45, bonus: 0, sgk: 11148.00, other_exp: 1000.00 },
    { id: 2, month_year: 'Eyl.26', plate_number: '34CKL472', recon_net: 305726.86, invoice_rev: 354643.16, driver_sal: 82500.00, fuel_ex_vat: 80480.16, hgs_ex_vat: 41648.61, bonus: 0, sgk: 11148.00, other_exp: 3000.00 },
    { id: 3, month_year: 'Eyl.26', plate_number: '34HNE893', recon_net: 330079.01, invoice_rev: 382891.65, driver_sal: 56000.00, fuel_ex_vat: 107474.25, hgs_ex_vat: 60884.91, bonus: 14400.00, sgk: 11148.00, other_exp: 0 },
    { id: 4, month_year: 'Eyl.26', plate_number: '34NEL388', recon_net: 451699.97, invoice_rev: 523971.97, driver_sal: 77000.00, fuel_ex_vat: 124513.06, hgs_ex_vat: 24500.00, bonus: 43200.00, sgk: 15148.00, other_exp: 34000.00 },
    { id: 5, month_year: 'Eyl.26', plate_number: '34NUE791', recon_net: 279329.44, invoice_rev: 324022.15, driver_sal: 56000.00, fuel_ex_vat: 85582.16, hgs_ex_vat: 49688.31, bonus: 15600.00, sgk: 11148.00, other_exp: 1500.00 },
    { id: 6, month_year: 'Eyl.26', plate_number: '34SN1203', recon_net: 497886.39, invoice_rev: 577548.21, driver_sal: 60000.00, fuel_ex_vat: 54328.29, hgs_ex_vat: 3102.76, bonus: 10200.00, sgk: 11148.00, other_exp: 0 },
    { id: 7, month_year: 'Eyl.26', plate_number: '34UU8372', recon_net: 187228.32, invoice_rev: 217184.85, driver_sal: 56000.00, fuel_ex_vat: 57310.68, hgs_ex_vat: 16070.97, bonus: 15600.00, sgk: 11148.00, other_exp: 0 }
  ]);
  const [loading, setLoading] = useState(true);

  // SUPABASE VERİ ÇEKME
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

  // PARA FORMATLAMA VE TEMİZLEME
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

  const sanitizeDate = (d: any) => {
    if (!d) return '';
    try {
      return String(d).split('T')[0];
    } catch {
      return '';
    }
  };

  const calculateDaysLeft = (targetDateStr: string | null) => {
    if (!targetDateStr) return { diff: 999, text: 'Belirtilmedi', color: 'text-slate-400 bg-slate-100' };
    const cleanDate = sanitizeDate(targetDateStr);
    const target = new Date(cleanDate).getTime();
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

  // CARİ / TEDARİKÇİ OTOMATİK TAMAMLAMA LİSTESİ (HAFIZA)
  const existingCompanySuggestions = useMemo(() => {
    const names = new Set<string>();
    names.add('Shell & Turcas Petrol A.Ş.');
    names.add('MİGROS TİCARET A.Ş.');
    names.add('Bim Birleşik Mağazalar A.Ş.');
    names.add('A101 Yeni Mağazacılık A.Ş.');
    names.add('Şok Marketler Ticaret A.Ş.');
    names.add('Hamaliye ve İndirme Ekibi');
    names.add('Oto Servis & Bakım');
    names.add('Lastik Dünyası');

    dbInvoices.forEach(i => {
      if (i.invoice_no && i.invoice_no.includes(' - ')) {
        const parts = i.invoice_no.split(' - ');
        if (parts[1]) names.add(parts[1].trim());
      }
    });

    return Array.from(names);
  }, [dbInvoices]);

  // VADESİ GELEN / GEÇEN DİĞER MASRAFLAR LİSTESİ (ALARM PANOSU)
  const dueExpenseAlerts = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return dbInvoices
      .filter(i => i.status !== 'paid' && i.category !== 'customer_collection' && i.category !== 'freight_sales' && i.due_date)
      .map(i => {
        const d = sanitizeDate(i.due_date);
        const targetTime = new Date(d).getTime();
        const todayTime = new Date(today).getTime();
        const diffDays = Math.ceil((targetTime - todayTime) / (1000 * 60 * 60 * 24));
        return { ...i, diffDays };
      })
      .filter(i => i.diffDays <= 3)
      .sort((a, b) => a.diffDays - b.diffDays);
  }, [dbInvoices]);

  // TARİH ARALIĞINA GÖRE FİLTRELENMİŞ VERİLER
  const isDateInRange = (dateStr: string | null) => {
    if (!dateStr) return true;
    const d = sanitizeDate(dateStr);
    if (!filterStartDate && !filterEndDate) return true;
    if (filterStartDate && d < filterStartDate) return false;
    if (filterEndDate && d > filterEndDate) return false;
    return true;
  };

  const filteredInvoices = dbInvoices.filter(i => isDateInRange(i.issue_date || i.created_at));

  // SEÇİLEN DÖNEM SATIŞ CİROSU (Tarihe Göre)
  const selectedPeriodSalesRevenue = filteredInvoices
    .filter(i => i.direction === 'outgoing' || i.category === 'freight_sales')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  // KASAYA FİİLEN GİREN TAHSİLATLAR
  const totalCollectedCash = filteredInvoices
    .filter(i => i.category === 'customer_collection')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  // KRİTİK DÜZELTME: BEKLEYEN MÜŞTERİ ALACAKLARI (TARİHTEN BAĞIMSIZ TÜM TAHSİL EDİLMEMİŞ SATIŞ FATURALARI)
  const allTimePendingSalesReceivables = dbInvoices
    .filter(i => (i.direction === 'outgoing' || i.category === 'freight_sales') && i.status !== 'paid')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  // 1. Taşeron Borcu & Kırılımları
  let unpaidSubcontractorDebt = 0;
  let unpaidSubcontractorTerm1Debt = 0;
  let unpaidSubcontractorTerm2Debt = 0;

  dbInvoices
    .filter(i => i.category === 'subcontractor_invoice')
    .forEach(inv => {
      const t1 = cleanNumber(inv.term1_amount || (inv.total_amount / 2));
      const t2 = cleanNumber(inv.term2_amount || (inv.total_amount / 2));

      if (inv.term1_status !== 'paid') {
        unpaidSubcontractorDebt += t1;
        unpaidSubcontractorTerm1Debt += t1;
      }
      if (inv.term2_status !== 'paid') {
        unpaidSubcontractorDebt += t2;
        unpaidSubcontractorTerm2Debt += t2;
      }
    });

  // 2. Devlet Ödemeleri (Vergi, SGK, Cezalar)
  const totalGovernmentPaymentsDebt = dbInvoices
    .filter(i => i.status !== 'paid' && ['taxes_sgk', 'traffic_fines'].includes(i.category))
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  // 3. Temel / Diğer Şirket Faturaları (Taşeron Hariç)
  const totalGeneralCompanyExpensesDebt = dbInvoices
    .filter(i => i.status !== 'paid' && !['subcontractor_invoice', 'customer_collection', 'freight_sales', 'taxes_sgk', 'traffic_fines', 'salary_payroll'].includes(i.category))
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  // 4. Personel Gelecek Ödemeleri
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

  const totalEmployeeFutureDebt = accruedEmployeeSalaryDebt + accruedEmployeeBonusesDebt;

  // ÖDENECEK TOPLAM BORÇLAR
  const totalConsolidatedDebt = unpaidSubcontractorDebt + totalGovernmentPaymentsDebt + totalGeneralCompanyExpensesDebt + totalEmployeeFutureDebt;

  // GÜNCEL KASA / BANKA
  const baseCash = 845200;
  const actualPaidOutflows = dbInvoices
    .filter(i => i.status === 'paid' && i.category !== 'customer_collection' && i.category !== 'freight_sales')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);
  const currentRealCash = baseCash + totalCollectedCash - actualPaidOutflows;

  // DİREKT BORÇ ÖDE (ALARM PANOSUNDAN TEK TIKLA KAPATMA)
  const handlePayDueExpense = async (inv: any) => {
    const amt = cleanNumber(inv.total_amount);
    const confirm = window.confirm(`${inv.invoice_no} (${amt.toLocaleString('tr-TR')} ₺) ödemesini şimdi gerçekleştirmek istiyor musunuz?`);
    if (!confirm) return;

    try {
      const { error } = await supabase.from('invoices').update({ status: 'paid' }).eq('id', inv.id);
      if (error) throw error;
      alert('Ödeme başarıyla kaydedildi ve borç kapatıldı!');
      loadPortalData();
    } catch (err: any) {
      alert('Ödeme hatası: ' + err.message);
    }
  };

  // TAŞERON FATURA DÜZENLEME İŞLEMİ
  const handleOpenEditSubInvoice = (inv: any) => {
    setEditingSubInvoice(inv);
    setSubEditFormData({
      invoiceNo: inv.invoice_no || '',
      totalAmount: String(inv.total_amount || ''),
      issueDate: sanitizeDate(inv.issue_date),
      term1DueDate: sanitizeDate(inv.term1_due_date),
      term1Amount: String(inv.term1_amount || ''),
      term2DueDate: sanitizeDate(inv.term2_due_date),
      term2Amount: String(inv.term2_amount || '')
    });
    setIsEditSubModalOpen(true);
  };

  const handleSaveSubInvoiceEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubInvoice) return;

    try {
      const tot = cleanNumber(subEditFormData.totalAmount);
      let t1 = cleanNumber(subEditFormData.term1Amount);
      let t2 = cleanNumber(subEditFormData.term2Amount);

      if (t1 === 0 && t2 === 0 && tot > 0) {
        t1 = tot / 2;
        t2 = tot / 2;
      }

      const { error } = await supabase
        .from('invoices')
        .update({
          invoice_no: subEditFormData.invoiceNo.trim(),
          total_amount: tot,
          issue_date: subEditFormData.issueDate,
          term1_due_date: subEditFormData.term1DueDate,
          term1_amount: t1,
          term2_due_date: subEditFormData.term2DueDate,
          term2_amount: t2
        })
        .eq('id', editingSubInvoice.id);

      if (error) throw error;
      alert('Alt yüklenici faturası başarıyla güncellendi!');
      setIsEditSubModalOpen(false);
      setEditingSubInvoice(null);
      loadPortalData();
    } catch (err: any) {
      alert('Fatura düzenleme hatası: ' + (err.message || err));
    }
  };

  // BANKA TALİMATI İNDİRME MANTIĞI
  const executeBankExport = () => {
    const subcontractorMap = new Map<string, {
      subcontractor: string;
      dueDate: string;
      totalAmount: number;
      termsIncluded: string[];
    }>();

    dbInvoices
      .filter(i => i.category === 'subcontractor_invoice')
      .forEach(inv => {
        const title = inv.invoice_no;
        const t1Unpaid = inv.term1_status !== 'paid' && cleanNumber(inv.term1_amount) > 0;
        const t2Unpaid = inv.term2_status !== 'paid' && cleanNumber(inv.term2_amount) > 0;

        let amountToAdd = 0;
        const terms: string[] = [];
        let dateToUse = inv.term1_due_date || inv.due_date;

        if (bankExportTermChoice === 'term1' && t1Unpaid) {
          amountToAdd = cleanNumber(inv.term1_amount);
          terms.push('1. Taksit');
          dateToUse = inv.term1_due_date;
        } else if (bankExportTermChoice === 'term2' && t2Unpaid) {
          amountToAdd = cleanNumber(inv.term2_amount);
          terms.push('2. Taksit');
          dateToUse = inv.term2_due_date;
        } else if (bankExportTermChoice === 'both') {
          if (t1Unpaid) {
            amountToAdd += cleanNumber(inv.term1_amount);
            terms.push('1. Taksit');
          }
          if (t2Unpaid) {
            amountToAdd += cleanNumber(inv.term2_amount);
            terms.push('2. Taksit');
            dateToUse = inv.term2_due_date || inv.term1_due_date;
          }
        }

        if (amountToAdd > 0) {
          if (!subcontractorMap.has(title)) {
            subcontractorMap.set(title, {
              subcontractor: title,
              dueDate: dateToUse,
              totalAmount: amountToAdd,
              termsIncluded: terms
            });
          } else {
            const existing = subcontractorMap.get(title)!;
            existing.totalAmount += amountToAdd;
            existing.termsIncluded.push(...terms);
          }
        }
      });

    const exportRows = Array.from(subcontractorMap.values());

    if (exportRows.length === 0) {
      alert('Seçilen taksit kriterine göre henüz borcu kalan bir alt yüklenici kaydı bulunamadı.');
      setIsBankExportModalOpen(false);
      return;
    }

    const excelData = exportRows.map((item, idx) => ({
      'Sıra No': idx + 1,
      'Açıklama / Belge / Taşeron': item.subcontractor,
      'Kapsanan Taksitler': item.termsIncluded.join(' + '),
      'Vade / İşlem Tarihi': item.dueDate,
      'Net Transfer Tutarı (TL)': item.totalAmount,
      'İşlem Tipi': 'EFT/Havale'
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Banka Talimati');
    ws['!cols'] = [{ wch: 8 }, { wch: 45 }, { wch: 22 }, { wch: 18 }, { wch: 25 }, { wch: 15 }];

    const todayStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Banka_Toplu_Odeme_${bankExportTermChoice}_${todayStr}.xlsx`);
    setIsBankExportModalOpen(false);
  };

  // TOPLU HGS GEÇİŞ RAPORU (EXCEL) OKUMA & OTOMATİK PLAKA DAĞITIMI
  const handleImportHgsExcel = async (file: File) => {
    setIsImportingHgsExcel(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        if (!data || data.length === 0) {
          alert('HGS Excel dosyasında geçerli satır bulunamadı.');
          setIsImportingHgsExcel(false);
          return;
        }

        const plateHgsTotals: { [plate: string]: number } = {};
        let totalHgsBrut = 0;

        data.forEach(row => {
          const rawPlate = String(row['Plaka'] || '').trim().replace(/\s+/g, '').toUpperCase();
          const kdvsiz = cleanNumber(row["KDV'siz Geçiş Tutarı (TL)"] || row['kdvsiz_gecis']);
          const brut = cleanNumber(row['İşlem Tutarı (TL)'] || row['islem_tutari']);

          if (rawPlate && kdvsiz > 0) {
            plateHgsTotals[rawPlate] = (plateHgsTotals[rawPlate] || 0) + kdvsiz;
          }
          if (brut > 0) {
            totalHgsBrut += brut;
          }
        });

        setDbProfitability(prev => prev.map(item => {
          const cleanP = item.plate_number.replace(/\s+/g, '').toUpperCase();
          if (plateHgsTotals[cleanP] !== undefined) {
            return {
              ...item,
              hgs_ex_vat: plateHgsTotals[cleanP]
            };
          }
          return item;
        }));

        const todayStr = new Date().toISOString().split('T')[0];
        await supabase.from('invoices').insert([{
          invoice_no: `HGS-${todayStr.slice(0, 7)}`,
          direction: 'incoming',
          category: 'general_hgs',
          total_amount: totalHgsBrut,
          issue_date: todayStr,
          due_date: todayStr,
          status: 'unpaid'
        }]);

        alert(`Başarılı! ${Object.keys(plateHgsTotals).length} adet aracın HGS tutarları dağıtıldı ve ${totalHgsBrut.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL tutarındaki HGS faturası genel giderlere işlendi.`);
        loadPortalData();
      } catch (err: any) {
        alert('HGS aktarım hatası: ' + (err.message || err));
      } finally {
        setIsImportingHgsExcel(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  // PERSONEL KAYDETME
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeFormData.fullName.trim()) return;

    try {
      const payload: any = {
        full_name: employeeFormData.fullName.trim(),
        role_title: employeeFormData.roleTitle.trim(),
        base_salary: cleanNumber(employeeFormData.baseSalary)
      };

      if (employeeFormData.phone.trim()) payload.phone = employeeFormData.phone.trim();
      if (employeeFormData.iban.trim()) payload.iban = employeeFormData.iban.trim();

      const { error } = await supabase.from('employees').insert([payload]);
      if (error) throw error;

      alert('Personel başarıyla kaydedildi!');
      setIsEmployeeModalOpen(false);
      setEmployeeFormData({ fullName: '', roleTitle: 'Tır Kaptanı / Frigo', baseSalary: '', phone: '', iban: '' });
      loadPortalData();
    } catch (err: any) {
      alert('Personel ekleme hatası: ' + err.message);
    }
  };

  // PERSONEL HIZLI AVANS / MASRAF İADESİ ÖDEME
  const handleQuickPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPayTargetEmployee || !quickPayFormData.amount) return;

    try {
      const amt = cleanNumber(quickPayFormData.amount);
      const isExpenseRefund = quickPayFormData.payType === 'expense_refund';
      const todayStr = new Date().toISOString().split('T')[0];

      await supabase.from('advance_payments').insert([{
        target_type: 'employee',
        target_id: quickPayTargetEmployee.full_name,
        target_name: quickPayTargetEmployee.full_name,
        payment_type: isExpenseRefund ? 'expense_refund_paid' : 'advance',
        total_amount: amt,
        total_installments: 1,
        remaining_amount: 0,
        issue_date: todayStr,
        notes: isExpenseRefund ? `Personel Masraf İadesi (${quickPayFormData.paySource === 'cash' ? 'Kasa' : 'Banka'})` : `Maaş Avansı (${quickPayFormData.notes || ''})`
      }]);

      await supabase.from('invoices').insert([{
        invoice_no: `${isExpenseRefund ? 'MASRAF-IADE' : 'AVANS'}-${Date.now().toString().slice(-6)}`,
        direction: 'incoming',
        category: 'salary_payroll',
        total_amount: amt,
        issue_date: todayStr,
        due_date: todayStr,
        status: 'paid'
      }]);

      alert('Ödeme başarıyla işlendi ve kasadan düşürüldü!');
      setIsQuickPayModalOpen(false);
      setQuickPayTargetEmployee(null);
      setQuickPayFormData({ amount: '', payType: 'advance', paySource: 'cash', notes: '' });
      loadPortalData();
    } catch (err: any) {
      alert('İşlem hatası: ' + err.message);
    }
  };

  // ARAÇ KAYDETME / GÜNCELLEME
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

  const openEditVehicleModal = (v: any) => {
    if (!v) return;
    setEditingVehicleId(v.id || null);
    setVehicleFormData({
      plateNumber: v.plate_number || '',
      driverName: v.driver_name || '',
      brandModel: v.brand_model || '',
      documentIncluded: v.document_included || 'VAR',
      trackingSystem: v.tracking_system || 'Var',
      fuelSystem: v.fuel_system || 'UTTS',
      hgsSystem: v.hgs_system || 'SHELL',
      nextInspectionDate: sanitizeDate(v.next_inspection_date),
      insuranceCompany: v.insurance_company || '',
      insuranceDate: sanitizeDate(v.insurance_date),
      vehicleType: v.vehicle_type || 'Kamyon Frigo (10 Palet)',
      ownershipType: v.ownership_type || 'Öz Mal'
    });
    setIsVehicleModalOpen(true);
  };

  // TAKSİT KAPATMA
  const handleMarkInvoicePaid = async (inv: any, term: 1 | 2) => {
    const termAmount = term === 1 ? cleanNumber(inv.term1_amount) : cleanNumber(inv.term2_amount);
    const confirmPay = window.confirm(`${inv.invoice_no} belgesinin ${term}. taksiti olan ${termAmount.toLocaleString('tr-TR')} ₺ ödendi olarak işaretlensin mi?`);
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

  // DİNAMİK İŞLEM / FATURA KAYDI
  const isVehicleExpense = ['vehicle_maintenance', 'vehicle_tire', 'vehicle_insurance', 'vehicle_inspection', 'traffic_fines'].includes(formData.category);

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount) {
      alert('Lütfen tutar girin.');
      return;
    }

    if (isVehicleExpense && !formData.plateNumber) {
      alert('Lütfen bu masraf için ilgili araç plakasını seçiniz.');
      return;
    }

    setIsSaving(true);
    try {
      const parsedAmount = cleanNumber(formData.amount);
      const isCollection = formData.category === 'customer_collection';
      const isPaid = formData.paymentStatus === 'paid' || isCollection;
      
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

      if (formData.paymentStatus === 'paid' && formData.paidSource === 'employee' && formData.paidEmployeeName) {
        await supabase.from('advance_payments').insert([{
          target_type: 'employee',
          target_id: formData.paidEmployeeName,
          target_name: formData.paidEmployeeName,
          payment_type: 'employee_company_expense',
          total_amount: parsedAmount,
          total_installments: 1,
          remaining_amount: parsedAmount,
          issue_date: formData.paymentDate,
          notes: `${formData.category} - ${formData.plateNumber || formData.companyName || ''}`
        }]);
      }

      if (isVehicleExpense && formData.plateNumber) {
        const cleanP = formData.plateNumber.replace(/\s+/g, '').toUpperCase();
        setDbProfitability(prev => prev.map(item => {
          if (item.plate_number.replace(/\s+/g, '').toUpperCase() === cleanP) {
            return {
              ...item,
              other_exp: (item.other_exp || 0) + parsedAmount
            };
          }
          return item;
        }));
      }

      const invNo = formData.invoiceNo || (isCollection ? `THS-${Date.now().toString().slice(-6)}` : `BLG-${Date.now().toString().slice(-6)}`);
      const { error } = await supabase.from('invoices').insert([{
        invoice_no: formData.plateNumber ? `${invNo} [${formData.plateNumber}]` : (formData.companyName ? `${invNo} - ${formData.companyName}` : invNo),
        direction: isCollection ? 'incoming' : 'incoming',
        category: formData.category,
        issue_date: formData.paymentDate,
        due_date: formData.dueDate,
        total_amount: parsedAmount,
        status: isPaid ? 'paid' : 'unpaid',
        document_url: documentUrl
      }]);

      if (error) throw error;

      alert(
        formData.paidSource === 'employee' 
          ? 'Masraf kaydedildi ve personelin "Şirket Harcamaları (+)" alacağına eklendi!' 
          : (isPaid ? 'İşlem ödendi olarak kaydedildi!' : 'Fatura borç olarak kaydedildi!')
      );

      setIsModalOpen(false);
      setSelectedFile(null);
      loadPortalData();
    } catch (err: any) {
      alert('Kayıt hatası: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // YENİ ÖZ MAL ARAÇ KARLILIK SATIRI EKLEME
  const handleSaveProfitabilityRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profitFormData.plateNumber.trim()) {
      alert('Lütfen araç plakası giriniz.');
      return;
    }

    const newRow = {
      id: Date.now(),
      month_year: profitFormData.monthYear.trim(),
      plate_number: profitFormData.plateNumber.trim().toUpperCase(),
      recon_net: cleanNumber(profitFormData.reconNetRevenue),
      invoice_rev: cleanNumber(profitFormData.invoiceRevenue),
      driver_sal: cleanNumber(profitFormData.driverSalary),
      fuel_ex_vat: cleanNumber(profitFormData.fuelExVat),
      hgs_ex_vat: cleanNumber(profitFormData.hgsExVat),
      bonus: cleanNumber(profitFormData.bonus),
      sgk: cleanNumber(profitFormData.sgk),
      other_exp: cleanNumber(profitFormData.otherExpense)
    };

    setDbProfitability([newRow, ...dbProfitability]);
    alert('Araç karlılık dökümü eklendi!');
    setIsProfitModalOpen(false);
    setProfitFormData({
      monthYear: 'Eyl.26',
      plateNumber: '',
      reconNetRevenue: '',
      invoiceRevenue: '',
      driverSalary: '',
      fuelExVat: '',
      hgsExVat: '',
      bonus: '',
      sgk: '',
      otherExpense: ''
    });
  };

  // 360° DRAWER AÇMA FONKSİYONLARI
  const openVehicleDrawer = (plate: string) => {
    const cleanP = plate.replace(/\s+/g, '').toUpperCase();
    const v = dbVehicles.find(x => x.plate_number.replace(/\s+/g, '').toUpperCase() === cleanP) || { plate_number: cleanP };
    setSelectedDrawerEntity(v);
    setDrawerType('vehicle');
  };

  const openEmployeeDrawer = (emp: any) => {
    setSelectedDrawerEntity(emp);
    setDrawerType('employee');
  };

  const openEntityDrawer = (name: string) => {
    setSelectedDrawerEntity({ name });
    setDrawerType('entity');
  };

  // GİRİŞ EKRANI
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl border border-slate-100">
          <div className="text-center mb-8">
            <div className="mb-4 flex items-center justify-center">
              <TazeyolBrand />
            </div>
            <p className="text-xs text-slate-500 mt-2 flex items-center justify-center gap-1">
              <ShieldCheck className="w-4 h-4 text-blue-600" /> Kurumsal Portala Güvenli Giriş
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kullanıcı Adı</label>
              <input 
                type="text" 
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                placeholder="admin veya rapor"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" 
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Şifre</label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" 
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                {loginError}
              </div>
            )}

            <button 
              type="submit" 
              className="w-full py-3 bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold rounded-xl text-sm shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2">
              <Lock className="w-4 h-4" /> Güvenli Giriş Yap
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-400">Tazeyol Soğuk Zincir Lojistiği ERP Sistemi</span>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = currentUserRole === 'admin';

  const menuItems = [
    { id: 'overview', label: 'Genel Görünüm', icon: LayoutDashboard },
    { id: 'subcontractors', label: 'Alt Yüklenici Hakedişleri', badge: dbInvoices.filter(i => i.category === 'subcontractor_invoice').length, icon: Users },
    { id: 'profitability', label: 'Öz Mal Karlılık & Maliyet', badge: dbProfitability.length, icon: BarChart3 },
    { id: 'employees', label: 'Personel & Bordro', badge: dbEmployees.length, icon: UserCheck },
    { id: 'fleet', label: 'Araç Filosu', badge: dbVehicles.length, icon: Truck },
    { id: 'collections', label: 'Müşteri Tahsilatları', badge: dbInvoices.filter(i => i.category === 'customer_collection').length, icon: Coins },
    { id: 'payments', label: 'Banka Talimatı (Excel)', icon: FileSpreadsheet },
    { id: 'general_expenses', label: 'Genel Giderler & Tedarik', icon: Receipt },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      {/* ÜST BAR */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-2 font-bold text-xs shadow-sm">
              <Menu className="w-5 h-5 text-[#009fe3]" />
              <span>MENÜ</span>
            </button>

            <div className="border-l border-slate-200 pl-3">
              <TazeyolBrand />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${isAdmin ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
              {isAdmin ? 'Yönetici (Admin)' : 'Raporör (Sadece Okuma)'}
            </span>
            <button onClick={loadPortalData} title="Verileri Yenile" className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={handleLogout}
              title="Güvenli Çıkış"
              className="p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ÇEKMECE MENÜ */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div 
            onClick={() => setIsSidebarOpen(false)} 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
          />

          <div className="relative w-80 bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <TazeyolBrand />
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {isAdmin && (
              <div className="p-4 border-b border-slate-100 space-y-2 bg-slate-50">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Hızlı İşlemler</span>
                <button 
                  onClick={() => {
                    setIsSidebarOpen(false);
                    setFormData({
                      category: 'general_fuel',
                      companyName: '',
                      plateNumber: '',
                      invoiceNo: '',
                      amount: '',
                      paymentDate: new Date().toISOString().split('T')[0],
                      dueDate: new Date().toISOString().split('T')[0],
                      term1Date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
                      term2Date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
                      paymentStatus: 'unpaid',
                      paidSource: 'cash',
                      paidEmployeeName: ''
                    });
                    setIsModalOpen(true);
                  }}
                  className="w-full py-2.5 px-3 bg-[#009fe3] hover:bg-[#0087c2] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition shadow-sm">
                  <Plus className="w-4 h-4" /> Yeni Fatura / Masraf Girişi
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
            )}

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
                        ? 'bg-blue-50 text-[#009fe3] font-bold border border-blue-200' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}>
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#009fe3]' : 'text-slate-400'}`} />
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
              Tazeyol Soğuk Zincir Lojistiği ERP • v3.0
            </div>
          </div>
        </div>
      )}

      {/* ANA İÇERİK ALANI */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
        
        {/* 1. GENEL GÖRÜNÜM SEKME */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* VADESİ GELEN / GEÇEN DİĞER MASRAFLAR BİLDİRİM PANOSU */}
            {dueExpenseAlerts.length > 0 && (
              <div className="bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-rose-200/60">
                  <div className="flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-rose-600 animate-bounce" />
                    <h3 className="font-bold text-rose-950 text-sm">Vadesi Dolan & Yaklaşan Borç Bildirimleri</h3>
                  </div>
                  <span className="text-[11px] font-bold bg-rose-200 text-rose-900 px-2 py-0.5 rounded-full">
                    {dueExpenseAlerts.length} Bekleyen Borç
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {dueExpenseAlerts.map((alertItem, idx) => {
                    const isOverdue = alertItem.diffDays < 0;
                    const isDueToday = alertItem.diffDays === 0;

                    return (
                      <div key={idx} className="bg-white p-3 rounded-xl border border-rose-100 shadow-xs flex items-center justify-between text-xs">
                        <div className="space-y-0.5 truncate pr-2">
                          <span className="font-bold text-slate-900 block truncate">{alertItem.invoice_no}</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${isOverdue ? 'bg-rose-100 text-rose-700' : (isDueToday ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800')}`}>
                              {isOverdue ? `${Math.abs(alertItem.diffDays)} GÜN GEÇTİ` : (isDueToday ? 'BUGÜN SON GÜN' : `${alertItem.diffDays} GÜN KALDI`)}
                            </span>
                            <span className="text-slate-400 text-[10px]">Vade: {alertItem.due_date}</span>
                          </div>
                        </div>

                        <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="font-bold text-rose-600 text-sm">
                            {cleanNumber(alertItem.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                          </span>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handlePayDueExpense(alertItem)}
                              className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-0.5 rounded flex items-center gap-1 transition">
                              <CheckCircle2 className="w-3 h-3" /> Borcu Öde
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TARİH ARALIĞI FİLTRE ÇUBUĞU */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#009fe3]" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Finansal Veri Filtresi</h3>
                  <span className="text-[11px] text-slate-400">Varsayılan son ay açıktır; dilediğiniz özel aralığı seçebilirsiniz.</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <input 
                  type="date" 
                  value={filterStartDate}
                  onChange={e => setFilterStartDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 font-medium"
                />
                <span className="text-slate-400 font-bold">—</span>
                <input 
                  type="date" 
                  value={filterEndDate}
                  onChange={e => setFilterEndDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 font-medium"
                />
                <button 
                  onClick={() => {
                    const r = getCurrentMonthRange();
                    setFilterStartDate(r.start);
                    setFilterEndDate(r.end);
                  }}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition ml-1">
                  Bu Ay
                </button>
              </div>
            </div>

            {/* 4 ANA FİNANSAL KART */}
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
                  {allTimePendingSalesReceivables.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-slate-400 mt-1 block">
                  Seçilen Dönem Cirosu: {selectedPeriodSalesRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-rose-600 font-semibold tracking-wider uppercase flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Ödenecek Toplam Borçlar
                </span>
                <div className="text-2xl font-bold text-rose-600 mt-2">
                  {totalConsolidatedDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-slate-400 mt-1 block">
                  Tüm Taşeron + Devlet + Gider + Maaş Yükü
                </span>
              </div>

              <div className="bg-[#009fe3] text-white p-5 rounded-2xl shadow-sm">
                <span className="text-xs text-blue-100 font-semibold tracking-wider uppercase flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" /> Güncel Kasa / Banka
                </span>
                <div className="text-2xl font-bold mt-2">
                  {currentRealCash.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-blue-100 mt-1 block">Net Mevcut Nakit Varlık</span>
              </div>
            </div>

            {/* YENİ 3 ALT KIRILIM KARTI */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold text-rose-700 tracking-wider uppercase flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> Devlet Ödemeleri
                </span>
                <div className="text-xl font-bold text-slate-900 mt-1.5">
                  {totalGovernmentPaymentsDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Vergi Borçları, SGK Primleri, Trafik Cezaları</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold text-amber-700 tracking-wider uppercase flex items-center gap-1">
                  <Receipt className="w-3.5 h-3.5" /> Temel Diğer Faturalar
                </span>
                <div className="text-xl font-bold text-slate-900 mt-1.5">
                  {totalGeneralCompanyExpensesDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Şirket Adına Düzenlenen Faturalar (Taşeron Hariç)</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold text-indigo-700 tracking-wider uppercase flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" /> Personel Gelecek Ödemesi
                </span>
                <div className="text-xl font-bold text-slate-900 mt-1.5">
                  {totalEmployeeFutureDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">İşleyen Gün Maaş Tahakkuku ve Hak Edilen Primler</span>
              </div>
            </div>

            {/* İKİ ÖNEMLİ TAKİP KUTUSU */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Yaklaşan Kritik Taşeron Ödemeleri</h3>
                  </div>
                  <button 
                    onClick={() => setActiveTab('subcontractors')}
                    className="text-xs text-[#009fe3] hover:underline font-semibold flex items-center gap-0.5">
                    Tümünü Gör <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2">
                  {dbInvoices
                    .filter(i => i.category === 'subcontractor_invoice' && (i.term1_status !== 'paid' || i.term2_status !== 'paid'))
                    .slice(0, 5)
                    .map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 text-xs">
                        <div 
                          onClick={() => openEntityDrawer(p.invoice_no)}
                          className="cursor-pointer hover:text-blue-600 transition">
                          <span className="font-mono font-bold text-slate-800 block truncate max-w-[240px]">{p.invoice_no}</span>
                          <span className="text-[11px] text-slate-400">Vade: {p.term1_due_date || p.due_date}</span>
                        </div>
                        <span className="font-bold text-rose-600 text-sm">
                          {cleanNumber(p.term1_amount || p.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Muayenesi Yaklaşan Araçlar</h3>
                  </div>
                  <button 
                    onClick={() => setActiveTab('fleet')}
                    className="text-xs text-[#009fe3] hover:underline font-semibold flex items-center gap-0.5">
                    Filoya Git <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2">
                  {dbVehicles
                    .map(v => ({ ...v, daysInfo: calculateDaysLeft(v.next_inspection_date) }))
                    .filter(v => v.daysInfo.diff <= 45)
                    .sort((a, b) => a.daysInfo.diff - b.daysInfo.diff)
                    .slice(0, 5)
                    .map((v, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => openVehicleDrawer(v.plate_number)}
                        title="360° Araç Kartını Aç"
                        className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/70 border border-transparent hover:border-blue-200 text-xs cursor-pointer transition">
                        <div>
                          <span className="font-mono font-bold text-blue-700 block">{v.plate_number}</span>
                          <span className="text-[11px] text-slate-500">{v.driver_name || 'Şoför Atanmadı'} • {v.brand_model || v.vehicle_type}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] ${v.daysInfo.color}`}>
                            {v.daysInfo.text}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. ALT YÜKLENİCİ HAKEDİŞLERİ */}
        {activeTab === 'subcontractors' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider block">
                  Ödenecek Toplam Taşeron Borcu
                </span>
                <div className="text-2xl font-bold text-rose-600 mt-1">
                  {unpaidSubcontractorDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Tüm açık 1. ve 2. vadelere ait kalan bakiye</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider block">
                  Kalan 1. Vade Ödemeleri Toplamı
                </span>
                <div className="text-2xl font-bold text-blue-700 mt-1">
                  {unpaidSubcontractorTerm1Debt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">İlk turda bankadan çıkacak net tutar</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider block">
                  Kalan 2. Vade Ödemeleri Toplamı
                </span>
                <div className="text-2xl font-bold text-purple-700 mt-1">
                  {unpaidSubcontractorTerm2Debt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Gelecek periyotta çıkacak rezerv tutar</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 border-b border-slate-100 gap-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Alt Yüklenici Hakedişleri</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Taşeron mutabakat faturaları, taksit kapatma ve cari geçmiş dökümü.</p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition">
                      <FileSpreadsheet className="w-4 h-4" /> 
                      {isImportingSubcontractors ? 'İşleniyor...' : 'Toplu Taşeron Exceli'}
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
                      onClick={() => {
                        setFormData({
                          category: 'subcontractor_invoice',
                          companyName: '',
                          plateNumber: '',
                          invoiceNo: '',
                          amount: '',
                          paymentDate: new Date().toISOString().split('T')[0],
                          dueDate: new Date().toISOString().split('T')[0],
                          term1Date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
                          term2Date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
                          paymentStatus: 'unpaid',
                          paidSource: 'cash',
                          paidEmployeeName: ''
                        });
                        setIsModalOpen(true);
                      }}
                      className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                      <Plus className="w-4 h-4" /> Yeni Hakediş
                    </button>
                  </div>
                )}
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
                      {isAdmin && <th className="py-3 px-4 text-center">İşlem</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {dbInvoices.filter(i => i.category === 'subcontractor_invoice').map((inv, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td 
                          onClick={() => openEntityDrawer(inv.invoice_no)}
                          className="py-3 px-4 font-mono font-medium text-blue-700 hover:underline cursor-pointer">
                          {inv.invoice_no}
                        </td>
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
                              isAdmin && (
                                <button 
                                  onClick={() => handleMarkInvoicePaid(inv, 1)}
                                  className="text-[10px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 px-1.5 py-0.5 rounded transition">
                                  Öde
                                </button>
                              )
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
                              isAdmin && (
                                <button 
                                  onClick={() => handleMarkInvoicePaid(inv, 2)}
                                  className="text-[10px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 px-1.5 py-0.5 rounded transition">
                                  Öde
                                </button>
                              )
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block">{inv.term2_due_date}</span>
                        </td>

                        {isAdmin && (
                          <td className="py-3 px-4 text-center">
                            <button 
                              onClick={() => handleOpenEditSubInvoice(inv)}
                              className="bg-slate-100 hover:bg-blue-50 text-blue-700 border border-slate-200 font-semibold px-2 py-1 rounded text-[11px] inline-flex items-center gap-1 transition">
                              <Edit2 className="w-3 h-3" /> Düzenle
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 3. ÖZ MAL KARLILIK & MALİYET ANALİZİ (360° PLAKA DETAY TIKLANABİLİR) */}
        {activeTab === 'profitability' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Öz Mal Araç Karlılık & Maliyet Analizi</h3>
                <p className="text-xs text-slate-500 mt-0.5">Plaka bazlı ciro, akaryakıt, şoför ve net kâr marjı dökümü. Plakaya tıklayarak 360° araç sicil kartını açabilirsiniz.</p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                    <FileSpreadsheet className="w-4 h-4 text-[#009fe3]" />
                    {isImportingHgsExcel ? 'Dağıtılıyor...' : 'HGS Raporu Yükle (Excel)'}
                    <input 
                      type="file" 
                      accept=".xlsx,.xls" 
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImportHgsExcel(f);
                      }} 
                      disabled={isImportingHgsExcel}
                      className="hidden" 
                    />
                  </label>
                  <button 
                    onClick={() => setIsProfitModalOpen(true)}
                    className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                    <Plus className="w-4 h-4" /> Yeni Plaka Karlılık Kaydı
                  </button>
                </div>
              )}
            </div>

            {/* FİLO ÖZET KARTLARI */}
            {(() => {
              const totalRev = dbProfitability.reduce((s, r) => s + r.invoice_rev, 0);
              const totalCost = dbProfitability.reduce((s, r) => s + (r.driver_sal + r.fuel_ex_vat + r.hgs_ex_vat + r.bonus + r.sgk + r.other_exp), 0);
              const totalNet = totalRev - totalCost;
              const avgMargin = totalRev > 0 ? (totalNet / totalRev) * 100 : 0;

              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 block">Toplam Kesilen Fatura</span>
                    <span className="font-bold text-slate-900 text-sm">{totalRev.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Toplam Filo Gideri</span>
                    <span className="font-bold text-rose-600 text-sm">-{totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Filo Net Karı</span>
                    <span className="font-bold text-emerald-600 text-sm">+{totalNet.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Ortalama Kar Marjı</span>
                    <span className="font-bold text-blue-700 text-sm">%{avgMargin.toFixed(2)}</span>
                  </div>
                </div>
              );
            })()}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-2">Ay</th>
                    <th className="py-2.5 px-2">Plaka (Detay)</th>
                    <th className="py-2.5 px-2 text-right">Mutabakat Ham</th>
                    <th className="py-2.5 px-2 text-right">Fatura</th>
                    <th className="py-2.5 px-2 text-right">Şoför Maaşı</th>
                    <th className="py-2.5 px-2 text-right">Yakıt (KDV'siz)</th>
                    <th className="py-2.5 px-2 text-right">HGS (KDV'siz)</th>
                    <th className="py-2.5 px-2 text-right">Prim</th>
                    <th className="py-2.5 px-2 text-right">SGK</th>
                    <th className="py-2.5 px-2 text-right">Diğer Gider</th>
                    <th className="py-2.5 px-2 text-right font-bold">Toplam Gider</th>
                    <th className="py-2.5 px-2 text-right font-bold">Kar / Zarar</th>
                    <th className="py-2.5 px-2 text-right font-bold">Marj %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dbProfitability.map((row) => {
                    const totalGider = row.driver_sal + row.fuel_ex_vat + row.hgs_ex_vat + row.bonus + row.sgk + row.other_exp;
                    const karZarar = row.invoice_rev - totalGider;
                    const marj = row.invoice_rev > 0 ? (karZarar / row.invoice_rev) * 100 : 0;

                    return (
                      <tr key={row.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-2 font-medium text-slate-600 whitespace-nowrap">{row.month_year}</td>
                        <td 
                          onClick={() => openVehicleDrawer(row.plate_number)}
                          title="360° Araç Kartını Aç"
                          className="py-2.5 px-2 font-mono font-bold text-blue-700 whitespace-nowrap hover:underline cursor-pointer">
                          {row.plate_number}
                        </td>
                        <td className="py-2.5 px-2 text-right whitespace-nowrap">{row.recon_net.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                        <td className="py-2.5 px-2 text-right font-semibold whitespace-nowrap">{row.invoice_rev.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                        <td className="py-2.5 px-2 text-right whitespace-nowrap">{row.driver_sal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                        <td className="py-2.5 px-2 text-right whitespace-nowrap">{row.fuel_ex_vat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                        <td className="py-2.5 px-2 text-right whitespace-nowrap">{row.hgs_ex_vat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                        <td className="py-2.5 px-2 text-right whitespace-nowrap">{row.bonus > 0 ? row.bonus.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺' : '-'}</td>
                        <td className="py-2.5 px-2 text-right whitespace-nowrap">{row.sgk.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                        <td className="py-2.5 px-2 text-right whitespace-nowrap">{row.other_exp > 0 ? row.other_exp.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺' : '-'}</td>
                        <td className="py-2.5 px-2 text-right font-bold text-rose-600 whitespace-nowrap">{totalGider.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                        <td className={`py-2.5 px-2 text-right font-bold whitespace-nowrap ${karZarar >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {karZarar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-blue-800 whitespace-nowrap">%{marj.toFixed(0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. PERSONEL & BORDRO (360° PERSONEL EKSTRE TIKLANABİLİR) */}
        {activeTab === 'employees' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Personel & Bordro Yönetimi</h3>
                <p className="text-xs text-slate-500 mt-0.5">Sabit maaşlar, şirket harcama iadeleri ve net dökümler. İsme tıklayarak 360° personel ekstresini açabilirsiniz.</p>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => setIsEmployeeModalOpen(true)}
                  className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                  <Plus className="w-4 h-4" /> Yeni Personel Ekle
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Personel Adı Soyadı (Ekstre)</th>
                    <th className="py-3 px-3">Görevi</th>
                    <th className="py-3 px-3 text-right">Sabit Maaş</th>
                    <th className="py-3 px-3 text-right">Şirket Harcamaları (+)</th>
                    <th className="py-3 px-3 text-right">Primler (+)</th>
                    <th className="py-3 px-3 text-right">Avanslar (-)</th>
                    <th className="py-3 px-3 text-right font-bold">Ay Sonu Net Ödenecek</th>
                    {isAdmin && <th className="py-3 px-3 text-center">İşlem</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dbEmployees.map(emp => {
                    const empRecords = dbAdvances.filter(a => a.target_name === emp.full_name && a.target_type === 'employee');
                    const totalAdvances = empRecords.filter(a => a.payment_type === 'advance').reduce((s, a) => s + cleanNumber(a.total_amount), 0);
                    const totalBonuses = empRecords.filter(a => ['bonus', 'special_bonus'].includes(a.payment_type)).reduce((s, a) => s + cleanNumber(a.total_amount), 0);
                    
                    const companyExpensesOwed = empRecords.filter(a => a.payment_type === 'employee_company_expense').reduce((s, a) => s + cleanNumber(a.total_amount), 0);
                    const companyExpensesRefunded = empRecords.filter(a => a.payment_type === 'expense_refund_paid').reduce((s, a) => s + cleanNumber(a.total_amount), 0);
                    const netCompanyExpenseBalance = Math.max(0, companyExpensesOwed - companyExpensesRefunded);

                    const netPayableEndOfMonth = cleanNumber(emp.base_salary) + totalBonuses + netCompanyExpenseBalance - totalAdvances;

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50 transition">
                        <td 
                          onClick={() => openEmployeeDrawer(emp)}
                          title="360° Personel Ekstresini Aç"
                          className="py-3 px-3 font-bold text-blue-700 hover:underline cursor-pointer whitespace-nowrap">
                          {emp.full_name}
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{emp.role_title}</td>
                        <td className="py-3 px-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                          {cleanNumber(emp.base_salary).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-amber-700 whitespace-nowrap">
                          {netCompanyExpenseBalance > 0 ? `+${netCompanyExpenseBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : '-'}
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
                        {isAdmin && (
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <button 
                              onClick={() => {
                                setQuickPayTargetEmployee(emp);
                                setQuickPayFormData({ amount: '', payType: 'advance', paySource: 'cash', notes: '' });
                                setIsQuickPayModalOpen(true);
                              }}
                              className="bg-slate-100 hover:bg-emerald-50 text-emerald-800 border border-slate-200 font-bold px-2 py-1 rounded text-[11px] inline-flex items-center gap-1 transition">
                              <Wallet className="w-3.5 h-3.5" /> Öde / Avans
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
        )}

        {/* 5. ARAÇ FİLOSU (360° PLAKA TIKLANABİLİR) */}
        {activeTab === 'fleet' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Araç Filosu ({dbVehicles.length} Araç)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Sürücü, marka, muayene kalan gün ve otomasyon dökümü. Plakaya tıklayarak sicil kartını açabilirsiniz.</p>
              </div>
              {isAdmin && (
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
                  className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                  <Plus className="w-4 h-4" /> Yeni Araç Ekle
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Plaka (Detay)</th>
                    <th className="py-3 px-3">Sürücü</th>
                    <th className="py-3 px-3">Marka / Model</th>
                    <th className="py-3 px-3">Kasa / Tip</th>
                    <th className="py-3 px-3 text-center">Taşıt Tanıma</th>
                    <th className="py-3 px-3">Sonraki Muayene</th>
                    <th className="py-3 px-3">Muayene Durumu</th>
                    <th className="py-3 px-3">Trafik Sigortası</th>
                    {isAdmin && <th className="py-3 px-3 text-center">İşlem</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dbVehicles.map(v => {
                    const daysInfo = calculateDaysLeft(v.next_inspection_date);
                    return (
                      <tr key={v.id} className="hover:bg-slate-50 transition">
                        <td 
                          onClick={() => openVehicleDrawer(v.plate_number)}
                          title="360° Araç Kartını Aç"
                          className="py-3 px-3 font-mono font-bold text-blue-700 text-sm whitespace-nowrap hover:underline cursor-pointer">
                          {v.plate_number}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">{v.driver_name || '-'}</td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{v.brand_model || '-'}</td>
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap">{v.vehicle_type}</td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${v.fuel_system === 'UTTS' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                            {v.fuel_system || 'UTTS'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{sanitizeDate(v.next_inspection_date) || '-'}</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] ${daysInfo.color}`}>
                            {daysInfo.text}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {v.insurance_company ? `${v.insurance_company} (${sanitizeDate(v.insurance_date) || ''})` : '-'}
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <button 
                              type="button"
                              onClick={() => openEditVehicleModal(v)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition inline-flex items-center gap-1 font-medium cursor-pointer">
                              <Edit2 className="w-3.5 h-3.5" /> Düzenle
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
        )}

        {/* 6. MÜŞTERİ TAHSİLATLARI */}
        {activeTab === 'collections' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Müşteri Tahsilatları</h3>
                <p className="text-xs text-slate-500 mt-0.5">Kasaya ve bankaya giren müşteri tahsilat dökümleri.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase">
                  <tr>
                    <th className="py-3 px-4">Makbuz / Dekont No</th>
                    <th className="py-3 px-4">Tahsilat Tarihi</th>
                    <th className="py-3 px-4">Durum</th>
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
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 text-sm">
                        +{cleanNumber(item.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. BANKA TALİMATI İNDİRME EKRANI */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Banka Toplu Ödeme Talimatı (Excel)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Vadesi gelen alt yüklenici hakedişlerini banka formatında tek tıkla indirin.</p>
              </div>
              <button 
                onClick={() => setIsBankExportModalOpen(true)} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition">
                <FileCheck2 className="w-4 h-4" /> Banka Excel Dosyası İndir
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Bu buton ile 1. taksit, 2. taksit veya her ikisini birden seçebilir; borcu kalan alt yüklenicileri tek satırda birleştirilmiş net tutarlarıyla Excel olarak alabilirsiniz.
            </p>
          </div>
        )}

        {/* 8. GENEL GİDERLER & TEDARİK */}
        {activeTab === 'general_expenses' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Genel Giderler & Tedarik</h3>
                <p className="text-xs text-slate-500 mt-0.5">Toplu yakıt, HGS, hamaliye, araç bakım, SGK ve tedarikçi faturaları.</p>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => {
                    setFormData({
                      category: 'general_fuel',
                      companyName: '',
                      plateNumber: '',
                      invoiceNo: '',
                      amount: '',
                      paymentDate: new Date().toISOString().split('T')[0],
                      dueDate: new Date().toISOString().split('T')[0],
                      term1Date: new Date().toISOString().split('T')[0],
                      term2Date: new Date().toISOString().split('T')[0],
                      paymentStatus: 'unpaid',
                      paidSource: 'cash',
                      paidEmployeeName: ''
                    });
                    setIsModalOpen(true);
                  }} 
                  className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                  <Plus className="w-4 h-4" /> Yeni Fatura / Gider Ekle
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase">
                  <tr>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="
