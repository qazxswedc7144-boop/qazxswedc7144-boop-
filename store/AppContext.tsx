
import React, { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from './useAppStore';
import { eventBus, EVENTS } from '../services/eventBus';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const refreshData = useAppStore(s => s.refreshData);
  useEffect(() => { refreshData(); }, [refreshData]);
  return <>{children}</>;
};

export const useUI = () => {
  const store = useAppStore();
  return {
    currency: store.currency,
    setCurrency: store.setCurrency,
    version: store.version,
    toasts: store.toasts,
    addToast: store.addToast,
    removeToast: store.removeToast,
    headerAction: store.headerAction,
    setHeaderAction: store.setHeaderAction,
    refreshGlobal: store.refreshData,
    isSyncing: store.isSyncing,
    setSyncing: store.setSyncing
  };
};

export const useInventory = () => {
  const store = useAppStore();
  return { 
    products: store.products, 
    categories: store.categories,
    updateStock: store.updateStockDirectly,
    addCategory: store.addCategory,
    refreshInventory: store.refreshData 
  };
};

export const useAccounting = () => {
  const store = useAppStore();
  return { 
    products: store.products,
    sales: store.sales,
    purchases: store.purchases,
    journalEntries: store.journalEntries,
    suppliers: store.suppliers,
    customers: store.customers,
    addInvoice: store.addInvoice,
    addCustomer: (c: any) => store.addPartner(c, 'C'),
    addSupplier: (s: any) => store.addPartner(s, 'S'),
    refreshAccounting: store.refreshData 
  };
};

export const useInvoice = () => {
  const [generatedHtml, setGeneratedHtml] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  return { generatedHtml, setGeneratedHtml, isGenerating, setIsGenerating };
};

// Fix: Exported useEventBus hook to allow components to easily subscribe to internal events
export const useEventBus = (event: string, callback: (data: any) => void) => {
  useEffect(() => {
    return eventBus.subscribe(event, callback);
  }, [event, callback]);
};
