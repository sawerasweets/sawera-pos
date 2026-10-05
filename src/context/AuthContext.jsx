import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../i18n/translations';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('sawera_token') || null);
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('sawera_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeBranchId, setActiveBranchId] = useState(() => {
    return localStorage.getItem('sawera_branch_id') || '1';
  });

  const [branches, setBranches] = useState([]);
  const [activeRegister, setActiveRegister] = useState(null);
  const [lang, setLang] = useState(() => localStorage.getItem('sawera_lang') || 'en');
  const [loading, setLoading] = useState(true);

  // Apply RTL direction when Urdu is active
  useEffect(() => {
    localStorage.setItem('sawera_lang', lang);
    if (lang === 'ur') {
      document.documentElement.setAttribute('dir', 'rtl');
      document.documentElement.setAttribute('lang', 'ur');
    } else {
      document.documentElement.setAttribute('dir', 'ltr');
      document.documentElement.setAttribute('lang', 'en');
    }
  }, [lang]);

  // Fetch branches and active register status
  const fetchBranches = async (authToken = token) => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/branches', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches || []);
      }
    } catch (err) {
      console.error('Failed to load branches:', err);
    }
  };

  const checkRegister = async (branchId = activeBranchId, authToken = token) => {
    if (!authToken) return;
    try {
      const res = await fetch(`/api/cash-register/current?branch_id=${branchId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveRegister(data.open ? data.register : null);
      }
    } catch (err) {
      console.error('Failed to check register:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchBranches();
      checkRegister(activeBranchId);
    }
    setLoading(false);
  }, [token, activeBranchId]);

  const login = (authToken, userData) => {
    setToken(authToken);
    setUser(userData);
    localStorage.setItem('sawera_token', authToken);
    localStorage.setItem('sawera_user', JSON.stringify(userData));

    const initialBranch = userData.branch_id ? String(userData.branch_id) : '1';
    setActiveBranchId(initialBranch);
    localStorage.setItem('sawera_branch_id', initialBranch);

    fetchBranches(authToken);
    checkRegister(initialBranch, authToken);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setActiveRegister(null);
    localStorage.removeItem('sawera_token');
    localStorage.removeItem('sawera_user');
  };

  const switchBranch = (branchId) => {
    setActiveBranchId(String(branchId));
    localStorage.setItem('sawera_branch_id', String(branchId));
    checkRegister(branchId);
  };

  const toggleLanguage = () => {
    setLang(prev => prev === 'en' ? 'ur' : 'en');
  };

  const setLanguage = (newLang) => {
    if (newLang === 'en' || newLang === 'ur') {
      setLang(newLang);
    }
  };

  const t = (key) => {
    return translations[lang]?.[key] || translations['en']?.[key] || key;
  };

  const hasPermission = (permissionKey) => {
    // All authorized users have full Admin access as per specification
    return true;
  };

  const activeBranch = branches.find(b => String(b.id) === String(activeBranchId)) || {
    id: 1,
    name: 'Main Saddar Branch',
    name_urdu: 'مین صدر برانچ',
    code: 'BR-01'
  };

  return (
    <AuthContext.Provider value={{
      token,
      user,
      branches,
      activeBranchId,
      activeBranch,
      activeRegister,
      lang,
      loading,
      login,
      logout,
      switchBranch,
      toggleLanguage,
      setLanguage,
      t,
      hasPermission,
      checkRegister,
      fetchBranches
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
