import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Store,
  Tag,
  Package,
  Layers,
  Sparkles,
  Lock,
  Volume2,
  Check,
  Smartphone,
  ExternalLink
} from 'lucide-react';
import { CameraBarcodeModal } from '../components/CameraBarcodeModal';
import { playBeep } from '../utils/audio';

export function RateCheckerPage({ onBackToPos }) {
  const [config, setConfig] = useState({
    business_name: 'Sawera Sweet & Bakers',
    business_name_urdu: 'سویرا سویٹس اینڈ بیکرز',
    currency: 'Rs.',
    branches: []
  });
  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    return localStorage.getItem('sawera_worker_branch') || '1';
  });

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [workerPin, setWorkerPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Scanner & Search state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Result state
  const [productResult, setProductResult] = useState(null);
  const [notFoundBarcode, setNotFoundBarcode] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [recentScans, setRecentScans] = useState([]);

  // UI state
  const [lang, setLang] = useState(() => localStorage.getItem('sawera_worker_lang') || 'ur');
  const isUrdu = lang === 'ur';

  // Load config on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/rate-checker/config');
        if (res.ok) {
          const data = await res.json();
          setConfig(data);
          if (data.branches?.length > 0 && !selectedBranchId) {
            setSelectedBranchId(String(data.branches[0].id));
          }
        }
      } catch (err) {
        console.warn('Error loading rate checker config:', err);
      }
    }
    loadConfig();

    // Check existing worker token
    const token = localStorage.getItem('sawera_worker_token');
    const storedPin = localStorage.getItem('sawera_worker_pin');
    if (token || storedPin) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleBranchChange = (e) => {
    const bId = e.target.value;
    setSelectedBranchId(bId);
    localStorage.setItem('sawera_worker_branch', bId);
    // If a product is already displayed, refresh its stock for the newly selected branch
    if (productResult?.barcode) {
      lookupBarcode(productResult.barcode, bId);
    }
  };

  const toggleLanguage = () => {
    const nextLang = lang === 'ur' ? 'en' : 'ur';
    setLang(nextLang);
    localStorage.setItem('sawera_worker_lang', nextLang);
  };

  // PIN verification
  const handleVerifyPin = async (e) => {
    e.preventDefault();
    if (!workerPin.trim()) return;

    setPinLoading(true);
    setPinError('');

    try {
      const res = await fetch('/api/rate-checker/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: workerPin.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(isUrdu ? (data.error_urdu || data.error) : data.error);
      }

      localStorage.setItem('sawera_worker_token', data.token);
      localStorage.setItem('sawera_worker_pin', workerPin.trim());
      setIsAuthenticated(true);
      setWorkerPin('');
    } catch (err) {
      setPinError(err.message || 'Invalid PIN / غلط پن کوڈ');
    } finally {
      setPinLoading(false);
    }
  };

  // Product Lookup Core Handler
  const lookupBarcode = async (barcodeToSearch, branchOverride = null) => {
    if (!barcodeToSearch || !barcodeToSearch.trim()) return;
    const cleanBarcode = barcodeToSearch.trim();

    setIsSearching(true);
    setErrorMessage('');
    setNotFoundBarcode(null);

    const bId = branchOverride || selectedBranchId || '1';
    const token = localStorage.getItem('sawera_worker_token');
    const pin = localStorage.getItem('sawera_worker_pin') || '1234';

    try {
      const headers = {
        'x-worker-pin': pin
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/rate-checker/lookup/${encodeURIComponent(cleanBarcode)}?branch_id=${bId}`, {
        headers
      });

      const data = await res.json();

      if (res.status === 401) {
        // Token or PIN expired
        setIsAuthenticated(false);
        localStorage.removeItem('sawera_worker_token');
        throw new Error(isUrdu ? 'پن کوڈ دوبارہ درج کریں' : 'Please re-enter Worker PIN');
      }

      if (!res.ok || !data.found) {
        playBeep(250, 180, 'sawtooth');
        setProductResult(null);
        setNotFoundBarcode(cleanBarcode);
        return;
      }

      // Success
      playBeep(880, 120, 'sine');
      setProductResult(data.product);
      setNotFoundBarcode(null);

      // Add to recent scans list (last 3)
      setRecentScans(prev => {
        const filtered = prev.filter(p => p.id !== data.product.id);
        return [data.product, ...filtered].slice(0, 3);
      });

    } catch (err) {
      setErrorMessage(err.message || 'Failed to check price');
    } finally {
      setIsSearching(false);
    }
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    if (!manualBarcode.trim()) return;
    lookupBarcode(manualBarcode);
    setManualBarcode('');
  };

  const handleScanSuccess = (scannedCode) => {
    setIsScannerOpen(false);
    lookupBarcode(scannedCode);
  };

  // 1. PIN Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
          
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-500/30 shadow-inner">
            <Smartphone className="w-8 h-8" />
          </div>

          <h1 className="text-xl font-black text-white">
            {isUrdu ? 'موبائل ریٹ چیکر' : 'Mobile Rate Checker'}
          </h1>
          <p className="text-xs text-amber-400 font-urdu mt-1">
            {config.business_name_urdu || 'سویرا سویٹس اینڈ بیکرز'}
          </p>
          <p className="text-xs text-slate-400 mt-2">
            {isUrdu ? 'برائے مہربانی ریٹ چیکر کا 4 ہندسوں والا پن کوڈ درج کریں' : 'Please enter the 4-digit Worker PIN'}
          </p>

          <form onSubmit={handleVerifyPin} className="mt-6 space-y-4">
            <div>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                value={workerPin}
                onChange={(e) => setWorkerPin(e.target.value)}
                placeholder="PIN (e.g. 1234)"
                className="w-full py-3.5 px-4 bg-slate-950 border-2 border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 rounded-2xl text-center text-2xl font-mono tracking-widest text-white outline-none transition"
              />
              <p className="text-[11px] text-slate-500 mt-1.5">
                {isUrdu ? 'پہلے سے مقرر کردہ ڈیفالٹ پن کوڈ 1234 ہے' : 'Default PIN is 1234 (Set by Admin)'}
              </p>
            </div>

            {pinError && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-xl font-semibold">
                {pinError}
              </div>
            )}

            <button
              type="submit"
              disabled={pinLoading || !workerPin.trim()}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm rounded-2xl shadow-lg transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {pinLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>{isUrdu ? 'تصدیق کریں / Enter' : 'Verify Worker Access'}</span>
            </button>
          </form>

          {/* Quick Language & Back navigation */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <button
              type="button"
              onClick={toggleLanguage}
              className="hover:text-amber-400 font-bold transition cursor-pointer"
            >
              {isUrdu ? 'English Interface' : 'اردو انٹرفیس'}
            </button>

            {onBackToPos ? (
              <button
                type="button"
                onClick={onBackToPos}
                className="hover:text-slate-200 transition cursor-pointer flex items-center gap-1"
              >
                <span>POS Login</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            ) : (
              <a
                href="/"
                className="hover:text-slate-200 transition flex items-center gap-1"
              >
                <span>POS Login</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

        </div>
      </div>
    );
  }

  // 2. Main Authenticated Rate Checker View
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-white">
      
      {/* Top Mobile Bar */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-20 px-3 py-2.5 sm:px-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-extrabold text-xs sm:text-sm text-white leading-tight">
                {isUrdu ? 'موبائل ریٹ چیکر' : 'Mobile Rate Checker'}
              </h1>
              <p className="text-[10px] text-amber-400 font-urdu leading-none">
                {config.business_name_urdu || 'سویرا سویٹس اینڈ بیکرز'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Branch Switcher */}
            {config.branches?.length > 1 && (
              <select
                value={selectedBranchId}
                onChange={handleBranchChange}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg px-2 py-1 outline-none cursor-pointer"
                title="Select Branch / برانچ منتخب کریں"
              >
                {config.branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {isUrdu ? (b.name_urdu || b.name) : b.name}
                  </option>
                ))}
              </select>
            )}

            {/* Language Toggle */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs transition cursor-pointer border border-slate-700"
            >
              {isUrdu ? 'EN' : 'اردو'}
            </button>

            {/* Exit/Lock */}
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('sawera_worker_token');
                localStorage.removeItem('sawera_worker_pin');
                setIsAuthenticated(false);
              }}
              title="Lock Rate Checker"
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded-lg text-xs transition cursor-pointer border border-slate-700"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col justify-start gap-4">
        
        {/* Large Primary Action: SCAN PRODUCT */}
        <div className="bg-gradient-to-br from-amber-600 via-amber-700 to-amber-900 rounded-3xl p-5 shadow-2xl border border-amber-500/40 text-center relative overflow-hidden">
          
          <div className="relative z-10 flex flex-col items-center">
            <span className="text-[11px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-200 px-3 py-0.5 rounded-full mb-3 border border-amber-300/30">
              {isUrdu ? 'ریئر کیمرہ بارکوڈ سکینر' : 'Mobile Camera Scanner'}
            </span>

            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="w-full py-4 bg-white hover:bg-amber-50 text-slate-950 font-black text-lg rounded-2xl shadow-xl transition transform active:scale-95 flex items-center justify-center gap-3 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center">
                <Camera className="w-5 h-5" />
              </div>
              <span>{isUrdu ? 'پروڈکٹ سکین کریں (Scan Barcode)' : 'Scan Product Barcode'}</span>
            </button>

            <p className="text-[11px] text-amber-100/90 mt-3 font-medium">
              {isUrdu
                ? 'موبائل کیمرہ بارکوڈ کے سامنے رکھیں تاکہ فورا ریٹ معلوم ہو سکے'
                : 'Point your phone rear camera at any product barcode to check price'}
            </p>
          </div>
        </div>

        {/* Manual Barcode Search Box */}
        <form onSubmit={handleManualSearch} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 flex items-center gap-2 shadow-lg">
          <div className="pl-2 text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={manualBarcode}
            onChange={(e) => setManualBarcode(e.target.value)}
            placeholder={isUrdu ? 'یا بارکوڈ / کوڈ یہاں خود ٹائپ کریں...' : 'Or enter barcode / code manually...'}
            className="flex-1 bg-transparent border-none text-xs sm:text-sm font-mono text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSearching || !manualBarcode.trim()}
            className="px-3.5 py-2 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-40"
          >
            {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : (isUrdu ? 'معلوم کریں' : 'Check')}
          </button>
        </form>

        {/* Loading Spinner */}
        {isSearching && (
          <div className="p-8 bg-slate-900/80 rounded-3xl border border-slate-800 flex flex-col items-center justify-center gap-3 animate-pulse">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
            <p className="text-xs font-bold text-slate-300">
              {isUrdu ? 'ڈیٹابیس سے ریٹ معلوم کیا جا رہا ہے...' : 'Fetching live price from POS database...'}
            </p>
          </div>
        )}

        {/* SUCCESSFUL PRODUCT RATE CARD */}
        {productResult && !isSearching && (
          <div className="bg-slate-900 border-2 border-emerald-500/60 rounded-3xl p-5 shadow-2xl relative overflow-hidden animate-fadeIn">
            
            {/* Top Bar: Category & Stock Status */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <span className="bg-slate-800 text-slate-300 font-semibold px-2.5 py-1 rounded-lg text-xs">
                {isUrdu ? (productResult.category_name_urdu || productResult.category_name) : productResult.category_name}
              </span>

              <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                productResult.in_stock
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {productResult.in_stock
                    ? (isUrdu ? `دستیاب: ${productResult.branch_stock} ${productResult.unit}` : `In Stock: ${productResult.branch_stock} ${productResult.unit}`)
                    : (isUrdu ? 'اسٹاک ختم ہے' : 'Out of Stock')}
                </span>
              </span>
            </div>

            {/* Product Identity */}
            <div className="mt-3 flex gap-3 items-center">
              {productResult.image_url && (
                <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden shrink-0">
                  <img
                    src={productResult.image_url}
                    alt={productResult.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-black text-white leading-tight">
                  {productResult.name}
                </h2>
                {productResult.name_urdu && (
                  <p className="text-sm text-slate-400 font-urdu mt-0.5">
                    {productResult.name_urdu}
                  </p>
                )}
                <p className="text-[11px] font-mono text-slate-500 mt-1">
                  Barcode: {productResult.barcode} {productResult.code && `• SKU: ${productResult.code}`}
                </p>
              </div>
            </div>

            {/* HUGE RETAIL PRICE DISPLAY */}
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-slate-900 border border-emerald-500/40 text-center">
              <span className="text-[11px] font-black uppercase text-emerald-400 tracking-wider">
                {isUrdu ? 'موجودہ ریٹیل قیمت (Selling Price)' : 'Current Retail Selling Price'}
              </span>

              <div className="flex items-baseline justify-center gap-1.5 mt-1">
                <span className="text-lg font-bold text-emerald-400">{config.currency || 'Rs.'}</span>
                <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                  {Number(productResult.sale_price).toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  / {isUrdu ? `فی ${productResult.unit}` : `per ${productResult.unit}`}
                </span>
              </div>

              <p className="text-[10px] text-slate-400 mt-1">
                {isUrdu ? `برانچ: ${productResult.branch_name}` : `Branch: ${productResult.branch_name}`}
              </p>
            </div>

            {/* Scan Next Button */}
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="w-full mt-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-sm rounded-2xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Camera className="w-4 h-4" />
              <span>{isUrdu ? 'اگلی پروڈکٹ سکین کریں (Scan Next)' : 'Scan Next Product'}</span>
            </button>

          </div>
        )}

        {/* NOT FOUND CARD */}
        {notFoundBarcode && !isSearching && (
          <div className="bg-slate-900 border-2 border-rose-500/60 rounded-3xl p-5 shadow-2xl text-center animate-shake">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-black text-rose-300">
              {isUrdu ? 'پروڈکٹ نہیں ملی' : 'Product Not Found'}
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              {isUrdu
                ? `اس بارکوڈ (${notFoundBarcode}) کا کوئی ریکارڈ سسٹم میں نہیں ہے۔`
                : `No product was found matching barcode "${notFoundBarcode}".`}
            </p>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Camera className="w-4 h-4" />
                <span>{isUrdu ? 'دوبارہ سکین کریں' : 'Scan Again'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Generic Error Notification */}
        {errorMessage && (
          <div className="p-4 bg-rose-950/90 border border-rose-700 text-rose-200 text-xs rounded-2xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* RECENT SCANS HISTORY */}
        {recentScans.length > 0 && !productResult && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              {isUrdu ? 'حالیہ سکین شدہ پروڈکٹس' : 'Recently Checked Products'}
            </h4>
            <div className="space-y-2">
              {recentScans.map(item => (
                <div
                  key={item.id}
                  onClick={() => setProductResult(item)}
                  className="p-2.5 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl flex items-center justify-between cursor-pointer transition"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs font-bold text-white truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{item.barcode}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-emerald-400">
                      {config.currency} {Number(item.sale_price).toLocaleString()}
                    </p>
                    <p className="text-[9px] text-slate-400">/{item.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* Footer Branding & Link */}
      <footer className="max-w-md w-full mx-auto p-4 text-center text-[11px] text-slate-500">
        <p className="font-semibold text-slate-400">
          Sawera Sweets &amp; Bakers • Mobile Price Checker Terminal
        </p>
        <p className="text-[10px] text-slate-600 mt-0.5">
          {isUrdu ? 'محفوظ ریڈ آنلی موڈ • بغیر ایڈمن لاگ ان' : 'Secure Read-Only Access • No Admin Rights'}
        </p>
      </footer>

      {/* Full-Screen Camera Scanner Modal */}
      <CameraBarcodeModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScanSuccess}
        title={isUrdu ? 'بارکوڈ سکین کریں (Rear Camera)' : 'Scan Barcode (Rear Camera)'}
        allowContinuous={false}
      />

    </div>
  );
}
