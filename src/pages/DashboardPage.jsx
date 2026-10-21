import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Truck,
  Package,
  CreditCard,
  Layers,
  ArrowUpRight,
  PlusCircle,
  ShoppingBag,
  Clock,
  Sparkles,
  HandCoins,
  BookOpen
} from 'lucide-react';

export function DashboardPage({ onNavigate }) {
  const { user, activeBranchId, t, lang } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('today');

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/dashboard?branch_id=${activeBranchId}&date_range=${dateRange}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sawera_token')}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [activeBranchId, dateRange]);

  const kpis = data?.kpis || {};
  const isCashier = user?.role === 'cashier';

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header & Date Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>{lang === 'ur' ? 'کاروباری خلاصہ و ڈیش بورڈ' : 'Executive Overview & Dashboard'}</span>
            <span className="text-xs bg-amber-100 text-amber-800 font-extrabold px-2.5 py-0.5 rounded-full">
              Live
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {lang === 'ur' ? 'فروخت، خالص منافع اور یومیہ اخراجات کی لائیو صورتحال' : 'Live sales, net profit, and expense analytics telemetry'}
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center space-x-1 rtl:space-x-reverse bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setDateRange('today')}
            className={`px-3 py-1.5 rounded-lg transition ${dateRange === 'today' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {lang === 'ur' ? 'آج' : 'Today'}
          </button>
          <button
            onClick={() => setDateRange('7days')}
            className={`px-3 py-1.5 rounded-lg transition ${dateRange === '7days' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {lang === 'ur' ? 'پچھلے 7 دن' : 'Last 7 Days'}
          </button>
          <button
            onClick={() => setDateRange('month')}
            className={`px-3 py-1.5 rounded-lg transition ${dateRange === 'month' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {lang === 'ur' ? 'اس مہینے' : 'This Month'}
          </button>
        </div>
      </div>

      {/* QUICK ACTIONS BAR */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 rounded-2xl shadow-lg border border-slate-700 text-white">
        <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span>{t('quick_actions')}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          <button
            onClick={() => onNavigate('pos')}
            className="flex items-center justify-center space-x-2 rtl:space-x-reverse bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white font-bold p-2.5 rounded-xl text-xs shadow-md transition cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{t('action_new_sale')}</span>
          </button>

          <button
            onClick={() => onNavigate('products')}
            className="flex items-center justify-center space-x-2 rtl:space-x-reverse bg-slate-700 hover:bg-slate-600 text-white font-semibold p-2.5 rounded-xl text-xs transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-amber-400" />
            <span>{t('action_add_product')}</span>
          </button>

          <button
            onClick={() => onNavigate('purchases')}
            className="flex items-center justify-center space-x-2 rtl:space-x-reverse bg-slate-700 hover:bg-slate-600 text-white font-semibold p-2.5 rounded-xl text-xs transition cursor-pointer"
          >
            <Truck className="w-4 h-4 text-emerald-400" />
            <span>{t('action_new_purchase')}</span>
          </button>

          <button
            onClick={() => onNavigate('customers')}
            className="flex items-center justify-center space-x-2 rtl:space-x-reverse bg-slate-700 hover:bg-slate-600 text-white font-semibold p-2.5 rounded-xl text-xs transition cursor-pointer"
          >
            <DollarSign className="w-4 h-4 text-cyan-400" />
            <span>{t('action_receive_udhaar')}</span>
          </button>

          <button
            onClick={() => onNavigate('expenses')}
            className="flex items-center justify-center space-x-2 rtl:space-x-reverse bg-slate-700 hover:bg-slate-600 text-white font-semibold p-2.5 rounded-xl text-xs transition cursor-pointer"
          >
            <Receipt className="w-4 h-4 text-rose-400" />
            <span>{t('action_add_expense')}</span>
          </button>

          <button
            onClick={() => onNavigate('inventory')}
            className="flex items-center justify-center space-x-2 rtl:space-x-reverse bg-slate-700 hover:bg-slate-600 text-white font-semibold p-2.5 rounded-xl text-xs transition cursor-pointer"
          >
            <Layers className="w-4 h-4 text-purple-400" />
            <span>{t('action_stock_transfer')}</span>
          </button>
        </div>
      </div>

      {/* PRIMARY KPI METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Sales Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-amber-400 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('today_sales')}</span>
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              Rs. {Number(kpis.total_sales || 0).toLocaleString()}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 font-semibold mt-1">
              <span>{kpis.active_invoices !== undefined ? kpis.active_invoices : (kpis.total_invoices || 0)} Invoices</span>
              {kpis.total_returns > 0 && (
                <span className="bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded text-[11px] font-bold">
                  -{Number(kpis.total_returns).toLocaleString()} {lang === 'ur' ? 'واپسی' : 'returned'}
                </span>
              )}
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 w-16 h-16 bg-amber-50 rounded-full -z-0 opacity-50 pointer-events-none" />
        </div>

        {/* Profit Card (Hidden for Cashier) */}
        {!isCashier ? (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-emerald-400 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('net_profit')}</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-black text-emerald-700 tracking-tight">
                Rs. {Number(kpis.net_profit || 0).toLocaleString()}
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Gross: Rs. {Number(kpis.total_profit || 0).toLocaleString()} - Exp: Rs. {Number(kpis.total_expenses || 0).toLocaleString()}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Invoices Count</span>
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-black text-slate-900">
                {kpis.total_invoices || 0}
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-1">Processed today</p>
            </div>
          </div>
        )}

        {/* Expenses Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-rose-400 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('today_expenses')}</span>
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-rose-600 tracking-tight">
              Rs. {Number(kpis.total_expenses || 0).toLocaleString()}
            </h3>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Shop rent, bills &amp; logistics
            </p>
          </div>
        </div>

        {/* Payable Khata Card (پیسے دینے ہیں) */}
        <div 
          onClick={() => onNavigate?.('khata')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-amber-500 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {lang === 'ur' ? 'پیسے دینے ہیں (کھاتہ)' : 'Payable Khata (دینے ہیں)'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center group-hover:scale-105 transition">
              <HandCoins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-baseline gap-1">
              <span>Rs. {Number(kpis.total_payable_khata || 0).toLocaleString()}</span>
            </h3>
            <p className="text-xs text-slate-500 font-semibold mt-1 flex items-center justify-between">
              <span>{lang === 'ur' ? 'واجب الادا رقم و قرضہ' : 'Total money owed to others'}</span>
              <span className="text-[11px] text-amber-600 font-bold group-hover:underline">کھاتہ &rarr;</span>
            </p>
          </div>
          <div className="absolute -bottom-1 -right-1 w-16 h-16 bg-amber-50 rounded-full -z-0 opacity-40 pointer-events-none" />
        </div>

      </div>

      {/* LOWER SECTION: TOP PRODUCTS & PAYMENT METHODS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Selling Products */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <h3 className="font-bold text-sm sm:text-base text-slate-900 mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>{t('top_selling_products')}</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3 text-center">Unit</th>
                  <th className="py-2.5 px-3 text-center">Qty Sold</th>
                  <th className="py-2.5 px-3 text-right rtl:text-left">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.top_products || []).length > 0 ? (
                  data.top_products.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-semibold text-slate-900 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span>{p.product_name}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500">{p.unit}</td>
                      <td className="py-2.5 px-3 text-center font-bold">{p.total_qty}</td>
                      <td className="py-2.5 px-3 text-right rtl:text-left font-bold text-slate-900">
                        Rs. {Number(p.total_revenue).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center py-6 text-slate-400">
                      No sales recorded for this date range yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Methods Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>{t('payment_breakdown')}</span>
            </h3>

            <div className="space-y-3 mt-4">
              {(data?.payment_methods || []).map((pm, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-xs uppercase text-slate-800">{pm.payment_method}</span>
                    <p className="text-[10px] text-slate-500">{pm.count} transactions</p>
                  </div>
                  <div className="text-right rtl:text-left font-black text-sm text-slate-900">
                    Rs. {Number(pm.total).toLocaleString()}
                  </div>
                </div>
              ))}

              {(!data?.payment_methods || data.payment_methods.length === 0) && (
                <p className="text-xs text-slate-400 text-center py-4">No payment data available</p>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <button
              onClick={() => onNavigate('reports')}
              className="text-xs font-bold text-amber-700 hover:text-amber-800 transition"
            >
              View Full 19+ Analytics Reports &rarr;
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
