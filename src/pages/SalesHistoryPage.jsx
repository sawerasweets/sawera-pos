import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { InvoicePrintModal } from '../components/InvoicePrintModal';
import {
  FileText,
  Search,
  Printer,
  RotateCcw,
  Eye,
  Calendar,
  X,
  AlertCircle,
  CheckCircle2,
  DollarSign
} from 'lucide-react';

export function SalesHistoryPage() {
  const { activeBranchId, hasPermission, lang } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');

  // Print modal
  const [selectedSaleForPrint, setSelectedSaleForPrint] = useState(null);

  // Return modal
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [saleForReturn, setSaleForReturn] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState('');
  const [refundMethod, setRefundMethod] = useState('cash');

  const loadSales = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sawera_token');
      const res = await fetch(`/api/sales?branch_id=${activeBranchId}&search=${search}&status=${statusFilter}&payment_method=${paymentFilter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setSales(d.sales || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [activeBranchId, search, statusFilter, paymentFilter]);

  const openReprint = async (saleId) => {
    try {
      const res = await fetch(`/api/sales/${saleId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sawera_token')}` }
      });
      if (res.ok) {
        const d = await res.json();
        setSelectedSaleForPrint(d.sale);
      }
    } catch (err) {
      alert('Could not fetch invoice details.');
    }
  };

  const openReturnModal = async (saleId) => {
    try {
      const res = await fetch(`/api/sales/${saleId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sawera_token')}` }
      });
      if (res.ok) {
        const d = await res.json();
        setSaleForReturn(d.sale);
        // Initialize return quantities
        const itemsToReturn = (d.sale.items || []).map(i => ({
          sale_item_id: i.id,
          product_name: i.product_name,
          quantity: 0,
          max_return: i.quantity - (i.returned_quantity || 0),
          unit_price: i.unit_price,
          unit: i.unit
        }));
        setReturnItems(itemsToReturn);
        setReturnReason('Customer Exchange / Return');
        setRefundMethod(d.sale.payment_method === 'credit' ? 'credit_deduction' : 'cash');
        setShowReturnModal(true);
      }
    } catch (err) {
      alert('Failed to load invoice items for return.');
    }
  };

  const handleReturnItemQtyChange = (idx, qty) => {
    const copy = [...returnItems];
    const val = Math.min(copy[idx].max_return, Math.max(0, parseFloat(qty) || 0));
    copy[idx].quantity = val;
    setReturnItems(copy);
  };

  const totalRefundAmount = returnItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  const handleProcessReturn = async (e) => {
    e.preventDefault();
    const activeReturns = returnItems.filter(i => i.quantity > 0);
    if (activeReturns.length === 0) {
      alert('Please enter at least 1 item quantity to return.');
      return;
    }

    try {
      const res = await fetch(`/api/sales/${saleForReturn.id}/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sawera_token')}`
        },
        body: JSON.stringify({
          return_items: activeReturns,
          reason: returnReason,
          refund_method: refundMethod
        })
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Return failed');

      alert(`Sales Return processed! Return #${d.return_no}. Refund: Rs. ${d.refund_amount}. Stock restored.`);
      setShowReturnModal(false);
      loadSales();
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
            <span>{lang === 'ur' ? 'فروخت و انوائسز کا ریکارڈ' : 'Sales History & Invoice Registry'}</span>
            <span className="text-xs bg-amber-100 text-amber-800 font-extrabold px-2.5 py-0.5 rounded-full">
              {sales.length} Invoices
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Search invoices, reprint 80mm thermal receipts, download A4 tax bills, and process returns
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by invoice # or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="partially_returned">Partially Returned</option>
            <option value="returned">Fully Returned</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="text-xs font-semibold py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl"
          >
            <option value="all">All Payment Modes</option>
            <option value="cash">Cash</option>
            <option value="easypaisa">Easypaisa</option>
            <option value="jazzcash">JazzCash</option>
            <option value="split">Split</option>
            <option value="credit">Credit / Udhaar</option>
          </select>
        </div>
      </div>

      {/* Sales Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold">
                <th className="py-3 px-3">Invoice Number</th>
                <th className="py-3 px-3">Date / Time</th>
                <th className="py-3 px-3">Branch</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">Cashier</th>
                <th className="py-3 px-3 text-right">Grand Total</th>
                <th className="py-3 px-3 text-center">Payment Mode</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3 font-mono font-bold text-slate-900">{s.invoice_no}</td>
                  <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                    {new Date(s.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-700">{s.branch_name}</td>
                  <td className="py-3 px-3 font-medium text-slate-900">
                    {s.customer_name || 'Walk-in'}
                  </td>
                  <td className="py-3 px-3 text-slate-600">{s.cashier_name}</td>
                  <td className="py-3 px-3 text-right font-black text-slate-900 text-sm">
                    Rs. {Number(s.grand_total).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-extrabold text-[10px] uppercase">
                      {s.payment_method}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                      s.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : s.status === 'partially_returned'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {s.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center space-x-1 rtl:space-x-reverse">
                      <button
                        onClick={() => openReprint(s.id)}
                        className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                        title="Reprint Thermal / A4 Bill"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      {hasPermission('process_returns') && s.status !== 'returned' && (
                        <button
                          onClick={() => openReturnModal(s.id)}
                          className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Process Return / Refund"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {sales.length === 0 && (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    No sales invoices found matching filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SALES RETURN & REFUND MODAL */}
      {showReturnModal && saleForReturn && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-6">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-rose-600" />
                  <span>Process Sales Return / Refund</span>
                </h3>
                <p className="text-xs text-slate-500">Invoice: {saleForReturn.invoice_no} | Date: {new Date(saleForReturn.created_at).toLocaleDateString()}</p>
              </div>
              <button onClick={() => setShowReturnModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleProcessReturn} className="space-y-4 text-xs">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b">
                    <tr>
                      <th className="p-2.5">Item</th>
                      <th className="p-2.5 text-center">Unit Price</th>
                      <th className="p-2.5 text-center">Max Returnable</th>
                      <th className="p-2.5 text-center">Return Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {returnItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-bold text-slate-900">{item.product_name}</td>
                        <td className="p-2.5 text-center">Rs. {item.unit_price}</td>
                        <td className="p-2.5 text-center font-bold text-slate-600">{item.max_return} {item.unit}</td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            min="0"
                            max={item.max_return}
                            value={item.quantity}
                            onChange={(e) => handleReturnItemQtyChange(idx, e.target.value)}
                            disabled={item.max_return <= 0}
                            className="w-20 px-2 py-1 border border-slate-300 rounded font-black text-center"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Refund Method</label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="cash">{lang === 'ur' ? 'دراز سے نقد رقم کی واپسی' : 'Cash Refund from Drawer'}</option>
                    <option value="credit_deduction">{lang === 'ur' ? 'گاہک کے ادھار کھاتہ سے کٹوتی' : 'Customer Credit Deduction'}</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Return Reason *</label>
                  <input
                    type="text"
                    required
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="e.g. Expired, packaging damaged, wrong order"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 flex justify-between items-center text-rose-900">
                <span className="font-bold text-xs">Total Refund Amount:</span>
                <span className="text-base font-black text-rose-700">Rs. {totalRefundAmount.toLocaleString()}</span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-3 py-1.5 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={totalRefundAmount <= 0}
                  className="px-5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-sm disabled:opacity-50"
                >
                  Confirm Return &amp; Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* THERMAL / A4 REPRINT MODAL */}
      {selectedSaleForPrint && (
        <InvoicePrintModal
          sale={selectedSaleForPrint}
          onClose={() => setSelectedSaleForPrint(null)}
          autoPrint={false}
        />
      )}

    </div>
  );
}
