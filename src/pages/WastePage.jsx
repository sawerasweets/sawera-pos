import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Trash2,
  AlertTriangle,
  Flame,
  Clock,
  Plus,
  Search,
  DollarSign,
  TrendingDown,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export function WastePage() {
  const { activeBranchId, branches, lang } = useAuth();
  const [wasteLogs, setWasteLogs] = useState([]);
  const [products, setProducts] = useState([]);
  const [totalLoss, setTotalLoss] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(activeBranchId || 1);
  const [reasonFilter, setReasonFilter] = useState('all');

  // Form state
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [wasteQty, setWasteQty] = useState('');
  const [wasteReason, setWasteReason] = useState('burnt');
  const [wasteNotes, setWasteNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    setSelectedBranch(activeBranchId);
  }, [activeBranchId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sawera_token');
      let url = `/api/waste?branch_id=${selectedBranch}&limit=100`;
      if (reasonFilter !== 'all') url += `&reason=${reasonFilter}`;

      const [wasteRes, prodRes] = await Promise.all([
        fetch(url, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/products?branch_id=${selectedBranch}&limit=300`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (wasteRes.ok) {
        const d = await wasteRes.json();
        setWasteLogs(d.waste_logs || []);
        setTotalLoss(d.total_loss || 0);
      }

      if (prodRes.ok) {
        const d = await prodRes.json();
        setProducts(d.products || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedBranch, reasonFilter]);

  // Selected product details for form
  const activeProduct = products.find(p => p.id === Number(selectedProductId));
  const lossEstimate = activeProduct && parseFloat(wasteQty) > 0
    ? (parseFloat(wasteQty) * (activeProduct.purchase_price || 0)).toFixed(0)
    : 0;

  const handleLogWaste = async (e) => {
    e.preventDefault();
    if (!selectedProductId || !wasteQty) return;

    if (activeProduct && parseFloat(wasteQty) > activeProduct.branch_stock) {
      if (!confirm(`Warning: Waste quantity (${wasteQty}) exceeds current available branch stock (${activeProduct.branch_stock} ${activeProduct.unit}). Proceed anyway?`)) {
        return;
      }
    }

    setIsSubmitting(true);
    setNotification(null);

    try {
      const token = localStorage.getItem('sawera_token');
      const res = await fetch('/api/waste', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          branch_id: selectedBranch,
          product_id: Number(selectedProductId),
          quantity: parseFloat(wasteQty),
          reason: wasteReason,
          notes: wasteNotes
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record waste');

      setNotification({
        type: 'success',
        message: `✓ Recorded waste for ${activeProduct?.name}: ${wasteQty} ${activeProduct?.unit}. Loss: Rs. ${data.total_loss?.toLocaleString()}`
      });

      setShowLogModal(false);
      setSelectedProductId('');
      setWasteQty('');
      setWasteNotes('');
      loadData();
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="p-2 bg-rose-100 text-rose-800 rounded-xl">
            <Trash2 className="w-5 h-5 text-rose-700" />
          </span>
          <div>
            <h1 className="text-xl font-black text-slate-900">
              {lang === 'ur' ? 'ضائع و خراب شدہ مال' : 'Waste & Damaged Stock'}
            </h1>
            <p className="text-xs text-slate-500">
              {lang === 'ur'
                ? 'جلی ہوئی مٹھائی، خراب بیکری، یا پیکنگ کے نقصانات کا حساب اور مالیاتی اخراجات کا ریکارڈ'
                : 'Track burnt sweets, expired dairy/bakery, damaged packaging, and calculate business losses'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Branch Selector */}
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(Number(e.target.value))}
            className="text-xs font-bold py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>
                📍 {lang === 'ur' && b.name_urdu ? b.name_urdu : b.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowLogModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'ur' ? 'نقصان درج کریں' : 'Log Waste'}</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between ${
          notification.type === 'error' ? 'bg-rose-50 border border-rose-200 text-rose-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-xs hover:underline">Dismiss</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold">Total Financial Loss</span>
            <h3 className="text-xl font-black text-rose-700">Rs. {Number(totalLoss).toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold">Recorded Incidents</span>
            <h3 className="text-xl font-black text-slate-900">{wasteLogs.length} Events</h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold">Burnt &amp; Expired Sweets</span>
            <h3 className="text-xl font-black text-slate-900">
              {wasteLogs.filter(w => w.reason === 'burnt' || w.reason === 'expired').length} Batches
            </h3>
          </div>
        </div>
      </div>

      {/* Filter by reason */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'all', label: lang === 'ur' ? 'تمام وجوہات' : 'All Reasons' },
            { id: 'burnt', label: lang === 'ur' ? '🔥 جل گیا' : '🔥 Burnt' },
            { id: 'expired', label: lang === 'ur' ? '⏰ تاریخ ختم' : '⏰ Expired' },
            { id: 'damaged', label: lang === 'ur' ? '📦 خراب ہو گیا' : '📦 Damaged' },
            { id: 'production_waste', label: lang === 'ur' ? '⚙️ پروڈکشن ضیاع' : '⚙️ Production Waste' },
            { id: 'spillage', label: lang === 'ur' ? '💧 گر گیا' : '💧 Spillage' }
          ].map(r => (
            <button
              key={r.id}
              onClick={() => setReasonFilter(r.id)}
              className={`px-3 py-1.5 rounded-lg border transition ${
                reasonFilter === r.id ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Waste Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <th className="py-2.5 px-3">Waste Log #</th>
                <th className="py-2.5 px-3">Date &amp; Time</th>
                <th className="py-2.5 px-3">Branch</th>
                <th className="py-2.5 px-3">Product Name</th>
                <th className="py-2.5 px-3 text-center">Quantity Lost</th>
                <th className="py-2.5 px-3 text-right">Cost Loss</th>
                <th className="py-2.5 px-3">Reason</th>
                <th className="py-2.5 px-3">Reported By</th>
                <th className="py-2.5 px-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {wasteLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{log.waste_no}</td>
                  <td className="py-2.5 px-3 text-slate-600">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="py-2.5 px-3 font-semibold">{log.branch_name}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">{log.product_name}</td>
                  <td className="py-2.5 px-3 text-center font-black text-rose-700">
                    -{log.quantity} {log.unit}
                  </td>
                  <td className="py-2.5 px-3 text-right font-black text-rose-800">
                    Rs. {Number(log.total_loss).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-bold text-[10px] uppercase">
                      {log.reason}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">{log.user_name}</td>
                  <td className="py-2.5 px-3 text-slate-500 italic max-w-xs truncate">{log.notes || '-'}</td>
                </tr>
              ))}
              {wasteLogs.length === 0 && (
                <tr>
                  <td colSpan="9" className="text-center py-12 text-slate-400">
                    No waste logs recorded for this criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LOG WASTE MODAL */}
      {showLogModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <h3 className="font-bold text-slate-800 text-base mb-3 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-600" />
              <span>Record Burnt / Damaged / Expired Waste</span>
            </h3>

            <form onSubmit={handleLogWaste} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Branch</label>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-semibold"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Product *</label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-semibold"
                >
                  <option value="">Select item...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.branch_stock} {p.unit}, Cost: Rs. {p.purchase_price})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Quantity Lost *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={wasteQty}
                    onChange={(e) => setWasteQty(e.target.value)}
                    placeholder="e.g. 2.5"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-bold text-rose-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Reason *</label>
                  <select
                    value={wasteReason}
                    onChange={(e) => setWasteReason(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="burnt">🔥 {lang === 'ur' ? 'جل گیا' : 'Burnt'}</option>
                    <option value="expired">⏰ {lang === 'ur' ? 'تاریخ ختم' : 'Expired'}</option>
                    <option value="damaged">📦 {lang === 'ur' ? 'خراب ہو گیا' : 'Damaged'}</option>
                    <option value="production_waste">⚙️ {lang === 'ur' ? 'پروڈکشن ضیاع' : 'Production Waste'}</option>
                    <option value="spillage">💧 {lang === 'ur' ? 'گر گیا' : 'Spillage'}</option>
                    <option value="other">{lang === 'ur' ? 'دیگر' : 'Other'}</option>
                  </select>
                </div>
              </div>

              {lossEstimate > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 font-bold flex justify-between items-center">
                  <span>Calculated Financial Loss:</span>
                  <span className="text-base text-rose-700">Rs. {Number(lossEstimate).toLocaleString()}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Explanation</label>
                <input
                  type="text"
                  placeholder="e.g. Overheated in kadhai during evening shift"
                  value={wasteNotes}
                  onChange={(e) => setWasteNotes(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-3 py-1.5 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Record Waste & Deduct Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
