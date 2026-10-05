import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Store,
  Globe,
  User,
  LogOut,
  Key,
  Shield,
  Layers,
  ChevronDown,
  ShoppingBag,
  PlusCircle,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

export function Navbar({ onNavigate }) {
  const { user, branches, activeBranchId, switchBranch, activeRegister, lang, toggleLanguage, setLanguage, logout, t } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [changePassModal, setChangePassModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passMsg, setPassMsg] = useState('');

  const canSwitchBranch = user?.role === 'admin' || user?.permissions?.includes('view_all_branches');

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPassMsg('');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sawera_token')}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPassMsg('Password changed successfully!');
      setTimeout(() => {
        setChangePassModal(false);
        setCurrentPassword('');
        setNewPassword('');
        setPassMsg('');
      }, 1500);
    } catch (err) {
      setPassMsg(`Error: ${err.message}`);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs no-print">
      <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between">
        
        {/* Left: Brand Identity & Active Branch */}
        <div className="flex items-center space-x-3 rtl:space-x-reverse">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-rose-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-amber-600/20 font-bold text-xl">
            🍬
          </div>
          <div>
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <h1 className="font-extrabold text-slate-900 tracking-tight text-base sm:text-lg flex items-center gap-1.5">
                <span>{lang === 'ur' ? 'سویرا سویٹس اینڈ بیکرز' : 'Sawera Sweet & Bakers'}</span>
              </h1>
              <span className="hidden sm:inline-block text-[11px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                4 Branches Active
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {lang === 'ur' ? 'خالص دیسی گھی کی مٹھائیاں، کیک اور بیکری' : 'Pure Desi Ghee Sweets & Fresh Bakery Retail'}
            </p>
          </div>
        </div>

        {/* Center: Branch Selector (for Admins / Multi-branch managers) */}
        <div className="hidden md:flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
          <Store className="w-4 h-4 text-slate-500 ml-2 mr-1 rtl:ml-1 rtl:mr-2" />
          <span className="text-xs font-semibold text-slate-600 mr-2 rtl:ml-2">
            {t('branch')}:
          </span>
          {canSwitchBranch ? (
            <select
              value={activeBranchId}
              onChange={(e) => switchBranch(e.target.value)}
              className="bg-white text-xs font-bold text-slate-800 py-1.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
            >
              <option value="all">{t('all_branches')} (Consolidated)</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.code} - {lang === 'ur' && b.name_urdu ? b.name_urdu : b.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="bg-white text-xs font-bold text-slate-800 py-1.5 px-3 rounded-lg border border-slate-200">
              {branches.find(b => String(b.id) === String(activeBranchId))?.name || 'Assigned Branch'}
            </span>
          )}
        </div>

        {/* Right Controls: Register status, Language, Quick Actions, Profile */}
        <div className="flex items-center space-x-2 sm:space-x-3 rtl:space-x-reverse">

          {/* Register Status Indicator */}
          <button
            onClick={() => onNavigate('cash')}
            className={`hidden lg:flex items-center space-x-1.5 rtl:space-x-reverse px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
              activeRegister
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
            }`}
            title="Click to manage shift cash drawer"
          >
            <span className={`w-2 h-2 rounded-full ${activeRegister ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span>{activeRegister ? t('active_register') : t('closed_register')}</span>
          </button>

          {/* POS Quick Button */}
          <button
            onClick={() => onNavigate('pos')}
            className="flex items-center space-x-1.5 rtl:space-x-reverse bg-gradient-to-r from-amber-600 to-rose-600 text-white text-xs sm:text-sm font-bold px-3 py-1.5 rounded-lg shadow-sm hover:from-amber-700 hover:to-rose-700 transition cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{lang === 'ur' ? 'پی او ایس بلنگ' : 'POS Billing'}</span>
          </button>

          {/* Explicit Language Switcher: English | اردو */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold shadow-2xs">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                lang === 'en' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLanguage('ur')}
              className={`px-2.5 py-1 rounded-md transition font-urdu cursor-pointer ${
                lang === 'ur' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              اردو
            </button>
          </div>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center space-x-2 rtl:space-x-reverse p-1.5 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                {user?.username ? user.username.slice(0, 2) : 'AD'}
              </div>
              <div className="hidden xl:block text-left rtl:text-right">
                <div className="text-xs font-bold text-slate-800 leading-tight">
                  {user?.name || (lang === 'ur' ? 'ایڈمن' : 'Admin User')}
                </div>
                <div className="text-[10px] font-extrabold text-amber-600 uppercase">
                  ADMIN
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs">
                <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50">
                  <p className="font-bold text-slate-900">{user?.name}</p>
                  <p className="text-slate-500 text-[11px] truncate">{user?.email || user?.username}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 uppercase">
                    {lang === 'ur' ? 'رول: ایڈمن (مکمل اختیارات)' : 'Role: ADMIN (Full Access)'}
                  </span>
                </div>

                <button
                  onClick={() => { setProfileOpen(false); setChangePassModal(true); }}
                  className="w-full flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 hover:bg-slate-100 text-slate-700 text-left rtl:text-right"
                >
                  <Key className="w-4 h-4 text-slate-400" />
                  <span>Change Password</span>
                </button>

                <button
                  onClick={() => { setProfileOpen(false); logout(); }}
                  className="w-full flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 hover:bg-rose-50 text-rose-600 font-semibold text-left rtl:text-right border-t border-slate-100"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>{t('logout')}</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Change Password Modal */}
      {changePassModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-600" />
              <span>Change Password</span>
            </h3>
            <form onSubmit={handlePasswordChange} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Password (min 6 chars)</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {passMsg && (
                <p className={`text-xs font-semibold ${passMsg.includes('Error') ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {passMsg}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setChangePassModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
