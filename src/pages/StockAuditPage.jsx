import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Search,
  History,
  TrendingDown,
  TrendingUp,
  FileSpreadsheet,
  Check,
  X
} from 'lucide-react';

export function StockAuditPage() {
  const { activeBranchId, branches } = useAuth();
  const [activeTab, setActiveTab] = useState('new'); // 'new', 'history'
  const [selectedBranch, setSelectedBranch] = useState(activeBranchId || 1);
  const [loading, setLoading] = useState(false);

  // New Audit State
  const [auditTitle, setAuditTitle] = useState('Monthly Sweets & Grocery Stock Audit');
  const [auditNotes, setAuditNotes] = useState('');
  const [auditItems, setAuditItems] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  // History State
  const [pastAudits, setPastAudits] = useState([]);
  const [selectedPastAudit, setSelectedPastAudit] = useState(null);

  useEffect(() => {
    setSelectedBranch(activeBranchId);
  }, [activeBranchId]);

  const loadAuditSheet = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sawera_token');
      const res = await fetch(`/api/stock-audit/items?branch_id=${selectedBranch}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        const items = (d.items || []).map(item => ({
          id: item.product_id,
          product_id: item.product_id,
          name: item.product_name,
          code: item.product_code,
          barcode: item.barcode,
          unit: item.unit,
          purchase_price: item.purchase_price,
          sale_price: item.sale_price,
          category_name: item.category_name,
          system_stock: Number(item.system_quantity || 0),
          physical_stock: Number(item.system_quantity || 0),
          variance: 0,
          item_notes: ''
        }));
        setAuditItems(items);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadPastAudits = async () => {
    try {
      const token = localStorage.getItem('sawera_token');
      const res = await fetch(`/api/stock-audit?branch_id=${selectedBranch}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setPastAudits(d.audits || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadAuditSheet();
    loadPastAudits();
  }, [selectedBranch]);

  // Update physical count for an item
  const updatePhysicalStock = (productId, val) => {
    const num = parseFloat(val) || 0;
    setAuditItems(prev => prev.map(item => {
      if (item.id === productId || item.product_id === productId) {
        const variance = num - item.system_stock;
        return {
          ...item,
          physical_stock: num,
          variance
        };
      }
      return item;
    }));
  };

  // Submit Audit and Reconcile
  const handleSubmitAudit = async () => {
    const discrepancies = auditItems.filter(i => i.variance !== 0);
    const confirmMsg = discrepancies.length > 0
      ? `Found ${discrepancies.length} products with stock variance. Submitting this audit will immediately adjust branch inventory to match your physical count. Proceed?`
      : 'All physical counts match system stock. Submit audit log?';

    if (!confirm(confirmMsg)) return;

    setIsSubmitting(true);
    setNotification(null);

    try {
      const token = localStorage.getItem('sawera_token');
      const res = await fetch('/api/stock-audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          branch_id: selectedBranch,
          title: auditTitle,
          notes: auditNotes,
          items: auditItems.map(i => ({
            product_id: i.product_id || i.id,
            system_quantity: i.system_stock,
            physical_quantity: i.physical_stock,
            reason: i.item_notes || (i.variance > 0 ? 'Surplus during count' : i.variance < 0 ? 'Shortage during count' : 'Matched')
          }))
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit audit');

      setNotification({
        type: 'success',
        message: `✓ Audit #${data.audit_no} completed! Inventory reconciled with ${data.discrepancies_count !== undefined ? data.discrepancies_count : discrepancies.length} adjustments.`
      });

      loadAuditSheet();
      loadPastAudits();
      setActiveTab('history');
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = auditItems.filter(i => {
    const q = searchFilter.toLowerCase();
    return !q || i.name.toLowerCase().includes(q) || (i.code && i.code.toLowerCase().includes(q));
  });

  const discrepanciesCount = auditItems.filter(i => i.variance !== 0).length;
  const netVarianceCost = auditItems.reduce((sum, item) => sum + (item.variance * (item.purchase_price || 0)), 0);

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
            <ClipboardCheck className="w-5 h-5 text-emerald-700" />
          </span>
          <div>
            <h1 className="text-xl font-black text-slate-900">
              {lang === 'ur' ? 'اسٹاک پڑتال و آڈٹ' : 'Physical Stock Audit & Reconciliation'}
            </h1>
            <p className="text-xs text-slate-500">
              {lang === 'ur'
                ? 'موجودہ اسٹاک کی گنتی کریں اور ڈیٹا بیس کو فوری اپ ڈیٹ کریں'
                : 'Count floor stock, detect shortages & surpluses, and reconcile database inventory in 1-click'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(Number(e.target.value))}
            className="text-xs font-bold py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>📍 {lang === 'ur' && b.name_urdu ? b.name_urdu : b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {notification && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between ${
          notification.type === 'error' ? 'bg-rose-50 border border-rose-200 text-rose-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
        }`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="text-xs hover:underline">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-bold text-slate-500">
        <button
          onClick={() => setActiveTab('new')}
          className={`pb-3 px-2 flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeTab === 'new' ? 'border-amber-600 text-amber-700' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>{lang === 'ur' ? 'نیا فزیکل اسٹاک آڈٹ' : 'New Physical Stock Count'}</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 px-2 flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeTab === 'history' ? 'border-amber-600 text-amber-700' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit History ({pastAudits.length})</span>
        </button>
      </div>

      {/* TAB 1: NEW PHYSICAL AUDIT */}
      {activeTab === 'new' && (
        <div className="space-y-4">
          
          {/* Audit Controls & Summary Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={auditTitle}
                onChange={(e) => setAuditTitle(e.target.value)}
                placeholder="Audit Title..."
                className="text-xs font-bold px-3 py-2 border border-slate-300 rounded-xl flex-1 max-w-sm"
              />
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter items..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-3 text-xs">
              <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-slate-500 font-semibold">Total Items: </span>
                <span className="font-black text-slate-900">{auditItems.length}</span>
              </div>
              <div className={`px-3 py-1.5 rounded-xl border ${discrepanciesCount > 0 ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                <span className="font-semibold">Discrepancies: </span>
                <span className="font-black">{discrepanciesCount}</span>
              </div>
              <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl">
                <span className="font-semibold">Net Cost Variance: </span>
                <span className="font-black">Rs. {Math.round(netVarianceCost).toLocaleString()}</span>
              </div>
              <button
                type="button"
                onClick={handleSubmitAudit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting
                  ? (lang === 'ur' ? 'درست ہو رہا ہے...' : 'Reconciling...')
                  : (lang === 'ur' ? 'اسٹاک درست کریں' : 'Reconcile Stock')}
              </button>
            </div>
          </div>

          {/* Audit Items Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-xs z-10">
                  <tr className="text-slate-600 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3">{lang === 'ur' ? 'پراڈکٹ کا نام' : 'Product Name'}</th>
                    <th className="py-2.5 px-3">{lang === 'ur' ? 'کوڈ / بارکوڈ' : 'Code / Barcode'}</th>
                    <th className="py-2.5 px-3">{lang === 'ur' ? 'کیٹیگری' : 'Category'}</th>
                    <th className="py-2.5 px-3 text-center">{lang === 'ur' ? 'سسٹم اسٹاک' : 'System Stock'}</th>
                    <th className="py-2.5 px-3 text-center font-black text-amber-700">{lang === 'ur' ? 'گنتی شدہ اسٹاک' : 'Counted Physical Stock'}</th>
                    <th className="py-2.5 px-3 text-center">{lang === 'ur' ? 'فرق' : 'Variance'}</th>
                    <th className="py-2.5 px-3 text-right">Cost Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => {
                    const costImpact = item.variance * (item.purchase_price || 0);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {item.name}
                          {item.name_urdu && <span className="block font-urdu text-[11px] text-slate-500">{item.name_urdu}</span>}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">{item.code}</td>
                        <td className="py-2.5 px-3 text-slate-600">{item.category_name}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                          {item.system_stock} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            step="0.1"
                            value={item.physical_stock}
                            onChange={(e) => updatePhysicalStock(item.id, e.target.value)}
                            className="w-24 text-center font-black py-1 px-2 border-2 border-amber-400 rounded-lg text-xs focus:ring-2 focus:ring-amber-500"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {item.variance === 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold text-[10px]">
                              Matched (0)
                            </span>
                          ) : item.variance > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              +{item.variance} (Surplus)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                              {item.variance} (Shortage)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black">
                          <span className={costImpact < 0 ? 'text-rose-700' : costImpact > 0 ? 'text-emerald-700' : 'text-slate-400'}>
                            Rs. {Math.round(costImpact).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
            <h3 className="font-bold text-sm text-slate-800">Historical Stock Audits &amp; Reconciliations</h3>
            <span className="text-xs text-slate-500">Showing last {pastAudits.length} audits</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">Audit #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Branch</th>
                  <th className="py-2.5 px-3">Audit Title</th>
                  <th className="py-2.5 px-3 text-center">Items Audited</th>
                  <th className="py-2.5 px-3 text-center">Discrepancies</th>
                  <th className="py-2.5 px-3 text-right">Net Value Variance</th>
                  <th className="py-2.5 px-3">Auditor</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pastAudits.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{a.audit_no}</td>
                    <td className="py-2.5 px-3 text-slate-600">{new Date(a.created_at).toLocaleDateString()}</td>
                    <td className="py-2.5 px-3 font-semibold">{a.branch_name}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{a.title}</td>
                    <td className="py-2.5 px-3 text-center">{a.total_items}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-rose-700">{a.discrepancies_count}</td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-800">
                      Rs. {Number(a.total_variance_cost).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{a.user_name}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        Reconciled
                      </span>
                    </td>
                  </tr>
                ))}
                {pastAudits.length === 0 && (
                  <tr>
                    <td colSpan="9" className="text-center py-12 text-slate-400">
                      No stock audits recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
