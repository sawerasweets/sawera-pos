import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Plus,
  Search,
  DollarSign,
  FileText,
  Phone,
  MapPin,
  X,
  CreditCard,
  CheckCircle2,
  Printer,
  History
} from 'lucide-react';

export function CustomersPage() {
  const { activeBranchId, hasPermission, lang } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [hasBalanceOnly, setHasBalanceOnly] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [selectedCust, setSelectedCust] = useState(null);
  const [custLedger, setCustLedger] = useState({ sales: [], payments: [] });

  // Add Customer Form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState(0);
  const [creditLimit, setCreditLimit] = useState(50000);

  // Receive Payment Form
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNotes, setPayNotes] = useState('');
  const [receiptData, setReceiptData] = useState(null);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers?search=${search}&has_balance=${hasBalanceOnly}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sawera_token')}` }
      });
      if (res.ok) {
        const d = await res.json();
        setCustomers(d.customers || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [search, hasBalanceOnly]);

  const openReceivePayment = (c) => {
    setSelectedCust(c);
    setPayAmount(String(c.current_balance > 0 ? c.current_balance : ''));
    setReceiptData(null);
    setShowPayModal(true);
  };

  const openCustomerLedger = async (c) => {
    setSelectedCust(c);
    setShowLedgerModal(true);
    try {
      const res = await fetch(`/api/customers/${c.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sawera_token')}` }
      });
      if (res.ok) {
        const d = await res.json();
        setCustLedger({ sales: d.sales || [], payments: d.payments || [] });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sawera_token')}`
        },
        body: JSON.stringify({
          name, phone, email, address,
          opening_balance: openingBalance,
          credit_limit: creditLimit
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      alert('Customer added successfully!');
      setShowAddModal(false);
      setName(''); setPhone(''); setAddress('');
      loadCustomers();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleReceivePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!payAmount || parseFloat(payAmount) <= 0) return;
    try {
      const res = await fetch(`/api/customers/${selectedCust.id}/payments`, {
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
      if (!res.ok) throw new Error(d.error || 'Payment failed');
      setReceiptData(d.payment);
      loadCustomers();
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
            <span>{lang === 'ur' ? 'گاہک اور ادھار کھاتہ' : 'Customers & Udhaar Credit Ledger'}</span>
            <span className="text-xs bg-amber-100 text-amber-800 font-extrabold px-2.5 py-0.5 rounded-full">
              {customers.length} Customers
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Track customer retail purchases, credit limits, outstanding balances, and payment collections
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 rtl:space-x-reverse bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name, phone, address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setHasBalanceOnly(!hasBalanceOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
              hasBalanceOnly
                ? 'bg-rose-100 text-rose-800 border-rose-300'
                : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-rose-600" />
            <span>Show Outstanding Udhaar Only</span>
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold">
                <th className="py-3 px-3">Customer Name</th>
                <th className="py-3 px-3">Phone</th>
                <th className="py-3 px-3">Address</th>
                <th className="py-3 px-3 text-right">Credit Limit</th>
                <th className="py-3 px-3 text-right">Outstanding Udhaar</th>
                <th className="py-3 px-3 text-center">Invoices</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => {
                const hasDue = c.current_balance > 0;

                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 text-sm">{c.name}</div>
                      {c.email && <div className="text-[10px] text-slate-400">{c.email}</div>}
                    </td>
                    <td className="py-3 px-3 text-slate-700 font-semibold">{c.phone || '-'}</td>
                    <td className="py-3 px-3 text-slate-500 max-w-xs truncate">{c.address || '-'}</td>
                    <td className="py-3 px-3 text-right text-slate-600 font-semibold">
                      Rs. {Number(c.credit_limit).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={`text-sm font-black ${hasDue ? 'text-rose-600' : 'text-slate-400'}`}>
                        Rs. {Number(c.current_balance).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700">
                      {c.total_invoices || 0}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1 rtl:space-x-reverse">
                        {hasDue && (
                          <button
                            onClick={() => openReceivePayment(c)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-2xs transition"
                          >
                            Receive Udhaar
                          </button>
                        )}
                        <button
                          onClick={() => openCustomerLedger(c)}
                          className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                          title="View Ledger Statement"
                        >
                          <History className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {customers.length === 0 && (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    No customers found matching filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECEIVE PAYMENT MODAL */}
      {showPayModal && selectedCust && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <span>Receive Customer Payment</span>
              </h3>
              <button onClick={() => setShowPayModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            {!receiptData ? (
              <form onSubmit={handleReceivePaymentSubmit} className="space-y-3 text-xs">
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
                  <p className="font-bold text-sm">{selectedCust.name}</p>
                  <p className="text-xs">Current Outstanding Udhaar: <b className="text-rose-700">Rs. {Number(selectedCust.current_balance).toLocaleString()}</b></p>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Payment Amount Received (Rs.) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full text-base font-black px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Payment Mode</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="cash">{lang === 'ur' ? 'دراز میں نقد رقم' : 'Cash in Drawer'}</option>
                    <option value="easypaisa">{lang === 'ur' ? 'ایزی پیسہ' : 'Easypaisa'}</option>
                    <option value="jazzcash">{lang === 'ur' ? 'جاز کیش' : 'JazzCash'}</option>
                    <option value="bank">{lang === 'ur' ? 'بینک ٹرانسفر' : 'Bank Transfer'}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Notes / Slip #</label>
                  <input
                    type="text"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    placeholder="e.g. Cleared past week sweet box bill"
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
                    className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm"
                  >
                    Record Payment
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 text-center py-2">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-base text-slate-900">Payment Received!</h4>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-left space-y-1">
                  <div className="flex justify-between">
                    <span>Receipt No:</span>
                    <span className="font-mono font-bold">{receiptData.payment_no}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Customer:</span>
                    <span className="font-bold">{receiptData.customer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Amount Paid:</span>
                    <span className="font-bold text-emerald-700">Rs. {receiptData.amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Remaining Balance:</span>
                    <span className="font-bold text-rose-700">Rs. {receiptData.new_balance}</span>
                  </div>
                </div>

                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Voucher</span>
                  </button>
                  <button
                    onClick={() => { setShowPayModal(false); setReceiptData(null); }}
                    className="px-4 py-2 bg-amber-600 text-white font-bold rounded-xl text-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* CUSTOMER LEDGER STATEMENT MODAL */}
      {showLedgerModal && selectedCust && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-6">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">{selectedCust.name}</h3>
                <p className="text-xs text-slate-500">Phone: {selectedCust.phone || 'N/A'} | Credit Limit: Rs. {selectedCust.credit_limit}</p>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-500 font-semibold uppercase">Current Udhaar Due</span>
                <p className="text-xl font-black text-rose-600">Rs. {Number(selectedCust.current_balance).toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              <div>
                <h4 className="font-bold text-xs text-slate-800 uppercase mb-2">Past Invoices &amp; Credit Purchases</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                      <tr>
                        <th className="p-2">Invoice #</th>
                        <th className="p-2">Date</th>
                        <th className="p-2">Branch</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-right">Paid</th>
                        <th className="p-2 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {custLedger.sales.map((s) => (
                        <tr key={s.id}>
                          <td className="p-2 font-mono font-bold">{s.invoice_no}</td>
                          <td className="p-2 text-slate-500">{new Date(s.created_at).toLocaleDateString()}</td>
                          <td className="p-2">{s.branch_name}</td>
                          <td className="p-2 text-right font-bold">Rs. {s.grand_total}</td>
                          <td className="p-2 text-right text-emerald-700">Rs. {s.paid_amount}</td>
                          <td className="p-2 text-right font-bold text-rose-600">Rs. {s.credit_amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-xs text-slate-800 uppercase mb-2">Recovery Payments History</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                      <tr>
                        <th className="p-2">Receipt #</th>
                        <th className="p-2">Date</th>
                        <th className="p-2">Payment Mode</th>
                        <th className="p-2 text-right">Amount Received</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {custLedger.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="p-2 font-mono font-bold text-emerald-800">{p.payment_no}</td>
                          <td className="p-2 text-slate-500">{new Date(p.created_at).toLocaleDateString()}</td>
                          <td className="p-2 uppercase font-semibold text-slate-700">{p.payment_method}</td>
                          <td className="p-2 text-right font-black text-emerald-700">Rs. {p.amount}</td>
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

      {/* ADD CUSTOMER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-base text-slate-900">Add New Customer Profile</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  placeholder="e.g. Haji Muhammad Aslam"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Mobile Phone (e.g. 0300-1234567)</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Shop / House Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Opening Udhaar (Rs.)</label>
                  <input
                    type="number"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Credit Limit (Rs.)</label>
                  <input
                    type="number"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(parseFloat(e.target.value) || 50000)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-amber-700"
                  />
                </div>
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
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
