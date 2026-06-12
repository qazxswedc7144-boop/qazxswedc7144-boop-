
import React from 'react';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { InventoryService } from '@/modules/inventory/services/InventoryService';
import { PurchaseRepository } from '@/database/repositories/PurchaseRepository';
import { AccountingRepository } from '@/database/repositories/AccountingRepository';
import { SupplierRepository } from '@/database/repositories/SupplierRepository';
import { SalesRepository } from '@/database/repositories/SalesRepository';
import { transactionOrchestrator, InvoiceRequest } from '@/services/transactions/transactionOrchestrator';
import { eventBus, EVENTS } from '@/services/eventBus';
import { 
  Product, Sale, Purchase, CashFlow, AccountingEntry, 
  Supplier, User, ToastMessage, Account, SystemStatus, Category 
} from '@/types';
import { CurrencyService } from '@/services/localization/CurrencyService';
import { NotificationService } from '@/context/NotificationContext';
// Removed unused db import

interface AppState {
  products: Product[];
  categories: Category[];
  sales: Sale[];
  purchases: Purchase[];
  cashFlow: CashFlow[];
  journalEntries: AccountingEntry[];
  suppliers: Supplier[];
  customers: Supplier[];
  accounts: Account[];
  version: number;
  currency: string;
  user: User | null;
  toasts: ToastMessage[];
  isSyncing: boolean;
  syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT' | 'ERROR';
  systemStatus: SystemStatus;
  headerAction: { icon: React.ReactNode; label: string; onClick: () => void } | null;
  editingInvoiceId: string | null; 
  isSettingsOpen: boolean;
  isTrialBlockedModalOpen: boolean;
  setTrialBlockedModalOpen: (isOpen: boolean) => void;

  refreshData: () => Promise<void>;
  refresh: () => Promise<void>;
  addInvoice: (invoice: InvoiceRequest) => Promise<{ success: boolean; error?: string; refId?: string }>;
  updateStockDirectly: (productId: string, delta: number) => Promise<void>;
  addPartner: (partner: Supplier, type: 'S' | 'C') => Promise<void>;
  addCategory: (category: Category) => Promise<void>;
  setUser: (user: User | null) => void;
  setCurrency: (currency: string, label?: string) => Promise<void>;
  setSyncing: (status: boolean) => void;
  setSyncStatus: (status: 'SYNCED' | 'PENDING' | 'CONFLICT' | 'ERROR') => void;
  setSystemStatus: (status: SystemStatus) => void;
  setHeaderAction: (action: { icon: React.ReactNode; label: string; onClick: () => void } | null) => void;
  setEditingInvoiceId: (id: string | null) => void;
  setSettingsOpen: (isOpen: boolean) => void;
  addToast: (message: string, type?: ToastMessage['type']) => void;
  removeToast: (id: string) => void;
}

import { db } from '@/core/db';

