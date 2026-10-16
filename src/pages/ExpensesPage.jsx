import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Receipt,
  Plus,
  Search,
  DollarSign,
  Calendar,
  X,
  Trash2,
  PieChart,
  Filter,
  ArrowRight
} from 'lucide-react';

export const EXPENSE_CATEGORIES = [
  { id: 'shop', name: 'Shop Expense', nameUrdu: 'دکان کا خرچہ', icon: '🏬', badge: 'bg-amber-100 text-amber-900 border-amber-200' },
  { id: 'home1', name: 'Home 1 Expense', nameUrdu: 'گھر 1 کا خرچہ', icon: '🏠', badge: 'bg-blue-100 text-blue-900 border-blue-200' },
  { id: 'home2', name: 'Home 2 Expense', nameUrdu: 'گھر 2 کا خرچہ', icon: '🏡', badge: 'bg-indigo-100 text-indigo-900 border-indigo-200' },
  { id: 'personal', name: 'Personal Expense', nameUrdu: 'ذاتی خرچہ', icon: '👤', badge: 'bg-purple-100 text-purple-900 border-purple-200' },
  { id: 'kitchen', name: 'Kitchen & Ration', nameUrdu: 'کچن و راشن', icon: '🍽️', badge: 'bg-emerald-100 text-emerald-900 border-emerald-200' },
  { id: 'utilities', name: 'Utilities & Bills', nameUrdu: 'بجلی و گیس بلز', icon: '💡', badge: 'bg-cyan-100 text-cyan-900 border-cyan-200' },
  { id: 'salaries', name: 'Salaries', nameUrdu: 'ملازمین تنخواہیں', icon: '👥', badge: 'bg-teal-100 text-teal-900 border-teal-200' },
  { id: 'maintenance', name: 'Maintenance & Service', nameUrdu: 'مرمت و سروس', icon: '🔧', badge: 'bg-orange-100 text-orange-900 border-orange-200' },
  { id: 'packaging', name: 'Packaging & Cartons', nameUrdu: 'ڈبے و پیکنگ', icon: '📦', badge: 'bg-stone-100 text-stone-900 border-stone-200' },
  { id: 'transport', name: 'Transport & Fuel', nameUrdu: 'ٹرانسپورٹ و پیٹرول', icon: '🚗', badge: 'bg-sky-100 text-sky-900 border-sky-200' },
  { id: 'other', name: 'Other / Misc', nameUrdu: 'دیگر متفرق', icon: '📌', badge: 'bg-slate-100 text-slate-800 border-slate-200' }
];

export const getCategoryDetails = (catKey) => {
  const key = String(catKey || '').toLowerCase();
  if (key === 'electricity') return { name: 'Electricity Bill', nameUrdu: 'بجلی کا بل', icon: '💡', badge: 'bg-cyan-100 text-cyan-900 border-cyan-200' };
  if (key === 'rent') return { name: 'Shop Rent', nameUrdu: 'دکان کرایہ', icon: '🏬', badge: 'bg-amber-100 text-amber-900 border-amber-200' };
  if (key === 'miscellaneous') return { name: 'Miscellaneous', nameUrdu: 'متفرق', icon: '📌', badge: 'bg-slate-100 text-slate-800 border-slate-200' };
  
  const found = EXPENSE_CATEGORIES.find(c => c.id === key);
  if (found) return found;

  return {
    name: catKey || 'General Expense',
    nameUrdu: catKey || 'عام خرچہ',
    icon: '💸',
    badge: 'bg-slate-100 text-slate-800 border-slate-200'
  };
};

