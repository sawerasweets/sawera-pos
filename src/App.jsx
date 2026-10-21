import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PosPage } from './pages/PosPage';
import { ProductsPage } from './pages/ProductsPage';
import { InventoryPage } from './pages/InventoryPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { CustomersPage } from './pages/CustomersPage';
import { KhataPage } from './pages/KhataPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { SalesHistoryPage } from './pages/SalesHistoryPage';
import { CashRegisterPage } from './pages/CashRegisterPage';
import { ReportsPage } from './pages/ReportsPage';
import { BranchesPage } from './pages/BranchesPage';
import { UsersPage } from './pages/UsersPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProductionPage } from './pages/ProductionPage';
import { WastePage } from './pages/WastePage';
import { StockAuditPage } from './pages/StockAuditPage';

function MainApp() {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full overflow-hidden mx-auto shadow-2xl border-2 border-emerald-500 animate-pulse bg-white">
            <img src="/logo.png?v=3" alt="Sawera Sweets & Bakers" className="w-full h-full object-cover" />
          </div>
          <p className="font-bold text-sm tracking-wide text-amber-400">Loading Sawera Sweet &amp; Bakers POS...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderActivePage = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardPage onNavigate={setCurrentTab} />;
      case 'pos':
        return <PosPage onNavigate={setCurrentTab} />;
      case 'products':
        return <ProductsPage />;
      case 'inventory':
        return <InventoryPage />;
      case 'production':
        return <ProductionPage />;
      case 'waste':
        return <WastePage />;
      case 'stock-audit':
        return <StockAuditPage />;
      case 'purchases':
        return <PurchasesPage />;
      case 'customers':
        return <CustomersPage />;
      case 'khata':
        return <KhataPage />;
      case 'suppliers':
        return <SuppliersPage />;
      case 'expenses':
        return <ExpensesPage />;
      case 'sales':
        return <SalesHistoryPage />;
      case 'cash':
        return <CashRegisterPage />;
      case 'reports':
        return <ReportsPage />;
      case 'branches':
        return <BranchesPage />;
      case 'users':
        return <UsersPage />;
      case 'audit':
        return <AuditLogPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigate={setCurrentTab} />;
    }
  };

  const isPos = currentTab === 'pos';

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 font-sans selection:bg-amber-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar currentTab={currentTab} onNavigate={setCurrentTab} />

      {/* Main Layout: Left Sidebar + Central Screen */}
      <div className="flex-1 flex overflow-hidden">
        {!isPos && (
          <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />
        )}

        <main className={`flex-1 overflow-y-auto ${isPos ? 'p-2 sm:p-3 bg-slate-100' : 'p-4 sm:p-6 bg-slate-100/90'}`}>
          <div className={isPos ? 'w-full' : 'max-w-7xl mx-auto'}>
            {renderActivePage()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
