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
  FileText,
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
  MoreHorizontal,
  Download,
  ShieldCheck,
  Phone,
  Contact,
  Tag
} from 'lucide-react';
import { supabase } from './supabase';
import { fetchUserRole } from './auth';
import { fetchAllRows, matchCustomer, resolveInvoiceCustomer, invoiceBelongsToCustomer, isLegacyCrcInvoice, retitleInvoiceCustomer, findCrcCustomer, type Customer } from './db';
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

function normalizeContractorKey(str: string) {
  return (str || '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

function extractContractorName(invoiceNo: string) {
  const full = String(invoiceNo || '').trim();
  const parts = full.split(' - ').map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1].replace(/\([^)]*\)/g, '').trim();
  return full;
}

function extractAdvanceContractorName(invoiceNo: string) {
  return extractContractorName(String(invoiceNo || '').replace(/^AVANS\s*-?\s*/i, ''))
    .replace(/\([^)]*\)/g, '')
    .trim();
}

function contractorKeysLooselyMatch(a: string, b: string) {
  const ka = normalizeContractorKey(a);
  const kb = normalizeContractorKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (ka.length >= 4 && kb.includes(ka)) return true;
  if (kb.length >= 4 && ka.includes(kb)) return true;
  return false;
}

function amountsClose(a: number, b: number, tol = 0.05) {
  return Math.abs(Number(a) - Number(b)) <= tol;
}

function termPayLabel(term: 'term1' | 'term2' | string) {
  return term === 'term2' || term === '2' ? '2 nci ödeme' : '1 nci ödeme';
}

function turkishMonthName(dateStr: string) {
  const m = Number(String(dateStr || '').slice(5, 7));
  return ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'][m - 1] || '';
}

function pad2(n: number) {
  return n < 10 ? '0' + n : String(n);
}

function shiftYearMonth(year: number, month: number, add: number) {
  const d = new Date(year, month - 1 + add, 1);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

const PLATE_VEHICLE_TYPES = ['Çekici', 'Dorse', 'Kamyon', 'Kamyonet'] as const;

function normalizePlateVehicleType(raw: any) {
  const s = String(raw || '').trim().toLocaleLowerCase('tr-TR');
  if (s.includes('dorse')) return 'Dorse';
  if (s.includes('kamyonet')) return 'Kamyonet';
  if (s.includes('kamyon')) return 'Kamyon';
  if (s.includes('cekici') || s.includes('çekici')) return 'Çekici';
  return '';
}

function stripPlateTypeTag(notes: any) {
  return String(notes || '').replace(/^\[(Çekici|Dorse|Kamyon|Kamyonet)\]\s*/i, '').trim();
}

function plateVehicleTypeOf(row: any) {
  return normalizePlateVehicleType(row?.vehicle_type)
    || normalizePlateVehicleType((String(row?.notes || '').match(/^\[([^\]]+)\]/) || [])[1])
    || '';
}

