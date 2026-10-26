import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  X, 
  RefreshCw, 
  FileSpreadsheet, 
  FileUp, 
  LogOut, 
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
  Download,
  ShieldCheck,
  Phone
} from 'lucide-react';
import { supabase } from './supabase';
import * as XLSX from 'xlsx';

// KURUMSAL TAZEYOL LOGO + ERP BİLEŞENİ
function TazeyolBrand() {
  return (
    <div className="flex items-center gap-2.5">
      <img 
        src="/logo.png" 
        alt="Tazeyol" 
        className="h-12 max-h-12 w-auto object-contain drop-shadow-xs" 
      />
      <span className="bg-[#009fe3] text-white text-[11px] font-black tracking-widest px-2 py-0.5 rounded-md uppercase shadow-sm">
        ERP
      </span>
    </div>
  );
}
export default function App() {
  // 1. KULLANICI GİRİŞ & YETKİLENDİRME (RBAC)
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

  // 2. NAVİGASYON & TARİH FİLTRELERİ
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'subcontractors' | 'sub_ibans' | 'sales_customers' | 'employees' | 'fleet' | 'profitability' | 'collections' | 'credit_cards' | 'payments' | 'general_expenses'
  >('overview');
  const [subSearchTerm, setSubSearchTerm] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [subSortField, setSubSortField] = useState<'invoice_no' | 'issue_date' | 'total_amount'>('issue_date');
  const [subSortOrder, setSubSortOrder] = useState<'asc' | 'desc'>('desc');
  const [bankSortField, setBankSortField] = useState<'contractorName' | 'iban' | 'activeAmount'>('activeAmount');
  const [bankSortOrder, setBankSortOrder] = useState<'asc' | 'desc'>('desc');
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

  // 3. VERİTABANI STATE'LERİ
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
    { id: 5, month_year: 'Eyl.26', plate_number: '34NUE791', border: 0, recon_net: 279329.44, invoice_rev: 324022.15, driver_sal: 56000.00, fuel_ex_vat: 85582.16, hgs_ex_vat: 49688.31, bonus: 15600.00, sgk: 11148.00, other_exp: 1500.00 },
    { id: 6, month_year: 'Eyl.26', plate_number: '34SN1203', recon_net: 497886.39, invoice_rev: 577548.21, driver_sal: 60000.00, fuel_ex_vat: 54328.29, hgs_ex_vat: 3102.76, bonus: 10200.00, sgk: 11148.00, other_exp: 0 },
    { id: 7, month_year: 'Eyl.26', plate_number: '34UU8372', recon_net: 187228.32, invoice_rev: 217184.85, driver_sal: 56000.00, fuel_ex_vat: 57310.68, hgs_ex_vat: 16070.97, bonus: 15600.00, sgk: 11148.00, other_exp: 0 }
  ]);
  const [loading, setLoading] = useState(true);
  const [isExcelUploading, setIsExcelUploading] = useState(false);

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

  // 4. GELİŞMİŞ VE EXCEL SERİ TARİH DESTEKLİ DÖNÜŞTÜRÜCÜLER
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
// 1. ARKA PLAN İÇİN HESAPLAMA DOSTU TARİH FORMATI (YYYY-MM-DD)
  const sanitizeDate = (d: any): string => {
    if (!d) return '';
    try {
      // Excel Seri Numarası (Örn: 46295)
      if (typeof d === 'number' || (!isNaN(Number(d)) && String(d).trim().length === 5)) {
        const serial = Number(d);
        if (serial > 20000 && serial < 80000) {
          const dateObj = new Date(Math.round((serial - 25569) * 86400 * 1000));
          return dateObj.toISOString().split('T')[0];
        }
      }
      let str = String(d).split('T')[0].trim();
      // 20026 gibi 5 haneli hatalı yılları 2026 yapar
      if (str.startsWith('200') && str.length >= 10) {
        str = str.replace(/^200/, '20');
      }
      // Eğer GG.AA.YYYY girilmişse YYYY-MM-DD'ye çevir
      if (str.includes('.')) {
        const parts = str.split('.');
        if (parts.length === 3 && parts[2].length === 4) {
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
      return str;
    } catch {
      return '';
    }
  };

  // 2. SADECE EKRANDA GÖSTERİM İÇİN TÜRKİYE TARİH FORMATI (GG.AA.YYYY)
  const formatDateTR = (d: any): string => {
    if (!d) return '-';
    const clean = sanitizeDate(d);
    if (!clean || !clean.includes('-')) return clean || '-';
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return clean;
  };

  const formatDateForInput = (d: any): string => {
    return sanitizeDate(d);
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

  // 05XX XXX XX XX TELEFON BİÇİMLENDİRİCİ
  const formatPhone = (val: string) => {
    let numbers = val.replace(/\D/g, '');
    if (!numbers.startsWith('0') && numbers.length > 0) numbers = '0' + numbers;
    numbers = numbers.substring(0, 11);

    let res = '';
    if (numbers.length > 0) res += numbers.substring(0, 4);
    if (numbers.length > 4) res += ' ' + numbers.substring(4, 7);
    if (numbers.length > 7) res += ' ' + numbers.substring(7, 9);
    if (numbers.length > 9) res += ' ' + numbers.substring(9, 11);
    return res;
  };

  // 5. MODAL VE FORM STATE'LERİ
  const [isCreditCardModalOpen, setIsCreditCardModalOpen] = useState(false);
  const [creditCardFormData, setCreditCardFormData] = useState({
    cardName: '',
    bankName: '',
    lastFourDigits: '',
    statementAmount: '',
    minPaymentAmount: '',
    dueDate: ''
  });
  const [editingCreditCardId, setEditingCreditCardId] = useState<number | null>(null);

  // Kredi Kartı Düzenleme Penceresini Aç
  const openEditCreditCardModal = (card: any) => {
    setEditingCreditCardId(card.id);
    setCreditCardFormData({
      cardName: card.card_name || '',
      bankName: card.bank_name || '',
      lastFourDigits: card.last_four_digits || '',
      statementAmount: String(card.statement_amount || ''),
      minPaymentAmount: String(card.min_payment_amount || ''),
      dueDate: sanitizeDate(card.due_date)
    });
    setIsCreditCardModalOpen(true);
  };

  // Kredi Kartı Ödemesi Yap (Tamamı veya Asgari)
  const handlePayCreditCard = async (card: any, type: 'full' | 'min') => {
    if (!isAdmin) return;
    const fullAmt = cleanNumber(card.statement_amount);
    const minAmt = cleanNumber(card.min_payment_amount);
    const payAmt = type === 'full' ? fullAmt : minAmt;

    if (payAmt <= 0) {
      alert('Ödenecek geçerli bir borç tutarı bulunmuyor.');
      return;
    }

    const typeLabel = type === 'full' ? 'Tamamını' : 'Asgari Tutarını';
    const confirmMsg = `${card.card_name} (${card.bank_name})\nÖdenecek Tutar: ${payAmt.toLocaleString('tr-TR')} ₺ (${typeLabel})\nBu ödemeyi onaylıyor musunuz? (Kasadan fiilen düşülecektir)`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const remainingAmt = Math.max(0, fullAmt - payAmt);

      // 1. Kart borcunu güncelle
      const { error: cardErr } = await supabase
        .from('credit_cards')
        .update({
          statement_amount: remainingAmt,
          min_payment_amount: type === 'full' ? 0 : Math.max(0, minAmt - payAmt)
        })
        .eq('id', card.id);

      if (cardErr) throw cardErr;

      // 2. Kasa/Banka nakit çıkışı kaydı oluştur
      await supabase.from('invoices').insert([{
        invoice_no: `KART ÖDEME - ${card.card_name} [${card.bank_name}] (${typeLabel})`,
        direction: 'incoming',
        category: 'credit_card_payment',
        total_amount: payAmt,
        issue_date: todayStr,
        due_date: todayStr,
        status: 'paid'
      }]);

      alert(`Kart ödemesi (${payAmt.toLocaleString('tr-TR')} ₺) başarıyla işlendi ve kasadan düşüldü!${remainingAmt > 0 ? `\nKalan Ekstre Borcu: ${remainingAmt.toLocaleString('tr-TR')} ₺` : ''}`);
      loadPortalData();
    } catch (err: any) {
      alert('Kart ödeme hatası: ' + err.message);
    }
  };

  const [isNewSaleModalOpen, setIsNewSaleModalOpen] = useState(false);
  const [newSaleFormData, setNewSaleFormData] = useState({
    customerName: '',
    invoiceNo: '',
    amount: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  });

  const [isNewReceiptModalOpen, setIsNewReceiptModalOpen] = useState(false);
  const [newReceiptFormData, setNewReceiptFormData] = useState({
    customerName: '',
    receiptNo: '',
    amount: '',
    targetAccount: 'bank',
    date: new Date().toISOString().split('T')[0],
    relatedInvoiceId: null as number | null
  });

  const [isCashDepositModalOpen, setIsCashDepositModalOpen] = useState(false);
  const [cashDepositFormData, setCashDepositFormData] = useState({
    depositType: 'partner_capital',
    amount: '',
    targetAccount: 'bank',
    title: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [isBulkSalaryModalOpen, setIsBulkSalaryModalOpen] = useState(false);
  const [bulkSalaryItems, setBulkSalaryItems] = useState<{ [empId: number]: { selected: boolean; amount: string; name: string; role: string; iban: string } }>({});
  const [bulkSalarySource, setBulkSalarySource] = useState<'bank' | 'cash'>('bank');

  // TAŞERON IBAN MODALI (EKLE VE DÜZENLE)
  const [isSubIbanModalOpen, setIsSubIbanModalOpen] = useState(false);
  const [editingSubIbanId, setEditingSubIbanId] = useState<number | null>(null);
  const [subIbanFormData, setSubIbanFormData] = useState({
    name: '',
    iban: '',
    phone: ''
  });

  // BANKA TALİMATI İÇİN SATIR BAZLI SEÇİM STATE'LERİ
  const [contractorTermChoices, setContractorTermChoices] = useState<{ [key: string]: 'term1' | 'term2' | 'both' }>({});
  const [bankSelectedContractors, setBankSelectedContractors] = useState<{ [key: string]: boolean }>({});

  // MANUEL TAŞERON FATURA EKLEME MODALI
  const [isManualSubInvoiceModalOpen, setIsManualSubInvoiceModalOpen] = useState(false);
  const [manualSubInvoiceData, setManualSubInvoiceData] = useState({
    subcontractorName: '',
    invoiceNo: '',
    totalAmount: '',
    issueDate: new Date().toISOString().split('T')[0],
    term1DueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    term2DueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  });

  // TAŞERONA MANUEL ÖDEME / AVANS MODALI
  const [isSubPaymentModalOpen, setIsSubPaymentModalOpen] = useState(false);
  const [subPaymentFormData, setSubPaymentFormData] = useState({
    subcontractorName: '',
    actionType: 'advance',
    amount: '',
    installmentCount: '2',
    targetAccount: 'bank',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });

  // HAKEDİŞ DÜZENLEME MODALI
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

  // PERSONEL MODALI (EKLE / DÜZENLE + PRİM ALANI DAHİL)
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [employeeFormData, setEmployeeFormData] = useState({
    fullName: '',
    roleTitle: 'Kamyon Şoförü / Dağıtım',
    baseSalary: '',
    phone: '',
    iban: '',
    monthlyBonus: '',
    bonusDescription: ''
  });

  // GENEL GİDER DÜZENLEME / EKLEME MODALI
  const [isGeneralExpenseModalOpen, setIsGeneralExpenseModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [expenseFormData, setExpenseFormData] = useState({
    category: 'maintenance',
    companyName: '',
    plateNumber: '',
    invoiceNo: '',
    amount: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    status: 'unpaid',
    paidSource: 'bank'
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

  // ÇEKMECE STATE
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

 // 6. TAŞERON IBAN EŞLEŞTİRME HARİTASI (TÜRKÇE VE BOŞLUK KORUMALI)
  const subIbanMap = useMemo(() => {
    const map = new Map<string, string>();
    const cleanKey = (str: string) => (str || '').toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]/g, '');
    dbSubcontractors.forEach(s => {
      if (s.name && s.iban) {
        map.set(cleanKey(s.name), s.iban.trim());
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

      const uniqueMap = new Map<string, string>();
      rawRows.forEach(row => {
        const nameVal = String(row['alt yüklenici'] || row['Alt Yüklenici'] || row['Ad Soyad'] || row['Firma'] || row['Unvanı/Adı Soyadı'] || '').trim();
        let ibanVal = String(row['IBAN'] || row['Iban'] || '').trim().replace(/\t/g, '');

        if (nameVal && ibanVal) {
          uniqueMap.set(nameVal, formatIBAN(ibanVal));
        }
      });

      if (uniqueMap.size === 0) {
        alert('Excel dosyasında "alt yüklenici" ve "IBAN" sütunları bulunamadı!');
        return;
      }

      const insertRows = Array.from(uniqueMap.entries()).map(([name, iban]) => ({ name, iban }));

      const { error } = await supabase.from('subcontractors').upsert(insertRows, { onConflict: 'name' });
      if (error) throw error;

      alert(`${insertRows.length} adet alt yüklenici IBAN bilgisi başarıyla içeri aktarıldı ve eşleştirildi!`);
      loadPortalData();
    } catch (err: any) {
      alert('IBAN Excel yükleme hatası: ' + err.message);
    }
  };

 // MÜKERRER KORUMALI & EXCEL TARİH HATASIZ TAŞERON FATURA AKTARIMI
  const handleImportSubcontractorInvoicesSafe = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const normalizeKey = (text: string) =>
      (text || '').toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]/g, '');
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExcelUploading(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

      // Excel satırlarını dizi olarak alıyoruz (0=A, 1=B, 2=C, 3=D, 4=E, 5=F, 6=G)
      const rawRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

      const existingInvoicesMap = new Map<string, any>();
      dbInvoices
        .filter(i => i.category === 'subcontractor_invoice')
        .forEach(i => existingInvoicesMap.set(normalizeKey(String(i.invoice_no || '')), i));

      const newRowsToInsert: any[] = [];
      let updatedCount = 0;
      let skippedCount = 0;

      // 0. satır başlıklar olduğu için i=1'den başlıyoruz
      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || !Array.isArray(row) || row.length === 0) continue;

        const subName = String(row[1] || '').trim(); // B Sütunu (Ünvan)
        const invNo = String(row[3] || '').trim();   // D Sütunu (Fatura No)
        const rawDate = row[4];                      // E Sütunu (Tarih)
        const totalAmt = cleanNumber(row[6]);         // G Sütunu (ÖDENECEK NET TUTAR)

        if (!invNo || !subName || totalAmt <= 0) continue;

        const rowDate = sanitizeDate(rawDate) || new Date().toISOString().split('T')[0];
        const fullTitle = `${invNo} - ${subName}`.trim();
        const normKey = normalizeKey(fullTitle);

        const t1 = totalAmt / 2;
        const t2 = totalAmt / 2;

        if (existingInvoicesMap.has(normKey)) {
          // Sistemde zaten varsa: Tutarını ve vadelerini G sütununa göre güncelle
          const exist = existingInvoicesMap.get(normKey);
          await supabase.from('invoices').update({
            total_amount: totalAmt,
            term1_amount: t1,
            term2_amount: t2
          }).eq('id', exist.id);
          updatedCount++;
          skippedCount++;
        } else {
          // Sistemde yoksa: Yeni kayıt olarak ekle
          newRowsToInsert.push({
            invoice_no: fullTitle,
            direction: 'incoming',
            category: 'subcontractor_invoice',
            total_amount: totalAmt,
            issue_date: rowDate,
            due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
            term1_due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
            term1_amount: t1,
            term1_status: 'unpaid',
            term2_due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
            term2_amount: t2,
            term2_status: 'unpaid',
            status: 'unpaid'
          });
        }
      }

      if (newRowsToInsert.length > 0) {
        const { error } = await supabase.from('invoices').insert(newRowsToInsert);
        if (error) throw error;
      }

      alert(`İşlem Başarılı!\n• ${newRowsToInsert.length} adet yeni fatura eklendi.\n• ${updatedCount} adet mevcut fatura güncellendi.`);
      await loadPortalData();
    } catch (err: any) {
      console.error(err);
      alert('Excel aktarım hatası: ' + (err.message || 'Bilinmeyen hata'));
    } finally {
      setIsExcelUploading(false);
      e.target.value = '';
    }
  };

  // TOPLU SATIŞ FATURASI EXCELİ YÜKLEME (Fatura no & Düzenleme tarihi UYUMLU)
  const handleImportSalesInvoicesExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      const existingInvoices = new Set(
        dbInvoices
          .filter(i => i.category === 'freight_sales' || i.direction === 'outgoing')
          .map(i => String(i.invoice_no || '').trim().toUpperCase())
      );

      const newRowsToInsert: any[] = [];
      let skippedCount = 0;

      rawRows.forEach((row: any) => {
        // 'Fatura no' ve 'Fatura No' esnek arama
        const invNo = String(
          row['Fatura no'] || 
          row['Fatura No'] || 
          row['Fatura Numarası'] || 
          row['Belge No'] || 
          ''
        ).trim();

        const custName = String(
          row['Müşteri'] || 
          row['Cari'] || 
          row['Unvan'] || 
          row['Firma Adı'] || 
          row['Alıcı'] || 
          'MİGROS TİCARET A.Ş.'
        ).trim();

        const totalAmt = cleanNumber(row['Genel Toplam'] || row['Tutar'] || row['Toplam Tutar'] || row['Ödenecek Tutar']);
        
        // 'Düzenleme tarihi' veya 'Tarih' esnek arama
        const rawDate = row['Düzenleme tarihi'] || row['Tarih'] || row['Fatura Tarihi'];
        const rowIssueDate = sanitizeDate(rawDate) || new Date().toISOString().split('T')[0];
        
        const rawDueDate = row['Vade'] || row['Vade Tarihi'];
        const rowDueDate = sanitizeDate(rawDueDate) || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

        const fullTitle = `${invNo} - ${custName}`.trim();

        if (existingInvoices.has(fullTitle.toUpperCase()) || (invNo && existingInvoices.has(invNo.toUpperCase()))) {
          skippedCount++;
        } else if (invNo && totalAmt > 0) {
          newRowsToInsert.push({
            invoice_no: fullTitle,
            direction: 'outgoing',
            category: 'freight_sales',
            total_amount: totalAmt,
            issue_date: rowIssueDate,
            due_date: rowDueDate,
            status: 'unpaid'
          });
        }
      });

      if (newRowsToInsert.length > 0) {
        const { error } = await supabase.from('invoices').insert(newRowsToInsert);
        if (error) throw error;
      }

      alert(`Satış Faturaları İçe Aktarıldı!\n• ${newRowsToInsert.length} adet yeni satış faturası eklendi.\n• ${skippedCount} adet mevcut fatura mükerrer olmaması için atlandı.`);
      loadPortalData();
    } catch (err: any) {
      alert('Satış faturası yükleme hatası: ' + err.message);
    }
  };

  // 7. GENEL GÖRÜNÜM ALARM ANALİZİ (DOKUNULMAYAN SABİT BLOK)
  const alertAnalysis = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayObj = new Date();
    const currentMonth = todayObj.getMonth();

    const overdueSales: any[] = [];
    const pendingDebts: any[] = [];
    const creditCardsAlerts: any[] = [];
    const vehicleAlerts: any[] = [];

    dbInvoices
      .filter(i => (i.category === 'freight_sales' || i.direction === 'outgoing') && i.status !== 'paid' && i.due_date)
      .forEach(s => {
        const diff = Math.ceil((new Date(sanitizeDate(s.due_date)).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 0) overdueSales.push({ ...s, diffDays: diff });
      });

    dbInvoices
      .filter(i => i.status !== 'paid' && !['customer_collection', 'freight_sales', 'cash_deposit'].includes(i.category) && i.due_date)
      .forEach(d => {
        const diff = Math.ceil((new Date(sanitizeDate(d.due_date)).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 3) pendingDebts.push({ ...d, diffDays: diff });
      });

   dbCreditCards.forEach(cc => {
      const stmtAmt = cleanNumber(cc.statement_amount);
      if (stmtAmt > 0) {
        let diff = 0;
        if (cc.due_date) {
          diff = Math.ceil((new Date(sanitizeDate(cc.due_date)).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
        }
        // Ekstre borcu varsa ve vadesi geçmiş veya 15 gün içindeyse ana ekranda göster
        if (diff <= 15) {
          creditCardsAlerts.push({ ...cc, diffDays: diff, cleanStmtAmt: stmtAmt });
        }
      }
    });

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

  // 8. FİNANSAL FORMÜLLER
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

  const pendingReceivablesAllTime = dbInvoices
  .filter(i => (i.direction === 'outgoing' || i.category === 'freight_sales') && i.status !== 'paid')
  .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);
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
    .filter(a => a.target_type === 'employee' && ['bonus', 'special_bonus', 'employee_bonus'].includes(a.payment_type))
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

  // 9. MÜŞTERİ SATIŞLARI (MİGROS & GERÇEK CARİ EŞLEŞMESİ)
  const salesDetailedList = useMemo(() => {
    return dbInvoices
      .filter(i => i.category === 'freight_sales' || i.direction === 'outgoing')
     return matchesSearch && matchesStatus;
  })
  .sort((a, b) => {
    let comparison = 0;
    if (subSortField === 'invoice_no') {
      comparison = (a.invoice_no || '').localeCompare(b.invoice_no || '', 'tr');
    } else if (subSortField === 'issue_date') {
      comparison = new Date(a.issue_date || 0).getTime() - new Date(b.issue_date || 0).getTime();
    } else if (subSortField === 'total_amount') {
      comparison = cleanNumber(a.total_amount) - cleanNumber(b.total_amount);
    }
    return subSortOrder === 'asc' ? comparison : -comparison;
  })
  .map(inv => {
     let cust = 'MİGROS TİCARET A.Ş.';
        let fNo = inv.invoice_no || '';

        if (fNo.includes(' - ')) {
          const parts = fNo.split(' - ');
          fNo = parts[0].trim();
          cust = parts.slice(1).join(' - ').trim();
        } else if (fNo.toUpperCase().startsWith('EF') || fNo.toUpperCase().startsWith('EA') || fNo.toUpperCase().includes('MİGROS') || fNo.toUpperCase().includes('MIGROS')) {
          cust = 'MİGROS TİCARET A.Ş.';
        }

        return {
          ...inv,
          customerName: cust,
          cleanInvoiceNo: fNo
        };
      
  }, [dbInvoices]);

  // SATIŞ TABLOSU İÇİN ARAMA VE BAŞLIĞA GÖRE SIRALAMA
  const [salesSearchQuery, setSalesSearchQuery] = useState('');
  const [salesStatusFilter, setSalesStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [salesSortConfig, setSalesSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'issue_date', direction: 'desc' });

  const displayedSalesList = useMemo(() => {
    let list = [...salesDetailedList];

    if (salesSearchQuery.trim()) {
      const q = salesSearchQuery.toLowerCase();
      list = list.filter(item => 
        (item.customerName && item.customerName.toLowerCase().includes(q)) ||
        (item.cleanInvoiceNo && item.cleanInvoiceNo.toLowerCase().includes(q))
      );
    }
    // Durum Filtresi (Açık / Tahsil Edildi)
    if (salesStatusFilter !== 'all') {
      list = list.filter(item => {
        const isPaid = item.status === 'paid';
        return salesStatusFilter === 'paid' ? isPaid : !isPaid;
      });
    }

    list.sort((a, b) => {
      let valA = a[salesSortConfig.key] || '';
      let valB = b[salesSortConfig.key] || '';

      if (salesSortConfig.key === 'total_amount') {
        valA = cleanNumber(valA);
        valB = cleanNumber(valB);
      }

      if (valA < valB) return salesSortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return salesSortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [salesDetailedList, salesSearchQuery, salesSortConfig]);

  const handleSalesSort = (key: string) => {
    setSalesSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

// 10. BANKA TALİMATI İÇİN SATIR BAZLI DİNAMİK TOPLAMA VE HESAPLAMA (TÜRKÇE KARAKTER & TOPLU AVANS GÜVENLİKLİ)
  const bankPaymentGroupedList = useMemo(() => {
    const normalizeKey = (str: string) => {
      return (str || '')
        .replace(/İ/g, 'i')
        .replace(/I/g, 'ı')
        .toLocaleLowerCase('tr-TR')
        .replace(/[^a-z0-9]/g, '');
    };

    const map = new Map<string, { contractorName: string; term1Total: number; term2Total: number; invoiceNos: string[]; iban: string }>();

    dbInvoices
      .filter(i => i.category === 'subcontractor_invoice')
      .forEach(inv => {
        const fullTitle = String(inv.invoice_no || '');
        const contractorName = fullTitle.includes(' - ') ? fullTitle.split(' - ')[1].trim() : fullTitle;
        const key = normalizeKey(contractorName);
        const rawT1 = inv.term1_status !== 'paid' ? cleanNumber(inv.term1_amount || (inv.total_amount / 2)) : 0;
        const rawT2 = inv.term2_status !== 'paid' ? cleanNumber(inv.term2_amount || (inv.total_amount / 2)) : 0;

     if (rawT1 > 0 || rawT2 > 0) {
          if (!map.has(key)) {
            // 1. subIbanMap kontrolü
            let foundIban = subIbanMap?.[contractorName] || subIbanMap?.[key];

          // 2. Fatura üzerindeki IBAN kontrolü
            if (!foundIban || foundIban === 'IBAN Eksik') {
              if (inv.iban && String(inv.iban).trim().length > 10) foundIban = String(inv.iban).trim();
              else if ((inv as any).contractor_iban && String((inv as any).contractor_iban).trim().length > 10) foundIban = String((inv as any).contractor_iban).trim();
            }

            // 3. dbSubcontractors içinde esnek şirket/unvan araması
           // 3. dbSubcontractors içinde esnek ve güvenli şirket araması
            if (!foundIban || foundIban === 'IBAN Eksik') {
              const found = dbSubcontractors.find(sub => {
                const pSub = normalizeKey(sub.name);
                if (!pSub || !key) return false;
                
                // Tam eşleşme veya iç içe geçme
                if (pSub === key || (key.length >= 4 && pSub.includes(key)) || (pSub.length >= 4 && key.includes(pSub))) {
                  return true;
                }

                // Şirket unvanını kelimelere bölüp en az 4 harfli ana kelimeyi arama (kelime ortasını bozmaz)
                const subWords = pSub.split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !['limited', 'sirketi', 'anonim', 'nakliyat', 'lojistik'].includes(w));
                const keyWords = key.split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !['limited', 'sirketi', 'anonim', 'nakliyat', 'lojistik'].includes(w));

                return subWords.some(sw => key.includes(sw)) || keyWords.some(kw => pSub.includes(kw));
              });

              if (found?.iban) {
                foundIban = found.iban;
              }
            }
            map.set(key, {
              contractorName,
              term1Total: 0,
              term2Total: 0,
              invoiceNos: [],
              iban: foundIban || 'IBAN Eksik'
            });
          }

          // TUTARLARI VE VADELERİ TOPLAYAN KISIM
          const cur = map.get(key)!;
          cur.term1Total += rawT1;
          cur.term2Total += rawT2;
          cur.invoiceNos.push(inv.invoice_no);
        }
      });

    return Array.from(map.values()).map(item => {
      const normName = normalizeKey(item.contractorName);

      const activeAdv = dbAdvances.find(a => {
        if (a.target_type !== 'contractor') return false;
        const advTarget = normalizeKey(String(a.target_name || a.target_id || ''));
        return normName.length >= 4 && (advTarget === normName || advTarget.includes(normName) || normName.includes(advTarget));
      });

      const advInvoice = dbInvoices.find(i => {
        const title = String(i.invoice_no || '');
        if (!title.toUpperCase().includes('AVANS')) return false;
        return normName.length >= 4 && normalizeKey(title).includes(normName);
      });

      let advDeduction = 0;
      if (activeAdv) {
        const inst = Math.max(1, activeAdv.total_installments || 1);
        advDeduction = cleanNumber(activeAdv.total_amount) / inst;
      } else if (advInvoice) {
        const match = String(advInvoice.invoice_no).match(/\((\d+)\s*Taksit\)/i);
        const inst = match ? parseInt(match[1]) : 1;
        advDeduction = cleanNumber(advInvoice.total_amount) / inst;
      }

      const adjustedTerm1 = Math.max(0, item.term1Total - advDeduction);

      const choice = contractorTermChoices[item.contractorName] || 'term1';
      let activeAmount = 0;
      if (choice === 'term1') activeAmount = adjustedTerm1;
      else if (choice === 'term2') activeAmount = item.term2Total;
      else if (choice === 'both') activeAmount = adjustedTerm1 + item.term2Total;

      return {
        ...item,
        term1Total: adjustedTerm1,
        choice,
        activeAmount
      };
    }).sort((a, b) => {
      let comparison = 0;
      if (bankSortField === 'contractorName') {
        comparison = (a.contractorName || '').localeCompare(b.contractorName || '', 'tr-TR', { sensitivity: 'base' });
      } else if (bankSortField === 'iban') {
        comparison = (a.iban || '').localeCompare(b.iban || '', 'tr-TR');
      } else if (bankSortField === 'activeAmount') {
        comparison = cleanNumber(a.activeAmount) - cleanNumber(b.activeAmount);
      }
      return bankSortOrder === 'asc' ? comparison : -comparison;
    });
  }, [dbInvoices, contractorTermChoices, subIbanMap, bankSortField, bankSortOrder, dbAdvances]);
    
  // CANLI SEÇİLEN BANKA TOPLAMI
  const bankLiveSelectionSummary = useMemo(() => {
    let total = 0;
    let count = 0;
    bankPaymentGroupedList.forEach(item => {
      const isSelected = bankSelectedContractors[item.contractorName] !== false;
      if (isSelected && item.activeAmount > 0) {
        total += item.activeAmount;
        count++;
      }
    });
    return { total, count };
  }, [bankPaymentGroupedList, bankSelectedContractors]);

  // TÜMÜNÜ SEÇ / KALDIR FONKSİYONU
  const handleToggleSelectAllBank = () => {
    const allSelected = bankPaymentGroupedList.every(i => bankSelectedContractors[i.contractorName] !== false);
    const newSelection: { [key: string]: boolean } = {};
    bankPaymentGroupedList.forEach(i => {
      newSelection[i.contractorName] = !allSelected;
    });
    setBankSelectedContractors(newSelection);
  };

  // BANKA EXCEL ÇIKTISI
 // BANKA EXCEL ÇIKTISI & OTOMATİK MUTABAKAT DENETİMİ (SANITY CHECK)
  const handleDownloadBankExcel = () => {
    const selectedRows = bankPaymentGroupedList.filter(item => bankSelectedContractors[item.contractorName] !== false && item.activeAmount > 0);
    if (selectedRows.length === 0) {
      alert('Lütfen listeden en az bir alt yüklenici seçiniz!');
      return;
    }

    // GÜVENLİK KONTROLÜ (SANITY CHECK): Kuruş sapması denetimi
    let auditRawTotal = 0;
    let auditActiveTotal = 0;

    selectedRows.forEach(row => {
      let rawAmt = 0;
      if (row.choice === 'term1') rawAmt = row.term1Total;
      else if (row.choice === 'term2') rawAmt = row.term2Total;
      else if (row.choice === 'both') rawAmt = row.term1Total + row.term2Total;

      auditRawTotal += rawAmt;
      auditActiveTotal += cleanNumber(row.activeAmount);
    });

    const diff = Math.abs(auditRawTotal - auditActiveTotal);
    // 1 Kuruştan büyük herhangi bir mantık/matematik sapması varsa indirmeyi durdur
    if (diff > 0.05) {
      alert(`GÜVENLİK UYARISI: Banka talimat toplamı ile hakediş toplamı arasında ${diff.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺ tutarsızlık tespit edildi!\nMali kayıp yaşanmaması için Excel indirme işlemi durduruldu. Lütfen seçili kayıtları kontrol ediniz.`);
      return;
    }

    // IBAN Eksik Olan Taşeron Kontrolü
    const missingIbans = selectedRows.filter(r => !r.iban || r.iban === 'IBAN Eksik' || r.iban.trim().length < 15);
    if (missingIbans.length > 0) {
      const names = missingIbans.map(m => m.contractorName).join(', ');
      if (!window.confirm(`DİKKAT: Seçilen bazı alt yüklenicilerin IBAN bilgisi eksik veya geçersiz:\n• ${names}\n\nYine de Excel oluşturulsun mu?`)) {
        return;
      }
    }

    const excelData = selectedRows.map(item => ({
      'Alıcı Unvanı': item.contractorName,
      'IBAN': item.iban,
      'Ödeme Tutarı (TL)': item.activeAmount,
      'Açıklama': `Tazeyol Lojistik Hakediş Ödemesi (${item.choice === 'both' ? '1 ve 2. Vade' : item.choice === 'term1' ? '1. Vade' : '2. Vade'})`
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Toplu Odeme');
    XLSX.writeFile(workbook, `Tazeyol_Banka_Odeme_Talimati_${new Date().toISOString().split('T')[0]}.xlsx`);
    // Otomatik Durum Kapatma & Mükerrer Ödeme Kilidi
    setTimeout(async () => {
      if (window.confirm('Banka Exceli başarıyla oluşturuldu!\n\nSeçilen bu alt yüklenicilerin ilgili vadeleri sistemde "Ödendi" olarak işaretlenip kapatılsın mı? (Böylece mükerrer ödeme riski önlenir)')) {
        try {
          for (const item of selectedRows) {
            const contractorInvoices = dbInvoices.filter(i => {
              if (i.category !== 'subcontractor_invoice') return false;
              const fTitle = String(i.invoice_no || '');
              const cName = fTitle.includes(' - ') ? fTitle.split(' - ')[1].trim() : fTitle;
              return cName === item.contractorName;
            });

            for (const inv of contractorInvoices) {
              const updates: any = {};
              if (item.choice === 'term1' || item.choice === 'both') {
                updates.term1_status = 'paid';
              }
              if (item.choice === 'term2' || item.choice === 'both') {
                updates.term2_status = 'paid';
              }
              const isT1Paid = updates.term1_status === 'paid' || inv.term1_status === 'paid';
              const isT2Paid = updates.term2_status === 'paid' || inv.term2_status === 'paid';
              if (isT1Paid && isT2Paid) {
                updates.status = 'paid';
              }

              if (Object.keys(updates).length > 0) {
                await supabase.from('invoices').update(updates).eq('id', inv.id);
              }
            }
          }
          alert('Seçilen ödemeler başarıyla kapatıldı ve kayıtlara işlendi!');
          loadPortalData();
        } catch (err: any) {
          alert('Durum güncelleme hatası: ' + err.message);
        }
      }
    }, 500);
  };

  // 11. HAKEDİŞ SATIRINDA ESNEK VADE ÖDEME (1. Vade / 2. Vade / Tümü)
  const handlePaySubcontractorTerm = async (inv: any, term: 'term1' | 'term2' | 'both') => {
    if (!isAdmin) return;
    const t1 = cleanNumber(inv.term1_amount || (inv.total_amount / 2));
    const t2 = cleanNumber(inv.term2_amount || (inv.total_amount / 2));

    let payAmt = 0;
    if (term === 'term1') payAmt = t1;
    else if (term === 'term2') payAmt = t2;
    else if (term === 'both') payAmt = (inv.term1_status !== 'paid' ? t1 : 0) + (inv.term2_status !== 'paid' ? t2 : 0);

    const confirmMsg = `${inv.invoice_no}\nÖdenecek Tutar: ${payAmt.toLocaleString('tr-TR')} ₺\nBu ödemeyi onaylıyor musunuz? (Kasadan fiilen düşülecektir)`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const updates: any = {};

      if (term === 'term1') {
        updates.term1_status = 'paid';
        if (inv.term2_status === 'paid') updates.status = 'paid';
      } else if (term === 'term2') {
        updates.term2_status = 'paid';
        if (inv.term1_status === 'paid') updates.status = 'paid';
      } else if (term === 'both') {
        updates.term1_status = 'paid';
        updates.term2_status = 'paid';
        updates.status = 'paid';
      }

      await supabase.from('invoices').update(updates).eq('id', inv.id);

      await supabase.from('invoices').insert([{
        invoice_no: `ÖDEME - ${inv.invoice_no} (${term === 'term1' ? '1. Vade' : term === 'term2' ? '2. Vade' : 'Tamamı'})`,
        direction: 'incoming',
        category: 'subcontractor_paid_outflow',
        total_amount: payAmt,
        issue_date: todayStr,
        due_date: todayStr,
        status: 'paid'
      }]);

      alert('Ödeme başarıyla işlendi ve kasadan düşüldü!');
      loadPortalData();
    } catch (err: any) {
      alert('Ödeme hatası: ' + err.message);
    }
  };

  // 12. TAŞERONA MANUEL ÖDEME / AVANS FORMU KAYDETME
  const handleSaveSubPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = cleanNumber(subPaymentFormData.amount);
    if (!subPaymentFormData.subcontractorName || amt <= 0) {
      alert('Lütfen taşeron ve tutar bilgilerini giriniz.');
      return;
    }

    try {
      const todayStr = subPaymentFormData.date || new Date().toISOString().split('T')[0];
      const instCount = Math.max(1, parseInt(subPaymentFormData.installmentCount) || 1);
      const isInstallment = subPaymentFormData.actionType === 'installment_advance';
      const singleDeduction = isInstallment ? amt / instCount : amt;

      await supabase.from('invoices').insert([{
        invoice_no: `AVANS - ${subPaymentFormData.subcontractorName} (${isInstallment ? instCount + ' Taksit' : 'Peşin Avans'})`,
        direction: 'incoming',
        category: 'subcontractor_advance_paid',
        total_amount: amt,
        issue_date: todayStr,
        due_date: todayStr,
        status: 'paid'
      }]);

      await supabase.from('advance_payments').insert([{
        target_type: 'contractor',
        target_id: subPaymentFormData.subcontractorName,
        target_name: subPaymentFormData.subcontractorName,
        payment_type: isInstallment ? 'contractor_installment_advance' : 'contractor_advance',
        total_amount: amt,
        total_installments: instCount,
        remaining_amount: isInstallment ? (amt - singleDeduction) : 0,
        issue_date: todayStr,
        notes: isInstallment 
          ? `Taksit başı düşüm: ${singleDeduction.toLocaleString('tr-TR')} TL (Kalan: ${instCount - 1} Taksit / ${(amt - singleDeduction).toLocaleString('tr-TR')} TL)`
          : 'Peşin avans (Faturadan mahsup edilecek)'
      }]);

      alert(`Taşeron avansı (${amt.toLocaleString('tr-TR')} ₺) başarıyla işlendi ve ${subPaymentFormData.targetAccount === 'bank' ? 'Banka' : 'Kasa'} çıkışı yapıldı!`);
      setIsSubPaymentModalOpen(false);
      setSubPaymentFormData({
        subcontractorName: '',
        actionType: 'advance',
        amount: '',
        installmentCount: '2',
        targetAccount: 'bank',
        date: new Date().toISOString().split('T')[0],
        note: ''
      });
      loadPortalData();
    } catch (err: any) {
      alert('Avans işlemi hatası: ' + err.message);
    }
  };

  // 13. MANUEL TAŞERON HAKEDİŞ FATURASI EKLEME
  const handleSaveManualSubInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const tot = cleanNumber(manualSubInvoiceData.totalAmount);
    if (!manualSubInvoiceData.subcontractorName || !manualSubInvoiceData.invoiceNo || tot <= 0) {
      alert('Lütfen taşeron, fatura no ve tutar alanlarını doldurunuz.');
      return;
    }

    try {
      const fullTitle = `${manualSubInvoiceData.invoiceNo} - ${manualSubInvoiceData.subcontractorName}`.trim();
      const t1 = tot / 2;
      const t2 = tot / 2;

      const { error } = await supabase.from('invoices').insert([{
        invoice_no: fullTitle,
        direction: 'incoming',
        category: 'subcontractor_invoice',
        total_amount: tot,
        issue_date: manualSubInvoiceData.issueDate,
        term1_due_date: manualSubInvoiceData.term1DueDate,
        term1_amount: t1,
        term1_status: 'unpaid',
        term2_due_date: manualSubInvoiceData.term2DueDate,
        term2_amount: t2,
        term2_status: 'unpaid',
        status: 'unpaid'
      }]);

      if (error) throw error;
      alert('Taşeron faturası başarıyla eklendi!');
      setIsManualSubInvoiceModalOpen(false);
      setManualSubInvoiceData({
        subcontractorName: '',
        invoiceNo: '',
        totalAmount: '',
        issueDate: new Date().toISOString().split('T')[0],
        term1DueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
        term2DueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
      });
      loadPortalData();
    } catch (err: any) {
      alert('Hakediş ekleme hatası: ' + err.message);
    }
  };

 // 14. DİNAMİK TAKSİTLİ AVANS MAHSUBU VE HAKEDİŞ DÜZENLEME
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
          term1_status: (subEditFormData as any).term1Status || 'pending',
          term2_due_date: subEditFormData.term2DueDate,
          term2_amount: t2,
          term2_status: (subEditFormData as any).term2Status || 'pending'
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

  // 15. TAHSİLAT AÇMA VE KAYDETME
  const handleOpenReceiptFromSale = (saleInvoice: any) => {
    setNewReceiptFormData({
      customerName: saleInvoice.customerName || 'MİGROS TİCARET A.Ş.',
      receiptNo: `THS-${saleInvoice.cleanInvoiceNo || saleInvoice.invoice_no}`,
      amount: String(saleInvoice.total_amount || ''),
      targetAccount: 'bank',
      date: new Date().toISOString().split('T')[0],
      relatedInvoiceId: saleInvoice.id
    });
    setIsNewReceiptModalOpen(true);
  };

  const handleSaveNewReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = cleanNumber(newReceiptFormData.amount);
    if (amt <= 0) {
      alert('Lütfen tutar giriniz.');
      return;
    }

    try {
      const recTitle = `THS - ${newReceiptFormData.receiptNo || 'Dekont'} - ${newReceiptFormData.customerName || 'Müşteri'} - ${Date.now()}`;
      
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

      if (newReceiptFormData.relatedInvoiceId) {
        await supabase.from('invoices').update({ status: 'paid' }).eq('id', newReceiptFormData.relatedInvoiceId);
      }

      alert('Tahsilat başarıyla kaydedildi ve nakit havuzuna aktarıldı!');
      setIsNewReceiptModalOpen(false);
      loadPortalData();
    } catch (err: any) {
      alert('Tahsilat hatası: ' + err.message);
    }
  };
// TAHSİLAT SİLME, KASADAN DÜŞME VE FATURAYI GERİ AÇMA
  const handleDeleteReceipt = async (item: any) => {
    if (!isAdmin) return;
    if (!window.confirm(`${item.invoice_no}\nBu tahsilatı silmek istediğinize emin misiniz? Varsa bağlı satış faturası tekrar açık duruma dönecek ve tutar kasadan/bankadan düşülecektir.`)) return;

    try {
      const title = String(item.invoice_no || '');
      let invoiceNoToRevert = '';

      // 1. Başlıktan fatura numarasını ayıkla
      if (title.includes(' - ')) {
        const parts = title.split(' - ');
        if (parts.length > 1) {
          invoiceNoToRevert = parts[1].replace('THS-', '').trim();
        }
      }

      // 2. Varsa bağlı satış faturasını tekrar açık (unpaid) yap
      if (invoiceNoToRevert) {
        const matchedInvoice = dbInvoices.find(inv => 
          (inv.category === 'freight_sales' || inv.direction === 'outgoing') &&
          String(inv.invoice_no || '').toUpperCase().includes(invoiceNoToRevert.toUpperCase())
        );

        if (matchedInvoice) {
          await supabase.from('invoices').update({ status: 'unpaid' }).eq('id', matchedInvoice.id);
        }
      }

      // 3. Kasadaki bağlantılı hareket kayıtlarını temizle (genel giderler/kasa tablosu)
      try {
        await supabase.from('general_expenses').delete().ilike('description', `%${item.invoice_no}%`);
      } catch (e) {
        // Tablo adı farklıysa sessizce devam eder
      }

      // 4. Tahsilat kaydını invoices tablosundan sil
      const { error } = await supabase.from('invoices').delete().eq('id', item.id);
      if (error) throw error;

      alert('Tahsilat silindi, fatura tekrar açık duruma getirildi ve kasa güncellendi!');
      setDbInvoices(prev => prev.filter(inv => inv.id !== item.id));
      await loadPortalData();
    } catch (err: any) {
      alert('Silme hatası: ' + err.message);
    }
  };

  // KASA/BANKA PARA GİRİŞİ (SERMAYE/ORTAK FONU)
  const handleSaveCashDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = cleanNumber(cashDepositFormData.amount);
    if (amt <= 0) {
      alert('Lütfen geçerli bir tutar giriniz.');
      return;
    }

    try {
      const typeLabel = cashDepositFormData.depositType === 'partner_capital' ? 'Ortak Sermaye Fonu' : 'Diğer Para Girişi';
      const fullTitle = `${typeLabel} - ${cashDepositFormData.title || 'Nakit Giriş'} (${cashDepositFormData.targetAccount === 'bank' ? 'Banka' : 'Kasa'})`;

      const { error } = await supabase.from('invoices').insert([{
        invoice_no: fullTitle,
        direction: 'incoming',
        category: 'cash_deposit',
        total_amount: amt,
        issue_date: cashDepositFormData.date,
        due_date: cashDepositFormData.date,
        status: 'paid'
      }]);

      if (error) throw error;
      alert(`Para girişi (${amt.toLocaleString('tr-TR')} ₺) başarıyla ${cashDepositFormData.targetAccount === 'bank' ? 'Banka' : 'Kasa'} hesabına eklendi!`);
      setIsCashDepositModalOpen(false);
      setCashDepositFormData({ depositType: 'partner_capital', amount: '', targetAccount: 'bank', title: '', date: new Date().toISOString().split('T')[0] });
      loadPortalData();
    } catch (err: any) {
      alert('Para girişi hatası: ' + err.message);
    }
  };

  // 16. TOPLU PERSONEL MAAŞ ÖDEMESİ
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

  // 17. GENEL GİDER / TEDARİKÇİ EKLEME & DÜZENLEME
  const handleSaveGeneralExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = cleanNumber(expenseFormData.amount);
    if (!expenseFormData.companyName || amt <= 0) {
      alert('Lütfen tedarikçi ve tutar alanlarını doldurunuz.');
      return;
    }

    try {
      const fullTitle = `${expenseFormData.invoiceNo ? expenseFormData.invoiceNo + ' - ' : ''}${expenseFormData.companyName}${expenseFormData.plateNumber ? ' [' + expenseFormData.plateNumber.toUpperCase() + ']' : ''}`;
      const payload = {
        invoice_no: fullTitle,
        direction: 'incoming',
        category: expenseFormData.category,
        total_amount: amt,
        issue_date: expenseFormData.issueDate,
        due_date: expenseFormData.dueDate,
        status: expenseFormData.status
      };

      if (editingExpenseId) {
        const { error } = await supabase.from('invoices').update(payload).eq('id', editingExpenseId);
        if (error) throw error;
        alert('Gider kaydı başarıyla güncellendi!');
      } else {
        const { error } = await supabase.from('invoices').insert([payload]);
        if (error) throw error;
        alert('Gider kaydı başarıyla eklendi!');
      }

      setIsGeneralExpenseModalOpen(false);
      setEditingExpenseId(null);
      setExpenseFormData({
        category: 'maintenance',
        companyName: '',
        plateNumber: '',
        invoiceNo: '',
        amount: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        status: 'unpaid',
        paidSource: 'bank'
      });
      loadPortalData();
    } catch (err: any) {
      alert('Gider kaydetme hatası: ' + err.message);
    }
  };

  // 18. PERSONEL EKLEME & DÜZENLEME FORMU (PRİM / EK MASRAF DESTEKLİ)
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeFormData.fullName.trim()) return;

    try {
      const payload = {
        full_name: employeeFormData.fullName.trim(),
        role_title: employeeFormData.roleTitle,
        base_salary: cleanNumber(employeeFormData.baseSalary),
        phone: employeeFormData.phone.trim(),
        iban: formatIBAN(employeeFormData.iban)
      };

      if (editingEmployeeId) {
        const { error } = await supabase.from('employees').update(payload).eq('id', editingEmployeeId);
        if (error) throw error;

        // Bu aya ait prim/ek masraf girildiyse avans/prim tablosuna işle
        const bonusAmt = cleanNumber(employeeFormData.monthlyBonus);
        if (bonusAmt > 0) {
          const todayStr = new Date().toISOString().split('T')[0];
          await supabase.from('advance_payments').insert([{
            target_type: 'employee',
            target_id: String(editingEmployeeId),
            target_name: employeeFormData.fullName.trim(),
            payment_type: 'employee_bonus',
            total_amount: bonusAmt,
            issue_date: todayStr,
            notes: employeeFormData.bonusDescription.trim() || 'Aylık Hak Ediş Primi / Ek Masraf'
          }]);
        }

        alert('Personel bilgileri ve prim başarıyla güncellendi!');
      } else {
        const { error } = await supabase.from('employees').insert([payload]);
        if (error) throw error;
        alert('Yeni personel başarıyla kaydedildi!');
      }

      setIsEmployeeModalOpen(false);
      setEditingEmployeeId(null);
      setEmployeeFormData({ fullName: '', roleTitle: 'Kamyon Şoförü / Dağıtım', baseSalary: '', phone: '', iban: '', monthlyBonus: '', bonusDescription: '' });
      loadPortalData();
    } catch (err: any) {
      alert('Personel işlem hatası: ' + err.message);
    }
  };

  // 19. TAŞERON IBAN EKLEME & DÜZENLEME
  const handleSaveSubIban = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subIbanFormData.name || !subIbanFormData.iban) return;

    try {
      const payload = {
        name: subIbanFormData.name.trim(),
        iban: formatIBAN(subIbanFormData.iban)
      };

      if (editingSubIbanId) {
        const { error } = await supabase.from('subcontractors').update(payload).eq('id', editingSubIbanId);
        if (error) throw error;
        alert('Taşeron IBAN bilgisi güncellendi!');
      } else {
        const { error } = await supabase.from('subcontractors').upsert([payload], { onConflict: 'name' });
        if (error) throw error;
        alert('Taşeron IBAN bilgisi kaydedildi!');
      }

      setIsSubIbanModalOpen(false);
      setEditingSubIbanId(null);
      setSubIbanFormData({ name: '', iban: '', phone: '' });
      loadPortalData();
    } catch (err: any) {
      alert('IBAN kaydetme hatası: ' + err.message);
    }
  };

  // 20. GELİŞMİŞ ARAÇ KAYIT & DÜZENLEME
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

  // 21. 360° ÇEKMECE PANELİ
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

  // GİRİŞ EKRANI (AUTH)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-block"><TazeyolBrand /></div>
            <p className="text-xs text-slate-500">Soğuk Zincir Lojistiği ERP Yönetim Portalı</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-medium">
                {loginError}
              </div>
            )}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Kullanıcı Adı</label>
              <input
                type="text"
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                placeholder="Kullanıcı Adı"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Şifre</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" className="w-full py-3 bg-[#009fe3] hover:bg-[#0087c2] text-white font-bold rounded-xl transition shadow-md">
              Giriş Yap
            </button>
          </form>
        </div>
      </div>
    );
  }

  const menuItems = [
    { id: 'overview', label: 'Genel Görünüm', icon: LayoutDashboard },
    { id: 'sales_customers', label: 'Satış & Müşteriler', badge: salesDetailedList.length, icon: TrendingUp },
    { id: 'subcontractors', label: 'Alt Yüklenici Hakedişleri', badge: dbInvoices.filter(i => i.category === 'subcontractor_invoice').length, icon: Users },
    { id: 'sub_ibans', label: 'Taşeron IBAN Yönetimi', badge: dbSubcontractors.length, icon: Wallet },
    { id: 'payments', label: 'Banka Ödeme Talimatı', icon: FileCheck2 },
    { id: 'employees', label: 'Personel & Bordro', badge: dbEmployees.length, icon: UserCheck },
    { id: 'credit_cards', label: 'Kredi Kartları', badge: dbCreditCards.length, icon: CreditCard },
    { id: 'fleet', label: 'Araç Filosu', badge: dbVehicles.length, icon: Truck },
    { id: 'profitability', label: 'Öz Mal Karlılık & Maliyet', badge: dbProfitability.length, icon: BarChart3 },
    { id: 'collections', label: 'Müşteri Tahsilatları', badge: dbInvoices.filter(i => i.category === 'customer_collection').length, icon: Coins },
    { id: 'general_expenses', label: 'Genel Giderler & Tedarik', icon: Receipt },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      {/* ÜST MENÜ ÇUBUĞU */}
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

      {/* SOL SLIDER MENÜ */}
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
              Tazeyol ERP v3.2 • Soğuk Zincir Lojistiği
            </div>
          </div>
        </div>
      )}

      {/* ANA İÇERİK ALANI */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
        {/* 1. GENEL GÖRÜNÜM (DOKUNULMAYAN KİLİTLİ BLOK) */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-rose-200/60">
                <div className="flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-rose-600 animate-bounce" />
                  <h3 className="font-bold text-rose-950 text-sm">Finansal Hatırlatma & Kritik Uyarılar</h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div 
                  onClick={() => setActiveTab('sales_customers')}
                  className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-xs cursor-pointer hover:bg-amber-50/50 transition">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5">
                      <PhoneCall className="w-4 h-4 text-amber-600" /> Geciken Müşteri Satışları
                    </span>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {alertAnalysis.overdueSales.length} Fatura
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between items-baseline">
                    <span className="text-[11px] text-slate-500">Müşteriyi arayınız</span>
                    <span className="text-base font-bold text-amber-700">
                      {alertAnalysis.overdueSales.reduce((s, i) => s + cleanNumber(i.total_amount), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </span>
                  </div>
                </div>

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

                <div 
                  onClick={() => setActiveTab('credit_cards')}
                  className="bg-white p-3.5 rounded-xl border border-purple-200 shadow-xs cursor-pointer hover:bg-purple-50/50 transition">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-purple-900 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-purple-600" /> Yaklaşan Kredi Kartı Ödemesi
                    </span>
                    <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {alertAnalysis.creditCardsAlerts.length} Kart
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between items-baseline">
                    <span className="text-[11px] text-slate-500">Vadesi yaklaşan kartlar</span>
                   <span className="text-base font-bold text-purple-700">
                     {alertAnalysis.creditCardsAlerts.reduce((s, i) => s + cleanNumber(i.cleanStmtAmt || i.statement_amount || 0), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                   </span>
                  </div>
                </div>
              </div>
            </div>

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

              <div className="bg-[#009fe3] text-white p-5 rounded-2xl shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-xs text-blue-100 font-semibold tracking-wider uppercase flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" /> Güncel Kasa / Banka
                  </span>
                  {isAdmin && (
                    <button 
                      onClick={() => setIsCashDepositModalOpen(true)}
                      className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-[10px] font-bold transition flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Para Ekle
                    </button>
                  )}
                </div>
                <div className="text-2xl font-bold mt-2">
                  {currentRealCash.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-blue-100 mt-1 block">Ortak Fonları ve Tahsilatlar Dahil Net Nakit</span>
              </div>
            </div>

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
                <span className="text-xs font-semibold text-emerald-800 tracking-wider flex items-center gap-1">
  <Coins className="w-3.5 h-3.5" /> DÖNEM İÇİ FİİLİ MASRAF
</span>
                <div className="text-xl font-bold text-emerald-800 mt-1.5">
                  {totalPeriodPaidExpenses.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-[11px] text-emerald-600 mt-1 block">Peşin Ödenen Avukat, Hamaliye ve Giderler</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-rose-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Yaklaşan Kritik Taşeron Ödemeleri</h3>
                  </div>
                  <button 
                    onClick={() => setActiveTab('subcontractors')}
                    className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-1">
                    Tümünü Gör <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2">
                  {dbInvoices
                    .filter(i => i.category === 'subcontractor_invoice' && (i.term1_status !== 'paid' || i.term2_status !== 'paid'))
                    .slice(0, 5)
                    .map((inv, idx) => {
                      const t1 = cleanNumber(inv.term1_amount || (inv.total_amount / 2));
                      return (
                        <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                          <div>
                            <span className="font-bold text-slate-900 block">{inv.invoice_no}</span>
                            <span className="text-[12px] text-slate-500">1. Vade: {formatDateTR(inv.term1_due_date)}</span>
                          </div>
                          <span className="font-bold text-rose-600 text-sm">{t1.toLocaleString('tr-TR')} ₺</span>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-amber-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Muayenesi Yaklaşan Araçlar</h3>
                  </div>
                  <button 
                    onClick={() => setActiveTab('fleet')}
                    className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-1">
                    Filoya Git <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2">
                  {dbVehicles
                    .filter(v => v.next_inspection_date)
                    .sort((a, b) => new Date(a.next_inspection_date).getTime() - new Date(b.next_inspection_date).getTime())
                    .slice(0, 5)
                    .map((veh, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-mono font-bold text-blue-700 block">{veh.plate_number}</span>
                          <span className="text-[11px] text-slate-500">Sürücü: {veh.driver_name || 'Atanmadı'}</span>
                        </div>
                        <div className="text-right">
                          <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[11px] block">
                            {formatDateTR(veh.next_inspection_date)}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5 block">Muayene Tarihi</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. SATIŞ & MÜŞTERİLER */}
        {activeTab === 'sales_customers' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Müşteri Satış & Cari Takip</h3>
                <p className="text-xs text-slate-500 mt-0.5">Müşteri unvanı, fatura tarihi ve tek tıkla tahsilat kapama.</p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                    <FileUp className="w-4 h-4" /> Satış Faturası Exceli Yükle (Toplu)
                    <input type="file" accept=".xlsx,.xls" onChange={handleImportSalesInvoicesExcel} className="hidden" />
                  </label>
                  <button 
                    onClick={() => setIsNewSaleModalOpen(true)}
                    className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                    <Plus className="w-4 h-4" /> Manuel Satış Ekle
                  </button>
                </div>
              )}
            </div>
           <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="relative flex-1 sm:w-80">
                <input
                  type="text"
                  placeholder="Müşteri adı veya fatura no ile filtrele..."
                  value={salesSearchQuery}
                  onChange={e => setSalesSearchQuery(e.target.value)}
                  className="w-full px-3.5 py-2 pl-9 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white outline-none"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>

              <select
                value={salesStatusFilter}
                onChange={e => setSalesStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white font-semibold text-slate-700 outline-none">
                <option value="all">Tüm Faturalar</option>
                <option value="unpaid">⏳ Sadece Açık (Tahsil Edilecekler)</option>
                <option value="paid">✅ Sadece Tahsil Edilenler</option>
              </select>
            </div>
            {/* BEKLEYEN VE SEÇİLİ TAHSİLAT ÖZET KARTI */}
        {(() => {
          const salesInvoices = dbInvoices.filter((i: any) => i.direction === 'outgoing' || i.category === 'sales_invoice');
          const uncollected = salesInvoices.filter((i: any) => i.status !== 'paid');
          const totalUncollectedAmt = uncollected.reduce((acc: number, cur: any) => acc + (Number(cur.total_amount) || 0), 0);

          return (
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold shadow-md">
                  ₺
                </div>
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                    Toplam Bekleyen Müşteri Tahsilatı (Açık Faturalar)
                  </span>
                  <span className="text-2xl font-black text-slate-900 tracking-tight">
                    {totalUncollectedAmt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="bg-white/90 border border-emerald-200 text-emerald-800 font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-xs">
                  {uncollected.length} Açık Fatura
                </span>
                <span className="bg-slate-100 text-slate-600 font-semibold text-xs px-3 py-1.5 rounded-xl">
                  Toplam: {salesInvoices.length} Fatura
                </span>
              </div>
            </div>
          );
        })()}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th onClick={() => handleSalesSort('customerName')} className="py-3 px-3 cursor-pointer hover:text-blue-600 select-none">
                  Müşteri / Firma Adı ⇕
                </th>
                <th onClick={() => handleSalesSort('cleanInvoiceNo')} className="py-3 px-3 cursor-pointer hover:text-blue-600 select-none">
                  Fatura Numarası ⇕
                </th>
                <th onClick={() => handleSalesSort('issue_date')} className="py-3 px-3 cursor-pointer hover:text-blue-600 select-none">
                  Fatura Tarihi ⇕
                </th>
                <th onClick={() => handleSalesSort('due_date')} className="py-3 px-3 cursor-pointer hover:text-blue-600 select-none">
                  Vade Tarihi ⇕
                </th>
                <th onClick={() => handleSalesSort('total_amount')} className="py-3 px-3 text-right cursor-pointer hover:text-blue-600 select-none">
                  Toplam Satış Tutarı ⇕
                </th>
                <th onClick={() => handleSalesSort('status')} className="py-3 px-3 text-center cursor-pointer hover:text-blue-600 select-none">
                  Durum / İşlem ⇕
                </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedSalesList.map((sale, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 font-bold text-slate-900 text-sm">{sale.customerName}</td>
                      <td className="py-3 px-3 font-mono font-medium text-blue-700">{sale.cleanInvoiceNo}</td>
                      <td className="py-3 px-3 text-slate-600">{formatDateTR(sale.issue_date)}</td>
                      <td className="py-3 px-3 text-slate-600">{formatDateTR(sale.due_date)}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 text-sm">
                        {cleanNumber(sale.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </td>
                      <td className="py-3 px-3 text-center">
                        {sale.status === 'paid' ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-full">
                            Tahsil Edildi
                          </span>
                        ) : (
                          isAdmin && (
                            <button 
                              onClick={() => handleOpenReceiptFromSale(sale)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1 mx-auto shadow-sm transition">
                              <Coins className="w-3.5 h-3.5" /> Tahsil Et
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. ALT YÜKLENİCİ HAKEDİŞLERİ */}
        {activeTab === 'subcontractors' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Alt Yüklenici Hakedişleri</h3>
                <p className="text-xs text-slate-500 mt-0.5">Taşeron mutabakat faturaları, taksitli avans mahsubu ve doğrudan vade kapatma.</p>
              </div>
              {isAdmin && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className={`cursor-pointer ${isExcelUploading ? 'bg-slate-500 pointer-events-none opacity-80' : 'bg-slate-800 hover:bg-slate-900'} text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition`}>
              <FileUp className={`w-4 h-4 ${isExcelUploading ? 'animate-bounce' : ''}`} />
              <span>{isExcelUploading ? 'Faturalar Güncelleniyor, Lütfen Bekleyin...' : 'Taşeron Fatura Exceli Yükle'}</span>
              <input type="file" accept=".xlsx, .xls" disabled={isExcelUploading} onChange={handleImportSubcontractorInvoicesSafe} className="hidden" />
            </label>
                  <button 
                    onClick={() => setIsManualSubInvoiceModalOpen(true)}
                    className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                    <Plus className="w-4 h-4" /> Manuel Hakediş Ekle
                  </button>
                  <button 
                    onClick={() => setIsSubPaymentModalOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                    <DollarSign className="w-4 h-4" /> Manuel Ödeme / Avans Yap
                  </button>
                </div>
              )}
            </div>
{/* ARAMA VE FİLTRELEME ÇUBUĞU */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mb-4">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Taşeron adı veya fatura no ile filtrele..."
              value={subSearchTerm}
              onChange={(e) => setSubSearchTerm(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="w-full sm:w-auto">
            <select
              value={subStatusFilter}
              onChange={(e: any) => setSubStatusFilter(e.target.value)}
              className="w-full sm:w-48 text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Tüm Faturalar</option>
              <option value="pending">Ödenmemiş / Bekleyenler</option>
              <option value="paid">Tamamı Ödenenler</option>
            </select>
          </div>
        </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                   <th 
                className="py-3 px-3 cursor-pointer select-none hover:text-blue-600 transition-colors"
                onClick={() => {
                  if (subSortField === 'invoice_no') {
                    setSubSortOrder(subSortOrder === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSubSortField('invoice_no');
                    setSubSortOrder('asc');
                  }
                }}
              >
                Fatura No / Taşeron {subSortField === 'invoice_no' ? (subSortOrder === 'asc' ? '↑' : '↓') : '↕'}
              </th>
              <th 
                className="py-3 px-3 cursor-pointer select-none hover:text-blue-600 transition-colors"
                onClick={() => {
                  if (subSortField === 'issue_date') {
                    setSubSortOrder(subSortOrder === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSubSortField('issue_date');
                    setSubSortOrder('desc');
                  }
                }}
              >
                Tarih {subSortField === 'issue_date' ? (subSortOrder === 'asc' ? '↑' : '↓') : '↕'}
              </th>
              <th 
                className="py-3 px-3 cursor-pointer select-none hover:text-blue-600 transition-colors"
                onClick={() => {
                  if (subSortField === 'total_amount') {
                    setSubSortOrder(subSortOrder === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSubSortField('total_amount');
                    setSubSortOrder('desc');
                  }
                }}
              >
                Toplam Tutar {subSortField === 'total_amount' ? (subSortOrder === 'asc' ? '↑' : '↓') : '↕'}
              </th>
                    <th className="py-3 px-3">1. Vade</th>
                    <th className="py-3 px-3">2. Vade</th>
                    {isAdmin && <th className="py-3 px-3 text-center">Ödeme & İşlem</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dbInvoices
  .filter(i => i.category === 'subcontractor_invoice')
  .filter(inv => {
    const term = subSearchTerm.toLocaleLowerCase('tr-TR').trim();
    const invTitle = (inv.invoice_no || '').toLocaleLowerCase('tr-TR');
    const matchesSearch = !term || invTitle.includes(term);

    const isTerm1Paid = inv.term1_status === 'paid';
    const isTerm2Paid = inv.term2_status === 'paid';
    const isFullyPaid = isTerm1Paid && isTerm2Paid;

    let matchesStatus = true;
    if (subStatusFilter === 'pending') {
      matchesStatus = !isFullyPaid;
    } else if (subStatusFilter === 'paid') {
      matchesStatus = isFullyPaid;
    }

    return matchesSearch && matchesStatus;
  })
.sort((a: any, b: any) => {
    let comparison = 0;

    if (subSortField === 'invoice_no') {
      // Başlıktan sadece taşeronun adını çekip ona göre alfabetik sıralar:
      const nameA = (a.invoice_no || '').split(' - ')[1] || a.invoice_no || '';
      const nameB = (b.invoice_no || '').split(' - ')[1] || b.invoice_no || '';
      comparison = nameA.trim().localeCompare(nameB.trim(), 'tr-TR', { sensitivity: 'base' });
    } else if (subSortField === 'issue_date') {
      // GG.AA.YYYY veya YYYY-AA-GG formatını hatasız tarihe çevirip milisaniyeye göre sıralar:
      const parseDate = (d: any) => {
        if (!d) return 0;
        const str = String(d).trim();
        if (str.includes('.')) {
          const [day, month, year] = str.split('.');
          return new Date(`${year}-${month}-${day}`).getTime() || 0;
        }
        return new Date(str).getTime() || 0;
      };
      comparison = parseDate(a.issue_date) - parseDate(b.issue_date);
    } else if (subSortField === 'total_amount') {
      // Tutara göre matematiksel sıralama:
      comparison = cleanNumber(a.total_amount) - cleanNumber(b.total_amount);
    }

    return subSortOrder === 'asc' ? comparison : -comparison;
  })
                    .map(inv => {
                    const t1 = cleanNumber(inv.term1_amount || (inv.total_amount / 2));
                    const t2 = cleanNumber(inv.term2_amount || (inv.total_amount / 2));
                    const isT1Paid = inv.term1_status === 'paid';
                    const isT2Paid = inv.term2_status === 'paid';
                      // Fatura No veya Taşeron Adından Avansı Yakalama
                    const invTitle = String(inv.invoice_no || '');
                    const subNameOnly = invTitle.includes(' - ') ? invTitle.split(' - ')[1].trim() : invTitle;

                    const cleanTxt = (s: string) => (s || '').toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]/g, '');
                    const cleanInv = cleanTxt(invTitle);
                    const cleanSub = cleanTxt(subNameOnly);

                    const activeAdv = dbAdvances.find(a => {
                      if (a.target_type !== 'contractor') return false;
                      const advTarget = cleanTxt(String(a.target_name || a.target_id || ''));
                      const advNote = cleanTxt(String(a.notes || ''));
                      return (
                        (advTarget.length >= 4 && (cleanInv.includes(advTarget) || cleanSub.includes(advTarget))) ||
                        (cleanSub.length >= 4 && advTarget.includes(cleanSub))
                      );
                    });

                    let deductedAdvAmt = 0;
                    if (activeAdv && !isT1Paid) {
                      const inst = Math.max(1, activeAdv.total_installments || 1);
                      deductedAdvAmt = cleanNumber(activeAdv.total_amount) / inst;
                    }
                    const dynamicT1 = Math.max(0, t1 - deductedAdvAmt);
               
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-3 font-mono font-medium text-slate-800">{inv.invoice_no}</td>
                        <td className="py-3 px-3 text-slate-500">{formatDateTR(inv.issue_date)}</td>
                        <td className="py-3 px-3 font-bold text-slate-900">{cleanNumber(inv.total_amount).toLocaleString('tr-TR')} ₺</td>
                        <td className="py-3 px-3">
                          <span className={`font-semibold block ${isT1Paid ? 'text-emerald-600 line-through' : 'text-blue-700'}`}>
                  {dynamicT1.toLocaleString('tr-TR')} ₺
                </span>
                {deductedAdvAmt > 0 && (
                  <span className="block text-[10px] text-amber-600 font-normal">
                    (-{deductedAdvAmt.toLocaleString('tr-TR')} ₺ Avans Mahsubu)
                  </span>
                )}
                          <span className="text-[10px] text-slate-400">{isT1Paid ? 'Ödendi' : formatDateTR(inv.term1_due_date)}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`font-semibold block ${isT2Paid ? 'text-emerald-600 line-through' : 'text-blue-700'}`}>
                            {t2.toLocaleString('tr-TR')} ₺
                          </span>
                          <span className="text-[10px] text-slate-400">{isT2Paid ? 'Ödendi' : formatDateTR(inv.term2_due_date)}</span>
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {!isT1Paid && (
                                <button
                                  onClick={() => handlePaySubcontractorTerm(inv, 'term1')}
                                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-1 rounded text-[10px] transition">
                                  1. Vadeyi Öde
                                </button>
                              )}
                              {!isT2Paid && (
                                <button
                                  onClick={() => handlePaySubcontractorTerm(inv, 'term2')}
                                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-1 rounded text-[10px] transition">
                                  2. Vadeyi Öde
                                </button>
                              )}
                              {(!isT1Paid || !isT2Paid) && (
                                <button
                                  onClick={() => handlePaySubcontractorTerm(inv, 'both')}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-1 rounded text-[10px] transition shadow-xs">
                                  Tamamını Öde
                                </button>
                              )}

                              <button 
                                onClick={() => {
                                  setEditingSubInvoice(inv);
                                  setSubEditFormData({
          invoiceNo: inv.invoice_no || '',
          totalAmount: String(inv.total_amount || ''),
          issueDate: sanitizeDate(inv.issue_date),
          term1DueDate: sanitizeDate(inv.term1_due_date),
          term1Amount: String(inv.term1_amount || ''),
          term1Status: inv.term1_status || 'pending',
          term2DueDate: sanitizeDate(inv.term2_due_date),
          term2Amount: String(inv.term2_amount || ''),
          term2Status: inv.term2_status || 'pending',
          advanceAmount: '',
          advanceInstallmentCount: '1'
        } as any);
                                  setIsEditSubModalOpen(true);
                                }}
                                className="bg-slate-100 hover:bg-blue-50 text-blue-700 border border-slate-200 font-semibold px-2 py-1 rounded text-[11px] inline-flex items-center gap-1 transition">
                                <Edit2 className="w-3 h-3" /> Düzenle
                              </button>
                              <button 
                                onClick={async () => {
                                  if (window.confirm(`${inv.invoice_no} kaydını silmek istediğinize emin misiniz?`)) {
                                    await supabase.from('invoices').delete().eq('id', inv.id);
                                    loadPortalData();
                                  }
                                }}
                                className="bg-slate-100 hover:bg-rose-50 text-rose-700 border border-slate-200 font-semibold px-2 py-1 rounded text-[11px] inline-flex items-center gap-1 transition">
                                <Trash2 className="w-3 h-3" /> Sil
                              </button>
                            </div>
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

        {/* 4. TAŞERON IBAN YÖNETİMİ */}
        {activeTab === 'sub_ibans' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Alt Yüklenici IBAN Veritabanı ({dbSubcontractors.length} Kayıt)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Banka ödeme talimatında taşeronla otomatik eşleşen IBAN havuzu.</p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                    <FileUp className="w-4 h-4" /> IBAN Exceli Yükle
                    <input type="file" accept=".xlsx,.xls" onChange={handleImportSubIbanExcel} className="hidden" />
                  </label>
                  <button 
                    onClick={() => {
                      setEditingSubIbanId(null);
                      setSubIbanFormData({ name: '', iban: '', phone: '' });
                      setIsSubIbanModalOpen(true);
                    }}
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
                        <td className="py-3 px-3 text-center space-x-2">
                          <button 
                            onClick={() => {
                              setEditingSubIbanId(s.id);
                              setSubIbanFormData({ name: s.name, iban: s.iban || '', phone: s.phone || '' });
                              setIsSubIbanModalOpen(true);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition" title="Düzenle">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={async () => {
                              if (window.confirm(`${s.name} IBAN kaydını silmek istiyor musunuz?`)) {
                                await supabase.from('subcontractors').delete().eq('id', s.id);
                                loadPortalData();
                              }
                            }}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition" title="Sil">
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

        {/* 5. BANKA ÖDEME TALİMATI */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Banka Toplu Ödeme Talimatı (Excel)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Kişi bazında 1. Vade / 2. Vade / Tümü seçin, canlı toplamı görün ve banka Exceli indirin.</p>
              </div>

              {isAdmin ? (
                <button 
                  onClick={handleDownloadBankExcel}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition">
                  <Download className="w-4 h-4" /> Seçilenleri Banka Exceli Olarak İndir
                </button>
              ) : (
                <span className="text-xs text-rose-600 font-bold">Raporör rolünde Excel indirme yetkisi kapalıdır.</span>
              )}
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-blue-900 block">Bankadan Çıkacak Seçili Toplam Tutar:</span>
                <span className="text-2xl font-black text-blue-700">
                  {bankLiveSelectionSummary.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </span>
              </div>
              <span className="bg-blue-200 text-blue-900 font-bold px-3 py-1 rounded-full text-xs">
                {bankLiveSelectionSummary.count} Alt Yüklenici Seçildi
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 text-center w-12">
                      <button 
                        onClick={handleToggleSelectAllBank}
                        className="font-bold text-blue-600 hover:underline">
                        {bankPaymentGroupedList.every(i => bankSelectedContractors[i.contractorName] !== false) ? 'Bırak' : 'Tümü'}
                      </button>
                    </th>
                    <th 
                      className="py-3 px-3 cursor-pointer select-none hover:text-blue-600 transition-colors"
                      onClick={() => {
                        if (bankSortField === 'contractorName') {
                          setBankSortOrder(bankSortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setBankSortField('contractorName');
                          setBankSortOrder('asc');
                        }
                      }}
                    >
                      Alt Yüklenici Adı {bankSortField === 'contractorName' ? (bankSortOrder === 'asc' ? '↑' : '↓') : '↕'}
                    </th>

                    <th 
                      className="py-3 px-3 cursor-pointer select-none hover:text-blue-600 transition-colors"
                      onClick={() => {
                        if (bankSortField === 'iban') {
                          setBankSortOrder(bankSortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setBankSortField('iban');
                          setBankSortOrder('asc');
                        }
                      }}
                    >
                      Kayıtlı IBAN {bankSortField === 'iban' ? (bankSortOrder === 'asc' ? '↑' : '↓') : '↕'}
                    </th>

                    <th className="py-3 px-3 text-center">Ödenecek Vade Seçeneği</th>

                    <th 
                      className="py-3 px-3 text-right cursor-pointer select-none hover:text-blue-600 transition-colors"
                      onClick={() => {
                        if (bankSortField === 'activeAmount') {
                          setBankSortOrder(bankSortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setBankSortField('activeAmount');
                          setBankSortOrder('desc');
                        }
                      }}
                    >
                      Net Ödenecek Tutar {bankSortField === 'activeAmount' ? (bankSortOrder === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
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
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                            <button
                              type="button"
                              onClick={() => setContractorTermChoices({ ...contractorTermChoices, [item.contractorName]: 'term1' })}
                              className={`px-2 py-1 text-[11px] font-semibold rounded ${item.choice === 'term1' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>
                              1. Vade ({item.term1Total.toLocaleString('tr-TR')} ₺)
                            </button>
                            <button
                              type="button"
                              onClick={() => setContractorTermChoices({ ...contractorTermChoices, [item.contractorName]: 'term2' })}
                              className={`px-2 py-1 text-[11px] font-semibold rounded ${item.choice === 'term2' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>
                              2. Vade ({item.term2Total.toLocaleString('tr-TR')} ₺)
                            </button>
                            <button
                              type="button"
                              onClick={() => setContractorTermChoices({ ...contractorTermChoices, [item.contractorName]: 'both' })}
                              className={`px-2 py-1 text-[11px] font-semibold rounded ${item.choice === 'both' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>
                              Tümü ({(item.term1Total + item.term2Total).toLocaleString('tr-TR')} ₺)
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-600 text-sm">
                          {item.activeAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. PERSONEL & BORDRO */}
        {activeTab === 'employees' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Personel & Maaş Yönetimi ({dbEmployees.length} Personel)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Personel listesi, telefon, IBAN dökümleri ve tek tıkla toplu maaş ödeme.</p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleOpenBulkSalaryModal}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                    <CheckSquare className="w-4 h-4" /> Toplu Maaş Öde (Seçimli)
                  </button>
                  <button 
                    onClick={() => {
                      setEditingEmployeeId(null);
                      setEmployeeFormData({ fullName: '', roleTitle: 'Kamyon Şoförü / Dağıtım', baseSalary: '', phone: '', iban: '', monthlyBonus: '', bonusDescription: '' });
                      setIsEmployeeModalOpen(true);
                    }}
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
                    <th className="py-3 px-3">Telefon</th>
                    <th className="py-3 px-3">IBAN Bilgisi</th>
                    <th className="py-3 px-3 text-right">Aylık Sabit Maaş</th>
                    {isAdmin && <th className="py-3 px-3 text-center">İşlem</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dbEmployees.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 font-bold text-slate-900 text-sm">{emp.full_name}</td>
                      <td className="py-3 px-3 font-medium text-slate-600">{emp.role_title}</td>
                      <td className="py-3 px-3 text-slate-700 font-medium">{formatPhone(emp.phone || '') || '-'}</td>
                      <td className="py-3 px-3 font-mono text-slate-700">{emp.iban || 'Belirtilmedi'}</td>
                      <td className="py-3 px-3 text-right font-bold text-indigo-700 text-sm">
                        {cleanNumber(emp.base_salary).toLocaleString('tr-TR')} ₺
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-3 text-center space-x-2">
                          <button 
                            onClick={() => {
                              setEditingEmployeeId(emp.id);
                              setEmployeeFormData({
                                fullName: emp.full_name || '',
                                roleTitle: emp.role_title || 'Kamyon Şoförü / Dağıtım',
                                baseSalary: String(emp.base_salary || ''),
                                phone: formatPhone(emp.phone || ''),
                                iban: emp.iban || '',
                                monthlyBonus: '',
                                bonusDescription: ''
                              });
                              setIsEmployeeModalOpen(true);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition" title="Düzenle">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={async () => {
                              if (window.confirm(`${emp.full_name} personelini silmek istediğinize emin misiniz?`)) {
                                await supabase.from('employees').delete().eq('id', emp.id);
                                loadPortalData();
                              }
                            }}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition" title="Sil">
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

        {/* 7. KREDİ KARTLARI */}
        {activeTab === 'credit_cards' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Kredi Kartları Takip Ajandası</h3>
                <p className="text-xs text-slate-500 mt-0.5">Son ödeme günleri, asgari ve ekstre tutarları.</p>
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
              {dbCreditCards.map((cc, idx) => {
                const stmtAmt = cleanNumber(cc.statement_amount);
                const minAmt = cleanNumber(cc.min_payment_amount);
                const hasDebt = stmtAmt > 0;

                return (
                  <div key={cc.id || idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 flex flex-col justify-between shadow-xs">
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-900 text-sm">{cc.card_name}</span>
                        <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">
                          {cc.bank_name} {cc.last_four_digits ? `(•${cc.last_four_digits})` : ''}
                        </span>
                      </div>

                      <div className="pt-2 mt-2 border-t border-slate-200 space-y-1 text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Ekstre Borcu:</span>
                          <span className={`font-bold ${hasDebt ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {hasDebt ? `${stmtAmt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : 'Borç Yok (0,00 ₺)'}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Asgari Tutar:</span>
                          <span className="font-semibold text-amber-700">
                            {minAmt > 0 ? `${minAmt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600 pt-1">
                          <span>Son Ödeme Tarihi:</span>
                          <span className="font-bold text-slate-800">{formatDateTR(cc.due_date)}</span>
                        </div>
                      </div>
                    </div>

                    {/* İŞLEM VE ÖDEME BUTONLARI */}
                    {isAdmin && (
                      <div className="pt-2 border-t border-slate-200/80 flex flex-col gap-1.5">
                        <div className="flex gap-1.5">
                          {hasDebt && (
                            <>
                              <button
                                type="button"
                                onClick={() => handlePayCreditCard(cc, 'full')}
                                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] transition shadow-xs text-center">
                                Tamamını Öde
                              </button>
                              {minAmt > 0 && minAmt < stmtAmt && (
                                <button
                                  type="button"
                                  onClick={() => handlePayCreditCard(cc, 'min')}
                                  className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-[10px] transition shadow-xs text-center">
                                  Asgariyi Öde
                                </button>
                              )}
                            </>
                          )}
                        </div>

                        <div className="flex gap-2 justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => openEditCreditCardModal(cc)}
                            className="text-blue-600 hover:underline font-semibold text-xs flex items-center gap-1">
                            <Edit2 className="w-3 h-3" /> Düzenle
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm(`${cc.card_name} kartını silmek istediğinize emin misiniz?`)) {
                                await supabase.from('credit_cards').delete().eq('id', cc.id);
                                loadPortalData();
                              }
                            }}
                            className="text-rose-600 hover:underline font-semibold text-xs flex items-center gap-1">
                            <Trash2 className="w-3 h-3" /> Sil
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 8. ARAÇ FİLOSU */}
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

{/* 4 ÖZET KART (TÜM FİLO SABİT & DİĞER GİDERLER) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 shadow-sm">
                <span className="text-[11px] font-medium text-slate-500 uppercase block">Toplam Sigorta (Yıllık)</span>
                <span className="text-base font-bold text-slate-800 block mt-1">
                  {dbVehicles.reduce((sum, v) => sum + cleanNumber(v.insurance_cost || 0), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </span>
                <span className="text-[10px] text-slate-400">{dbVehicles.length} Öz Mal Araç</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 shadow-sm">
                <span className="text-[11px] font-medium text-slate-500 uppercase block">Toplam Kasko (Yıllık)</span>
                <span className="text-base font-bold text-slate-800 block mt-1">
                  {dbVehicles.reduce((sum, v) => sum + cleanNumber(v.kasko_cost || 0), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </span>
                <span className="text-[10px] text-slate-400">Poliçe Toplamı</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 shadow-sm">
                <span className="text-[11px] font-medium text-slate-500 uppercase block">Toplam MTV & Muayene</span>
                <span className="text-base font-bold text-slate-800 block mt-1">
                  {dbVehicles.reduce((sum, v) => sum + cleanNumber(v.last_mtv_cost || 0) + cleanNumber(v.inspection_cost || 0), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </span>
                <span className="text-[10px] text-slate-400">Yıllık Yasal Yük</span>
              </div>

              <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5 shadow-sm">
                <span className="text-[11px] font-semibold text-blue-700 uppercase block">FİLO SABİT GİDER TOPLAMI</span>
                <span className="text-base font-black text-blue-900 block mt-1">
                  {dbVehicles.reduce((sum, v) => sum + cleanNumber(v.insurance_cost || 0) + cleanNumber(v.kasko_cost || 0) + cleanNumber(v.last_mtv_cost || 0) + cleanNumber(v.inspection_cost || 0), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </span>
                <span className="text-[10px] font-medium text-blue-600">
                  Aylık: {(dbVehicles.reduce((sum, v) => sum + cleanNumber(v.insurance_cost || 0) + cleanNumber(v.kasko_cost || 0) + cleanNumber(v.last_mtv_cost || 0) + cleanNumber(v.inspection_cost || 0), 0) / 12).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺ / ay
                </span>
              </div>
            </div>

            {/* DİNAMİK MALİYET TABLOSU */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">PLAKA</th>
                    <th className="py-3 px-3">SÜRÜCÜ</th>
                    <th className="py-3 px-3">SİGORTA (TUTAR / BİTİŞ)</th>
                    <th className="py-3 px-3">KASKO (TUTAR / BİTİŞ)</th>
                    <th className="py-3 px-3">YILLIK MTV</th>
                    <th className="py-3 px-3">MUAYENE</th>
                    <th className="py-3 px-3 text-right">DİĞER GİDERLER</th>
                    <th className="py-3 px-3 text-right">TOPLAM MALİYET</th>
                    {isAdmin && <th className="py-3 px-3 text-center">İŞLEM</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dbVehicles.map((v, idx) => {
                    const plate = (v.plate_number || '').trim();
                    const cleanPlate = plate.replace(/\s+/g, '').toUpperCase();

                    // Plakaya ait genel giderleri eşleştir
                    const plateExpenses = cleanPlate.length >= 5 ? dbInvoices.filter(inv => {
                      const desc = (inv.description || '').replace(/\s+/g, '').toUpperCase();
                      const invNo = (inv.invoice_no || '').replace(/\s+/g, '').toUpperCase();
                      return (
                        inv.category !== 'freight_sales' &&
                        inv.category !== 'customer_collection' &&
                        (desc.includes(cleanPlate) || invNo.includes(cleanPlate))
                      );
                    }) : [];

                    const otherCost = plateExpenses.reduce((sum, e) => sum + cleanNumber(e.total_amount), 0);
                    const sigortaAmt = cleanNumber(v.insurance_cost || 0);
                    const kaskoAmt = cleanNumber(v.kasko_cost || 0);
                    const mtvAmt = cleanNumber(v.last_mtv_cost || 0);
                    const muayeneAmt = cleanNumber(v.inspection_cost || 0);

                    const fixedCost = sigortaAmt + kaskoAmt + mtvAmt + muayeneAmt;
                    const totalCost = fixedCost + otherCost;

                    return (
                      <tr key={v.id || idx} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-3 font-mono font-bold text-blue-700">{plate || '-'}</td>
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
                            {otherCost > 0 ? `${otherCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : '-'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-black text-slate-900 text-sm">
                          {totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => openEditVehicleModal(v)}
                              className="text-blue-600 hover:text-blue-800 font-medium text-xs">
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
        )}

        {/* 9. ÖZ MAL KARLILIK & MALİYET */}
        {activeTab === 'profitability' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center pb-5 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Öz Mal Araç Karlılık & Sefer Analizi</h3>
                <p className="text-xs text-slate-500 mt-0.5">Plaka bazlı fatura cirosu, yakıt, HGS, maaş ve net faaliyet kârı.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Dönem</th>
                    <th className="py-3 px-3">Plaka</th>
                    <th className="py-3 px-3 text-right">Fatura Cirosu</th>
                    <th className="py-3 px-3 text-right">Sürücü Maaşı</th>
                    <th className="py-3 px-3 text-right">Akaryakıt (KDV Hariç)</th>
                    <th className="py-3 px-3 text-right">HGS (KDV Hariç)</th>
                    <th className="py-3 px-3 text-right">Net Kâr / Zarar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dbProfitability.map((item, idx) => {
                    const totalCost = cleanNumber(item.driver_sal) + cleanNumber(item.fuel_ex_vat) + cleanNumber(item.hgs_ex_vat) + cleanNumber(item.bonus) + cleanNumber(item.sgk) + cleanNumber(item.other_exp);
                    const netProfit = cleanNumber(item.invoice_rev) - totalCost;
                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-3 font-semibold text-slate-700">{item.month_year}</td>
                        <td className="py-3 px-3 font-mono font-bold text-blue-700">{item.plate_number}</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">{cleanNumber(item.invoice_rev).toLocaleString('tr-TR')} ₺</td>
                        <td className="py-3 px-3 text-right text-slate-700">{cleanNumber(item.driver_sal).toLocaleString('tr-TR')} ₺</td>
                        <td className="py-3 px-3 text-right text-slate-700">{cleanNumber(item.fuel_ex_vat).toLocaleString('tr-TR')} ₺</td>
                        <td className="py-3 px-3 text-right text-slate-700">{cleanNumber(item.hgs_ex_vat).toLocaleString('tr-TR')} ₺</td>
                        <td className={`py-3 px-3 text-right font-bold text-sm ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {netProfit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 10. MÜŞTERİ TAHSİLATLARI */}
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
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Makbuz / Dekont No</th>
                    <th className="py-3 px-4">Tahsilat Tarihi</th>
                    <th className="py-3 px-4">Durum</th>
                    <th className="py-3 px-4 text-right">Tahsil Edilen Tutar</th>
                    {isAdmin && <th className="py-3 px-4 text-center">İşlem</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dbInvoices.filter(i => i.category === 'customer_collection').map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">{item.invoice_no}</td>
                      <td className="py-3 px-4 text-slate-600">{sanitizeDate(item.issue_date)}</td>
                      <td className="py-3 px-4">
                        <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2.5 py-0.5 rounded-full font-semibold">Tahsil Edildi</span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 text-sm">
                        +{cleanNumber(item.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleDeleteReceipt(item)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Tahsilatı Sil ve Faturayı Geri Aç">
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

        {/* 11. GENEL GİDERLER & TEDARİK */}
        {activeTab === 'general_expenses' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Genel Giderler & Tedarikçi Borçları</h3>
                <p className="text-xs text-slate-500 mt-0.5">Bakım, yedek parça, lastik, vergi ve fiili masraf dökümü.</p>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => {
                    setEditingExpenseId(null);
                    setExpenseFormData({
                      category: 'maintenance',
                      companyName: '',
                      plateNumber: '',
                      invoiceNo: '',
                      amount: '',
                      issueDate: new Date().toISOString().split('T')[0],
                      dueDate: new Date().toISOString().split('T')[0],
                      status: 'unpaid',
                      paidSource: 'bank'
                    });
                    setIsGeneralExpenseModalOpen(true);
                  }}
                  className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                  <Plus className="w-4 h-4" /> Yeni Gider / Fatura Ekle
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Açıklama / Belge</th>
                    <th className="py-3 px-4">Tarih</th>
                    <th className="py-3 px-4">Durum</th>
                    <th className="py-3 px-4 text-right">Tutar</th>
                    {isAdmin && <th className="py-3 px-4 text-center">İşlem</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dbInvoices.filter(i => !['subcontractor_invoice', 'customer_collection', 'freight_sales', 'cash_deposit'].includes(i.category)).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-medium text-slate-800">{item.invoice_no}</td>
                      <td className="py-3 px-4 text-slate-600">{sanitizeDate(item.issue_date)}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${item.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {item.status === 'paid' ? 'Ödendi' : 'Ödenecek'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 text-sm">
                        {cleanNumber(item.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-center space-x-2">
                          <button 
                            onClick={() => {
                              setEditingExpenseId(item.id);
                              setExpenseFormData({
                                category: item.category || 'maintenance',
                                companyName: item.invoice_no || '',
                                plateNumber: '',
                                invoiceNo: '',
                                amount: String(item.total_amount || ''),
                                issueDate: sanitizeDate(item.issue_date),
                                dueDate: sanitizeDate(item.due_date),
                                status: item.status || 'unpaid',
                                paidSource: 'bank'
                              });
                              setIsGeneralExpenseModalOpen(true);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition" title="Düzenle">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={async () => {
                              if (window.confirm(`${item.invoice_no} kaydını silmek istiyor musunuz?`)) {
                                await supabase.from('invoices').delete().eq('id', item.id);
                                loadPortalData();
                              }
                            }}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition" title="Sil">
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
      </main>

      {/* MODAL: PERSONEL EKLE & DÜZENLE (PRİM / EK MASRAF DESTEKLİ) */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">{editingEmployeeId ? 'Personeli Düzenle' : 'Yeni Personel Ekle'}</h3>
              <button onClick={() => setIsEmployeeModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveEmployee} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Adı Soyadı</label>
                <input type="text" placeholder="Örn: Ahmet Yılmaz" value={employeeFormData.fullName} onChange={e => setEmployeeFormData({ ...employeeFormData, fullName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Görevi</label>
                  <select 
                    value={employeeFormData.roleTitle} 
                    onChange={e => setEmployeeFormData({ ...employeeFormData, roleTitle: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-medium">
                    <option value="Kamyon Şoförü / Dağıtım">Kamyon Şoförü / Dağıtım</option>
                    <option value="Kamyon Şoförü (10 Palet)">Kamyon Şoförü (10 Palet)</option>
                    <option value="Tır Kaptanı / Frigo">Tır Kaptanı / Frigo</option>
                    <option value="Muhasebe & Finans">Muhasebe & Finans</option>
                    <option value="Operasyon Sorumlusu">Operasyon Sorumlusu</option>
                    <option value="Yönetici / İdari İşler">Yönetici / İdari İşler</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Aylık Sabit Maaş</label>
                  <input type="text" placeholder="56000" value={employeeFormData.baseSalary} onChange={e => setEmployeeFormData({ ...employeeFormData, baseSalary: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-indigo-700" required />
                </div>
              </div>

              {/* BU AYA AİT PRİM / EK MASRAF ALANI */}
              {editingEmployeeId && (
                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2">
                  <span className="font-bold text-amber-900 block text-xs">Bu Aya Ait Prim / Ek Ödeme</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-600">Prim Tutarı (TL)</label>
                      <input 
                        type="text" 
                        placeholder="Örn: 5000" 
                        value={employeeFormData.monthlyBonus} 
                        onChange={e => setEmployeeFormData({ ...employeeFormData, monthlyBonus: e.target.value })} 
                        className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white font-bold text-amber-800" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-600">Açıklama / Masraf Nedeni</label>
                      <input 
                        type="text" 
                        placeholder="Örn: Sefer Primi" 
                        value={employeeFormData.bonusDescription} 
                        onChange={e => setEmployeeFormData({ ...employeeFormData, bonusDescription: e.target.value })} 
                        className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white text-[11px]" 
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cep Telefonu</label>
                <input 
                  type="text" 
                  placeholder="05XX XXX XX XX" 
                  value={employeeFormData.phone} 
                  onChange={e => setEmployeeFormData({ ...employeeFormData, phone: formatPhone(e.target.value) })} 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium" 
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">IBAN Numarası</label>
                <input type="text" placeholder="TR87 0006 ..." value={employeeFormData.iban} onChange={e => setEmployeeFormData({ ...employeeFormData, iban: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-medium" />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsEmployeeModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-blue-600 text-white font-medium">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TAŞERONA MANUEL ÖDEME / AVANS YAP */}
      {isSubPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Taşerona Manuel Ödeme / Avans Yap</h3>
              <button onClick={() => setIsSubPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveSubPayment} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alt Yüklenici / Taşeron Seçin</label>
                <select 
                  value={subPaymentFormData.subcontractorName} 
                  onChange={e => setSubPaymentFormData({ ...subPaymentFormData, subcontractorName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white" required>
                  <option value="">-- Taşeron Seçiniz --</option>
                  {dbSubcontractors.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">İşlem Türü</label>
                <select 
                  value={subPaymentFormData.actionType} 
                  onChange={e => setSubPaymentFormData({ ...subPaymentFormData, actionType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-medium">
                  <option value="advance">Peşin Avans (Bu ayki hakedişten düşer)</option>
                  <option value="installment_advance">Taksitli Avans (Aylara bölerek mahsup eder)</option>
                  <option value="direct_payment">Doğrudan Ara Ödeme</option>
                </select>
              </div>

              {subPaymentFormData.actionType === 'installment_advance' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Taksit Sayısı</label>
                  <select 
                    value={subPaymentFormData.installmentCount} 
                    onChange={e => setSubPaymentFormData({ ...subPaymentFormData, installmentCount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-bold text-blue-700">
                    <option value="2">2 Taksit</option>
                    <option value="3">3 Taksit</option>
                    <option value="4">4 Taksit</option>
                    <option value="5">5 Taksit</option>
                    <option value="6">6 Taksit</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tutar (TL)</label>
                  <input 
                    type="text" 
                    placeholder="50000" 
                    value={subPaymentFormData.amount} 
                    onChange={e => setSubPaymentFormData({ ...subPaymentFormData, amount: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-rose-600 text-sm" 
                    required 
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">İşlem Tarihi</label>
                  <input 
                    type="date" 
                    value={subPaymentFormData.date} 
                    onChange={e => setSubPaymentFormData({ ...subPaymentFormData, date: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white" 
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ödeme Yapılan Hesap</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setSubPaymentFormData({ ...subPaymentFormData, targetAccount: 'bank' })} className={`p-2 rounded-lg border text-center transition ${subPaymentFormData.targetAccount === 'bank' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200'}`}>🏦 Banka Hesabı</button>
                  <button type="button" onClick={() => setSubPaymentFormData({ ...subPaymentFormData, targetAccount: 'cash' })} className={`p-2 rounded-lg border text-center transition ${subPaymentFormData.targetAccount === 'cash' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200'}`}>💵 Elden Kasa</button>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsSubPaymentModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-emerald-600 text-white font-medium">Ödemeyi Yap ve Kasadan Düş</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANUEL TAŞERON HAKEDİŞ FATURASI EKLE */}
      {isManualSubInvoiceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Manuel Hakediş / Fatura Ekle</h3>
              <button onClick={() => setIsManualSubInvoiceModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveManualSubInvoice} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alt Yüklenici / Taşeron Adı</label>
                <input 
                  type="text" 
                  placeholder="Örn: Umut Nakliyat" 
                  value={manualSubInvoiceData.subcontractorName} 
                  onChange={e => setManualSubInvoiceData({ ...manualSubInvoiceData, subcontractorName: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg" 
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fatura Numarası</label>
                  <input 
                    type="text" 
                    placeholder="GIB2026..." 
                    value={manualSubInvoiceData.invoiceNo} 
                    onChange={e => setManualSubInvoiceData({ ...manualSubInvoiceData, invoiceNo: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-medium" 
                    required 
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Toplam Tutar (TL)</label>
                  <input 
                    type="text" 
                    placeholder="125000" 
                    value={manualSubInvoiceData.totalAmount} 
                    onChange={e => setManualSubInvoiceData({ ...manualSubInvoiceData, totalAmount: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-900" 
                    required 
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-600">Fatura Tarihi</label>
                  <input type="date" value={manualSubInvoiceData.issueDate} onChange={e => setManualSubInvoiceData({ ...manualSubInvoiceData, issueDate: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white text-[11px]" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-600">1. Vade (Yarısı)</label>
                  <input type="date" value={manualSubInvoiceData.term1DueDate} onChange={e => setManualSubInvoiceData({ ...manualSubInvoiceData, term1DueDate: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white text-[11px]" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-600">2. Vade (Kalan)</label>
                  <input type="date" value={manualSubInvoiceData.term2DueDate} onChange={e => setManualSubInvoiceData({ ...manualSubInvoiceData, term2DueDate: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white text-[11px]" />
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsManualSubInvoiceModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-blue-600 text-white font-medium">Hakedişi Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TAŞERON IBAN EKLE & DÜZENLE */}
      {isSubIbanModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">{editingSubIbanId ? 'IBAN Bilgisini Düzenle' : 'Alt Yüklenici IBAN Kaydet'}</h3>
              <button onClick={() => setIsSubIbanModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveSubIban} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Taşeron Adı / Unvanı</label>
                <input type="text" placeholder="Örn: Ahmet Aksu" value={subIbanFormData.name} onChange={e => setSubIbanFormData({ ...subIbanFormData, name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" required />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">TR IBAN Numarası</label>
                <input type="text" placeholder="TR87 0006 ..." value={subIbanFormData.iban} onChange={e => setSubIbanFormData({ ...subIbanFormData, iban: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-medium" required />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsSubIbanModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-blue-600 text-white font-medium">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GENEL GİDER EKLE & DÜZENLE */}
      {isGeneralExpenseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">{editingExpenseId ? 'Gider Kaydını Düzenle' : 'Yeni Gider / Fatura Ekle'}</h3>
              <button onClick={() => setIsGeneralExpenseModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveGeneralExpense} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Gider Türü / Kategori</label>
                <select 
            value={expenseFormData.category} 
            onChange={e => setExpenseFormData({ ...expenseFormData, category: e.target.value })} 
            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-medium text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <optgroup label="🏢 Genel Şirket & Ofis Giderleri">
              <option value="office_expense">Ofis & Kırtasiye Masrafları</option>
              <option value="rent_utility">Kira, Elektrik, Su, Doğalgaz</option>
              <option value="software_telecom">Yazılım, Bilişim & Araç Takip (Arvento vb.)</option>
              <option value="advocate_consulting">Avukat / Hukuk & Danışmanlık</option>
              <option value="cargo_stationery">Kargo, Noter & Resmi Evrak</option>
              <option value="general_expense">Genel Şirket Masrafı (Diğer)</option>
            </optgroup>

            <optgroup label="🚚 Filo & Araç Giderleri">
              <option value="maintenance">Tamir / Bakım / Servis</option>
              <option value="tires">Lastik / Yedek Parça</option>
              <option value="general_fuel">Genel Akaryakıt / Mazot</option>
              <option value="traffic_fines">Trafik Cezası / Ceza</option>
              <option value="insurance_inspection">Muayene, Sigorta & Kasko</option>
              <option value="hgs">HGS / OGS Geçişleri</option>
            </optgroup>

            <optgroup label="⚖️ Resmi & Finansal Dengeleme">
              <option value="taxes_sgk">Devlet / Vergi / SGK Primleri</option>
              <option value="opening_balance">Kasa Açılış / Geçmiş Dönem Kasa Dengeleme</option>
              <option value="bank_commission">Banka Masrafı & Komisyonlar</option>
            </optgroup>
          </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tedarikçi / Firma / Açıklama</label>
                <input type="text" placeholder="Örn: Brisa Lastikçilik" value={expenseFormData.companyName} onChange={e => setExpenseFormData({ ...expenseFormData, companyName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tutar (TL)</label>
                  <input type="text" placeholder="15000" value={expenseFormData.amount} onChange={e => setExpenseFormData({ ...expenseFormData, amount: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-rose-600" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fatura / İşlem Tarihi</label>
                  <input type="date" value={expenseFormData.issueDate} onChange={e => setExpenseFormData({ ...expenseFormData, issueDate: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ödeme Durumu</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setExpenseFormData({ ...expenseFormData, status: 'unpaid' })} className={`p-2 rounded-lg border text-center transition ${expenseFormData.status === 'unpaid' ? 'bg-rose-50 border-rose-500 text-rose-700 font-bold' : 'bg-white border-slate-200'}`}>Ödenecek (Açık)</button>
                  <button type="button" onClick={() => setExpenseFormData({ ...expenseFormData, status: 'paid' })} className={`p-2 rounded-lg border text-center transition ${expenseFormData.status === 'paid' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold' : 'bg-white border-slate-200'}`}>Ödendi (Kapandı)</button>
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsGeneralExpenseModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-blue-600 text-white font-medium">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DİĞER MODALLAR: SATIŞ, TAHSİLAT, KASA, ARAÇ, KREDİ KARTI, HAKEDİŞ DÜZENLEME, TOPLU MAAŞ */}
      {isNewSaleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Yeni Satış Faturası Ekle</h3>
              <button onClick={() => setIsNewSaleModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={async e => {
              e.preventDefault();
              const amt = cleanNumber(newSaleFormData.amount);
              if (!newSaleFormData.invoiceNo || amt <= 0) return;
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
                alert('Satış faturası eklendi!');
                setIsNewSaleModalOpen(false);
                loadPortalData();
              } catch (err: any) { alert('Hata: ' + err.message); }
            }} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Müşteri / Firma Adı</label>
                <input type="text" placeholder="Örn: MİGROS TİCARET A.Ş." value={newSaleFormData.customerName} onChange={e => setNewSaleFormData({ ...newSaleFormData, customerName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fatura Numarası</label>
                  <input type="text" placeholder="EF12026..." value={newSaleFormData.invoiceNo} onChange={e => setNewSaleFormData({ ...newSaleFormData, invoiceNo: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-medium" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tutar (TL)</label>
                  <input type="text" placeholder="250000" value={newSaleFormData.amount} onChange={e => setNewSaleFormData({ ...newSaleFormData, amount: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-blue-700" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fatura Tarihi</label>
                  <input type="date" value={newSaleFormData.issueDate} onChange={e => setNewSaleFormData({ ...newSaleFormData, issueDate: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vade Tarihi</label>
                  <input type="date" value={newSaleFormData.dueDate} onChange={e => setNewSaleFormData({ ...newSaleFormData, dueDate: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsNewSaleModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-blue-600 text-white font-medium">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isNewReceiptModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Tahsilat Girişi Yap</h3>
              <button onClick={() => setIsNewReceiptModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveNewReceipt} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Müşteri / Cari Adı</label>
                <input type="text" value={newReceiptFormData.customerName} onChange={e => setNewReceiptFormData({ ...newReceiptFormData, customerName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" required />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tahsilat Hesabı</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setNewReceiptFormData({ ...newReceiptFormData, targetAccount: 'bank' })} className={`p-2 rounded-lg border text-center transition ${newReceiptFormData.targetAccount === 'bank' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200'}`}>🏦 Banka Hesabı</button>
                  <button type="button" onClick={() => setNewReceiptFormData({ ...newReceiptFormData, targetAccount: 'cash' })} className={`p-2 rounded-lg border text-center transition ${newReceiptFormData.targetAccount === 'cash' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200'}`}>💵 Kasa (Elden Nakit)</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tutar (TL)</label>
                  <input type="text" value={newReceiptFormData.amount} onChange={e => setNewReceiptFormData({ ...newReceiptFormData, amount: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-emerald-600 text-sm" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tahsil Tarihi</label>
                  <input type="date" value={newReceiptFormData.date} onChange={e => setNewReceiptFormData({ ...newReceiptFormData, date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white" />
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

      {isCashDepositModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Kasaya / Bankaya Para Girişi</h3>
              <button onClick={() => setIsCashDepositModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveCashDeposit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Giriş Türü</label>
                <select value={cashDepositFormData.depositType} onChange={e => setCashDepositFormData({ ...cashDepositFormData, depositType: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white">
                  <option value="partner_capital">Ortak Sermaye Fonu (Nakit Katkı)</option>
                  <option value="other_deposit">Diğer Nakit Para Girişi</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Yatırılan Hesap</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setCashDepositFormData({ ...cashDepositFormData, targetAccount: 'bank' })} className={`p-2 rounded-lg border text-center transition ${cashDepositFormData.targetAccount === 'bank' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200'}`}>🏦 Banka Hesabı</button>
                  <button type="button" onClick={() => setCashDepositFormData({ ...cashDepositFormData, targetAccount: 'cash' })} className={`p-2 rounded-lg border text-center transition ${cashDepositFormData.targetAccount === 'cash' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200'}`}>💵 Elden Kasa</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tutar (TL)</label>
                  <input type="text" placeholder="1000000" value={cashDepositFormData.amount} onChange={e => setCashDepositFormData({ ...cashDepositFormData, amount: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-blue-700 text-sm" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tarih</label>
                  <input type="date" value={cashDepositFormData.date} onChange={e => setCashDepositFormData({ ...cashDepositFormData, date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Açıklama</label>
                <input type="text" placeholder="Örn: Ortak Sermaye Katkısı" value={cashDepositFormData.title} onChange={e => setCashDepositFormData({ ...cashDepositFormData, title: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsCashDepositModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-slate-800 text-white font-medium">Hesaba İşle</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isBulkSalaryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Toplu Personel Maaş Ödemesi</h3>
              <button onClick={() => setIsBulkSalaryModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="py-3 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Ödeme Kaynağı:</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setBulkSalarySource('bank')} className={`px-3 py-1.5 rounded-lg border font-bold transition ${bulkSalarySource === 'bank' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200'}`}>🏦 Banka Hesabı</button>
                <button type="button" onClick={() => setBulkSalarySource('cash')} className={`px-3 py-1.5 rounded-lg border font-bold transition ${bulkSalarySource === 'cash' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200'}`}>💵 Elden Nakit (Kasa)</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 py-2">
              {Object.keys(bulkSalaryItems).map(idStr => {
                const id = Number(idStr);
                const item = bulkSalaryItems[id];
                return (
                  <div key={id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs gap-3">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={item.selected} onChange={e => setBulkSalaryItems({ ...bulkSalaryItems, [id]: { ...item, selected: e.target.checked } })} className="w-4 h-4 rounded text-blue-600" />
                      <div>
                        <span className="font-bold text-slate-900 block">{item.name}</span>
                        <span className="text-[10px] text-slate-400">{item.role}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-[10px]">Ödenecek:</span>
                      <input type="text" value={item.amount} onChange={e => setBulkSalaryItems({ ...bulkSalaryItems, [id]: { ...item, amount: e.target.value } })} className="w-24 px-2 py-1 border border-slate-200 rounded bg-white font-bold text-right text-indigo-700" />
                      <span>₺</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="pt-3 border-t border-slate-100 flex gap-3">
              <button type="button" onClick={() => setIsBulkSalaryModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200 text-xs">İptal</button>
              <button type="button" onClick={handleExecuteBulkSalaryPay} className="w-1/2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">Maaşları Öde ve Kasadan Düş</button>
            </div>
          </div>
        </div>
      )}

      {isVehicleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">{editingVehicleId ? 'Araç ve Poliçe Bilgilerini Düzenle' : 'Filoya Yeni Araç Ekle'}</h3>
              <button onClick={() => setIsVehicleModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveVehicle} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Araç Plakası</label>
                  <input type="text" placeholder="34 TZY 101" value={vehicleFormData.plateNumber} onChange={e => setVehicleFormData({ ...vehicleFormData, plateNumber: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg uppercase font-mono font-bold" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sürücü Adı Soyadı</label>
                  <input type="text" placeholder="Örn: Ercan Çelik" value={vehicleFormData.driverName} onChange={e => setVehicleFormData({ ...vehicleFormData, driverName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2">
                <span className="font-bold text-blue-900 block text-xs">Trafik Sigortası Poliçesi</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-600">Sigorta Şirketi</label>
                    <input type="text" placeholder="AXA" value={vehicleFormData.insuranceCompany} onChange={e => setVehicleFormData({ ...vehicleFormData, insuranceCompany: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">Sigorta Bedeli (TL)</label>
                    <input type="text" placeholder="12500" value={vehicleFormData.insuranceCost} onChange={e => setVehicleFormData({ ...vehicleFormData, insuranceCost: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">Yapıldığı Tarih</label>
                    <input type="date" value={vehicleFormData.insuranceStartDate} onChange={e => setVehicleFormData({ ...vehicleFormData, insuranceStartDate: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white" />
                  </div>
                </div>
              </div>
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200 space-y-2">
                <span className="font-bold text-purple-900 block text-xs">Kasko Poliçesi</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-600">Kasko Şirketi</label>
                    <input type="text" placeholder="ALLIANZ" value={vehicleFormData.kaskoCompany} onChange={e => setVehicleFormData({ ...vehicleFormData, kaskoCompany: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">Kasko Bedeli (TL)</label>
                    <input type="text" placeholder="45000" value={vehicleFormData.kaskoCost} onChange={e => setVehicleFormData({ ...vehicleFormData, kaskoCost: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">Yapıldığı Tarih</label>
                    <input type="date" value={vehicleFormData.kaskoStartDate} onChange={e => setVehicleFormData({ ...vehicleFormData, kaskoStartDate: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white" />
                  </div>
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 block text-xs">Muayene ve MTV Takvimi</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-600">Sonraki Muayene</label>
                    <input type="date" value={vehicleFormData.nextInspectionDate} onChange={e => setVehicleFormData({ ...vehicleFormData, nextInspectionDate: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">Muayene Harcı (TL)</label>
                    <input type="text" placeholder="2800" value={vehicleFormData.inspectionCost} onChange={e => setVehicleFormData({ ...vehicleFormData, inspectionCost: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">Son MTV Tutarı (TL)</label>
                    <input type="text" placeholder="3500" value={vehicleFormData.lastMtvCost} onChange={e => setVehicleFormData({ ...vehicleFormData, lastMtvCost: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white" />
                  </div>
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsVehicleModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" disabled={isSavingVehicle} className="w-1/2 py-2 rounded-lg bg-blue-600 text-white font-medium">{isSavingVehicle ? 'Kaydediliyor...' : 'Kaydet'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCreditCardModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-base">
                {editingCreditCardId ? 'Kredi Kartı Düzenle & Ekstre Güncelle' : 'Yeni Kredi Kartı Ekle'}
              </h3>
              <button 
                onClick={() => {
                  setIsCreditCardModalOpen(false);
                  setEditingCreditCardId(null);
                }} 
                className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={async e => {
              e.preventDefault();
              if (!creditCardFormData.cardName || !creditCardFormData.dueDate) return;
              try {
                const payload = {
                  card_name: creditCardFormData.cardName.trim(),
                  bank_name: creditCardFormData.bankName.trim(),
                  last_four_digits: creditCardFormData.lastFourDigits.trim(),
                  statement_amount: cleanNumber(creditCardFormData.statementAmount),
                  min_payment_amount: cleanNumber(creditCardFormData.minPaymentAmount),
                  due_date: creditCardFormData.dueDate
                };

                if (editingCreditCardId) {
                  const { error } = await supabase.from('credit_cards').update(payload).eq('id', editingCreditCardId);
                  if (error) throw error;
                  alert('Kredi kartı bilgileri ve güncel ekstre başarıyla kaydedildi!');
                } else {
                  const { error } = await supabase.from('credit_cards').insert([payload]);
                  if (error) throw error;
                  alert('Yeni kredi kartı eklendi!');
                }

                setIsCreditCardModalOpen(false);
                setEditingCreditCardId(null);
                setCreditCardFormData({
                  cardName: '',
                  bankName: '',
                  lastFourDigits: '',
                  statementAmount: '',
                  minPaymentAmount: '',
                  dueDate: ''
                });
                loadPortalData();
              } catch (err: any) { 
                alert('Kart kaydetme hatası: ' + err.message); 
              }
            }} className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kart Adı / Sahibi</label>
                  <input type="text" placeholder="Şirket Kartı" value={creditCardFormData.cardName} onChange={e => setCreditCardFormData({ ...creditCardFormData, cardName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Banka Adı</label>
                  <input type="text" placeholder="Garanti BBVA" value={creditCardFormData.bankName} onChange={e => setCreditCardFormData({ ...creditCardFormData, bankName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" required />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Son 4 Hane</label>
                  <input type="text" placeholder="3533" maxLength={4} value={creditCardFormData.lastFourDigits} onChange={e => setCreditCardFormData({ ...creditCardFormData, lastFourDigits: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-center" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ekstre (TL)</label>
                  <input type="text" placeholder="45000" value={creditCardFormData.statementAmount} onChange={e => setCreditCardFormData({ ...creditCardFormData, statementAmount: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-rose-600" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Asgari (TL)</label>
                  <input type="text" placeholder="9000" value={creditCardFormData.minPaymentAmount} onChange={e => setCreditCardFormData({ ...creditCardFormData, minPaymentAmount: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-amber-700" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Son Ödeme Tarihi</label>
                <input type="date" value={creditCardFormData.dueDate} onChange={e => setCreditCardFormData({ ...creditCardFormData, dueDate: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white" required />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => { setIsCreditCardModalOpen(false); setEditingCreditCardId(null); }} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-blue-600 text-white font-medium">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditSubModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Hakediş Düzenleme & Avans Mahsubu</h3>
              <button onClick={() => setIsEditSubModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveSubInvoiceEdit} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fatura No / Taşeron</label>
                  <input type="text" value={subEditFormData.invoiceNo} onChange={e => setSubEditFormData({ ...subEditFormData, invoiceNo: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-medium" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fatura Toplam Tutar (TL)</label>
                  <input type="text" value={subEditFormData.totalAmount} onChange={e => setSubEditFormData({ ...subEditFormData, totalAmount: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-900" required />
                </div>
              </div>
             <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-950 text-xs">Avans / Kısmi Ödeme Mahsubu</span>
              <span className="text-[10px] text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full font-medium">1. ve Taşan Tutar 2. Vadeden Düşer</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-slate-600 mb-1">Düşülecek Avans Tutarı (TL)</label>
                <input 
                  type="text" 
                  placeholder="Örn: 50000" 
                  value={subEditFormData.advanceAmount} 
                  onChange={e => setSubEditFormData({ ...subEditFormData, advanceAmount: e.target.value })} 
                  className="w-full px-2 py-1.5 border border-amber-300 rounded-lg text-xs bg-white font-semibold text-slate-800" 
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-600 mb-1">Taksit Sayısı</label>
                <select 
                  value={subEditFormData.advanceInstallmentCount} 
                  onChange={e => setSubEditFormData({ ...subEditFormData, advanceInstallmentCount: e.target.value })} 
                  className="w-full px-2 py-1.5 border border-amber-300 rounded-lg text-xs bg-white text-slate-800"
                >
                  <option value="1">1 Taksit (Tamamı Bu Faturadan)</option>
                  <option value="2">2 Taksit</option>
                  <option value="3">3 Taksit</option>
                  <option value="4">4 Taksit</option>
                  <option value="5">5 Taksit</option>
                  <option value="6">6 Taksit</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-blue-900 text-xs">1. Vade Tutarı</span>
                <select
                  value={(subEditFormData as any).term1Status || 'pending'}
                  onChange={e => setSubEditFormData({ ...subEditFormData, term1Status: e.target.value } as any)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    (subEditFormData as any).term1Status === 'paid' 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}
                >
                  <option value="pending">Bekliyor (Açık)</option>
                  <option value="paid">Ödendi (Kapalı)</option>
                </select>
              </div>
              <input 
                type="text" 
                value={subEditFormData.term1Amount} 
                onChange={e => setSubEditFormData({ ...subEditFormData, term1Amount: e.target.value })} 
                className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-semibold" 
              />
              <input 
                type="date" 
                value={subEditFormData.term1DueDate} 
                onChange={e => setSubEditFormData({ ...subEditFormData, term1DueDate: e.target.value })} 
                className="w-full px-2 py-1 border border-slate-200 rounded text-[11px] text-slate-600" 
              />
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-blue-900 text-xs">2. Vade Tutarı</span>
                <select
                  value={(subEditFormData as any).term2Status || 'pending'}
                  onChange={e => setSubEditFormData({ ...subEditFormData, term2Status: e.target.value } as any)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    (subEditFormData as any).term2Status === 'paid' 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}
                >
                  <option value="pending">Bekliyor (Açık)</option>
                  <option value="paid">Ödendi (Kapalı)</option>
                </select>
              </div>
              <input 
                type="text" 
                value={subEditFormData.term2Amount} 
                onChange={e => setSubEditFormData({ ...subEditFormData, term2Amount: e.target.value })} 
                className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-semibold" 
              />
              <input 
                type="date" 
                value={subEditFormData.term2DueDate} 
                onChange={e => setSubEditFormData({ ...subEditFormData, term2DueDate: e.target.value })} 
                className="w-full px-2 py-1 border border-slate-200 rounded text-[11px] text-slate-600" 
              />
            </div>
          </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsEditSubModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-blue-600 text-white font-medium">Değişiklikleri Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 360° ÇEKMECE PANELİ */}
      {drawerData.isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div onClick={() => setDrawerData({ ...drawerData, isOpen: false })} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-from-right duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">{drawerData.title}</h3>
                {drawerData.subtitle && <p className="text-xs text-slate-500 mt-0.5">{drawerData.subtitle}</p>}
              </div>
              <button onClick={() => setDrawerData({ ...drawerData, isOpen: false })} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
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
                          <span>{item.invoice_no || item.month_year || 'Kayıt'}</span>
                          <span className="text-blue-700">{(item.total_amount || item.invoice_rev || 0).toLocaleString('tr-TR')} ₺</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500">
                          <span>Tarih: {item.due_date || item.issue_date || '-'}</span>
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
    </div>
  );
}
