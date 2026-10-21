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
  Trash2,
  LayoutDashboard,
  Users,
  Coins,
  Receipt,
  FileCheck2,
  UserCheck,
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
  ArrowDownLeft,
  CheckSquare,
  Square,
  CreditCard,
  PhoneCall,
  Search,
  Download
} from 'lucide-react';
import { supabase } from './supabase';
import * as XLSX from 'xlsx';

// KURUMSAL TAZEYOL LOGO + ERP BİLEŞENİ
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

  const isAdmin = currentUserRole === 'admin';

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'subcontractors' | 'sub_ibans' | 'sales_customers' | 'employees' | 'fleet' | 'profitability' | 'collections' | 'credit_cards' | 'payments' | 'general_expenses'>('overview');

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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // KREDİ KARTLARI MODALI
  const [isCreditCardModalOpen, setIsCreditCardModalOpen] = useState(false);
  const [creditCardFormData, setCreditCardFormData] = useState({
    cardName: '',
    bankName: '',
    lastFourDigits: '',
    statementAmount: '',
    minPaymentAmount: '',
    dueDate: ''
  });

  // MANUEL SATIŞ FATURASI GİRİŞ MODALI
  const [isNewSaleModalOpen, setIsNewSaleModalOpen] = useState(false);
  const [newSaleFormData, setNewSaleFormData] = useState({
    customerName: '',
    invoiceNo: '',
    amount: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  });

  // MANUEL TAHSİLAT GİRİŞ MODALI (SATIŞTAN DOĞRUDAN DOLDURULABİLİR)
  const [isNewReceiptModalOpen, setIsNewReceiptModalOpen] = useState(false);
  const [newReceiptFormData, setNewReceiptFormData] = useState({
    customerName: '',
    receiptNo: '',
    amount: '',
    targetAccount: 'bank',
    date: new Date().toISOString().split('T')[0],
    relatedInvoiceId: null as number | null
  });

  // MANUEL KASA/BANKA PARA GİRİŞİ
  const [isCashDepositModalOpen, setIsCashDepositModalOpen] = useState(false);
  const [cashDepositFormData, setCashDepositFormData] = useState({
    depositType: 'partner_capital',
    amount: '',
    targetAccount: 'bank',
    title: '',
    date: new Date().toISOString().split('T')[0]
  });

  // TOPLU PERSONEL MAAŞ ÖDEME MODALI
  const [isBulkSalaryModalOpen, setIsBulkSalaryModalOpen] = useState(false);
  const [bulkSalaryItems, setBulkSalaryItems] = useState<{ [empId: number]: { selected: boolean; amount: string; name: string; role: string; iban: string } }>({});
  const [bulkSalarySource, setBulkSalarySource] = useState<'bank' | 'cash'>('bank');

  // TAŞERON IBAN FORMU
  const [isSubIbanModalOpen, setIsSubIbanModalOpen] = useState(false);
  const [subIbanFormData, setSubIbanFormData] = useState({
    name: '',
    iban: '',
    phone: ''
  });

  // BANKA TALİMATI ÇOKLU SEÇİM VE TAKSİT TERCİHİ
  const [bankExportTermChoice, setBankExportTermChoice] = useState<'term1' | 'term2' | 'both'>('term1');
  const [bankSelectedContractors, setBankSelectedContractors] = useState<{ [key: string]: boolean }>({});

  const [isEditSubModalOpen, setIsEditSubModalOpen] = useState(false);
  const [editingSubInvoice, setEditingSubInvoice] = useState<any>(null);
  const [subEditFormData, setSubEditFormData] = useState({
    invoiceNo: '',
    totalAmount: '',
    issueDate: '',
    term1DueDate: '',
    term1Amount: '',
    term2DueDate: '',
    term2Amount: '',
    advanceAmount: '',
    advanceInstallmentCount: '1'
  });

  const [drawerData, setDrawerData] = useState<{
    isOpen: boolean;
    type: 'vehicle' | 'employee' | 'contractor' | 'customer';
    title: string;
    subtitle?: string;
    items?: any[];
    vehicleSummary?: any;
    meta?: any;
  }>({
    isOpen: false,
    type: 'vehicle',
    title: ''
  });

  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [employeeFormData, setEmployeeFormData] = useState({
    fullName: '',
    roleTitle: 'Tır Kaptanı / Frigo',
    baseSalary: '',
    phone: '',
    iban: ''
  });

  const [isQuickPayModalOpen, setIsQuickPayModalOpen] = useState(false);
  const [quickPayTargetEmployee, setQuickPayTargetEmployee] = useState<any>(null);
  const [quickPayFormData, setQuickPayFormData] = useState({
    amount: '',
    payType: 'advance',
    paySource: 'cash',
    notes: ''
  });

  // ARAÇ MODALI
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
    vehicleType: 'Kamyon Frigo (10 Palet)',
    ownershipType: 'Öz Mal',
    nextInspectionDate: '',
    inspectionCost: '',
    insuranceCompany: '',
    insuranceCost: '',
    insuranceStartDate: '',
    kaskoCompany: '',
    kaskoCost: '',
    kaskoStartDate: '',
    lastMtvCost: ''
  });

  const [dbVehicles, setDbVehicles] = useState<any[]>([]);
  const [dbInvoices, setDbInvoices] = useState<any[]>([]);
  const [dbEmployees, setDbEmployees] = useState<any[]>([]);
  const [dbAdvances, setDbAdvances] = useState<any[]>([]);
  const [dbCreditCards, setDbCreditCards] = useState<any[]>([]);
  const [dbSubcontractors, setDbSubcontractors] = useState<any[]>([]);
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

  const loadPortalData = async () => {
    setLoading(true);
    try {
      const { data: vData } = await supabase.from('vehicles').select('*').order('id', { ascending: true });
      const { data: invData } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
      const { data: empData } = await supabase.from('employees').select('*').order('id', { ascending: true });
      const { data: advData } = await supabase.from('advance_payments').select('*').order('created_at', { ascending: false });
      const { data: ccData } = await supabase.from('credit_cards').select('*').order('due_date', { ascending: true });
      const { data: subData } = await supabase.from('subcontractors').select('*').order('name', { ascending: true });

      if (vData) setDbVehicles(vData);
      if (invData) setDbInvoices(invData);
      if (empData) setDbEmployees(empData);
      if (advData) setDbAdvances(advData);
      if (ccData) setDbCreditCards(ccData);
      if (subData) setDbSubcontractors(subData);
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

  const addOneYear = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  };

  const formatIBAN = (val: string) => {
    let clean = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!clean.startsWith('TR')) clean = 'TR' + clean.replace(/^TR/, '');
    const trPart = clean.substring(0, 2);
    const digitsPart = clean.substring(2).replace(/\D/g, '').substring(0, 24);
    const full = trPart + digitsPart;

    const parts = [];
    for (let i = 0; i < full.length; i += 4) {
      parts.push(full.substring(i, i + 4));
    }
    return parts.join(' ');
  };

  // TAŞERON IBAN EŞLEŞTİRME HARİTASI
  const subIbanMap = useMemo(() => {
    const map = new Map<string, string>();
    dbSubcontractors.forEach(s => {
      if (s.name && s.iban) {
        map.set(s.name.trim().toUpperCase(), s.iban.trim());
      }
    });
    return map;
  }, [dbSubcontractors]);

  // TOPLU ALTYÜKLENİCİ IBAN EXCELİ YÜKLEME
  const handleImportSubIbanExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      const insertRows: any[] = [];
      rawRows.forEach(row => {
        const nameVal = String(row['alt yüklenici'] || row['Alt Yüklenici'] || row['Ad Soyad'] || row['Firma'] || '').trim();
        let ibanVal = String(row['IBAN'] || row['Iban'] || '').trim().replace(/\t/g, '');

        if (nameVal && ibanVal) {
          insertRows.push({
            name: nameVal,
            iban: ibanVal
          });
        }
      });

      if (insertRows.length === 0) {
        alert('Excelde "alt yüklenici" ve "IBAN" sütunları bulunamadı!');
        return;
      }

      const { error } = await supabase.from('subcontractors').upsert(insertRows, { onConflict: 'name' });
      if (error) throw error;

      alert(`${insertRows.length} adet alt yüklenici IBAN bilgisi başarıyla içeri aktarıldı ve güncellendi!`);
      loadPortalData();
    } catch (err: any) {
      alert('IBAN Excel yükleme hatası: ' + err.message);
    }
  };

  // MÜKERRER KAYITLARI ENGELLEYEN AKILLI TAŞERON FATURA EXCELİ YÜKLEME
  const handleImportSubcontractorInvoicesSafe = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      // Sistemdeki mevcut faturaları al
      const existingInvoices = new Set(
        dbInvoices
          .filter(i => i.category === 'subcontractor_invoice')
          .map(i => String(i.invoice_no || '').trim().toUpperCase())
      );

      const newRowsToInsert: any[] = [];
      let skippedCount = 0;

      rawRows.forEach((row: any) => {
        const invNo = String(row['Fatura No'] || row['Fatura Numarası'] || row['Belge No'] || '').trim();
        const subName = String(row['Alt Yüklenici'] || row['Taşeron'] || row['Cari'] || '').trim();
        const totalAmt = cleanNumber(row['Tutar'] || row['Toplam Tutar'] || row['Genel Toplam']);
        const fullTitle = `${invNo} - ${subName}`.trim();

        if (existingInvoices.has(fullTitle.toUpperCase()) || existingInvoices.has(invNo.toUpperCase())) {
          skippedCount++;
        } else if (invNo && totalAmt > 0) {
          const t1 = totalAmt / 2;
          const t2 = totalAmt / 2;
          const today = new Date().toISOString().split('T')[0];

          newRowsToInsert.push({
            invoice_no: fullTitle,
            direction: 'incoming',
            category: 'subcontractor_invoice',
            total_amount: totalAmt,
            issue_date: today,
            term1_due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
            term1_amount: t1,
            term1_status: 'unpaid',
            term2_due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
            term2_amount: t2,
            term2_status: 'unpaid',
            status: 'unpaid'
          });
        }
      });

      if (newRowsToInsert.length > 0) {
        const { error } = await supabase.from('invoices').insert(newRowsToInsert);
        if (error) throw error;
      }

      alert(`İşlem Tamamlandı!\n• ${newRowsToInsert.length} adet yeni fatura eklendi.\n• ${skippedCount} adet fatura sistemde zaten mevcut olduğu için çift kayıt engellendi ve korundu.`);
      loadPortalData();
    } catch (err: any) {
      alert('Excel aktarım hatası: ' + err.message);
    }
  };

  // AKILLI BİLEŞİK ALARMLAR (GECİKEN SATIŞLAR VE BORÇLAR 3'TEN FAZLA İSE TEK ÖZET KART OLUR)
  const alertAnalysis = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayObj = new Date();
    const currentMonth = todayObj.getMonth();

    const overdueSales: any[] = [];
    const pendingDebts: any[] = [];
    const creditCardsAlerts: any[] = [];
    const vehicleAlerts: any[] = [];

    // Geciken Satışlar
    dbInvoices
      .filter(i => (i.category === 'freight_sales' || i.direction === 'outgoing') && i.status !== 'paid' && i.due_date)
      .forEach(s => {
        const diff = Math.ceil((new Date(sanitizeDate(s.due_date)).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 0) overdueSales.push({ ...s, diffDays: diff });
      });

    // Yaklaşan Borçlar
    dbInvoices
      .filter(i => i.status !== 'paid' && !['customer_collection', 'freight_sales', 'cash_deposit'].includes(i.category) && i.due_date)
      .forEach(d => {
        const diff = Math.ceil((new Date(sanitizeDate(d.due_date)).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 3) pendingDebts.push({ ...d, diffDays: diff });
      });

    // Kredi Kartları
    dbCreditCards.forEach(cc => {
      const diff = Math.ceil((new Date(sanitizeDate(cc.due_date)).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
      if (diff <= 3) creditCardsAlerts.push({ ...cc, diffDays: diff });
    });

    // Araç Sigorta / Kasko
    dbVehicles.forEach(v => {
      if (v.insurance_expiry_date) {
        const diff = Math.ceil((new Date(sanitizeDate(v.insurance_expiry_date)).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 15) vehicleAlerts.push({ title: `${v.plate_number} Sigortası Bitiyor`, date: v.insurance_expiry_date, diffDays: diff });
      }
      if (v.kasko_expiry_date) {
        const diff = Math.ceil((new Date(sanitizeDate(v.kasko_expiry_date)).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 15) vehicleAlerts.push({ title: `${v.plate_number} Kaskosu Bitiyor`, date: v.kasko_expiry_date, diffDays: diff });
      }
    });

    return {
      overdueSales,
      pendingDebts,
      creditCardsAlerts,
      vehicleAlerts,
      isMtvPeriod: currentMonth === 0 || currentMonth === 6
    };
  }, [dbInvoices, dbCreditCards, dbVehicles]);

  // FİNANSAL HESAPLAMALAR
  const isDateInRange = (dateStr: string | null) => {
    if (!dateStr) return true;
    const d = sanitizeDate(dateStr);
    if (!filterStartDate && !filterEndDate) return true;
    if (filterStartDate && d < filterStartDate) return false;
    if (filterEndDate && d > filterEndDate) return false;
    return true;
  };

  const filteredInvoices = dbInvoices.filter(i => isDateInRange(i.issue_date || i.created_at));

  const totalPeriodSalesRevenue = filteredInvoices
    .filter(i => i.direction === 'outgoing' || i.category === 'freight_sales')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const totalCollectedCash = filteredInvoices
    .filter(i => i.category === 'customer_collection')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const allTimeSalesRevenue = dbInvoices
    .filter(i => i.direction === 'outgoing' || i.category === 'freight_sales')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const allTimeCollectedCash = dbInvoices
    .filter(i => i.category === 'customer_collection')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const pendingReceivablesAllTime = Math.max(0, allTimeSalesRevenue - allTimeCollectedCash);

  let unpaidSubcontractorDebt = 0;
  dbInvoices
    .filter(i => i.category === 'subcontractor_invoice')
    .forEach(inv => {
      const t1 = cleanNumber(inv.term1_amount || (inv.total_amount / 2));
      const t2 = cleanNumber(inv.term2_amount || (inv.total_amount / 2));
      if (inv.term1_status !== 'paid') unpaidSubcontractorDebt += t1;
      if (inv.term2_status !== 'paid') unpaidSubcontractorDebt += t2;
    });

  const totalGovernmentPaymentsDebt = dbInvoices
    .filter(i => i.status !== 'paid' && ['taxes_sgk', 'traffic_fines'].includes(i.category))
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const totalGeneralCompanyExpensesDebt = dbInvoices
    .filter(i => i.status !== 'paid' && !['subcontractor_invoice', 'customer_collection', 'freight_sales', 'taxes_sgk', 'traffic_fines', 'salary_payroll', 'cash_deposit'].includes(i.category))
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const totalPeriodPaidExpenses = filteredInvoices
    .filter(i => i.status === 'paid' && !['customer_collection', 'freight_sales', 'cash_deposit'].includes(i.category))
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const totalConsolidatedDebt = unpaidSubcontractorDebt + totalGovernmentPaymentsDebt + totalGeneralCompanyExpensesDebt;

  const baseCash = 845200;
  const manualCashDeposits = dbInvoices
    .filter(i => i.category === 'cash_deposit')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const actualPaidOutflows = dbInvoices
    .filter(i => i.status === 'paid' && !['customer_collection', 'freight_sales', 'cash_deposit'].includes(i.category))
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const currentRealCash = baseCash + totalCollectedCash + manualCashDeposits - actualPaidOutflows;

  // MÜŞTERİ BAZLI GRUPLAMA (SATIŞLAR & BAKİYELER)
  const customersSummary = useMemo(() => {
    const map = new Map<string, { totalSales: number; totalCollected: number; invoices: any[] }>();

    dbInvoices
      .filter(i => i.category === 'freight_sales' || i.direction === 'outgoing')
      .forEach(inv => {
        let cust = 'Diğer Müşteri';
        const str = String(inv.invoice_no || '');
        if (str.includes(' - ')) cust = str.split(' - ')[1].trim();
        else if (str.toUpperCase().includes('MİGROS') || str.toUpperCase().includes('MIGROS')) cust = 'MİGROS TİCARET A.Ş.';
        else cust = str;

        if (!map.has(cust)) map.set(cust, { totalSales: 0, totalCollected: 0, invoices: [] });
        const cur = map.get(cust)!;
        cur.totalSales += cleanNumber(inv.total_amount);
        cur.invoices.push(inv);
      });

    return Array.from(map.entries()).map(([name, data]) => ({
      customerName: name,
      totalSales: data.totalSales,
      pendingBalance: data.totalSales,
      invoices: data.invoices
    }));
  }, [dbInvoices]);

  // BANKA TALİMATI İÇİN TAŞERON BAZLI OTOMATİK TOPLAMA VE IBAN EŞLEŞTİRME
  const bankPaymentGroupedList = useMemo(() => {
    const map = new Map<string, { contractorName: string; totalAmount: number; invoiceNos: string[]; iban: string }>();

    dbInvoices
      .filter(i => i.category === 'subcontractor_invoice')
      .forEach(inv => {
        const fullTitle = String(inv.invoice_no || '');
        const contractorName = fullTitle.includes(' - ') ? fullTitle.split(' - ')[1].trim() : fullTitle;
        const key = contractorName.toUpperCase();

        const t1 = cleanNumber(inv.term1_amount || (inv.total_amount / 2));
        const t2 = cleanNumber(inv.term2_amount || (inv.total_amount / 2));

        let amountToAdd = 0;
        if (bankExportTermChoice === 'term1' && inv.term1_status !== 'paid') amountToAdd = t1;
        else if (bankExportTermChoice === 'term2' && inv.term2_status !== 'paid') amountToAdd = t2;
        else if (bankExportTermChoice === 'both') {
          if (inv.term1_status !== 'paid') amountToAdd += t1;
          if (inv.term2_status !== 'paid') amountToAdd += t2;
        }

        if (amountToAdd > 0) {
          if (!map.has(key)) {
            const foundIban = subIbanMap.get(key) || 'IBAN Eksik';
            map.set(key, { contractorName, totalAmount: 0, invoiceNos: [], iban: foundIban });
          }
          const cur = map.get(key)!;
          cur.totalAmount += amountToAdd;
          cur.invoiceNos.push(inv.invoice_no);
        }
      });

    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [dbInvoices, bankExportTermChoice, subIbanMap]);

  // SEÇİLİ TAŞERONLARIN BANKA EXCEL ÇIKTISINI ALMA
  const handleDownloadBankExcel = () => {
    const selectedRows = bankPaymentGroupedList.filter(item => bankSelectedContractors[item.contractorName] !== false);
    if (selectedRows.length === 0) {
      alert('Lütfen listenden en az bir alt yüklenici seçiniz!');
      return;
    }

    const excelData = selectedRows.map(item => ({
      'Alıcı Unvanı': item.contractorName,
      'IBAN': item.iban,
      'Ödeme Tutarı (TL)': item.totalAmount,
      'Açıklama': `Tazeyol Lojistik Hakediş Ödemesi (${item.invoiceNos.length} Belge)`
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Toplu Odeme');
    XLSX.writeFile(workbook, `Tazeyol_Banka_Odeme_Talimati_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // DOĞRUDAN SATIŞ FATURASINDAN TAHSİLAT AÇMA
  const handleOpenReceiptFromSale = (saleInvoice: any) => {
    let cust = 'Müşteri';
    const str = String(saleInvoice.invoice_no || '');
    if (str.includes(' - ')) cust = str.split(' - ')[1].trim();

    setNewReceiptFormData({
      customerName: cust,
      receiptNo: `THS-${saleInvoice.invoice_no}`,
      amount: String(saleInvoice.total_amount || ''),
      targetAccount: 'bank',
      date: new Date().toISOString().split('T')[0],
      relatedInvoiceId: saleInvoice.id
    });
    setIsNewReceiptModalOpen(true);
  };

  // TAHSİLAT KAYDETME (FATURAYI OTOMATİK KAPATIR)
  const handleSaveNewReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = cleanNumber(newReceiptFormData.amount);
    if (amt <= 0) {
      alert('Lütfen tutar giriniz.');
      return;
    }

    try {
      const recTitle = `THS - ${newReceiptFormData.customerName || 'Müşteri'} (${newReceiptFormData.targetAccount === 'bank' ? 'Banka' : 'Kasa'})`;
      
      const { error: insErr } = await supabase.from('invoices').insert([{
        invoice_no: recTitle,
        direction: 'incoming',
        category: 'customer_collection',
        total_amount: amt,
        issue_date: newReceiptFormData.date,
        due_date: newReceiptFormData.date,
        status: 'paid'
      }]);

      if (insErr) throw insErr;

      // Eğer belirli bir faturadan tahsil edildiyse o faturayı kapat
      if (newReceiptFormData.relatedInvoiceId) {
        await supabase.from('invoices').update({ status: 'paid' }).eq('id', newReceiptFormData.relatedInvoiceId);
      }

      alert('Tahsilat başarıyla kaydedildi ve kasa/banka hesabına yansıtıldı!');
      setIsNewReceiptModalOpen(false);
      loadPortalData();
    } catch (err: any) {
      alert('Tahsilat hatası: ' + err.message);
    }
  };

  // PERSONEL MAAŞ VE AVANS İŞLEMLERİ
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeFormData.fullName.trim()) return;

    try {
      const { error } = await supabase.from('employees').insert([{
        full_name: employeeFormData.fullName.trim(),
        role_title: employeeFormData.roleTitle,
        base_salary: cleanNumber(employeeFormData.baseSalary),
        phone: employeeFormData.phone,
        iban: employeeFormData.iban
      }]);
      if (error) throw error;
      alert('Personel kaydedildi!');
      setIsEmployeeModalOpen(false);
      loadPortalData();
    } catch (err: any) {
      alert('Personel kayıt hatası: ' + err.message);
    }
  };

  const handleOpenBulkSalaryModal = () => {
    const items: any = {};
    dbEmployees.forEach(emp => {
      items[emp.id] = {
        selected: true,
        amount: String(emp.base_salary || 0),
        name: emp.full_name,
        role: emp.role_title,
        iban: emp.iban || 'Belirtilmedi'
      };
    });
    setBulkSalaryItems(items);
    setIsBulkSalaryModalOpen(true);
  };

  const handleExecuteBulkSalaryPay = async () => {
    if (!isAdmin) return;
    const selectedIds = Object.keys(bulkSalaryItems).filter(id => bulkSalaryItems[Number(id)].selected);
    if (selectedIds.length === 0) {
      alert('Lütfen en az bir personel seçiniz.');
      return;
    }

    const totalBulkAmount = selectedIds.reduce((sum, id) => sum + cleanNumber(bulkSalaryItems[Number(id)].amount), 0);
    const confirm = window.confirm(`Seçilen ${selectedIds.length} personelin toplam ${totalBulkAmount.toLocaleString('tr-TR')} ₺ maaş ödemesi ${bulkSalarySource === 'bank' ? 'Banka Hesabından' : 'Elden Kasa'} çıkılsın mı?`);
    if (!confirm) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const invInserts = selectedIds.map(id => ({
        invoice_no: `MAAŞ - ${bulkSalaryItems[Number(id)].name} (${bulkSalarySource === 'bank' ? 'Banka' : 'Kasa'})`,
        direction: 'incoming',
        category: 'salary_payroll',
        total_amount: cleanNumber(bulkSalaryItems[Number(id)].amount),
        issue_date: today,
        due_date: today,
        status: 'paid'
      }));

      const { error } = await supabase.from('invoices').insert(invInserts);
      if (error) throw error;

      alert('Toplu maaş ödemeleri başarıyla kasadan düşüldü ve ödendi!');
      setIsBulkSalaryModalOpen(false);
      loadPortalData();
    } catch (err: any) {
      alert('Maaş ödeme hatası: ' + err.message);
    }
  };

  const menuItems = [
    { id: 'overview', label: 'Genel Görünüm', icon: LayoutDashboard },
    { id: 'sales_customers', label: 'Satış & Müşteriler', badge: customersSummary.length, icon: TrendingUp },
    { id: 'subcontractors', label: 'Alt Yüklenici Hakedişleri', badge: dbInvoices.filter(i => i.category === 'subcontractor_invoice').length, icon: Users },
    { id: 'sub_ibans', label: 'Taşeron IBAN Yönetimi', badge: dbSubcontractors.length, icon: Wallet },
    { id: 'payments', label: 'Banka Ödeme Talimatı', icon: FileCheck2 },
    { id: 'employees', label: 'Personel & Bordro', badge: dbEmployees.length, icon: UserCheck },
    { id: 'credit_cards', label: 'Kredi Kartları', badge: dbCreditCards.length, icon: CreditCard },
    { id: 'fleet', label: 'Araç Filosu', badge: dbVehicles.length, icon: Truck },
    { id: 'profitability', label: 'Öz Mal Karlılık & Maliyet', badge: dbProfitability.length, icon: BarChart3 },
    { id: 'collections', label: 'Müşteri Tahsilatları', badge: dbInvoices.filter(i => i.category === 'customer_collection').length, icon: Coins },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
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
            <button onClick={handleLogout} title="Güvenli Çıkış" className="p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* MENÜ DRAWER */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative w-80 bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <TazeyolBrand />
              <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="p-3 space-y-1 flex-1 overflow-y-auto text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block px-3 py-1">Tüm Modüller</span>
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
                      isActive ? 'bg-blue-50 text-[#009fe3] font-bold border border-blue-200' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
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
              Tazeyol ERP v3.2 • Cold Chain Logistics
            </div>
          </div>
        </div>
      )}

      {/* ANA GÖVDE */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
        {/* 1. GENEL GÖRÜNÜM (SADE ALARMLI VE KARTLI) */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* SADE VE DERLİ TOPLU ALARM PANOSU */}
            {(alertAnalysis.overdueSales.length > 0 || alertAnalysis.pendingDebts.length > 0 || alertAnalysis.creditCardsAlerts.length > 0) && (
              <div className="bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-rose-200/60">
                  <div className="flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-rose-600 animate-bounce" />
                    <h3 className="font-bold text-rose-950 text-sm">Finansal Hatırlatma & Kritik Uyarılar</h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* GECİKEN MÜŞTERİ SATIŞLARI ÖZET KARTI */}
                  {alertAnalysis.overdueSales.length > 0 && (
                    <div 
                      onClick={() => setActiveTab('sales_customers')}
                      className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-xs cursor-pointer hover:bg-amber-50/50 transition">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-amber-900 flex items-center gap-1.5">
                          <PhoneCall className="w-4 h-4 text-amber-600" /> Geciken Müşteri Tahsilatları
                        </span>
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {alertAnalysis.overdueSales.length} Fatura
                        </span>
                      </div>
                      <div className="mt-2 flex justify-between items-baseline">
                        <span className="text-[11px] text-slate-500">Müşteriyi arayınız</span>
                        <span className="text-base font-bold text-amber-700">
                          {alertAnalysis.overdueSales.reduce((s, i) => s + cleanNumber(i.total_amount), 0).toLocaleString('tr-TR')} ₺
                        </span>
                      </div>
                    </div>
                  )}

                  {/* YAKLAŞAN / GEÇEN BORÇLAR ÖZET KARTI */}
                  {alertAnalysis.pendingDebts.length > 0 && (
                    <div 
                      onClick={() => setActiveTab('subcontractors')}
                      className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-xs cursor-pointer hover:bg-rose-50/50 transition">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-rose-900 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-rose-600" /> Yaklaşan Borç Ödemeleri
                        </span>
                        <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {alertAnalysis.pendingDebts.length} Fatura
                        </span>
                      </div>
                      <div className="mt-2 flex justify-between items-baseline">
                        <span className="text-[11px] text-slate-500">3 gün içinde ödenecek</span>
                        <span className="text-base font-bold text-rose-700">
                          {alertAnalysis.pendingDebts.reduce((s, i) => s + cleanNumber(i.total_amount), 0).toLocaleString('tr-TR')} ₺
                        </span>
                      </div>
                    </div>
                  )}

                  {/* KREDİ KARTLARI SON GÜN UYARISI */}
                  {alertAnalysis.creditCardsAlerts.length > 0 && (
                    <div 
                      onClick={() => setActiveTab('credit_cards')}
                      className="bg-white p-3.5 rounded-xl border border-purple-200 shadow-xs cursor-pointer hover:bg-purple-50/50 transition">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-purple-900 flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-purple-600" /> Kredi Kartı Ekstre Uyarısı
                        </span>
                        <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {alertAnalysis.creditCardsAlerts.length} Kart
                        </span>
                      </div>
                      <div className="mt-2 flex justify-between items-baseline">
                        <span className="text-[11px] text-slate-500">Son gün yaklaştı</span>
                        <span className="text-base font-bold text-purple-700">
                          {alertAnalysis.creditCardsAlerts.reduce((s, i) => s + cleanNumber(i.statement_amount), 0).toLocaleString('tr-TR')} ₺
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ANA FİNANSAL 4 KART */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-emerald-600 font-semibold tracking-wider uppercase flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5" /> Alınan Tahsilatlar
                </span>
                <div className="text-2xl font-bold text-emerald-600 mt-2">
                  +{totalCollectedCash.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-slate-400 mt-1 block">Kasaya Fiilen Giren Müşteri Parası</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-blue-600 font-semibold tracking-wider uppercase flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Bekleyen Müşteri Alacakları
                </span>
                <div className="text-2xl font-bold text-slate-900 mt-2">
                  {pendingReceivablesAllTime.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-slate-400 mt-1 block">Seçilen Dönem Cirosu: {totalPeriodSalesRevenue.toLocaleString('tr-TR')} ₺</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-rose-600 font-semibold tracking-wider uppercase flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Ödenecek Toplam Borçlar
                </span>
                <div className="text-2xl font-bold text-rose-600 mt-2">
                  {totalConsolidatedDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-slate-400 mt-1 block">Açık Taşeron + Devlet + Tedarik</span>
              </div>

              <div className="bg-[#009fe3] text-white p-5 rounded-2xl shadow-sm">
                <span className="text-xs text-blue-100 font-semibold tracking-wider uppercase flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" /> Güncel Kasa / Banka
                </span>
                <div className="text-2xl font-bold mt-2">
                  {currentRealCash.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-blue-100 mt-1 block">Net Kullanılabilir Nakit</span>
              </div>
            </div>
          </div>
        )}

        {/* 2. PERSONEL & BORDRO (ARTI EKSİK KALMAYAN TAM EKRAN) */}
        {activeTab === 'employees' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Personel & Maaş Yönetimi ({dbEmployees.length} Personel)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Maaş takibi, IBAN dökümleri ve tek tıkla toplu maaş ödeme.</p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleOpenBulkSalaryModal}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                    <CheckSquare className="w-4 h-4" /> Toplu Maaş Öde (Seçimli)
                  </button>
                  <button 
                    onClick={() => setIsEmployeeModalOpen(true)}
                    className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                    <Plus className="w-4 h-4" /> Yeni Personel Ekle
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Adı Soyadı</th>
                    <th className="py-3 px-3">Görevi</th>
                    <th className="py-3 px-3">IBAN Bilgisi</th>
                    <th className="py-3 px-3 text-right">Aylık Sabit Maaş</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dbEmployees.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 font-bold text-slate-900 text-sm">{emp.full_name}</td>
                      <td className="py-3 px-3 font-medium text-slate-600">{emp.role_title}</td>
                      <td className="py-3 px-3 font-mono text-slate-700">{emp.iban || 'Belirtilmedi'}</td>
                      <td className="py-3 px-3 text-right font-bold text-indigo-700 text-sm">
                        {cleanNumber(emp.base_salary).toLocaleString('tr-TR')} ₺
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. SATIŞ & MÜŞTERİLER (TEK TIKLA TAHSİLAT BUTONLU) */}
        {activeTab === 'sales_customers' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Müşteri Satış & Cari Takip</h3>
                <p className="text-xs text-slate-500 mt-0.5">Müşteri ciroları ve doğrudan faturadan tahsilat kapama.</p>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => setIsNewSaleModalOpen(true)}
                  className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                  <Plus className="w-4 h-4" /> Manuel Satış Faturası Ekle
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Müşteri / Firma Adı</th>
                    <th className="py-3 px-3 text-center">Fatura Adedi</th>
                    <th className="py-3 px-3 text-right">Toplam Satış Tutarı</th>
                    <th className="py-3 px-3 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customersSummary.map((cust, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 font-bold text-blue-700 text-sm">{cust.customerName}</td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-600">{cust.invoices.length} Adet</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 text-sm">
                        {cust.totalSales.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button 
                          onClick={() => {
                            setDrawerData({
                              isOpen: true,
                              type: 'customer',
                              title: cust.customerName,
                              subtitle: `Toplam Ciro: ${cust.totalSales.toLocaleString('tr-TR')} ₺`,
                              items: [{ label: 'Açık Satış Faturaları', data: cust.invoices }]
                            });
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-blue-700 font-semibold rounded text-[11px] transition">
                          Faturaları İncele
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. TAŞERON IBAN YÖNETİMİ (TOPLU EXCEL VE LİSTE) */}
        {activeTab === 'sub_ibans' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Alt Yüklenici IBAN Veritabanı ({dbSubcontractors.length} Kayıt)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Banka toplu ödeme talimatında otomatik eşleşecek IBAN kayıtları.</p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                    <FileUp className="w-4 h-4" /> IBAN Exceli Yükle
                    <input type="file" accept=".xlsx,.xls" onChange={handleImportSubIbanExcel} className="hidden" />
                  </label>
                  <button 
                    onClick={() => setIsSubIbanModalOpen(true)}
                    className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                    <Plus className="w-4 h-4" /> Tekil IBAN Ekle
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Alt Yüklenici Adı</th>
                    <th className="py-3 px-3">Kayıtlı IBAN Numarası</th>
                    {isAdmin && <th className="py-3 px-3 text-center">İşlem</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dbSubcontractors.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 font-bold text-slate-800 text-sm">{s.name}</td>
                      <td className="py-3 px-3 font-mono font-medium text-blue-700">{s.iban}</td>
                      {isAdmin && (
                        <td className="py-3 px-3 text-center">
                          <button 
                            onClick={async () => {
                              if (window.confirm(`${s.name} kaydını silmek istiyor musunuz?`)) {
                                await supabase.from('subcontractors').delete().eq('id', s.id);
                                loadPortalData();
                              }
                            }}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. BANKA ÖDEME TALİMATI (İNTERAKTİF, TOPLAYAN VE EXCEL ÇIKARAN) */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Banka Toplu Ödeme Talimatı (Excel)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Taksit seçin, tutarları otomatik toplayın ve banka transfer dosyasını indirin.</p>
              </div>

              {isAdmin && (
                <button 
                  onClick={handleDownloadBankExcel}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition">
                  <Download className="w-4 h-4" /> Seçilenleri Banka Exceli Olarak İndir
                </button>
              )}
            </div>

            {/* TAKSİT TERCİH BUTONLARI */}
            <div className="flex items-center gap-2 pb-2">
              <span className="text-xs font-bold text-slate-600">Ödenecek Vade Seçimi:</span>
              <button 
                onClick={() => setBankExportTermChoice('term1')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${bankExportTermChoice === 'term1' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'}`}>
                Sadece 1. Vade
              </button>
              <button 
                onClick={() => setBankExportTermChoice('term2')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${bankExportTermChoice === 'term2' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'}`}>
                Sadece 2. Vade
              </button>
              <button 
                onClick={() => setBankExportTermChoice('both')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${bankExportTermChoice === 'both' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'}`}>
                1. ve 2. Vade Birlikte
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 text-center w-10">Seç</th>
                    <th className="py-3 px-3">Alt Yüklenici Adı</th>
                    <th className="py-3 px-3">Kayıtlı IBAN</th>
                    <th className="py-3 px-3 text-right">Net Ödenecek Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bankPaymentGroupedList.map((item, idx) => {
                    const isChecked = bankSelectedContractors[item.contractorName] !== false;
                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-3 text-center">
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => setBankSelectedContractors({ ...bankSelectedContractors, [item.contractorName]: e.target.checked })}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900 text-sm">{item.contractorName}</td>
                        <td className={`py-3 px-3 font-mono ${item.iban === 'IBAN Eksik' ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                          {item.iban}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-600 text-sm">
                          {item.totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. ALT YÜKLENİCİ HAKEDİŞLERİ (MÜKERRER KORUMALI EXCEL YÜKLEME VE SİL BUTONLU) */}
        {activeTab === 'subcontractors' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Alt Yüklenici Hakedişleri</h3>
                <p className="text-xs text-slate-500 mt-0.5">Fatura takibi, taksit kapama ve tek tek kayıt silme.</p>
              </div>
              {isAdmin && (
                <label className="cursor-pointer bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                  <FileUp className="w-4 h-4" /> Taşeron Fatura Exceli Yükle (Mükerrer Korumalı)
                  <input type="file" accept=".xlsx,.xls" onChange={handleImportSubcontractorInvoicesSafe} className="hidden" />
                </label>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Fatura No / Taşeron</th>
                    <th className="py-3 px-3">Tarih</th>
                    <th className="py-3 px-3">Toplam Tutar</th>
                    <th className="py-3 px-3">1. Vade</th>
                    <th className="py-3 px-3">2. Vade</th>
                    {isAdmin && <th className="py-3 px-3 text-center">İşlem</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dbInvoices.filter(i => i.category === 'subcontractor_invoice').map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 font-mono font-medium text-slate-800">{inv.invoice_no}</td>
                      <td className="py-3 px-3 text-slate-500">{inv.issue_date}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{cleanNumber(inv.total_amount).toLocaleString('tr-TR')} ₺</td>
                      <td className="py-3 px-3 text-blue-700 font-semibold">{cleanNumber(inv.term1_amount).toLocaleString('tr-TR')} ₺</td>
                      <td className="py-3 px-3 text-blue-700 font-semibold">{cleanNumber(inv.term2_amount).toLocaleString('tr-TR')} ₺</td>
                      {isAdmin && (
                        <td className="py-3 px-3 text-center space-x-1">
                          <button 
                            onClick={() => {
                              setEditingSubInvoice(inv);
                              setSubEditFormData({
                                invoiceNo: inv.invoice_no || '',
                                totalAmount: String(inv.total_amount || ''),
                                issueDate: sanitizeDate(inv.issue_date),
                                term1DueDate: sanitizeDate(inv.term1_due_date),
                                term1Amount: String(inv.term1_amount || ''),
                                term2DueDate: sanitizeDate(inv.term2_due_date),
                                term2Amount: String(inv.term2_amount || ''),
                                advanceAmount: '',
                                advanceInstallmentCount: '1'
                              });
                              setIsEditSubModalOpen(true);
                            }}
                            className="bg-slate-100 hover:bg-blue-50 text-blue-700 border border-slate-200 font-semibold px-2 py-1 rounded text-[11px] inline-flex items-center gap-1 transition">
                            <Edit2 className="w-3 h-3" /> Düzenle
                          </button>
                          <button 
                            onClick={async () => {
                              if (window.confirm(`${inv.invoice_no} faturasını silmek istiyor musunuz?`)) {
                                await supabase.from('invoices').delete().eq('id', inv.id);
                                loadPortalData();
                              }
                            }}
                            className="bg-slate-100 hover:bg-rose-50 text-rose-700 border border-slate-200 font-semibold px-2 py-1 rounded text-[11px] inline-flex items-center gap-1 transition">
                            <Trash2 className="w-3 h-3" /> Sil
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: TOPLU MAAŞ ÖDEME */}
      {isBulkSalaryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Toplu Personel Maaş Ödemesi</h3>
              <button onClick={() => setIsBulkSalaryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-3 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Ödeme Kaynağı:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBulkSalarySource('bank')}
                  className={`px-3 py-1.5 rounded-lg border font-bold transition ${bulkSalarySource === 'bank' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200'}`}>
                  🏦 Banka Hesabı
                </button>
                <button
                  type="button"
                  onClick={() => setBulkSalarySource('cash')}
                  className={`px-3 py-1.5 rounded-lg border font-bold transition ${bulkSalarySource === 'cash' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200'}`}>
                  💵 Elden Nakit (Kasa)
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 py-2">
              {Object.keys(bulkSalaryItems).map(idStr => {
                const id = Number(idStr);
                const item = bulkSalaryItems[id];
                return (
                  <div key={id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs gap-3">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox"
                        checked={item.selected}
                        onChange={e => setBulkSalaryItems({ ...bulkSalaryItems, [id]: { ...item, selected: e.target.checked } })}
                        className="w-4 h-4 rounded text-blue-600"
                      />
                      <div>
                        <span className="font-bold text-slate-900 block">{item.name}</span>
                        <span className="text-[10px] text-slate-400">{item.role}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-[10px]">Ödenecek:</span>
                      <input 
                        type="text"
                        value={item.amount}
                        onChange={e => setBulkSalaryItems({ ...bulkSalaryItems, [id]: { ...item, amount: e.target.value } })}
                        className="w-24 px-2 py-1 border border-slate-200 rounded bg-white font-bold text-right text-indigo-700"
                      />
                      <span>₺</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex gap-3">
              <button type="button" onClick={() => setIsBulkSalaryModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200 text-xs">İptal</button>
              <button type="button" onClick={handleExecuteBulkSalaryPay} className="w-1/2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                Maaşları Öde ve Kasadan Düş
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TEKİL TAŞERON IBAN EKLE */}
      {isSubIbanModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Alt Yüklenici IBAN Kaydet</h3>
              <button onClick={() => setIsSubIbanModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={async e => {
              e.preventDefault();
              if (!subIbanFormData.name || !subIbanFormData.iban) return;
              try {
                const { error } = await supabase.from('subcontractors').upsert([{
                  name: subIbanFormData.name.trim(),
                  iban: formatIBAN(subIbanFormData.iban)
                }], { onConflict: 'name' });
                if (error) throw error;
                alert('IBAN başarıyla kaydedildi!');
                setIsSubIbanModalOpen(false);
                loadPortalData();
              } catch (err: any) {
                alert('Hata: ' + err.message);
              }
            }} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alt Yüklenici Adı Soyadı / Unvanı</label>
                <input 
                  type="text"
                  placeholder="Örn: Ahmet Aksu"
                  value={subIbanFormData.name}
                  onChange={e => setSubIbanFormData({ ...subIbanFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">TR IBAN Numarası</label>
                <input 
                  type="text"
                  placeholder="TR87 0006 ..."
                  value={subIbanFormData.iban}
                  onChange={e => setSubIbanFormData({ ...subIbanFormData, iban: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-medium"
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsSubIbanModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-blue-600 text-white font-medium">IBAN'ı Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER: MÜŞTERİ SATIŞ FATURALARINI İNCELE VE TEK TIKLA TAHSİLAT YAP */}
      {drawerData.isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div onClick={() => setDrawerData({ ...drawerData, isOpen: false })} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">{drawerData.title}</h3>
                {drawerData.subtitle && <p className="text-xs text-slate-500 mt-0.5">{drawerData.subtitle}</p>}
              </div>
              <button onClick={() => setDrawerData({ ...drawerData, isOpen: false })} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1 text-xs">
              {drawerData.items?.[0]?.data?.map((inv: any, idx: number) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between font-bold text-slate-900">
                    <span className="font-mono">{inv.invoice_no}</span>
                    <span className="text-blue-700">{cleanNumber(inv.total_amount).toLocaleString('tr-TR')} ₺</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                    <span>Vade: {sanitizeDate(inv.due_date) || '-'}</span>
                    {inv.status === 'paid' ? (
                      <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">Tahsil Edildi</span>
                    ) : (
                      <button 
                        onClick={() => {
                          setDrawerData({ ...drawerData, isOpen: false });
                          handleOpenReceiptFromSale(inv);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-1 rounded flex items-center gap-1 transition">
                        <Coins className="w-3.5 h-3.5" /> Tahsil Et
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TAHSİLAT FORMU */}
      {isNewReceiptModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Tahsilat Girişi Yap</h3>
              <button onClick={() => setIsNewReceiptModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewReceipt} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Müşteri / Cari Adı</label>
                <input 
                  type="text" 
                  value={newReceiptFormData.customerName}
                  onChange={e => setNewReceiptFormData({ ...newReceiptFormData, customerName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Hesap Türü</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewReceiptFormData({ ...newReceiptFormData, targetAccount: 'bank' })}
                    className={`p-2 rounded-lg border text-center transition ${newReceiptFormData.targetAccount === 'bank' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200'}`}>
                    🏦 Banka Hesabı
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewReceiptFormData({ ...newReceiptFormData, targetAccount: 'cash' })}
                    className={`p-2 rounded-lg border text-center transition ${newReceiptFormData.targetAccount === 'cash' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200'}`}>
                    💵 Kasa (Elden Nakit)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tutar (TL)</label>
                  <input 
                    type="text" 
                    value={newReceiptFormData.amount}
                    onChange={e => setNewReceiptFormData({ ...newReceiptFormData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-emerald-600 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tahsil Tarihi</label>
                  <input 
                    type="date" 
                    value={newReceiptFormData.date}
                    onChange={e => setNewReceiptFormData({ ...newReceiptFormData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsNewReceiptModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-emerald-600 text-white font-medium">Tahsilatı Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
