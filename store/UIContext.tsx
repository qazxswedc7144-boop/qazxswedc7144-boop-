

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ToastMessage } from '../types';

interface HeaderAction {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

interface UIContextType {
  currency: string;
  setCurrency: (curr: string) => void;
  pageTitle: string;
  setPageTitle: (title: string) => void;
  headerAction: HeaderAction | null;
  setHeaderAction: (action: HeaderAction | null) => void;
  version: number;
  refreshGlobal: () => void;
  toasts: ToastMessage[];
  addToast: (message: string, type: ToastMessage['type']) => void;
  removeToast: (id: string) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState(localStorage.getItem('pharma_currency') || 'YER');
  const [pageTitle, setPageTitle] = useState('');
  const [headerAction, setHeaderAction] = useState<HeaderAction | null>(null);
  const [version, setVersion] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const refreshGlobal = useCallback(() => {
    setVersion(v => v + 1);
  }, []);

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const setCurrency = useCallback((curr: string) => {
    localStorage.setItem('pharma_currency', curr);
    setCurrencyState(curr);
  }, []);

  const value = React.useMemo(() => ({
    currency,
    setCurrency,
    pageTitle,
    setPageTitle,
    headerAction,
    setHeaderAction,
    version,
    refreshGlobal,
    toasts,
    addToast,
    removeToast
  }), [currency, pageTitle, headerAction, version, setCurrency, refreshGlobal, toasts, addToast, removeToast]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within UIProvider');
  return context;
};
