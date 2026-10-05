import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  Filter,
  DollarSign,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';

export function ReportsPage() {
  const { activeBranchId, branches, lang } = useAuth();
  const [reportType, setReportType] = useState('daily_sales');
  const [branchFilter, setBranchFilter] = useState(activeBranchId || 'all');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);

  const reportOptions = [
    { id: 'daily_sales', label: '1. Daily Sales Summary' },
    { id: 'weekly_sales', label: '2. Weekly Sales Overview' },
    { id: 'monthly_sales', label: '3. Monthly Sales Report' },
    { id: 'custom_sales', label: '4. Custom Date Range Sales' },
    { id: 'profit_loss', label: '5. Comprehensive Profit & Loss' },
    { id: 'purchases', label: '6. Purchase Orders Inward' },
    { id: 'expenses', label: '7. Expense Categories Analysis' },
    { id: 'inventory', label: '8. Inventory Valuation & Stock' },
    { id: 'low_stock', label: '9. Low Stock Threshold Report' },
    { id: 'out_of_stock', label: '10. Out of Stock Critical Report' },
    { id: 'product_sales', label: '11. Best-Selling Products Leaderboard' },
    { id: 'customers', label: '12. Customer Sales Volume' },
    { id: 'credit_udhaar', label: '13. Credit / Udhaar Aging Report' },
    { id: 'suppliers', label: '14. Supplier Accounts Payable' },
    { id: 'sales_returns', label: '15. Sales Returns & Refunds' },
    { id: 'purchase_returns', label: '16. Purchase Returns to Vendors' },
    { id: 'cashiers', label: '17. Cashier Staff Performance' },
    { id: 'branches', label: '18. Multi-Branch Comparative Audit' },
    { id: 'payment_methods', label: '19. Payment Mode (Cash/Card/Easypaisa)' }
  ];

  const fetchReport = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sawera_token');
      const url = `/api/reports/data?report_type=${reportType}&branch_id=${branchFilter}&date_from=${dateFrom}&date_to=${dateTo}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setResults(d.results || []);
        setSummary(d.summary || {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, branchFilter, dateFrom, dateTo]);

  const handleExportCsv = () => {
    const url = `/api/reports/export-csv?report_type=${reportType}&branch_id=${branchFilter}&date_from=${dateFrom}&date_to=${dateTo}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-5 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>{lang === 'ur' ? 'رپورٹس و مالیاتی تجزیات' : 'Financial Reports & Analytics'}</span>
            <span className="text-xs bg-amber-100 text-amber-800 font-extrabold px-2.5 py-0.5 rounded-full">
              19 Enterprise Reports
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Audit profit &amp; loss, sales returns, stock valuation, customer credit aging and multi-branch comparison
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 rtl:space-x-reverse px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition border border-slate-300"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Export CSV / Excel</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 rtl:space-x-reverse px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Report Selector & Date Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        
        {/* Report Dropdown */}
        <div className="md:col-span-2">
          <label className="block font-bold text-slate-700 mb-1">Select Report Type</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {reportOptions.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Branch Filter */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">Branch Scope</label>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold bg-slate-50 text-slate-900"
          >
            <option value="all">All 4 Branches Combined</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Date Range Inputs */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block font-semibold text-slate-600 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-2 py-2 border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-600 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-2 py-2 border border-slate-300 rounded-xl"
            />
          </div>
        </div>

      </div>

      {/* PROFIT & LOSS SUMMARY CARD IF SELECTED */}
      {reportType === 'profit_loss' && summary.gross_sales !== undefined && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-lg border border-slate-700 grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
          <div>
            <span className="text-slate-400 font-bold uppercase">1. Gross Revenue</span>
            <p className="text-xl font-black text-amber-400 mt-1">Rs. {Number(summary.gross_sales).toLocaleString()}</p>
          </div>
          <div>
            <span className="text-slate-400 font-bold uppercase">2. Cost of Goods (COGS)</span>
            <p className="text-xl font-black text-slate-300 mt-1">Rs. {Number(summary.cost_of_goods_sold).toLocaleString()}</p>
          </div>
          <div>
            <span className="text-slate-400 font-bold uppercase">{lang === 'ur' ? '3. مجموعی منافع' : '3. Gross Profit'}</span>
            <p className="text-xl font-black text-emerald-400 mt-1">Rs. {Number(summary.gross_profit).toLocaleString()}</p>
          </div>
          <div>
            <span className="text-slate-400 font-bold uppercase">{lang === 'ur' ? '4. اخراجات' : '4. Operating Expenses'}</span>
            <p className="text-xl font-black text-rose-400 mt-1">Rs. {Number(summary.total_expenses).toLocaleString()}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-white/10 border border-white/20">
            <span className="text-amber-300 font-black uppercase text-[10px]">{lang === 'ur' ? '5. خالص منافع' : '5. Net Profit'}</span>
            <p className="text-xl font-black text-emerald-300 mt-1">Rs. {Number(summary.net_profit).toLocaleString()}</p>
            <span className="text-[10px] text-slate-300">{lang === 'ur' ? 'مارجن: ' : 'Margin: '}{summary.profit_margin}%</span>
          </div>
        </div>
      )}

      {/* RESULTS DATA TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          {results.length > 0 ? (
            <table className="w-full text-xs text-left rtl:text-right">
              <thead>
                <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 uppercase text-[10px] font-bold">
                  {Object.keys(results[0]).map((key) => (
                    <th key={key} className="py-3 px-3">
                      {key.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    {Object.entries(row).map(([k, val], i) => (
                      <td key={i} className="py-3 px-3">
                        {typeof val === 'number' && (k.includes('total') || k.includes('amount') || k.includes('profit') || k.includes('sales') || k.includes('cost') || k.includes('balance') || k.includes('revenue')) ? (
                          <span className="font-bold text-slate-900">
                            Rs. {val.toLocaleString()}
                          </span>
                        ) : (
                          <span>{String(val !== null && val !== undefined ? val : '-')}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-16 text-center text-slate-400 text-xs">
              No records found for the selected report filters.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
