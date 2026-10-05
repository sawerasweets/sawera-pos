import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Layers,
  Truck,
  Users,
  Building2,
  Receipt,
  FileText,
  DollarSign,
  BarChart3,
  GitBranch,
  ShieldCheck,
  History,
  Settings,
  Sparkles,
  ChefHat,
  Trash2,
  ClipboardCheck
} from 'lucide-react';

export function Sidebar({ currentTab, onSelectTab }) {
  const { user, hasPermission, t, lang } = useAuth();

  const navItems = [
    {
      id: 'dashboard',
      label: t('nav_dashboard'),
      icon: LayoutDashboard,
      allowed: true // Everyone can see dashboard or branch overview
    },
    {
      id: 'pos',
      label: t('nav_pos'),
      icon: ShoppingBag,
      highlight: true,
      allowed: hasPermission('pos_access')
    },
    {
      id: 'products',
      label: t('nav_products'),
      icon: Package,
      allowed: user?.role === 'admin' || user?.role === 'manager' || hasPermission('manage_products')
    },
    {
      id: 'inventory',
      label: t('nav_inventory'),
      icon: Layers,
      allowed: user?.role === 'admin' || user?.role === 'manager' || hasPermission('manage_inventory')
    },
    {
      id: 'production',
      label: t('nav_production'),
      icon: ChefHat,
      allowed: user?.role === 'admin' || user?.role === 'manager' || hasPermission('manage_inventory')
    },
    {
      id: 'waste',
      label: t('nav_waste'),
      icon: Trash2,
      allowed: user?.role === 'admin' || user?.role === 'manager' || hasPermission('manage_inventory')
    },
    {
      id: 'stock-audit',
      label: t('nav_stock_audit'),
      icon: ClipboardCheck,
      allowed: user?.role === 'admin' || user?.role === 'manager' || hasPermission('manage_inventory')
    },
    {
      id: 'purchases',
      label: t('nav_purchases'),
      icon: Truck,
      allowed: user?.role === 'admin' || user?.role === 'manager' || hasPermission('manage_purchases')
    },
    {
      id: 'customers',
      label: t('nav_customers'),
      icon: Users,
      allowed: hasPermission('pos_access') || hasPermission('manage_customers')
    },
    {
      id: 'suppliers',
      label: t('nav_suppliers'),
      icon: Building2,
      allowed: user?.role === 'admin' || user?.role === 'manager' || hasPermission('manage_suppliers')
    },
    {
      id: 'expenses',
      label: t('nav_expenses'),
      icon: Receipt,
      allowed: user?.role === 'admin' || user?.role === 'manager' || hasPermission('manage_expenses')
    },
    {
      id: 'sales',
      label: t('nav_sales'),
      icon: FileText,
      allowed: true
    },
    {
      id: 'cash',
      label: t('nav_cash'),
      icon: DollarSign,
      allowed: hasPermission('pos_access') || hasPermission('cash_register')
    },
    {
      id: 'reports',
      label: t('nav_reports'),
      icon: BarChart3,
      allowed: user?.role === 'admin' || user?.role === 'manager' || hasPermission('view_reports')
    },
    {
      id: 'branches',
      label: t('nav_branches'),
      icon: GitBranch,
      allowed: user?.role === 'admin' || hasPermission('manage_branches')
    },
    {
      id: 'users',
      label: t('nav_users'),
      icon: ShieldCheck,
      allowed: user?.role === 'admin' || hasPermission('manage_users')
    },
    {
      id: 'audit',
      label: t('nav_audit'),
      icon: History,
      allowed: user?.role === 'admin'
    },
    {
      id: 'settings',
      label: t('nav_settings'),
      icon: Settings,
      allowed: user?.role === 'admin' || hasPermission('manage_settings')
    }
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex-shrink-0 flex flex-col justify-between select-none shadow-xl border-r border-slate-800 no-print">
      
      {/* Navigation Links */}
      <div className="py-4 px-3 space-y-1 overflow-y-auto max-h-[calc(100vh-120px)]">
        <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {lang === 'ur' ? 'مین مینو' : 'Main Menu'}
        </div>

        {navItems.filter(item => item.allowed).map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          if (item.highlight) {
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all mb-2 cursor-pointer shadow-md ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-amber-600/30'
                    : 'bg-gradient-to-r from-amber-600/80 to-rose-600/80 hover:from-amber-600 hover:to-rose-600 text-white'
                }`}
              >
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <Icon className="w-5 h-5 text-white animate-bounce-subtle" />
                  <span>{item.label}</span>
                </div>
                <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold">
                  F1
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center space-x-3 rtl:space-x-reverse px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20 font-bold'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-100'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Footer Branding Info */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/50 text-[11px] text-slate-400 flex items-center justify-between">
        <div>
          <p className="font-bold text-slate-300">Sawera POS v2.0</p>
          <p className="text-[10px] text-slate-500">4 Branches Linked</p>
        </div>
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="System Online" />
      </div>

    </aside>
  );
}
