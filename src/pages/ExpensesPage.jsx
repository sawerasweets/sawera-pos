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
  PieChart
} from 'lucide-react';

export function ExpensesPage() {
  const { activeBranchId, branches, hasPermission, lang } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('electricity');
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
      if (!res.ok) throw new Error(d.error || 'Failed');

      alert('Expense recorded successfully!');
      setShowModal(false);
      setTitle(''); setAmount(''); setPaidTo(''); setNotes('');
      loadExpenses();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return;
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

  const totalExpenseAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-5 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>{lang === 'ur' ? 'روزانہ کے اخراجات' : 'Daily Branch Expenses'}</span>
            <span className="text-xs bg-rose-100 text-rose-800 font-extrabold px-2.5 py-0.5 rounded-full">
              Total: Rs. {totalExpenseAmount.toLocaleString()}
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Log shop electricity bills, advance salaries, packaging cartons, transportation, and maintenance
          </p>
        </div>

        {hasPermission('manage_expenses') && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 rtl:space-x-reverse bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record New Expense</span>
          </button>
        )}
      </div>

      {/* Category Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {summary.slice(0, 5).map((s, idx) => (
          <div key={idx} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-slate-400">{s.category}</span>
            <p className="text-sm font-black text-slate-900 mt-1">Rs. {Number(s.total_amount).toLocaleString()}</p>
            <span className="text-[10px] text-slate-500">{s.count} transactions</span>
          </div>
        ))}
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold">
                <th className="py-3 px-3">Expense Ref</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Branch</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Description / Title</th>
                <th className="py-3 px-3">Paid To</th>
                <th className="py-3 px-3 text-right">Amount (PKR)</th>
                <th className="py-3 px-3 text-center">Mode</th>
                {hasPermission('manage_expenses') && <th className="py-3 px-3 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3 font-mono font-bold text-slate-900">{e.expense_no}</td>
                  <td className="py-3 px-3 text-slate-500">{e.date}</td>
                  <td className="py-3 px-3 font-semibold text-slate-700">{e.branch_name}</td>
                  <td className="py-3 px-3">
                    <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold uppercase text-[10px]">
                      {e.category}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900">
                    <div>{e.title}</div>
                    {e.notes && <div className="text-[10px] text-slate-400 font-normal">{e.notes}</div>}
                  </td>
                  <td className="py-3 px-3 text-slate-600">{e.paid_to || '-'}</td>
                  <td className="py-3 px-3 text-right font-black text-rose-600 text-sm">
                    Rs. {Number(e.amount).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-center uppercase font-bold text-[10px] text-slate-600">
                    {e.payment_method}
                  </td>
                  {hasPermission('manage_expenses') && (
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => handleDeleteExpense(e.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}

              {expenses.length === 0 && (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    No expenses recorded for this filter.
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
                <span>Record New Expense</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Expense Title / Description *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  placeholder="e.g. Monthly Electricity Bill or Chef Advance"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Expense Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="electricity">{lang === 'ur' ? 'بجلی کا بل' : 'Electricity'}</option>
                    <option value="rent">{lang === 'ur' ? 'دکان کا کرایہ' : 'Shop Rent'}</option>
                    <option value="salaries">{lang === 'ur' ? 'ملازمین تنخواہ' : 'Salaries'}</option>
                    <option value="packaging">{lang === 'ur' ? 'ڈبے و پیکنگ' : 'Packaging Boxes'}</option>
                    <option value="transport">{lang === 'ur' ? 'ٹرانسپورٹ' : 'Transport'}</option>
                    <option value="maintenance">{lang === 'ur' ? 'مرمت و سروس' : 'Maintenance'}</option>
                    <option value="marketing">{lang === 'ur' ? 'اشتہارات' : 'Marketing'}</option>
                    <option value="miscellaneous">{lang === 'ur' ? 'متفرق' : 'Miscellaneous'}</option>
                    <option value="other">{lang === 'ur' ? 'دیگر' : 'Other'}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">{lang === 'ur' ? 'برانچ' : 'Branch'}</label>
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
                  <label className="block font-semibold mb-1">{lang === 'ur' ? 'رقم (روپے) *' : 'Amount (Rs.) *'}</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-black text-rose-600 text-sm"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">{lang === 'ur' ? 'ادائیگی کا ذریعہ' : 'Paid From'}</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="cash">{lang === 'ur' ? 'دراز سے نقد رقم' : 'Cash Drawer'}</option>
                    <option value="bank">{lang === 'ur' ? 'بینک اکاؤنٹ' : 'Bank Account'}</option>
                    <option value="easypaisa">{lang === 'ur' ? 'ایزی پیسہ' : 'Easypaisa'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Paid To / Recipient</label>
                  <input
                    type="text"
                    value={paidTo}
                    onChange={(e) => setPaidTo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="e.g. WAPDA, Landlord, Karigar"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Expense Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-sm"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
