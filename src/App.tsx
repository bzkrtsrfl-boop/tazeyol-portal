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
  Search
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
  const [activeTab, setActiveTab] = useState<'overview' | 'subcontractors' | 'sales_customers' | 'employees' | 'fleet' | 'profitability' | 'collections' | 'credit_cards' | 'payments' | 'general_expenses'>('overview');

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
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [isImportingSubcontractors, setIsImportingSubcontractors] = useState(false);
  const [isImportingHgsExcel, setIsImportingHgsExcel] = useState(false);

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

  // MANUEL TAHSİLAT GİRİŞ MODALI
  const [isNewReceiptModalOpen, setIsNewReceiptModalOpen] = useState(false);
  const [newReceiptFormData, setNewReceiptFormData] = useState({
    customerName: '',
    receiptNo: '',
    amount: '',
    targetAccount: 'bank',
    date: new Date().toISOString().split('T')[0]
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

  const [isBankExportModalOpen, setIsBankExportModalOpen] = useState(false);
  const [bankExportTermChoice, setBankExportTermChoice] = useState<'term1' | 'term2' | 'both'>('both');

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

  // GELİŞMİŞ ARAÇ FORMU (SİGORTA, KASKO, MUAYENE VE MTV)
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
  const [dbCreditCards, setDbCreditCards] = useState<any[]>([]);
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

      if (vData) setDbVehicles(vData);
      if (invData) setDbInvoices(invData);
      if (empData) setDbEmployees(empData);
      if (advData) setDbAdvances(advData);
      if (ccData) setDbCreditCards(ccData);
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

  // 1 YIL SONRASI HESAPLAYICI (SİGORTA & KASKO BİTİŞ İÇİN)
  const addOneYear = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  };

  const formatPhoneNumber = (val: string) => {
    let digits = val.replace(/\D/g, '');
    if (!digits.startsWith('0')) digits = '0' + digits;
    digits = digits.substring(0, 11);

    let res = '';
    if (digits.length > 0) res += digits.substring(0, 4);
    if (digits.length >= 5) res += ' ' + digits.substring(4, 7);
    if (digits.length >= 8) res += ' ' + digits.substring(7, 9);
    if (digits.length >= 10) res += ' ' + digits.substring(9, 11);
    return res;
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

  // AKILLI BİLEŞİK ALARMLAR LİSTESİ (BORÇLAR + KREDİ KARTI + GECİKEN MÜŞTERİ + SİGORTA/KASKO + MTV)
  const combinedAlerts = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayObj = new Date();
    const currentMonth = todayObj.getMonth(); // 0 = Ocak, 6 = Temmuz
    const alerts: any[] = [];

    // 1. Vadesi Yaklaşan / Geçen Borç Faturaları
    dbInvoices
      .filter(i => i.status !== 'paid' && !['customer_collection', 'freight_sales', 'cash_deposit'].includes(i.category) && i.due_date)
      .forEach(i => {
        const d = sanitizeDate(i.due_date);
        const diff = Math.ceil((new Date(d).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
        if (!isNaN(diff) && diff <= 3) {
          alerts.push({
            type: 'debt',
            title: i.invoice_no,
            date: i.due_date,
            amount: cleanNumber(i.total_amount),
            diffDays: diff,
            rawItem: i
          });
        }
      });

    // 2. Kredi Kartı Son Ödeme Hatırlatması (3 gün kala veya geçmiş)
    dbCreditCards.forEach(cc => {
      const d = sanitizeDate(cc.due_date);
      const diff = Math.ceil((new Date(d).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
      if (!isNaN(diff) && diff <= 3) {
        alerts.push({
          type: 'credit_card',
          title: `💳 ${cc.bank_name} (${cc.card_name})`,
          date: cc.due_date,
          amount: cleanNumber(cc.statement_amount),
          minAmount: cleanNumber(cc.min_payment_amount),
          diffDays: diff
        });
      }
    });

    // 3. Müşteri Tahsilat Gecikme Uyarısı (Vadesi dolmuş veya geçmiş açık satışlar)
    dbInvoices
      .filter(i => i.category === 'freight_sales' && i.status !== 'paid' && i.due_date)
      .forEach(sale => {
        const d = sanitizeDate(sale.due_date);
        const diff = Math.ceil((new Date(d).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 0) {
          alerts.push({
            type: 'customer_overdue',
            title: `📞 Müşteriyi Arayınız: ${sale.invoice_no}`,
            date: sale.due_date,
            amount: cleanNumber(sale.total_amount),
            diffDays: diff
          });
        }
      });

    // 4. Araç Sigorta ve Kasko Bitiş Uyarısı (15 gün kala)
    dbVehicles.forEach(v => {
      if (v.insurance_expiry_date) {
        const diff = Math.ceil((new Date(sanitizeDate(v.insurance_expiry_date)).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 15) {
          alerts.push({
            type: 'vehicle_insurance',
            title: `🛡️ ${v.plate_number} Trafik Sigortası Bitiyor`,
            date: v.insurance_expiry_date,
            diffDays: diff
          });
        }
      }
      if (v.kasko_expiry_date) {
        const diff = Math.ceil((new Date(sanitizeDate(v.kasko_expiry_date)).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 15) {
          alerts.push({
            type: 'vehicle_kasko',
            title: `📑 ${v.plate_number} Kasko Bitiyor`,
            date: v.kasko_expiry_date,
            diffDays: diff
          });
        }
      }
    });

    // 5. Ocak ve Temmuz MTV Ödeme Bildirimi
    if (currentMonth === 0 || currentMonth === 6) {
      alerts.push({
        type: 'mtv_period',
        title: `🏛️ ${currentMonth === 0 ? '1. Taksit (Ocak)' : '2. Taksit (Temmuz)'} Filo MTV Ödeme Dönemi`,
        date: today,
        diffDays: 0
      });
    }

    return alerts.sort((a, b) => a.diffDays - b.diffDays);
  }, [dbInvoices, dbCreditCards, dbVehicles]);

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

  const totalGovernmentPaymentsDebt = dbInvoices
    .filter(i => i.status !== 'paid' && ['taxes_sgk', 'traffic_fines'].includes(i.category))
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const totalGeneralCompanyExpensesDebt = dbInvoices
    .filter(i => i.status !== 'paid' && !['subcontractor_invoice', 'customer_collection', 'freight_sales', 'taxes_sgk', 'traffic_fines', 'salary_payroll', 'cash_deposit'].includes(i.category))
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const totalPeriodPaidExpenses = filteredInvoices
    .filter(i => i.status === 'paid' && !['customer_collection', 'freight_sales', 'cash_deposit'].includes(i.category))
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

  const totalEmployeeFutureDebt = accruedEmployeeSalaryDebt + accruedEmployeeBonusesDebt;
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
        else if (str.includes('MİGROS')) cust = 'MİGROS TİCARET A.Ş.';
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

  // ARAÇ 360° ÇEKMECESİ: MASRAF & BEDEL ÖZETİ
  const openVehicle360 = (v: any) => {
    const cleanPlate = String(v.plate_number || '').replace(/\s+/g, '').toUpperCase();
    const relatedProfit = dbProfitability.filter(p => String(p.plate_number || '').replace(/\s+/g, '').toUpperCase() === cleanPlate);
    const relatedExpenses = dbInvoices.filter(i => String(i.invoice_no || '').toUpperCase().includes(cleanPlate));
    const paidFines = relatedExpenses.filter(i => i.category === 'traffic_fines').reduce((s, i) => s + cleanNumber(i.total_amount), 0);

    setDrawerData({
      isOpen: true,
      type: 'vehicle',
      title: `${v.plate_number}`,
      subtitle: `${v.brand_model || ''} • Sürücü: ${v.driver_name || 'Atanmadı'}`,
      meta: v,
      vehicleSummary: {
        lastInsurance: cleanNumber(v.insurance_cost),
        lastKasko: cleanNumber(v.kasko_cost),
        lastInspection: cleanNumber(v.inspection_cost),
        lastMtv: cleanNumber(v.last_mtv_cost),
        paidFines
      },
      items: [
        { label: 'Aylık Karlılık Verileri', data: relatedProfit },
        { label: 'Doğrudan Masraflar & Faturalar', data: relatedExpenses }
      ]
    });
  };

  const openEmployee360 = (emp: any) => {
    const empRecords = dbAdvances.filter(a => a.target_name === emp.full_name && a.target_type === 'employee');
    setDrawerData({
      isOpen: true,
      type: 'employee',
      title: `${emp.full_name}`,
      subtitle: `${emp.role_title} • Sabit Maaş: ${cleanNumber(emp.base_salary).toLocaleString('tr-TR')} ₺`,
      meta: emp,
      items: [{ label: 'Avans & Harcama Geçmişi', data: empRecords }]
    });
  };

  const openContractor360 = (inv: any) => {
    const invNo = String(inv.invoice_no || '');
    const name = invNo.includes(' - ') ? invNo.split(' - ')[1] : invNo;
    const allInvoices = dbInvoices.filter(i => String(i.invoice_no || '').includes(name));
    setDrawerData({
      isOpen: true,
      type: 'contractor',
      title: `${name}`,
      subtitle: `Alt Yüklenici Cari Ekstresi`,
      meta: inv,
      items: [{ label: 'Fatura & Taksit Hareketleri', data: allInvoices }]
    });
  };

  const openCustomer360 = (cust: any) => {
    setDrawerData({
      isOpen: true,
      type: 'customer',
      title: cust.customerName,
      subtitle: `Toplam Kesilen Ciro: ${cust.totalSales.toLocaleString('tr-TR')} ₺`,
      meta: cust,
      items: [{ label: 'Müşteriye Kesilen Satış Faturaları', data: cust.invoices }]
    });
  };

  // ALT YÜKLENİCİ HAKEDİŞİNİ SİLME (ADMİN)
  const handleDeleteSubcontractorInvoice = async (inv: any) => {
    if (!isAdmin) return;
    const confirm = window.confirm(`${inv.invoice_no} numaralı alt yüklenici kaydını tamamen silmek istediğinize emin misiniz?`);
    if (!confirm) return;

    try {
      const { error } = await supabase.from('invoices').delete().eq('id', inv.id);
      if (error) throw error;
      alert('Hakediş kaydı başarıyla silindi!');
      loadPortalData();
    } catch (err: any) {
      alert('Silme hatası: ' + err.message);
    }
  };

  // KREDİ KARTI EKLEME
  const handleSaveCreditCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditCardFormData.cardName || !creditCardFormData.dueDate) {
      alert('Lütfen kart adı ve son ödeme tarihini giriniz.');
      return;
    }

    try {
      const { error } = await supabase.from('credit_cards').insert([{
        card_name: creditCardFormData.cardName.trim(),
        bank_name: creditCardFormData.bankName.trim(),
        last_four_digits: creditCardFormData.lastFourDigits.trim(),
        statement_amount: cleanNumber(creditCardFormData.statementAmount),
        min_payment_amount: cleanNumber(creditCardFormData.minPaymentAmount),
        due_date: creditCardFormData.dueDate
      }]);

      if (error) throw error;
      alert('Kredi kartı başarıyla eklendi!');
      setIsCreditCardModalOpen(false);
      setCreditCardFormData({ cardName: '', bankName: '', lastFourDigits: '', statementAmount: '', minPaymentAmount: '', dueDate: '' });
      loadPortalData();
    } catch (err: any) {
      alert('Kart ekleme hatası: ' + err.message);
    }
  };

  // MANUEL SATIŞ FATURASI EKLE
  const handleSaveNewSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = cleanNumber(newSaleFormData.amount);
    if (!newSaleFormData.invoiceNo || amt <= 0) {
      alert('Lütfen fatura no ve tutar giriniz.');
      return;
    }

    try {
      const invTitle = newSaleFormData.customerName ? `${newSaleFormData.invoiceNo} - ${newSaleFormData.customerName}` : newSaleFormData.invoiceNo;
      const { error } = await supabase.from('invoices').insert([{
        invoice_no: invTitle,
        direction: 'outgoing',
        category: 'freight_sales',
        total_amount: amt,
        issue_date: newSaleFormData.issueDate,
        due_date: newSaleFormData.dueDate,
        status: 'unpaid'
      }]);

      if (error) throw error;
      alert('Satış faturası kaydedildi!');
      setIsNewSaleModalOpen(false);
      setNewSaleFormData({ customerName: '', invoiceNo: '', amount: '', issueDate: new Date().toISOString().split('T')[0], dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] });
      loadPortalData();
    } catch (err: any) {
      alert('Fatura kayıt hatası: ' + err.message);
    }
  };

  // MANUEL TAHSİLAT EKLE
  const handleSaveNewReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = cleanNumber(newReceiptFormData.amount);
    if (amt <= 0) {
      alert('Lütfen tutar giriniz.');
      return;
    }

    try {
      const recTitle = `THS - ${newReceiptFormData.customerName || 'Müşteri'} (${newReceiptFormData.targetAccount === 'bank' ? 'Banka' : 'Kasa'})`;
      const { error } = await supabase.from('invoices').insert([{
        invoice_no: recTitle,
        direction: 'incoming',
        category: 'customer_collection',
        total_amount: amt,
        issue_date: newReceiptFormData.date,
        due_date: newReceiptFormData.date,
        status: 'paid'
      }]);

      if (error) throw error;
      alert(`Tahsilat başarıyla kaydedildi ve ${newReceiptFormData.targetAccount === 'bank' ? 'Banka' : 'Kasa'} hesabına eklendi!`);
      setIsNewReceiptModalOpen(false);
      setNewReceiptFormData({ customerName: '', receiptNo: '', amount: '', targetAccount: 'bank', date: new Date().toISOString().split('T')[0] });
      loadPortalData();
    } catch (err: any) {
      alert('Tahsilat hatası: ' + err.message);
    }
  };

  // GELİŞMİŞ ARAÇ KAYIT & DÜZENLEME (SİGORTA, KASKO, MUAYENE VE MTV)
  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleFormData.plateNumber.trim()) {
      alert('Lütfen araç plakasını giriniz.');
      return;
    }

    setIsSavingVehicle(true);
    try {
      const insExpiry = vehicleFormData.insuranceStartDate ? addOneYear(vehicleFormData.insuranceStartDate) : null;
      const kaskoExpiry = vehicleFormData.kaskoStartDate ? addOneYear(vehicleFormData.kaskoStartDate) : null;

      const payload = {
        plate_number: vehicleFormData.plateNumber.trim().toUpperCase(),
        driver_name: vehicleFormData.driverName.trim(),
        brand_model: vehicleFormData.brandModel.trim(),
        document_included: vehicleFormData.documentIncluded,
        tracking_system: vehicleFormData.trackingSystem,
        fuel_system: vehicleFormData.fuelSystem,
        hgs_system: vehicleFormData.hgsSystem,
        vehicle_type: vehicleFormData.vehicleType,
        ownership_type: vehicleFormData.ownershipType,
        next_inspection_date: vehicleFormData.nextInspectionDate || null,
        inspection_cost: cleanNumber(vehicleFormData.inspectionCost),
        insurance_company: vehicleFormData.insuranceCompany.trim() || null,
        insurance_cost: cleanNumber(vehicleFormData.insuranceCost),
        insurance_start_date: vehicleFormData.insuranceStartDate || null,
        insurance_expiry_date: insExpiry,
        kasko_company: vehicleFormData.kaskoCompany.trim() || null,
        kasko_cost: cleanNumber(vehicleFormData.kaskoCost),
        kasko_start_date: vehicleFormData.kaskoStartDate || null,
        kasko_expiry_date: kaskoExpiry,
        last_mtv_cost: cleanNumber(vehicleFormData.lastMtvCost)
      };

      if (editingVehicleId) {
        const { error } = await supabase.from('vehicles').update(payload).eq('id', editingVehicleId);
        if (error) throw error;
        alert('Araç ve poliçe bilgileri güncellendi!');
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
      vehicleType: v.vehicle_type || 'Kamyon Frigo (10 Palet)',
      ownershipType: v.ownership_type || 'Öz Mal',
      nextInspectionDate: sanitizeDate(v.next_inspection_date),
      inspectionCost: String(v.inspection_cost || ''),
      insuranceCompany: v.insurance_company || '',
      insuranceCost: String(v.insurance_cost || ''),
      insuranceStartDate: sanitizeDate(v.insurance_start_date),
      kaskoCompany: v.kasko_company || '',
      kaskoCost: String(v.kasko_cost || ''),
      kaskoStartDate: sanitizeDate(v.kasko_start_date),
      lastMtvCost: String(v.last_mtv_cost || '')
    });
    setIsVehicleModalOpen(true);
  };

  // TAŞERON DÜZENLEME & TAKSİTLİ AVANS
  const handleOpenEditSubInvoice = (inv: any) => {
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
  };

  const handleSaveSubInvoiceEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubInvoice) return;

    try {
      let tot = cleanNumber(subEditFormData.totalAmount);
      let t1 = cleanNumber(subEditFormData.term1Amount);
      let t2 = cleanNumber(subEditFormData.term2Amount);
      const adv = cleanNumber(subEditFormData.advanceAmount);
      const instCount = Math.max(1, parseInt(subEditFormData.advanceInstallmentCount) || 1);

      if (adv > 0) {
        const singleTermDeduction = adv / instCount;
        t1 = Math.max(0, t1 - singleTermDeduction);
        tot = Math.max(0, tot - singleTermDeduction);

        const remainingAdvanceDebt = adv - singleTermDeduction;
        const todayStr = new Date().toISOString().split('T')[0];

        await supabase.from('invoices').insert([{
          invoice_no: 'AVANS - ' + subEditFormData.invoiceNo + ' (' + instCount + ' Taksit)',
          direction: 'incoming',
          category: 'subcontractor_advance_paid',
          total_amount: adv,
          issue_date: todayStr,
          due_date: todayStr,
          status: 'paid'
        }]);

        await supabase.from('advance_payments').insert([{
          target_type: 'contractor',
          target_id: subEditFormData.invoiceNo,
          target_name: subEditFormData.invoiceNo,
          payment_type: 'contractor_installment_advance',
          total_amount: adv,
          total_installments: instCount,
          remaining_amount: remainingAdvanceDebt,
          issue_date: todayStr,
          notes: 'Taksit basi dusum: ' + singleTermDeduction.toLocaleString('tr-TR') + ' TL (Kalan: ' + (instCount - 1) + ' Taksit / ' + remainingAdvanceDebt.toLocaleString('tr-TR') + ' TL)'
        }]);
      }

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
      alert(adv > 0 ? 'Taksitli avans (' + adv.toLocaleString('tr-TR') + ' ₺ / ' + instCount + ' Taksit) başarıyla mahsup edildi ve kaydedildi!' : 'Hakediş başarıyla güncellendi!');
      setIsEditSubModalOpen(false);
      setEditingSubInvoice(null);
      loadPortalData();
    } catch (err: any) {
      alert('Fatura düzenleme hatası: ' + (err.message || err));
    }
  };

  const handleMarkInvoicePaid = async (inv: any, term: 1 | 2) => {
    if (!isAdmin) return;
    const termAmount = term === 1 ? cleanNumber(inv.term1_amount) : cleanNumber(inv.term2_amount);
    const confirmPay = window.confirm(`${inv.invoice_no} belgesinin ${term}. taksiti olan ${termAmount.toLocaleString('tr-TR')} ₺ ödendi olarak işaretlensin mi?`);
    if (!confirmPay) return;

    try {
      const updateData: any = {};
      if (term === 1) updateData.term1_status = 'paid';
      if (term === 2) updateData.term2_status = 'paid';

      const otherPaid = term === 1 ? inv.term2_status === 'paid' : inv.term1_status === 'paid';
      if (otherPaid) updateData.status = 'paid';

      const { error } = await supabase.from('invoices').update(updateData).eq('id', inv.id);
      if (error) throw error;
      alert(`${term}. Taksit başarıyla ödendi!`);
      loadPortalData();
    } catch (err: any) {
      alert('Güncelleme hatası: ' + err.message);
    }
  };

  const menuItems = [
    { id: 'overview', label: 'Genel Görünüm', icon: LayoutDashboard },
    { id: 'sales_customers', label: 'Satış & Müşteriler', badge: customersSummary.length, icon: TrendingUp },
    { id: 'subcontractors', label: 'Alt Yüklenici Hakedişleri', badge: dbInvoices.filter(i => i.category === 'subcontractor_invoice').length, icon: Users },
    { id: 'credit_cards', label: 'Kredi Kartları', badge: dbCreditCards.length, icon: CreditCard },
    { id: 'profitability', label: 'Öz Mal Karlılık & Maliyet', badge: dbProfitability.length, icon: BarChart3 },
    { id: 'employees', label: 'Personel & Bordro', badge: dbEmployees.length, icon: UserCheck },
    { id: 'fleet', label: 'Araç Filosu', badge: dbVehicles.length, icon: Truck },
    { id: 'collections', label: 'Müşteri Tahsilatları', badge: dbInvoices.filter(i => i.category === 'customer_collection').length, icon: Coins },
    { id: 'payments', label: 'Banka Talimatı (Excel)', icon: FileSpreadsheet },
    { id: 'general_expenses', label: 'Genel Giderler & Tedarik', icon: Receipt },
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
            <button 
              onClick={handleLogout}
              title="Güvenli Çıkış"
              className="p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition">
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

            {isAdmin && (
              <div className="p-4 border-b border-slate-100 space-y-2 bg-slate-50">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Hızlı İşlemler</span>
                <button 
                  onClick={() => {
                    setIsSidebarOpen(false);
                    setIsNewSaleModalOpen(true);
                  }}
                  className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition shadow-sm">
                  <Plus className="w-4 h-4" /> Manuel Satış Faturası Ekle
                </button>
                <button 
                  onClick={() => {
                    setIsSidebarOpen(false);
                    setIsNewReceiptModalOpen(true);
                  }}
                  className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition shadow-sm">
                  <Coins className="w-4 h-4" /> Manuel Tahsilat Ekle
                </button>
                <button 
                  onClick={() => {
                    setIsSidebarOpen(false);
                    setIsCashDepositModalOpen(true);
                  }}
                  className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition shadow-sm">
                  <ArrowDownLeft className="w-4 h-4" /> Kasaya / Bankaya Para Ekle
                </button>
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
              Tazeyol Soğuk Zincir Lojistiği ERP • v3.1
            </div>
          </div>
        </div>
      )}

      {/* ANA İÇERİK ALANI */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* AKILLI ALARM VE UYARI PANOSU */}
            {combinedAlerts.length > 0 && (
              <div className="bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-rose-200/60">
                  <div className="flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-rose-600 animate-bounce" />
                    <h3 className="font-bold text-rose-950 text-sm">Vadesi Dolan & Yaklaşan Kritik Bildirimler</h3>
                  </div>
                  <span className="text-[11px] font-bold bg-rose-200 text-rose-900 px-2 py-0.5 rounded-full">
                    {combinedAlerts.length} Hatırlatma / Alarm
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {combinedAlerts.map((alertItem, idx) => {
                    const isOverdue = alertItem.diffDays < 0;
                    const isToday = alertItem.diffDays === 0;

                    return (
                      <div key={idx} className="bg-white p-3 rounded-xl border border-rose-100 shadow-xs flex items-center justify-between text-xs">
                        <div className="space-y-0.5 truncate pr-2">
                          <span className="font-bold text-slate-900 block truncate">{alertItem.title}</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                              alertItem.type === 'customer_overdue' 
                                ? 'bg-amber-100 text-amber-900' 
                                : alertItem.type === 'credit_card'
                                ? 'bg-purple-100 text-purple-900'
                                : alertItem.type?.startsWith('vehicle')
                                ? 'bg-blue-100 text-blue-900'
                                : (isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800')
                            }`}>
                              {alertItem.type === 'customer_overdue' ? 'TAHSİLAT GECİKTİ' : (isOverdue ? `${Math.abs(alertItem.diffDays)} GÜN GEÇTİ` : (isToday ? 'BUGÜN SON GÜN' : `${alertItem.diffDays} GÜN KALDI`))}
                            </span>
                            <span className="text-slate-400 text-[10px]">Tarih: {alertItem.date}</span>
                          </div>
                        </div>

                        <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                          {alertItem.amount !== undefined && (
                            <span className="font-bold text-rose-600 text-sm">
                              {alertItem.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                            </span>
                          )}
                          {isAdmin && alertItem.type === 'debt' && (
                            <button
                              type="button"
                              onClick={() => handleMarkInvoicePaid(alertItem.rawItem, 1)}
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

            {/* FİNANSAL FİLTRE */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#009fe3]" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Finansal Veri Filtresi</h3>
                  <span className="text-[11px] text-slate-400">Dönem analizi için tarih aralığı belirleyebilirsiniz.</span>
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

            {/* ANA 4 KUTU */}
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
                <span className="text-xs text-slate-400 mt-1 block">
                  Seçilen Dönem Cirosu: {totalPeriodSalesRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
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
                  Açık Taşeron + Devlet + Temel Tedarikçi Borçları
                </span>
              </div>

              <div className="bg-[#009fe3] text-white p-5 rounded-2xl shadow-sm">
                <span className="text-xs text-blue-100 font-semibold tracking-wider uppercase flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" /> Güncel Kasa / Banka
                </span>
                <div className="text-2xl font-bold mt-2">
                  {currentRealCash.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-blue-100 mt-1 block">Ortak Fonları ve Tahsilatlar Dahil Net Nakit</span>
              </div>
            </div>

            {/* İKİNCİ 4'LÜ KUTU */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <span className="text-[11px] text-slate-400 mt-1 block">Açık Lastik, Bakım, Servis ve Tedarik Borçları</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold text-indigo-700 tracking-wider uppercase flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" /> Personel Gelecek Ödemesi
                </span>
                <div className="text-xl font-bold text-slate-900 mt-1.5">
                  {totalEmployeeFutureDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">İşleyen Gün Maaş Yükü (Ticari borca dahil edilmez)</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm bg-emerald-50/20">
                <span className="text-xs font-semibold text-emerald-800 tracking-wider uppercase flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5" /> Dönem İçi Fiili Masraf
                </span>
                <div className="text-xl font-bold text-emerald-800 mt-1.5">
                  {totalPeriodPaidExpenses.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-[11px] text-emerald-600 mt-1 block">Peşin Ödenen Avukat, Hamaliye ve Giderler</span>
              </div>
            </div>
          </div>
        )}

        {/* SATIŞ & MÜŞTERİLER MODÜLÜ */}
        {activeTab === 'sales_customers' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Müşteri Satış & Cari Takip</h3>
                <p className="text-xs text-slate-500 mt-0.5">Müşteri bazlı toplam ciro, bekleyen vadeler ve fatura dökümü.</p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsNewSaleModalOpen(true)}
                    className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                    <Plus className="w-4 h-4" /> Yeni Satış Faturası Ekle
                  </button>
                  <label className="cursor-pointer bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                    <FileUp className="w-4 h-4" /> Toplu Satış Exceli
                    <input 
                      type="file" 
                      accept=".xlsx,.xls" 
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) alert('Excel yüklendi!');
                      }}
                      className="hidden" 
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Müşteri / Firma Adı</th>
                    <th className="py-3 px-3 text-center">Fatura Adedi</th>
                    <th className="py-3 px-3 text-right">Toplam Satış Tutarı</th>
                    <th className="py-3 px-3 text-right">Bekleyen Tahsilat</th>
                    <th className="py-3 px-3 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customersSummary.map((cust, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td 
                        onClick={() => openCustomer360(cust)}
                        className="py-3 px-3 font-bold text-blue-700 text-sm cursor-pointer hover:underline">
                        {cust.customerName}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-600">{cust.invoices.length} Adet</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 text-sm">
                        {cust.totalSales.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600 text-sm">
                        {cust.pendingBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button 
                          onClick={() => openCustomer360(cust)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-blue-700 font-semibold rounded text-[11px] transition">
                          Faturaları Gör
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* KREDİ KARTLARI MODÜLÜ */}
        {activeTab === 'credit_cards' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Kredi Kartları Takip Ajandası</h3>
                <p className="text-xs text-slate-500 mt-0.5">Son ödeme günleri, asgari ve ekstre tutarları (Finansı etkilemez, bağımsız uyarı verir).</p>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => setIsCreditCardModalOpen(true)}
                  className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                  <Plus className="w-4 h-4" /> Yeni Kredi Kartı Ekle
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {dbCreditCards.map((cc, idx) => (
                <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900 text-sm">{cc.card_name}</span>
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">
                      {cc.bank_name} {cc.last_four_digits ? `(•${cc.last_four_digits})` : ''}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Ekstre Borcu:</span>
                      <span className="font-bold text-rose-600">{cleanNumber(cc.statement_amount).toLocaleString('tr-TR')} ₺</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Asgari Tutar:</span>
                      <span className="font-semibold text-amber-700">{cleanNumber(cc.min_payment_amount).toLocaleString('tr-TR')} ₺</span>
                    </div>
                    <div className="flex justify-between text-slate-600 pt-1">
                      <span>Son Ödeme Tarihi:</span>
                      <span className="font-bold text-slate-800">{sanitizeDate(cc.due_date)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ALT YÜKLENİCİ HAKEDİŞLERİ (SİL BUTONLU) */}
        {activeTab === 'subcontractors' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex justify-between items-center pb-5 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Alt Yüklenici Hakedişleri</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Taşeron mutabakat faturaları, taksit kapatma ve hakediş silme.</p>
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
                      {isAdmin && <th className="py-3 px-4 text-center">İşlem</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {dbInvoices.filter(i => i.category === 'subcontractor_invoice').map((inv, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td onClick={() => openContractor360(inv)} className="py-3 px-4 font-mono font-medium text-slate-800 cursor-pointer hover:text-[#009fe3]">
                          {inv.invoice_no}
                        </td>
                        <td className="py-3 px-4 text-slate-500">{inv.issue_date}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{cleanNumber(inv.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                        <td className="py-3 px-4">
                          <span className={inv.term1_status === 'paid' ? 'line-through text-slate-400' : 'text-blue-700 font-semibold'}>
                            {cleanNumber(inv.term1_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={inv.term2_status === 'paid' ? 'line-through text-slate-400' : 'text-blue-700 font-semibold'}>
                            {cleanNumber(inv.term2_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-center space-x-1">
                            <button 
                              onClick={() => handleOpenEditSubInvoice(inv)}
                              className="bg-slate-100 hover:bg-blue-50 text-blue-700 border border-slate-200 font-semibold px-2 py-1 rounded text-[11px] inline-flex items-center gap-1 transition">
                              <Edit2 className="w-3 h-3" /> Düzenle / Avans
                            </button>
                            <button 
                              onClick={() => handleDeleteSubcontractorInvoice(inv)}
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
          </div>
        )}

        {/* ARAÇ FİLOSU (DÜZENLE Butonu ve Bilgileri) */}
        {activeTab === 'fleet' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center pb-5 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Araç Filosu ({dbVehicles.length} Araç)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Sürücü, muayene, sigorta, kasko ve otomatik MTV bildirimleri.</p>
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
                    <th className="py-3 px-3">Plaka</th>
                    <th className="py-3 px-3">Sürücü</th>
                    <th className="py-3 px-3">Muayene Tarihi</th>
                    <th className="py-3 px-3">Sigorta Bitiş</th>
                    <th className="py-3 px-3">Kasko Bitiş</th>
                    <th className="py-3 px-3 text-right">Son MTV</th>
                    {isAdmin && <th className="py-3 px-3 text-center">İşlem</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dbVehicles.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50 transition">
                      <td onClick={() => openVehicle360(v)} className="py-3 px-3 font-mono font-bold text-blue-700 cursor-pointer hover:underline text-sm">
                        {v.plate_number}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">{v.driver_name || '-'}</td>
                      <td className="py-3 px-3 text-slate-600">{sanitizeDate(v.next_inspection_date) || '-'}</td>
                      <td className="py-3 px-3 text-slate-600">{sanitizeDate(v.insurance_expiry_date) || '-'}</td>
                      <td className="py-3 px-3 text-slate-600">{sanitizeDate(v.kasko_expiry_date) || '-'}</td>
                      <td className="py-3 px-3 text-right font-medium text-slate-700">
                        {v.last_mtv_cost ? `${cleanNumber(v.last_mtv_cost).toLocaleString('tr-TR')} ₺` : '-'}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-3 text-center">
                          <button 
                            onClick={() => openEditVehicleModal(v)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition inline-flex items-center gap-1 font-medium">
                            <Edit2 className="w-3.5 h-3.5" /> Düzenle
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

        {/* MÜŞTERİ TAHSİLATLARI (YENİ TAHSİLAT EKLE BUTONLU) */}
        {activeTab === 'collections' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center pb-5 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Müşteri Tahsilatları</h3>
                <p className="text-xs text-slate-500 mt-0.5">Kasaya ve bankaya giren müşteri tahsilat dökümleri.</p>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => setIsNewReceiptModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                  <Coins className="w-4 h-4" /> Manuel Tahsilat Ekle
                </button>
              )}
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

        {/* DİĞER MODÜLLER (BANKA TALİMATI, PERSONEL, ÖZ MAL) */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center pb-5 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Banka Toplu Ödeme Talimatı (Excel)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Vadesi gelen alt yüklenici hakedişlerini banka formatında indirin.</p>
              </div>
              {isAdmin ? (
                <button 
                  onClick={() => setIsBankExportModalOpen(true)} 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition">
                  <FileCheck2 className="w-4 h-4" /> Banka Excel Dosyası İndir
                </button>
              ) : (
                <span className="text-xs text-rose-600 font-bold">Raporör rolünde Excel indirme yetkisi kapalıdır.</span>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 360° DETAY ÇEKMECESİ (DRAWER) - ARAÇ ÖZET KARTLARI DAHİL */}
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

            <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
              {drawerData.type === 'vehicle' && drawerData.vehicleSummary && (
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Son Sigorta Bedeli</span>
                    <span className="font-bold text-slate-800">{drawerData.vehicleSummary.lastInsurance.toLocaleString('tr-TR')} ₺</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Son Kasko Bedeli</span>
                    <span className="font-bold text-slate-800">{drawerData.vehicleSummary.lastKasko.toLocaleString('tr-TR')} ₺</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Son Muayene Harcı</span>
                    <span className="font-bold text-slate-800">{drawerData.vehicleSummary.lastInspection.toLocaleString('tr-TR')} ₺</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Son MTV Tutarı</span>
                    <span className="font-bold text-slate-800">{drawerData.vehicleSummary.lastMtv.toLocaleString('tr-TR')} ₺</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Ödenmiş Toplam Ceza</span>
                    <span className="font-bold text-rose-600">{drawerData.vehicleSummary.paidFines.toLocaleString('tr-TR')} ₺</span>
                  </div>
                </div>
              )}

              {drawerData.items?.map((group, gIdx) => (
                <div key={gIdx} className="space-y-2">
                  <span className="font-bold text-slate-700 uppercase tracking-wider block text-[11px] pb-1 border-b border-slate-100">
                    {group.label} ({group.data?.length || 0})
                  </span>
                  <div className="space-y-2">
                    {group.data?.length === 0 && <p className="text-slate-400 italic">Kayıt bulunamadı.</p>}
                    {group.data?.map((item: any, iIdx: number) => (
                      <div key={iIdx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
                        <div className="flex justify-between font-bold text-slate-800">
                          <span>{item.invoice_no || item.month_year || 'Fatura'}</span>
                          <span className="text-blue-700">{(item.total_amount || item.invoice_rev || 0).toLocaleString('tr-TR')} ₺</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500">
                          <span>Vade/Tarih: {item.due_date || item.issue_date || '-'}</span>
                          <span className={item.status === 'paid' ? 'text-emerald-600 font-semibold' : 'text-amber-600'}>
                            {item.status === 'paid' ? 'Ödendi' : 'Açık'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GELİŞMİŞ ARAÇ FORMU (SİGORTA, KASKO, MUAYENE VE MTV) */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">{editingVehicleId ? 'Araç ve Poliçe Bilgilerini Düzenle' : 'Filoya Yeni Araç Ekle'}</h3>
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

              {/* TRAFİK SİGORTASI */}
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2">
                <span className="font-bold text-blue-900 block text-xs">Trafik Sigortası Poliçesi</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-600">Sigorta Şirketi</label>
                    <input 
                      type="text" 
                      placeholder="Örn: AXA, QUICK"
                      value={vehicleFormData.insuranceCompany}
                      onChange={e => setVehicleFormData({ ...vehicleFormData, insuranceCompany: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">Sigorta Bedeli (TL)</label>
                    <input 
                      type="text" 
                      placeholder="12500"
                      value={vehicleFormData.insuranceCost}
                      onChange={e => setVehicleFormData({ ...vehicleFormData, insuranceCost: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">Yapıldığı Tarih</label>
                    <input 
                      type="date" 
                      value={vehicleFormData.insuranceStartDate}
                      onChange={e => setVehicleFormData({ ...vehicleFormData, insuranceStartDate: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* KASKO POLİÇESİ */}
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200 space-y-2">
                <span className="font-bold text-purple-900 block text-xs">Kasko Poliçesi</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-600">Kasko Şirketi</label>
                    <input 
                      type="text" 
                      placeholder="Örn: ALLIANZ, ETHICA"
                      value={vehicleFormData.kaskoCompany}
                      onChange={e => setVehicleFormData({ ...vehicleFormData, kaskoCompany: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">Kasko Bedeli (TL)</label>
                    <input 
                      type="text" 
                      placeholder="45000"
                      value={vehicleFormData.kaskoCost}
                      onChange={e => setVehicleFormData({ ...vehicleFormData, kaskoCost: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">Yapıldığı Tarih</label>
                    <input 
                      type="date" 
                      value={vehicleFormData.kaskoStartDate}
                      onChange={e => setVehicleFormData({ ...vehicleFormData, kaskoStartDate: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* MUAYENE VE MTV */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 block text-xs">Muayene ve MTV Takvimi</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-600">Sonraki Muayene Tarihi</label>
                    <input 
                      type="date" 
                      value={vehicleFormData.nextInspectionDate}
                      onChange={e => setVehicleFormData({ ...vehicleFormData, nextInspectionDate: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">Muayene Ücreti (TL)</label>
                    <input 
                      type="text" 
                      placeholder="2800"
                      value={vehicleFormData.inspectionCost}
                      onChange={e => setVehicleFormData({ ...vehicleFormData, inspectionCost: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">Son MTV Tutarı (TL)</label>
                    <input 
                      type="text" 
                      placeholder="3500"
                      value={vehicleFormData.lastMtvCost}
                      onChange={e => setVehicleFormData({ ...vehicleFormData, lastMtvCost: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsVehicleModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" disabled={isSavingVehicle} className="w-1/2 py-2 rounded-lg bg-blue-600 text-white font-medium">
                  {isSavingVehicle ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KREDİ KARTI EKLEME */}
      {isCreditCardModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Yeni Kredi Kartı Ekle</h3>
              <button onClick={() => setIsCreditCardModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCreditCard} className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kart Adı / Sahibi</label>
                  <input 
                    type="text" 
                    placeholder="Örn: Şirket Kartı"
                    value={creditCardFormData.cardName}
                    onChange={e => setCreditCardFormData({ ...creditCardFormData, cardName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Banka Adı</label>
                  <input 
                    type="text" 
                    placeholder="Örn: Garanti BBVA"
                    value={creditCardFormData.bankName}
                    onChange={e => setCreditCardFormData({ ...creditCardFormData, bankName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Son 4 Hane</label>
                  <input 
                    type="text" 
                    placeholder="3533"
                    maxLength={4}
                    value={creditCardFormData.lastFourDigits}
                    onChange={e => setCreditCardFormData({ ...creditCardFormData, lastFourDigits: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ekstre Borcu (TL)</label>
                  <input 
                    type="text" 
                    placeholder="45000"
                    value={creditCardFormData.statementAmount}
                    onChange={e => setCreditCardFormData({ ...creditCardFormData, statementAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-rose-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Asgari Borç (TL)</label>
                  <input 
                    type="text" 
                    placeholder="9000"
                    value={creditCardFormData.minPaymentAmount}
                    onChange={e => setCreditCardFormData({ ...creditCardFormData, minPaymentAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-amber-700"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Son Ödeme Tarihi</label>
                <input 
                  type="date" 
                  value={creditCardFormData.dueDate}
                  onChange={e => setCreditCardFormData({ ...creditCardFormData, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsCreditCardModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">Kartı Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANUEL SATIŞ FATURASI EKLE */}
      {isNewSaleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Yeni Satış Faturası Girişi</h3>
              <button onClick={() => setIsNewSaleModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewSale} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Müşteri / Cari Adı</label>
                <input 
                  type="text" 
                  placeholder="Örn: MİGROS TİCARET A.Ş."
                  value={newSaleFormData.customerName}
                  onChange={e => setNewSaleFormData({ ...newSaleFormData, customerName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fatura Numarası</label>
                  <input 
                    type="text" 
                    placeholder="Örn: GIB20260000001"
                    value={newSaleFormData.invoiceNo}
                    onChange={e => setNewSaleFormData({ ...newSaleFormData, invoiceNo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tutar (TL)</label>
                  <input 
                    type="text" 
                    placeholder="250000"
                    value={newSaleFormData.amount}
                    onChange={e => setNewSaleFormData({ ...newSaleFormData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-blue-700"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fatura Tarihi</label>
                  <input 
                    type="date" 
                    value={newSaleFormData.issueDate}
                    onChange={e => setNewSaleFormData({ ...newSaleFormData, issueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vade Tarihi</label>
                  <input 
                    type="date" 
                    value={newSaleFormData.dueDate}
                    onChange={e => setNewSaleFormData({ ...newSaleFormData, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsNewSaleModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">Satışı Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANUEL TAHSİLAT EKLE */}
      {isNewReceiptModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Manuel Tahsilat Ekle</h3>
              <button onClick={() => setIsNewReceiptModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewReceipt} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Müşteri / Ödeyen Firma</label>
                <input 
                  type="text" 
                  placeholder="Örn: MİGROS TİCARET A.Ş."
                  value={newReceiptFormData.customerName}
                  onChange={e => setNewReceiptFormData({ ...newReceiptFormData, customerName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tahsilat Hesabı</label>
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
                  <label className="block font-semibold text-slate-700 mb-1">Tahsil Edilen Tutar (TL)</label>
                  <input 
                    type="text" 
                    placeholder="150000"
                    value={newReceiptFormData.amount}
                    onChange={e => setNewReceiptFormData({ ...newReceiptFormData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-emerald-600 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">İşlem Tarihi</label>
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
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium">Tahsilatı Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
