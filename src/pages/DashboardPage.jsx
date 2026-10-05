import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Truck,
  Package,
  AlertTriangle,
  Users,
  Building2,
  CreditCard,
  Layers,
  ArrowUpRight,
  PlusCircle,
  ShoppingBag,
  Clock,
  Sparkles,
  ArrowRight
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
            {lang === 'ur' ? 'تمام 4 برانچوں کی فروخت، منافع اور اسٹاک کی لائیو صورتحال' : 'Multi-branch sales, profit, cash drawer, and stock alert telemetry'}
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
            <p className="text-xs text-slate-500 font-semibold mt-1">
              {kpis.total_invoices || 0} Invoices generated
            </p>
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

        {/* Cash in Hand / Drawer */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-cyan-400 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('cash_in_hand')}</span>
            <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-cyan-800 tracking-tight">
              Rs. {Number(kpis.cash_in_hand || 0).toLocaleString()}
            </h3>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Active cash drawer balance
            </p>
          </div>
        </div>

      </div>

      {/* SECONDARY METRICS (Customer Udhaar, Supplier Payables, Stock alerts) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{t('pending_udhaar')}</span>
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-lg font-bold text-slate-900">
            Rs. {Number(kpis.pending_customer_credit || 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500">{kpis.total_customers || 0} registered buyers</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{t('supplier_payables')}</span>
            <Building2 className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-lg font-bold text-slate-900">
            Rs. {Number(kpis.pending_supplier_payables || 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500">{kpis.total_suppliers || 0} wholesale vendors</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{t('low_stock_items')}</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-lg font-bold text-amber-600">
            {kpis.low_stock_count || 0} Items
          </p>
          <p className="text-[11px] text-slate-500">Need restocking</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{t('out_of_stock')}</span>
            <Package className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-lg font-bold text-rose-600">
            {kpis.out_of_stock_count || 0} Items
          </p>
          <p className="text-[11px] text-slate-500">Zero inventory in branch</p>
        </div>

      </div>

      {/* MULTI-BRANCH COMPARISON SECTION */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-600" />
              <span>{t('branch_performance')}</span>
            </h3>
            <p className="text-xs text-slate-500">Comparative revenue breakdown across Branch 1, Branch 2, Branch 3, and Branch 4</p>
          </div>
          <button
            onClick={() => onNavigate('branches')}
            className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1"
          >
            <span>Manage Branches</span>
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(data?.branch_comparison || []).map((br) => (
            <div key={br.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-extrabold bg-slate-200 text-slate-800 px-2 py-0.5 rounded">
                  {br.code}
                </span>
                <span className="text-[11px] text-slate-500 font-semibold">{br.invoice_count} sales</span>
              </div>
              <h4 className="font-bold text-sm text-slate-900 truncate">{br.name}</h4>
              <div className="mt-2 pt-2 border-t border-slate-200/80">
                <div className="text-xs text-slate-500">Revenue</div>
                <div className="text-lg font-black text-slate-900">
                  Rs. {Number(br.sales_amount || 0).toLocaleString()}
                </div>
                {!isCashier && (
                  <div className="text-[11px] font-semibold text-emerald-600 mt-0.5">
                    Profit: Rs. {Number(br.profit_amount || 0).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          ))}
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