let activeRefreshPromise: Promise<void> | null = null;

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => {
    
    // Local-only: No Supabase realtime
    eventBus.subscribe(EVENTS.DATA_REFRESHED, async () => {
      console.log("[Store] Reactive Update Triggered by Data Refresh");
      try {
        await get().refreshData();
      } catch (e) {
        console.error("[Store] Reactive refresh failed:", e);
      }
    });

    return {
      products: [],
      categories: [],
      sales: [],
      purchases: [],
      cashFlow: [],
      journalEntries: [],
      suppliers: [],
      customers: [],
      accounts: [],
      version: 0,
      currency: 'AED',
      user: null,
      toasts: [],
      isSyncing: false,
      syncStatus: 'SYNCED',
      systemStatus: 'ACTIVE',
      headerAction: null,
      editingInvoiceId: null,
      isSettingsOpen: false,
      isTrialBlockedModalOpen: false,
      setTrialBlockedModalOpen: (isTrialBlockedModalOpen) => set({ isTrialBlockedModalOpen }),

      // Fix: refreshData now uses local repositories (Dexie) and coalescing
      refreshData: async () => {
        if (activeRefreshPromise) {
          return activeRefreshPromise;
        }

        activeRefreshPromise = (async () => {
          // Coalesce call requests occurring in a tight 30ms CPU tick
          await new Promise(resolve => setTimeout(resolve, 30));
          try {
            const [products, categories, sales, purchases, journalEntries, cashFlow, suppliers, customers, accounts] = await Promise.all([
              InventoryService.getProducts(),
              db.db.categories.toArray(),
              SalesRepository.getAll(),
              PurchaseRepository.getAll(),
              AccountingRepository.getEntries(),
              AccountingRepository.getCashFlow(),
              SupplierRepository.getSuppliers(),
              SupplierRepository.getCustomers(),
              AccountingRepository.getAccounts()
            ]);

            set({
              products,
              categories: categories as any[],
              sales,
              purchases,
              journalEntries,
              cashFlow,
              suppliers,
              customers,
              accounts,
              version: get().version + 1
            });
          } catch (error) {
            console.error("[Store] refreshData failed:", error);
          } finally {
            activeRefreshPromise = null;
          }
        })();

        return activeRefreshPromise;
      },

      refresh: async () => {
        await get().refreshData();
      },

      addInvoice: async (invoice: InvoiceRequest) => {
        try {
          const result = await transactionOrchestrator.processInvoiceTransaction(invoice);
          if (result.success) {
            await get().refreshData();
            const isDraft = (invoice.options as any)?.invoiceStatus?.includes('DRAFT');
            if (!isDraft) {
              get().addToast(`تم ترحيل ${invoice.type === 'SALE' ? 'المبيعة' : 'المشتريات'} بنجاح ✅`, 'success');
            }
            eventBus.emit(EVENTS.SYNC_REQUIRED, { type: invoice.type, payload: invoice.payload });
          }
          return result;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "فشل ترحيل العملية ❌";
          get().addToast(message, "error");
          return { success: false, error: message };
        }
      },

      updateStockDirectly: async (productId: string, delta: number) => {
        try {
          await InventoryService.updateStock(productId, delta);
          await get().refreshData();
          get().addToast("تم تحديث الرصيد المخزني 📦", "success");
        } catch (error: any) {
          get().addToast(`فشل تحديث المخزون: ${error.message}`, "error");
        }
      },

      addPartner: async (partner: Supplier, type: 'S' | 'C') => {
        try {
          await SupplierRepository.save(partner, type);
          await get().refreshData();
          get().addToast(`تم تسجيل ${type === 'S' ? 'المورد' : 'العميل'} بنجاح`, "success");
        } catch (error: any) {
          get().addToast(`فشل تسجيل الشريك: ${error.message}`, "error");
        }
      },

      addCategory: async (category: Category) => {
        try {
          await db.db.categories.put(category);
          await get().refreshData();
          get().addToast("تمت إضافة التصنيف بنجاح", "success");
        } catch (error: any) {
          get().addToast(`فشل إضافة التصنيف: ${error.message}`, "error");
        }
      },

      setUser: (user) => set({ user }),
      setCurrency: async (currency, label = 'درهم إماراتي') => {
        try {
          const code = await CurrencyService.setGlobalCurrency(currency, label);
          set({ currency: code });
        } catch (error: any) {
          get().addToast(`فشل تعيين العملة: ${error.message}`, "error");
        }
      },
      setSyncing: (isSyncing) => set({ isSyncing }),
      setSyncStatus: (syncStatus) => set({ syncStatus }),
      setSystemStatus: (systemStatus) => set({ systemStatus }),
      setHeaderAction: (headerAction) => set({ headerAction }),
      setEditingInvoiceId: (editingInvoiceId) => set({ editingInvoiceId }),
      setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
      addToast: (message, type = 'info') => {
        const mappedType = type === 'warning' ? 'warning' : type === 'success' ? 'success' : type === 'error' ? 'error' : 'info';
        NotificationService.show(message, mappedType);
        
        // Audio feedback logic
        try {
          const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g);
            g.connect(ctx.destination);
            
            // Soft sine wave for success, triangle for alerts/info
            o.type = type === "success" ? "sine" : "triangle";
            o.frequency.setValueAtTime(type === "success" ? 600 : 350, ctx.currentTime);
            g.gain.setValueAtTime(type === "success" ? 0.05 : 0.08, ctx.currentTime);
            
            o.start();
            o.stop(ctx.currentTime + 0.07);
          }
        } catch (e) {
          console.log("Audio Context not supported or blocked");
        }
      },
      removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }))
    };
  })
);
