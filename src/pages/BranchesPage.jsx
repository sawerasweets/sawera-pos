import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  GitBranch,
  Plus,
  Store,
  Clock,
  Phone,
  MapPin,
  User,
  Edit,
  X,
  CheckCircle2
} from 'lucide-react';

export function BranchesPage() {
  const { user, lang, fetchBranches } = useAuth();
  const [branchesList, setBranchesList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [nameUrdu, setNameUrdu] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [managerName, setManagerName] = useState('');
  const [openingTime, setOpeningTime] = useState('08:00 AM');
  const [closingTime, setClosingTime] = useState('11:00 PM');
  const [status, setStatus] = useState('active');

  const loadBranches = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/branches', {
        headers: { Authorization: `Bearer ${localStorage.getItem('sawera_token')}` }
      });
      if (res.ok) {
        const d = await res.json();
        setBranchesList(d.branches || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const openCreateModal = () => {
    setEditId(null);
    const nextIdx = branchesList.length + 1;
    setCode(`BR-0${nextIdx}`);
    setName(`Branch ${nextIdx}`);
    setNameUrdu('');
    setAddress('');
    setPhone('');
    setManagerName('');
    setShowModal(true);
  };

  const openEditModal = (b) => {
    setEditId(b.id);
    setCode(b.code);
    setName(b.name);
    setNameUrdu(b.name_urdu || '');
    setAddress(b.address || '');
    setPhone(b.phone || '');
    setManagerName(b.manager_name || '');
    setOpeningTime(b.opening_time || '08:00 AM');
    setClosingTime(b.closing_time || '11:00 PM');
    setStatus(b.status || 'active');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editId ? `/api/branches/${editId}` : '/api/branches';
      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sawera_token')}`
        },
        body: JSON.stringify({
          code, name, name_urdu: nameUrdu, address, phone,
          manager_name: managerName, opening_time: openingTime, closing_time: closingTime,
          status
        })
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');

      alert(editId ? 'Branch updated!' : 'New branch added!');
      setShowModal(false);
      loadBranches();
      fetchBranches();
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
            <span>{lang === 'ur' ? 'تمام برانچوں کا انتظام' : 'Multi-Branch Management'}</span>
            <span className="text-xs bg-amber-100 text-amber-800 font-extrabold px-2.5 py-0.5 rounded-full">
              {branchesList.length} Registered Branches
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Scalable multi-branch network. Add Branch 5, 6, etc. and manage managers, timings &amp; address
          </p>
        </div>

        {user?.role === 'admin' && (
          <button
            onClick={openCreateModal}
            className="flex items-center space-x-2 rtl:space-x-reverse bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Branch (e.g. Branch 5)</span>
          </button>
        )}
      </div>

      {/* Branches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {branchesList.map((b) => (
          <div key={b.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-400 transition space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-mono font-black bg-slate-900 text-amber-400 px-2.5 py-0.5 rounded-md">
                  {b.code}
                </span>
                <h3 className="font-extrabold text-base text-slate-900 mt-2">{b.name}</h3>
                {b.name_urdu && <p className="font-urdu text-xs text-slate-500">{b.name_urdu}</p>}
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  b.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {b.status}
                </span>
                {user?.role === 'admin' && (
                  <button
                    onClick={() => openEditModal(b)}
                    className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-slate-100 rounded-lg transition"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="truncate">{b.address || 'Address not set'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span>{b.phone || 'Phone not set'}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span>Manager: <b>{b.manager_name || 'Unassigned'}</b></span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span>Hours: {b.opening_time} - {b.closing_time}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="bg-slate-50 p-2 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Invoices</span>
                <p className="font-black text-slate-900">{b.total_sales_count || 0}</p>
              </div>
              <div className="bg-amber-50 p-2 rounded-xl">
                <span className="text-[10px] text-amber-700 uppercase font-semibold">Total Sales</span>
                <p className="font-black text-amber-900">Rs. {Number(b.total_sales_amount || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ADD / EDIT BRANCH MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-base text-slate-900">
                {editId ? 'Edit Branch' : 'Add New Branch'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Branch Code *</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                    placeholder="e.g. BR-05"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Branch Name (English) *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  placeholder="e.g. Wapda Town Branch"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  {lang === 'ur' ? 'برانچ کا نام (اردو)' : 'Branch Name (Urdu)'}
                </label>
                <input
                  type="text"
                  value={nameUrdu}
                  onChange={(e) => setNameUrdu(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-urdu text-right"
                  placeholder={lang === 'ur' ? 'واپڈا ٹاؤن برانچ' : 'e.g. Wapda Town Branch'}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Full Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="Shop #, Plaza, Street, City"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Phone / Landline</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Branch Manager Name</label>
                  <input
                    type="text"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Opening Time</label>
                  <input
                    type="text"
                    value={openingTime}
                    onChange={(e) => setOpeningTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="08:00 AM"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Closing Time</label>
                  <input
                    type="text"
                    value={closingTime}
                    onChange={(e) => setClosingTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="11:30 PM"
                  />
                </div>
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
                  className="px-5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-sm"
                >
                  Save Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
