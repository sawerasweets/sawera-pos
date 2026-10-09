import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Settings,
  Store,
  Printer,
  Database,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Save,
  Trash2,
  X,
  ShieldAlert
} from 'lucide-react';

export function SettingsPage() {
  const { user, lang } = useAuth();
  const [settings, setSettings] = useState({});
  const [backupInfo, setBackupInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Clean demo data modal state
  const [showCleanModal, setShowCleanModal] = useState(false);
  const [cleanConfirmCode, setCleanConfirmCode] = useState('');
  const [cleanLoading, setCleanLoading] = useState(false);
  const [cleanError, setCleanError] = useState('');

  const loadSettings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sawera_token');
      const [sRes, bRes] = await Promise.all([
        fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/backup/info', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (sRes.ok) {
        const d = await sRes.json();
        setSettings(d.settings || {});
      }
      if (bRes.ok) {
        const bd = await bRes.json();
        setBackupInfo(bd);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleChange = (key, val) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaveMsg('');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sawera_token')}`
        },
        body: JSON.stringify({ settings })
      });
      if (res.ok) {
        setSaveMsg(lang === 'ur' ? 'ترتیبات کامیابی سے محفوظ ہو گئیں!' : 'Settings saved successfully!');
        setTimeout(() => setSaveMsg(''), 3000);
      }
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const token = localStorage.getItem('sawera_token');
      const res = await fetch('/api/backup/download', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Backup download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sawera_sweets_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setTimeout(() => loadSettings(), 1500);
    } catch (err) {
      alert(`Backup download error: ${err.message}`);
    }
  };

  const handleRestoreFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const warnMsg = lang === 'ur'
      ? 'تنبیہ: بیک اپ بحال کرنے سے موجودہ ڈیٹا فائل کے ڈیٹا سے بدل جائے گا۔ کیا آپ جاری رکھنا چاہتے ہیں؟'
      : 'WARNING: Restoring will overwrite existing database records with the backup file data. Are you sure?';

    if (!confirm(warnMsg)) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target.result);
        const res = await fetch('/api/backup/restore', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('sawera_token')}`
          },
          body: JSON.stringify({ backupData })
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Restore failed');
        alert(lang === 'ur' ? 'بیک اپ کامیابی سے بحال ہو گیا! سسٹم ریفریش ہو رہا ہے...' : 'Database restored successfully! Reloading...');
        window.location.reload();
      } catch (err) {
        alert(`Restore error: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleClearSales = async () => {
    const promptMsg = lang === 'ur'
      ? 'کیا آپ تمام ٹیسٹ سیلز اور آرڈر ہسٹری صاف کرنا چاہتے ہیں؟ آپ کے پراڈکٹس اور انوینٹری محفوظ رہیں گے، صرف سیلز 0 ہو جائیں گی۔'
      : 'Clear all test sales and order history? Products and inventory will be preserved, only sales will reset to 0.';

    if (!confirm(promptMsg)) return;
    try {
      const res = await fetch('/api/sales/clear-all-sales', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('sawera_token')}` }
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to clear sales');
      alert(lang === 'ur' ? 'تمام سیلز کامیابی سے صاف ہو گئیں! اب سیلز 0 سے شروع ہوں گی۔' : d.message);
      window.location.reload();
    } catch (err) {
      alert(`Clear sales failed: ${err.message}`);
    }
  };

  const handleCleanDemoData = async (e) => {
    e.preventDefault();
    if (cleanConfirmCode !== 'START_FRESH') {
      setCleanError(lang === 'ur' ? 'تصدیق کے لیے START_FRESH لکھنا ضروری ہے' : 'Please type START_FRESH exactly to confirm.');
      return;
    }

    setCleanLoading(true);
    setCleanError('');

    try {
      const res = await fetch('/api/backup/clean-demo-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sawera_token')}`
        },
        body: JSON.stringify({ confirmationCode: cleanConfirmCode })
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Operation failed');

      alert(lang === 'ur'
        ? 'ڈیمو ٹرانزیکشنز ختم کر دی گئیں۔ برانچز، ایڈمن یوزرز اور سیٹنگز محفوظ ہیں۔ سسٹم اب لائیو پروڈکشن کے لیے تیار ہے!'
        : 'All demo transactional data wiped! Settings, 4 branches, and admin accounts preserved. System is ready for live production.');
      setShowCleanModal(false);
      window.location.reload();
    } catch (err) {
      setCleanError(err.message);
    } finally {
      setCleanLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>{lang === 'ur' ? 'سسٹم ترتیبات و بیک اپ' : 'Settings & Database Backup'}</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {lang === 'ur'
              ? 'کاروباری شناخت، رسید پرنٹنگ، ٹیکس ریٹ، بیک اپ اور اسٹاک کی ترتیبات'
              : 'Configure business identity, thermal receipt branding, tax rates, backups and inventory thresholds'}
          </p>
        </div>

        {saveMsg && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{saveMsg}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        
        {/* SECTION 1: BUSINESS IDENTITY */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-2 border-b pb-3 border-slate-100">
            <Store className="w-5 h-5 text-amber-600" />
            <span>{lang === 'ur' ? 'کاروبار کی شناخت و معلومات' : 'Business Branding & Information'}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold mb-1">
                {lang === 'ur' ? 'کاروبار کا نام (انگریزی)' : 'Business Name (English)'}
              </label>
              <input
                type="text"
                value={settings.business_name || ''}
                onChange={(e) => handleChange('business_name', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">
                {lang === 'ur' ? 'کاروبار کا نام (اردو)' : 'Business Name (Urdu)'}
              </label>
              <input
                type="text"
                value={settings.business_name_urdu || ''}
                onChange={(e) => handleChange('business_name_urdu', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-urdu text-right font-bold text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">
                {lang === 'ur' ? 'ہیلپ لائن فون نمبر' : 'Main Helpline Phone'}
              </label>
              <input
                type="text"
                value={settings.phone || ''}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">
                {lang === 'ur' ? 'آفیشل ای میل' : 'Official Email'}
              </label>
              <input
                type="email"
                value={settings.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">
                {lang === 'ur' ? 'ہیڈ آفس کا پتہ' : 'Head Office Address'}
              </label>
              <input
                type="text"
                value={settings.address || ''}
                onChange={(e) => handleChange('address', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold mb-1">
                  {lang === 'ur' ? 'این ٹی این نمبر' : 'NTN #'}
                </label>
                <input
                  type="text"
                  value={settings.ntn || ''}
                  onChange={(e) => handleChange('ntn', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  {lang === 'ur' ? 'کرنسی کوڈ' : 'Currency Code'}
                </label>
                <input
                  type="text"
                  value={settings.currency || 'Rs.'}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: THERMAL RECEIPT & PRINTING SETTINGS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-2 border-b pb-3 border-slate-100">
            <Printer className="w-5 h-5 text-amber-600" />
            <span>{lang === 'ur' ? 'تھرمل رسید و پرنٹر کی ترتیبات' : 'Thermal Receipt & Printer Configuration'}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold mb-1">
                {lang === 'ur' ? 'ڈیفالٹ پرنٹر سائز' : 'Default Receipt Width'}
              </label>
              <select
                value={settings.printer_type || 'thermal_80'}
                onChange={(e) => handleChange('printer_type', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
              >
                <option value="thermal_80">{lang === 'ur' ? 'تھرمل 80 ملی میٹر (معیاری رسید)' : 'Thermal 80mm (Standard POS Receipt)'}</option>
                <option value="thermal_58">{lang === 'ur' ? 'تھرمل 58 ملی میٹر (چھوٹا موبائل پرنٹر)' : 'Thermal 58mm (Small Mobile Printer)'}</option>
                <option value="a4">{lang === 'ur' ? 'A4 معیاری ٹیکس انوائس' : 'Standard A4 Tax Invoice'}</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">
                {lang === 'ur' ? 'فروخت کے بعد خودکار پرنٹ' : 'Auto-open Print dialog after POS sale'}
              </label>
              <select
                value={settings.auto_print_receipt || 'true'}
                onChange={(e) => handleChange('auto_print_receipt', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
              >
                <option value="true">{lang === 'ur' ? 'ہاں، خودکار پرنٹ کریں' : 'Yes, Auto Print'}</option>
                <option value="false">{lang === 'ur' ? 'نہیں، دستی پرنٹ کریں' : 'No, Manual Print'}</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">
                {lang === 'ur' ? 'رسید کا ہیڈر (انگریزی)' : 'Receipt Header Line (English)'}
              </label>
              <input
                type="text"
                value={settings.receipt_header || ''}
                onChange={(e) => handleChange('receipt_header', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">
                {lang === 'ur' ? 'رسید کا ہیڈر (اردو)' : 'Receipt Header Line (Urdu)'}
              </label>
              <input
                type="text"
                value={settings.receipt_header_urdu || ''}
                onChange={(e) => handleChange('receipt_header_urdu', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-urdu text-right"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">
                {lang === 'ur' ? 'رسید کا فوٹر (انگریزی)' : 'Receipt Footer Line (English)'}
              </label>
              <input
                type="text"
                value={settings.receipt_footer || ''}
                onChange={(e) => handleChange('receipt_footer', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">
                {lang === 'ur' ? 'رسید کا فوٹر (اردو)' : 'Receipt Footer Line (Urdu)'}
              </label>
              <input
                type="text"
                value={settings.receipt_footer_urdu || ''}
                onChange={(e) => handleChange('receipt_footer_urdu', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-urdu text-right"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: INVENTORY SAFETY & CONTROLS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-2 border-b pb-3 border-slate-100">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span>{lang === 'ur' ? 'اسٹاک کنٹرول اور حدیں' : 'Inventory Guard & Thresholds'}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold mb-1">
                {lang === 'ur' ? 'اسٹاک ختم ہونے پر بھی فروخت کی اجازت دیں؟' : 'Allow Negative Stock at POS Checkout'}
              </label>
              <select
                value={settings.allow_negative_stock || 'false'}
                onChange={(e) => handleChange('allow_negative_stock', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
              >
                <option value="false">{lang === 'ur' ? 'سختی سے روکیں (تجویز کردہ)' : 'Strictly Prevent Negative Stock (Recommended)'}</option>
                <option value="true">{lang === 'ur' ? 'اسٹاک 0 ہونے کے باوجود بیچنے کی اجازت دیں' : 'Allow Selling Even If Stock Reaches 0'}</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">
                {lang === 'ur' ? 'کم اسٹاک کی وارننگ حد' : 'Global Default Low Stock Threshold'}
              </label>
              <input
                type="number"
                value={settings.low_stock_threshold || '10'}
                onChange={(e) => handleChange('low_stock_threshold', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
              />
            </div>
          </div>
        </div>

        {/* Save Settings Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center space-x-2 rtl:space-x-reverse bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-md transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{lang === 'ur' ? 'ترتیبات محفوظ کریں' : 'Save System Settings'}</span>
          </button>
        </div>

      </form>

      {/* SECTION 4: DATABASE BACKUP, RESTORE & CLEAN DEMO */}
      {user?.role === 'admin' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 mt-8">
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2 border-b pb-3 border-slate-100">
            <Database className="w-5 h-5 text-amber-600" />
            <span>{lang === 'ur' ? 'ڈیٹا بیس بیک اپ، بحالی اور سسٹم کی صفائی' : 'Database Backup, Restore & System Maintenance'}</span>
          </h3>

          {backupInfo && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 font-semibold">{lang === 'ur' ? 'ڈیٹا بیس سائز:' : 'Database Size:'}</span>
                <p className="font-black text-slate-900 text-sm">{backupInfo.db_size_mb} MB</p>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">{lang === 'ur' ? 'آخری بیک اپ تاریخ:' : 'Last Backup Export:'}</span>
                <p className="font-bold text-slate-800 text-xs truncate">
                  {backupInfo.last_backup !== 'Never' ? new Date(backupInfo.last_backup).toLocaleString() : (lang === 'ur' ? 'کبھی نہیں' : 'Never')}
                </p>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">{lang === 'ur' ? 'کل آئٹمز و فروخت:' : 'Total Products / Sales:'}</span>
                <p className="font-bold text-slate-800 text-xs">
                  {backupInfo.record_counts?.products || 0} {lang === 'ur' ? 'پراڈکٹس' : 'Products'} | {backupInfo.record_counts?.sales || 0} {lang === 'ur' ? 'سیلز' : 'Sales'}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            
            {/* Download Backup */}
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="p-4 rounded-xl border border-slate-300 hover:border-amber-500 bg-white hover:bg-amber-50/50 transition flex flex-col items-center justify-center text-center space-y-2 group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-110 transition">
                <Download className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xs text-slate-900">
                {lang === 'ur' ? 'مکمل بیک اپ ڈاؤن لوڈ کریں' : 'Download Complete Backup'}
              </span>
              <span className="text-[11px] text-slate-500">
                {lang === 'ur' ? 'پورا SQLite ڈیٹا بیس محفوظ کریں' : 'Exports entire SQLite database as a JSON dump'}
              </span>
            </button>

            {/* Restore from File */}
            <label className="p-4 rounded-xl border border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/50 transition flex flex-col items-center justify-center text-center space-y-2 group cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center group-hover:scale-110 transition">
                <Upload className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xs text-slate-900">
                {lang === 'ur' ? 'فائل سے بیک اپ بحال کریں' : 'Restore from Backup File'}
              </span>
              <span className="text-[11px] text-slate-500">
                {lang === 'ur' ? 'پہلے سے محفوظ شدہ فائل اپ لوڈ کریں' : 'Upload and import a previously saved JSON backup'}
              </span>
              <input type="file" accept=".json" onChange={handleRestoreFile} className="hidden" />
            </label>

            {/* Remove Demo Data / Start Fresh (ADMIN ONLY) */}
            <button
              type="button"
              onClick={() => {
                setCleanConfirmCode('');
                setCleanError('');
                setShowCleanModal(true);
              }}
              className="p-4 rounded-xl border-2 border-rose-300 hover:border-rose-600 bg-rose-50/40 hover:bg-rose-100/50 transition flex flex-col items-center justify-center text-center space-y-2 group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-rose-600 text-white flex items-center justify-center group-hover:scale-110 transition shadow-sm">
                <Trash2 className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xs text-rose-800">
                {lang === 'ur' ? 'ڈیمو ڈیٹا ختم کریں (نیا آغاز)' : 'Remove Demo Data / Start Fresh'}
              </span>
              <span className="text-[11px] text-rose-600 font-medium">
                {lang === 'ur' ? 'فرضی بل ختم کریں اور اسٹاک 0 کریں' : 'Wipe demo transactions & reset stock to 0'}
              </span>
            </button>

            {/* Clear Sales History */}
            <button
              type="button"
              onClick={handleClearSales}
              className="p-4 rounded-xl border border-slate-300 hover:border-amber-500 bg-white hover:bg-amber-50/50 transition flex flex-col items-center justify-center text-center space-y-2 group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center group-hover:scale-110 transition">
                <Trash2 className="w-5 h-5 text-amber-700" />
              </div>
              <span className="font-extrabold text-xs text-slate-800">
                {lang === 'ur' ? 'تمام سیلز ہسٹری صاف کریں' : 'Clear Sales History'}
              </span>
              <span className="text-[11px] text-slate-500">
                {lang === 'ur' ? 'پراڈکٹس محفوظ رہیں گے، صرف سیلز 0 ہو جائیں گی' : 'Reset test sales to 0 while keeping products'}
              </span>
            </button>

          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: REMOVE DEMO DATA / START FRESH */}
      {showCleanModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in-95">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-rose-200 overflow-hidden">
            <div className="p-4 bg-rose-600 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-200" />
                <span>{lang === 'ur' ? 'ڈیمو ڈیٹا ختم کریں اور نیا آغاز کریں' : 'Remove Demo Data / Start Fresh'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCleanModal(false)}
                className="p-1 hover:bg-white/10 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCleanDemoData} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-amber-900">
                <p className="font-bold text-xs">
                  {lang === 'ur' ? 'سسٹم سیف گارڈ تفصیلات:' : 'System Safety Guarantees:'}
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px]">
                  <li>
                    <strong>{lang === 'ur' ? 'محفوظ رہے گا: ' : 'PRESERVED: '}</strong>
                    {lang === 'ur'
                      ? 'سسٹم سیٹنگز، تمام 4 برانچیں، ایڈمن اکاؤنٹس، پرنٹر سیٹنگز اور کیٹلاگ ڈھانچہ۔'
                      : 'System settings, 4 branch setups, Admin accounts, printer configs & catalog schema.'}
                  </li>
                  <li>
                    <strong>{lang === 'ur' ? 'صاف ہو جائے گا: ' : 'WIPED: '}</strong>
                    {lang === 'ur'
                      ? 'تمام فرضی بل، فروخت، خریداریاں، اخراجات، شفٹس، کوٹیشنز اور ادھار کھاتے۔ تمام برانچوں میں اسٹاک 0 ہو جائے گا۔'
                      : 'All demo sales, invoices, purchases, returns, expenses, shifts, and udhaar balances. Inventory reset to 0.'}
                  </li>
                </ul>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ur'
                    ? 'تصدیق کے لیے نیچے START_FRESH لکھیں:'
                    : 'To confirm wipe, type START_FRESH below:'}
                </label>
                <input
                  type="text"
                  required
                  value={cleanConfirmCode}
                  onChange={(e) => setCleanConfirmCode(e.target.value)}
                  placeholder="START_FRESH"
                  className="w-full text-sm font-mono font-bold px-3 py-2 border-2 border-rose-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 uppercase tracking-wider"
                />
              </div>

              {cleanError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 font-bold text-[11px]">
                  {cleanError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCleanModal(false)}
                  className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  {lang === 'ur' ? 'منسوخ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={cleanLoading || cleanConfirmCode !== 'START_FRESH'}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>
                    {cleanLoading
                      ? (lang === 'ur' ? 'صفائی جاری ہے...' : 'Wiping Demo Data...')
                      : (lang === 'ur' ? 'ڈیمو ڈیٹا ختم کریں' : 'Confirm Wipe & Start Fresh')}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
