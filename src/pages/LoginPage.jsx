import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  User,
  Store,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export function LoginPage() {
  const { login, lang } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setForgotMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, rememberMe })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed. Please check credentials.');
      }

      login(data.token, data.user);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!username) {
      alert('Please enter your username/email first.');
      return;
    }
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username })
      });
      const d = await res.json();
      setForgotMsg(d.message);
    } catch (err) {
      alert(err.message);
    }
  };

  const fillCredentials = (u, p) => {
    setUsername(u);
    setPassword(p);
    setErrorMsg('');
    setForgotMsg('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-amber-950/40 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Top Visual Banner */}
        <div className="bg-gradient-to-tr from-amber-600 via-rose-600 to-amber-500 p-8 text-white text-center relative overflow-hidden">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl mx-auto shadow-inner mb-3">
            🍬
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            {lang === 'ur' ? 'سویرا سویٹس اینڈ بیکرز' : 'Sawera Sweet & Bakers'}
          </h1>
          <p className="text-xs text-amber-100/90 font-medium mt-1">
            {lang === 'ur' ? 'ریٹیل پی او ایس و 4 برانچوں کا انتظام' : 'Retail POS & Multi-Branch Management (4 Branches)'}
          </p>
        </div>

        {/* Form Body */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            
            {/* Username / Email */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Username or Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full text-xs sm:text-sm pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                  placeholder="admin or cashier1"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="font-bold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={handleForgot}
                  className="text-[11px] text-amber-700 font-semibold hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs sm:text-sm pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <span className="font-semibold text-slate-600 text-xs">Remember Login Session</span>
              </label>
            </div>

            {/* Error or Forgot message */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {forgotMsg && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 font-semibold text-xs">
                {forgotMsg}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-extrabold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to POS'}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </form>

          {/* DEMO ACCOUNTS QUICK-FILL CARDS */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center mb-2.5">
              Instant Demo Quick-Fill Roles
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => fillCredentials('admin', 'admin123')}
                className="p-2 rounded-xl border border-slate-200 hover:border-amber-500 bg-slate-50 hover:bg-amber-50 transition text-left rtl:text-right"
              >
                <div className="font-bold text-slate-900">👑 Admin / Owner</div>
                <div className="text-[10px] text-slate-500">All 4 branches &amp; profits</div>
              </button>

              <button
                type="button"
                onClick={() => fillCredentials('manager1', 'manager123')}
                className="p-2 rounded-xl border border-slate-200 hover:border-amber-500 bg-slate-50 hover:bg-amber-50 transition text-left rtl:text-right"
              >
                <div className="font-bold text-slate-900">👔 Branch Manager</div>
                <div className="text-[10px] text-slate-500">Inventory &amp; Purchases</div>
              </button>

              <button
                type="button"
                onClick={() => fillCredentials('cashier1', 'cashier123')}
                className="p-2 rounded-xl border border-slate-200 hover:border-amber-500 bg-slate-50 hover:bg-amber-50 transition text-left rtl:text-right"
              >
                <div className="font-bold text-slate-900">💵 Cashier - B1 Saddar</div>
                <div className="text-[10px] text-slate-500">POS &amp; Customer billing</div>
              </button>

              <button
                type="button"
                onClick={() => fillCredentials('cashier2', 'cashier123')}
                className="p-2 rounded-xl border border-slate-200 hover:border-amber-500 bg-slate-50 hover:bg-amber-50 transition text-left rtl:text-right"
              >
                <div className="font-bold text-slate-900">💵 Cashier - B2 Gulberg</div>
                <div className="text-[10px] text-slate-500">POS &amp; Customer billing</div>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
