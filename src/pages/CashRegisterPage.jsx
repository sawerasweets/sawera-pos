import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  DollarSign,
  TrendingUp,
  Receipt,
  CreditCard,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  Clock,
  History
} from 'lucide-react';

export function CashRegisterPage() {
  const { activeBranchId, user, checkRegister, lang } = useAuth();
  const [registerData, setRegisterData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // Forms
  const [openFloat, setOpenFloat] = useState(10000);
  const [openNotes, setOpenNotes] = useState('Morning shift opening float');

  const [actualCash, setActualCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  const loadRegister = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sawera_token');
      const [curRes, histRes] = await Promise.all([
        fetch(`/api/cash-register/current?branch_id=${activeBranchId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/cash-register/history?branch_id=${activeBranchId}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (curRes.ok) {
        const d = await curRes.json();
        setRegisterData(d);
      }
      if (histRes.ok) {
        const d = await histRes.json();
        setHistory(d.history || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRegister();
  }, [activeBranchId]);

  const handleOpenRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/cash-register/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sawera_token')}`
        },
        body: JSON.stringify({
          branch_id: activeBranchId,
          opening_cash: parseFloat(openFloat) || 0,
          notes: openNotes
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      alert('Cash register shift opened!');
      checkRegister();
      loadRegister();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleCloseRegister = async (e) => {
    e.preventDefault();
    if (actualCash === '') {
      alert('Please count and enter actual physical cash in the drawer.');
      return;
    }

    try {
      const res = await fetch('/api/cash-register/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sawera_token')}`
        },
        body: JSON.stringify({
          branch_id: activeBranchId,
          actual_cash: parseFloat(actualCash),
          notes: closeNotes
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      alert(`Register Closed! Expected: Rs. ${d.summary.expected_cash}, Counted: Rs. ${d.summary.actual_cash}, Variance: Rs. ${d.summary.difference}`);
      checkRegister();
      setActualCash('');
      loadRegister();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const reg = registerData?.register;
  const isOpen = registerData?.open;

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>{lang === 'ur' ? 'کیش رجسٹر و دراز مینجمنٹ' : 'Cash Register & Shift Drawer'}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
              isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {isOpen ? 'Shift Open' : 'Shift Closed'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Opening cash float, shift collections, drawer expenses, and closing variance audit
          </p>
        </div>
      </div>

      {/* ACTIVE SHIFT SUMMARY OR OPENING PROMPT */}
      {isOpen && reg ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left 2 Cols: Live Shift Telemetry */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b pb-3 border-slate-100">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase">Cashier on Duty</span>
                  <p className="font-extrabold text-base text-slate-900">{reg.user_name}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-400 uppercase">Shift Opened At</span>
                  <p className="font-semibold text-xs text-slate-700">{new Date(reg.opened_at).toLocaleString()}</p>
                </div>
              </div>

              {/* Cash Ledger Flow */}
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-700">1. Opening Cash Float:</span>
                  <span className="font-mono font-black text-slate-900">Rs. {Number(reg.opening_cash).toLocaleString()}</span>
                </div>

                <div className="flex justify-between p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900">
                  <span className="font-bold">+ 2. Cash POS Sales:</span>
                  <span className="font-mono font-black text-emerald-800">+ Rs. {Number(reg.cash_sales).toLocaleString()}</span>
                </div>

                <div className="flex justify-between p-3 rounded-xl bg-cyan-50/70 border border-cyan-200 text-cyan-900">
                  <span className="font-bold">+ 3. Customer Udhaar Payments Received:</span>
                  <span className="font-mono font-black text-cyan-800">+ Rs. {Number(reg.cash_udhaar_received).toLocaleString()}</span>
                </div>

                <div className="flex justify-between p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-rose-900">
                  <span className="font-bold">- 4. Cash Expenses Paid from Drawer:</span>
                  <span className="font-mono font-black text-rose-800">- Rs. {Number(reg.cash_expenses).toLocaleString()}</span>
                </div>

                <div className="flex justify-between p-3 rounded-xl bg-orange-50/70 border border-orange-200 text-orange-900">
                  <span className="font-bold">- 5. Cash Sales Refunds Issued:</span>
                  <span className="font-mono font-black text-orange-800">- Rs. {Number(reg.cash_refunds).toLocaleString()}</span>
                </div>

                {/* Expected Cash in Hand */}
                <div className="flex justify-between p-4 rounded-xl bg-amber-50 border-2 border-amber-400 text-amber-950 text-sm">
                  <span className="font-black">= EXPECTED CASH IN DRAWER:</span>
                  <span className="font-mono font-black text-lg text-amber-800">
                    Rs. {Number(reg.calculated_expected_cash).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Close Shift Drawer Form */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Lock className="w-5 h-5 text-rose-600" />
                <span>Close Cash Drawer Shift</span>
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Count all cash notes and coins in the physical drawer and enter below.
              </p>

              <form onSubmit={handleCloseRegister} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Actual Counted Cash in Drawer (Rs.) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Enter physical cash counted"
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                    className="w-full text-base font-black px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {actualCash !== '' && (
                  <div className={`p-3 rounded-xl border text-xs font-bold ${
                    parseFloat(actualCash) - reg.calculated_expected_cash === 0
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : parseFloat(actualCash) - reg.calculated_expected_cash > 0
                      ? 'bg-blue-50 text-blue-800 border-blue-300'
                      : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}>
                    <div className="flex justify-between">
                      <span>Variance / Discrepancy:</span>
                      <span>
                        {parseFloat(actualCash) - reg.calculated_expected_cash >= 0 ? '+' : ''}
                        Rs. {(parseFloat(actualCash) - reg.calculated_expected_cash).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[10px] font-normal mt-0.5">
                      {parseFloat(actualCash) - reg.calculated_expected_cash === 0
                        ? '✅ Perfect cash count matches expected amount exactly!'
                        : parseFloat(actualCash) - reg.calculated_expected_cash > 0
                        ? 'ℹ️ Surplus cash in drawer.'
                        : '⚠️ Cash shortage detected!'}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Closing Notes / Reason</label>
                  <textarea
                    rows="2"
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                    placeholder="Shift notes, hand-off to next cashier..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl shadow-md transition cursor-pointer"
                >
                  End Shift &amp; Close Register
                </button>
              </form>
            </div>
          </div>

        </div>
      ) : (
        /* REGISTER CLOSED - SHOW OPENING FORM */
        <div className="max-w-md mx-auto bg-white p-8 rounded-2xl border border-slate-200 shadow-md text-center">
          <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Unlock className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Open Shift Cash Register</h3>
          <p className="text-xs text-slate-500 mt-1 mb-6">
            Enter initial opening cash float to begin creating POS sales.
          </p>

          <form onSubmit={handleOpenRegister} className="space-y-4 text-xs text-left">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Opening Cash Float (Rs.)</label>
              <input
                type="number"
                required
                min="0"
                value={openFloat}
                onChange={(e) => setOpenFloat(e.target.value)}
                className="w-full text-base font-black px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Shift Notes</label>
              <input
                type="text"
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-extrabold rounded-xl shadow-md transition cursor-pointer text-sm"
            >
              Open Cash Register
            </button>
          </form>
        </div>
      )}

      {/* SHIFT HISTORY LOG */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 font-bold text-sm text-slate-900 flex items-center gap-2">
          <History className="w-4 h-4 text-amber-600" />
          <span>Past Register Closing History</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold">
                <th className="py-3 px-3">Branch</th>
                <th className="py-3 px-3">Cashier</th>
                <th className="py-3 px-3">Opened At</th>
                <th className="py-3 px-3">Closed At</th>
                <th className="py-3 px-3 text-right">Opening Float</th>
                <th className="py-3 px-3 text-right">Expected Cash</th>
                <th className="py-3 px-3 text-right">Actual Counted</th>
                <th className="py-3 px-3 text-right">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3 font-semibold text-slate-900">{h.branch_name}</td>
                  <td className="py-3 px-3 text-slate-700">{h.user_name}</td>
                  <td className="py-3 px-3 text-slate-500">{new Date(h.opened_at).toLocaleString()}</td>
                  <td className="py-3 px-3 text-slate-500">{h.closed_at ? new Date(h.closed_at).toLocaleString() : 'Active'}</td>
                  <td className="py-3 px-3 text-right font-medium">Rs. {Number(h.opening_cash).toLocaleString()}</td>
                  <td className="py-3 px-3 text-right font-bold text-slate-800">Rs. {Number(h.expected_cash).toLocaleString()}</td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">Rs. {Number(h.actual_cash).toLocaleString()}</td>
                  <td className="py-3 px-3 text-right">
                    <span className={`font-black ${h.difference === 0 ? 'text-emerald-700' : h.difference > 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                      {h.difference > 0 ? '+' : ''}Rs. {Number(h.difference).toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
