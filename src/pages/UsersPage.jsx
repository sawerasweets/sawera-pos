import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  Plus,
  User,
  Key,
  Edit,
  Trash2,
  X,
  CheckCircle2,
  Lock
} from 'lucide-react';

export function UsersPage() {
  const { branches, lang } = useAuth();
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [branchId, setBranchId] = useState('1');
  const [phone, setPhone] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('sawera_token')}` }
      });
      if (res.ok) {
        const d = await res.json();
        setUsersList(d.users || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openCreateModal = () => {
    setEditId(null);
    setUsername('');
    setName('');
    setEmail('');
    setPassword('');
    setBranchId('1');
    setPhone('');
    setShowModal(true);
  };

  const openEditModal = (u) => {
    setEditId(u.id);
    setUsername(u.username);
    setName(u.name);
    setEmail(u.email || '');
    setPassword('');
    setBranchId(String(u.branch_id || '1'));
    setPhone(u.phone || '');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editId ? `/api/users/${editId}` : '/api/users';
      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sawera_token')}`
        },
        body: JSON.stringify({
          username,
          name,
          email,
          password,
          role: 'admin',
          branch_id: branchId,
          phone
        })
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');

      alert(editId ? (lang === 'ur' ? 'ایڈمن اپ ڈیٹ ہو گیا' : 'Admin updated successfully!') : (lang === 'ur' ? 'نیا ایڈمن کامیابی سے شامل ہو گیا' : 'Admin created successfully!'));
      setShowModal(false);
      loadUsers();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm(lang === 'ur' ? 'کیا آپ اس ایڈمن کو غیر فعال کرنا چاہتے ہیں؟' : 'Are you sure you want to deactivate this admin account?')) {
      return;
    }
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('sawera_token')}` }
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to deactivate');
      loadUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>{lang === 'ur' ? 'ایڈمن اکاؤنٹس کا انتظام' : 'Admin Accounts Management'}</span>
            <span className="text-xs bg-amber-100 text-amber-800 font-extrabold px-2.5 py-0.5 rounded-full">
              {usersList.length} {lang === 'ur' ? 'ایڈمن' : 'Admins'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {lang === 'ur'
              ? 'سسٹم میں تمام بااختیار صارفین ایڈمن کے مکمل اختیارات کے ساتھ کام کرتے ہیں'
              : 'All authorized users operate with Full Admin Access across POS, Billing, Inventory & Reports'}
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center space-x-2 rtl:space-x-reverse bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{lang === 'ur' ? 'نیا ایڈمن شامل کریں' : 'Add New Admin Account'}</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold">
                <th className="py-3 px-3">{lang === 'ur' ? 'یوزر نیم' : 'Username'}</th>
                <th className="py-3 px-3">{lang === 'ur' ? 'مکمل نام' : 'Full Name'}</th>
                <th className="py-3 px-3">{lang === 'ur' ? 'کردار / رول' : 'Role'}</th>
                <th className="py-3 px-3">{lang === 'ur' ? 'برانچ' : 'Assigned Branch'}</th>
                <th className="py-3 px-3">{lang === 'ur' ? 'رابطہ' : 'Contact'}</th>
                <th className="py-3 px-3">{lang === 'ur' ? 'اختیارات' : 'Access Level'}</th>
                <th className="py-3 px-3 text-center">{lang === 'ur' ? 'حیثیت' : 'Status'}</th>
                <th className="py-3 px-3 text-center">{lang === 'ur' ? 'کارروائی' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usersList.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3 font-bold font-mono text-slate-900">
                    @{u.username}
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-800">
                    {u.name}
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                      ADMIN
                    </span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-700">
                    {u.branch_name || (lang === 'ur' ? 'تمام برانچیں' : 'All Branches')}
                  </td>
                  <td className="py-3 px-3 text-slate-500">
                    <div>{u.phone || '-'}</div>
                    <div className="text-[10px] text-slate-400">{u.email || ''}</div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="flex items-center gap-1 font-semibold text-emerald-700">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{lang === 'ur' ? 'مکمل ایڈمن رسائی' : 'Full Admin Access (All Modules)'}</span>
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      u.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {u.status === 'active' ? (lang === 'ur' ? 'فعال' : 'Active') : (lang === 'ur' ? 'غیر فعال' : 'Inactive')}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center space-x-1 rtl:space-x-reverse">
                      <button
                        onClick={() => openEditModal(u)}
                        className="p-1 hover:bg-slate-100 text-slate-600 rounded transition cursor-pointer"
                        title={lang === 'ur' ? 'ترمیم کریں' : 'Edit Admin'}
                      >
                        <Edit className="w-4 h-4 text-amber-600" />
                      </button>
                      {u.id !== 1 && (
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                          title={lang === 'ur' ? 'غیر فعال کریں' : 'Deactivate'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT ADMIN MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  <span>{editId ? (lang === 'ur' ? 'ایڈمن معلومات میں ترمیم' : 'Edit Admin Account') : (lang === 'ur' ? 'نیا ایڈمن اکاؤنٹ شامل کریں' : 'Add New Admin Account')}</span>
                </h3>
                <p className="text-xs text-slate-400">
                  {lang === 'ur' ? 'ایڈمن کو سسٹم کے تمام ماڈیولز تک رسائی حاصل ہو گی' : 'This user will have Full Admin Access to all branches and features'}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-white/10 rounded cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              <div className="space-y-3">
                <div>
                  <label className="block font-semibold mb-1">{lang === 'ur' ? 'یوزر نیم *' : 'Username *'}</label>
                  <input
                    type="text"
                    required
                    disabled={!!editId}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:bg-slate-100 font-mono font-bold"
                    placeholder="e.g. admin2"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">{lang === 'ur' ? 'مکمل نام *' : 'Full Name *'}</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="e.g. Bilal Ahmed"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">{lang === 'ur' ? 'کردار / رول' : 'Role'}</label>
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-900 font-bold">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>ADMIN — {lang === 'ur' ? 'مکمل انتظامی اختیارات' : 'Full Admin Access (No restrictions)'}</span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">{lang === 'ur' ? 'برانچ *' : 'Primary Branch *'}</label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {lang === 'ur' && b.name_urdu ? b.name_urdu : b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">{lang === 'ur' ? 'فون نمبر' : 'Phone'}</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="0300-1234567"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">{lang === 'ur' ? 'ای میل' : 'Email'}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="admin@sawerasweets.com"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">
                    {editId ? (lang === 'ur' ? 'پاس ورڈ تبدیل کریں (خالی چھوڑیں اگر نہیں بدلنا)' : 'Change Password (leave blank to keep current)') : (lang === 'ur' ? 'پاس ورڈ *' : 'Password *')}
                  </label>
                  <input
                    type="password"
                    required={!editId}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="Min 6 characters"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-slate-600 font-semibold cursor-pointer"
                >
                  {lang === 'ur' ? 'منسوخ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-sm cursor-pointer"
                >
                  {editId ? (lang === 'ur' ? 'محفوظ کریں' : 'Save Changes') : (lang === 'ur' ? 'ایڈمن شامل کریں' : 'Create Admin')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
