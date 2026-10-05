import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  History,
  Search,
  Filter,
  ShieldAlert,
  User,
  Clock
} from 'lucide-react';

export function AuditLogPage() {
  const { lang } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/audit?search=${search}&action=${actionFilter}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sawera_token')}` }
      });
      if (res.ok) {
        const d = await res.json();
        setLogs(d.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [search, actionFilter]);

  return (
    <div className="space-y-5 pb-12">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <span>{lang === 'ur' ? 'آڈٹ لاگ و سرگرمیاں' : 'Enterprise Audit Log & Security Trail'}</span>
          <span className="text-xs bg-slate-100 text-slate-800 font-extrabold px-2.5 py-0.5 rounded-full">
            {logs.length} Logged Events
          </span>
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Immutable tracking of price modifications, product creation/deletion, stock alterations, expense recording &amp; sales
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by action, user or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="text-xs font-semibold py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl"
        >
          <option value="all">All Actions</option>
          <option value="POS_SALE">POS Sales</option>
          <option value="PRICE_CHANGE">Price Changes</option>
          <option value="STOCK_ADJUSTMENT">Stock Adjustments</option>
          <option value="CREATE_PRODUCT">Product Created</option>
          <option value="DELETE_PRODUCT">Product Deleted</option>
          <option value="CREATE_EXPENSE">Expenses Recorded</option>
          <option value="LOGIN">User Logins</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold">
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">User</th>
                <th className="py-3 px-3">Branch</th>
                <th className="py-3 px-3">Action Event</th>
                <th className="py-3 px-3">Entity Scope</th>
                <th className="py-3 px-3">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900">
                    @{l.username}
                  </td>
                  <td className="py-3 px-3 text-slate-600 font-semibold">
                    {l.branch_name || 'Global'}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${
                      l.action.includes('PRICE') || l.action.includes('DELETE')
                        ? 'bg-rose-100 text-rose-800'
                        : l.action.includes('CREATE') || l.action.includes('SALE')
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}>
                      {l.action}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-700">
                    {l.entity}
                  </td>
                  <td className="py-3 px-3 text-slate-800">
                    {l.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