export function ExpensesPage() {
  const { activeBranchId, branches, hasPermission, lang } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('shop');
  const [amount, setAmount] = useState('');
  const [branchId, setBranchId] = useState(activeBranchId || '1');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidTo, setPaidTo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/expenses?branch_id=${activeBranchId}&category=${categoryFilter}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sawera_token')}` }
      });
      if (res.ok) {
        const d = await res.json();
        setExpenses(d.expenses || []);
        setSummary(d.categorySummary || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [activeBranchId, categoryFilter]);

  const openCreateModalWithCategory = (preselectedCategory = null) => {
    const chosen = preselectedCategory || (categoryFilter !== 'all' ? categoryFilter : 'shop');
    setCategory(chosen);
    setTitle('');
    setAmount('');
    setPaidTo('');
    setNotes('');
    setDate(new Date().toISOString().split('T')[0]);
    setShowModal(true);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!title || !amount) return;

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sawera_token')}`
        },
        body: JSON.stringify({
          branch_id: branchId,
          category,
          title,
          amount: parseFloat(amount),
          payment_method: paymentMethod,
          paid_to: paidTo,
          date,
          notes
        })
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to record expense');

      setShowModal(false);
      setTitle(''); setAmount(''); setPaidTo(''); setNotes('');
      loadExpenses();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!confirm(lang === 'ur' ? 'کیا آپ واقعی اس خرچے کو ڈیلیٹ کرنا چاہتے ہیں؟' : 'Are you sure you want to delete this expense record?')) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('sawera_token')}` }
      });
      if (res.ok) {
        loadExpenses();
      }
    } catch (err) {
      alert('Delete failed');
    }
  };

  // Filtered expenses list by search query
  const filteredExpenses = expenses.filter(e => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (e.title && e.title.toLowerCase().includes(q)) ||
      (e.expense_no && e.expense_no.toLowerCase().includes(q)) ||
      (e.paid_to && e.paid_to.toLowerCase().includes(q)) ||
      (e.notes && e.notes.toLowerCase().includes(q)) ||
      (e.category && e.category.toLowerCase().includes(q))
    );
  });

  const totalExpenseAmount = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const activeCategoryMeta = categoryFilter !== 'all' ? getCategoryDetails(categoryFilter) : null;

  return (
    <div className="space-y-5 pb-12">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>{lang === 'ur' ? 'اخراجات کا انتظام' : 'Expenses Management'}</span>
            </h2>
            {categoryFilter !== 'all' && activeCategoryMeta && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-black border flex items-center gap-1 ${activeCategoryMeta.badge}`}>
                <span>{activeCategoryMeta.icon}</span>
                <span>{lang === 'ur' ? activeCategoryMeta.nameUrdu : activeCategoryMeta.name}</span>
              </span>
            )}
            <span className="text-xs bg-rose-100 text-rose-800 font-extrabold px-3 py-1 rounded-full">
              {lang === 'ur' ? 'کل خرچہ: ' : 'Total: '} Rs. {totalExpenseAmount.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {lang === 'ur'
              ? 'دکان، گھر 1، گھر 2، کچن یا ذاتی کیٹیگری منتخب کریں اور آسانی سے اپنے اخراجات ریکارڈ کریں'
              : 'Categorize expenses by Shop, Home 1, Home 2, Kitchen, Utilities or Personal'}
          </p>
        </div>

        {hasPermission('manage_expenses') && (
          <button
            onClick={() => openCreateModalWithCategory()}
            className="flex items-center space-x-2 rtl:space-x-reverse bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>
              {categoryFilter !== 'all' && activeCategoryMeta
                ? (lang === 'ur' ? `+ نیا ${activeCategoryMeta.nameUrdu} شامل کریں` : `+ Add ${activeCategoryMeta.name}`)
                : (lang === 'ur' ? '+ نیا خرچہ شامل کریں' : '+ Record New Expense')}
            </span>
          </button>
        )}
      </div>

      {/* CATEGORY SWITCHER TABS (Shop, Home 1, Home 2, Personal, Kitchen, etc.) */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-amber-600" />
            <span>{lang === 'ur' ? 'کیٹیگری منتخب کریں (Select Category):' : 'Select Category:'}</span>
          </span>
          <span className="text-[11px] text-slate-400 font-medium">
            {lang === 'ur' ? 'کیٹیگری پر کلک کر کے اس کا خرچہ دیکھیں یا شامل کریں' : 'Click to filter or add expenses'}
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {/* ALL Tab */}
          <button
            onClick={() => setCategoryFilter('all')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition cursor-pointer border ${
              categoryFilter === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-400'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
            }`}
          >
            <span>📋</span>
            <span>{lang === 'ur' ? 'تمام اخراجات' : 'All Expenses'}</span>
          </button>

          {/* Individual Category Tabs */}
          {EXPENSE_CATEGORIES.map(cat => {
            const isSelected = categoryFilter === cat.id;
            const catSummary = summary.find(s => s.category === cat.id);
            const catTotal = catSummary ? Number(catSummary.total_amount) : 0;
            const catCount = catSummary ? Number(catSummary.count) : 0;

            return (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition cursor-pointer border ${
                  isSelected
                    ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-300'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <span className="text-sm">{cat.icon}</span>
                <span>{lang === 'ur' ? cat.nameUrdu : cat.name}</span>
                {catTotal > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                    isSelected ? 'bg-amber-800/40 text-amber-100' : 'bg-slate-200 text-slate-700'
                  }`}>
                    Rs. {catTotal.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Quick Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === 'ur' ? 'خرچہ تلاش کریں (نام، نمبر یا تفصیل)...' : 'Search expenses by title, ref or paid to...'}
            className="w-full pl-9 pr-3 rtl:pr-9 rtl:pl-3 py-2 text-xs border border-slate-200 rounded-xl font-semibold bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {categoryFilter !== 'all' && (
            <button
              onClick={() => setCategoryFilter('all')}
              className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1"
            >
              {lang === 'ur' ? '✕ فلٹر ختم کریں' : '✕ Clear Filter'}
            </button>
          )}
          <span className="text-xs font-bold text-slate-500">
            {filteredExpenses.length} {lang === 'ur' ? 'ریکارڈز' : 'Records'}
          </span>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold">
                <th className="py-3.5 px-3">{lang === 'ur' ? 'خرچہ نمبر' : 'Expense Ref'}</th>
                <th className="py-3.5 px-3">{lang === 'ur' ? 'تاریخ' : 'Date'}</th>
                <th className="py-3.5 px-3">{lang === 'ur' ? 'برانچ' : 'Branch'}</th>
                <th className="py-3.5 px-3">{lang === 'ur' ? 'کیٹیگری' : 'Category'}</th>
                <th className="py-3.5 px-3">{lang === 'ur' ? 'تفصیل / عنوان' : 'Description / Title'}</th>
                <th className="py-3.5 px-3">{lang === 'ur' ? 'وصول کنندہ' : 'Paid To'}</th>
                <th className="py-3.5 px-3 text-right">{lang === 'ur' ? 'رقم (روپے)' : 'Amount (PKR)'}</th>
                <th className="py-3.5 px-3 text-center">{lang === 'ur' ? 'طریقہ' : 'Mode'}</th>
                {hasPermission('manage_expenses') && <th className="py-3.5 px-3 text-center">{lang === 'ur' ? 'ایکشن' : 'Action'}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map((e) => {
                const catMeta = getCategoryDetails(e.category);
                return (
                  <tr key={e.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">{e.expense_no}</td>
                    <td className="py-3 px-3 text-slate-500">{e.date}</td>
                    <td className="py-3 px-3 font-semibold text-slate-700">{e.branch_name}</td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] border shadow-2xs ${catMeta.badge}`}>
                        <span>{catMeta.icon}</span>
                        <span>{lang === 'ur' ? catMeta.nameUrdu : catMeta.name}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      <div>{e.title}</div>
                      {e.notes && <div className="text-[10px] text-slate-400 font-normal mt-0.5">{e.notes}</div>}
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium">{e.paid_to || '-'}</td>
                    <td className="py-3 px-3 text-right font-black text-rose-600 text-sm">
                      Rs. {Number(e.amount).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-center uppercase font-bold text-[10px] text-slate-600">
                      <span className="bg-slate-100 px-2 py-0.5 rounded-md">{e.payment_method}</span>
                    </td>
                    {hasPermission('manage_expenses') && (
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleDeleteExpense(e.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}

              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    <Receipt className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-600">
                      {lang === 'ur' ? 'اس کیٹیگری میں کوئی خرچہ ریکارڈ نہیں ہے' : 'No expenses recorded for this filter.'}
                    </p>
                    {hasPermission('manage_expenses') && (
                      <button
                        onClick={() => openCreateModalWithCategory()}
                        className="mt-3 text-xs bg-amber-600 text-white font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-amber-700"
                      >
                        {lang === 'ur' ? '+ ابھی نیا خرچہ درج کریں' : '+ Record Expense Now'}
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD EXPENSE MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-rose-600" />
                <span>{lang === 'ur' ? 'نیا خرچہ ریکارڈ کریں' : 'Record New Expense'}</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ur' ? 'خرچے کی تفصیل / عنوان *' : 'Expense Title / Description *'}
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  placeholder={lang === 'ur' ? 'مثلاً راشن، گھر کا سامان، دکان کی مرمت' : 'e.g. Home 1 Grocery, Shop Repair, Chef Advance'}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {lang === 'ur' ? 'خرچے کی کیٹیگری *' : 'Expense Category *'}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 bg-white"
                  >
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {lang === 'ur' ? cat.nameUrdu : cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">{lang === 'ur' ? 'برانچ' : 'Branch'}</label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{lang === 'ur' && b.name_urdu ? b.name_urdu : b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{lang === 'ur' ? 'رقم (روپے) *' : 'Amount (Rs.) *'}</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-black text-rose-600 text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">{lang === 'ur' ? 'ادائیگی کا ذریعہ' : 'Paid From'}</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="cash">{lang === 'ur' ? 'دراز سے نقد رقم' : 'Cash Drawer'}</option>
                    <option value="bank">{lang === 'ur' ? 'بینک اکاؤنٹ' : 'Bank Account'}</option>
                    <option value="easypaisa">{lang === 'ur' ? 'ایزی پیسہ / جاز کیش' : 'Easypaisa / JazzCash'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{lang === 'ur' ? 'وصول کنندہ (Paid To)' : 'Paid To / Recipient'}</label>
                  <input
                    type="text"
                    value={paidTo}
                    onChange={(e) => setPaidTo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder={lang === 'ur' ? 'مثلاً ڈرائیور، دکاندار' : 'e.g. Landlord, Karigar, Shopkeeper'}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">{lang === 'ur' ? 'تاریخ' : 'Expense Date'}</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{lang === 'ur' ? 'اضافی نوٹس' : 'Notes / Remarks'}</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder={lang === 'ur' ? 'کوئی اضافی تفصیل...' : 'Optional notes...'}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg"
                >
                  {lang === 'ur' ? 'منسوخ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-sm"
                >
                  {lang === 'ur' ? 'خرچہ محفوظ کریں' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
