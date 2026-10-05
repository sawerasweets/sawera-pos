import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  Plus,
  Search,
  DollarSign,
  Phone,
  MapPin,
  X,
  History,
  CheckCircle2
} from 'lucide-react';

export function SuppliersPage() {
  const { activeBranchId, lang } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [selectedSup, setSelectedSup] = useState(null);
  const [supLedger, setSupLedger] = useState({ purchases: [], payments: [] });

  // Add Form
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState(0);

  // Pay Form
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNotes, setPayNotes] = useState('');

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/suppliers?search=${search}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sawera_token')}` }
      });
      if (res.ok) {
        const d = await res.json();
        setSuppliers(d.suppliers || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, [search]);

  const openPaySupplier = (s) => {
    setSelectedSup(s);
    setPayAmount(String(s.current_balance > 0 ? s.current_balance : ''));
    setShowPayModal(true);
  };

  const openSupplierLedger = async (s) => {
    setSelectedSup(s);
    setShowLedgerModal(true);
    try {
      const res = await fetch(`/api/suppliers/${s.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sawera_token')}` }
      });
      if (res.ok) {
        const d = await res.json();
        setSupLedger({ purchases: d.purchases || [], payments: d.payments || [] });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sawera_token')}`
        },
        body: JSON.stringify({
          name, company, phone, email, address,
          opening_balance: openingBalance
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      alert('Supplier registered successfully!');
      setShowAddModal(false);
      setName(''); setCompany(''); setPhone(''); setAddress('');
      loadSuppliers();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handlePaySupplierSubmit = async (e) => {
    e.preventDefault();
    if (!payAmount || parseFloat(payAmount) <= 0) return;
    try {
      const res = await fetch(`/api/suppliers/${selectedSup.id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sawera_token')}`
        },
        body: JSON.stringify({
          amount: parseFloat(payAmount),
          payment_method: payMethod,
          branch_id: activeBranchId,
          notes: payNotes
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      alert(`Payment of Rs. ${d.payment.amount} recorded! Voucher #${d.payment.payment_no}`);
      setShowPayModal(false);
      loadSuppliers();
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
            <span>{lang === 'ur' ? 'سپلائرز و ادائیگیاں' : 'Suppliers & Accounts Payable'}</span>
            <span className="text-xs bg-purple-100 text-purple-800 font-extrabold px-2.5 py-0.5 rounded-full">
              {suppliers.length} Vendors
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage wholesale sweet ingredients, milk dairy farms, packaging factories &amp; supplier payment vouchers
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 rtl:space-x-reverse bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Supplier</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by vendor name, company, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold">
                <th className="py-3 px-3">Supplier / Company</th>
                <th className="py-3 px-3">Contact Details</th>
                <th className="py-3 px-3">Address</th>
                <th className="py-3 px-3 text-right">Outstanding Payable</th>
                <th className="py-3 px-3 text-center">Inward Invoices</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.map((s) => {
                const hasDue = s.current_balance > 0;

                return (
                  <tr key={s.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 text-sm">{s.name}</div>
                      <div className="text-[11px] font-semibold text-purple-700">{s.company || 'Wholesale Supplier'}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      <div>{s.phone || '-'}</div>
                      <div className="text-[10px] text-slate-400">{s.email || ''}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-500 max-w-xs truncate">{s.address || '-'}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={`text-sm font-black ${hasDue ? 'text-rose-600' : 'text-slate-400'}`}>
                        Rs. {Number(s.current_balance).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700">
                      {s.total_purchases_count || 0}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1 rtl:space-x-reverse">
                        {hasDue && (
                          <button
                            onClick={() => openPaySupplier(s)}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-[11px] shadow-2xs transition"
                          >
                            Pay Vendor
                          </button>
                        )}
                        <button
                          onClick={() => openSupplierLedger(s)}
                          className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                          title="View Purchase Ledger"
                        >
                          <History className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {suppliers.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    No suppliers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD SUPPLIER PAYMENT MODAL */}
      {showPayModal && selectedSup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-purple-600" />
                <span>Pay Supplier</span>
              </h3>
              <button onClick={() => setShowPayModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePaySupplierSubmit} className="space-y-3 text-xs">
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-900">
                <p className="font-bold text-sm">{selectedSup.name} ({selectedSup.company})</p>
                <p className="text-xs">Outstanding Payable: <b className="text-rose-700">Rs. {Number(selectedSup.current_balance).toLocaleString()}</b></p>
              </div>

              <div>
                <label className="block font-semibold mb-1">Amount to Pay (Rs.) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full text-base font-black px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                >
                  <option value="cash">{lang === 'ur' ? 'دراز سے نقد رقم' : 'Cash from Drawer'}</option>
                  <option value="bank">{lang === 'ur' ? 'بینک ٹرانسفر' : 'Bank Transfer'}</option>
                  <option value="cheque">{lang === 'ur' ? 'چیک' : 'Cheque'}</option>
                  <option value="easypaisa">{lang === 'ur' ? 'ایزی پیسہ' : 'Easypaisa'}</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Notes / Bank Ref / Cheque #</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. HBL Online transfer ref # 99281"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-3 py-1.5 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-sm"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPPLIER LEDGER MODAL */}
      {showLedgerModal && selectedSup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-6">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">{selectedSup.name}</h3>
                <p className="text-xs text-slate-500">{selectedSup.company} | Phone: {selectedSup.phone || 'N/A'}</p>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-500 font-semibold uppercase">Payable Due</span>
                <p className="text-xl font-black text-rose-600">Rs. {Number(selectedSup.current_balance).toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              <div>
                <h4 className="font-bold text-xs text-slate-800 uppercase mb-2">Past Inward Purchases</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                      <tr>
                        <th className="p-2">Purchase #</th>
                        <th className="p-2">Date</th>
                        <th className="p-2">Branch</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-right">Paid</th>
                        <th className="p-2 text-right">Remaining</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {supLedger.purchases.map((p) => (
                        <tr key={p.id}>
                          <td className="p-2 font-mono font-bold">{p.purchase_no}</td>
                          <td className="p-2 text-slate-500">{new Date(p.created_at).toLocaleDateString()}</td>
                          <td className="p-2">{p.branch_name}</td>
                          <td className="p-2 text-right font-bold">Rs. {p.grand_total}</td>
                          <td className="p-2 text-right text-emerald-700">Rs. {p.paid_amount}</td>
                          <td className="p-2 text-right font-bold text-rose-600">Rs. {p.remaining_amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-xs text-slate-800 uppercase mb-2">Vendor Payments Issued</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                      <tr>
                        <th className="p-2">Voucher #</th>
                        <th className="p-2">Date</th>
                        <th className="p-2">Method</th>
                        <th className="p-2 text-right">Amount Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {supLedger.payments.map((pm) => (
                        <tr key={pm.id}>
                          <td className="p-2 font-mono font-bold text-purple-800">{pm.payment_no}</td>
                          <td className="p-2 text-slate-500">{new Date(pm.created_at).toLocaleDateString()}</td>
                          <td className="p-2 uppercase font-semibold text-slate-700">{pm.payment_method}</td>
                          <td className="p-2 text-right font-black text-purple-700">Rs. {pm.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200 mt-4">
              <button
                onClick={() => setShowLedgerModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl text-xs"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD SUPPLIER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-base text-slate-900">Add New Supplier</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Contact Person Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  placeholder="e.g. Haji Shaukat"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Company / Mill Name</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. Al-Madina Desi Ghee & Milk Suppliers"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Address / City</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Opening Payable Balance (Rs.)</label>
                <input
                  type="number"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-sm"
                >
                  Register Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
