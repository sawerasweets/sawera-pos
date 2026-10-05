import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Layers,
  TrendingDown,
  ArrowRightLeft,
  SlidersHorizontal,
  Search,
  AlertTriangle,
  History,
  X,
  CheckCircle,
  Package,
  Plus
} from 'lucide-react';

export function InventoryPage() {
  const { activeBranchId, branches, hasPermission, lang } = useAuth();
  const [activeTab, setActiveTab] = useState('stock'); // 'stock', 'movements', 'transfers'
  const [inventory, setInventory] = useState([]);
  const [summary, setSummary] = useState({});
  const [movements, setMovements] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'low_stock', 'out_of_stock'
  const [search, setSearch] = useState('');

  // Modals
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Adjust Form
  const [adjProductId, setAdjProductId] = useState('');
  const [adjType, setAdjType] = useState('add'); // 'add', 'remove', 'damage', 'expired', 'set_exact'
  const [adjQty, setAdjQty] = useState('');
  const [adjReason, setAdjReason] = useState('');

  // Transfer Form
  const [trfFrom, setTrfFrom] = useState(activeBranchId || '1');
  const [trfTo, setTrfTo] = useState('2');
  const [trfItems, setTrfItems] = useState([{ product_id: '', quantity: 1 }]);
  const [trfNotes, setTrfNotes] = useState('');

  const loadStock = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sawera_token');
      const res = await fetch(`/api/inventory?branch_id=${activeBranchId}&filter=${filter}&search=${search}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setInventory(d.inventory || []);
        setSummary(d.summary || {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMovements = async () => {
    try {
      const res = await fetch(`/api/inventory/movements?branch_id=${activeBranchId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sawera_token')}` }
      });
      if (res.ok) {
        const d = await res.json();
        setMovements(d.movements || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadTransfers = async () => {
    try {
      const res = await fetch('/api/inventory/transfers', {
        headers: { Authorization: `Bearer ${localStorage.getItem('sawera_token')}` }
      });
      if (res.ok) {
        const d = await res.json();
        setTransfers(d.transfers || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'stock') loadStock();
    else if (activeTab === 'movements') loadMovements();
    else if (activeTab === 'transfers') loadTransfers();
  }, [activeBranchId, activeTab, filter, search]);

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!adjProductId || !adjQty) return;
    try {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sawera_token')}`
        },
        body: JSON.stringify({
          product_id: adjProductId,
          branch_id: activeBranchId,
          adjustment_type: adjType,
          quantity: parseFloat(adjQty),
          reason: adjReason
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Adjustment failed');
      alert('Stock adjusted successfully!');
      setShowAdjustModal(false);
      setAdjQty('');
      setAdjReason('');
      loadStock();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (trfFrom === trfTo) {
      alert('Source and destination branches cannot be the same!');
      return;
    }
    const validItems = trfItems.filter(i => i.product_id && i.quantity > 0);
    if (validItems.length === 0) {
      alert('Please add at least one product with quantity > 0');
      return;
    }

    try {
      const res = await fetch('/api/inventory/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sawera_token')}`
        },
        body: JSON.stringify({
          from_branch_id: trfFrom,
          to_branch_id: trfTo,
          items: validItems,
          notes: trfNotes
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Transfer failed');
      alert(`Transfer completed! Reference: ${d.transfer_no}`);
      setShowTransferModal(false);
      setTrfItems([{ product_id: '', quantity: 1 }]);
      loadStock();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      
      {/* Header & Stock Valuation Overview */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>{lang === 'ur' ? 'اسٹاک و گودام مینجمنٹ' : 'Inventory & Multi-Branch Stock'}</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Real-time branch inventory valuation, damage logging, branch transfers and stock movement ledger
          </p>
        </div>

        {hasPermission('manage_inventory') && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdjustModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4 text-amber-600" />
              <span>Manual Adjustment</span>
            </button>
            <button
              onClick={() => setShowTransferModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Branch Transfer</span>
            </button>
          </div>
        )}
      </div>

      {/* VALUATION METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase">Cost Valuation</span>
          <p className="text-lg font-black text-slate-900 mt-1">
            Rs. {Number(summary.total_cost_valuation || 0).toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400">Total inventory at cost</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase">Retail Valuation</span>
          <p className="text-lg font-black text-amber-700 mt-1">
            Rs. {Number(summary.total_sale_valuation || 0).toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400">Total inventory at retail</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase">Low Stock Alerts</span>
          <p className="text-lg font-black text-amber-600 mt-1">
            {summary.low_stock_count || 0} Products
          </p>
          <span className="text-[10px] text-amber-700 font-semibold">Below min threshold</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase">Out of Stock</span>
          <p className="text-lg font-black text-rose-600 mt-1">
            {summary.out_of_stock_count || 0} Products
          </p>
          <span className="text-[10px] text-rose-600 font-semibold">Zero units available</span>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="flex space-x-1 rtl:space-x-reverse text-xs font-bold">
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-4 py-2 rounded-xl transition ${activeTab === 'stock' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Live Branch Inventory
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`px-4 py-2 rounded-xl transition ${activeTab === 'movements' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Stock Movement Ledger
          </button>
          <button
            onClick={() => setActiveTab('transfers')}
            className={`px-4 py-2 rounded-xl transition ${activeTab === 'transfers' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Branch Transfers Log
          </button>
        </div>

        {activeTab === 'stock' && (
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-xs font-semibold py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="all">All Stock Status</option>
              <option value="low_stock">Low Stock Only</option>
              <option value="out_of_stock">Out of Stock Only</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: LIVE INVENTORY TABLE */}
      {activeTab === 'stock' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold">
                  <th className="py-3 px-3">Product Name</th>
                  <th className="py-3 px-3">Code / Barcode</th>
                  <th className="py-3 px-3">Branch</th>
                  <th className="py-3 px-3 text-center">Unit</th>
                  <th className="py-3 px-3 text-center">Available Stock</th>
                  <th className="py-3 px-3 text-right">Cost Value</th>
                  <th className="py-3 px-3 text-right">Retail Value</th>
                  <th className="py-3 px-3 text-center">Stock Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventory.map((item, idx) => {
                  const isOut = item.quantity <= 0;
                  const isLow = item.quantity <= item.min_stock;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{item.product_name}</div>
                        {item.product_name_urdu && <div className="font-urdu text-[11px] text-slate-500">{item.product_name_urdu}</div>}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {item.product_code}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700">
                        {item.branch_name}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-500">{item.unit}</td>
                      <td className="py-3 px-3 text-center font-black text-sm text-slate-900">
                        {item.quantity}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600 font-semibold">
                        Rs. {Number(item.stock_cost_value).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-amber-700">
                        Rs. {Number(item.stock_sale_value).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full font-extrabold text-[10px] ${
                          isOut
                            ? 'bg-rose-100 text-rose-700'
                            : isLow
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isOut ? 'OUT OF STOCK' : isLow ? 'LOW STOCK' : 'IN STOCK'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: STOCK MOVEMENT LEDGER */}
      {activeTab === 'movements' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold">
                  <th className="py-3 px-3">Date / Time</th>
                  <th className="py-3 px-3">Product</th>
                  <th className="py-3 px-3">Branch</th>
                  <th className="py-3 px-3">Movement Type</th>
                  <th className="py-3 px-3 text-center">Qty Changed</th>
                  <th className="py-3 px-3 text-center">Prev Stock</th>
                  <th className="py-3 px-3 text-center">New Stock</th>
                  <th className="py-3 px-3">Reference / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {new Date(m.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{m.product_name}</td>
                    <td className="py-2.5 px-3 text-slate-700 font-semibold">{m.branch_name}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        m.type === 'purchase' || m.type === 'transfer_in' || m.type === 'sales_return'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {m.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-black">
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity} {m.unit}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-500">{m.previous_stock}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-900">{m.new_stock}</td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {m.reference_id && <span className="font-mono font-bold mr-1">{m.reference_id}:</span>}
                      {m.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TRANSFERS LOG */}
      {activeTab === 'transfers' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold">
                  <th className="py-3 px-3">Transfer Ref #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">From Branch</th>
                  <th className="py-3 px-3">To Branch</th>
                  <th className="py-3 px-3 text-center">Items Count</th>
                  <th className="py-3 px-3 text-center">Total Qty</th>
                  <th className="py-3 px-3">Transferred By</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transfers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3 font-mono font-bold text-amber-700">{t.transfer_no}</td>
                    <td className="py-3 px-3 text-slate-500">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-3 font-semibold text-slate-800">{t.from_branch_name}</td>
                    <td className="py-3 px-3 font-semibold text-slate-800">{t.to_branch_name}</td>
                    <td className="py-3 px-3 text-center font-bold">{t.item_count}</td>
                    <td className="py-3 px-3 text-center font-extrabold">{t.total_qty}</td>
                    <td className="py-3 px-3 text-slate-600">{t.user_name}</td>
                    <td className="py-3 px-3 text-center">
                      <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADJUSTMENT MODAL */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-base text-slate-900">Manual Stock Adjustment</h3>
              <button onClick={() => setShowAdjustModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAdjustSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Select Product *</label>
                <select
                  required
                  value={adjProductId}
                  onChange={(e) => setAdjProductId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                >
                  <option value="">-- Choose Product --</option>
                  {inventory.map(i => (
                    <option key={i.product_id} value={i.product_id}>
                      {i.product_name} (Current: {i.quantity} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Adjustment Type *</label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                >
                  <option value="add">Add Stock (+ Quantity)</option>
                  <option value="remove">Deduct Stock (- Quantity)</option>
                  <option value="damage">Damage / Spoilage (- Quantity)</option>
                  <option value="expired">Expired Stock Removal (- Quantity)</option>
                  <option value="set_exact">Set Exact Count (Replace Stock)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Quantity *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  placeholder="e.g. 5"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Reason / Remarks *</label>
                <input
                  type="text"
                  required
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. Physical inventory count discrepancy"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-3 py-1.5 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-sm"
                >
                  Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BRANCH TRANSFER MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-amber-600" />
                <span>Branch to Branch Stock Transfer</span>
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Source Branch (From)</label>
                  <select
                    value={trfFrom}
                    onChange={(e) => setTrfFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Destination Branch (To)</label>
                  <select
                    value={trfTo}
                    onChange={(e) => setTrfTo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-amber-700"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items List to Transfer */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-700">Products to Transfer</label>
                {trfItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      required
                      value={item.product_id}
                      onChange={(e) => {
                        const copy = [...trfItems];
                        copy[idx].product_id = e.target.value;
                        setTrfItems(copy);
                      }}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      <option value="">-- Choose Product --</option>
                      {inventory.map(p => (
                        <option key={p.product_id} value={p.product_id}>{p.product_name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      required
                      value={item.quantity}
                      onChange={(e) => {
                        const copy = [...trfItems];
                        copy[idx].quantity = parseFloat(e.target.value) || 1;
                        setTrfItems(copy);
                      }}
                      className="w-20 px-2 py-2 border border-slate-300 rounded-lg font-bold text-center"
                      placeholder="Qty"
                    />
                    {trfItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setTrfItems(trfItems.filter((_, i) => i !== idx))}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setTrfItems([...trfItems, { product_id: '', quantity: 1 }])}
                  className="text-xs font-bold text-amber-700 hover:underline flex items-center gap-1 mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Another Product</span>
                </button>
              </div>

              <div>
                <label className="block font-semibold mb-1">Transfer Notes (Optional)</label>
                <input
                  type="text"
                  value={trfNotes}
                  onChange={(e) => setTrfNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. Sent via Suzuki carry delivery driver"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-3 py-1.5 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-sm"
                >
                  Dispatch Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
