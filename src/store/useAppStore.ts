
import React from 'react';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { InventoryService } from '../services/InventoryService';
import { PurchaseRepository } from '../repositories/PurchaseRepository';
import { AccountingRepository } from '../repositories/AccountingRepository';
import { SupplierRepository } from '../repositories/SupplierRepository';
import { SalesRepository } from '../repositories/SalesRepository';
import { transactionOrchestrator, InvoiceRequest } from '../services/transactionOrchestrator';
import { eventBus, EVENTS } from '../services/eventBus';
import { 
  Product, Sale, Purchase, CashFlow, AccountingEntry, 
  Supplier, User, ToastMessage, Account, SystemStatus, Category 
} from '../types';
import { CurrencyService } from '../services/CurrencyService';
import { db } from '../lib/database';

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
  syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
  systemStatus: SystemStatus;
  headerAction: { icon: React.ReactNode; label: string; onClick: () => void } | null;
  editingInvoiceId: string | null; 

  refreshData: () => Promise<void>;
  addInvoice: (invoice: InvoiceRequest) => Promise<{ success: boolean; error?: string; refId?: string }>;
  updateStockDirectly: (productId: string, delta: number) => Promise<void>;
  addPartner: (partner: Supplier, type: 'S' | 'C') => Promise<void>;
  addCategory: (category: Category) => Promise<void>;
  setUser: (user: User | null) => void;
  setCurrency: (currency: string, label?: string) => Promise<void>;
  setSyncing: (status: boolean) => void;
  setSyncStatus: (status: 'SYNCED' | 'PENDING' | 'CONFLICT') => void;
  setSystemStatus: (status: SystemStatus) => void;
  setHeaderAction: (action: { icon: React.ReactNode; label: string; onClick: () => void } | null) => void;
  setEditingInvoiceId: (id: string | null) => void;
  addToast: (message: string, type?: ToastMessage['type']) => void;
  removeToast: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => {
    
    eventBus.subscribe(EVENTS.DATA_REFRESHED, () => {
      console.log("[Store] Reactive Update Triggered by Data Refresh");
      get().refreshData();
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

      // Fix: refreshData now awaits all repository calls to resolve promises
      refreshData: async () => {
        const [products, categories, sales, purchases, journalEntries, cashFlow, suppliers, customers] = await Promise.all([
          InventoryService.getProducts(),
          db.getCategories(),
          SalesRepository.getAll(),
          PurchaseRepository.getAll(),
          AccountingRepository.getEntries(),
          AccountingRepository.getCashFlow(),
          SupplierRepository.getSuppliers(),
          SupplierRepository.getCustomers(),
        ]);

        set({
          products,
          categories,
          sales,
          purchases,
          journalEntries,
          cashFlow,
          suppliers,
          customers,
          accounts: journalEntries.length > 0 ? get().accounts : [], 
          version: get().version + 1
        });
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
        await InventoryService.updateStock(productId, delta);
        await get().refreshData();
        get().addToast("تم تحديث الرصيد المخزني 📦", "success");
      },

      addPartner: async (partner: Supplier, type: 'S' | 'C') => {
        await SupplierRepository.save(partner, type);
        await get().refreshData();
        get().addToast(`تم تسجيل ${type === 'S' ? 'المورد' : 'العميل'} بنجاح`, "success");
      },

      addCategory: async (category: Category) => {
        await db.saveCategory(category);
        await get().refreshData();
        get().addToast("تمت إضافة التصنيف بنجاح", "success");
      },

      setUser: (user) => set({ user }),
      setCurrency: async (currency, label = 'درهم إماراتي') => {
        const code = await CurrencyService.setGlobalCurrency(currency, label);
        set({ currency: code });
      },
      setSyncing: (isSyncing) => set({ isSyncing }),
      setSyncStatus: (syncStatus) => set({ syncStatus }),
      setSystemStatus: (systemStatus) => set({ systemStatus }),
      setHeaderAction: (headerAction) => set({ headerAction }),
      setEditingInvoiceId: (editingInvoiceId) => set({ editingInvoiceId }),
      addToast: (message, type = 'info') => {
        const id = Math.random().toString(36).substr(2, 9);
        set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
        setTimeout(() => get().removeToast(id), 4000);
      },
      removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }))
    };
  })
);
