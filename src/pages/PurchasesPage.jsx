import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Truck,
  Plus,
  Search,
  Building2,
  FileText,
  Trash2,
  X,
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export function PurchasesPage() {
  const { activeBranchId, branches, lang } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // New Purchase Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [branchId, setBranchId] = useState(activeBranchId || '1');
  const [supplierInvNo, setSupplierInvNo] = useState('');
  const [items, setItems] = useState([{ product_id: '', quantity: 1, purchase_price: 0 }]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sawera_token');
      const [purRes, supRes, prodRes] = await Promise.all([
        fetch(`/api/purchases?branch_id=${activeBranchId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/suppliers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/products?branch_id=${activeBranchId}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (purRes.ok) {
        const d = await purRes.json();
        setPurchases(d.purchases || []);
      }
      if (supRes.ok) {
        const d = await supRes.json();
        setSuppliers(d.suppliers || []);
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
  }, [activeBranchId]);

  const handleProductSelect = (idx, prodId) => {
    const p = products.find(prod => String(prod.id) === String(prodId));
    const updated = [...items];
    updated[idx] = {
      product_id: prodId,
      quantity: updated[idx].quantity || 1,
      purchase_price: p ? p.purchase_price : 0
    };
    setItems(updated);
  };

  const updateItemField = (idx, field, value) => {
    const updated = [...items];
    updated[idx][field] = parseFloat(value) || 0;
    setItems(updated);
  };

  const addItemRow = () => {
    setItems([...items, { product_id: '', quantity: 1, purchase_price: 0 }]);
  };

  const removeItemRow = (idx) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.purchase_price), 0);
  const grandTotal = Math.max(0, subtotal - (parseFloat(discountAmount) || 0));
  const remaining = Math.max(0, grandTotal - (parseFloat(paidAmount) || 0));

  const handleSavePurchase = async (e) => {
    e.preventDefault();
    if (!selectedSupplier) {
      alert('Please select a supplier.');
      return;
    }
    const validItems = items.filter(i => i.product_id && i.quantity > 0);
    if (validItems.length === 0) {
      alert('Please select at least one product with quantity > 0');
      return;
    }

    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sawera_token')}`
        },
        body: JSON.stringify({
          supplier_id: selectedSupplier,
          branch_id: branchId,
          supplier_invoice_no: supplierInvNo,
          items: validItems,
          subtotal,
          discount_amount: discountAmount,
          grand_total: grandTotal,
          paid_amount: paidAmount,
          payment_method: paymentMethod,
          notes
        })
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to save purchase');

      alert(`Purchase recorded! Invoice #${d.purchase_no}. Stock increased automatically.`);
      setShowModal(false);
      setItems([{ product_id: '', quantity: 1, purchase_price: 0 }]);
      setPaidAmount(0);
      setDiscountAmount(0);
      loadData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>{lang === 'ur' ? 'خریداری و انورڈ مال' : 'Purchases & Supplier Inward'}</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full">
              {purchases.length} Inward Orders
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Log raw milk, desi ghee, flour, packaging, cosmetics &amp; wholesale inventory purchases
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 rtl:space-x-reverse bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Inward Purchase</span>
        </button>
      </div>

      {/* Purchases Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold">
                <th className="py-3 px-3">Purchase #</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Supplier Name</th>
                <th className="py-3 px-3">Branch</th>
                <th className="py-3 px-3 text-right">Total Amount</th>
                <th className="py-3 px-3 text-right">Paid Amount</th>
                <th className="py-3 px-3 text-right">Balance Due</th>
                <th className="py-3 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchases.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3 font-mono font-bold text-slate-900">{p.purchase_no}</td>
                  <td className="py-3 px-3 text-slate-500">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900">{p.supplier_name}</div>
                    <div className="text-[10px] text-slate-500">{p.supplier_company}</div>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-700">{p.branch_name}</td>
                  <td className="py-3 px-3 text-right font-black text-slate-900">
                    Rs. {Number(p.grand_total).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-700">
                    Rs. {Number(p.paid_amount).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-rose-600">
                    Rs. {Number(p.remaining_amount).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                      p.remaining_amount <= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {p.remaining_amount <= 0 ? 'PAID' : 'PARTIAL'}
                    </span>
                  </td>
                </tr>
              ))}

              {purchases.length === 0 && (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    No inward purchases recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW INWARD PURCHASE MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-400" />
                <span>Record Inward Stock Purchase</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-white/10 rounded">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleSavePurchase} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Select Supplier *</label>
                  <select
                    required
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="">-- Choose Supplier --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.company || 'Wholesale'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Receiving Branch *</label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Supplier Bill / Invoice #</label>
                  <input
                    type="text"
                    value={supplierInvNo}
                    onChange={(e) => setSupplierInvNo(e.target.value)}
                    placeholder="e.g. INV-9841"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-slate-800">Purchased Products &amp; Quantities</span>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="text-xs font-bold text-amber-700 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        required
                        value={item.product_id}
                        onChange={(e) => handleProductSelect(idx, e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="">-- Select Product --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItemField(idx, 'quantity', e.target.value)}
                        className="w-20 px-2 py-2 border border-slate-300 rounded-lg font-bold text-center bg-white"
                      />

                      <input
                        type="number"
                        required
                        placeholder="Rate"
                        value={item.purchase_price}
                        onChange={(e) => updateItemField(idx, 'purchase_price', e.target.value)}
                        className="w-24 px-2 py-2 border border-slate-300 rounded-lg font-bold text-right bg-white"
                      />

                      <div className="w-24 text-right font-black text-slate-800 pr-1">
                        Rs. {(item.quantity * item.purchase_price).toLocaleString()}
                      </div>

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals & Payments */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <div>
                    <label className="block font-semibold mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    >
                      <option value="cash">{lang === 'ur' ? 'نقد' : 'Cash'}</option>
                      <option value="bank">{lang === 'ur' ? 'بینک ٹرانسفر' : 'Bank Transfer'}</option>
                      <option value="cheque">{lang === 'ur' ? 'چیک' : 'Cheque'}</option>
                      <option value="easypaisa">{lang === 'ur' ? 'ایزی پیسہ' : 'Easypaisa'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Notes / Delivery Details</label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. 5 bags desi ghee delivered in morning"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>Rs. {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Discount:</span>
                    <input
                      type="number"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-0.5 border border-slate-300 rounded text-right font-bold"
                    />
                  </div>
                  <div className="flex justify-between font-black text-sm text-slate-900 pt-1 border-t border-slate-200">
                    <span>Grand Total:</span>
                    <span className="text-amber-700">Rs. {grandTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span>Paid to Supplier:</span>
                    <input
                      type="number"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                      className="w-24 px-2 py-0.5 border border-slate-300 rounded text-right font-bold text-emerald-700"
                    />
                  </div>
                  <div className="flex justify-between font-bold text-rose-600 pt-1 border-t border-slate-200">
                    <span>Remaining Due:</span>
                    <span>Rs. {remaining.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md transition"
                >
                  Save Inward &amp; Restock
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