function daysUntilDate(dateStr: string) {
  let d = String(dateStr || '').trim();
  if (!d) return null;
  if (d.includes('T')) d = d.split('T')[0];
  if (d.includes('.')) {
    const parts = d.split('.');
    if (parts.length === 3 && parts[2].length === 4) {
      d = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  d = d.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const [y, m, day] = d.split('-').map(Number);
  const now = new Date();
  const utcToday = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const utcThen = Date.UTC(y, m - 1, day);
  return Math.round((utcThen - utcToday) / 86400000);
}

function lastDateOfMonth(year: number, month: number) {
  const day = new Date(year, month, 0).getDate();
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function defaultContractorTermDates(issueDate: string) {
  const d = String(issueDate || '').slice(0, 10);
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(5, 7));
  if (!y || !m) return { term1: '', term2: '' };
  if (d.startsWith('2026-09')) return { term1: '2026-10-23', term2: '2026-11-05' };
  const n1 = shiftYearMonth(y, m, 1);
  const n2 = shiftYearMonth(y, m, 2);
  return { term1: lastDateOfMonth(n1.y, n1.m), term2: `${n2.y}-${pad2(n2.m)}-05` };
}

function contractorTermPayDate(issueDate: string, term: 'term1' | 'term2', fallback: string) {
  const d = String(issueDate || '').slice(0, 10);
  if (d.startsWith('2026-09')) return term === 'term1' ? '2026-10-23' : '2026-11-05';
  const dates = defaultContractorTermDates(d);
  return (term === 'term1' ? dates.term1 : dates.term2) || fallback;
}

function isBulkHakedisPaymentDesc(desc: string) {
  return /hakedi[sş]\s*ödem|1\.\s*vade|2\.\s*vade|1 nci ödeme|2 nci ödeme/i.test(String(desc || ''));
}

function foldPersonName(s: string) {
  return String(s || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, ' ')
    .trim();
}

function salaryPayrollMatchesEmployee(inv: any, emp: any) {
  if (String(inv?.category || '') !== 'salary_payroll') return false;
  const no = String(inv?.invoice_no || '');
  const id = String(emp?.id || '');
  if (id && new RegExp(`(?:#|\\(#)${id}\\b`).test(no)) return true;
  const empNorm = foldPersonName(emp?.full_name);
  const hay = foldPersonName(no);
  return !!empNorm && empNorm.length >= 3 && hay.includes(empNorm);
}

export default function App() {
  // 1. KULLANICI GİRİŞ & YETKİLENDİRME (RBAC)
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'reporter' | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const isAuthenticated = !!currentUserRole;

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const applySession = async (userId: string | undefined) => {
      if (!userId) {
        if (!cancelled) setCurrentUserRole(null);
        return;
      }
      const role = await fetchUserRole(userId);
      if (cancelled) return;
      if (!role) {
        await supabase.auth.signOut();
        setCurrentUserRole(null);
        return;
      }
      setCurrentUserRole(role);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session?.user.id).finally(() => {
        if (!cancelled) setAuthReady(true);
      });
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session?.user.id);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginBusy(true);
    try {
      const email = loginUsername.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: loginPassword,
      });
      if (error || !data.user) {
        const msg = (error?.message || '').toLowerCase();
        if (msg.includes('email not confirmed')) {
          setLoginError('E-posta henüz onaylanmamış. Supabase → Authentication → Users içinde kullanıcıya tıklayıp onaylayın (Confirm / Auto Confirm).');
        } else if (msg.includes('invalid login')) {
          setLoginError('E-posta veya şifre eşleşmedi. Users listesindeki tam e-postayı yazın; şifreyi Users ekranından sıfırlayabilirsiniz.');
        } else {
          setLoginError(error?.message || 'Hatalı e-posta veya şifre girdiniz!');
        }
        return;
      }
      const role = await fetchUserRole(data.user.id);
      if (!role) {
        await supabase.auth.signOut();
        setLoginError('Hesabınıza rol atanmamış. Supabase profiles kaydını kontrol edin.');
        return;
      }
      localStorage.removeItem('tazeyol_user_role');
      setCurrentUserRole(role);
    } catch {
      setLoginError('Giriş sırasında bir hata oluştu.');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('tazeyol_user_role');
    await supabase.auth.signOut();
    setCurrentUserRole(null);
  };

  const handleSavePlateRental = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!plateRentalForm.plate.trim() || !plateRentalForm.owner_name.trim()) {
      alert('Plaka ve plaka sahibi zorunludur.');
      return;
    }
    const row: any = {
      plate: plateRentalForm.plate.trim().toUpperCase(),
      owner_name: plateRentalForm.owner_name.trim(),
      phone: plateRentalForm.phone.trim() || null,
      start_date: sanitizeDate(plateRentalForm.start_date) || null,
      renewal_date: sanitizeDate(plateRentalForm.renewal_date) || null,
      rent_amount: cleanNumber(plateRentalForm.rent_amount),
      government_fee: cleanNumber(plateRentalForm.government_fee),
      collection_kind: plateRentalForm.collection_kind,
      payment_note: plateRentalForm.payment_note.trim() || null,
      next_amount: plateRentalForm.next_amount === '' ? null : cleanNumber(plateRentalForm.next_amount),
      notes: plateRentalForm.vehicle_type
        ? `[${plateRentalForm.vehicle_type}] ${stripPlateTypeTag(plateRentalForm.notes)}`.trim()
        : (stripPlateTypeTag(plateRentalForm.notes) || null),
      vehicle_type: plateRentalForm.vehicle_type || null
    };
    try {
      const save = (payload: any) =>
        editingPlateRentalId
          ? supabase.from('plate_rentals').update(payload).eq('id', editingPlateRentalId)
          : supabase.from('plate_rentals').insert([payload]);
      let { error } = await save(row);
      if (error && /vehicle_type/i.test(error.message || '')) {
        const { vehicle_type: _drop, ...withoutType } = row;
        const retry = await save(withoutType);
        error = retry.error;
      }
      if (error) throw error;
      setIsPlateRentalModalOpen(false);
      setEditingPlateRentalId(null);
      setPlateRentalForm(emptyPlateRentalForm);
      await loadPortalData();
    } catch (err: any) {
      alert('Plaka kaydı hatası: ' + (err.message || 'setup_plate_rentals.sql dosyasını SQL Editor’da çalıştırın.'));
    }
  };

  const handleDeletePlateRental = async (id: string) => {
    if (!isAdmin) return;
    if (!window.confirm('Bu plaka kaydını silmek istiyor musunuz? Kasa ve cariye bağlı değildir.')) return;
    const { error } = await supabase.from('plate_rentals').delete().eq('id', id);
    if (error) {
      alert('Silinemedi: ' + error.message);
      return;
    }
    loadPortalData();
  };

  const handleImportPlateRentals = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const toInsert: any[] = [];
      rows.forEach((row: any) => {
        const plate = String(row['Plaka'] || row['plaka'] || '').trim().toUpperCase();
        const owner = String(row['Yüklenici'] || row['Sahip'] || row['Ad'] || '').trim();
        if (!plate || !owner) return;
        const payNote = String(row['Ödeme'] || '').trim();
        const notes = String(row['Açıklama'] || '').trim();
        const isDevlet = /5k|devlet/i.test(`${payNote} ${notes}`);
        const govFromNote = (payNote.match(/(\d+)\s*k/i) ? Number(RegExp.$1) * 1000 : 0);
        toInsert.push({
          plate,
          owner_name: owner,
          phone: String(row['Telefon'] || '').trim() || null,
          start_date: sanitizeDate(row['Tarih']) || null,
          renewal_date: sanitizeDate(row['Yenileme Tarih'] || row['Yenileme Tarihi']) || null,
          rent_amount: isDevlet ? 0 : cleanNumber(row['Tutar']),
          government_fee: isDevlet ? (govFromNote || cleanNumber(row['Tutar'])) : cleanNumber(row['Devlet'] || 0),
          collection_kind: isDevlet ? 'devlet' : 'kira',
          payment_note: payNote || null,
          next_amount: row['Yenileme Tutar'] !== undefined && row['Yenileme Tutar'] !== '' ? cleanNumber(row['Yenileme Tutar']) : (cleanNumber(row.__EMPTY) || null),
          notes: notes || null,
          vehicle_type: normalizePlateVehicleType(row['Araç Tipi'] || row['Tip'] || row['Araç'] || '') || null
        });
      });
      if (!toInsert.length) {
        alert('Excel’de Plaka ve Yüklenici sütunu olan satır bulunamadı.');
        return;
      }
      let { error } = await supabase.from('plate_rentals').insert(toInsert);
      if (error && /vehicle_type/i.test(error.message)) {
        const retry = await supabase.from('plate_rentals').insert(toInsert.map(({ vehicle_type: _t, ...rest }) => rest));
        error = retry.error;
      }
      if (error) throw error;
      alert(`${toInsert.length} plaka kaydı yüklendi. Kasa ve cariye yazılmadı.`);
      loadPortalData();
    } catch (err: any) {
      alert('Plaka Excel hatası: ' + (err.message || 'Önce setup_plate_rentals.sql çalıştırın.'));
    } finally {
      e.target.value = '';
    }
  };

  const saveAppSetting = async (key: string, value: string) => {
    const { error } = await supabase.from('app_settings').upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    if (error) throw error;
  };

  const isAdmin = currentUserRole === 'admin';

    // 2. NAVİGASYON & TARİH FİLTRELERİ
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
 const [activeTab, setActiveTab] = useState<
    'overview' | 'customers' | 'subcontractors' | 'sub_accounts' | 'sub_ibans' | 'sales_customers' | 'employees' | 'fleet' | 'profitability' | 'collections' | 'credit_cards' | 'payments' | 'general_expenses' | 'plate_rentals'
  >('overview');
  const [subSearchTerm, setSubSearchTerm] = useState('');
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState('');
  const [ledgerSortField, setLedgerSortField] = useState<'name' | 'tax' | 'balance'>('name');
  const [ledgerSortOrder, setLedgerSortOrder] = useState<'asc' | 'desc'>('asc');
  const [subStatusFilter, setSubStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [subSortField, setSubSortField] = useState<'invoice_no' | 'issue_date' | 'total_amount'>('issue_date');
  const [subSortOrder, setSubSortOrder] = useState<'asc' | 'desc'>('desc');
  const [bankSortField, setBankSortField] = useState<'contractorName' | 'iban' | 'dueDate' | 'amount'>('dueDate');
  const [bankSortOrder, setBankSortOrder] = useState<'asc' | 'desc'>('desc');
  const [empSearchTerm, setEmpSearchTerm] = useState('');
  const [empSortField, setEmpSortField] = useState<'name' | 'salary' | 'netPayable'>('name');
  const [empSortOrder, setEmpSortOrder] = useState<'asc' | 'desc'>('asc');
  const [cardSortField, setCardSortField] = useState<'due' | 'amount' | 'bank' | 'name'>('due');
  const [cardSortOrder, setCardSortOrder] = useState<'asc' | 'desc'>('asc');
  const [cardDueFilter, setCardDueFilter] = useState<'all' | 'week' | 'overdue' | 'clear'>('all');
  const [cardMenuId, setCardMenuId] = useState<string | number | null>(null);
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
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const getPreviousYearMonth = () => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  };
  const [profitMonth, setProfitMonth] = useState(getPreviousYearMonth);
  const [monthlyInputRows, setMonthlyInputRows] = useState<any[]>([]);

  // 3. VERİTABANI STATE'LERİ
  const [dbVehicles, setDbVehicles] = useState<any[]>([]);
  const [dbInvoices, setDbInvoices] = useState<any[]>([]);
  const [dbEmployees, setDbEmployees] = useState<any[]>([]);
  const [dbAdvances, setDbAdvances] = useState<any[]>([]);
  const [dbCreditCards, setDbCreditCards] = useState<any[]>([]);
  const [dbSubcontractors, setDbSubcontractors] = useState<any[]>([]);
  const [dbSubcontractorsLedger, setDbSubcontractorsLedger] = useState<any[]>([]);
  const [dbPaymentBatches, setDbPaymentBatches] = useState<any[]>([]);
  const [dbAdvanceInstallments, setDbAdvanceInstallments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExcelUploading, setIsExcelUploading] = useState(false);
  const [dbEmployeeTransactions, setDbEmployeeTransactions] = useState<any[]>([]);
  const [dbCustomers, setDbCustomers] = useState<Customer[]>([]);
  const [dbPlateRentals, setDbPlateRentals] = useState<any[]>([]);
  const emptyPlateRentalForm = {
    plate: '',
    owner_name: '',
    phone: '',
    start_date: '',
    renewal_date: '',
    rent_amount: '',
    government_fee: '',
    collection_kind: 'kira' as 'kira' | 'devlet',
    payment_note: '',
    next_amount: '',
    notes: '',
    vehicle_type: '' as '' | 'Çekici' | 'Dorse' | 'Kamyon' | 'Kamyonet'
  };
  const [plateRentalForm, setPlateRentalForm] = useState(emptyPlateRentalForm);
  const [editingPlateRentalId, setEditingPlateRentalId] = useState<string | null>(null);
  const [isPlateRentalModalOpen, setIsPlateRentalModalOpen] = useState(false);
  const [plateRentalSearch, setPlateRentalSearch] = useState('');
  const [plateRentalSort, setPlateRentalSort] = useState<'renewal' | 'plate' | 'owner' | 'type' | 'amount'>('renewal');
  const [plateRentalTypeFilter, setPlateRentalTypeFilter] = useState<'all' | 'Çekici' | 'Dorse' | 'Kamyon' | 'Kamyonet'>('all');
  const [cashOpening, setCashOpening] = useState(1550000);
  const [cashOpeningAsOf, setCashOpeningAsOf] = useState('2026-11-04');
  const [sgkDriverAmount, setSgkDriverAmount] = useState(11148);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerFormData, setCustomerFormData] = useState({
    name: '',
    tax_id: '',
    tax_office: '',
    address: '',
    phone: '',
    email: '',
    notes: ''
  });
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [selectedCariCustomer, setSelectedCariCustomer] = useState<Customer | null>(null);
  const [selectedPayrollEmp, setSelectedPayrollEmp] = useState<any | null>(null);
  const [payrollFrom, setPayrollFrom] = useState('2026-10');
  const [payrollTo, setPayrollTo] = useState(() => {
    const d = new Date();
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  });

  const loadPortalData = async () => {
    setLoading(true);
    try {
      const load = async (table: string, order?: { column: string; ascending: boolean }) => {
        try {
          return await fetchAllRows(table, order);
        } catch (err) {
          console.error(table, err);
          return [];
        }
      };

      const [
        batchData,
        instData,
        vData,
        invData,
        empData,
        advData,
        ccData,
        subData,
        ledgerData,
        empTxData,
        customerData,
        settingsData,
        monthlyInputData,
        plateRentalData
      ] = await Promise.all([
        load('payment_batches'),
        load('advance_installments'),
        load('vehicles', { column: 'id', ascending: true }),
        load('invoices', { column: 'created_at', ascending: false }),
        load('employees', { column: 'id', ascending: true }),
        load('advance_payments', { column: 'created_at', ascending: false }),
        load('credit_cards', { column: 'due_date', ascending: true }),
        load('subcontractors', { column: 'name', ascending: true }),
        load('subcontractor_ledger'),
        load('employee_transactions', { column: 'created_at', ascending: false }),
        load('customers', { column: 'name', ascending: true }),
        load('app_settings'),
        load('vehicle_monthly_inputs'),
        load('plate_rentals', { column: 'renewal_date', ascending: true })
      ]);

      setDbPaymentBatches(batchData);
      setDbAdvanceInstallments(instData);
      setDbVehicles(vData);
      setDbInvoices(invData);
      setDbEmployees(empData);
      setDbAdvances(advData);
      setDbCreditCards(ccData);
      setDbSubcontractors(subData);
      setDbSubcontractorsLedger(ledgerData);
      setDbEmployeeTransactions(empTxData);
      setDbCustomers(customerData as Customer[]);
      setMonthlyInputRows(monthlyInputData);
      setDbPlateRentals(plateRentalData);

      const crcCard = findCrcCustomer(customerData as Customer[]);
      if (crcCard) {
        const moved = [];
        for (const inv of invData || []) {
          if (!isLegacyCrcInvoice(inv)) continue;
          const nextNo = retitleInvoiceCustomer(inv.invoice_no, crcCard.name);
          if (!nextNo || nextNo === inv.invoice_no) continue;
          const { error } = await supabase.from('invoices').update({ invoice_no: nextNo }).eq('id', inv.id);
          if (!error) {
            inv.invoice_no = nextNo;
            moved.push(inv.id);
          }
        }
        if (moved.length) setDbInvoices([...invData]);
      }

      const settings: Record<string, string> = {};
      settingsData.forEach((row: any) => {
        if (row?.key) settings[row.key] = String(row.value ?? '');
      });
      if (Object.prototype.hasOwnProperty.call(settings, 'cash_opening')) {
        const n = cleanNumber(settings.cash_opening);
        if (n > 0) setCashOpening(n);
      }
      if (Object.prototype.hasOwnProperty.call(settings, 'cash_opening_as_of') && settings.cash_opening_as_of) {
        setCashOpeningAsOf(sanitizeDate(settings.cash_opening_as_of) || settings.cash_opening_as_of);
      }
      if (Object.prototype.hasOwnProperty.call(settings, 'sgk_driver_amount')) {
        setSgkDriverAmount(cleanNumber(settings.sgk_driver_amount));
      }
    } catch (err) {
      console.error('Yükleme hatası:', err);
      alert('Veriler yüklenirken hata oluştu. Sayfayı yenileyin veya bağlantıyı kontrol edin.');
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

  const resolveEmployeeStart = (emp: any) => {
    const hire = sanitizeDate(emp?.hire_date);
    if (hire) return { date: hire, label: 'işe giriş' };
    const dates: string[] = [];
    const created = sanitizeDate(emp?.created_at);
    if (created) dates.push(created);
    const empIdStr = String(emp?.id || '');
    const empNorm = String(emp?.full_name || '').toLowerCase().trim();
    (dbEmployeeTransactions || []).forEach((tx: any) => {
      if (String(tx.employee_id) !== empIdStr) return;
      const d = sanitizeDate(tx.transaction_date || tx.created_at);
      if (d) dates.push(d);
    });
    (dbInvoices || []).forEach((inv: any) => {
      if (!salaryPayrollMatchesEmployee(inv, emp)) return;
      const d = sanitizeDate(inv.issue_date || inv.created_at);
      if (d) dates.push(d);
    });
    (dbAdvances || []).forEach((a: any) => {
      if (a.target_type !== 'employee') return;
      const targetId = String(a.target_id || '');
      const targetNorm = String(a.target_name || '').toLowerCase().trim();
      const isMatch =
        (targetId && targetId === empIdStr) ||
        (targetNorm.length >= 3 && empNorm && (targetNorm.includes(empNorm) || empNorm.includes(targetNorm)));
      if (!isMatch) return;
      const d = sanitizeDate(a.created_at || a.payment_date || a.issue_date);
      if (d) dates.push(d);
    });
    dates.sort();
    if (dates[0]) {
      const label = created && dates[0] === created ? 'kayıt tarihi' : 'ilk veri girişi';
      return { date: dates[0], label };
    }
    return { date: '', label: 'yok' };
  };

  const namesMatch = (a: string, b: string) => {
    const n = (s: string) => String(s || '').toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();
    const left = n(a);
    const right = n(b);
    return !!left && !!right && left === right;
  };

  const monthsBetween = (fromYm: string, toYm: string) => {
    const [fy, fm] = fromYm.split('-').map(Number);
    const [ty, tm] = toYm.split('-').map(Number);
    if (!fy || !fm || !ty || !tm) return 999;
    return (ty - fy) * 12 + (tm - fm);
  };

  const currentPayYearMonth = () => {
    const d = new Date();
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  };

  const personnelClosedYearMonth = () => {
    const d = new Date();
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    const prev = new Date(d.getFullYear(), d.getMonth(), 0);
    return `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`;
  };

  const personnelBooksStartYm = '2026-10';

  const yearMonthsBetween = (fromYm: string, toYm: string) => {
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    let from = fromYm || toYm;
    let to = toYm || from;
    if (from > to) return [];
    const months: string[] = [];
    let [y, m] = from.split('-').map(Number);
    const [ty, tm] = to.split('-').map(Number);
    let guard = 0;
    while ((y < ty || (y === ty && m <= tm)) && guard < 36) {
      months.push(`${y}-${pad(m)}`);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      guard += 1;
    }
    return months;
  };

  const employeeMatchesAdvance = (emp: any, a: any) => {
    if (a?.target_type !== 'employee') return false;
    const empIdStr = String(emp?.id || '');
    const targetId = String(a.target_id || '');
    if (empIdStr && targetId && targetId === empIdStr) return true;
    const empNorm = foldPersonName(emp?.full_name);
    const targetNorm = foldPersonName(a.target_name);
    return !!empNorm && empNorm.length >= 3 && !!targetNorm && (targetNorm.includes(empNorm) || empNorm.includes(targetNorm));
  };

  const employeeManualMovementsForMonth = (emp: any, yearMonth: string) => {
    let bonus = 0;
    let advanceCut = 0;
    if (!yearMonth || yearMonth < personnelBooksStartYm) return { bonus, advanceCut };
    const hireYm = sanitizeDate(emp?.hire_date).slice(0, 7);
    if (hireYm && yearMonth < hireYm) return { bonus, advanceCut };
    const empIdStr = String(emp?.id || '');

    (dbEmployeeTransactions || []).forEach((tx: any) => {
      if (String(tx.employee_id) !== empIdStr) return;
      const startYm = sanitizeDate(tx.transaction_date || tx.created_at).slice(0, 7);
      if (!startYm || startYm < personnelBooksStartYm) return;
      if (tx.type === 'bonus') {
        if (startYm === yearMonth) bonus += cleanNumber(tx.total_amount);
        return;
      }
      if (tx.type === 'advance') {
        if (startYm === yearMonth) advanceCut += cleanNumber(tx.total_amount);
        return;
      }
      if (tx.type === 'installment_advance') {
        const inst = Math.max(1, Number(tx.installment_count) || 1);
        const elapsed = monthsBetween(startYm, yearMonth);
        if (elapsed >= 0 && elapsed < inst) {
          advanceCut += cleanNumber(tx.monthly_cut || Math.round(cleanNumber(tx.total_amount) / inst));
        }
      }
    });

    (dbAdvances || []).forEach((a: any) => {
      if (!employeeMatchesAdvance(emp, a)) return;
      const startYm = sanitizeDate(a.issue_date || a.payment_date || a.created_at).slice(0, 7);
      if (!startYm || startYm < personnelBooksStartYm) return;
      const tot = cleanNumber(a.total_amount);
      if (a.payment_type === 'employee_bonus') {
        if (startYm === yearMonth) bonus += tot;
        return;
      }
      const remaining = a.remaining_amount === null || a.remaining_amount === undefined ? tot : cleanNumber(a.remaining_amount);
      const inst = Math.max(1, Number(a.total_installments) || 1);
      const isInst = inst > 1;
      if (isInst) {
        const elapsed = monthsBetween(startYm || yearMonth, yearMonth);
        if (elapsed >= 0 && elapsed < inst) {
          advanceCut += Math.min(remaining, tot / inst);
        }
      } else if (startYm === yearMonth) {
        advanceCut += remaining > 0 ? remaining : tot;
      }
    });

    return { bonus, advanceCut };
  };

  const employeePayForMonth = (emp: any, yearMonth: string) => {
    if (!yearMonth || yearMonth < personnelBooksStartYm) {
      return { base: 0, bonus: 0, advanceCut: 0, gross: 0, net: 0, carried: 0 };
    }
    const hireYm = sanitizeDate(emp?.hire_date).slice(0, 7);
    if (hireYm && yearMonth < hireYm) {
      return { base: 0, bonus: 0, advanceCut: 0, gross: 0, net: 0, carried: 0 };
    }
    const extra = employeeManualMovementsForMonth(emp, yearMonth);
    const base = cleanNumber(emp?.base_salary);
    const bonus = cleanNumber(emp?.monthly_bonus) + extra.bonus;
    const advanceCut = extra.advanceCut;
    const gross = base + bonus;
    const net = Math.max(0, gross - advanceCut);
    const carried = Math.max(0, advanceCut - gross);
    return { base, bonus, advanceCut, gross, net, carried };
  };

  const employeeUnpaidFromBooks = (emp: any) => {
    const hireYm = sanitizeDate(emp?.hire_date).slice(0, 7);
    let from = personnelBooksStartYm;
    if (hireYm && hireYm > from) from = hireYm;
    const closed = personnelClosedYearMonth();
    const current = currentPayYearMonth();
    let net = 0;
    if (closed >= from) {
      yearMonthsBetween(from, closed).forEach(ym => {
        net += employeePayForMonth(emp, ym).net;
      });
    }
    if (current > closed && current >= from) {
      const extra = employeeManualMovementsForMonth(emp, current);
      net += extra.bonus - extra.advanceCut;
    }
    const paidFrom = hireYm && hireYm > personnelBooksStartYm ? hireYm : personnelBooksStartYm;
    const paid = (dbInvoices || [])
      .filter((inv: any) => {
        if (!salaryPayrollMatchesEmployee(inv, emp)) return false;
        const d = sanitizeDate(inv.issue_date || inv.created_at);
        if (!d || d < `${paidFrom}-01`) return false;
        return true;
      })
      .reduce((s: number, inv: any) => s + cleanNumber(inv.total_amount), 0);
    return Math.round(Math.max(0, net - paid) * 100) / 100;
  };

  const employmentShareForMonth = (startDateRaw: any, yearMonth: string) => {
    const start = sanitizeDate(startDateRaw);
    if (!start || !yearMonth) return { factor: 0, daysWorked: 0, daysInMonth: 0, hireYm: '', startedThisMonth: false };
    const hireYm = start.slice(0, 7);
    const [y, m] = yearMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    if (yearMonth < hireYm) return { factor: 0, daysWorked: 0, daysInMonth, hireYm, startedThisMonth: false };
    if (yearMonth > hireYm) return { factor: 1, daysWorked: daysInMonth, daysInMonth, hireYm, startedThisMonth: false };
    const startDay = Math.max(1, Number(start.slice(8, 10)) || 1);
    const daysWorked = Math.max(0, daysInMonth - startDay + 1);
    return {
      factor: daysInMonth > 0 ? daysWorked / daysInMonth : 1,
      daysWorked,
      daysInMonth,
      hireYm,
      startedThisMonth: startDay > 1
    };
  };

// SEÇİLEN ALT YÜKLENİCİ CARİ DETAYI STATE'İ
  const [selectedSubcontractorForDetail, setSelectedSubcontractorForDetail] = useState<any | null>(null);
  
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
    dueDate: '',
    cardKind: 'company'
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
      dueDate: sanitizeDate(card.due_date),
      cardKind: card.card_kind === 'personal' || /şahsi|sahsi|kişisel|kisisel/i.test(String(card.card_name || '')) ? 'personal' : 'company'
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
    const isPersonal = card.card_kind === 'personal' || /şahsi|sahsi|kişisel|kisisel/i.test(String(card.card_name || ''));
    let cashAmt = payAmt;
    if (isPersonal) {
      const raw = window.prompt(
        `${card.card_name} şahsi kart.\nEkstre ödemesi: ${payAmt.toLocaleString('tr-TR')} ₺\n\nŞirket kasasından düşülecek tutar (şahsi harcama 0 yazın):`,
        '0'
      );
      if (raw === null) return;
      cashAmt = Math.max(0, cleanNumber(raw));
    }
    const confirmMsg = isPersonal
      ? `${card.card_name}\nEkstre: ${payAmt.toLocaleString('tr-TR')} ₺ kapanacak.\nKasadan düşecek: ${cashAmt.toLocaleString('tr-TR')} ₺`
      : `${card.card_name} (${card.bank_name})\n${typeLabel}: ${payAmt.toLocaleString('tr-TR')} ₺ kasadan düşecek.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const remainingAmt = Math.max(0, fullAmt - payAmt);

      const { error: cardErr } = await supabase
        .from('credit_cards')
        .update({
          statement_amount: remainingAmt,
          min_payment_amount: type === 'full' ? 0 : Math.max(0, minAmt - payAmt)
        })
        .eq('id', card.id);

      if (cardErr) throw cardErr;

      if (cashAmt > 0) {
        await supabase.from('invoices').insert([{
          invoice_no: `KART ÖDEME - ${card.card_name} ****${String(card.last_four_digits || '').replace(/\D/g, '').slice(-4)} [${card.bank_name}] nakit ödeme yapıldı (${typeLabel})`,
          direction: 'incoming',
          category: 'credit_card_payment',
          total_amount: cashAmt,
          issue_date: todayStr,
          due_date: todayStr,
          status: 'paid'
        }]);
      }

      alert(`Kart ekstresi güncellendi.${cashAmt > 0 ? ` Kasadan ${cashAmt.toLocaleString('tr-TR')} ₺ düşüldü.` : ' Kasaya dokunulmadı (şahsi).'}${remainingAmt > 0 ? `\nKalan ekstre: ${remainingAmt.toLocaleString('tr-TR')} ₺` : ''}`);
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
  const [isCashLedgerOpen, setIsCashLedgerOpen] = useState(false);
  const [cashLedgerFrom, setCashLedgerFrom] = useState('');
  const [cashLedgerTo, setCashLedgerTo] = useState('');
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

  // BANKA TALİMATI: fatura + vade satırı seçimi
  const [bankSelectedLines, setBankSelectedLines] = useState<{ [key: string]: boolean }>({});
  const [bankWaveFilter, setBankWaveFilter] = useState<'all' | 'term1' | 'term2'>('all');

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
    employerSgk: '',
    phone: '',
    iban: '',
    monthlyBonus: '',
    bonusDescription: '',
    monthlyAdvance: '',
    advanceDescription: '',
    hireDate: ''
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
    vehicleType: 'Kamyon',
    ownershipType: 'Öz Mal',
    isActive: true,
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
    dbSubcontractors.forEach(s => {
      if (s.name && s.iban) {
        map.set(normalizeContractorKey(s.name), s.iban.trim());
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
        const termDates = defaultContractorTermDates(rowDate);

        if (existingInvoicesMap.has(normKey)) {
          skippedCount++;
          continue;
        } else {
          // Sistemde yoksa: Yeni kayıt olarak ekle
          newRowsToInsert.push({
            invoice_no: fullTitle,
            direction: 'incoming',
            category: 'subcontractor_invoice',
            total_amount: totalAmt,
            issue_date: rowDate,
            due_date: termDates.term1 || rowDate,
            term1_due_date: termDates.term1 || rowDate,
            term1_amount: t1,
            term1_status: 'unpaid',
            term2_due_date: termDates.term2 || rowDate,
            term2_amount: t2,
            term2_status: 'unpaid',
            status: 'unpaid'
          });
          existingInvoicesMap.set(normKey, true);
        }
      }

      if (newRowsToInsert.length > 0) {
        const { error } = await supabase.from('invoices').insert(newRowsToInsert);
        if (error) throw error;
      }

      alert(`İşlem başarılı.\n• ${newRowsToInsert.length} yeni fatura eklendi.\n• ${skippedCount} fatura zaten kayıtlıydı, atlandı (yeniden yüklemeniz gerekmez).`);
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

      const parsedRows = rawRows.map((row: any) => {
        const invNo = String(
          row['Fatura no'] ||
          row['Fatura No'] ||
          row['Fatura Numarası'] ||
          row['Belge No'] ||
          ''
        ).trim();
        const excelCust = String(
          row['Müşteri'] ||
          row['Cari'] ||
          row['Unvan'] ||
          row['Firma Adı'] ||
          row['Alıcı'] ||
          row['Müşteri Adı'] ||
          ''
        ).trim();
        const excelTax = String(row['VKN'] || row['Vergi No'] || row['Vergi Numarası'] || row['TCKN'] || '').trim();
        const totalAmt = cleanNumber(row['Genel Toplam'] || row['Tutar'] || row['Toplam Tutar'] || row['Ödenecek Tutar']);
        const rawDate = row['Düzenleme tarihi'] || row['Tarih'] || row['Fatura Tarihi'];
        const rowIssueDate = sanitizeDate(rawDate) || new Date().toISOString().split('T')[0];
        const rawDueDate = row['Vade'] || row['Vade Tarihi'];
        const rowDueDate = sanitizeDate(rawDueDate) || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
        return { invNo, excelCust, excelTax, totalAmt, rowIssueDate, rowDueDate };
      });

      let customersForMatch: Customer[] = [...dbCustomers];
      const pendingCards = new Map<string, { name: string; tax_id: string | null }>();

      parsedRows.forEach(row => {
        if (!row.excelCust) return;
        if (matchCustomer(row.excelCust, row.excelTax, customersForMatch)) return;
        const key = `${row.excelCust.trim().toLocaleUpperCase('tr-TR')}|${row.excelTax.replace(/\D/g, '')}`;
        if (!pendingCards.has(key)) {
          pendingCards.set(key, {
            name: row.excelCust.trim(),
            tax_id: row.excelTax.replace(/\D/g, '') || null
          });
        }
      });

      let createdCustomerCount = 0;
      if (pendingCards.size > 0) {
        const toInsert = [...pendingCards.values()];
        const { data: created, error: custErr } = await supabase
          .from('customers')
          .upsert(toInsert, { onConflict: 'name' })
          .select('id, name, tax_id, tax_office, address, phone, email, notes');
        if (custErr) throw custErr;
        createdCustomerCount = toInsert.length;
        (created || []).forEach((c: Customer) => {
          const idx = customersForMatch.findIndex(x => x.name === c.name);
          if (idx >= 0) customersForMatch[idx] = c;
          else customersForMatch.push(c);
        });
      }

      const newRowsToInsert: any[] = [];
      let skippedCount = 0;

      parsedRows.forEach(row => {
        const matched = matchCustomer(row.excelCust, row.excelTax, customersForMatch);
        const custName = matched?.name || row.excelCust;
        const fullTitle = `${row.invNo} - ${custName}`.trim();

        if (existingInvoices.has(fullTitle.toUpperCase()) || (row.invNo && existingInvoices.has(row.invNo.toUpperCase()))) {
          skippedCount++;
        } else if (row.invNo && row.totalAmt > 0 && custName) {
          newRowsToInsert.push({
            invoice_no: fullTitle,
            direction: 'outgoing',
            category: 'freight_sales',
            total_amount: row.totalAmt,
            issue_date: row.rowIssueDate,
            due_date: row.rowDueDate,
            status: 'unpaid'
          });
        }
      });

      if (newRowsToInsert.length > 0) {
        const { error } = await supabase.from('invoices').insert(newRowsToInsert);
        if (error) throw error;
      }

      alert(
        `Satış Faturaları İçe Aktarıldı!\n• ${newRowsToInsert.length} adet yeni satış faturası eklendi.\n• ${skippedCount} adet mevcut fatura mükerrer olmaması için atlandı.` +
        (createdCustomerCount
          ? `\n• ${createdCustomerCount} yeni müşteri kartı otomatik açıldı. Müşteri Kartları menüsünden VKN ve iletişim bilgilerini tamamlayabilirsiniz.`
          : '')
      );
      loadPortalData();
    } catch (err: any) {
      alert('Satış faturası yükleme hatası: ' + err.message);
    } finally {
      e.target.value = '';
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
      .filter(i => i.status !== 'paid' && !['customer_collection', 'freight_sales', 'cash_deposit', 'customer_advance', 'subcontractor_advance_paid', 'subcontractor_paid_outflow', 'salary_payroll'].includes(i.category) && i.due_date)
      .forEach(d => {
        const diff = Math.ceil((new Date(sanitizeDate(d.due_date)).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
        if (diff > 3) return;
        let alertAmount = cleanNumber(d.total_amount);
        if (d.category === 'subcontractor_invoice') {
          const t1 = cleanNumber(d.term1_amount || (d.total_amount / 2));
          const t2 = cleanNumber(d.term2_amount || (d.total_amount / 2));
          alertAmount = (d.term1_status !== 'paid' ? t1 : 0) + (d.term2_status !== 'paid' ? t2 : 0);
        }
        if (alertAmount > 0) pendingDebts.push({ ...d, diffDays: diff, alertAmount });
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

 // 8. FİNANSAL FORMÜLLER (KESİN MUTABAKAT VE FİİLİ KASA HESAPLAMA MOTORU)
  const isDateInRange = (dateStr: string | null) => {
    if (!dateStr) return true;
    const d = sanitizeDate(dateStr);
    if (!filterStartDate && !filterEndDate) return true;
    if (filterStartDate && d < filterStartDate) return false;
    if (filterEndDate && d > filterEndDate) return false;
    return true;
  };

  const filteredInvoices = dbInvoices.filter(i => isDateInRange(i.issue_date || i.created_at));

  const isOzMalVehicle = (v: any) => {
    const t = String(v.ownership_type || 'Öz Mal').toLocaleLowerCase('tr-TR');
    return t.includes('öz') || t.includes('oz mal') || t.includes('ozmal') || !String(v.ownership_type || '').trim();
  };

  const isActiveVehicle = (v: any) => v.is_active !== false;

  const normalizeVehicleType = (raw: string) => {
    const t = String(raw || '').toLocaleLowerCase('tr-TR');
    if (t.includes('binek') || t.includes('otomobil')) return 'Binek';
    if (t.includes('kamyonet')) return 'Kamyonet';
    if (t.includes('dorse')) return 'Dorse';
    if (t.includes('tır') || t === 'tir' || t.includes(' tir') || t.startsWith('tir')) return 'TIR';
    if (t.includes('kamyon')) return 'Kamyon';
    return 'Kamyon';
  };

  const isProfitVehicleType = (v: any) => {
    const t = normalizeVehicleType(v.vehicle_type);
    return t === 'Kamyonet' || t === 'Kamyon' || t === 'TIR';
  };

  const defaultProfitIncluded = (vehicleType: string) => {
    const t = normalizeVehicleType(vehicleType);
    return t === 'Kamyonet' || t === 'Kamyon' || t === 'TIR';
  };

  const saveMonthlyProfitInput = async (
    plate: string,
    field: 'invoice_rev' | 'fuel' | 'hgs' | 'included',
    raw: string | boolean
  ) => {
    if (!isAdmin) return;
    const plateKey = String(plate || '').trim();
    if (!plateKey) return;
    const veh = dbVehicles.find(v => String(v.plate_number).trim() === plateKey);
    const existing = monthlyInputRows.find(
      r => String(r.plate_number).trim() === plateKey && r.year_month === profitMonth
    );
    const includedDefault =
      typeof existing?.included === 'boolean'
        ? existing.included
        : defaultProfitIncluded(veh?.vehicle_type);
    const payload = {
      plate_number: plateKey,
      year_month: profitMonth,
      invoice_rev: field === 'invoice_rev' ? cleanNumber(raw) : cleanNumber(existing?.invoice_rev),
      fuel: field === 'fuel' ? cleanNumber(raw) : cleanNumber(existing?.fuel),
      hgs: field === 'hgs' ? cleanNumber(raw) : cleanNumber(existing?.hgs),
      included: field === 'included' ? !!raw : includedDefault,
      updated_at: new Date().toISOString()
    };
    setMonthlyInputRows(prev => {
      const idx = prev.findIndex(r => String(r.plate_number).trim() === plateKey && r.year_month === profitMonth);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...payload };
        return next;
      }
      return [...prev, payload];
    });
    const { error } = await supabase
      .from('vehicle_monthly_inputs')
      .upsert(payload, { onConflict: 'plate_number,year_month' });
    if (error) {
      alert('Ay verisi kaydedilemedi. setup_profit_month.sql dosyasını SQL Editor’da çalıştırın.\n' + error.message);
    }
  };

  const dbProfitability = useMemo(() => {
    const monthStart = `${profitMonth}-01`;
    const [yy, mm] = profitMonth.split('-').map(Number);
    const monthEndDate = new Date(yy, mm, 0);
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    const monthEnd = `${yy}-${pad(mm)}-${pad(monthEndDate.getDate())}`;

    return dbVehicles
      .filter(v => isOzMalVehicle(v) && isActiveVehicle(v) && isProfitVehicleType(v))
      .map(veh => {
      const plate = String(veh.plate_number || '').trim();
      const cleanPlate = plate.replace(/\s+/g, '').toUpperCase();
      const stored = monthlyInputRows.find(
        r => String(r.plate_number).trim() === plate && r.year_month === profitMonth
      );

      const invoice_rev = cleanNumber(stored?.invoice_rev);
      const fuel = cleanNumber(stored?.fuel);
      const hgs = cleanNumber(stored?.hgs);
      const vehicleType = normalizeVehicleType(veh.vehicle_type);
      const included =
        typeof stored?.included === 'boolean' ? stored.included : defaultProfitIncluded(veh.vehicle_type);

      let driver_sal = 0;
      let bonus = 0;
      let sgk = 0;
      const driver = veh.driver_name
        ? dbEmployees.find(emp => namesMatch(emp.full_name, veh.driver_name))
        : null;
      if (driver) {
        const hire = sanitizeDate(driver.hire_date);
        const share = hire ? employmentShareForMonth(hire, profitMonth) : { factor: 1 };
        if (share.factor > 0) {
          driver_sal = Math.round(cleanNumber(driver.base_salary) * share.factor * 100) / 100;
          bonus = Math.round(cleanNumber(driver.monthly_bonus) * share.factor * 100) / 100;
          const fullSgk =
            driver.employer_sgk === null || driver.employer_sgk === undefined || driver.employer_sgk === ''
              ? sgkDriverAmount
              : cleanNumber(driver.employer_sgk);
          sgk = Math.round(fullSgk * share.factor * 100) / 100;
        }
        (dbEmployeeTransactions || []).forEach((tx: any) => {
          if (String(tx.employee_id) !== String(driver.id) || tx.type !== 'bonus') return;
          const d = sanitizeDate(tx.transaction_date || tx.created_at);
          if (d >= monthStart && d <= monthEnd) bonus += cleanNumber(tx.total_amount);
        });
      }

      const round2 = (n: number) => Math.round(n * 100) / 100;
      const insurance_m = round2(cleanNumber(veh.insurance_cost) / 12);
      const kasko_m = round2(cleanNumber(veh.kasko_cost) / 12);
      const mtv_m = round2(cleanNumber(veh.last_mtv_cost) / 12);
      const inspection_m = round2(cleanNumber(veh.inspection_cost) / 12);
      const fixed_monthly = round2(insurance_m + kasko_m + mtv_m + inspection_m);

      const yearStart = `${yy}-01-01`;
      const yearEnd = `${yy}-12-31`;
      const bakimYear = cleanPlate.length >= 5
        ? dbInvoices
            .filter(inv => {
              const d = sanitizeDate(inv.issue_date || inv.created_at);
              if (d < yearStart || d > yearEnd) return false;
              if (!['maintenance', 'tires'].includes(String(inv.category || ''))) return false;
              const haystack = `${inv.invoice_no || ''} ${inv.description || ''}`.replace(/\s+/g, '').toUpperCase();
              return haystack.includes(cleanPlate);
            })
            .reduce((sum, inv) => sum + cleanNumber(inv.total_amount), 0)
        : 0;
      const bakim = round2(bakimYear / 12);

      const payroll = driver_sal + bonus;
      const totalCost = payroll + sgk + fuel + hgs + fixed_monthly + bakim;
      const netProfit = invoice_rev - totalCost;

      return {
        id: veh.id,
        vehicle: veh,
        month_year: profitMonth,
        plate_number: plate,
        driver_name: veh.driver_name || '',
        invoice_rev,
        fuel,
        hgs,
        driver_sal,
        bonus,
        payroll,
        sgk,
        insurance_m,
        kasko_m,
        mtv_m,
        inspection_m,
        fixed_monthly,
        bakim,
        bakimYear,
        totalCost,
        netProfit,
        included,
        vehicleType
      };
    });
  }, [dbVehicles, dbEmployees, dbEmployeeTransactions, dbInvoices, monthlyInputRows, profitMonth, sgkDriverAmount]);

  // Seçilen dönem satış cirosu
  const totalPeriodSalesRevenue = filteredInvoices
    .filter(i => i.direction === 'outgoing' || i.category === 'freight_sales')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  // Fiilen kasaya giren tahsilatlar (tarih filtresine bağlı)
  const totalCollectedCash = filteredInvoices
    .filter(i => i.category === 'customer_collection')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const customerUnallocatedAdvances = dbInvoices
    .filter(i => i.category === 'customer_advance')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  const totalOpenSalesAllTime = dbInvoices
    .filter(i => (i.direction === 'outgoing' || i.category === 'freight_sales') && i.status !== 'paid')
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  // ÖDENMEMİŞ TAŞERON BORÇLARI (Vadeler ödendikçe buradan düşer)
  let unpaidSubcontractorDebt = 0;
  dbInvoices
    .filter(i => i.category === 'subcontractor_invoice')
    .forEach(inv => {
      const t1 = cleanNumber(inv.term1_amount || (inv.total_amount / 2));
      const t2 = cleanNumber(inv.term2_amount || (inv.total_amount / 2));
      if (inv.term1_status !== 'paid') unpaidSubcontractorDebt += t1;
      if (inv.term2_status !== 'paid') unpaidSubcontractorDebt += t2;
    });

  // DEVLET BORÇLARI
  const totalGovernmentPaymentsDebt = dbInvoices
    .filter(i => i.status !== 'paid' && ['taxes_sgk', 'traffic_fines'].includes(i.category))
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

  // TEMEL DİĞER TEDARİK FATURALARI
  const totalGeneralCompanyExpensesDebt = dbInvoices
    .filter(i => i.status !== 'paid' && !['subcontractor_invoice', 'customer_collection', 'freight_sales', 'taxes_sgk', 'traffic_fines', 'salary_payroll', 'cash_deposit', 'customer_advance', 'subcontractor_advance_paid', 'subcontractor_paid_outflow', 'opening_balance'].includes(i.category))
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

 // DÖNEM İÇİ FİİLİ MASRAFLAR (Taşeron hakedişleri hariç, sadece ödenen şirket giderleri)
  const totalPeriodPaidExpenses = filteredInvoices
    .filter(i => {
      if (i.status !== 'paid') return false;
      const cat = String(i.category || '');
      const no = String(i.invoice_no || '').toUpperCase();
      if (['customer_collection', 'customer_advance', 'freight_sales', 'cash_deposit'].includes(cat)) return false;
      if (cat === 'subcontractor_invoice' || no.startsWith('GIB') || no.startsWith('OZR') || no.startsWith('RMZ')) return false;
      return true;
    })
    .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

// PERSONEL GELECEK ÖDEMESİ (Yeni cari defter ve net hakediş ile tam uyumlu)
  const totalEmployeeFutureDebt = useMemo(() => {
    return (dbEmployees || []).reduce((sum, emp) => sum + employeeUnpaidFromBooks(emp), 0);
  }, [dbEmployees, dbAdvances, dbEmployeeTransactions, dbInvoices]);

  const contractorAdvanceRemaining = (dbAdvances || [])
    .filter((a: any) => a.target_type === 'contractor')
    .reduce((sum: number, a: any) => {
      const remaining = a.remaining_amount !== undefined && a.remaining_amount !== null
        ? a.remaining_amount
        : a.total_amount;
      return sum + cleanNumber(remaining);
    }, 0);

  const unpaidSubcontractorNet = Math.max(0, unpaidSubcontractorDebt - contractorAdvanceRemaining);

  // TOPLAM ÖDENECEK TİCARİ BORÇLAR
  const totalConsolidatedDebt = unpaidSubcontractorNet + totalGovernmentPaymentsDebt + totalGeneralCompanyExpensesDebt;

  const cashInCategories = new Set(['customer_collection', 'customer_advance', 'cash_deposit']);
  const cashBooksStart = '2026-10-01';
  const inCashBooks = (inv: any) => {
    const d = sanitizeDate(inv.issue_date || inv.created_at);
    return !!d && d >= cashBooksStart;
  };
  const isExpensePaidByCard = (inv: any) =>
    String(inv.paid_source || '') === 'card' || /\[KK\]/i.test(String(inv.invoice_no || ''));
  const skipCashOut = new Set([
    'customer_collection',
    'customer_advance',
    'cash_deposit',
    'freight_sales',
    'subcontractor_invoice',
    'opening_balance'
  ]);

  const pickUniqueContractorOutflows = (rows: any[]) => {
    const rank = (inv: any) => {
      const no = String(inv.invoice_no || '');
      if (/tamam|1 ve 2/i.test(no)) return 0;
      if (/banka talimat/i.test(no)) return 1;
      return 2;
    };
    const sorted = [...rows].sort((a, b) =>
      rank(a) - rank(b) ||
      sanitizeDate(a.issue_date || a.created_at).localeCompare(sanitizeDate(b.issue_date || b.created_at))
    );
    const kept: any[] = [];
    sorted.forEach(inv => {
      const name = extractContractorName(inv.invoice_no || '');
      const d = sanitizeDate(inv.issue_date || inv.created_at);
      const amt = cleanNumber(inv.total_amount);
      const exact = kept.some(k =>
        contractorKeysLooselyMatch(name, extractContractorName(k.invoice_no || '')) &&
        sanitizeDate(k.issue_date || k.created_at) === d &&
        amountsClose(cleanNumber(k.total_amount), amt, 0.05)
      );
      if (exact) return;
      const swallowed = kept.some(k => {
        const kn = extractContractorName(k.invoice_no || '');
        if (!contractorKeysLooselyMatch(name, kn)) return false;
        const kd = sanitizeDate(k.issue_date || k.created_at);
        const ka = cleanNumber(k.total_amount);
        const days = Math.abs(Date.parse(d) - Date.parse(kd)) / 86400000;
        if (!Number.isFinite(days) || days > 20) return false;
        const kFull = /tamam|1 ve 2/i.test(String(k.invoice_no || ''));
        if (kFull && (amountsClose(ka, amt * 2, 1) || amountsClose(ka, amt, 0.51))) return true;
        return false;
      });
      if (swallowed) return;
      kept.push(inv);
    });
    return kept;
  };

  const cashInRows = (dbInvoices || []).filter((i: any) => cashInCategories.has(String(i.category || '')) && inCashBooks(i));
  const cashOutCandidates = (dbInvoices || []).filter((i: any) =>
    i.status === 'paid' &&
    !skipCashOut.has(String(i.category || '')) &&
    i.direction !== 'outgoing' &&
    inCashBooks(i) &&
    !isExpensePaidByCard(i)
  );
  const cashOutRows = [
    ...cashOutCandidates.filter((i: any) => i.category !== 'subcontractor_paid_outflow'),
    ...pickUniqueContractorOutflows(cashOutCandidates.filter((i: any) => i.category === 'subcontractor_paid_outflow'))
  ];
  const cashInflow = cashInRows.reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);
  const cashOutflow = cashOutRows.reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);
  const currentRealCash = cashInflow - cashOutflow;

  const cashLedgerView = useMemo(() => {
    const from = cashLedgerFrom || '2026-10-01';
    const to = cashLedgerTo || new Date().toISOString().split('T')[0];
    const labelOf = (cat: string) => {
      if (cat === 'customer_collection') return 'Müşteri tahsilatı';
      if (cat === 'customer_advance') return 'Müşteri avansı';
      if (cat === 'cash_deposit') return 'Kasa / banka girişi';
      if (cat === 'subcontractor_paid_outflow') return 'Taşeron ödemesi';
      if (cat === 'subcontractor_advance_paid') return 'Taşeron avansı';
      if (cat === 'salary_payroll') return 'Maaş / bordro';
      if (cat === 'credit_card_payment') return 'Kredi kartı nakit ödeme';
      if (cat === 'taxes_sgk') return 'SGK / vergi';
      if (cat === 'traffic_fines') return 'Trafik cezası';
      return 'Gider';
    };
    type CashLine = {
      id: any;
      date: string;
      label: string;
      title: string;
      inflow: number;
      outflow: number;
      kind: 'live' | 'ghost' | 'open';
    };
    const txs: CashLine[] = [];
    const pushInv = (inv: any, inflow: number, outflow: number) => {
      const date = sanitizeDate(inv.issue_date || inv.created_at);
      if (!date) return;
      const cat = String(inv.category || '');
      const amt = inflow || outflow;
      if (amt <= 0) return;
      let title = String(inv.invoice_no || '');
      let label = labelOf(cat);
      if (cat === 'credit_card_payment') {
        const no = title;
        const card = (dbCreditCards || []).find((c: any) => no.includes(String(c.card_name || '')) || (c.last_four_digits && no.includes(String(c.last_four_digits))));
        const last4 = String(card?.last_four_digits || '').replace(/\D/g, '').slice(-4);
        title = `${card?.card_name || no} · ${last4 ? `**** ${last4}` : 'kart no yok'} · Nakit ödeme yapıldı`;
        label = last4 ? `Nakit kart **** ${last4}` : 'Kredi kartı nakit ödeme';
      }
      txs.push({ id: inv.id, date, label, title, inflow, outflow, kind: 'live' });
    };
    cashInRows.forEach((inv: any) => pushInv(inv, cleanNumber(inv.total_amount), 0));
    cashOutRows.forEach((inv: any) => pushInv(inv, 0, cleanNumber(inv.total_amount)));

    const live = txs.filter(t => t.kind === 'live');
    let startBal = 0;
    live.forEach(t => {
      if (t.date < from) startBal += t.inflow - t.outflow;
    });

    const inRange = txs.filter(t => t.date >= from && t.date <= to);
    const events: CashLine[] = [...inRange];
    events.push({
      id: 'open',
      date: from,
      label: 'Dönem başı',
      title: 'Seçilen tarihten önceki tahsilat − kasa çıkışı. Fiili açılış bu ay içinde ayrı netleştirilecek.',
      inflow: 0,
      outflow: 0,
      kind: 'open'
    });
    const rank = (k: CashLine['kind']) => (k === 'ghost' ? 0 : k === 'open' ? 1 : 2);
    events.sort((a, b) => a.date.localeCompare(b.date) || rank(a.kind) - rank(b.kind) || a.title.localeCompare(b.title, 'tr'));

    let run = startBal;
    const lines = events.map(t => {
      if (t.kind === 'ghost') return { ...t, balance: null as number | null, isHist: true, isOpen: false };
      if (t.kind === 'open') {
        return { ...t, balance: run, isHist: false, isOpen: true };
      }
      run += t.inflow - t.outflow;
      return { ...t, balance: run, isHist: false, isOpen: false };
    }).reverse();
    const liveInRange = live.filter(t => t.date >= from && t.date <= to);
    const contractorOut = liveInRange
      .filter(t => t.label === 'Taşeron ödemesi' || t.label === 'Taşeron avansı')
      .reduce((s, t) => s + t.outflow, 0);
    return {
      from,
      to,
      startBal,
      endBal: run,
      periodIn: liveInRange.reduce((s, t) => s + t.inflow, 0),
      periodOut: liveInRange.reduce((s, t) => s + t.outflow, 0),
      contractorOut,
      lines
    };
  }, [dbInvoices, dbCreditCards, cashLedgerFrom, cashLedgerTo, cashInRows, cashOutRows]);

  // 9. MÜŞTERİ SATIŞLARI (MİGROS & GERÇEK CARİ EŞLEŞMESİ)
  const salesDetailedList = useMemo(() => {
    return dbInvoices
      .filter(i => i.category === 'freight_sales' || i.direction === 'outgoing')
      .map(inv => {
        let cust = '';
        let fNo = inv.invoice_no || '';

        if (fNo.includes(' - ')) {
          const parts = fNo.split(' - ');
          fNo = parts[0].trim();
          cust = parts.slice(1).join(' - ').trim();
        }

        const matched = resolveInvoiceCustomer(inv, dbCustomers, dbInvoices) || matchCustomer(cust || fNo, '', dbCustomers);
        if (matched) cust = matched.name;
        else if (!cust) cust = 'Eşleşmeyen müşteri';

        return {
          ...inv,
          customerName: cust,
          cleanInvoiceNo: fNo
        };
      });
  }, [dbInvoices, dbCustomers]);

  const customerBalances = useMemo(() => {
    const belongsTo = (inv: any, customer: Customer) =>
      invoiceBelongsToCustomer(inv, customer, dbCustomers, dbInvoices);

    const rows = dbCustomers.map(customer => {
      const sales = dbInvoices.filter(i =>
        (i.category === 'freight_sales' || i.direction === 'outgoing') && belongsTo(i, customer)
      );
      const billed = sales.reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);
      const openSales = sales
        .filter(i => i.status !== 'paid')
        .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

      const collections = dbInvoices
        .filter(i => i.category === 'customer_collection' && belongsTo(i, customer))
        .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

      const advances = dbInvoices
        .filter(i => i.category === 'customer_advance' && belongsTo(i, customer))
        .reduce((sum, i) => sum + cleanNumber(i.total_amount), 0);

      const payments = collections + advances;
      const net = billed - payments;
      return { customer, billed, openSales, collections, advances, payments, net };
    });

    return rows.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [dbCustomers, dbInvoices]);

  const pendingReceivablesAllTime = useMemo(() => {
    const assignedNet = customerBalances.reduce((s, r) => s + r.net, 0);
    const unmatchedOpen = dbInvoices
      .filter(i => (i.category === 'freight_sales' || i.direction === 'outgoing') && i.status !== 'paid')
      .filter(i => !resolveInvoiceCustomer(i, dbCustomers || [], dbInvoices))
      .reduce((s, i) => s + cleanNumber(i.total_amount), 0);
    return assignedNet + unmatchedOpen;
  }, [customerBalances, dbInvoices, dbCustomers]);

  const selectedCariLedger = useMemo(() => {
    if (!selectedCariCustomer) return [];
    const belongs = (inv: any) => invoiceBelongsToCustomer(inv, selectedCariCustomer, dbCustomers, dbInvoices);
    const lines: { date: string; type: string; title: string; debit: number; credit: number }[] = [];

    dbInvoices.filter(belongs).forEach(inv => {
      const amt = cleanNumber(inv.total_amount);
      const date = sanitizeDate(inv.issue_date || inv.created_at) || '';
      const title = String(inv.invoice_no || '');
      if (inv.category === 'freight_sales' || inv.direction === 'outgoing') {
        lines.push({ date, type: inv.status === 'paid' ? 'Fatura (tahsil edildi)' : 'Satış faturası', title, debit: amt, credit: 0 });
      } else if (inv.category === 'customer_collection') {
        lines.push({ date, type: 'Tahsilat / ödeme', title, debit: 0, credit: amt });
      } else if (inv.category === 'customer_advance') {
        lines.push({ date, type: 'Cari avans', title, debit: 0, credit: amt });
      }
    });

    lines.sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    return lines.map(line => {
      running += line.debit - line.credit;
      return { ...line, balance: running };
    });
  }, [selectedCariCustomer, dbInvoices, dbCustomers]);

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
  }, [salesDetailedList, salesSearchQuery, salesStatusFilter, salesSortConfig]);

  const handleSalesSort = (key: string) => {
    setSalesSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const exportCariExcel = (customer: Customer, ledger: typeof selectedCariLedger) => {
    const header = [
      ['Tazeyol ERP Cari Ekstre'],
      ['Müşteri', customer.name],
      ['VKN', customer.tax_id || ''],
      ['Telefon', customer.phone || ''],
      ['Döküm tarihi', new Date().toLocaleDateString('tr-TR')],
      [],
      ['Tarih', 'İşlem', 'Açıklama', 'Borç (Fatura)', 'Alacak (Ödeme)', 'Bakiye']
    ];
    const body = ledger.map(line => [
      line.date,
      line.type,
      line.title,
      line.debit || 0,
      line.credit || 0,
      line.balance
    ]);
    const kapanis = ledger.length ? ledger[ledger.length - 1].balance : 0;
    const sheet = XLSX.utils.aoa_to_sheet([
      ...header,
      ...body,
      [],
      ['', '', 'Kapanış bakiyesi', '', '', kapanis]
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Cari');
    const safeName = customer.name.replace(/[\\/:*?"<>|]/g, ' ').slice(0, 40).trim();
    XLSX.writeFile(workbook, `Tazeyol_Cari_${safeName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const payrollMonthList = useMemo(() => {
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    let from = payrollFrom || '2020-01';
    let to = payrollTo || from;
    if (from > to) {
      const tmp = from;
      from = to;
      to = tmp;
    }
    const months: string[] = [];
    let [y, m] = from.split('-').map(Number);
    const [ty, tm] = to.split('-').map(Number);
    let guard = 0;
    while ((y < ty || (y === ty && m <= tm)) && guard < 120) {
      months.push(`${y}-${pad(m)}`);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      guard += 1;
    }
    return months;
  }, [payrollFrom, payrollTo]);

  const selectedPayrollLedger = useMemo(() => {
    if (!selectedPayrollEmp) return [];
    const emp = selectedPayrollEmp;
    const empIdStr = String(emp.id || '');
    const empNorm = foldPersonName(emp.full_name);
    const months = payrollMonthList;
    if (!months.length) return [];
    const startInfo = resolveEmployeeStart(emp);
    const hire = startInfo.date;
    const hireYm = hire ? hire.slice(0, 7) : '';
    const rangeStart = `${months[0]}-01`;
    const lastYm = months[months.length - 1];
    const [ly, lm] = lastYm.split('-').map(Number);
    const lastDay = new Date(ly, lm, 0).getDate();
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    const rangeEnd = `${ly}-${pad(lm)}-${pad(lastDay)}`;
    const inRange = (d: string) => {
      if (!d) return false;
      if (hire && d < hire) return false;
      if (d < `${personnelBooksStartYm}-01`) return false;
      return d >= rangeStart && d <= rangeEnd;
    };

    const lines: { date: string; type: string; title: string; earn: number; cut: number }[] = [];
    const base = cleanNumber(emp.base_salary);
    const cardBonus = cleanNumber(emp.monthly_bonus);

    const closedYm = personnelClosedYearMonth();
    months.forEach(ym => {
      if (ym < personnelBooksStartYm) return;
      if (hireYm && ym < hireYm) return;
      const share = employmentShareForMonth(hire, ym);
      if (share.factor <= 0) return;
      const date = hireYm === ym && hire ? hire : `${ym}-01`;
      const [yy, mm] = ym.split('-');
      const label = `${mm}.${yy}`;
      const proNote = share.startedThisMonth
        ? ` · ${startInfo.label} ${formatDateTR(hire)}, ${share.daysWorked}/${share.daysInMonth} gün`
        : '';
      const salaryOpen = ym <= closedYm;
      if (salaryOpen && base > 0) {
        lines.push({
          date,
          type: 'Sabit maaş',
          title: `${label} sözleşmeli maaş (güncel tarife)${proNote}`,
          earn: Math.round(base * share.factor * 100) / 100,
          cut: 0
        });
      }
      if (salaryOpen && cardBonus > 0) {
        lines.push({
          date,
          type: 'Kart primi',
          title: `${label} kart aylık prim (güncel tarife)${proNote}`,
          earn: Math.round(cardBonus * share.factor * 100) / 100,
          cut: 0
        });
      }
    });

    (dbEmployeeTransactions || []).forEach((tx: any) => {
      if (String(tx.employee_id) !== empIdStr) return;
      const d = sanitizeDate(tx.transaction_date || tx.created_at);
      const tot = cleanNumber(tx.total_amount);
      if (tx.type === 'bonus') {
        if (!inRange(d)) return;
        lines.push({ date: d, type: 'Sefer / prim', title: tx.title || 'Prim', earn: tot, cut: 0 });
      } else if (tx.type === 'advance') {
        if (!inRange(d)) return;
        lines.push({ date: d, type: 'Münferit avans', title: tx.title || 'Avans', earn: 0, cut: tot });
      } else if (tx.type === 'installment_advance') {
        const inst = Math.max(1, Number(tx.installment_count) || 1);
        const cutAmt = cleanNumber(tx.monthly_cut || Math.round(tot / inst));
        const startYm = (d || rangeStart).slice(0, 7);
        months.forEach(ym => {
          if (ym < personnelBooksStartYm) return;
          if (ym < startYm) return;
          const [sy, sm] = startYm.split('-').map(Number);
          const [cy, cm] = ym.split('-').map(Number);
          const elapsed = (cy - sy) * 12 + (cm - sm);
          if (elapsed < 0 || elapsed >= inst) return;
          lines.push({
            date: `${ym}-01`,
            type: 'Taksit kesintisi',
            title: `${tx.title || 'Taksitli avans'} (${elapsed + 1}/${inst})`,
            earn: 0,
            cut: cutAmt
          });
        });
      }
    });

    (dbAdvances || []).forEach((a: any) => {
      if (!employeeMatchesAdvance(emp, a)) return;
      const d = sanitizeDate(a.issue_date || a.payment_date || a.created_at);
      const tot = cleanNumber(a.total_amount);
      if (a.payment_type === 'employee_bonus') {
        if (!inRange(d)) return;
        lines.push({
          date: d,
          type: 'Kasa prim',
          title: a.description || a.reason || 'Kasa primi',
          earn: tot,
          cut: 0
        });
        return;
      }
      const inst = Math.max(1, Number(a.total_installments) || 1);
      const isInst = String(a.payment_type || '').includes('installment') || inst > 1;
      if (isInst) {
        const startYm = (d || rangeStart).slice(0, 7);
        const cutAmt = tot / inst;
        months.forEach(ym => {
          if (ym < personnelBooksStartYm) return;
          const elapsed = monthsBetween(startYm, ym);
          if (elapsed < 0 || elapsed >= inst) return;
          lines.push({
            date: `${ym}-01`,
            type: 'Kasa taksit kesintisi',
            title: `${a.description || a.reason || 'Taksitli avans'} (${elapsed + 1}/${inst})`,
            earn: 0,
            cut: Math.round(cutAmt * 100) / 100
          });
        });
        return;
      }
      if (!inRange(d)) return;
      lines.push({
        date: d,
        type: 'Kasa avans',
        title: a.description || a.reason || 'Kasa avansı',
        earn: 0,
        cut: tot
      });
    });

    (dbInvoices || []).forEach((inv: any) => {
      if (!salaryPayrollMatchesEmployee(inv, emp)) return;
      const d = sanitizeDate(inv.issue_date || inv.created_at);
      if (!d) return;
      if (hire && d < hire) return;
      if (d < `${personnelBooksStartYm}-01`) return;
      if (d < rangeStart) return;
      lines.push({
        date: d,
        type: 'Maaş ödemesi',
        title: inv.invoice_no || 'Maaş',
        earn: 0,
        cut: cleanNumber(inv.total_amount)
      });
    });

    lines.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type, 'tr'));
    let running = 0;
    return lines.map(line => {
      running += line.earn - line.cut;
      return { ...line, balance: running };
    });
  }, [selectedPayrollEmp, payrollMonthList, dbEmployeeTransactions, dbAdvances, dbInvoices]);

  const exportPayrollExcel = (emp: any, ledger: typeof selectedPayrollLedger) => {
    const header = [
      ['Tazeyol ERP Personel Hakediş Raporu'],
      ['Personel', emp.full_name || ''],
      ['Görev', emp.role_title || ''],
      ['İşe giriş / başlangıç', emp.hire_date ? formatDateTR(emp.hire_date) : `${resolveEmployeeStart(emp).label}: ${formatDateTR(resolveEmployeeStart(emp).date)}`],
      ['Dönem', `${payrollFrom} — ${payrollTo}`],
      ['Döküm tarihi', new Date().toLocaleDateString('tr-TR')],
      [],
      ['Tarih', 'İşlem', 'Açıklama', 'Hakediş', 'Kesinti / ödeme', 'Bakiye']
    ];
    const body = ledger.map(line => [
      line.date,
      line.type,
      line.title,
      line.earn || 0,
      line.cut || 0,
      line.balance
    ]);
    const kapanis = ledger.length ? ledger[ledger.length - 1].balance : 0;
    const sheet = XLSX.utils.aoa_to_sheet([
      ...header,
      ...body,
      [],
      ['', '', 'Kapanış bakiyesi', '', '', kapanis]
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Hakedis');
    const safeName = String(emp.full_name || 'personel').replace(/[\\/:*?"<>|]/g, ' ').slice(0, 40).trim();
    XLSX.writeFile(workbook, `Tazeyol_Hakedis_${safeName}_${payrollFrom}_${payrollTo}.xlsx`);
  };

  const openPayrollReport = (emp: any) => {
    const hireYm = resolveEmployeeStart(emp).date.slice(0, 7);
    let from = personnelBooksStartYm;
    if (hireYm && hireYm > from) from = hireYm;
    const closed = personnelClosedYearMonth();
    const current = currentPayYearMonth();
    let to = current > closed ? current : closed;
    if (to < from) to = from;
    setPayrollFrom(from);
    setPayrollTo(to);
    setSelectedPayrollEmp(emp);
  };

  const findContractorIban = (contractorName: string, inv?: any) => {
    const key = normalizeContractorKey(contractorName);
    let foundIban = subIbanMap.get(key) || '';
    if ((!foundIban || foundIban === 'IBAN Eksik') && inv) {
      if (inv.iban && String(inv.iban).trim().length > 10) foundIban = String(inv.iban).trim();
      else if (inv.contractor_iban && String(inv.contractor_iban).trim().length > 10) foundIban = String(inv.contractor_iban).trim();
    }
    if (!foundIban || foundIban === 'IBAN Eksik') {
      const found = dbSubcontractors.find(sub => {
        const pSub = normalizeContractorKey(sub.name);
        if (!pSub || !key) return false;
        if (pSub === key || (key.length >= 4 && pSub.includes(key)) || (pSub.length >= 4 && key.includes(pSub))) return true;
        const subWords = pSub.split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !['limited', 'sirketi', 'anonim', 'nakliyat', 'lojistik'].includes(w));
        const keyWords = key.split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !['limited', 'sirketi', 'anonim', 'nakliyat', 'lojistik'].includes(w));
        return subWords.some(sw => key.includes(sw)) || keyWords.some(kw => pSub.includes(kw));
      });
      if (found?.iban) foundIban = found.iban;
    }
    return foundIban || 'IBAN Eksik';
  };

  const matchesContractor = (sub: any, ...texts: any[]) => {
    const nameKey = normalizeContractorKey(sub?.company_name || sub?.name || '');
    const id = String(sub?.id || '');
    if (!nameKey && !id) return false;
    return texts.some(t => {
      if (t === undefined || t === null || t === '') return false;
      const s = String(t);
      if (id && s === id) return true;
      return contractorKeysLooselyMatch(nameKey, s) || contractorKeysLooselyMatch(sub?.company_name || sub?.name || '', s);
    });
  };

  const buildSubcontractorLedger = (sub: any) => {
    const lines: { id: string; date: string; type: string; desc: string; debit: number; credit: number; isManual?: boolean; rawId?: any }[] = [];
    if (!sub) return [] as (typeof lines[number] & { balance: number })[];

    const invoices: any[] = [];
    (dbInvoices || []).forEach((inv: any) => {
      if (inv.category !== 'subcontractor_invoice') return;
      const no = String(inv.invoice_no || '');
      if (no.toUpperCase().includes('AVANS')) return;
      if (!matchesContractor(sub, extractContractorName(no), inv.supplier_name, inv.description, no)) return;
      invoices.push(inv);
      lines.push({
        id: 'inv_' + inv.id,
        date: sanitizeDate(inv.issue_date || inv.created_at),
        type: 'Hakediş faturası',
        desc: no,
        debit: cleanNumber(inv.total_amount),
        credit: 0
      });
    });

    const advAmounts: number[] = [];
    (dbAdvances || []).forEach((adv: any, idx: number) => {
      if (adv.target_type && adv.target_type !== 'contractor') return;
      if (!matchesContractor(sub, adv.target_name, adv.target_id, adv.notes)) return;
      const amt = cleanNumber(adv.total_amount);
      if (amt <= 0 || advAmounts.some(x => amountsClose(x, amt))) return;
      advAmounts.push(amt);
      const inst = Math.max(1, Number(adv.total_installments) || 1);
      lines.push({
        id: 'adv_' + (adv.id || idx),
        date: sanitizeDate(adv.issue_date || adv.created_at),
        type: inst > 1 ? `Taksitli avans (${inst} taksit)` : 'Peşin avans',
        desc: (adv.notes || adv.description || 'Verilen avans').replace(/\(\s*1\s*Taksit\s*\)/i, '').trim(),
        debit: 0,
        credit: amt
      });
    });
    (dbInvoices || []).forEach((inv: any) => {
      if (inv.category !== 'subcontractor_advance_paid') return;
      const no = String(inv.invoice_no || '');
      if (!matchesContractor(sub, extractAdvanceContractorName(no), no)) return;
      const amt = cleanNumber(inv.total_amount);
      if (amt <= 0 || advAmounts.some(x => amountsClose(x, amt))) return;
      advAmounts.push(amt);
      const instMatch = no.match(/(\d+)\s*Taksit/i);
      const inst = instMatch ? Number(instMatch[1]) : 1;
      lines.push({
        id: 'advinv_' + inv.id,
        date: sanitizeDate(inv.issue_date || inv.created_at),
        type: inst > 1 ? `Taksitli avans (${inst} taksit)` : 'Peşin avans',
        desc: no.replace(/\(\s*1\s*Taksit\s*\)/i, '').trim(),
        debit: 0,
        credit: amt
      });
    });
    const advanceTotal = advAmounts.reduce((s, n) => s + n, 0);
    let pesinPool = 0;
    let instMonthly = 0;
    let instRemaining = 0;
    (dbAdvances || []).forEach((adv: any) => {
      if (adv.target_type && adv.target_type !== 'contractor') return;
      if (!matchesContractor(sub, adv.target_name, adv.target_id, adv.notes)) return;
      const amt = cleanNumber(adv.total_amount);
      if (amt <= 0) return;
      const inst = Math.max(1, Number(adv.total_installments) || 1);
      if (inst > 1) {
        instMonthly += amt / inst;
        instRemaining += amt;
      } else {
        pesinPool += amt;
      }
    });
    (dbInvoices || []).forEach((inv: any) => {
      if (inv.category !== 'subcontractor_advance_paid') return;
      const no = String(inv.invoice_no || '');
      if (!matchesContractor(sub, extractAdvanceContractorName(no), no)) return;
      const amt = cleanNumber(inv.total_amount);
      if (amt <= 0 || advAmounts.filter(x => amountsClose(x, amt)).length > 1) return;
      if (advAmounts.some(x => amountsClose(x, amt)) && (dbAdvances || []).some((a: any) =>
        matchesContractor(sub, a.target_name, a.target_id) && amountsClose(cleanNumber(a.total_amount), amt)
      )) return;
      const instMatch = no.match(/(\d+)\s*Taksit/i);
      const inst = instMatch ? Number(instMatch[1]) : 1;
      if (inst > 1) {
        instMonthly += amt / inst;
        instRemaining += amt;
      } else {
        pesinPool += amt;
      }
    });
    instMonthly = Math.round(instMonthly * 100) / 100;

    type Slot = {
      key: string;
      invoiceId: any;
      invoiceNo: string;
      term: 'term1' | 'term2';
      issueDate: string;
      dueDate: string;
      gross: number;
      net: number;
      paid: boolean;
      payDate: string;
    };
    const slots: Slot[] = [];
    invoices.forEach((inv: any) => {
      const total = cleanNumber(inv.total_amount);
      const t1 = cleanNumber(inv.term1_amount || total / 2);
      const t2 = cleanNumber(inv.term2_amount || Math.max(0, total - t1));
      const issueDate = sanitizeDate(inv.issue_date || inv.created_at);
      const add = (term: 'term1' | 'term2', gross: number) => {
        if (gross <= 0.009) return;
        slots.push({
          key: `${inv.id}-${term}`,
          invoiceId: inv.id,
          invoiceNo: String(inv.invoice_no || ''),
          term,
          issueDate,
          dueDate: contractorTermPayDate(issueDate, term, sanitizeDate(term === 'term1' ? inv.term1_due_date : inv.term2_due_date)),
          gross,
          net: gross,
          paid: inv[term === 'term1' ? 'term1_status' : 'term2_status'] === 'paid',
          payDate: ''
        });
      };
      add('term1', t1);
      add('term2', t2);
    });
    slots.sort((a, b) => {
      if (a.term !== b.term) return a.term === 'term1' ? -1 : 1;
      return (a.issueDate || '').localeCompare(b.issueDate || '') || a.key.localeCompare(b.key);
    });
    const invoiceMonths = [...new Set(slots.map(s => (s.issueDate || '').slice(0, 7)).filter(Boolean))].sort();
    invoiceMonths.forEach(ym => {
      let monthInst = Math.round(Math.min(instMonthly, instRemaining) * 100) / 100;
      slots.filter(s => (s.issueDate || '').startsWith(ym) && s.term === 'term1').forEach(s => {
        const instCut = Math.round(Math.min(s.gross, monthInst) * 100) / 100;
        monthInst = Math.round((monthInst - instCut) * 100) / 100;
        instRemaining = Math.round((instRemaining - instCut) * 100) / 100;
        const pesinCut = Math.round(Math.min(s.gross - instCut, pesinPool) * 100) / 100;
        pesinPool = Math.round((pesinPool - pesinCut) * 100) / 100;
        s.net = Math.round((s.gross - instCut - pesinCut) * 100) / 100;
      });
      slots.filter(s => (s.issueDate || '').startsWith(ym) && s.term === 'term2').forEach(s => {
        const pesinCut = Math.round(Math.min(s.gross, pesinPool) * 100) / 100;
        pesinPool = Math.round((pesinPool - pesinCut) * 100) / 100;
        s.net = Math.round((s.gross - pesinCut) * 100) / 100;
      });
    });

    type Pay = { date: string; desc: string; amount: number; type: string };
    const pays: Pay[] = [];
    (dbSubcontractorsLedger || []).forEach((l: any) => {
      if (String(l.subcontractor_id) !== String(sub.id)) return;
      const amt = cleanNumber(l.amount);
      if (amt <= 0) return;
      if (l.transaction_type === 'invoice') {
        lines.push({
          id: 'ledger_' + l.id,
          date: sanitizeDate(l.created_at),
          type: 'Manuel fatura',
          desc: l.description || 'Cari hareket',
          debit: amt,
          credit: 0,
          isManual: true,
          rawId: l.id
        });
        return;
      }
      if (l.transaction_type === 'advance' && advAmounts.some(x => amountsClose(x, amt))) return;
      pays.push({ date: sanitizeDate(l.created_at), desc: l.description || '', amount: amt, type: String(l.transaction_type || '') });
    });
    (dbInvoices || []).forEach((inv: any) => {
      if (inv.category !== 'subcontractor_paid_outflow') return;
      const no = String(inv.invoice_no || '');
      if (!matchesContractor(sub, extractContractorName(no), extractAdvanceContractorName(no), no)) return;
      const amt = cleanNumber(inv.total_amount);
      if (amt <= 0) return;
      pays.push({ date: sanitizeDate(inv.issue_date || inv.created_at), desc: no, amount: amt, type: /banka|talimat/i.test(no) ? 'bank' : 'pay' });
    });

    const markPaid = (list: Slot[], date: string) => {
      list.forEach(s => {
        s.paid = true;
        if (date && (!s.payDate || date < s.payDate)) s.payDate = date;
      });
    };
    const findSubset = (cands: Slot[], amount: number) => {
      const n = Math.min(cands.length, 12);
      let best: Slot[] | null = null;
      for (let mask = 1; mask < (1 << n); mask++) {
        const picked: Slot[] = [];
        let netS = 0;
        let grossS = 0;
        for (let i = 0; i < n; i++) {
          if (!(mask & (1 << i))) continue;
          picked.push(cands[i]);
          netS += cands[i].net;
          grossS += cands[i].gross;
        }
        if (amountsClose(netS, amount, 0.51) || amountsClose(grossS, amount, 0.51)) {
          if (!best || picked.length < best.length) best = picked;
        }
      }
      return best;
    };
    const nearerWave = (issueDate: string, payDate: string): 'term1' | 'term2' | null => {
      const issue = String(issueDate || '').slice(0, 10);
      const pay = String(payDate || '').slice(0, 10);
      if (!issue || !pay) return null;
      const y = Number(issue.slice(0, 4));
      const m = Number(issue.slice(5, 7));
      if (!y || !m) return null;
      const n1 = shiftYearMonth(y, m, 1);
      const n2 = shiftYearMonth(y, m, 2);
      const payYm = pay.slice(0, 7);
      const payDay = Number(pay.slice(8, 10));
      const ym1 = `${n1.y}-${pad2(n1.m)}`;
      const ym2 = `${n2.y}-${pad2(n2.m)}`;
      if (payYm === ym1) return 'term1';
      if (payYm === ym2 && payDay <= 12) return 'term2';
      return null;
    };

    pays.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    pays.forEach(p => {
      const txt = `${p.desc} ${p.type}`.toLocaleLowerCase('tr-TR');
      const unpaid = slots.filter(s => !s.paid);
      if (!unpaid.length) return;
      if (/tamam|1 ve 2/.test(txt) || amountsClose(p.amount, invoices.reduce((s, inv) => s + cleanNumber(inv.total_amount), 0), 0.51)) {
        markPaid(unpaid, p.date);
        return;
      }
      const dateWaves = unpaid.map(s => nearerWave(s.issueDate, p.date)).filter(Boolean) as ('term1' | 'term2')[];
      const dateWave = dateWaves[0] && dateWaves.every(w => w === dateWaves[0]) ? dateWaves[0] : null;
      const labelWave: 'term1' | 'term2' | null = /2\s*\.?\s*vade|2 nci/.test(txt) ? 'term2' : (/1\s*\.?\s*vade|1 nci/.test(txt) ? 'term1' : null);
      const wave = dateWave || labelWave;
      const primary = wave ? unpaid.filter(s => s.term === wave) : unpaid;
      const hit = findSubset(primary, p.amount);
      if (hit && hit.length) {
        markPaid(hit, p.date);
        return;
      }
      if (wave === 'term2' && primary.length) {
        const term2Gross = primary.reduce((s, x) => s + x.gross, 0);
        if (advanceTotal > 0.05 && amountsClose(p.amount + advanceTotal, term2Gross, 0.51)) {
          markPaid(primary, p.date);
          return;
        }
        const asFirst = findSubset(unpaid.filter(s => s.term === 'term1'), p.amount);
        if (asFirst && asFirst.length) {
          const invIds = new Set(asFirst.map(s => s.invoiceId));
          markPaid(unpaid.filter(s => invIds.has(s.invoiceId)), p.date);
          return;
        }
        if (invoices.length <= 2) markPaid(unpaid, p.date);
      }
    });

    const pushGroup = (term: 'term1' | 'term2') => {
      const group = slots.filter(s => s.term === term && s.paid && s.net > 0.009);
      if (!group.length) return;
      const date = contractorTermPayDate(group[0].issueDate, term, group[0].dueDate);
      const amount = Math.round(group.reduce((s, x) => s + x.net, 0) * 100) / 100;
      lines.push({
        id: 'wave_' + term,
        date,
        type: termPayLabel(term),
        desc: group.length === 1 ? group[0].invoiceNo : `${group.length} fatura ${termPayLabel(term)}`,
        debit: 0,
        credit: amount
      });
    };
    const invoiceTotal = invoices.reduce((s, inv) => s + cleanNumber(inv.total_amount), 0);
    const oneShot = pays.some(p => /tamam|1 ve 2/.test(`${p.desc} ${p.type}`.toLocaleLowerCase('tr-TR')) || amountsClose(p.amount, invoiceTotal, 0.51));
    if (oneShot && slots.length > 0 && slots.every(s => s.paid)) {
      const amount = Math.round(slots.reduce((s, x) => s + x.net, 0) * 100) / 100;
      if (amount > 0.009) {
        const p = pays.find(x => /tamam|1 ve 2/.test(`${x.desc} ${x.type}`.toLocaleLowerCase('tr-TR')) || amountsClose(x.amount, invoiceTotal, 0.51));
        lines.push({
          id: 'wave_full',
          date: contractorTermPayDate(slots[0].issueDate, 'term1', p?.date || slots[0].payDate),
          type: 'Tamamı ödeme',
          desc: p?.desc || 'Fatura tamamı ödendi',
          debit: 0,
          credit: amount
        });
      }
    } else {
      pushGroup('term1');
      pushGroup('term2');
    }

    lines.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.type.localeCompare(b.type, 'tr'));
    let running = 0;
    return lines.map(line => {
      running += line.debit - line.credit;
      return { ...line, balance: running };
    });
  };

  const bankTermLines = useMemo(() => {
    const lines: {
      lineId: string;
      invoiceId: any;
      invoiceNo: string;
      contractorName: string;
      term: 'term1' | 'term2';
      termLabel: string;
      dueDate: string;
      issueDate: string;
      amount: number;
      iban: string;
    }[] = [];

    dbInvoices
      .filter(i => i.category === 'subcontractor_invoice')
      .forEach(inv => {
        const fullTitle = String(inv.invoice_no || '');
        if (fullTitle.toUpperCase().includes('AVANS')) return;
        const contractorName = extractContractorName(fullTitle);
        const iban = findContractorIban(contractorName, inv);
        const t1 = inv.term1_status !== 'paid' ? cleanNumber(inv.term1_amount || (inv.total_amount / 2)) : 0;
        const t2 = inv.term2_status !== 'paid' ? cleanNumber(inv.term2_amount || (inv.total_amount / 2)) : 0;
        if (t1 > 0) {
          lines.push({
            lineId: `${inv.id}-term1`,
            invoiceId: inv.id,
            invoiceNo: fullTitle,
            contractorName,
            term: 'term1',
            termLabel: '1 nci ödeme',
            dueDate: contractorTermPayDate(sanitizeDate(inv.issue_date), 'term1', sanitizeDate(inv.term1_due_date || inv.due_date || inv.issue_date)),
            issueDate: sanitizeDate(inv.issue_date),
            amount: t1,
            iban
          });
        }
        if (t2 > 0) {
          lines.push({
            lineId: `${inv.id}-term2`,
            invoiceId: inv.id,
            invoiceNo: fullTitle,
            contractorName,
            term: 'term2',
            termLabel: '2 nci ödeme',
            dueDate: contractorTermPayDate(sanitizeDate(inv.issue_date), 'term2', sanitizeDate(inv.term2_due_date || inv.due_date || inv.issue_date)),
            issueDate: sanitizeDate(inv.issue_date),
            amount: t2,
            iban
          });
        }
      });

    return lines.sort((a, b) => {
      let comparison = 0;
      if (bankSortField === 'contractorName') {
        comparison = (a.contractorName || '').localeCompare(b.contractorName || '', 'tr-TR', { sensitivity: 'base' });
      } else if (bankSortField === 'iban') {
        comparison = (a.iban || '').localeCompare(b.iban || '', 'tr-TR');
      } else if (bankSortField === 'amount') {
        comparison = a.amount - b.amount;
      } else {
        comparison = (a.dueDate || '').localeCompare(b.dueDate || '');
      }
      if (comparison === 0) comparison = (a.invoiceNo || '').localeCompare(b.invoiceNo || '', 'tr-TR');
      return bankSortOrder === 'asc' ? comparison : -comparison;
    });
  }, [dbInvoices, dbSubcontractors, subIbanMap, bankSortField, bankSortOrder]);

  const selectedBankTermLines = useMemo(
    () => bankTermLines.filter(line => bankSelectedLines[line.lineId]),
    [bankTermLines, bankSelectedLines]
  );

  const contractorAdvanceCuts = useMemo(() => {
    const ym = currentPayYearMonth();
    const byKey = new Map<string, { cut: number; applies: { id: any; remaining: number; apply: number; isInst: boolean }[] }>();
    const addCut = (name: string, remaining: number, apply: number, isInst: boolean, id: any) => {
      const key = normalizeContractorKey(name);
      if (key.length < 3 || apply <= 0) return;
      const cur = byKey.get(key) || { cut: 0, applies: [] };
      cur.cut += apply;
      cur.applies.push({ id, remaining, apply, isInst });
      byKey.set(key, cur);
    };

    (dbAdvances || []).forEach((a: any) => {
      const t = String(a.target_type || '');
      if (t && t !== 'contractor' && t !== 'subcontractor') return;
      const remaining = a.remaining_amount === null || a.remaining_amount === undefined
        ? cleanNumber(a.total_amount)
        : cleanNumber(a.remaining_amount);
      if (remaining <= 0) return;
      const inst = Math.max(1, Number(a.total_installments) || 1);
      const isInst = inst > 1;
      if (isInst && String(a.last_applied_month || '') === ym) return;
      const apply = Math.round((isInst ? Math.min(remaining, cleanNumber(a.total_amount) / inst) : remaining) * 100) / 100;
      addCut(String(a.target_name || a.target_id || ''), remaining, apply, isInst, a.id);
    });

    (dbInvoices || []).forEach((inv: any) => {
      const no = String(inv.invoice_no || '');
      const isAdvCat = inv.category === 'subcontractor_advance_paid';
      const isAdvTitle = no.toUpperCase().includes('AVANS');
      if (!isAdvCat && !isAdvTitle) return;
      if (inv.category === 'subcontractor_invoice') return;
      const name = extractAdvanceContractorName(no);
      const already = [...byKey.keys()].some(ak => contractorKeysLooselyMatch(ak, name));
      if (already) return;
      const amt = cleanNumber(inv.total_amount);
      if (amt <= 0) return;
      addCut(name, amt, amt, false, 'invadv_' + inv.id);
    });

    return byKey;
  }, [dbAdvances, dbInvoices]);

  const findContractorAdvanceInfo = (contractorName: string) => {
    const k = normalizeContractorKey(contractorName);
    type AdvInfo = { mapKey: string; cut: number; applies: { id: any; remaining: number; apply: number; isInst: boolean }[] };
    if (!k) return undefined as undefined | AdvInfo;
    const direct = contractorAdvanceCuts.get(k);
    if (direct) return { mapKey: k, ...direct };
    let best: AdvInfo | undefined;
    contractorAdvanceCuts.forEach((val, ak) => {
      if (!ak || ak.length < 4) return;
      if (!contractorKeysLooselyMatch(k, ak)) return;
      if (!best || ak.length > best.mapKey.length) best = { mapKey: ak, cut: val.cut, applies: val.applies };
    });
    return best;
  };

  const canonicalContractorKey = (contractorName: string) => {
    const adv = findContractorAdvanceInfo(contractorName);
    if (adv) return adv.mapKey;
    const sub = (dbSubcontractors || []).find(s => matchesContractor(s, contractorName));
    if (sub) return normalizeContractorKey(sub.company_name || sub.name);
    return normalizeContractorKey(contractorName);
  };

  const decorateBankLinesWithAdvance = (lines: typeof bankTermLines) => {
    const leftover = new Map<string, number>();
    const decorated = new Map<string, (typeof bankTermLines)[number] & { advanceCut: number; netAmount: number }>();
    const selectedIds = new Set(lines.map(l => l.lineId));
    [...lines]
      .sort((a, b) => {
        if (a.term !== b.term) return a.term === 'term1' ? -1 : 1;
        return (a.dueDate || '').localeCompare(b.dueDate || '') || a.lineId.localeCompare(b.lineId);
      })
      .forEach(l => {
        const k = canonicalContractorKey(l.contractorName);
        const info = findContractorAdvanceInfo(l.contractorName);
        if (k && !leftover.has(k + ':p')) {
          const inst = (info?.applies || []).filter(a => a.isInst).reduce((s, a) => s + a.apply, 0);
          const pesin = (info?.applies || []).filter(a => !a.isInst).reduce((s, a) => s + a.apply, 0);
          leftover.set(k + ':i', inst);
          leftover.set(k + ':p', pesin);
        }
        let instPool = leftover.get(k + ':i') || 0;
        let pesinPool = leftover.get(k + ':p') || 0;
        const unpaidTerm1Held = l.term === 'term2' && bankTermLines.some(x =>
          canonicalContractorKey(x.contractorName) === k &&
          x.term === 'term1' &&
          !selectedIds.has(x.lineId)
        );
        let cut = 0;
        if (!unpaidTerm1Held) {
          if (l.term === 'term1' && instPool > 0) {
            const instCut = Math.round(Math.min(l.amount, instPool) * 100) / 100;
            cut += instCut;
            instPool = Math.round((instPool - instCut) * 100) / 100;
          }
          const pesinCut = Math.round(Math.min(l.amount - cut, pesinPool) * 100) / 100;
          cut += pesinCut;
          pesinPool = Math.round((pesinPool - pesinCut) * 100) / 100;
        }
        leftover.set(k + ':i', instPool);
        leftover.set(k + ':p', pesinPool);
        decorated.set(l.lineId, {
          ...l,
          advanceCut: cut,
          netAmount: Math.round(Math.max(0, l.amount - cut) * 100) / 100
        });
      });
    return lines.map(l => decorated.get(l.lineId) || { ...l, advanceCut: 0, netAmount: l.amount });
  };

  const allDecoratedBankLines = useMemo(
    () => decorateBankLinesWithAdvance(bankTermLines),
    [bankTermLines, contractorAdvanceCuts, dbSubcontractors]
  );

  const decoratedBankByLineId = useMemo(() => {
    const m = new Map<string, (typeof allDecoratedBankLines)[number]>();
    allDecoratedBankLines.forEach(l => m.set(l.lineId, l));
    return m;
  }, [allDecoratedBankLines]);

  const displayBankTermLines = allDecoratedBankLines;

  const sentBatchLineIds = useMemo(() => {
    const ids = new Set<string>();
    (dbPaymentBatches || []).forEach((b: any) => {
      if (String(b.status) !== 'sent') return;
      const lines = (b.payload && b.payload.lines) || [];
      if (!Array.isArray(lines)) return;
      lines.forEach((l: any) => { if (l.lineId) ids.add(String(l.lineId)); });
    });
    return ids;
  }, [dbPaymentBatches]);

  const payableBankTermLines = useMemo(
    () => displayBankTermLines.filter(l => (l.netAmount || 0) > 0.009 && !sentBatchLineIds.has(l.lineId)),
    [displayBankTermLines, sentBatchLineIds]
  );

  const waveBankTermLines = useMemo(() => {
    if (bankWaveFilter === 'all') return payableBankTermLines;
    return payableBankTermLines.filter(l => l.term === bankWaveFilter);
  }, [payableBankTermLines, bankWaveFilter]);

  const bankContractorRows = useMemo(() => {
    const map = new Map<string, {
      groupKey: string;
      contractorName: string;
      iban: string;
      netAmount: number;
      advanceCut: number;
      lineIds: string[];
      invoiceNos: string[];
      dueDate: string;
    }>();
    waveBankTermLines.forEach(l => {
      const groupKey = canonicalContractorKey(l.contractorName) || l.contractorName;
      const cur = map.get(groupKey) || {
        groupKey,
        contractorName: l.contractorName,
        iban: l.iban,
        netAmount: 0,
        advanceCut: 0,
        lineIds: [] as string[],
        invoiceNos: [] as string[],
        dueDate: l.dueDate || ''
      };
      cur.netAmount += l.netAmount;
      cur.advanceCut += l.advanceCut || 0;
      cur.lineIds.push(l.lineId);
      if (l.invoiceNo && !cur.invoiceNos.includes(l.invoiceNo)) cur.invoiceNos.push(l.invoiceNo);
      if (l.iban && l.iban !== 'IBAN Eksik' && (cur.iban === 'IBAN Eksik' || !cur.iban)) cur.iban = l.iban;
      if (l.dueDate && (!cur.dueDate || l.dueDate < cur.dueDate)) cur.dueDate = l.dueDate;
      if ((l.contractorName || '').length > (cur.contractorName || '').length) cur.contractorName = l.contractorName;
      map.set(groupKey, cur);
    });
    const rows = Array.from(map.values());
    rows.sort((a, b) => {
      let comparison = 0;
      if (bankSortField === 'contractorName') {
        comparison = a.contractorName.localeCompare(b.contractorName, 'tr-TR', { sensitivity: 'base' });
      } else if (bankSortField === 'iban') {
        comparison = (a.iban || '').localeCompare(b.iban || '', 'tr-TR');
      } else if (bankSortField === 'amount') {
        comparison = a.netAmount - b.netAmount;
      } else {
        comparison = (a.dueDate || '').localeCompare(b.dueDate || '');
      }
      return bankSortOrder === 'asc' ? comparison : -comparison;
    });
    return rows;
  }, [waveBankTermLines, bankSortField, bankSortOrder]);
  // PERSONEL HESAPLAMA, ARAMA VE SIRALAMA MOTORU
  const processedEmployees = useMemo(() => {
    const ym = currentPayYearMonth();
    return (dbEmployees || [])
      .map(emp => {
        const pay = employeePayForMonth(emp, ym);
        return {
          ...emp,
          baseSalaryNum: pay.base,
          bonusNum: pay.bonus,
          advanceDeduction: pay.advanceCut,
          netPayable: employeeUnpaidFromBooks(emp),
          carriedOverDebt: pay.carried
        };
      })
      .filter(emp => {
        if (!empSearchTerm.trim()) return true;
        const term = empSearchTerm.toLowerCase();
        return (
          (emp.full_name || '').toLowerCase().includes(term) ||
          (emp.role_title || '').toLowerCase().includes(term) ||
          (emp.phone || '').includes(term)
        );
      })
      .sort((a, b) => {
        let comp = 0;
        if (empSortField === 'name') {
          comp = (a.full_name || '').localeCompare(b.full_name || '', 'tr-TR', { sensitivity: 'base' });
        } else if (empSortField === 'salary') {
          comp = a.baseSalaryNum - b.baseSalaryNum;
        } else if (empSortField === 'netPayable') {
          comp = a.netPayable - b.netPayable;
        }
        return empSortOrder === 'asc' ? comp : -comp;
      });
  }, [dbEmployees, dbAdvances, dbEmployeeTransactions, dbInvoices, empSearchTerm, empSortField, empSortOrder]);

  // PERSONEL SAYFASI FİNANSAL ÖZET SAYAÇLARI
  const empSummary = useMemo(() => {
    let totalBase = 0;
    let totalBonus = 0;
    let totalAdv = 0;
    let totalNet = 0;
    let totalDebt = 0;

    processedEmployees.forEach(e => {
      totalBase += e.baseSalaryNum;
      totalBonus += e.bonusNum;
      totalAdv += e.advanceDeduction;
      totalNet += e.netPayable;
      totalDebt += e.carriedOverDebt;
    });

    return { totalBase, totalBonus, totalAdv, totalNet, totalDebt, count: processedEmployees.length };
  }, [processedEmployees]);
    
  const resolveDecoratedBankLines = (lines: typeof bankTermLines) =>
    lines
      .map(l => decoratedBankByLineId.get(l.lineId) || { ...l, advanceCut: 0, netAmount: l.amount })
      .filter(l => (l.netAmount || 0) > 0.009);

  const bankLiveSelectionSummary = useMemo(() => {
    const decorated = resolveDecoratedBankLines(selectedBankTermLines);
    const names = new Set(decorated.map(l => l.contractorName));
    const total = decorated.reduce((sum, l) => sum + l.netAmount, 0);
    return { total, count: names.size, lineCount: decorated.length };
  }, [selectedBankTermLines, decoratedBankByLineId]);

  const applyAdvanceUsageToDb = async (lines: { contractorName: string; advanceCut: number }[]) => {
    const ym = currentPayYearMonth();
    const usedByKey = new Map<string, { info: NonNullable<ReturnType<typeof findContractorAdvanceInfo>>; used: number }>();
    for (const line of lines) {
      if (!line.advanceCut) continue;
      const info = findContractorAdvanceInfo(line.contractorName);
      const key = info?.mapKey || canonicalContractorKey(line.contractorName);
      if (!key || !info) continue;
      const cur = usedByKey.get(key) || { info, used: 0 };
      cur.used += line.advanceCut;
      usedByKey.set(key, cur);
    }
    for (const { info, used } of usedByKey.values()) {
      let left = Math.round(used * 100) / 100;
      for (const ap of info.applies) {
        if (left <= 0) break;
        if (!ap.id || String(ap.id).startsWith('invadv_')) continue;
        const take = Math.round(Math.min(ap.remaining, ap.apply, left) * 100) / 100;
        if (take <= 0) continue;
        const nextRemaining = Math.round(Math.max(0, ap.remaining - take) * 100) / 100;
        left = Math.round((left - take) * 100) / 100;
        const payload: any = { remaining_amount: nextRemaining };
        if (ap.isInst) payload.last_applied_month = ym;
        const { error } = await supabase.from('advance_payments').update(payload).eq('id', ap.id);
        if (error && /last_applied_month/i.test(error.message)) {
          await supabase.from('advance_payments').update({ remaining_amount: nextRemaining }).eq('id', ap.id);
        }
      }
    }
  };

  const handleToggleSelectAllBank = () => {
    const allSelected = waveBankTermLines.length > 0 && waveBankTermLines.every(l => bankSelectedLines[l.lineId]);
    const next: { [key: string]: boolean } = {};
    waveBankTermLines.forEach(l => {
      next[l.lineId] = !allSelected;
    });
    setBankSelectedLines(next);
  };

  const handleToggleBankContractor = (lineIds: string[]) => {
    const allOn = lineIds.length > 0 && lineIds.every(id => bankSelectedLines[id]);
    const next = { ...bankSelectedLines };
    lineIds.forEach(id => {
      next[id] = !allOn;
    });
    setBankSelectedLines(next);
  };

  const handleDownloadBankExcel = () => {
    if (selectedBankTermLines.length === 0) {
      alert('Lütfen ödemek istediğiniz alt yüklenicileri işaretleyin. Excel’de her kişi için tek tutar çıkar.');
      return;
    }

    const decoratedSelected = resolveDecoratedBankLines(selectedBankTermLines);
    if (decoratedSelected.length === 0) {
      alert('Seçilen ödemelerin tamamı avans ile kapandı. Bankaya gidecek tutar yok.');
      return;
    }
    const grouped = new Map<string, { contractorName: string; iban: string; amount: number; notes: string[] }>();
    decoratedSelected.forEach(line => {
      const key = canonicalContractorKey(line.contractorName) || line.contractorName;
      if (!grouped.has(key)) {
        grouped.set(key, { contractorName: line.contractorName, iban: line.iban, amount: 0, notes: [] });
      }
      const cur = grouped.get(key)!;
      cur.amount += line.netAmount;
      cur.notes.push(`${line.invoiceNo} ${line.termLabel}${line.advanceCut ? ' −avans' : ''}`);
      if (cur.iban === 'IBAN Eksik' && line.iban !== 'IBAN Eksik') cur.iban = line.iban;
    });
    const selectedRows = Array.from(grouped.values()).filter(r => r.amount > 0.009);

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
      'Ödeme Tutarı (TL)': item.amount,
      'Açıklama': `Tazeyol Lojistik Hakediş (${item.notes.slice(0, 3).join('; ')}${item.notes.length > 3 ? '…' : ''})`
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Toplu Odeme');
    const todayStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Tazeyol_Banka_Odeme_Talimati_${todayStr}.xlsx`);

    const cashTotal = selectedRows.reduce((s, r) => s + r.amount, 0);
    const payload = {
      rows: selectedRows.map(r => ({ contractorName: r.contractorName, iban: r.iban, amount: Math.round(r.amount * 100) / 100 })),
      lines: decoratedSelected.map(l => ({
        lineId: l.lineId,
        invoiceId: l.invoiceId,
        term: l.term,
        contractorName: l.contractorName,
        netAmount: l.netAmount,
        advanceCut: l.advanceCut || 0
      }))
    };
    const waveLabel = bankWaveFilter === 'term1' ? '1 nci ödeme' : bankWaveFilter === 'term2' ? '2 nci ödeme' : 'karışık / kalan';
    supabase.from('payment_batches').insert([{
      pay_date: todayStr,
      status: 'sent',
      title: `${todayStr} banka talimatı (${waveLabel})`,
      total_amount: Math.round(cashTotal * 100) / 100,
      contractor_count: selectedRows.length,
      payload
    }]).then(({ error }) => {
      if (error) {
        alert('Excel indi ama talimat partisi kaydedilemedi. setup_payment_batches.sql dosyasını SQL Editor’da çalıştırın.\n' + error.message);
        return;
      }
      setBankSelectedLines({});
      loadPortalData();
      alert(`Talimat Excel’i indirildi. Ödendi işaretlenmedi.\nBanka başarılı raporu gelince aşağıdaki partiden “Ödendi işle” deyin.\n${selectedRows.length} kişi, ${cashTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`);
    });
  };

  const handleConfirmPaymentBatch = async (batch: any) => {
    if (!isAdmin) return;
    if (String(batch.status) === 'paid') {
      alert('Bu parti zaten ödendi işlendi.');
      return;
    }
    const payload = batch.payload || {};
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const lines = Array.isArray(payload.lines) ? payload.lines : [];
    const cashTotal = rows.reduce((s: number, r: any) => s + cleanNumber(r.amount), 0);
    const payDate = sanitizeDate(batch.pay_date) || new Date().toISOString().split('T')[0];
    if (!window.confirm(`Banka bu partiyi ödedi mi?\n${formatDateTR(payDate)} · ${rows.length} kişi · ${cashTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺\n\nOnaylayınca carilere bir kez işlenir, kasadan net düşer, vadeler kapanır.`)) return;
    try {
      const byInvoice = new Map<any, { term1?: boolean; term2?: boolean }>();
      lines.forEach((line: any) => {
        const cur = byInvoice.get(line.invoiceId) || {};
        if (line.term === 'term1') cur.term1 = true;
        if (line.term === 'term2') cur.term2 = true;
        byInvoice.set(line.invoiceId, cur);
      });
      for (const [invoiceId, terms] of byInvoice) {
        const inv = dbInvoices.find(i => i.id === invoiceId);
        if (!inv) continue;
        const updates: any = {};
        if (terms.term1) updates.term1_status = 'paid';
        if (terms.term2) updates.term2_status = 'paid';
        const isT1Paid = updates.term1_status === 'paid' || inv.term1_status === 'paid';
        const isT2Paid = updates.term2_status === 'paid' || inv.term2_status === 'paid';
        if (isT1Paid && isT2Paid) updates.status = 'paid';
        await supabase.from('invoices').update(updates).eq('id', invoiceId);
      }
      const existing = (dbInvoices || []).filter((i: any) => i.category === 'subcontractor_paid_outflow');
      const cashRows = rows
        .filter((r: any) => cleanNumber(r.amount) > 0.009)
        .filter((r: any) => !existing.some((i: any) =>
          sanitizeDate(i.issue_date) === payDate &&
          Math.abs(cleanNumber(i.total_amount) - cleanNumber(r.amount)) < 0.05 &&
          contractorKeysLooselyMatch(r.contractorName, extractContractorName(i.invoice_no || ''))
        ))
        .map((r: any) => ({
          invoice_no: `ÖDEME - Banka talimatı - ${r.contractorName}`,
          direction: 'incoming',
          category: 'subcontractor_paid_outflow',
          total_amount: Math.round(cleanNumber(r.amount) * 100) / 100,
          issue_date: payDate,
          due_date: payDate,
          status: 'paid'
        }));
      if (cashRows.length > 0) {
        const { error: cashErr } = await supabase.from('invoices').insert(cashRows);
        if (cashErr) throw cashErr;
      }
      await applyAdvanceUsageToDb(lines.map((l: any) => ({ contractorName: l.contractorName, advanceCut: cleanNumber(l.advanceCut) })));
      const { error: stErr } = await supabase.from('payment_batches').update({ status: 'paid', pay_date: payDate }).eq('id', batch.id);
      if (stErr) throw stErr;
      alert(`Parti ödendi işlendi. Carilere yazıldı. Kasadan ${cashTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺ düşüldü.`);
      loadPortalData();
    } catch (err: any) {
      alert('Parti onay hatası: ' + err.message);
    }
  };

  const handleCancelPaymentBatch = async (batch: any) => {
    if (!isAdmin) return;
    if (String(batch.status) === 'paid') {
      alert('Ödendi işlenmiş parti iptal edilmez.');
      return;
    }
    if (!window.confirm('Bu talimatı iptal edeyim mi? Excel bankaya gitmediyse satırlar tekrar listelenir. Cariye işlem yazılmaz.')) return;
    const { error } = await supabase.from('payment_batches').update({ status: 'cancelled' }).eq('id', batch.id);
    if (error) {
      alert('İptal hatası: ' + error.message);
      return;
    }
    loadPortalData();
  };

  const handleImportPaidBankExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const payDate = window.prompt('Bu Excel hangi günde ödendi? (YYYY-AA-GG)', new Date().toISOString().split('T')[0]);
    if (!payDate) {
      e.target.value = '';
      return;
    }
    const date = sanitizeDate(payDate);
    if (!date) {
      alert('Geçerli bir tarih girin.');
      e.target.value = '';
      return;
    }
    const invYmRaw = window.prompt('Bu tutarlar hangi ayın faturaları? (YYYY-AA)\nÖrn. 26.10 ve 05.11 ödemeleri için 2026-09', date.slice(0, 7));
    const invYm = /^\d{4}-\d{2}$/.test(String(invYmRaw || '').trim()) ? String(invYmRaw).trim() : '';
    const waveRaw = window.prompt('1 nci ödeme mi 2 nci mi? (1 veya 2, boş = yalnızca cariye ödeme yaz)', '1');
    const closeTerm: 'term1' | 'term2' | null = String(waveRaw || '').trim() === '2' ? 'term2' : (String(waveRaw || '').trim() === '1' ? 'term1' : null);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const existing = (dbInvoices || []).filter((i: any) => i.category === 'subcontractor_paid_outflow');
      const toInsert: any[] = [];
      let skipped = 0;
      rows.forEach((row: any) => {
        const name = String(row['Alıcı Unvanı'] || row['Unvan'] || row['Ad Soyad'] || row['Alt Yüklenici'] || '').trim();
        const amt = cleanNumber(row['Ödeme Tutarı (TL)'] || row['Tutar'] || row['Tutar (TL)'] || row['Net']);
        if (!name || amt <= 0) return;
        const dup = existing.some((i: any) => {
          if (Math.abs(cleanNumber(i.total_amount) - amt) > 0.05) return false;
          if (sanitizeDate(i.issue_date) !== date) return false;
          return contractorKeysLooselyMatch(name, extractContractorName(i.invoice_no || ''));
        });
        if (dup || toInsert.some(x => contractorKeysLooselyMatch(name, extractContractorName(x.invoice_no)) && Math.abs(x.total_amount - amt) < 0.05)) {
          skipped += 1;
          return;
        }
        toInsert.push({
          invoice_no: `ÖDEME - Banka talimatı - ${name}`,
          direction: 'incoming',
          category: 'subcontractor_paid_outflow',
          total_amount: Math.round(amt * 100) / 100,
          issue_date: date,
          due_date: date,
          status: 'paid'
        });
      });
      if (toInsert.length) {
        const { error } = await supabase.from('invoices').insert(toInsert);
        if (error) throw error;
      }
      let closed = 0;
      if (closeTerm && invYm) {
        const names = toInsert.map(x => extractContractorName(x.invoice_no));
        const extraNames = rows.map((row: any) => String(row['Alıcı Unvanı'] || row['Unvan'] || row['Ad Soyad'] || row['Alt Yüklenici'] || '').trim()).filter(Boolean);
        const allNames = [...names, ...extraNames];
        for (const inv of dbInvoices || []) {
          if (inv.category !== 'subcontractor_invoice') continue;
          const issueYm = sanitizeDate(inv.issue_date || '').slice(0, 7);
          if (issueYm !== invYm) continue;
          const contractor = extractContractorName(inv.invoice_no || '');
          if (!allNames.some(n => contractorKeysLooselyMatch(n, contractor))) continue;
          const updates: any = {};
          if (closeTerm === 'term1' && inv.term1_status !== 'paid') updates.term1_status = 'paid';
          if (closeTerm === 'term2' && inv.term2_status !== 'paid') updates.term2_status = 'paid';
          if (!Object.keys(updates).length) continue;
          const t1 = updates.term1_status === 'paid' || inv.term1_status === 'paid';
          const t2 = updates.term2_status === 'paid' || inv.term2_status === 'paid';
          if (t1 && t2) updates.status = 'paid';
          const { error } = await supabase.from('invoices').update(updates).eq('id', inv.id);
          if (!error) closed += 1;
        }
      }
      alert(`${date} tarihli ${toInsert.length} ödeme carilere işlendi.${skipped ? `\n${skipped} satır zaten vardı, atlandı.` : ''}${closed ? `\n${invYm} faturalarında ${closed} vade kapatıldı.` : ''}`);
      loadPortalData();
    } catch (err: any) {
      alert('Ödeme Excel yükleme hatası: ' + err.message);
    } finally {
      e.target.value = '';
    }
  };

  // 11. HAKEDİŞ SATIRINDA ESNEK VADE ÖDEME (1. Vade / 2. Vade / Tümü)
  const handlePaySubcontractorTerm = async (inv: any, term: 'term1' | 'term2' | 'both') => {
    if (!isAdmin) return;
    const t1 = cleanNumber(inv.term1_amount || (inv.total_amount / 2));
    const t2 = cleanNumber(inv.term2_amount || (inv.total_amount / 2));
    const line1 = decoratedBankByLineId.get(`${inv.id}-term1`);
    const line2 = decoratedBankByLineId.get(`${inv.id}-term2`);

    let payAmt = 0;
    if (term === 'term1') payAmt = line1 ? line1.netAmount : t1;
    else if (term === 'term2') payAmt = line2 ? line2.netAmount : t2;
    else if (term === 'both') {
      payAmt =
        (inv.term1_status !== 'paid' ? (line1 ? line1.netAmount : t1) : 0) +
        (inv.term2_status !== 'paid' ? (line2 ? line2.netAmount : t2) : 0);
    }

    const confirmMsg = `${inv.invoice_no}\nÖdenecek tutar (avans mahsubu düşülmüş): ${payAmt.toLocaleString('tr-TR')} ₺\nBu ödemeyi onaylıyor musunuz? (Kasadan fiilen düşülecektir)`;
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

      if (payAmt > 0.009) {
        const contractor = extractContractorName(inv.invoice_no || '');
        const already = (dbInvoices || []).some((i: any) => {
          if (i.category !== 'subcontractor_paid_outflow' || i.status !== 'paid') return false;
          if (!contractorKeysLooselyMatch(contractor, extractContractorName(i.invoice_no || ''))) return false;
          const ia = cleanNumber(i.total_amount);
          const idate = sanitizeDate(i.issue_date);
          if (idate === todayStr && amountsClose(ia, payAmt, 0.05)) return true;
          if (/tamam|1 ve 2/i.test(String(i.invoice_no || '')) && (amountsClose(ia, payAmt, 0.51) || amountsClose(ia, payAmt * 2, 1))) return true;
          return false;
        });
        if (!already) {
          await supabase.from('invoices').insert([{
            invoice_no: `ÖDEME - ${inv.invoice_no} (${term === 'term1' ? '1 nci ödeme' : term === 'term2' ? '2 nci ödeme' : 'Tamamı'})`,
            direction: 'incoming',
            category: 'subcontractor_paid_outflow',
            total_amount: payAmt,
            issue_date: todayStr,
            due_date: todayStr,
            status: 'paid'
          }]);
        }
      }

      const paidCuts = [term === 'term2' ? line2 : line1, term === 'both' ? line2 : null].filter(Boolean) as NonNullable<typeof line1>[];
      await applyAdvanceUsageToDb(paidCuts);

      alert('Ödeme başarıyla işlendi. Avans önce 1 nci ödemeden, gerekirse 2 nci ödemeden mahsup edildi.');
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

      const { error: invErr } = await supabase.from('invoices').insert([{
        invoice_no: `AVANS - ${subPaymentFormData.subcontractorName} (${isInstallment ? instCount + ' Taksit' : 'Peşin Avans'})`,
        direction: 'incoming',
        category: 'subcontractor_advance_paid',
        total_amount: amt,
        issue_date: todayStr,
        due_date: todayStr,
        status: 'paid'
      }]);
      if (invErr) throw invErr;

      const advRow: any = {
        target_type: 'contractor',
        target_id: subPaymentFormData.subcontractorName,
        target_name: subPaymentFormData.subcontractorName,
        payment_type: isInstallment ? 'contractor_installment_advance' : 'contractor_advance',
        total_amount: amt,
        total_installments: isInstallment ? instCount : 1,
        remaining_amount: amt,
        last_applied_month: null,
        issue_date: todayStr,
        notes: isInstallment 
          ? `Taksit başı düşüm: ${singleDeduction.toLocaleString('tr-TR')} TL (Kalan: ${instCount - 1} Taksit / ${(amt - singleDeduction).toLocaleString('tr-TR')} TL)`
          : 'Peşin avans (Faturadan mahsup edilecek)'
      };
      let { error: advErr } = await supabase.from('advance_payments').insert([advRow]);
      if (advErr && /last_applied_month/i.test(advErr.message)) {
        delete advRow.last_applied_month;
        const retry = await supabase.from('advance_payments').insert([advRow]);
        advErr = retry.error;
      }
      if (advErr) throw advErr;

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
    const customerName = saleInvoice.customerName || '';
    const row = customerBalances.find(r => r.customer.name === customerName);
    const remaining = row ? Math.max(0, row.net) : cleanNumber(saleInvoice.total_amount);
    setNewReceiptFormData({
      customerName,
      receiptNo: `CARI-${new Date().toISOString().split('T')[0]}`,
      amount: remaining > 0 ? String(remaining) : '',
      targetAccount: 'bank',
      date: new Date().toISOString().split('T')[0],
      relatedInvoiceId: null
    });
    setIsNewReceiptModalOpen(true);
  };

  const handleSetSalePaidStatus = async (sale: any, nextStatus: 'paid' | 'unpaid') => {
    if (!isAdmin) return;
    const label = nextStatus === 'paid' ? 'mutabakatta ödendi' : 'tekrar açık';
    if (!window.confirm(`${sale.invoice_no || sale.cleanInvoiceNo}\nBu faturayı ${label} işaretlemek istiyor musunuz?\nKasa hareketi oluşmaz; cari bakiye alınan paralara göre kalır.`)) return;
    try {
      const { error } = await supabase.from('invoices').update({ status: nextStatus }).eq('id', sale.id);
      if (error) throw error;
      await loadPortalData();
    } catch (err: any) {
      alert('Durum güncellenemedi: ' + err.message);
    }
  };

  const handleSaveNewReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = cleanNumber(newReceiptFormData.amount);
    if (amt <= 0) {
      alert('Lütfen tutar giriniz.');
      return;
    }
    if (!String(newReceiptFormData.customerName || '').trim()) {
      alert('Müşteri seçiniz.');
      return;
    }

    try {
      const recTitle = `THS - ${newReceiptFormData.receiptNo || 'Dekont'} - ${newReceiptFormData.customerName} - ${Date.now()}`;
      const { error: insErr } = await supabase.from('invoices').insert([{
        invoice_no: recTitle,
        direction: 'incoming',
        category: 'customer_advance',
        total_amount: amt,
        issue_date: newReceiptFormData.date,
        due_date: newReceiptFormData.date,
        status: 'paid'
      }]);

      if (insErr) throw insErr;

      alert('Tutar müşteri carisine fatura bağımsız işlendi. Faturalar açık kalır; dönemi kapatınca ayrıca ödendi işaretleyin.');
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

    const payRows = selectedIds
      .map(id => ({ id, amount: cleanNumber(bulkSalaryItems[Number(id)].amount), name: bulkSalaryItems[Number(id)].name }))
      .filter(row => row.amount > 0);
    if (payRows.length === 0) {
      alert('Ödenecek tutar 0 olan kayıtlar atlanır. En az bir kişiye tutar girin.');
      return;
    }
    const totalBulkAmount = payRows.reduce((sum, row) => sum + row.amount, 0);
    const confirm = window.confirm(`Seçilen ${payRows.length} personele toplam ${totalBulkAmount.toLocaleString('tr-TR')} ₺ ödenecek.\nBu tutar kasadan düşer; personel carisinde kalan borç durur.`);
    if (!confirm) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const sourceLabel = bulkSalarySource === 'bank' ? 'Banka' : 'Kasa';
      const invInserts = payRows.map(row => ({
        invoice_no: `MAAŞ - ${row.name} (#${row.id}) (${sourceLabel})`,
        direction: 'incoming',
        category: 'salary_payroll',
        total_amount: row.amount,
        issue_date: today,
        due_date: today,
        status: 'paid'
      }));

      const { error } = await supabase.from('invoices').insert(invInserts);
      if (error) throw error;

      alert(`Toplu ödeme işlendi. Kasadan ${totalBulkAmount.toLocaleString('tr-TR')} ₺ düşüldü. Resmi tutarı ödenenlerde kalan (prim vb.) caride durur.`);
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
    if (amt <= 0) {
      alert('Lütfen geçerli bir tutar giriniz.');
      return;
    }

    try {
      const desc = expenseFormData.companyName || 'Genel Şirket Masrafı';
      let fullTitle = `${expenseFormData.invoiceNo ? expenseFormData.invoiceNo + ' - ' : ''}${desc}${expenseFormData.plateNumber ? ' [' + expenseFormData.plateNumber.toUpperCase() + ']' : ''}`;
      fullTitle = fullTitle.replace(/^\[KK\]\s*/i, '');
      const paidByCard = expenseFormData.status === 'paid' && expenseFormData.paidSource === 'card';
      if (paidByCard) fullTitle = `[KK] ${fullTitle}`;
      const payload: any = {
        invoice_no: fullTitle,
        direction: 'incoming',
        category: expenseFormData.category || 'other',
        total_amount: amt,
        issue_date: expenseFormData.issueDate,
        due_date: expenseFormData.dueDate || expenseFormData.issueDate,
        status: expenseFormData.status,
        paid_source: expenseFormData.status === 'paid' ? (paidByCard ? 'card' : 'cash') : null
      };

      const saveExpense = async (data: any) => {
        if (editingExpenseId) return supabase.from('invoices').update(data).eq('id', editingExpenseId);
        return supabase.from('invoices').insert([data]);
      };

      let { error } = await saveExpense(payload);
      if (error && /paid_source/i.test(error.message)) {
        const { paid_source, ...fallback } = payload;
        ({ error } = await saveExpense(fallback));
      }
      if (error) throw error;
      alert(paidByCard
        ? 'Gider kartla kapatıldı. Kasa şimdi düşmez; kart ekstresi ödenince düşer.'
        : (editingExpenseId ? 'Gider kaydı başarıyla güncellendi!' : 'Gider kaydı başarıyla eklendi!'));

      setIsGeneralExpenseModalOpen(false);
      setEditingExpenseId(null);
      setExpenseFormData({
        category: 'taxes_sgk',
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

  // PERSONEL CARİ HAREKETİNİ SİL (AVANS / PRİM HATALI GİRİŞ DÜZELTME)
  const openCustomerModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomerId(customer.id);
      setCustomerFormData({
        name: customer.name || '',
        tax_id: customer.tax_id || '',
        tax_office: customer.tax_office || '',
        address: customer.address || '',
        phone: customer.phone || '',
        email: customer.email || '',
        notes: customer.notes || ''
      });
    } else {
      setEditingCustomerId(null);
      setCustomerFormData({
        name: '',
        tax_id: '',
        tax_office: '',
        address: '',
        phone: '',
        email: '',
        notes: ''
      });
    }
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const name = customerFormData.name.trim();
    if (!name) {
      alert('Müşteri unvanı zorunludur.');
      return;
    }
    const payload = {
      name,
      tax_id: customerFormData.tax_id.trim() || null,
      tax_office: customerFormData.tax_office.trim() || null,
      address: customerFormData.address.trim() || null,
      phone: customerFormData.phone.trim() || null,
      email: customerFormData.email.trim() || null,
      notes: customerFormData.notes.trim() || null
    };
    try {
      if (editingCustomerId) {
        const { error } = await supabase.from('customers').update(payload).eq('id', editingCustomerId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('customers').insert([payload]);
        if (error) throw error;
      }
      setIsCustomerModalOpen(false);
      await loadPortalData();
    } catch (err: any) {
      alert('Müşteri kaydedilemedi: ' + (err.message || 'Tablo yoksa supabase/setup_customers.sql dosyasını SQL Editor’da çalıştırın.'));
    }
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    if (!isAdmin) return;
    if (!window.confirm(`${customer.name} kartı silinsin mi? Eski faturalar durur; yeni Excel eşleşmesi bu unvanı bulamaz.`)) return;
    try {
      const { error } = await supabase.from('customers').delete().eq('id', customer.id);
      if (error) throw error;
      await loadPortalData();
    } catch (err: any) {
      alert('Müşteri silinemedi: ' + err.message);
    }
  };

  const handleDeleteAdvanceRecord = async (advId: string | number) => {
    if (!window.confirm('Bu cari kaydı (avans/prim) silmek istediğinize emin misiniz? Bakiye yeniden hesaplanacaktır.')) return;
    try {
      let { error } = await supabase.from('advance_payments').delete().eq('id', advId);
      if (error) {
        const second = await supabase.from('advances').delete().eq('id', advId);
        if (second.error) throw error;
      }
      await loadPortalData();
    } catch (err: any) {
      alert('Kayıt silinemedi: ' + err.message);
    }
  };
// PERSONEL ÇOKLU İŞLEM EKLEME (PRİM, TEKİL AVANS, TAKSİTLİ AVANS - TARİH DESTEKLİ)
  const handleAddEmployeeTransaction = async (
    empId: number | string,
    type: 'bonus' | 'advance' | 'installment_advance',
    title: string,
    totalAmount: number,
    installments: number = 1,
    txDate?: string
  ) => {
    if (!empId || !title.trim() || totalAmount <= 0) {
      alert('Lütfen geçerli bir açıklama ve 0\'dan büyük bir tutar girin.');
      return;
    }
    const instCount = Math.max(1, Number(installments) || 1);
    const monthlyCut = type === 'installment_advance' ? Math.round(totalAmount / instCount) : totalAmount;
    const finalDate = txDate || new Date().toISOString().split('T')[0];

    try {
      const { error } = await supabase.from('employee_transactions').insert([{
        employee_id: empId,
        type: type,
        title: title.trim(),
        total_amount: totalAmount,
        installment_count: instCount,
        monthly_cut: monthlyCut,
        transaction_date: finalDate
      }]);
      if (error) throw error;
      await loadPortalData();
    } catch (err: any) {
      alert('İşlem eklenemedi: ' + err.message);
    }
  };

  // PERSONEL İŞLEMİ SİLME
  const handleDeleteEmployeeTransaction = async (txId: number | string) => {
    if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz? Bordro tutarları otomatik yeniden hesaplanacaktır.')) return;
    try {
      const { error } = await supabase.from('employee_transactions').delete().eq('id', txId);
      if (error) throw error;
      await loadPortalData();
    } catch (err: any) {
      alert('Kayıt silinemedi: ' + err.message);
    }
  };
  
  // 18. PERSONEL EKLEME & DÜZENLEME FORMU (PRİM / EK MASRAF DESTEKLİ)
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeFormData.fullName.trim()) return;

    try {
    const bonusAmt = cleanNumber(employeeFormData.monthlyBonus);
    const advanceAmt = cleanNumber(employeeFormData.monthlyAdvance);
    const payload = {
      full_name: (employeeFormData.fullName || '').trim(),
      role_title: employeeFormData.roleTitle || 'Kamyon Şoförü / Dağıtım',
      base_salary: cleanNumber(employeeFormData.baseSalary),
      employer_sgk: cleanNumber(employeeFormData.employerSgk),
      hire_date: employeeFormData.hireDate || null,
      phone: (employeeFormData.phone || '').trim(),
      iban: formatIBAN(employeeFormData.iban || ''),
      monthly_bonus: bonusAmt,
      bonus_description: (employeeFormData.bonusDescription || '').trim(),
      monthly_advance: advanceAmt,
      advance_description: (employeeFormData.advanceDescription || '').trim(),
      advance_total: cleanNumber(employeeFormData.advanceTotal || employeeFormData.monthlyAdvance || 0),
      advance_installments: Number(employeeFormData.advanceInstallments) || 1
    };
      
    const savePayload = async (data: typeof payload) => {
      if (editingEmployeeId) {
        return supabase.from('employees').update(data).eq('id', editingEmployeeId);
      }
      return supabase.from('employees').insert([data]);
    };

    let { error } = await savePayload(payload);
    let missingColumn = false;
    if (error && /could not find the/i.test(error.message)) {
      missingColumn = true;
      const fallback: any = { ...payload };
      if (error.message.includes('hire_date')) delete fallback.hire_date;
      if (error.message.includes('employer_sgk')) delete fallback.employer_sgk;
      const retry = await savePayload(fallback);
      error = retry.error;
    }
    if (error) throw error;
    alert(
      missingColumn
        ? 'Personel kaydedildi. İşe girişin kalması için setup_employee_sgk.sql dosyasını SQL Editor’da bir kez Run deyin.'
        : editingEmployeeId
          ? 'Personel bilgileri ve prim başarıyla güncellendi!'
          : 'Yeni personel başarıyla kaydedildi!'
    );

      setIsEmployeeModalOpen(false);
      setEditingEmployeeId(null);
      setEmployeeFormData({ fullName: '', roleTitle: 'Kamyon Şoförü / Dağıtım', baseSalary: '', employerSgk: '', phone: '', iban: '', monthlyBonus: '', bonusDescription: '', monthlyAdvance: '', advanceDescription: '', hireDate: '' });
      loadPortalData();
    } catch (err: any) {
      alert('Personel işlem hatası: ' + err.message + '\nsetup_employee_hire.sql ve setup_employee_sgk.sql dosyalarını SQL Editor’da çalıştırın.');
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
        is_active: vehicleFormData.isActive !== false,
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
      alert('Araç işlem hatası: ' + (err.message || err) + '\nGerekirse setup_vehicles.sql dosyasını SQL Editor’da çalıştırın.');
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
      vehicleType: normalizeVehicleType(v.vehicle_type),
      ownershipType: v.ownership_type || 'Öz Mal',
      isActive: v.is_active !== false,
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

  const plateRentalRows = useMemo(() => {
    const term = plateRentalSearch.toLocaleLowerCase('tr-TR').trim();
    const amountOf = (r: any) => r.collection_kind === 'devlet' ? cleanNumber(r.government_fee) : cleanNumber(r.rent_amount);
    return (dbPlateRentals || [])
      .map((r: any) => {
        const days = daysUntilDate(r.renewal_date);
        let alert: 'overdue' | 'd15' | 'd30' | null = null;
        if (days !== null) {
          if (days <= 0) alert = 'overdue';
          else if (days <= 15) alert = 'd15';
          else if (days <= 30) alert = 'd30';
        }
        return { ...r, days, alert };
      })
      .filter((r: any) => {
        if (plateRentalTypeFilter !== 'all' && plateVehicleTypeOf(r) !== plateRentalTypeFilter) return false;
        if (!term) return true;
        return `${r.plate} ${r.owner_name} ${r.phone || ''} ${plateVehicleTypeOf(r)} ${r.notes || ''}`.toLocaleLowerCase('tr-TR').includes(term);
      })
      .sort((a: any, b: any) => {
        if (plateRentalSort === 'plate') return String(a.plate || '').localeCompare(String(b.plate || ''), 'tr');
        if (plateRentalSort === 'owner') return String(a.owner_name || '').localeCompare(String(b.owner_name || ''), 'tr');
        if (plateRentalSort === 'type') return plateVehicleTypeOf(a).localeCompare(plateVehicleTypeOf(b), 'tr');
        if (plateRentalSort === 'amount') return amountOf(a) - amountOf(b);
        const ar = a.alert ? 0 : 1;
        const br = b.alert ? 0 : 1;
        if (ar !== br) return ar - br;
        return String(a.renewal_date || '9999').localeCompare(String(b.renewal_date || '9999'));
      });
  }, [dbPlateRentals, plateRentalSearch, plateRentalSort, plateRentalTypeFilter]);

  // GİRİŞ EKRANI (AUTH)
  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <p className="text-white text-sm font-medium">Oturum kontrol ediliyor…</p>
      </div>
    );
  }

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
              <label className="block font-bold text-slate-700 mb-1">E-posta</label>
              <input
                type="email"
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                placeholder="ornek@tazeyol.com.tr"
                autoComplete="username"
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
                  autoComplete="current-password"
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

            <button
              type="submit"
              disabled={loginBusy}
              className="w-full py-3 bg-[#009fe3] hover:bg-[#0087c2] disabled:opacity-60 text-white font-bold rounded-xl transition shadow-md">
              {loginBusy ? 'Giriş yapılıyor…' : 'Giriş Yap'}
            </button>
          </form>
        </div>
      </div>
    );
  }

 const menuItems = [
    { id: 'overview', label: 'Genel Görünüm', icon: LayoutDashboard },
    { id: 'customers', label: 'Müşteri Kartları', badge: dbCustomers.length, icon: Contact },
    { id: 'sales_customers', label: 'Satış Faturaları', badge: salesDetailedList.length, icon: TrendingUp },
    { id: 'subcontractors', label: 'Alt Yüklenici Hakedişleri', badge: dbInvoices.filter(i => i.category === 'subcontractor_invoice').length, icon: Users },
    { id: 'sub_accounts', label: 'Alt Yüklenici Cari Kartları', badge: dbSubcontractors.length, icon: Building2 },
    { id: 'sub_ibans', label: 'Taşeron IBAN Yönetimi', badge: dbSubcontractors.length, icon: Wallet },
    { id: 'payments', label: 'Banka Ödeme Talimatı', icon: FileCheck2 },
    { id: 'employees', label: 'Personel & Bordro', badge: dbEmployees.length, icon: UserCheck },
    { id: 'credit_cards', label: 'Kredi Kartları', badge: dbCreditCards.length, icon: CreditCard },
    { id: 'fleet', label: 'Araç Filosu', badge: dbVehicles.length, icon: Truck },
    { id: 'profitability', label: 'Öz Mal Karlılık & Maliyet', badge: dbProfitability.length, icon: BarChart3 },
    { id: 'collections', label: 'Müşteri Tahsilatları', badge: dbInvoices.filter(i => i.category === 'customer_collection').length, icon: Coins },
    { id: 'general_expenses', label: 'Genel Giderler & Tedarik', icon: Receipt },
    { id: 'plate_rentals', label: 'Belge Plaka Kiraları', badge: dbPlateRentals.length, icon: Tag },
  ];
  const sidebarItems = [
    ...menuItems.filter((item) => item.id === 'overview'),
    ...menuItems
      .filter((item) => item.id !== 'overview' && item.id !== 'plate_rentals')
      .sort((a, b) => a.label.localeCompare(b.label, 'tr')),
    ...menuItems.filter((item) => item.id === 'plate_rentals'),
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
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className="border-l border-slate-200 pl-3 text-left hover:opacity-80 transition"
              title="Ana ekran"
            >
              <TazeyolBrand />
            </button>
            {activeTab !== 'overview' && (
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#009fe3]/10 hover:bg-[#009fe3]/20 text-[#009fe3] font-bold text-xs transition"
              >
                <LayoutDashboard className="w-4 h-4" /> Ana ekran
              </button>
            )}
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
              <button type="button" onClick={() => { setActiveTab('overview'); setIsSidebarOpen(false); }} className="text-left" title="Ana ekran">
                <TazeyolBrand />
              </button>
              <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="p-3 space-y-1 flex-1 overflow-y-auto text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block px-3 py-1">Tüm Modüller</span>
              {sidebarItems.map(item => {
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
                      {alertAnalysis.pendingDebts.reduce((s, i) => s + cleanNumber(i.alertAmount ?? i.total_amount), 0).toLocaleString('tr-TR')} ₺
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
                  <div className="mt-2 flex flex-col">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[11px] text-slate-500">Vadesi yaklaşan kartlar</span>
                      <span className="text-base font-bold text-purple-700">
                        {alertAnalysis.creditCardsAlerts.reduce((s, i) => s + cleanNumber(i.cleanStmtAmt || i.statement_amount || 0), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                      </span>
                    </div>
                    {alertAnalysis.creditCardsAlerts.some((i: any) => cleanNumber(i.min_payment_amount) > 0) && (
                      <div className="flex justify-between items-baseline mt-0.5">
                        <span className="text-[10px] text-slate-400">Toplam Asgari Ödeme:</span>
                        <span className="text-[11px] font-bold text-amber-600">
                          {alertAnalysis.creditCardsAlerts.reduce((s, i) => s + cleanNumber(i.min_payment_amount || 0), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

{/* FİNANSAL VERİ FİLTRESİ VE AÇILIR POP-UP TAKVİM */}
<div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative">
  <div className="flex items-center gap-2">
    <Calendar className="w-5 h-5 text-[#009fe3]" />
    <div>
      <h3 className="font-bold text-slate-900 text-sm">Finansal Veri Filtresi</h3>
      <span className="text-[11px] text-slate-400">Ciro, tahsilat ve dönem masrafı bu aralığa göre; kasa, alacak ve borçlar güncel bakiyedir.</span>
    </div>
  </div>

  {/* Tarih Seçim Butonu (Tıklayınca Pop-up Açılır) */}
  <div className="relative">
    <button
      onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
      className="flex items-center gap-3 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-semibold text-xs transition shadow-sm">
      <Calendar className="w-4 h-4 text-[#009fe3]" />
      <span>{filterStartDate} — {filterEndDate}</span>
      <span className="text-slate-400">▼</span>
    </button>

    {/* Açılır Pop-up Menü */}
    {isDateDropdownOpen && (
      <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl p-4 z-50 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="font-bold text-slate-800 text-xs">Tarih Aralığı Seçin</span>
          <button 
            onClick={() => setIsDateDropdownOpen(false)}
            className="text-slate-400 hover:text-slate-600 font-bold text-sm">
            ✕
          </button>
        </div>

        {/* Manuel Tarih Girişleri */}
        <div className="flex items-center gap-2">
          <input  
            type="date"  
            value={filterStartDate}
            onChange={e => setFilterStartDate(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none"
          />
          <span className="text-slate-400 font-bold">—</span>
          <input  
            type="date"  
            value={filterEndDate}
            onChange={e => setFilterEndDate(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none"
          />
        </div>

        {/* Hızlı Seçim Butonları (Alt Alta / Grid Düzen) */}
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <button  
            onClick={() => {
              const now = new Date();
              const year = now.getFullYear();
              const month = now.getMonth();
              const pad = (n: number) => (n < 10 ? '0' + n : String(n));
              setFilterStartDate(`${year}-${pad(month + 1)}-01`);
              const lastDay = new Date(year, month + 1, 0);
              setFilterEndDate(`${year}-${pad(month + 1)}-${pad(lastDay.getDate())}`);
              setIsDateDropdownOpen(false);
            }}
            className="px-3 py-2 bg-slate-50 hover:bg-[#009fe3] hover:text-white text-slate-700 rounded-xl font-semibold text-xs transition text-center">
            Bu Ay
          </button>

          <button  
            onClick={() => {
              const now = new Date();
              let year = now.getFullYear();
              let month = now.getMonth() - 1;
              if (month < 0) { month = 11; year -= 1; }
              const pad = (n: number) => (n < 10 ? '0' + n : String(n));
              setFilterStartDate(`${year}-${pad(month + 1)}-01`);
              const lastDay = new Date(year, month + 1, 0);
              setFilterEndDate(`${year}-${pad(month + 1)}-${pad(lastDay.getDate())}`);
              setIsDateDropdownOpen(false);
            }}
            className="px-3 py-2 bg-slate-50 hover:bg-[#009fe3] hover:text-white text-slate-700 rounded-xl font-semibold text-xs transition text-center">
            Geçen Ay
          </button>

          <button  
            onClick={() => {
              const end = new Date();
              const start = new Date();
              start.setDate(end.getDate() - 30);
              setFilterStartDate(start.toISOString().split('T')[0]);
              setFilterEndDate(end.toISOString().split('T')[0]);
              setIsDateDropdownOpen(false);
            }}
            className="px-3 py-2 bg-slate-50 hover:bg-[#009fe3] hover:text-white text-slate-700 rounded-xl font-semibold text-xs transition text-center">
            Son 30 Gün
          </button>

          <button  
            onClick={() => {
              const end = new Date();
              const start = new Date();
              start.setMonth(end.getMonth() - 3);
              setFilterStartDate(start.toISOString().split('T')[0]);
              setFilterEndDate(end.toISOString().split('T')[0]);
              setIsDateDropdownOpen(false);
            }}
            className="px-3 py-2 bg-slate-50 hover:bg-[#009fe3] hover:text-white text-slate-700 rounded-xl font-semibold text-xs transition text-center">
            Son 3 Ay
          </button>
        </div>
      </div>
    )}
  </div>
</div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <button type="button" onClick={() => setActiveTab('collections')} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-emerald-300 hover:shadow-md transition cursor-pointer">
                <span className="text-xs text-emerald-600 font-semibold tracking-wider uppercase flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5" /> Alınan Tahsilatlar
                </span>
                <div className="text-2xl font-bold text-emerald-600 mt-2">
                  +{totalCollectedCash.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-slate-400 mt-1 block">Müşteri tahsilatlarına git</span>
              </button>

              <button type="button" onClick={() => setActiveTab('customers')} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-blue-300 hover:shadow-md transition cursor-pointer">
                <span className="text-xs text-blue-600 font-semibold tracking-wider uppercase flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Bekleyen Müşteri Alacakları
                </span>
                <div className="text-2xl font-bold text-slate-900 mt-2">
                  {pendingReceivablesAllTime.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-slate-400 mt-1 block">
                  Ciro {totalPeriodSalesRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺ · müşteri kartları
                </span>
              </button>

              <button type="button" onClick={() => setActiveTab('subcontractors')} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-rose-300 hover:shadow-md transition cursor-pointer">
                <span className="text-xs text-rose-600 font-semibold tracking-wider uppercase flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Ödenecek Toplam Borçlar
                </span>
                <div className="text-2xl font-bold text-rose-600 mt-2">
                  {totalConsolidatedDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-xs text-slate-400 mt-1 block">
                  Taşeron hakedişlerine git
                </span>
              </button>

              <div className="bg-[#009fe3] text-white p-5 rounded-2xl shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCashLedgerFrom('2026-10-01');
                      setCashLedgerTo(new Date().toISOString().split('T')[0]);
                      setIsCashLedgerOpen(true);
                    }}
                    className="flex-1 text-left hover:opacity-90 transition"
                    title="Kasa hareketleri"
                  >
                    <span className="text-xs text-blue-100 font-semibold tracking-wider uppercase flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5" /> Güncel Kasa / Banka
                    </span>
                    <div className="text-2xl font-bold mt-2">
                      {currentRealCash.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </div>
                    <span className="text-xs text-blue-100 mt-1 block">Tıklayın: tarih seçip hareketleri görün</span>
                  </button>
                  {isAdmin && (
                    <div className="flex gap-1 shrink-0">
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        const raw = window.prompt('Güncel kasa / banka — fiili tutar (₺)', String(cashOpening || 1550000));
                        if (raw === null) return;
                        const next = cleanNumber(raw);
                        const asOf = new Date().toISOString().split('T')[0];
                        try {
                          await saveAppSetting('cash_opening', String(next));
                          await saveAppSetting('cash_opening_as_of', asOf);
                          setCashOpening(next);
                          setCashOpeningAsOf(asOf);
                        } catch (err: any) {
                          alert('Kasa kaydedilemedi. setup_cash.sql dosyasını SQL Editor’da bir kez Run deyin.\n' + (err.message || ''));
                        }
                      }}
                      className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-[10px] font-bold transition">
                      Açılış
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsCashDepositModalOpen(true); }}
                      className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-[10px] font-bold transition flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Para Ekle
                    </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <button type="button" onClick={() => setActiveTab('general_expenses')} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-rose-300 hover:shadow-md transition cursor-pointer">
                <span className="text-xs font-semibold text-rose-700 tracking-wider uppercase flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> Devlet Ödemeleri
                </span>
                <div className="text-xl font-bold text-slate-900 mt-1.5">
                  {totalGovernmentPaymentsDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Giderler menüsüne git</span>
              </button>

              <button type="button" onClick={() => setActiveTab('general_expenses')} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-amber-300 hover:shadow-md transition cursor-pointer">
                <span className="text-xs font-semibold text-amber-700 tracking-wider uppercase flex items-center gap-1">
                  <Receipt className="w-3.5 h-3.5" /> Temel Diğer Faturalar
                </span>
                <div className="text-xl font-bold text-slate-900 mt-1.5">
                  {totalGeneralCompanyExpensesDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Açık tedarik borçları</span>
              </button>

              <button type="button" onClick={() => setActiveTab('employees')} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-indigo-300 hover:shadow-md transition cursor-pointer">
                <span className="text-xs font-semibold text-indigo-700 tracking-wider uppercase flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" /> Personel Gelecek Ödemesi
                </span>
                <div className="text-xl font-bold text-slate-900 mt-1.5">
                  {totalEmployeeFutureDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Personel & bordroya git</span>
              </button>

              <button type="button" onClick={() => setActiveTab('general_expenses')} className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm bg-emerald-50/20 text-left hover:border-emerald-400 hover:shadow-md transition cursor-pointer">
                <span className="text-xs font-semibold text-emerald-800 tracking-wider flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5" /> DÖNEM İÇİ FİİLİ MASRAF
                </span>
                <div className="text-xl font-bold text-emerald-800 mt-1.5">
                  {totalPeriodPaidExpenses.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <span className="text-[11px] text-emerald-600 mt-1 block">Gider dökümüne git</span>
              </button>
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
                  {[...allDecoratedBankLines]
                    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
                    .filter(l => l.netAmount > 0)
                    .slice(0, 5)
                    .map((line) => (
                      <div key={line.lineId} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs shadow-xs">
                        <div>
                          <span className="font-bold text-slate-900 block truncate max-w-[200px]" title={line.invoiceNo}>
                            {line.invoiceNo}
                          </span>
                          <span className={`text-[11px] font-semibold mt-0.5 block ${line.dueDate && new Date(sanitizeDate(line.dueDate)) < new Date() ? 'text-rose-600' : 'text-slate-500'}`}>
                            {line.termLabel}: {formatDateTR(line.dueDate)}
                          </span>
                        </div>
                        <span className="font-bold text-rose-600 text-sm">
                          {line.netAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </span>
                      </div>
                    ))}
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
        
        {activeTab === 'customers' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Müşteri Kartları</h3>
                <p className="text-xs text-slate-500 mt-0.5">Artı = müşteriden alacak. Eksi = fazla ödeme / avans. Gelen para faturaya bağlanmaz; net = tüm faturalar − tüm alınan paralar.</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => openCustomerModal()}
                  className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Yeni Müşteri
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="Unvan, VKN veya telefon ara..."
              value={customerSearchTerm}
              onChange={e => setCustomerSearchTerm(e.target.value)}
              className="w-full sm:w-80 px-3.5 py-2 border border-slate-200 rounded-xl text-xs"
            />
            {dbCustomers.length === 0 ? (
              <p className="text-sm text-slate-500 bg-amber-50 border border-amber-100 rounded-xl p-4">
                Henüz müşteri yok. Önce Supabase SQL Editor’da <b>setup_customers.sql</b> dosyasını çalıştırın, sonra buradan kart ekleyin.
              </p>
            ) : (
              <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <span className="text-[11px] text-amber-800 font-semibold block">Toplam açık fatura</span>
                  <span className="text-lg font-bold text-slate-900">{customerBalances.reduce((s, r) => s + r.openSales, 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  <span className="text-[11px] text-emerald-800 font-semibold block">Toplam cari avans</span>
                  <span className="text-lg font-bold text-emerald-800">{customerBalances.reduce((s, r) => s + r.advances, 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[11px] text-slate-600 font-semibold block">Net bakiye (faturalar − alınan paralar)</span>
                  <span className={`text-lg font-bold ${customerBalances.reduce((s, r) => s + r.net, 0) >= 0 ? 'text-amber-800' : 'text-rose-700'}`}>
                    {customerBalances.reduce((s, r) => s + r.net, 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-100">
                      <th className="py-2 pr-3">Unvan</th>
                      <th className="py-2 pr-3 text-right">Açık fatura</th>
                      <th className="py-2 pr-3 text-right">Tahsilat</th>
                      <th className="py-2 pr-3 text-right">Cari avans</th>
                      <th className="py-2 pr-3 text-right">Net bakiye</th>
                      <th className="py-2 pr-3">Durum</th>
                      <th className="py-2 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerBalances
                      .filter(row => {
                        const q = customerSearchTerm.trim().toLocaleLowerCase('tr-TR');
                        if (!q) return true;
                        const c = row.customer;
                        return [c.name, c.tax_id, c.phone, c.email].join(' ').toLocaleLowerCase('tr-TR').includes(q);
                      })
                      .map(row => {
                        const c = row.customer;
                        const durum = row.net > 0.5 ? 'Alacak' : row.net < -0.5 ? 'Borç / avans fazla' : 'Kapalı';
                        return (
                        <tr key={c.id} className="border-b border-slate-50">
                          <td className="py-2.5 pr-3">
                            <div className="font-semibold text-slate-800">{c.name}</div>
                            <div className="text-[10px] text-slate-400">{c.tax_id || 'VKN yok'}{c.phone ? ` · ${c.phone}` : ''}</div>
                          </td>
                          <td className="py-2.5 pr-3 text-right font-semibold">{row.openSales.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                          <td className="py-2.5 pr-3 text-right text-emerald-700">{row.collections.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                          <td className="py-2.5 pr-3 text-right text-blue-700">{row.advances.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                          <td className={`py-2.5 pr-3 text-right font-black ${row.net > 0.5 ? 'text-amber-800' : row.net < -0.5 ? 'text-rose-700' : 'text-slate-500'}`}>
                            {row.net.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${durum === 'Alacak' ? 'bg-amber-100 text-amber-800' : durum === 'Kapalı' ? 'bg-slate-100 text-slate-600' : 'bg-rose-100 text-rose-700'}`}>
                              {durum}
                            </span>
                          </td>
                          <td className="py-2.5 text-center space-x-1 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setSelectedCariCustomer(c)}
                                className="text-[10px] font-bold text-slate-800 hover:underline"
                              >
                                Cari döküm
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSalesSearchQuery(c.name);
                                  setActiveTab('sales_customers');
                                }}
                                className="text-[10px] font-bold text-[#009fe3] hover:underline"
                              >
                                Faturalar
                              </button>
                              {isAdmin && (
                                <>
                              <button type="button" onClick={() => openCustomerModal(c)} className="p-1.5 text-slate-500 hover:text-blue-600"><Edit2 className="w-4 h-4 inline" /></button>
                              <button type="button" onClick={() => handleDeleteCustomer(c)} className="p-1.5 text-slate-500 hover:text-rose-600"><Trash2 className="w-4 h-4 inline" /></button>
                                </>
                              )}
                            </td>
                        </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'sales_customers' && (
        <div className="space-y-4">
          
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-white/10">
              <div>
                <span className="bg-blue-500/30 text-blue-200 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Cari Havuz</span>
                <h4 className="text-lg font-black tracking-tight mt-0.5">{dbCustomers.length} kayıtlı müşteri</h4>
                <p className="text-blue-100 text-[11px] mt-1">Excel yüklemeden önce Müşteri Kartları menüsünden unvanları tanıtın.</p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setNewReceiptFormData({
                      customerName: dbCustomers[0]?.name || '',
                      receiptNo: `AVANS-${new Date().getMonth() + 1}`,
                      amount: '',
                      targetAccount: 'bank',
                      date: new Date().toISOString().split('T')[0],
                      relatedInvoiceId: null
                    });
                    setIsNewReceiptModalOpen(true);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md transition">
                  <Plus className="w-4 h-4" /> Cari ödeme / avans (faturasız)
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
                <span className="text-blue-200 text-[11px] block">Toplam Açık Fatura</span>
                <span className="text-lg font-bold block mt-0.5">{totalOpenSalesAllTime.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
              </div>
              <div className="bg-emerald-500/20 backdrop-blur-xs p-3 rounded-xl border border-emerald-400/20">
                <span className="text-emerald-200 text-[11px] block">Alınan Faturasız Cari Avans</span>
                <span className="text-lg font-bold text-emerald-300 block mt-0.5">+{customerUnallocatedAdvances.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
              </div>
              <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
                <span className="text-amber-200 text-[11px] block">Kalan Net Alacak (Mahsup Sonrası)</span>
                <span className="text-lg font-black text-amber-300 block mt-0.5">{pendingReceivablesAllTime.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
              </div>
            </div>
          </div>

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
          const salesInvoices = dbInvoices.filter((i: any) => i.direction === 'outgoing' || i.category === 'freight_sales');
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
                    Açık fatura tutarı (mutabakat bayrağı)
                  </span>
                  <span className="text-2xl font-black text-slate-900 tracking-tight">
                    {totalUncollectedAmt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Cari net alacak: {pendingReceivablesAllTime.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
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
                          <div className="flex flex-col items-center gap-1">
                            <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-full">
                              Mutabakat kapalı
                            </span>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleSetSalePaidStatus(sale, 'unpaid')}
                                className="text-[10px] font-bold text-slate-500 hover:text-slate-800 underline"
                              >
                                Açığa al
                              </button>
                            )}
                          </div>
                        ) : (
                          isAdmin && (
                            <div className="flex flex-col items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenReceiptFromSale(sale)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition"
                              >
                                <Coins className="w-3.5 h-3.5" /> Cari ödeme
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetSalePaidStatus(sale, 'paid')}
                                className="text-[10px] font-bold text-slate-500 hover:text-slate-800 underline"
                              >
                                Ödendi işaretle
                              </button>
                            </div>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )}

        {/* 3. ALT YÜKLENİCİ HAKEDİŞLERİ */}
        {activeTab === 'subcontractors' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Alt Yüklenici Hakedişleri</h3>
                <p className="text-xs text-slate-500 mt-0.5">Cari = fatura − avans (tek kayıt) − fiili ödeme. Avans herkese 1 nci, artanı 2 nci, kalanı sonraki aya. Banka Excel’i ödeme değildir; hakedişte Tamamını Öde fiili tekil ödemedir.</p>
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
                    <th className="py-3 px-3">1 nci ödeme</th>
                    <th className="py-3 px-3">2 nci ödeme</th>
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
                    const line1 = decoratedBankByLineId.get(`${inv.id}-term1`);
                    const line2 = decoratedBankByLineId.get(`${inv.id}-term2`);
                    const dynamicT1 = isT1Paid ? 0 : (line1 ? line1.netAmount : t1);
                    const deductedAdvAmt = line1?.advanceCut || 0;
                    const dynamicT2 = isT2Paid ? 0 : (line2 ? line2.netAmount : t2);
                    const deductedAdvForT2 = line2?.advanceCut || 0;
               
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
                          <span className="text-[10px] text-slate-400">{isT1Paid ? 'Ödendi' : formatDateTR(contractorTermPayDate(sanitizeDate(inv.issue_date), 'term1', inv.term1_due_date))}</span>
                        </td>
                      <td className="py-3 px-3">
            <span className={`font-semibold block ${isT2Paid ? 'text-emerald-600 line-through' : 'text-blue-700'}`}>
              {dynamicT2.toLocaleString('tr-TR')} ₺
            </span>
            {deductedAdvForT2 > 0 && (
              <span className="block text-[10px] text-amber-600 font-normal">
                (-{deductedAdvForT2.toLocaleString('tr-TR')} ₺ Avans Mahsubu)
              </span>
            )}
            <span className="text-[10px] text-slate-400">{isT2Paid ? 'Ödendi' : formatDateTR(contractorTermPayDate(sanitizeDate(inv.issue_date), 'term2', inv.term2_due_date))}</span>
          </td>
                        {isAdmin && (
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {!isT1Paid && dynamicT1 > 0.009 && (
                                <button
                                  onClick={() => handlePaySubcontractorTerm(inv, 'term1')}
                                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-1 rounded text-[10px] transition">
                                  1 nci ödemeyi yap
                                </button>
                              )}
                              {!isT1Paid && dynamicT1 <= 0.009 && (
                                <button
                                  onClick={() => handlePaySubcontractorTerm(inv, 'term1')}
                                  className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold px-2 py-1 rounded text-[10px] transition">
                                  1 nci ödemeyi avansla kapat
                                </button>
                              )}
                              {!isT2Paid && dynamicT2 > 0.009 && (
                                <button
                                  onClick={() => handlePaySubcontractorTerm(inv, 'term2')}
                                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-1 rounded text-[10px] transition">
                                  2 nci ödemeyi yap
                                </button>
                              )}
                              {!isT2Paid && dynamicT2 <= 0.009 && (
                                <button
                                  onClick={() => handlePaySubcontractorTerm(inv, 'term2')}
                                  className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold px-2 py-1 rounded text-[10px] transition">
                                  2 nci ödemeyi avansla kapat
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
        
{/* ALT YÜKLENİCİ CARİ KARTLARI */}
        {activeTab === 'sub_accounts' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Alt Yüklenici Cari Kartları ve Avans Yönetimi</h3>
                <p className="text-xs text-slate-500 mt-0.5">Cari bakiye tüm avansı düşer (kalan borç). Banka talimatı ise bu ay ödenecek vadeyi gösterir; taksitli avansta yalnızca bu ayın taksiti düşülür.</p>
              </div>
            </div>

            {/* ARAMA VE FİLTRE ÇUBUĞU */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mb-2 mt-2">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  placeholder="Taşeron adı veya vergi no ile filtrele..."
                  value={ledgerSearchTerm}
                  onChange={(e) => setLedgerSearchTerm(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th 
                      className="py-3 px-3 cursor-pointer select-none hover:text-blue-600 transition-colors"
                      onClick={() => {
                        if (ledgerSortField === 'name') setLedgerSortOrder(ledgerSortOrder === 'asc' ? 'desc' : 'asc');
                        else { setLedgerSortField('name'); setLedgerSortOrder('asc'); }
                      }}>
                      Firma / Taşeron Adı {ledgerSortField === 'name' ? (ledgerSortOrder === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th 
                      className="py-3 px-3 cursor-pointer select-none hover:text-blue-600 transition-colors"
                      onClick={() => {
                        if (ledgerSortField === 'tax') setLedgerSortOrder(ledgerSortOrder === 'asc' ? 'desc' : 'asc');
                        else { setLedgerSortField('tax'); setLedgerSortOrder('asc'); }
                      }}>
                      Vergi Numarası {ledgerSortField === 'tax' ? (ledgerSortOrder === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="py-3 px-3">Kayıtlı IBAN</th>
                    <th className="py-3 px-3 text-right">Toplam Fatura</th>
                    <th className="py-3 px-3 text-right">Yapılan Ödeme / Avans</th>
                    <th 
                      className="py-3 px-3 text-right cursor-pointer select-none hover:text-blue-600 transition-colors"
                      onClick={() => {
                        if (ledgerSortField === 'balance') setLedgerSortOrder(ledgerSortOrder === 'asc' ? 'desc' : 'asc');
                        else { setLedgerSortField('balance'); setLedgerSortOrder('desc'); }
                      }}>
                      Güncel Bakiye {ledgerSortField === 'balance' ? (ledgerSortOrder === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dbSubcontractors
                    .map((sub: any) => {
                      const ledger = buildSubcontractorLedger(sub);
                      const totalInvoice = ledger.reduce((s, l) => s + l.debit, 0);
                      const totalOut = ledger.reduce((s, l) => s + l.credit, 0);
                      const balance = ledger.length ? ledger[ledger.length - 1].balance : 0;
                      return { ...sub, computedTax: sub.tax_no || sub.tax_number || '', totalInvoice, totalOut, balance };
                    })
                    .filter((item: any) => {
                      if (!ledgerSearchTerm) return true;
                      const term = ledgerSearchTerm.toLowerCase();
                      return (item.name || '').toLowerCase().includes(term) || (item.computedTax || '').toLowerCase().includes(term);
                    })
                    .sort((a: any, b: any) => {
                      let comp = 0;
                      if (ledgerSortField === 'name') comp = (a.name || '').localeCompare(b.name || '', 'tr-TR', { sensitivity: 'base' });
                      else if (ledgerSortField === 'tax') {
                         const taxA = a.tax_no || a.computedTax || '';
                         const taxB = b.tax_no || b.computedTax || '';
                         comp = taxA.localeCompare(taxB, 'tr-TR');
                        }
                      else if (ledgerSortField === 'balance') comp = a.balance - b.balance;
                      return ledgerSortOrder === 'asc' ? comp : -comp;
                    })
                    .map((sub: any) => (
                      <tr key={sub.id} onClick={() => setSelectedSubcontractorForDetail(sub)} className="hover:bg-blue-50/50 cursor-pointer transition">
                        <td className="py-3 px-3 font-bold text-slate-900 text-sm">{sub.company_name || sub.name}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{sub.tax_no || sub.computedTax || '-'}</td>
                        <td className="py-3 px-3 font-mono text-blue-700">{sub.iban || 'IBAN Eksik'}</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">{sub.totalInvoice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                        <td className="py-3 px-3 text-right font-bold text-amber-600">{sub.totalOut.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                        <td className="py-3 px-3 text-right font-black text-emerald-600 text-sm">{sub.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                      </tr>
                    ))}
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
                <p className="text-xs text-slate-500 mt-0.5">Excel indirme = talimat, henüz ödenmedi. Banka başarılı raporu gelince partiyi “Ödendi işle” deyin; cari ve kasa o zaman yazılır. Avans herkese önce 1 nci, artanı 2 nci, kalanı sonraki aya geçer. Bir kişiyi işaretlemek kalan tüm açık tutarını alır; 1 nci / 2 nci filtreleriyle dalga seçilir.</p>
              </div>

              {isAdmin ? (
                <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition">
                  <FileUp className="w-4 h-4" /> Ödenen banka Excelini yükle
                  <input type="file" accept=".xlsx,.xls" onChange={handleImportPaidBankExcel} className="hidden" />
                </label>
                <button 
                  onClick={handleDownloadBankExcel}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition">
                  <Download className="w-4 h-4" /> Seçilenleri Banka Exceli Olarak İndir
                </button>
                </div>
              ) : (
                <span className="text-xs text-rose-600 font-bold">Raporör rolünde Excel indirme yetkisi kapalıdır.</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {([
                ['all', 'Tümü (kalan)'],
                ['term1', '1 nci ödeme'],
                ['term2', '2 nci ödeme']
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => { setBankWaveFilter(id); setBankSelectedLines({}); }}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${bankWaveFilter === id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {(dbPaymentBatches || []).filter((b: any) => String(b.status) === 'sent').length > 0 && (
              <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-amber-900">Bankaya giden, henüz ödendi işlenmeyen talimatlar</p>
                {(dbPaymentBatches || [])
                  .filter((b: any) => String(b.status) === 'sent')
                  .sort((a: any, b: any) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
                  .map((b: any) => (
                    <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 bg-white border border-amber-100 rounded-lg px-3 py-2">
                      <div>
                        <div className="text-sm font-bold text-slate-800">{b.title || 'Banka talimatı'}</div>
                        <div className="text-[11px] text-slate-500">
                          {formatDateTR(b.pay_date)} · {b.contractor_count || 0} kişi · {cleanNumber(b.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleConfirmPaymentBatch(b)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                          >
                            Ödendi işle
                          </button>
                          <button
                            onClick={() => handleCancelPaymentBatch(b)}
                            className="bg-white border border-slate-200 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-slate-50"
                          >
                            İptal
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-blue-900 block">Bankadan Çıkacak Seçili Toplam Tutar:</span>
                <span className="text-2xl font-black text-blue-700">
                  {bankLiveSelectionSummary.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </span>
                {displayBankTermLines.some(l => l.advanceCut > 0) && (
                  <span className="text-[11px] font-semibold text-amber-700 mt-1 block">
                    Listede avans mahsubu: −{displayBankTermLines.reduce((s, l) => s + (l.advanceCut || 0), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </span>
                )}
              </div>
              <span className="bg-blue-200 text-blue-900 font-bold px-3 py-1 rounded-full text-xs">
                {bankLiveSelectionSummary.count} alt yüklenici
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
                        {bankContractorRows.length > 0 && bankContractorRows.every(r => r.lineIds.every(id => bankSelectedLines[id])) ? 'Bırak' : 'Tümü'}
                      </button>
                    </th>
                    <th
                      className="py-3 px-3 cursor-pointer select-none hover:text-blue-600 transition-colors"
                      onClick={() => {
                        if (bankSortField === 'contractorName') setBankSortOrder(bankSortOrder === 'asc' ? 'desc' : 'asc');
                        else { setBankSortField('contractorName'); setBankSortOrder('asc'); }
                      }}
                    >
                      Alt yüklenici {bankSortField === 'contractorName' ? (bankSortOrder === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="py-3 px-3">Faturalar</th>
                    <th
                      className="py-3 px-3 cursor-pointer select-none hover:text-blue-600 transition-colors"
                      onClick={() => {
                        if (bankSortField === 'dueDate') setBankSortOrder(bankSortOrder === 'asc' ? 'desc' : 'asc');
                        else { setBankSortField('dueDate'); setBankSortOrder('asc'); }
                      }}
                    >
                      En yakın vade {bankSortField === 'dueDate' ? (bankSortOrder === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th
                      className="py-3 px-3 cursor-pointer select-none hover:text-blue-600 transition-colors"
                      onClick={() => {
                        if (bankSortField === 'iban') setBankSortOrder(bankSortOrder === 'asc' ? 'desc' : 'asc');
                        else { setBankSortField('iban'); setBankSortOrder('asc'); }
                      }}
                    >
                      IBAN {bankSortField === 'iban' ? (bankSortOrder === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th
                      className="py-3 px-3 text-right cursor-pointer select-none hover:text-blue-600 transition-colors"
                      onClick={() => {
                        if (bankSortField === 'amount') setBankSortOrder(bankSortOrder === 'asc' ? 'desc' : 'asc');
                        else { setBankSortField('amount'); setBankSortOrder('desc'); }
                      }}
                    >
                      Tutar {bankSortField === 'amount' ? (bankSortOrder === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bankContractorRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">Bankaya gidecek açık tutar yok (avansla kapananlar listelenmez).</td>
                    </tr>
                  )}
                  {bankContractorRows.map(row => {
                    const isChecked = row.lineIds.length > 0 && row.lineIds.every(id => bankSelectedLines[id]);
                    const overdue = row.dueDate && new Date(row.dueDate) < new Date(new Date().toISOString().split('T')[0]);
                    return (
                      <tr key={row.groupKey} className={`hover:bg-slate-50 transition ${isChecked ? 'bg-blue-50/60' : ''}`}>
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleBankContractor(row.lineIds)}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">{row.contractorName}</td>
                        <td className="py-3 px-3 text-slate-600">
                          {row.invoiceNos.length} fatura
                          <span className="block text-[10px] text-slate-400 truncate max-w-[280px]" title={row.invoiceNos.join(' · ')}>
                            {row.invoiceNos.slice(0, 2).join(' · ')}{row.invoiceNos.length > 2 ? '…' : ''}
                          </span>
                        </td>
                        <td className={`py-3 px-3 whitespace-nowrap ${overdue ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                          {formatDateTR(row.dueDate)}
                        </td>
                        <td className={`py-3 px-3 font-mono ${row.iban === 'IBAN Eksik' ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                          {row.iban}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-700">
                          {row.netAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                          {row.advanceCut > 0 && (
                            <span className="block text-[10px] font-semibold text-amber-700">
                              Avans −{row.advanceCut.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                            </span>
                          )}
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
<div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        {/* ÜST BAŞLIK VE BUTONLAR */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
          <div>
            <h3 className="font-bold text-lg text-slate-900">
              Personel & Maaş Yönetimi ({empSummary.count} Personel)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Sözleşmeli maaş ve kart primi kapanmış ayda caridedir (Kasım maaşı 1 Aralık’ta). Elle girilen sefer/prim hemen net alacağa yazılır; ödeme yoksa tutar durur. Toplu maaş yalnızca girdiğiniz kadar düşer.
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenBulkSalaryModal}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition"
              >
                <CheckSquare className="w-4 h-4" /> Toplu Maaş Öde (Seçimli)
              </button>
              <button
                onClick={() => {
                  setEditingEmployeeId(null);
                  setEmployeeFormData({ fullName: '', roleTitle: 'Kamyon Şoförü / Dağıtım', baseSalary: '', employerSgk: '', phone: '', iban: '', monthlyBonus: '', bonusDescription: '', monthlyAdvance: '', advanceDescription: '', hireDate: '' });
                  setIsEmployeeModalOpen(true);
                }}
                className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition"
              >
                <Plus className="w-4 h-4" /> Yeni Personel Ekle
              </button>
            </div>
          )}
        </div>

        {/* FİNANSAL ÖZET SAYAÇLARI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Toplam Sözleşmeli Maaş</span>
            <span className="text-base font-extrabold text-slate-800 mt-0.5 block">
              {empSummary.totalBase.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Toplam Hak Edilen Prim</span>
            <span className="text-base font-extrabold text-emerald-800 mt-0.5 block">
              +{empSummary.totalBonus.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </span>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Mahsup Edilen Avanslar</span>
            <span className="text-base font-extrabold text-amber-800 mt-0.5 block">
              -{empSummary.totalAdv.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </span>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">Bu Ay Ödenecek Net Tutar</span>
            <span className="text-base font-black text-blue-900 mt-0.5 block">
              {empSummary.totalNet.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </span>
          </div>
        </div>

        {/* ARAMA VE SIRALAMA ÇUBUĞU */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Personel adı, görev veya telefon ile filtrele..."
              value={empSearchTerm}
              onChange={(e) => setEmpSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <span className="text-xs text-slate-500 font-medium mr-1">Sırala:</span>
            <button
              type="button"
              onClick={() => {
                if (empSortField === 'name') setEmpSortOrder(empSortOrder === 'asc' ? 'desc' : 'asc');
                else { setEmpSortField('name'); setEmpSortOrder('asc'); }
              }}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${
                empSortField === 'name' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Ad Soyad {empSortField === 'name' && (empSortOrder === 'asc' ? '↑' : '↓')}
            </button>

            <button
              type="button"
              onClick={() => {
                if (empSortField === 'salary') setEmpSortOrder(empSortOrder === 'asc' ? 'desc' : 'asc');
                else { setEmpSortField('salary'); setEmpSortOrder('desc'); }
              }}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${
                empSortField === 'salary' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Sabit Maaş {empSortField === 'salary' && (empSortOrder === 'asc' ? '↑' : '↓')}
            </button>

            <button
              type="button"
              onClick={() => {
                if (empSortField === 'netPayable') setEmpSortOrder(empSortOrder === 'asc' ? 'desc' : 'asc');
                else { setEmpSortField('netPayable'); setEmpSortOrder('desc'); }
              }}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${
                empSortField === 'netPayable' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Net Alacak {empSortField === 'netPayable' && (empSortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>
        </div>

        {/* TABLO */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
           <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200 select-none">
              <tr>
                <th 
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition group"
                  onClick={() => {
                    if (empSortField === 'name') setEmpSortOrder(empSortOrder === 'asc' ? 'desc' : 'asc');
                    else { setEmpSortField('name'); setEmpSortOrder('asc'); }
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Personel Bilgisi</span>
                    <span className="text-xs text-blue-600">{empSortField === 'name' ? (empSortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th 
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100 transition group"
                  onClick={() => {
                    if (empSortField === 'salary') setEmpSortOrder(empSortOrder === 'asc' ? 'desc' : 'asc');
                    else { setEmpSortField('salary'); setEmpSortOrder('desc'); }
                  }}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Sabit Maaş</span>
                    <span className="text-xs text-blue-600">{empSortField === 'salary' ? (empSortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th className="py-3 px-3 text-right">SGK işveren</th>
                <th className="py-3 px-3 text-right">Prim / Ek</th>
                <th className="py-3 px-3 text-right">Bu Ay Avans Kesintisi</th>
                <th 
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100 transition group"
                  onClick={() => {
                    if (empSortField === 'netPayable') setEmpSortOrder(empSortOrder === 'asc' ? 'desc' : 'asc');
                    else { setEmpSortField('netPayable'); setEmpSortOrder('desc'); }
                  }}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Net Ödenecek / Durum</span>
                    <span className="text-xs text-blue-600">{empSortField === 'netPayable' ? (empSortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th className="py-3 px-3 text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 text-sm">{emp.full_name}</span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {emp.role_title} • {formatPhone(emp.phone || '') || 'Tel Yok'}
                        {emp.hire_date
                          ? ` • Giriş: ${formatDateTR(emp.hire_date)}`
                          : emp.created_at
                            ? ` • Kayıt: ${formatDateTR(emp.created_at)}`
                            : ''}
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-3 text-right font-medium text-slate-700">
                    {emp.baseSalaryNum.toLocaleString('tr-TR')} ₺
                  </td>

                  <td className="py-3 px-3 text-right font-medium text-slate-600">
                    {cleanNumber(emp.employer_sgk) > 0
                      ? `${cleanNumber(emp.employer_sgk).toLocaleString('tr-TR')} ₺`
                      : <span className="text-slate-400">-</span>}
                  </td>

                  <td className="py-3 px-3 text-right">
                    {emp.bonusNum > 0 ? (
                      <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        +{emp.bonusNum.toLocaleString('tr-TR')} ₺
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-right">
                    {emp.advanceDeduction > 0 ? (
                      <span className="inline-flex items-center text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        -{emp.advanceDeduction.toLocaleString('tr-TR')} ₺
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-extrabold text-sm text-emerald-700">
                        {emp.netPayable.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </span>
                      {emp.carriedOverDebt > 0 && (
                        <span className="mt-0.5 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                          Devreden Borç: -{emp.carriedOverDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-3 text-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => openPayrollReport(emp)}
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition"
                        title="Hakediş raporu (PDF / Excel)"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <>
                      <button
                        onClick={() => {
                          setEditingEmployeeId(emp.id);
                    setEmployeeFormData({
                      fullName: emp.full_name || '',
                      roleTitle: emp.role_title || 'Kamyon Şoförü / Dağıtım',
                      baseSalary: String(emp.base_salary || ''),
                      employerSgk: emp.employer_sgk !== undefined && emp.employer_sgk !== null ? String(emp.employer_sgk) : '',
                      hireDate: sanitizeDate(emp.hire_date),
                      phone: formatPhone(emp.phone || ''),
                      iban: emp.iban || '',
                      monthlyBonus: String(emp.monthly_bonus || ''),
                      bonusDescription: emp.bonus_description || '',
                     advanceTotal: emp.advance_total !== undefined && emp.advance_total !== null ? String(emp.advance_total) : (emp.monthly_advance ? String(emp.monthly_advance) : ''),
                      advanceInstallments: String(emp.advance_installments || '1'),
                    monthlyAdvance: String(emp.monthly_advance || ''),
                   advanceDescription: emp.advance_description || ''
                    });
                          setIsEmployeeModalOpen(true);
                        }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                        title="Düzenle / Prim Gir"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (window.confirm(`${emp.full_name} personelini silmek istediğinize emin misiniz?`)) {
                            await supabase.from('employees').delete().eq('id', emp.id);
                            loadPortalData();
                          }
                        }}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition"
                        title="Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                        </>
                      )}
                    </td>
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
                <h3 className="font-bold text-lg text-slate-900">Kredi Kartları</h3>
                <p className="text-xs text-slate-500 mt-0.5">Gider kartla kapanırsa kasa düşmez. Kasa, kart ekstresi ödenince çıkar. Şahsi kartta şirket payını siz yazarsınız.</p>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => {
                    setEditingCreditCardId(null);
                    setCreditCardFormData({ cardName: '', bankName: '', lastFourDigits: '', statementAmount: '', minPaymentAmount: '', dueDate: '', cardKind: 'company' });
                    setIsCreditCardModalOpen(true);
                  }}
                  className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition">
                  <Plus className="w-4 h-4" /> Yeni Kredi Kartı Ekle
                </button>
              )}
            </div>

            {(() => {
              const today = new Date().toISOString().split('T')[0];
              const dueDiff = (c: any) => {
                const due = sanitizeDate(c.due_date);
                if (!due) return 999;
                return Math.ceil((new Date(due).getTime() - new Date(today).getTime()) / 86400000);
              };
              const totalStmt = dbCreditCards.reduce((s, c) => s + cleanNumber(c.statement_amount), 0);
              const overdue = dbCreditCards.filter(c => dueDiff(c) < 0 && cleanNumber(c.statement_amount) > 0);
              const week = dbCreditCards.filter(c => {
                const d = dueDiff(c);
                return cleanNumber(c.statement_amount) > 0 && d >= 0 && d <= 7;
              });
              const bankAccent = (name: string) => {
                const n = (name || '').toLocaleLowerCase('tr-TR');
                if (n.includes('garanti')) return { bar: 'bg-[#00a651]', chip: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
                if (n.includes('iş bank') || n.includes('isbank') || n.includes('işbank')) return { bar: 'bg-[#003d82]', chip: 'bg-blue-50 text-blue-800 border-blue-200' };
                if (n.includes('yapı') || n.includes('yapi kredi') || n.includes('yapikredi')) return { bar: 'bg-[#7b1fa2]', chip: 'bg-purple-50 text-purple-800 border-purple-200' };
                if (n.includes('akbank')) return { bar: 'bg-[#e31e24]', chip: 'bg-red-50 text-red-700 border-red-200' };
                if (n.includes('ziraat')) return { bar: 'bg-[#e30613]', chip: 'bg-rose-50 text-rose-800 border-rose-200' };
                if (n.includes('halk')) return { bar: 'bg-[#1b4f9c]', chip: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
                if (n.includes('vakıf') || n.includes('vakif')) return { bar: 'bg-[#f9b000]', chip: 'bg-amber-50 text-amber-900 border-amber-200' };
                if (n.includes('qnb') || n.includes('finans')) return { bar: 'bg-[#6c1d5f]', chip: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200' };
                if (n.includes('deniz')) return { bar: 'bg-[#00a0df]', chip: 'bg-sky-50 text-sky-800 border-sky-200' };
                if (n.includes('ing') || n.includes('enpara')) return { bar: 'bg-[#ff6200]', chip: 'bg-orange-50 text-orange-800 border-orange-200' };
                if (n.includes('teb')) return { bar: 'bg-[#6d2c91]', chip: 'bg-violet-50 text-violet-800 border-violet-200' };
                return { bar: 'bg-slate-400', chip: 'bg-slate-100 text-slate-700 border-slate-200' };
              };
              const toggleSort = (field: typeof cardSortField) => {
                if (cardSortField === field) setCardSortOrder(cardSortOrder === 'asc' ? 'desc' : 'asc');
                else { setCardSortField(field); setCardSortOrder(field === 'amount' ? 'desc' : 'asc'); }
              };
              const rows = [...dbCreditCards]
                .filter(c => {
                  const amt = cleanNumber(c.statement_amount);
                  const d = dueDiff(c);
                  if (cardDueFilter === 'overdue') return amt > 0 && d < 0;
                  if (cardDueFilter === 'week') return amt > 0 && d >= 0 && d <= 7;
                  if (cardDueFilter === 'clear') return amt <= 0;
                  return true;
                })
                .sort((a, b) => {
                  let cmp = 0;
                  if (cardSortField === 'amount') cmp = cleanNumber(a.statement_amount) - cleanNumber(b.statement_amount);
                  else if (cardSortField === 'bank') cmp = String(a.bank_name || '').localeCompare(String(b.bank_name || ''), 'tr');
                  else if (cardSortField === 'name') cmp = String(a.card_name || '').localeCompare(String(b.card_name || ''), 'tr');
                  else cmp = dueDiff(a) - dueDiff(b);
                  return cardSortOrder === 'asc' ? cmp : -cmp;
                });
              const sortMark = (field: typeof cardSortField) => cardSortField === field ? (cardSortOrder === 'asc' ? ' ↑' : ' ↓') : '';
              return (
                <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
                    <span className="text-[11px] text-rose-800 font-semibold block">Toplam ekstre borcu</span>
                    <span className="text-lg font-black text-slate-900">{totalStmt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                  </div>
                  <button type="button" onClick={() => setCardDueFilter(cardDueFilter === 'week' ? 'all' : 'week')} className={`text-left rounded-xl p-3 border ${cardDueFilter === 'week' ? 'bg-amber-100 border-amber-300' : 'bg-amber-50 border-amber-100'}`}>
                    <span className="text-[11px] text-amber-800 font-semibold block">Bu hafta son ödeme</span>
                    <span className="text-lg font-black text-slate-900">{week.length} kart</span>
                  </button>
                  <button type="button" onClick={() => setCardDueFilter(cardDueFilter === 'overdue' ? 'all' : 'overdue')} className={`text-left rounded-xl p-3 border ${cardDueFilter === 'overdue' ? 'bg-rose-100 border-rose-300' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[11px] text-slate-600 font-semibold block">Geciken</span>
                    <span className="text-lg font-black text-rose-700">{overdue.length} kart</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {([
                    ['all', 'Tümü'],
                    ['week', 'Bu hafta'],
                    ['overdue', 'Geciken'],
                    ['clear', 'Borcu yok']
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setCardDueFilter(id)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border ${cardDueFilter === id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3 cursor-pointer select-none" onClick={() => toggleSort('name')}>Kart{sortMark('name')}</th>
                        <th className="py-3 px-3 cursor-pointer select-none" onClick={() => toggleSort('bank')}>Banka{sortMark('bank')}</th>
                        <th className="py-3 px-3">Tür</th>
                        <th className="py-3 px-3 text-right cursor-pointer select-none" onClick={() => toggleSort('amount')}>Kalan ekstre{sortMark('amount')}</th>
                        <th className="py-3 px-3 text-right">Asgari</th>
                        <th className="py-3 px-3 cursor-pointer select-none" onClick={() => toggleSort('due')}>Son ödeme{sortMark('due')}</th>
                        <th className="py-3 px-3 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {rows.length === 0 ? (
                        <tr><td colSpan={7} className="py-8 text-center text-slate-400">Bu filtrede kart yok.</td></tr>
                      ) : rows.map((cc, idx) => {
                        const stmtAmt = cleanNumber(cc.statement_amount);
                        const minAmt = cleanNumber(cc.min_payment_amount);
                        const hasDebt = stmtAmt > 0;
                        const diff = dueDiff(cc);
                        const isPersonal = cc.card_kind === 'personal' || /şahsi|sahsi|kişisel|kisisel/i.test(String(cc.card_name || ''));
                        const accent = bankAccent(cc.bank_name);
                        const open = cardMenuId === (cc.id ?? idx);
                        return (
                          <tr key={cc.id || idx} className={`hover:bg-slate-50 ${hasDebt && diff < 0 ? 'bg-rose-50/40' : hasDebt && diff <= 3 ? 'bg-amber-50/30' : ''}`}>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-8 rounded-full shrink-0 ${accent.bar}`} />
                                <div>
                                  <div className="font-bold text-slate-900 text-sm">{cc.card_name}</div>
                                  {cc.last_four_digits ? <div className="text-[10px] text-slate-400 font-mono">•••• {cc.last_four_digits}</div> : null}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold border ${accent.chip}`}>{cc.bank_name || '-'}</span>
                            </td>
                            <td className="py-3 px-3 text-slate-600">{isPersonal ? 'Şahsi' : 'Şirket'}</td>
                            <td className={`py-3 px-3 text-right font-black ${hasDebt ? 'text-rose-700' : 'text-emerald-700'}`}>
                              {stmtAmt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                            </td>
                            <td className="py-3 px-3 text-right text-amber-800 font-semibold">
                              {minAmt > 0 ? `${minAmt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : '—'}
                            </td>
                            <td className="py-3 px-3">
                              <div className={`font-bold ${hasDebt && diff < 0 ? 'text-rose-700' : hasDebt && diff <= 3 ? 'text-amber-800' : 'text-slate-800'}`}>{formatDateTR(cc.due_date)}</div>
                              {hasDebt ? (
                                <div className="text-[10px] text-slate-500">
                                  {diff < 0 ? `${Math.abs(diff)} gün gecikti` : diff === 0 ? 'Bugün' : `${diff} gün kaldı`}
                                </div>
                              ) : null}
                            </td>
                            <td className="py-3 px-3 text-right relative">
                              {isAdmin && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setCardMenuId(open ? null : (cc.id ?? idx))}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                                    title="İşlemler"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>
                                  {open && (
                                    <div className="absolute right-3 top-12 z-20 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 text-left">
                                      {hasDebt && (
                                        <>
                                          <button type="button" className="w-full px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50" onClick={() => { setCardMenuId(null); handlePayCreditCard(cc, 'full'); }}>Tamamını öde</button>
                                          {minAmt > 0 && minAmt < stmtAmt && (
                                            <button type="button" className="w-full px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50" onClick={() => { setCardMenuId(null); handlePayCreditCard(cc, 'min'); }}>Asgariyi öde</button>
                                          )}
                                        </>
                                      )}
                                      <button type="button" className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => { setCardMenuId(null); openEditCreditCardModal(cc); }}>Düzenle / ekstre</button>
                                      <button type="button" className="w-full px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50" onClick={async () => {
                                        setCardMenuId(null);
                                        if (!window.confirm(`${cc.card_name} kartını silmek istiyor musunuz?`)) return;
                                        await supabase.from('credit_cards').delete().eq('id', cc.id);
                                        loadPortalData();
                                      }}>Sil</button>
                                    </div>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </>
              );
            })()}
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
                      vehicleType: 'Kamyon',
                      ownershipType: 'Öz Mal',
                      isActive: true,
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
                    <th className="py-3 px-3">TİP</th>
                    <th className="py-3 px-3">DURUM</th>
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

                    const vehType = normalizeVehicleType(v.vehicle_type);
                    const active = isActiveVehicle(v);
                    return (
                      <tr key={v.id || idx} className={`hover:bg-slate-50 transition ${active ? '' : 'opacity-45'}`}>
                        <td className="py-3 px-3 font-mono font-bold text-blue-700">{plate || '-'}</td>
                        <td className="py-3 px-3 text-slate-600">{vehType}</td>
                        <td className="py-3 px-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {active ? 'Aktif' : 'Pasif'}
                          </span>
                        </td>
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
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 border-b border-slate-100 gap-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Öz Mal Araç Karlılık</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ayın ilk haftasında bir önceki ay kapanır. Ciro, yakıt ve HGS diğer portaldan elle girilir; maaş+prim, SGK, sigorta/kasko/MTV/muayene ve bakım-lastik (yıllık÷12) sistemden gelir.
                  </p>
                </div>
                <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700">
                  <Calendar className="w-4 h-4 text-[#009fe3]" />
                  <span>Ay</span>
                  <input
                    type="month"
                    value={profitMonth}
                    onChange={e => setProfitMonth(e.target.value)}
                    className="bg-transparent outline-none font-bold"
                  />
                </label>
              </div>

              {(() => {
                const included = dbProfitability.filter(p => p.included);
                const totalRev = included.reduce((sum, p) => sum + p.invoice_rev, 0);
                const totalCost = included.reduce((sum, p) => sum + p.totalCost, 0);
                const totalNet = included.reduce((sum, p) => sum + p.netProfit, 0);
                const marginPct = totalRev > 0 ? (totalNet / totalRev) * 100 : null;
                const marginColor = marginPct == null ? 'text-slate-400' : marginPct >= 0 ? 'text-emerald-600' : 'text-rose-600';
                const money = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Toplam ciro</span>
                  <span className="text-2xl font-black text-slate-900 mt-1 block">
                    {money(totalRev)} ₺
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Toplam gider</span>
                  <span className="text-2xl font-black text-rose-600 mt-1 block">
                    {money(totalCost)} ₺
                  </span>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <span className="text-xs font-bold text-blue-800 uppercase tracking-wider block">Net kâr / zarar</span>
                  <span className={`text-2xl font-black mt-1 block ${totalNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {money(totalNet)} ₺
                  </span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Karlılık oranı</span>
                  <span className={`text-2xl font-black mt-1 block ${marginColor}`}>
                    {marginPct == null ? '—' : `%${marginPct.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1 block">Net kâr ÷ ciro (bu ay, dahil araçlar)</span>
                </div>
              </div>
                );
              })()}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">Bu ay</th>
                      <th className="py-3 px-3">Tip</th>
                      <th className="py-3 px-3">Plaka</th>
                      <th className="py-3 px-3">Şoför</th>
                      <th className="py-3 px-3 text-right">Ciro (elle)</th>
                      <th className="py-3 px-3 text-right">Yakıt (elle)</th>
                      <th className="py-3 px-3 text-right">HGS (elle)</th>
                      <th className="py-3 px-3 text-right">Maaş + prim</th>
                      <th className="py-3 px-3 text-right">SGK</th>
                      <th className="py-3 px-3 text-right">Sabit / ay</th>
                      <th className="py-3 px-3 text-right">Bakım / ay</th>
                      <th className="py-3 px-3 text-right">Net kâr</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dbProfitability.map(item => {
                      const stored = monthlyInputRows.find(
                        r => String(r.plate_number).trim() === item.plate_number && r.year_month === profitMonth
                      );
                      const fmtInput = (n: number) => (n ? String(n) : '');
                      return (
                        <tr key={item.id || item.plate_number} className={`hover:bg-slate-50 ${item.included ? '' : 'opacity-40'}`}>
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={item.included}
                              disabled={!isAdmin}
                              onChange={e => saveMonthlyProfitInput(item.plate_number, 'included', e.target.checked)}
                              title="Bu ay kârlılığa dahil et"
                            />
                          </td>
                          <td className="py-3 px-3 text-slate-600">{item.vehicleType}</td>
                          <td
                            onClick={() => openVehicle360(item.vehicle)}
                            className="py-3 px-3 font-mono font-bold text-blue-700 cursor-pointer underline decoration-blue-300"
                          >
                            {item.plate_number}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-700">{item.driver_name || 'Atanmadı'}</td>
                          <td className="py-3 px-3 text-right">
                            <input
                              type="text"
                              disabled={!isAdmin}
                              defaultValue={fmtInput(item.invoice_rev)}
                              key={`rev-${item.plate_number}-${profitMonth}-${stored?.updated_at || ''}`}
                              onBlur={e => saveMonthlyProfitInput(item.plate_number, 'invoice_rev', e.target.value)}
                              className="w-28 px-2 py-1 border border-slate-200 rounded text-right font-bold bg-white"
                            />
                          </td>
                          <td className="py-3 px-3 text-right">
                            <input
                              type="text"
                              disabled={!isAdmin}
                              defaultValue={fmtInput(item.fuel)}
                              key={`fuel-${item.plate_number}-${profitMonth}-${stored?.updated_at || ''}`}
                              onBlur={e => saveMonthlyProfitInput(item.plate_number, 'fuel', e.target.value)}
                              className="w-24 px-2 py-1 border border-slate-200 rounded text-right bg-white"
                            />
                          </td>
                          <td className="py-3 px-3 text-right">
                            <input
                              type="text"
                              disabled={!isAdmin}
                              defaultValue={fmtInput(item.hgs)}
                              key={`hgs-${item.plate_number}-${profitMonth}-${stored?.updated_at || ''}`}
                              onBlur={e => saveMonthlyProfitInput(item.plate_number, 'hgs', e.target.value)}
                              className="w-24 px-2 py-1 border border-slate-200 rounded text-right bg-white"
                            />
                          </td>
                          <td className="py-3 px-3 text-right text-slate-700" title={`Maaş ${item.driver_sal.toLocaleString('tr-TR')} + prim ${item.bonus.toLocaleString('tr-TR')}`}>
                            {item.payroll.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                          </td>
                          <td className="py-3 px-3 text-right text-slate-700">{item.sgk.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</td>
                          <td className="py-3 px-3 text-right text-slate-700" title={`Sigorta ${item.insurance_m.toFixed(0)} + kasko ${item.kasko_m.toFixed(0)} + MTV ${item.mtv_m.toFixed(0)} + muayene ${item.inspection_m.toFixed(0)}`}>
                            {item.fixed_monthly.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                          </td>
                          <td
                            className="py-3 px-3 text-right text-slate-700"
                            title={`Bu yılın bakım+lastik toplamı ${item.bakimYear.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ ÷ 12`}
                          >
                            {item.bakim.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                          </td>
                          <td className={`py-3 px-3 text-right font-black ${item.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {item.netProfit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-400">Listede yalnızca filoda Aktif işaretli öz mal kamyonet, kamyon ve TIR görünür. Binek ve dorse burada yer almaz. “Bu ay” kutusu kamyonet gibi araçları bazı aylar toplamdan çıkarır. Bakım ve lastik, o yılın toplamının 12’ye bölümüdür; faturanın kesildiği aya tam yazılmaz.</p>
              {dbProfitability.length === 0 && (
                <p className="text-sm text-slate-500">Gösterilecek araç yok. Filoda tipi Kamyonet/Kamyon/TIR, sahiplik Öz Mal ve durum Aktif olsun.</p>
              )}
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
                  {dbInvoices.filter(i => !['subcontractor_invoice', 'customer_collection', 'freight_sales', 'cash_deposit', 'customer_advance', 'credit_card_payment', 'salary_payroll'].includes(i.category)).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-medium text-slate-800">{item.invoice_no}</td>
                      <td className="py-3 px-4 text-slate-600">{sanitizeDate(item.issue_date)}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${item.status === 'paid' ? (isExpensePaidByCard(item) ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800') : 'bg-rose-100 text-rose-800'}`}>
                          {item.status === 'paid' ? (isExpensePaidByCard(item) ? 'Kartla ödendi' : 'Kasa / banka') : 'Ödenecek'}
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
                                paidSource: isExpensePaidByCard(item) ? 'card' : 'bank'
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
      
      {/* MODAL: PERSONEL EKLE & DÜZENLE (PRİM / EK MASRAF DESTEKLİ) */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">{editingEmployeeId ? 'Personeli Düzenle' : 'Yeni Personel Ekle'}</h3>
              <button onClick={() => setIsEmployeeModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveEmployee} className="mt-4 space-y-3 text-sm">
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
              <div>
                <label className="block font-semibold text-slate-700 mb-1">İşe giriş tarihi</label>
                <input
                  type="date"
                  value={employeeFormData.hireDate}
                  onChange={e => setEmployeeFormData({ ...employeeFormData, hireDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
                <p className="text-[10px] text-slate-400 mt-1">Hakediş ve öz mal maliyeti bu tarihten önce hesaplanmaz. Ayın ortasında girişte o ay gün oranına bölünür.</p>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">SGK işveren maliyeti (aylık)</label>
                <input
                  type="text"
                  placeholder="11148"
                  value={employeeFormData.employerSgk}
                  onChange={e => setEmployeeFormData({ ...employeeFormData, employerSgk: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-800"
                />
                <p className="text-[10px] text-slate-400 mt-1">Asgari ücret / tarife değişince bu kişiyi düzenleyip yeni tutarı yazın. Öz mal kârlılık bu alanı kullanır.</p>
              </div>
          
   {/* PERSONEL CARİ HAREKETLERİ (ÇOKLU PRİM, ÇOKLU TEKİL AVANS, ÇOKLU TAKSİTLİ AVANS YÖNETİMİ) */}
              {editingEmployeeId && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">Personel Cari & Hakediş Defteri</span>
                      <span className="text-[10px] text-slate-500">Ekim 2026 öncesi hareketler cariye girmez. Bundan sonra prim ve avans buradan işlenir.</span>
                    </div>
                  </div>

                 {/* 1. HIZLI HAREKET EKLEME PANELİ (TARİH SEÇİCİLİ) */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                    <div>
                      <span className="text-sm font-bold text-slate-800 block">Yeni hareket ekle</span>
                      <span className="text-xs text-slate-500">Prim, münferit avans veya taksitli avans. Taksit sayısı yalnızca taksitli avansta kullanılır.</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">İşlem türü</label>
                        <select id="new_tx_type" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white font-medium">
                          <option value="bonus">Sefer / prim (maaşa ek)</option>
                          <option value="advance">Münferit avans (tek sefer kesilir)</option>
                          <option value="installment_advance">Taksitli avans (aylara bölünür)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Tarih</label>
                        <input
                          id="new_tx_date"
                          type="date"
                          defaultValue={new Date().toISOString().split('T')[0]}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-700"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Açıklama</label>
                        <input id="new_tx_title" type="text" placeholder="Örn: Ankara seferi, ramazan avansı" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Tutar (TL)</label>
                        <input id="new_tx_amount" type="text" placeholder="5000" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-800" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Taksit sayısı</label>
                        <select id="new_tx_inst" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white">
                          <option value="1">1 (tek sefer)</option>
                          <option value="2">2 ay</option>
                          <option value="3">3 ay</option>
                          <option value="4">4 ay</option>
                          <option value="5">5 ay</option>
                          <option value="6">6 ay</option>
                        </select>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const dateEl = document.getElementById('new_tx_date') as HTMLInputElement;
                        const typeEl = document.getElementById('new_tx_type') as HTMLSelectElement;
                        const titleEl = document.getElementById('new_tx_title') as HTMLInputElement;
                        const amountEl = document.getElementById('new_tx_amount') as HTMLInputElement;
                        const instEl = document.getElementById('new_tx_inst') as HTMLSelectElement;

                        const dVal = dateEl?.value || new Date().toISOString().split('T')[0];
                        const tVal = typeEl.value as any;
                        const titleVal = titleEl.value;
                        const amtVal = cleanNumber(amountEl.value);
                        const instVal = Number(instEl.value) || 1;

                        if (!titleVal || amtVal <= 0) {
                          alert('Lütfen geçerli bir açıklama ve 0\'dan büyük bir tutar girin.');
                          return;
                        }
                        await handleAddEmployeeTransaction(editingEmployeeId, tVal, titleVal, amtVal, instVal, dVal);
                        titleEl.value = '';
                        amountEl.value = '';
                        instEl.value = '1';
                      }}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition"
                    >
                      Hareketi kaydet
                    </button>
                  </div>
                  {/* 2. KAYITLI CARİ HAREKETLER LİSTESİ */}
                  {(() => {
                    const empTxList = (dbEmployeeTransactions || []).filter(tx => {
                      if (String(tx.employee_id) !== String(editingEmployeeId)) return false;
                      const ym = sanitizeDate(tx.transaction_date || tx.created_at).slice(0, 7);
                      return !ym || ym >= personnelBooksStartYm;
                    });
                    
                    const empObj = (dbEmployees || []).find((e: any) => String(e.id) === String(editingEmployeeId));
                    const empName = empObj ? (empObj.full_name || '').toLowerCase().trim() : '';
                    const empIdStr = String(editingEmployeeId || '');
                    const legacyAdvances = (dbAdvances || []).filter((a: any) => {
                      if (a.target_type !== 'employee') return false;
                      const ym = sanitizeDate(a.issue_date || a.created_at).slice(0, 7);
                      if (ym && ym < personnelBooksStartYm) return false;
                      const tName = String(a.target_name || '').toLowerCase().trim();
                      const tId = String(a.target_id || '');
                      return (tId && tId === empIdStr) || (tName.length >= 3 && (tName.includes(empName) || empName.includes(tName)));
                    });

                    if (empTxList.length === 0 && legacyAdvances.length === 0) {
                      return <p className="text-[11px] text-slate-400 italic py-1 text-center bg-white rounded-lg border border-dashed border-slate-200">Henüz girilmiş bir cari hareket bulunmuyor.</p>;
                    }

                    return (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {/* Yeni Sistem Hareketleri */}
                        {empTxList.map((tx: any) => {
                          const isBonus = tx.type === 'bonus';
                          const isInst = tx.type === 'installment_advance';
                          const totAmt = cleanNumber(tx.total_amount);
                          const mCut = cleanNumber(tx.monthly_cut || Math.round(totAmt / Math.max(1, tx.installment_count || 1)));

                          return (
                            <div key={'tx-' + tx.id} className="flex items-center justify-between gap-3 p-3 bg-white rounded-lg border border-slate-200 text-sm shadow-xs">
                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${isBonus ? 'bg-amber-100 text-amber-800' : isInst ? 'bg-purple-100 text-purple-800' : 'bg-rose-100 text-rose-800'}`}>
                                  {isBonus ? 'PRİM' : isInst ? `TAKSİT (${tx.installment_count} Ay)` : 'MÜNFERİT AVANS'}
                                </span>
                                <span className="font-medium text-slate-700">{tx.title}</span>
                                <span className="text-[10px] text-slate-400">{formatDateTR(tx.transaction_date || tx.created_at)}</span>
                                {isInst && (
                                  <span className="text-[10px] text-purple-600 font-semibold">(Aylık Kesinti: {mCut.toLocaleString('tr-TR')} ₺)</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`font-bold ${isBonus ? 'text-amber-700' : isInst ? 'text-purple-700' : 'text-rose-700'}`}>
                                  {isBonus ? '+' : '-'}{totAmt.toLocaleString('tr-TR')} ₺
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEmployeeTransaction(tx.id)}
                                  className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition font-bold text-xs"
                                  title="Hatalı Kaydı Sil"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {/* Eski / Kasa Avans Kayıtları */}
                        {legacyAdvances.map((adv: any) => {
                          const isBonus = adv.payment_type === 'employee_bonus';
                          const amt = cleanNumber(adv.remaining_amount !== undefined ? adv.remaining_amount : adv.total_amount);
                          return (
                            <div key={'adv-' + adv.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs shadow-xs">
                              <div className="flex items-center gap-2">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isBonus ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                                  {isBonus ? 'KASA PRİM' : 'KASA AVANS'}
                                </span>
                                <span className="font-medium text-slate-700">{adv.description || adv.reason || 'Kasa Hareketi'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`font-bold ${isBonus ? 'text-amber-700' : 'text-rose-700'}`}>
                                  {isBonus ? '+' : '-'}{amt.toLocaleString('tr-TR')} ₺
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAdvanceRecord(adv.id)}
                                  className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition font-bold text-xs"
                                  title="Hatalı Kasa Kaydını Sil"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
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
                  <input type="date" value={manualSubInvoiceData.issueDate} onChange={e => {
                    const issueDate = e.target.value;
                    const dates = defaultContractorTermDates(issueDate);
                    setManualSubInvoiceData({
                      ...manualSubInvoiceData,
                      issueDate,
                      term1DueDate: dates.term1 || manualSubInvoiceData.term1DueDate,
                      term2DueDate: dates.term2 || manualSubInvoiceData.term2DueDate
                    });
                  }} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white text-[11px]" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-600">1 nci ödeme (Yarısı)</label>
                  <input type="date" value={manualSubInvoiceData.term1DueDate} onChange={e => setManualSubInvoiceData({ ...manualSubInvoiceData, term1DueDate: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white text-[11px]" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-600">2 nci ödeme (Kalan)</label>
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
              {/* Sadece Araç / Filo Gideri Seçildiğinde Görünen Plaka Seçimi */}
            {['maintenance', 'tires', 'general_fuel', 'traffic_fines', 'insurance_inspection', 'hgs'].includes(expenseFormData.category) && (
              <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
                <label className="block font-bold text-blue-900 text-[11px]">İlgili Araç / Plaka Seçimi</label>
                <select
                  value={expenseFormData.plateNumber || ''}
                  onChange={e => setExpenseFormData({ ...expenseFormData, plateNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg text-xs bg-white font-semibold text-slate-800"
                >
                  <option value="">Plaka Seçiniz (Opsiyonel / Genel)</option>
                  {dbVehicles && dbVehicles.map((v: any) => (
                    <option key={v.id || v.plate_number} value={v.plate_number}>
                      {v.plate_number} {v.brand ? `(${v.brand})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tedarikçi / Firma / Açıklama</label>
              <input 
                type="text" 
                placeholder="Örn: Brisa Lastikçilik / Bakım" 
                value={expenseFormData.companyName} 
                onChange={e => setExpenseFormData({ ...expenseFormData, companyName: e.target.value })} 
                className="w-full px-3 py-2 border border-slate-200 rounded-lg" 
                required 
              />
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
              {expenseFormData.status === 'paid' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nasıl ödendi?</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setExpenseFormData({ ...expenseFormData, paidSource: 'bank' })} className={`p-2 rounded-lg border text-center transition ${expenseFormData.paidSource !== 'card' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200'}`}>Kasa / Banka</button>
                    <button type="button" onClick={() => setExpenseFormData({ ...expenseFormData, paidSource: 'card' })} className={`p-2 rounded-lg border text-center transition ${expenseFormData.paidSource === 'card' ? 'bg-purple-50 border-purple-500 text-purple-700 font-bold' : 'bg-white border-slate-200'}`}>Kredi kartı</button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {expenseFormData.paidSource === 'card'
                      ? 'Tedarikçi kapanır, kasa şimdi düşmez. Kartı ödeyince kasa düşer.'
                      : 'Tutar şimdi kasadan / bankadan çıkar.'}
                  </p>
                </div>
              )}
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsGeneralExpenseModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-blue-600 text-white font-medium">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DİĞER MODALLAR: SATIŞ, TAHSİLAT, KASA, ARAÇ, KREDİ KARTI, HAKEDİŞ DÜZENLEME, TOPLU MAAŞ */}
      {selectedCariCustomer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:bg-white print:static print:p-0">
          <div id="cari-dokum-print" className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl border border-slate-100 print:shadow-none print:border-0 print:max-h-none print:rounded-none">
            <div className="flex justify-between items-start pb-4 border-b border-slate-100 print:border-black">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-[#009fe3] uppercase">Tazeyol ERP · Cari ekstre</p>
                <h3 className="font-bold text-slate-900 text-lg mt-1">{selectedCariCustomer.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedCariCustomer.tax_id ? `VKN: ${selectedCariCustomer.tax_id}` : 'VKN yok'}
                  {selectedCariCustomer.phone ? ` · ${selectedCariCustomer.phone}` : ''}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Döküm tarihi: {new Date().toLocaleDateString('tr-TR')} · Faturalar ve ödemeler işlenmiş kayıtlardır.</p>
              </div>
              <div className="flex gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => exportCariExcel(selectedCariCustomer, selectedCariLedger)}
                  className="px-3 py-2 rounded-lg bg-[#009fe3] text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Excel'e aktar
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold"
                >
                  Yazdır
                </button>
                <button type="button" onClick={() => setSelectedCariCustomer(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <table className="w-full text-xs mt-4 border-collapse">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-2">Tarih</th>
                  <th className="py-2 pr-2">İşlem</th>
                  <th className="py-2 pr-2">Açıklama</th>
                  <th className="py-2 pr-2 text-right">Borç (fatura)</th>
                  <th className="py-2 pr-2 text-right">Alacak (ödeme)</th>
                  <th className="py-2 text-right">Bakiye</th>
                </tr>
              </thead>
              <tbody>
                {selectedCariLedger.length === 0 ? (
                  <tr><td colSpan={6} className="py-6 text-center text-slate-400">Bu müşteriye işlenmiş fatura veya ödeme yok.</td></tr>
                ) : selectedCariLedger.map((line, idx) => (
                  <tr key={idx} className="border-b border-slate-50">
                    <td className="py-2 pr-2 whitespace-nowrap">{formatDateTR(line.date)}</td>
                    <td className="py-2 pr-2 font-semibold">{line.type}</td>
                    <td className="py-2 pr-2 text-slate-600">{line.title}</td>
                    <td className="py-2 pr-2 text-right">{line.debit ? line.debit.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺' : '—'}</td>
                    <td className="py-2 pr-2 text-right text-emerald-700">{line.credit ? line.credit.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺' : '—'}</td>
                    <td className={`py-2 text-right font-bold ${line.balance >= 0 ? 'text-amber-800' : 'text-rose-700'}`}>
                      {line.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedCariLedger.length > 0 && (
              <div className="mt-4 flex justify-end">
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">Kapanış bakiyesi</span>
                  <span className="text-lg font-black text-slate-900">
                    {selectedCariLedger[selectedCariLedger.length - 1].balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </span>
                  <span className="text-[11px] text-slate-400 block">Artı: müşteriden alacak · Eksi: fazla ödeme/avans</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedPayrollEmp && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:bg-white print:static print:p-0">
          <div id="personel-hakedis-print" className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl border border-slate-100 print:shadow-none print:border-0 print:max-h-none print:rounded-none">
            <div className="flex justify-between items-start pb-4 border-b border-slate-100 print:border-black gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-[#009fe3] uppercase">Tazeyol ERP · Personel hakediş raporu</p>
                <h3 className="font-bold text-slate-900 text-lg mt-1">{selectedPayrollEmp.full_name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedPayrollEmp.role_title || 'Görev yok'}
                  {selectedPayrollEmp.hire_date
                    ? ` · İşe giriş: ${formatDateTR(selectedPayrollEmp.hire_date)}`
                    : ` · Başlangıç (${resolveEmployeeStart(selectedPayrollEmp).label}): ${formatDateTR(resolveEmployeeStart(selectedPayrollEmp).date)}`}
                  {selectedPayrollEmp.iban ? ` · IBAN: ${selectedPayrollEmp.iban}` : ''}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Personel cari Ekim 2026’dan başlar. Ekim öncesi maaş ve avans bu rapora yazılmaz.
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 print:hidden">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <span>Dönem</span>
                  <input type="month" value={payrollFrom} onChange={e => setPayrollFrom(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1" />
                  <span>—</span>
                  <input type="month" value={payrollTo} onChange={e => setPayrollTo(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1" />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => exportPayrollExcel(selectedPayrollEmp, selectedPayrollLedger)}
                    className="px-3 py-2 rounded-lg bg-[#009fe3] text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold"
                  >
                    PDF / Yazdır
                  </button>
                  <button type="button" onClick={() => setSelectedPayrollEmp(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                </div>
              </div>
            </div>
            <table className="w-full text-xs mt-4 border-collapse">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-2">Tarih</th>
                  <th className="py-2 pr-2">İşlem</th>
                  <th className="py-2 pr-2">Açıklama</th>
                  <th className="py-2 pr-2 text-right">Hakediş</th>
                  <th className="py-2 pr-2 text-right">Kesinti / ödeme</th>
                  <th className="py-2 text-right">Bakiye</th>
                </tr>
              </thead>
              <tbody>
                {selectedPayrollLedger.length === 0 ? (
                  <tr><td colSpan={6} className="py-6 text-center text-slate-400">Bu dönemde hakediş kaydı yok.</td></tr>
                ) : selectedPayrollLedger.map((line, idx) => (
                  <tr key={idx} className="border-b border-slate-50">
                    <td className="py-2 pr-2 whitespace-nowrap">{formatDateTR(line.date)}</td>
                    <td className="py-2 pr-2 font-semibold">{line.type}</td>
                    <td className="py-2 pr-2 text-slate-600">{line.title}</td>
                    <td className="py-2 pr-2 text-right text-emerald-700">{line.earn ? line.earn.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺' : '—'}</td>
                    <td className="py-2 pr-2 text-right text-rose-700">{line.cut ? line.cut.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺' : '—'}</td>
                    <td className={`py-2 text-right font-bold ${line.balance >= 0 ? 'text-slate-800' : 'text-rose-700'}`}>
                      {line.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedPayrollLedger.length > 0 && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-3">
                  <span className="text-[11px] text-slate-500 block">Toplam hakediş</span>
                  <span className="font-black text-emerald-700">
                    {selectedPayrollLedger.reduce((s, l) => s + l.earn, 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </span>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <span className="text-[11px] text-slate-500 block">Toplam kesinti / ödeme</span>
                  <span className="font-black text-rose-700">
                    {selectedPayrollLedger.reduce((s, l) => s + l.cut, 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </span>
                </div>
                <div className="bg-blue-50 rounded-xl p-3">
                  <span className="text-[11px] text-blue-700 block">Kapanış bakiyesi</span>
                  <span className="font-black text-slate-900">
                    {selectedPayrollLedger[selectedPayrollLedger.length - 1].balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </span>
                  <span className="text-[11px] text-slate-400 block">Artı: personele kalan · Eksi: fazla avans</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">{editingCustomerId ? 'Müşteri Düzenle' : 'Yeni Müşteri'}</h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveCustomer} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Unvan</label>
                <input value={customerFormData.name} onChange={e => setCustomerFormData({ ...customerFormData, name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" required placeholder="Örn: MİGROS TİCARET A.Ş." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">VKN</label>
                  <input value={customerFormData.tax_id} onChange={e => setCustomerFormData({ ...customerFormData, tax_id: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vergi Dairesi</label>
                  <input value={customerFormData.tax_office} onChange={e => setCustomerFormData({ ...customerFormData, tax_office: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Adres</label>
                <input value={customerFormData.address} onChange={e => setCustomerFormData({ ...customerFormData, address: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Telefon</label>
                  <input value={customerFormData.phone} onChange={e => setCustomerFormData({ ...customerFormData, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">E-posta</label>
                  <input type="email" value={customerFormData.email} onChange={e => setCustomerFormData({ ...customerFormData, email: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Not</label>
                <input value={customerFormData.notes} onChange={e => setCustomerFormData({ ...customerFormData, notes: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="w-1/2 py-2 rounded-lg border border-slate-200">İptal</button>
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-[#009fe3] text-white font-medium">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                <label className="block font-semibold text-slate-700 mb-1">Müşteri</label>
                {dbCustomers.length > 0 ? (
                  <select
                    value={newSaleFormData.customerName}
                    onChange={e => setNewSaleFormData({ ...newSaleFormData, customerName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    required
                  >
                    <option value="">Müşteri seçin</option>
                    {dbCustomers.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <input type="text" placeholder="Önce Müşteri Kartları menüsünden ekleyin" value={newSaleFormData.customerName} onChange={e => setNewSaleFormData({ ...newSaleFormData, customerName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" required />
                )}
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
              <h3 className="font-bold text-slate-900 text-base">Cari ödeme / avans</h3>
              <button onClick={() => setIsNewReceiptModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveNewReceipt} className="mt-4 space-y-3 text-xs">
              <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg p-2">
                Gelen para faturaya bağlanmaz. Kasaya girer, müşteri carisinde avans olarak durur. Faturalar açık kalır; Ekim mutabakatı bitince satırdan “Ödendi işaretle” deyin.
              </p>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Müşteri / Cari Adı</label>
                {dbCustomers.length > 0 ? (
                  <select
                    value={newReceiptFormData.customerName}
                    onChange={e => setNewReceiptFormData({ ...newReceiptFormData, customerName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    required
                  >
                    <option value="">Müşteri seçin</option>
                    {dbCustomers.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <input type="text" value={newReceiptFormData.customerName} onChange={e => setNewReceiptFormData({ ...newReceiptFormData, customerName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" required />
                )}
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tahsilat Hesabı</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setNewReceiptFormData({ ...newReceiptFormData, targetAccount: 'bank' })} className={`p-2 rounded-lg border text-center transition ${newReceiptFormData.targetAccount === 'bank' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200'}`}>🏦 Banka Hesabı</button>
                  <button type="button" onClick={() => setNewReceiptFormData({ ...newReceiptFormData, targetAccount: 'cash' })} className={`p-2 rounded-lg border text-center transition ${newReceiptFormData.targetAccount === 'cash' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200'}`}>💵 Kasa (Elden Nakit)</button>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Dekont / açıklama</label>
                <input type="text" placeholder="Örn: Migros Kasım 1. hafta avans" value={newReceiptFormData.receiptNo} onChange={e => setNewReceiptFormData({ ...newReceiptFormData, receiptNo: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
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
                <button type="submit" className="w-1/2 py-2 rounded-lg bg-emerald-600 text-white font-medium">Cariye İşle</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCashLedgerOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-xl border border-slate-100">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Kasa / banka hareketleri</h3>
                <p className="text-xs text-slate-500 mt-0.5">Fiili kasa açılışı hesaba katılmaz. Bakiye Ekim’den beri tahsilat, ödeme ve kasa çıkışından oluşur.</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-semibold text-slate-500">Başlangıç
                  <input type="date" value={cashLedgerFrom || '2026-10-01'} onChange={e => setCashLedgerFrom(e.target.value)} className="ml-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
                </label>
                <label className="text-[11px] font-semibold text-slate-500">Bitiş
                  <input type="date" value={cashLedgerTo || ''} onChange={e => setCashLedgerTo(e.target.value)} className="ml-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
                </label>
                <button onClick={() => setIsCashLedgerOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-5 gap-2 border-b border-slate-100">
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Dönem başı</span>
                <span className="text-sm font-black text-slate-800">{cashLedgerView.startBal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3">
                <span className="text-[10px] font-bold text-emerald-600 uppercase block">Giriş</span>
                <span className="text-sm font-black text-emerald-700">+{cashLedgerView.periodIn.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
              </div>
              <div className="bg-rose-50 rounded-xl p-3">
                <span className="text-[10px] font-bold text-rose-600 uppercase block">Kasa çıkışı</span>
                <span className="text-sm font-black text-rose-700">−{cashLedgerView.periodOut.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
              </div>
              <div className="bg-orange-50 rounded-xl p-3">
                <span className="text-[10px] font-bold text-orange-600 uppercase block">Taşeron ödeme</span>
                <span className="text-sm font-black text-orange-800">−{(cashLedgerView.contractorOut || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <span className="text-[10px] font-bold text-blue-600 uppercase block">Dönem sonu</span>
                <span className="text-sm font-black text-blue-800">{cashLedgerView.endBal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
              </div>
            </div>
            <div className="overflow-auto flex-1 p-5">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase sticky top-0">
                  <tr>
                    <th className="py-2 px-2">Tarih</th>
                    <th className="py-2 px-2">Tür</th>
                    <th className="py-2 px-2">Açıklama</th>
                    <th className="py-2 px-2 text-right">Giriş</th>
                    <th className="py-2 px-2 text-right">Çıkış</th>
                    <th className="py-2 px-2 text-right">Bakiye</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashLedgerView.lines.map(line => (
                    <tr key={String(line.id)} className={line.isHist ? 'bg-amber-50/40 text-slate-400' : line.isOpen ? 'bg-slate-50' : 'hover:bg-slate-50'}>
                      <td className="py-2 px-2 whitespace-nowrap text-slate-600">{formatDateTR(line.date)}</td>
                      <td className="py-2 px-2 font-semibold text-slate-800">
                        {line.label}
                        {line.isHist && <span className="block text-[10px] font-semibold text-amber-700">Açılışa dahil</span>}
                      </td>
                      <td className="py-2 px-2 text-slate-500 max-w-[280px] truncate" title={line.title}>{line.title}</td>
                      <td className="py-2 px-2 text-right font-bold text-emerald-600">{line.inflow ? line.inflow.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺' : '—'}</td>
                      <td className="py-2 px-2 text-right font-bold text-rose-600">{line.outflow ? line.outflow.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺' : '—'}</td>
                      <td className="py-2 px-2 text-right font-black text-slate-900">{line.balance == null ? '—' : line.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Araç tipi</label>
                  <select
                    value={normalizeVehicleType(vehicleFormData.vehicleType)}
                    onChange={e => setVehicleFormData({ ...vehicleFormData, vehicleType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Binek">Binek</option>
                    <option value="Kamyonet">Kamyonet</option>
                    <option value="Kamyon">Kamyon</option>
                    <option value="TIR">TIR</option>
                    <option value="Dorse">Dorse</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sahiplik</label>
                  <select
                    value={vehicleFormData.ownershipType}
                    onChange={e => setVehicleFormData({ ...vehicleFormData, ownershipType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Öz Mal">Öz Mal</option>
                    <option value="Kiralık">Kiralık</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Durum</label>
                  <select
                    value={vehicleFormData.isActive ? 'aktif' : 'pasif'}
                    onChange={e => setVehicleFormData({ ...vehicleFormData, isActive: e.target.value === 'aktif' })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="aktif">Aktif</option>
                    <option value="pasif">Pasif</option>
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 -mt-2">Öz mal kârlılıkta yalnızca aktif kamyonet, kamyon ve TIR görünür. Binek ve dorse o menüde listelenmez.</p>
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
                const payload: any = {
                  card_name: creditCardFormData.cardName.trim(),
                  bank_name: creditCardFormData.bankName.trim(),
                  last_four_digits: creditCardFormData.lastFourDigits.trim(),
                  statement_amount: cleanNumber(creditCardFormData.statementAmount),
                  min_payment_amount: cleanNumber(creditCardFormData.minPaymentAmount),
                  due_date: creditCardFormData.dueDate,
                  card_kind: creditCardFormData.cardKind
                };

                const saveCard = async (data: any) => {
                  if (editingCreditCardId) return supabase.from('credit_cards').update(data).eq('id', editingCreditCardId);
                  return supabase.from('credit_cards').insert([data]);
                };

                let { error } = await saveCard(payload);
                if (error && /card_kind/i.test(error.message)) {
                  const { card_kind, ...fallback } = payload;
                  ({ error } = await saveCard(fallback));
                }
                if (error) throw error;
                alert(editingCreditCardId ? 'Kredi kartı ve ekstre kaydedildi.' : 'Yeni kredi kartı eklendi.');

                setIsCreditCardModalOpen(false);
                setEditingCreditCardId(null);
                setCreditCardFormData({
                  cardName: '',
                  bankName: '',
                  lastFourDigits: '',
                  statementAmount: '',
                  minPaymentAmount: '',
                  dueDate: '',
                  cardKind: 'company'
                });
                loadPortalData();
              } catch (err: any) { 
                alert('Kart kaydetme hatası: ' + err.message); 
              }
            }} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kart türü</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setCreditCardFormData({ ...creditCardFormData, cardKind: 'company' })} className={`p-2 rounded-lg border text-center ${creditCardFormData.cardKind !== 'personal' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200'}`}>Şirket kartı</button>
                  <button type="button" onClick={() => setCreditCardFormData({ ...creditCardFormData, cardKind: 'personal' })} className={`p-2 rounded-lg border text-center ${creditCardFormData.cardKind === 'personal' ? 'bg-slate-100 border-slate-500 text-slate-800 font-bold' : 'bg-white border-slate-200'}`}>Şahsi kart</button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{creditCardFormData.cardKind === 'personal' ? 'Öderken şirket kasasından düşülecek tutarı siz yazarsınız. Şahsi harcama kasayı bozmaz.' : 'Ekstre ödemesi tamamı kasadan düşer.'}</p>
              </div>
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
              <span className="text-[10px] text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full font-medium">1. ve taşan tutar 2 nci ödemeden düşer</span>
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
                <span className="font-semibold text-blue-900 text-xs">1 nci ödeme tutarı</span>
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
                <span className="font-semibold text-blue-900 text-xs">2 nci ödeme tutarı</span>
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

        {activeTab === 'plate_rentals' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Belge Plaka Kiraları ({dbPlateRentals.length} araç)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lojistik belgeye kayıtlı plakalar. Kira veya yalnız devlet ödemesi. 0 bedel yine yenilemeye girer. Kasa ve cariye yazılmaz. Yenilemeye 30 ve 15 gün kala kırmızı uyarı.
                </p>
              </div>
              {isAdmin && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm">
                    <FileUp className="w-4 h-4" /> Excel yükle
                    <input type="file" accept=".xlsx,.xls" onChange={handleImportPlateRentals} className="hidden" />
                  </label>
                  <button
                    onClick={() => {
                      setEditingPlateRentalId(null);
                      setPlateRentalForm(emptyPlateRentalForm);
                      setIsPlateRentalModalOpen(true);
                    }}
                    className="bg-[#009fe3] hover:bg-[#0087c2] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Yeni plaka
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {(['all', ...PLATE_VEHICLE_TYPES] as const).map(t => {
                    const count = t === 'all' ? dbPlateRentals.length : dbPlateRentals.filter((r: any) => plateVehicleTypeOf(r) === t).length;
                const on = plateRentalTypeFilter === t;
                return (
                  <button
                    key={t}
                    onClick={() => setPlateRentalTypeFilter(t)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
                  >
                    {t === 'all' ? `Tümü (${count})` : `${t} (${count})`}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  value={plateRentalSearch}
                  onChange={e => setPlateRentalSearch(e.target.value)}
                  placeholder="Plaka, sahip, telefon, tip ara"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <select
                value={plateRentalSort}
                onChange={e => setPlateRentalSort(e.target.value as typeof plateRentalSort)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="renewal">Sıra: yenileme / uyarı</option>
                <option value="plate">Sıra: plaka</option>
                <option value="owner">Sıra: sahip</option>
                <option value="type">Sıra: araç tipi</option>
                <option value="amount">Sıra: tutar</option>
              </select>
              <span className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                Listede {plateRentalRows.length} / {dbPlateRentals.length} araç
              </span>
              <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl">
                {plateRentalRows.filter((r: any) => r.alert).length} yaklaşan / geçmiş yenileme
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Plaka</th>
                    <th className="py-3 px-3">Araç tipi</th>
                    <th className="py-3 px-3">Sahip / telefon</th>
                    <th className="py-3 px-3">Tahsilat</th>
                    <th className="py-3 px-3 text-right">Tutar</th>
                    <th className="py-3 px-3">Yenileme</th>
                    <th className="py-3 px-3">Not</th>
                    {isAdmin && <th className="py-3 px-3 text-center">İşlem</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {plateRentalRows.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="py-8 text-center text-slate-400">
                        Kayıt yok. SQL’de setup_plate_rentals.sql çalıştırıp Excel yükleyin veya yeni plaka ekleyin.
                      </td>
                    </tr>
                  )}
                  {plateRentalRows.map((r: any) => {
                    const amt = r.collection_kind === 'devlet' ? cleanNumber(r.government_fee) : cleanNumber(r.rent_amount);
                    const warn = r.alert;
                    return (
                      <tr key={r.id} className={warn ? 'bg-rose-100 text-rose-900' : 'hover:bg-slate-50'}>
                        <td className="py-3 px-3 font-mono font-bold">{r.plate}</td>
                        <td className="py-3 px-3 font-semibold">{plateVehicleTypeOf(r) || '—'}</td>
                        <td className="py-3 px-3">
                          <span className={`font-bold block ${warn ? 'text-rose-900' : 'text-slate-800'}`}>{r.owner_name}</span>
                          <span className={`text-[11px] ${warn ? 'text-rose-700' : 'text-slate-500'}`}>{r.phone || 'Telefon yok'}</span>
                        </td>
                        <td className="py-3 px-3">
                          {r.collection_kind === 'devlet' ? 'Yalnız devlet' : (amt === 0 ? '0 bedel kira' : 'Yıllık kira')}
                        </td>
                        <td className="py-3 px-3 text-right font-bold">
                          {amt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={warn ? 'font-black' : ''}>{formatDateTR(r.renewal_date) || '—'}</span>
                          {warn === 'overdue' && (
                            <span className="block text-[10px] font-bold">
                              {r.days === 0 ? 'Bugün yenileme' : `${Math.abs(r.days)} gün geçti`}
                            </span>
                          )}
                          {warn === 'd15' && <span className="block text-[10px] font-bold">15 gün kala</span>}
                          {warn === 'd30' && <span className="block text-[10px] font-bold">30 gün kala</span>}
                        </td>
                        <td className="py-3 px-3 text-slate-600 max-w-[220px]">
                          {[r.payment_note, stripPlateTypeTag(r.notes)].filter(Boolean).join(' · ') || '—'}
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-3 text-center space-x-1">
                            <button
                              onClick={() => {
                                setEditingPlateRentalId(r.id);
                                setPlateRentalForm({
                                  plate: r.plate || '',
                                  owner_name: r.owner_name || '',
                                  phone: r.phone || '',
                                  start_date: sanitizeDate(r.start_date),
                                  renewal_date: sanitizeDate(r.renewal_date),
                                  rent_amount: String(r.rent_amount ?? ''),
                                  government_fee: String(r.government_fee ?? ''),
                                  collection_kind: r.collection_kind === 'devlet' ? 'devlet' : 'kira',
                                  payment_note: r.payment_note || '',
                                  next_amount: r.next_amount === null || r.next_amount === undefined ? '' : String(r.next_amount),
                                  notes: stripPlateTypeTag(r.notes),
                                  vehicle_type: (plateVehicleTypeOf(r) as typeof plateRentalForm.vehicle_type) || ''
                                });
                                setIsPlateRentalModalOpen(true);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                              title="Düzenle"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePlateRental(r.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
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

        {isPlateRentalModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <form onSubmit={handleSavePlateRental} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 space-y-3 text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-900">{editingPlateRentalId ? 'Plaka kaydını düzenle' : 'Yeni plaka'}</h3>
                <button type="button" onClick={() => setIsPlateRentalModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Plaka</label>
                  <input required value={plateRentalForm.plate} onChange={e => setPlateRentalForm({ ...plateRentalForm, plate: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Araç tipi</label>
                  <select
                    value={plateRentalForm.vehicle_type}
                    onChange={e => setPlateRentalForm({ ...plateRentalForm, vehicle_type: e.target.value as typeof plateRentalForm.vehicle_type })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value="">Seçin</option>
                    {PLATE_VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Plaka sahibi</label>
                <input required value={plateRentalForm.owner_name} onChange={e => setPlateRentalForm({ ...plateRentalForm, owner_name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Telefon</label>
                <input value={plateRentalForm.phone} onChange={e => setPlateRentalForm({ ...plateRentalForm, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ne alıyoruz?</label>
                <select
                  value={plateRentalForm.collection_kind}
                  onChange={e => setPlateRentalForm({ ...plateRentalForm, collection_kind: e.target.value as 'kira' | 'devlet' })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="kira">Yıllık kira (0 bedel olabilir)</option>
                  <option value="devlet">Yalnız devlet ödemesi</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kira tutarı</label>
                  <input value={plateRentalForm.rent_amount} onChange={e => setPlateRentalForm({ ...plateRentalForm, rent_amount: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" placeholder="0" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Devlet tutarı</label>
                  <input value={plateRentalForm.government_fee} onChange={e => setPlateRentalForm({ ...plateRentalForm, government_fee: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" placeholder="5000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Başlangıç</label>
                  <input type="date" value={plateRentalForm.start_date} onChange={e => setPlateRentalForm({ ...plateRentalForm, start_date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Yenileme tarihi</label>
                  <input type="date" value={plateRentalForm.renewal_date} onChange={e => setPlateRentalForm({ ...plateRentalForm, renewal_date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ödeme notu</label>
                  <input value={plateRentalForm.payment_note} onChange={e => setPlateRentalForm({ ...plateRentalForm, payment_note: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" placeholder="Ödendi / 5K ödedi" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sonraki tutar</label>
                  <input value={plateRentalForm.next_amount} onChange={e => setPlateRentalForm({ ...plateRentalForm, next_amount: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Açıklama (plaka değişimi vb.)</label>
                <input value={plateRentalForm.notes} onChange={e => setPlateRentalForm({ ...plateRentalForm, notes: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl">Kaydet</button>
            </form>
          </div>
        )}

{/* MODAL: ALT YÜKLENİCİ CARİ DETAYI VE AVANS YÖNETİMİ */}
  {selectedSubcontractorForDetail && (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">{selectedSubcontractorForDetail.company_name || selectedSubcontractorForDetail.name}</h3>
            <span className="text-sm text-slate-500 font-mono">Vergi No: {selectedSubcontractorForDetail.computedTax || '-'} • IBAN: {selectedSubcontractorForDetail.iban || 'Belirtilmedi'}</span>
          </div>
          <div className="flex items-center gap-2">
          <button
              type="button"
              onClick={() => {
                const subName = selectedSubcontractorForDetail.company_name || selectedSubcontractorForDetail.name || '';
                const taxNo = selectedSubcontractorForDetail.tax_no || selectedSubcontractorForDetail.computedTax || 'Belirtilmedi';
                const ibanVal = selectedSubcontractorForDetail.iban || 'Belirtilmedi';
                const ledger = buildSubcontractorLedger(selectedSubcontractorForDetail);
                let csvContent = "\uFEFF";
                csvContent += "Firma Adı;Vergi Numarası;IBAN;Tarih;İşlem Türü;Açıklama;Borç (Fatura);Alacak (Ödeme/Avans);Bakiye\n";
                ledger.forEach(tx => {
                  csvContent += `"${subName}";"${taxNo}";"${ibanVal}";"${tx.date ? formatDateTR(tx.date) : '-'}";"${tx.type}";"${tx.desc}";"${tx.debit}";"${tx.credit}";"${tx.balance}"\n`;
                });
                const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `${subName.replace(/[^a-zA-Z0-9]/g, '_')}_cari_mutabakat.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
              📥 Mutabakat Raporunu İndir (Excel)
            </button>
            <button onClick={() => setSelectedSubcontractorForDetail(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition">Kapat</button>
          </div>
        </div>

        <div className="py-4 flex-1 overflow-y-auto space-y-4 text-sm">
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex justify-between items-center">
            <div>
              <span className="text-blue-900 font-semibold block text-base">Cari Hesap Özeti</span>
              <span className="text-xs text-blue-700">Artı bakiye: taşerona borcunuz. Eksi: avans / fazla ödeme.</span>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-blue-900">{(() => { const L = buildSubcontractorLedger(selectedSubcontractorForDetail); return (L.length ? L[L.length - 1].balance : 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 }); })()} ₺</span>
              <span className="text-xs text-blue-700 block mt-0.5">Güncel Bakiye</span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <span className="font-bold text-slate-800 block">➕ Yeni Cari Hareket Ekle</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select id="sub_tx_type" className="px-3 py-2 border border-slate-200 rounded-lg bg-white font-medium text-sm">
                <option value="advance">Avans verildi (alacak)</option>
                <option value="payment">Ödeme yapıldı (alacak)</option>
                <option value="invoice">Fatura eklendi (borç)</option>
              </select>
              <input id="sub_tx_amount" type="number" placeholder="Tutar (TL)" className="px-3 py-2 border border-slate-200 rounded-lg bg-white font-bold text-slate-800 text-sm" />
              <input id="sub_tx_desc" type="text" placeholder="Açıklama / Belge No" className="px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm" />
            </div>
            <button
              type="button"
              onClick={async () => {
                const typeEl = document.getElementById('sub_tx_type') as HTMLSelectElement;
                const amountEl = document.getElementById('sub_tx_amount') as HTMLInputElement;
                const descEl = document.getElementById('sub_tx_desc') as HTMLInputElement;
                const amt = cleanNumber(amountEl.value);
                if (amt <= 0) return alert('Lütfen geçerli bir tutar giriniz.');
                try {
                  const { error } = await supabase.from('subcontractor_ledger').insert([{
                    subcontractor_id: selectedSubcontractorForDetail.id,
                    transaction_type: typeEl.value,
                    amount: amt,
                    description: descEl.value || 'Cari Hareket'
                  }]);
                  if (error) throw error;
                  alert('Hareket başarıyla kaydedildi!');
                  amountEl.value = ''; descEl.value = '';
                  await loadPortalData();
                } catch (err: any) { alert('Hata: ' + err.message); }
              }}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition shadow-sm">
              Hareketi Kaydet
            </button>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-slate-800">Geçmiş Cari Hareketler</h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Tarih</th>
                    <th className="py-2.5 px-3">İşlem Türü</th>
                    <th className="py-2.5 px-3">Açıklama</th>
                    <th className="py-2.5 px-3 text-right">Borç</th>
                    <th className="py-2.5 px-3 text-right">Alacak</th>
                    <th className="py-2.5 px-3 text-right">Bakiye</th>
                    <th className="py-2.5 px-3 text-center">İşlem</th>
                  </tr>
                </thead>
               <tbody className="divide-y divide-slate-100 bg-white">
                  {(() => {
                    const ledger = buildSubcontractorLedger(selectedSubcontractorForDetail);
                    if (ledger.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-400 italic">Bu taşerona ait kayıt bulunamadı.</td>
                        </tr>
                      );
                    }
                    return ledger.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 text-slate-500">{tx.date ? formatDateTR(tx.date) : '-'}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-700">{tx.type}</td>
                        <td className="py-2.5 px-3 text-slate-600">{tx.desc}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">{tx.debit ? tx.debit.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺' : '—'}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-amber-700">{tx.credit ? tx.credit.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺' : '—'}</td>
                        <td className={`py-2.5 px-3 text-right font-black ${tx.balance >= 0 ? 'text-blue-900' : 'text-rose-700'}`}>{tx.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                        <td className="py-2.5 px-3 text-center">
                          {tx.isManual ? (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm('Bu hareketi silmek istediğinize emin misiniz?')) return;
                                try {
                                  const { error } = await supabase.from('subcontractor_ledger').delete().eq('id', tx.rawId);
                                  if (error) throw error;
                                  alert('Hareket silindi.');
                                  await loadPortalData();
                                } catch (err: any) { alert('Silme hatası: ' + err.message); }
                              }}
                              className="text-red-500 hover:text-red-700 font-bold px-2 py-1 rounded bg-red-50 hover:bg-red-100 transition">
                              Sil
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs">Otomatik</span>
                      )}
                    </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )}
  </main>
</div>
  );
} 
