import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen,
  Plus,
  Search,
  HandCoins,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  CreditCard,
  CheckCircle2,
  Phone,
  MessageSquare,
  Printer,
  Trash2,
  X,
  FileText,
  Clock,
  Sparkles,
  AlertCircle
} from 'lucide-react';

export function KhataPage() {
  const { lang, user, activeBranchId } = useAuth();
  const isUrdu = lang === 'ur';

  const [accounts, setAccounts] = useState([]);
  const [summary, setSummary] = useState({
    total_payable: 0,
    total_receivable: 0,
    net_balance: 0,
    active_accounts: 0,
    settled_accounts: 0
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'payable', 'receivable', 'settled'

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountEntries, setAccountEntries] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // New Account Form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState('payable'); // 'payable' or 'receivable'
  const [openingBalance, setOpeningBalance] = useState('');
  const [accountNotes, setAccountNotes] = useState('');

  // Payment / Installment Form
  const [entryType, setEntryType] = useState('payment'); // 'payment' (paid installment) or 'addition' (more borrowed/lent)
  const [entryAmount, setEntryAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [referenceNo, setReferenceNo] = useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load Accounts
  const loadAccounts = async () => {
    setLoading(true);
    try {
      let url = `/api/khata?search=${encodeURIComponent(search)}`;
      if (activeTab === 'payable' || activeTab === 'receivable') {
        url += `&type=${activeTab}&status=active`;
      } else if (activeTab === 'settled') {
        url += `&status=settled`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sawera_token')}` }
      });
      if (res.ok) {
        const d = await res.json();
        setAccounts(d.accounts || []);
        if (d.summary) setSummary(d.summary);
      }
    } catch (err) {
      console.error('Error fetching khata:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [search, activeTab]);

  // Open Record Installment Modal
  const openAddEntryModal = (acc) => {
    setSelectedAccount(acc);
    setEntryType('payment');
    setEntryAmount('');
    setPaymentMethod('cash');
    setEntryDate(new Date().toISOString().split('T')[0]);
    setReferenceNo('');
    setEntryNotes('');
    setShowEntryModal(true);
  };

  // Open Full Ledger Statement Modal
  const openLedgerModal = async (acc) => {
    setSelectedAccount(acc);
    setShowLedgerModal(true);
    setLedgerLoading(true);
    try {
      const res = await fetch(`/api/khata/${acc.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sawera_token')}` }
      });
      if (res.ok) {
        const d = await res.json();
        setSelectedAccount(d.account);
        setAccountEntries(d.entries || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLedgerLoading(false);
    }
  };

  // Submit New Khata Account
  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!name.trim()) return alert(isUrdu ? 'برائے مہربانی نام درج کریں' : 'Please enter person/account name');

    setSubmitting(true);
    try {
      const res = await fetch('/api/khata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sawera_token')}`
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          type,
          opening_balance: Number(openingBalance) || 0,
          notes: accountNotes.trim(),
          branch_id: activeBranchId
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to create account');

      alert(isUrdu ? 'نیا کھاتہ کامیابی سے بن گیا ہے' : 'Khata account created successfully!');
      setShowAddModal(false);
      setName('');
      setPhone('');
      setOpeningBalance('');
      setAccountNotes('');
      loadAccounts();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Installment / Payment
  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!entryAmount || Number(entryAmount) <= 0) {
      return alert(isUrdu ? 'درست رقم درج کریں' : 'Please enter a valid amount');
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/khata/${selectedAccount.id}/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sawera_token')}`
        },
        body: JSON.stringify({
          entry_type: entryType,
          amount: Number(entryAmount),
          payment_method: paymentMethod,
          reference_no: referenceNo,
          notes: entryNotes,
          entry_date: entryDate
        })
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to save entry');

      alert(isUrdu ? 'قسط / ادائیگی کا اندراج کامیابی سے ہو گیا ہے' : 'Payment recorded successfully!');
      setShowEntryModal(false);
      loadAccounts();
      if (showLedgerModal && selectedAccount?.id) {
        openLedgerModal(selectedAccount);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Entry inside ledger
  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm(isUrdu ? 'کیا آپ واقعی اس اندراج کو ڈیلیٹ کرنا چاہتے ہیں؟' : 'Are you sure you want to delete this entry?')) return;
    try {
      const res = await fetch(`/api/khata/${selectedAccount.id}/entries/${entryId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('sawera_token')}` }
      });
      if (res.ok) {
        openLedgerModal(selectedAccount);
        loadAccounts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Entire Khata Account
  const handleDeleteAccount = async (acc) => {
    if (!window.confirm(isUrdu ? `کیا آپ واقعی "${acc.name}" کا پورا کھاتہ اور تمام تاریخ ڈیلیٹ کرنا چاہتے ہیں؟` : `Delete account for "${acc.name}"?`)) return;
    try {
      const res = await fetch(`/api/khata/${acc.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('sawera_token')}` }
      });
      if (res.ok) {
        loadAccounts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // WhatsApp Statement share
  const shareViaWhatsApp = (acc, entries) => {
    if (!acc.phone) return alert(isUrdu ? 'فون نمبر موجود نہیں ہے' : 'No phone number available');
    let phoneNum = acc.phone.replace(/[^0-9]/g, '');
    if (phoneNum.startsWith('0')) phoneNum = '92' + phoneNum.substring(1);

    const isPayable = acc.type === 'payable';
    let text = `*سویرا سویٹ اینڈ بیکرز — کھاتہ تفصیل*\n`;
    text += `نام: ${acc.name}\n`;
    text += `حیثیت: ${isPayable ? 'واجب الادا (پیسے دینے ہیں)' : 'واجب الوصول (پیسے لینے ہیں)'}\n`;
    text += `ابتدائی رقم: Rs. ${Number(acc.opening_balance).toLocaleString()}\n`;
    text += `${isPayable ? 'کل ادا شدہ اقساط' : 'کل وصول شدہ اقساط'}: Rs. ${Number(isPayable ? acc.total_paid : acc.total_received).toLocaleString()}\n`;
    text += `*بقایا واجب الادا/وصول*: *Rs. ${Number(acc.current_balance).toLocaleString()}*\n\n`;
    text += `شکریہ!\nسویرا سویٹس اینڈ بیکرز`;

    window.open(`https://wa.me/${phoneNum}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Print Statement Window
  const printStatement = (acc, entries) => {
    const isPayable = acc.type === 'payable';
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('Popups blocked. Please allow popups to print.');

    const html = `
      <!DOCTYPE html>
      <html dir="${isUrdu ? 'rtl' : 'ltr'}">
      <head>
        <title>Khata Statement - ${acc.name}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #1e293b; }
          .header { text-align: center; border-bottom: 2px dashed #94a3b8; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 20px; font-weight: bold; margin: 0; color: #0f172a; }
          .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
          .info-grid { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 13px; }
          .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 16px; }
          .balance { font-size: 18px; font-weight: bold; color: ${isPayable ? '#dc2626' : '#16a34a'}; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: ${isUrdu ? 'right' : 'left'}; }
          th { background: #f1f5f9; font-weight: 600; }
          .footer { text-align: center; font-size: 11px; color: #64748b; margin-top: 24px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">سویرا سویٹس اینڈ بیکرز</h1>
          <p class="subtitle">Sawera Sweet &amp; Bakers — باضابطہ کھاتہ تفصیل (Ledger Statement)</p>
        </div>

        <div class="info-grid">
          <div>
            <strong>نام کھاتہ دار:</strong> ${acc.name}<br/>
            <strong>فون:</strong> ${acc.phone || '-'}<br/>
            <strong>کھاتہ کی قسم:</strong> ${isPayable ? '🔴 پیسے دینے ہیں (واجب الادا)' : '🟢 پیسے لینے ہیں (واجب الوصول)'}
          </div>
          <div style="text-align: ${isUrdu ? 'left' : 'right'};">
            <strong>تاریخ:</strong> ${new Date().toLocaleDateString()}<br/>
            <strong>کھاتہ اسٹیٹس:</strong> ${acc.status === 'settled' ? 'بے باق (Settled)' : 'فعال (Active)'}
          </div>
        </div>

        <div class="box">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span>ابتدائی رقم: Rs. ${Number(acc.opening_balance).toLocaleString()}</span> | 
              <span>${isPayable ? 'کل ادائیگی' : 'کل وصولی'}: Rs. ${Number(isPayable ? acc.total_paid : acc.total_received).toLocaleString()}</span>
            </div>
            <div class="balance">
              بقایا رقم: Rs. ${Number(acc.current_balance).toLocaleString()}
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>تاریخ</th>
              <th>تفصیل / نوعیت</th>
              <th>طریقہ کار</th>
              <th>رقم (Amount)</th>
              <th>بقایا بیلنس</th>
              <th>نوٹس / تفصیل</th>
            </tr>
          </thead>
          <tbody>
            ${entries.map(e => `
              <tr>
                <td>${e.entry_date || '-'}</td>
                <td>
                  ${e.entry_type === 'opening' ? 'ابتدائی بیلنس' : (
                    e.entry_type === 'payment' ? (isPayable ? 'ادائیگی کی (قسط دی)' : 'وصولی ہوئی (قسط وصول)') :
                    (isPayable ? 'مزید قرضہ لیا' : 'مزید ادھار دیا')
                  )}
                </td>
                <td>${e.payment_method || 'cash'}</td>
                <td style="font-weight: bold;">Rs. ${Number(e.amount).toLocaleString()}</td>
                <td style="font-weight: bold; color: #0284c7;">Rs. ${Number(e.balance_after).toLocaleString()}</td>
                <td>${e.notes || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>کمپیوٹرائزڈ کھاتہ سٹیٹمنٹ — سویرا سویٹ اینڈ بیکرز</p>
        </div>

        <script>
          window.print();
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Header & New Account Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {isUrdu ? 'لین دین و ادھار کھاتہ رجسٹر' : 'Khata & Installments Ledger'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {isUrdu ? 'جن کے پیسے دینے ہیں یا جن سے رقم لینی ہے، اقساط اور ادائیگیوں کا مکمل حساب کتاب' : 'Manage payables, receivables, installment payments and live ledger history'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => {
            setType('payable');
            setName('');
            setPhone('');
            setOpeningBalance('');
            setAccountNotes('');
            setShowAddModal(true);
          }}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-md transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{isUrdu ? 'نیا کھاتہ بنائیں (شخص / ادارہ)' : 'Add New Khata Account'}</span>
        </button>
      </div>

      {/* SUMMARY STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Payable Card (پیسے دینے ہیں) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-amber-500 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isUrdu ? 'پیسے دینے ہیں (واجب الادا)' : 'Total Payable (دینے ہیں)'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-rose-600 tracking-tight">
              Rs. {Number(summary.total_payable || 0).toLocaleString()}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              {isUrdu ? 'جو رقم آپ نے واپس کرنی ہے' : 'Outstanding debt to return'}
            </p>
          </div>
          <div className="absolute -bottom-1 -right-1 w-16 h-16 bg-rose-50 rounded-full -z-0 opacity-40 pointer-events-none" />
        </div>

        {/* Receivable Card (پیسے لینے ہیں) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-emerald-500 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isUrdu ? 'پیسے لینے ہیں (واجب الوصول)' : 'Total Receivable (لینے ہیں)'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-emerald-700 tracking-tight">
              Rs. {Number(summary.total_receivable || 0).toLocaleString()}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              {isUrdu ? 'جو رقم آپ نے لوگوں سے لینی ہے' : 'Money you have to collect'}
            </p>
          </div>
          <div className="absolute -bottom-1 -right-1 w-16 h-16 bg-emerald-50 rounded-full -z-0 opacity-40 pointer-events-none" />
        </div>

        {/* Net Balance Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isUrdu ? 'خالص فرق (Net Position)' : 'Net Ledger Balance'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <HandCoins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className={`text-2xl font-black tracking-tight ${summary.net_balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              Rs. {Number(Math.abs(summary.net_balance || 0)).toLocaleString()}
              <span className="text-xs font-bold mr-1">
                {summary.net_balance >= 0 ? (isUrdu ? ' (اضافی لینا ہے)' : ' (Surplus)') : (isUrdu ? ' (زیادہ دینا ہے)' : ' (Deficit)')}
              </span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              {isUrdu ? 'لینے اور دینے کا بیلنس' : 'Difference between Lena & Dena'}
            </p>
          </div>
        </div>

        {/* Active Accounts Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isUrdu ? 'کل فعال کھاتے' : 'Active Accounts'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {summary.active_accounts || 0}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              {summary.settled_accounts || 0} {isUrdu ? 'بے باق کھاتے' : 'settled accounts'}
            </p>
          </div>
        </div>

      </div>

      {/* FILTER TABS & SEARCH BAR */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        
        {/* Filter Pills */}
        <div className="flex items-center flex-wrap gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold w-full md:w-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {isUrdu ? 'تمام کھاتے' : 'All Accounts'}
          </button>
          <button
            onClick={() => setActiveTab('payable')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${activeTab === 'payable' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-300" />
            <span>{isUrdu ? '🔴 پیسے دینے ہیں (Payables)' : 'Payables (Dena)'}</span>
          </button>
          <button
            onClick={() => setActiveTab('receivable')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${activeTab === 'receivable' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-300" />
            <span>{isUrdu ? '🟢 پیسے لینے ہیں (Receivables)' : 'Receivables (Lena)'}</span>
          </button>
          <button
            onClick={() => setActiveTab('settled')}
            className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'settled' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {isUrdu ? '✅ بے باق کھاتے (Settled)' : 'Settled'}
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isUrdu ? 'نام، فون یا تفصیل سے تلاش کریں...' : 'Search by name, phone or note...'}
            className="w-full pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rtl:right-auto rtl:left-3 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </div>

      {/* ACCOUNTS LISTING */}
      {loading ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-bold">{isUrdu ? 'کھاتے لوڈ ہو رہے ہیں...' : 'Loading accounts...'}</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="font-bold text-slate-800 text-base">{isUrdu ? 'کوئی کھاتہ موجود نہیں' : 'No Khata Accounts Found'}</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {isUrdu
              ? 'نیا کھاتہ بنانے کے لیے اوپر موجود "+ نیا کھاتہ بنائیں" کے بٹن پر کلک کریں۔'
              : 'Click the button above to add your first khata account.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => {
            const isPayable = acc.type === 'payable';
            const totalCleared = isPayable ? acc.total_paid : acc.total_received;
            const progress = acc.opening_balance > 0 ? Math.min(100, Math.round((totalCleared / acc.opening_balance) * 100)) : 0;

            return (
              <div
                key={acc.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  {/* Card Header: Type Badge & Status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full ${
                        isPayable ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {isPayable ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                      <span>{isPayable ? (isUrdu ? 'پیسے دینے ہیں (Payable)' : 'Payable (Dena)') : (isUrdu ? 'پیسے لینے ہیں (Receivable)' : 'Receivable (Lena)')}</span>
                    </span>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        acc.status === 'settled'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {acc.status === 'settled' ? (isUrdu ? 'بے باق (Settled)' : 'Settled') : (isUrdu ? 'فعال (Active)' : 'Active')}
                    </span>
                  </div>

                  {/* Account Person Name & Phone */}
                  <div className="mb-3">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight leading-snug">
                      {acc.name}
                    </h3>
                    {acc.phone && (
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{acc.phone}</span>
                      </div>
                    )}
                    {acc.notes && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1 italic bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                        {acc.notes}
                      </p>
                    )}
                  </div>

                  {/* Balance Display Box */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 mb-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                      <span>{isUrdu ? 'ابتدائی قرضہ / رقم' : 'Original Amount'}:</span>
                      <span className="font-bold">Rs. {Number(acc.opening_balance || 0).toLocaleString()}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                      <span>{isPayable ? (isUrdu ? 'کل ادا شدہ اقساط' : 'Total Paid') : (isUrdu ? 'کل وصول شدہ اقساط' : 'Total Received')}:</span>
                      <span className="font-bold text-emerald-600">Rs. {Number(totalCleared || 0).toLocaleString()}</span>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900">
                        {isUrdu ? 'بقایا واجب الادا رقم' : 'Remaining Balance'}:
                      </span>
                      <span className={`text-base font-black ${isPayable ? 'text-rose-600' : 'text-emerald-700'}`}>
                        Rs. {Number(acc.current_balance || 0).toLocaleString()}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                      <div
                        className={`h-full ${isPayable ? 'bg-amber-500' : 'bg-emerald-500'} transition-all duration-300`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 text-right rtl:text-left font-bold">
                      {progress}% {isUrdu ? 'بے باق شدہ' : 'cleared'}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  {/* Add Payment / Installment Button */}
                  <button
                    onClick={() => openAddEntryModal(acc)}
                    className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-3 rounded-xl text-xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      {isPayable
                        ? (isUrdu ? 'ادائیگی / قسط کا اندراج' : 'Record Payment / Installment')
                        : (isUrdu ? 'وصولی / قسط کا اندراج' : 'Record Received Installment')}
                    </span>
                  </button>

                  {/* Secondary Buttons Row */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openLedgerModal(acc)}
                      className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-1.5 px-2.5 rounded-lg text-[11px] transition cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>{isUrdu ? 'کھاتہ لیجر' : 'Statement'}</span>
                    </button>

                    <button
                      onClick={() => handleDeleteAccount(acc)}
                      className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 font-bold py-1.5 px-2.5 rounded-lg text-[11px] transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>{isUrdu ? 'ڈیلیٹ' : 'Delete'}</span>
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. ADD NEW KHATA ACCOUNT MODAL */}
      {/* ======================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg">
                    {isUrdu ? 'نیا کھاتہ بنائیں' : 'Create New Khata Account'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isUrdu ? 'قرضہ دینے یا لینے والے شخص یا ادارے کا اندراج' : 'Register loan / borrowing person or company'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-5 sm:p-6 space-y-4">
              
              {/* Account Type Selector (Payable vs Receivable) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {isUrdu ? 'کھاتہ کی نوعیت منتخب کریں' : 'Select Khata Type'} *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType('payable')}
                    className={`p-3 rounded-xl border text-xs sm:text-sm font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                      type === 'payable'
                        ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowDownLeft className="w-5 h-5 text-rose-600" />
                    <span>{isUrdu ? '🔴 پیسے دینے ہیں (Payable)' : 'Payable (I Owe Money)'}</span>
                    <span className="text-[10px] font-medium text-slate-500">
                      {isUrdu ? 'میں نے رقم ادا کرنی ہے' : 'Borrowed / Debt to return'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('receivable')}
                    className={`p-3 rounded-xl border text-xs sm:text-sm font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                      type === 'receivable'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                    <span>{isUrdu ? '🟢 پیسے لینے ہیں (Receivable)' : 'Receivable (They Owe Me)'}</span>
                    <span className="text-[10px] font-medium text-slate-500">
                      {isUrdu ? 'میں نے رقم وصول کرنی ہے' : 'Loaned / Money to collect'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Name Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {isUrdu ? 'شخص / ادارے کا نام' : 'Person / Account Name'} *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isUrdu ? 'مثلاً: حاجی اسلم صاحب / ندیم بھائی' : 'e.g., Haji Aslam / Nadeem Bhai'}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                />
              </div>

              {/* Phone Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {isUrdu ? 'موبائل / فون نمبر' : 'Phone / WhatsApp'}
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="03001234567"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>

              {/* Opening / Initial Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {type === 'payable'
                    ? (isUrdu ? 'کل رقم جو دینی ہے (ابتدائی قرضہ)' : 'Total Amount to Pay (Initial Debt)')
                    : (isUrdu ? 'کل رقم جو لینی ہے (ابتدائی قرضہ)' : 'Total Amount to Receive (Initial Loan)')} *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3 text-xs font-black text-slate-400">
                    Rs.
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    placeholder="500000"
                    className="w-full pl-10 pr-3 rtl:pl-3 rtl:pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {isUrdu
                    ? 'مثال کے طور پر 500,000 یا 1,000,000'
                    : 'e.g. 500,000 or 1,000,000'}
                </p>
              </div>

              {/* Notes Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {isUrdu ? 'تفصیل یا وجہ (اختیاری)' : 'Notes / Remarks (Optional)'}
                </label>
                <textarea
                  rows={2}
                  value={accountNotes}
                  onChange={(e) => setAccountNotes(e.target.value)}
                  placeholder={isUrdu ? 'مثلاً: مشین خریدنے کا قرضہ / ذاتی ادھار' : 'e.g., Equipment loan / advance'}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl transition"
                >
                  {isUrdu ? 'منسوخ کریں' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (isUrdu ? 'محفوظ ہو رہا ہے...' : 'Saving...') : (isUrdu ? 'کھاتہ محفوظ کریں' : 'Save Account')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. RECORD PAYMENT / INSTALLMENT MODAL */}
      {/* ======================================================== */}
      {showEntryModal && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 sm:p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-base sm:text-lg flex items-center gap-2">
                  <HandCoins className="w-5 h-5 text-amber-400" />
                  <span>
                    {selectedAccount.type === 'payable'
                      ? (isUrdu ? 'ادائیگی / قسط کا اندراج' : 'Record Payment (Dena)')
                      : (isUrdu ? 'وصولی / قسط کا اندراج' : 'Record Received (Lena)')}
                  </span>
                </h3>
                <p className="text-xs text-amber-300 font-bold mt-0.5">
                  {selectedAccount.name}
                </p>
              </div>
              <button
                onClick={() => setShowEntryModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="p-5 space-y-4">
              
              {/* Current Balance Banner */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">
                  {isUrdu ? 'موجودہ بقایا رقم' : 'Current Balance'}:
                </span>
                <span className="text-sm font-black text-slate-900">
                  Rs. {Number(selectedAccount.current_balance || 0).toLocaleString()}
                </span>
              </div>

              {/* Entry Action Type: Payment vs Addition */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {isUrdu ? 'اندراج کی قسم' : 'Entry Type'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEntryType('payment')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      entryType === 'payment'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-400 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {selectedAccount.type === 'payable'
                      ? (isUrdu ? 'ادائیگی کی (قسط دی)' : 'Paid Installment')
                      : (isUrdu ? 'وصولی ہوئی (قسط لی)' : 'Received Installment')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setEntryType('addition')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      entryType === 'addition'
                        ? 'bg-amber-50 text-amber-800 border-amber-400 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {selectedAccount.type === 'payable'
                      ? (isUrdu ? 'مزید رقم لی (قرضہ بڑھا)' : 'Borrowed More')
                      : (isUrdu ? 'مزید ادھار دیا' : 'Lent More')}
                  </button>
                </div>
              </div>

              {/* Amount Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {isUrdu ? 'رقم درج کریں (Amount)' : 'Amount'} *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3 text-xs font-black text-slate-400">
                    Rs.
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={entryAmount}
                    onChange={(e) => setEntryAmount(e.target.value)}
                    placeholder="مثلاً: 5000 یا 7000"
                    className="w-full pl-10 pr-3 rtl:pl-3 rtl:pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Live Preview of Remaining Balance */}
                {entryAmount && Number(entryAmount) > 0 && (
                  <div className="mt-2 text-xs font-bold text-slate-600 flex items-center justify-between bg-amber-50/50 p-2 rounded-lg border border-amber-200/50">
                    <span>{isUrdu ? 'اس اندراج کے بعد بقایا بیلنس:' : 'New Balance After Entry:'}</span>
                    <span className="text-amber-900 font-black">
                      Rs.{' '}
                      {entryType === 'payment'
                        ? Math.max(0, selectedAccount.current_balance - Number(entryAmount)).toLocaleString()
                        : (selectedAccount.current_balance + Number(entryAmount)).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Date & Payment Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {isUrdu ? 'تاریخ' : 'Date'}
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {isUrdu ? 'طریقہ کار' : 'Method'}
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="cash">{isUrdu ? 'نقد (Cash)' : 'Cash'}</option>
                    <option value="bank">{isUrdu ? 'بینک ٹرانسفر' : 'Bank Transfer'}</option>
                    <option value="jazzcash">JazzCash</option>
                    <option value="easypaisa">EasyPaisa</option>
                    <option value="cheque">{isUrdu ? 'چیک (Cheque)' : 'Cheque'}</option>
                  </select>
                </div>
              </div>

              {/* Notes Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {isUrdu ? 'تفصیل یا ریمارکس' : 'Notes / Remarks'}
                </label>
                <input
                  type="text"
                  value={entryNotes}
                  onChange={(e) => setEntryNotes(e.target.value)}
                  placeholder={isUrdu ? 'مثلاً: 2 دن بعد دئیے، بینک رسید نمبر...' : 'e.g. Paid in cash, receipt #123'}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEntryModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl transition"
                >
                  {isUrdu ? 'منسوخ کریں' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (isUrdu ? 'اندراج ہو رہا ہے...' : 'Saving...') : (isUrdu ? 'اندراج مکمل کریں' : 'Record Entry')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. FULL LEDGER STATEMENT MODAL */}
      {/* ======================================================== */}
      {showLedgerModal && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-base sm:text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  <span>{selectedAccount.name} — {isUrdu ? 'مکمل کھاتہ تفصیل (لیجر)' : 'Full Ledger Statement'}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedAccount.phone ? `فون: ${selectedAccount.phone} | ` : ''}
                  {selectedAccount.type === 'payable' ? (isUrdu ? '🔴 پیسے دینے ہیں' : 'Payable') : (isUrdu ? '🟢 پیسے لینے ہیں' : 'Receivable')}
                </p>
              </div>

              {/* Top Action Buttons: Print, WhatsApp, Close */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => shareViaWhatsApp(selectedAccount, accountEntries)}
                  title="WhatsApp"
                  className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </button>

                <button
                  onClick={() => printStatement(selectedAccount, accountEntries)}
                  title="Print"
                  className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">{isUrdu ? 'پرنٹ' : 'Print'}</span>
                </button>

                <button
                  onClick={() => setShowLedgerModal(false)}
                  className="text-slate-400 hover:text-white p-2 rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Balance Header */}
            <div className="bg-slate-50 p-4 border-b border-slate-200 grid grid-cols-3 gap-3 text-center text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold">{isUrdu ? 'ابتدائی رقم' : 'Opening Amount'}:</span>
                <p className="text-sm font-black text-slate-800">Rs. {Number(selectedAccount.opening_balance || 0).toLocaleString()}</p>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold">{selectedAccount.type === 'payable' ? (isUrdu ? 'کل ادائیگی' : 'Total Paid') : (isUrdu ? 'کل وصولی' : 'Total Received')}:</span>
                <p className="text-sm font-black text-emerald-600">
                  Rs. {Number(selectedAccount.type === 'payable' ? selectedAccount.total_paid : selectedAccount.total_received).toLocaleString()}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold">{isUrdu ? 'بقایا بیلنس' : 'Remaining Balance'}:</span>
                <p className={`text-base font-black ${selectedAccount.type === 'payable' ? 'text-rose-600' : 'text-emerald-700'}`}>
                  Rs. {Number(selectedAccount.current_balance || 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Entries Table */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {ledgerLoading ? (
                <div className="py-12 text-center text-xs text-slate-400 font-bold">
                  {isUrdu ? 'تفصیلات لوڈ ہو رہی ہیں...' : 'Loading entries...'}
                </div>
              ) : accountEntries.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 font-bold">
                  {isUrdu ? 'ابھی تک کوئی اندراج نہیں ہوا' : 'No transactions recorded yet'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left rtl:text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase text-[10px] font-bold">
                        <th className="p-2.5">{isUrdu ? 'تاریخ' : 'Date'}</th>
                        <th className="p-2.5">{isUrdu ? 'نوعیت / تفصیل' : 'Type'}</th>
                        <th className="p-2.5">{isUrdu ? 'طریقہ کار' : 'Method'}</th>
                        <th className="p-2.5">{isUrdu ? 'رقم' : 'Amount'}</th>
                        <th className="p-2.5">{isUrdu ? 'بقایا بیلنس' : 'Balance'}</th>
                        <th className="p-2.5">{isUrdu ? 'نوٹس' : 'Notes'}</th>
                        <th className="p-2.5 text-center">{isUrdu ? 'ایکشن' : 'Action'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {accountEntries.map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-semibold text-slate-600 whitespace-nowrap">
                            {e.entry_date || '-'}
                          </td>
                          <td className="p-2.5">
                            {e.entry_type === 'opening' ? (
                              <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded text-[11px]">
                                {isUrdu ? 'ابتدائی بیلنس' : 'Opening Balance'}
                              </span>
                            ) : e.entry_type === 'payment' ? (
                              <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded text-[11px]">
                                {selectedAccount.type === 'payable'
                                  ? (isUrdu ? 'ادائیگی کی (قسط)' : 'Paid Installment')
                                  : (isUrdu ? 'وصولی ہوئی' : 'Received')}
                              </span>
                            ) : (
                              <span className="bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded text-[11px]">
                                {selectedAccount.type === 'payable'
                                  ? (isUrdu ? 'مزید قرضہ لیا' : 'Borrowed More')
                                  : (isUrdu ? 'مزید دیا' : 'Lent More')}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-slate-600 capitalize">{e.payment_method || 'cash'}</td>
                          <td className="p-2.5 font-black text-slate-900">
                            Rs. {Number(e.amount).toLocaleString()}
                          </td>
                          <td className="p-2.5 font-black text-blue-700">
                            Rs. {Number(e.balance_after).toLocaleString()}
                          </td>
                          <td className="p-2.5 text-slate-500 max-w-xs truncate">{e.notes || '-'}</td>
                          <td className="p-2.5 text-center">
                            {e.entry_type !== 'opening' && (
                              <button
                                onClick={() => handleDeleteEntry(e.id)}
                                title="Delete this entry"
                                className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowLedgerModal(false);
                  openAddEntryModal(selectedAccount);
                }}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>{isUrdu ? 'نئی قسط / ادائیگی درج کریں' : 'Add Installment / Payment'}</span>
              </button>

              <button
                onClick={() => setShowLedgerModal(false)}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 px-4 py-2"
              >
                {isUrdu ? 'بند کریں' : 'Close'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
