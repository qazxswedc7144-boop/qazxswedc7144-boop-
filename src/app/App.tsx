
import React, { useState, useEffect, Suspense, lazy, useCallback, useTransition } from 'react';
import Dashboard from '@/modules/dashboard/pages/Dashboard';
import { Logo, BrandName, Tagline } from '@/components/shared/Logo';
import { useUI } from '@/contexts/AppContext';
import Header from '@/layouts/Header';
import { useAppStore } from '@/hooks/useAppStore';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/core/db';
import { heartbeatService } from '@/services/heartbeatService';
import { backupService } from '@/services/backupScheduler';
import { BackupService } from '@/services/backupService';
import { FinancialHealthService } from '@/modules/accounting/services/FinancialHealthService';
import { CurrencyService } from '@/services/localization/CurrencyService';
import { SafeModePanel } from '@/layouts/SafeModePanel';
import { FinancialDefenseSystem } from '@/services/integrity/FinancialDefenseSystem';
import { RealtimeReplicationService } from '@/modules/replication/services/RealtimeReplicationService';
import { Permission } from '@/types';
import RoleGuard from '@/components/shared/RoleGuard';
import { IS_PREVIEW } from '@/constants';
import { 
  X, AlertTriangle, RefreshCw, LogOut, ShieldCheck, Building2, Sparkles, ArrowRightLeft, TrendingUp
} from 'lucide-react';

import {
  SubscriptionOnboardingModal,
  SubscriptionGlobalUsageRibbon,
  SubscriptionWarningInterceptor,
  SubscriptionBlockadeBackdrop,
  TrialBlockedModal
} from '@/components/saas/SubscriptionWidgets';

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("CRITICAL RUNTIME ERROR:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8FAFA] flex items-center justify-center p-6 text-right" dir="rtl">
          <div className="bg-white p-8 rounded-[32px] shadow-2xl border border-red-50 max-w-md w-full text-center">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
              <AlertTriangle size={40} />
            </div>
            <h1 className="text-2xl font-black text-[#1E4D4D] mb-4">عذراً، حدث خطأ غير متوقع</h1>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              واجه النظام مشكلة تقنية مفاجئة. تم تأمين بياناتك محلياً. يرجى محاولة إعادة تشغيل التطبيق.
            </p>
            <div className="space-y-3">
              <button 
                onClick={() => window.location.reload()}
                className="w-full bg-[#1E4D4D] text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-[#153a3a] transition-all"
              >
                <RefreshCw size={18} />
                <span>إعادة تشغيل النظام</span>
              </button>
              <button 
                onClick={() => {
                  window.location.hash = '#/dashboard';
                  window.location.reload();
                }}
                className="w-full bg-white border border-slate-100 text-slate-500 py-4 rounded-2xl font-black text-xs hover:bg-slate-50 transition-all"
              >
                العودة للرئيسية
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Helper for retrying dynamic imports with retry resilience
const lazyWithRetry = (componentImport: () => Promise<any>) =>
  lazy(async () => {
    const pageHasBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );

    let attempts = 3;
    for (let i = 0; i < attempts; i++) {
      try {
        const result = await componentImport();
        // If successful, reset force refresh flag on next idle
        if (typeof window !== 'undefined') {
          setTimeout(() => window.sessionStorage.removeItem('page-has-been-force-refreshed'), 100);
        }
        return result;
      } catch (error) {
        console.warn(`Dynamic lazy-load attempt ${i + 1} of ${attempts} failed:`, error);
        if (i < attempts - 1) {
          // Wait longer on each successive attempt (exponential backoff)
          await new Promise((resolve) => setTimeout(resolve, 800 * (i + 1)));
        } else {
          console.error('Lazy loading failed for a dynamic module after maximum attempts:', error);
          if (!pageHasBeenForceRefreshed) {
            window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
            window.location.reload();
            // Return dummy component to prevent layout crash before reload
            return { default: () => null };
          }
          throw error;
        }
      }
    }
    return { default: () => null };
  });

// Lazy loading views
const PurchasesView = lazyWithRetry(() => import('@/modules/purchases/pages/PurchasesInvoice'));
const SalesModule = lazyWithRetry(() => import('@/modules/sales/pages/SalesModule'));
const InventoryModule = lazyWithRetry(() => import('@/modules/inventory/pages/InventoryModule'));
const InventoryAuditModule = lazyWithRetry(() => import('@/modules/inventory/pages/InventoryAuditModule'));
const AuditHistoryModule = lazyWithRetry(() => import('@/modules/settings/pages/AuditHistoryModule')); 
const SettingsModule = lazyWithRetry(() => import('@/modules/settings/pages/SettingsModule'));
const AccountingModule = lazyWithRetry(() => import('@/modules/accounting/pages/AccountingModule'));
const ReconciliationModule = lazyWithRetry(() => import('@/modules/accounting/pages/ReconciliationModule'));
const SystemHealthModule = lazyWithRetry(() => import('@/modules/settings/pages/SystemHealthModule'));
const InvoicesArchiveModule = lazyWithRetry(() => import('@/modules/sales/pages/InvoicesArchiveModule'));
const InvoiceHistoryModule = lazyWithRetry(() => import('@/modules/sales/pages/InvoiceHistoryModule'));
const AdjustmentsArchiveModule = lazyWithRetry(() => import('@/modules/inventory/pages/AdjustmentsArchiveModule'));
const SupplierPaymentModule = lazyWithRetry(() => import('@/modules/accounting/pages/SupplierPaymentModule'));
const CustomerReceiptModule = lazyWithRetry(() => import('@/modules/accounting/pages/CustomerReceiptModule'));
const VouchersModule = lazyWithRetry(() => import('@/modules/accounting/pages/VouchersModule'));
const AgingReportModule = lazyWithRetry(() => import('@/modules/reports/pages/AgingReportModule'));
const FinancialDashboard = lazyWithRetry(() => import('@/modules/dashboard/pages/FinancialDashboard'));
const ReportsModule = lazyWithRetry(() => import('@/modules/reports/pages/ReportsModule'));
const AdvancedReportsModule = lazyWithRetry(() => import('@/modules/reports/pages/AdvancedReportsModule'));
const PartnersModule = lazyWithRetry(() => import('@/modules/partners/pages/PartnersModule'));
const SaaSModule = lazyWithRetry(() => import('@/modules/saas/pages/SaaSModule'));

// Multi-branch module views
const BranchesList = lazyWithRetry(() => import('@/modules/branches/pages/BranchesList').then(m => ({ default: m.BranchesList })));
const BranchTransfers = lazyWithRetry(() => import('@/modules/branches/pages/BranchTransfers').then(m => ({ default: m.BranchTransfers })));
const BranchReports = lazyWithRetry(() => import('@/modules/branches/pages/BranchReports').then(m => ({ default: m.BranchReports })));
const ConsolidationDashboard = lazyWithRetry(() => import('@/modules/consolidation/pages/ConsolidationDashboard'));

// Lazy loading individual reports
const RemainingStockReport = lazyWithRetry(() => import('@/modules/reports/pages/RemainingStockReport'));
const ItemProfitsReport = lazyWithRetry(() => import('@/modules/reports/pages/ItemProfitsReport'));
const CustomerProfitReport = lazyWithRetry(() => import('@/modules/reports/pages/CustomerProfitReport'));
const SupplierProfitReport = lazyWithRetry(() => import('@/modules/reports/pages/SupplierProfitReport'));
const AccountMovementReport = lazyWithRetry(() => import('@/modules/reports/pages/AccountMovementReport'));
const PurchasesByItemReport = lazyWithRetry(() => import('@/modules/reports/pages/PurchasesByItemReport'));
const SalesByItemReport = lazyWithRetry(() => import('@/modules/reports/pages/SalesByItemReport'));
const ItemMovementDetailsReport = lazyWithRetry(() => import('@/modules/reports/pages/ItemMovementDetailsReport'));
const ExpiryItemsReport = lazyWithRetry(() => import('@/modules/reports/pages/ExpiryItemsReport'));
const FinancialEngineReport = lazyWithRetry(() => import('@/modules/reports/pages/FinancialEngineReport'));
const PrivacyPolicy = lazyWithRetry(() => import('@/modules/legal/pages/PrivacyPolicy'));
const TermsOfService = lazyWithRetry(() => import('@/modules/legal/pages/TermsOfService'));

import { useAuth } from '@/modules/auth/hooks/useAuth';
import { can } from '@/utils/permissions';
import { MODULES } from '@/constants/navigation';
import { LockScreen } from '@/layouts/LockScreen';

import { appLockService } from '@/services/AppLockService';
import { AccountingEngine } from '@/modules/accounting/services/AccountingEngine';
import { PeriodLockEngine } from '@/services/transactions/PeriodLockEngine';
import { IntegritySweepService } from '@/services/integrity/IntegritySweepService';

function MainLayout() {
  const { profile, signOut } = useAuth(); 
  const [currentView, setCurrentView] = useState<string>('dashboard');

  useEffect(() => {
    window.onerror = (message, source, lineno, colno, error) => {
      console.error("Global Error (onerror):", { message, source, lineno, colno, error });
      return false;
    };

    window.addEventListener("unhandledrejection", (e) => {
      e.preventDefault();
      const reason = e.reason;
      const details = reason instanceof Error ? {
        message: reason.message,
        stack: reason.stack
      } : { reason: String(reason) };
      console.warn("Cleared dynamic rejection:", details);
    });
  }, []);
  const [viewParams, setViewParams] = useState<any>(null); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [, startTransition] = useTransition();
  const { setHeaderAction, refreshGlobal, isSettingsOpen, setSettingsOpen } = useUI();
  const setEditingInvoiceId = useAppStore(state => state.setEditingInvoiceId);
  const isTrialBlockedModalOpen = useAppStore(state => state.isTrialBlockedModalOpen);
  const setTrialBlockedModalOpen = useAppStore(state => state.setTrialBlockedModalOpen);
  const systemStatus = useAppStore(state => state.systemStatus);
  const setSystemStatus = useAppStore(state => state.setSystemStatus);
  const setCurrency = useAppStore(state => state.setCurrency);
  const addToast = useAppStore(state => state.addToast);
  const [riskScore, setRiskScore] = useState<number>(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // SaaS Onboarding Lifecycle hooks
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  useEffect(() => {
    const onboarded = localStorage.getItem('pharmaflow_onboarded');
    if (!onboarded) {
      setOnboardingOpen(true);
    }
  }, []);

  const handleCloseOnboarding = () => {
    localStorage.setItem('pharmaflow_onboarded', 'true');
    setOnboardingOpen(false);
  };

  const handleUpgradeTrial = () => {
    handleNav('saas-portal');
  };

  useEffect(() => {
    setTimeout(() => setIsReady(true), 300);
  }, []);


  // 1. Session Tracking
  useEffect(() => {
    const handleActivity = () => {
      appLockService.updateActivity();
    };

    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, []);

    // 2. Lock Logic (Interval & Visibility)
    useEffect(() => {
      const checkLock = async () => {
        try {
          const settings = await appLockService.getSettings();
          if (settings?.is_enabled && settings.lock_mode !== 'instant') {
            const shouldLock = await appLockService.shouldLock();
            if (shouldLock) setIsLocked(true);
          }
        } catch (e) {
          console.error("[LockCheck] Failed to check status:", e);
        }
      };
  
      const handleVisibilityChange = async () => {
        try {
          const settings = await appLockService.getSettings();
          
          if (document.visibilityState === 'hidden') {
            if (settings?.is_enabled && settings.lock_mode === 'instant') {
              setIsLocked(true);
            }
          } else if (document.visibilityState === 'visible') {
            if (settings?.is_enabled) {
              if (settings.lock_mode === 'instant') {
                setIsLocked(true);
              } else {
                const shouldLock = await appLockService.shouldLock();
                if (shouldLock) setIsLocked(true);
              }
            }
          }
        } catch (e) {
          console.error("[VisibilityChange] Lock evaluation failed:", e);
        }
      };
  
      const interval = setInterval(() => {
        checkLock().catch(e => console.error("[LockInterval] Failed:", e));
      }, 30000); // 30s as requested
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', () => {
        checkLock().catch(e => console.error("[FocusLock] Failed:", e));
      });
      window.addEventListener('blur', async () => {
          try {
            const settings = await appLockService.getSettings();
            if (settings?.is_enabled && settings.lock_mode === 'instant') {
              setIsLocked(true);
            }
          } catch (e) {
            console.error("[BlurLock] Failed:", e);
          }
      });
  
      // Initial check on mount (App Resume)
      const initialCheck = async () => {
        try {
          const isLockEnabled = await appLockService.isSimpleLockEnabled();
          
          if (isLockEnabled) {
            // If simple quick lock is enabled, we lock the screen initially just for security.
            setIsLocked(true);
            return;
          }

          const settings = await appLockService.getSettings();
          if (settings?.is_enabled) {
            const shouldLock = await appLockService.shouldLock();
            if (shouldLock) setIsLocked(true);
          }
        } catch (e) {
          console.error("[InitialLockCheck] Failed:", e);
        }
      };
      initialCheck().catch(e => console.error("[InitialLockCheck] Uncaught:", e));
  
      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', checkLock);
      };
    }, []);

  useEffect(() => {
    console.log("PAGE MOUNTED")
    return () => console.log("PAGE UNMOUNTED")
  }, [])

  const parseRoute = useCallback(() => {
    const hash = window.location.hash.replace('#/', '');
    let view = hash || 'dashboard'; // Capture full path including subroutes
    let id = undefined;

    // Check if the current hash contains an ID (e.g., invoices/123)
    if (hash.includes('/') && !hash.startsWith('reports/')) {
        const parts = hash.split('/');
        view = parts[0] || 'dashboard';
        id = parts[1];
    }

    // List of valid views (based on the lazy loaded components)
    const validViews = [
      'dashboard', 'purchases', 'sales', 'inventory', 'inventory-audit',
      'suppliers', 'logs', 'audit-history', 'settings', 'accounting',
      'reconciliation', 'system-health', 'invoices-archive', 'invoice-history',
      'adjustments-archive', 'supplier-payment', 'customer-receipt', 'vouchers',
      'aging-report', 'partners', 'privacy', 'terms', 'reports', 'advanced-reports',
      'login',
      'reports/remaining-stock', 'reports/item-profits', 'reports/customer-profit', 
      'reports/supplier-profit', 'reports/account-movement', 'reports/purchases-by-item',
      'reports/sales-by-item', 'reports/item-movement-details', 'reports/expiry-items',
      'reports/financial-engine', 'consolidation'
    ];

    if (view === 'settings') {
      setSettingsOpen(true);
      window.location.hash = '#/dashboard';
      view = 'dashboard';
    }

    if (!validViews.includes(view)) {
      view = 'dashboard';
      window.location.hash = '#/dashboard';
    }

    startTransition(() => {
      setCurrentView(view);
      if (id) {
        setEditingInvoiceId(id);
        setViewParams({ id });
      } else {
        setEditingInvoiceId(null);
        setViewParams(null);
      }
    });
  }, [setEditingInvoiceId]);

  useEffect(() => {
    let stopCurrencyObserver: (() => void) | null = null;
    let syncTimer: any;

    const init = async () => { 
      // Clear DB to resolve IDBKeyRange error if requested (one-time fix)
      if (!localStorage.getItem('pharmaflow_db_reset_v4')) {
        try {
          console.log("🧹 Clearing IndexedDB to resolve IDBKeyRange error...");
          const databases = await window.indexedDB.databases();
          for (const dbInfo of databases) {
            if (dbInfo.name) {
              console.log(`Deleting: ${dbInfo.name}`);
              window.indexedDB.deleteDatabase(dbInfo.name);
            }
          }
        } catch (e) {
          window.indexedDB.deleteDatabase("pharmaflow");
        }
        localStorage.setItem('pharmaflow_db_reset_v4', 'true');
        window.location.reload();
        return;
      }

      try {
        await db.open();
      } catch (e) {
        console.error("Failed to open DB:", e);
      }

      await AccountingEngine.seedAccounts().catch(e => console.error(e));
      await PeriodLockEngine.seedDefaultPeriod().catch(e => console.error(e));

      heartbeatService.start(); 
      
      // Reset security system for development as requested
      await FinancialDefenseSystem.resetSecuritySystem().catch(e => console.error(e));
      
      FinancialDefenseSystem.startBackgroundScanner();
      
      stopCurrencyObserver = CurrencyService.startCurrencyObserver((code) => {
        setCurrency(code);
      });

      await FinancialHealthService.refreshHealthMonitor().catch(e => console.error(e));

      syncTimer = setInterval(() => {
        (async () => {
          try {
            const threat = await db.getSetting('SYSTEM_THREAT_LEVEL', '0');
            setRiskScore(parseInt(threat));
          } catch (e) {
            console.error("[SyncTimer] Risk score update failed:", e);
          }
        })().catch(e => console.error("[SyncTimer] Fatal error:", e));
      }, 5000);

      let health = await BackupService.runIntegrityChecks().catch(e => ({ success: false, errors: [e.message] }));
      const savedStatus = await db.getSetting('SYSTEM_STATUS', 'ACTIVE');
      
      if (!health.success || savedStatus === 'RECOVERY_MODE') {
        if (IS_PREVIEW) {
          const fixed = await IntegritySweepService.runSweep(true).catch(() => false);
          if (fixed) {
            setSystemStatus('ACTIVE');
            refreshGlobal();
            return;
          }
          setSystemStatus('ACTIVE');
          return;
        }
        if (!health.success && savedStatus !== 'RECOVERY_MODE') {
          await BackupService.createEmergencySnapshot().catch(() => {});
        }
        setSystemStatus('RECOVERY_MODE');
        addToast("وضع الأمان مفعل", "error");
      } else {
        setSystemStatus('ACTIVE');
      }

      refreshGlobal(); 
      parseRoute();

      // Initialize real-time replication stream
      RealtimeReplicationService.connect("BRH-MAIN-001");
    };
    init().catch(err => {
      console.error("CRITICAL: Application failed to initialize:", err);
    });
    window.addEventListener('hashchange', parseRoute);
    return () => {
      heartbeatService.stop();
      backupService.stopAutoTimer();
      clearInterval(syncTimer);
      if (stopCurrencyObserver) stopCurrencyObserver();
      window.removeEventListener('hashchange', parseRoute);
      RealtimeReplicationService.disconnect();
    };
  }, [refreshGlobal, parseRoute, setCurrency, setSystemStatus, addToast]);

  const handleNav = useCallback((view: string, params: any = null) => {
    if (view === 'settings') {
      setSettingsOpen(true);
      setIsSidebarOpen(false);
      return;
    }
    if ((view === 'sales' || view === 'purchases') && !params?.id) {
       setEditingInvoiceId(null);
    }
    startTransition(() => { 
      setCurrentView(view); 
      setViewParams(params);
      const url = params?.id ? `#/${view}/${params.id}` : `#/${view}`;
      window.location.hash = url;
    });
    setIsSidebarOpen(false);
    setHeaderAction(null);
  }, [setHeaderAction, setEditingInvoiceId]);

  const getLabel = () => {
    const m = MODULES.find(mod => mod.id === currentView);
    if (m) return m.label;
    if (currentView === 'sales') return 'كاشير المبيعات';
    if (currentView === 'purchases') return 'توريد مشتريات';
    if (currentView === 'partners') return 'الموردون والعملاء';
    if (currentView === 'inventory') return 'المخازن والأصناف';
    if (currentView === 'supplier-payment') return 'سداد موردين';
    if (currentView === 'customer-receipt') return 'سند قبض عميل';
    if (currentView === 'aging-report') return 'تقرير تعمير الذمم';
    if (currentView === 'accounting') return 'دفتر الأستاذ العام';
    if (currentView === 'consolidation') return 'الاندماج المالي الموحد';
    return 'العملية';
  };

  const isOperationalView = ['sales', 'purchases', 'invoice-registry', 'sales-archive', 'invoices-archive', 'invoice-history', 'adjustments-registry', 'supplier-payment', 'customer-receipt', 'aging-report', 'partners', 'inventory', 'audit-history', 'accounting'].includes(currentView);

  const visibleModules = MODULES.filter(m => !m.permission || can(profile?.role, m.permission as Permission));

  const hideHeader = currentView !== 'dashboard';

  if (!isReady) {
    return <div className="min-h-screen bg-[#F8FAFA] flex items-center justify-center font-black text-[#1E4D4D] animate-pulse">جاري التحميل...</div>;
  }

  // Bypass Auth Wall if accessing legal pages
  if (currentView === 'privacy') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#F8FAFA] flex items-center justify-center font-black text-[#1E4D4D] animate-pulse">جاري التحميل...</div>}>
         <PrivacyPolicy />
      </Suspense>
    );
  }
  if (currentView === 'terms') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#F8FAFA] flex items-center justify-center font-black text-[#1E4D4D] animate-pulse">جاري التحميل...</div>}>
         <TermsOfService />
      </Suspense>
    );
  }

  return (
    <div className="flex h-[100dvh] min-h-screen w-full mx-auto bg-[#F8FAFA] overflow-hidden font-sans relative text-slate-800 shadow-sm" dir="rtl">
      {/* SaaS Trial & Onboarding Gateways */}
      <SubscriptionOnboardingModal isOpen={onboardingOpen} onClose={handleCloseOnboarding} />
      <SubscriptionWarningInterceptor />
      <SubscriptionBlockadeBackdrop onUpgrade={handleUpgradeTrial} />
      {isTrialBlockedModalOpen && (
        <TrialBlockedModal onClose={() => setTrialBlockedModalOpen(false)} />
      )}

      <AnimatePresence>
        {isLocked && <LockScreen onUnlock={() => setIsLocked(false)} />}
      </AnimatePresence>
      
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] lg:hidden" 
            onClick={() => setIsSidebarOpen(false)} 
          />
        )}
      </AnimatePresence>

      <aside className={`absolute inset-y-0 right-0 w-64 bg-white border-l border-slate-100 z-[210] transition-all duration-500 lg:translate-x-0 lg:static ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="px-6 py-8 flex flex-col gap-4">
            <div className="flex justify-between items-center w-full">
              <div className="flex items-center gap-3">
                <Logo size={40} />
                <BrandName className="text-xl" />
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden w-10 h-10 flex items-center justify-center bg-slate-50 rounded-xl text-slate-400 hover:bg-slate-100 transition-all"><X size={20} /></button>
            </div>
            <Tagline className="px-1 text-[8px]" />
          </div>

          <nav className="flex-1 px-4 py-4 space-y-6 overflow-y-auto custom-scrollbar">
            <div>
              <p className="px-4 text-[11px] font-black text-slate-400 uppercase tracking-[2px] mb-3">القائمة الرئيسية</p>
              <div className="space-y-1">
                {visibleModules.filter(m => m.group === 'core').map(module => (
                  <button 
                    key={module.id}
                    onClick={() => handleNav(module.id)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-[11px] font-black transition-all group ${currentView === module.id ? 'bg-[#1E4D4D] text-white shadow-lg shadow-emerald-900/10' : 'text-slate-500 hover:bg-slate-50 hover:text-[#1E4D4D]'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`${currentView === module.id ? 'text-emerald-400' : 'text-slate-400 group-hover:text-[#1E4D4D]'}`}>{module.icon}</span>
                      <span>{module.label}</span>
                    </div>
                    {currentView === module.id && <motion.div layoutId="active-nav" className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="px-4 text-[11px] font-black text-slate-400 uppercase tracking-[2px] mb-3">المبيعات والمشتريات</p>
              <div className="space-y-1">
                {visibleModules.filter(m => m.group === 'sales_purchases').map(module => (
                  <button 
                    key={module.id}
                    onClick={() => handleNav(module.id)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-[11px] font-black transition-all group ${currentView === module.id ? 'bg-[#1E4D4D] text-white shadow-lg shadow-emerald-900/10' : 'text-slate-500 hover:bg-slate-50 hover:text-[#1E4D4D]'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`${currentView === module.id ? 'text-emerald-400' : 'text-slate-400 group-hover:text-[#1E4D4D]'}`}>{module.icon}</span>
                      <span>{module.label}</span>
                    </div>
                    {currentView === module.id && <motion.div layoutId="active-nav" className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="px-4 text-[11px] font-black text-slate-400 uppercase tracking-[2px] mb-3">الإدارة والتقارير</p>
              <div className="space-y-1">
                {visibleModules.filter(m => m.group === 'admin').map(module => (
                  <button 
                    key={module.id}
                    onClick={() => handleNav(module.id)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-[11px] font-black transition-all group ${currentView === module.id ? 'bg-[#1E4D4D] text-white shadow-lg shadow-emerald-900/10' : 'text-slate-500 hover:bg-slate-50 hover:text-[#1E4D4D]'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`${currentView === module.id ? 'text-emerald-400' : 'text-slate-400 group-hover:text-[#1E4D4D]'}`}>{module.icon}</span>
                      <span>{module.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Multi-Branch Suite Sidebar Section (Subject to RBAC guards) */}
            <div>
              <p className="px-4 text-[11px] font-black text-slate-400 uppercase tracking-[2px] mb-3">إدارة الفروع والإمداد</p>
              <div className="space-y-1">
                {can(profile?.role, 'BRANCH_VIEW') && (
                  <button 
                    onClick={() => handleNav('branches')}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-[11px] font-black transition-all group ${currentView === 'branches' ? 'bg-[#1E4D4D] text-white shadow-lg shadow-emerald-950/10' : 'text-slate-500 hover:bg-slate-50 hover:text-[#1E4D4D]'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`${currentView === 'branches' ? 'text-emerald-400' : 'text-slate-400 group-hover:text-[#1E4D4D]'}`}><Building2 size={15} /></span>
                      <span>إدارة الفروع والصيدليات</span>
                    </div>
                    {currentView === 'branches' && <motion.div layoutId="active-nav-branches" className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />}
                  </button>
                )}

                {can(profile?.role, 'BRANCH_TRANSFER') && (
                  <button 
                    onClick={() => handleNav('branch-transfers')}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-[11px] font-black transition-all group ${currentView === 'branch-transfers' ? 'bg-[#1E4D4D] text-white shadow-lg shadow-emerald-950/10' : 'text-slate-500 hover:bg-slate-50 hover:text-[#1E4D4D]'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`${currentView === 'branch-transfers' ? 'text-emerald-400' : 'text-slate-400 group-hover:text-[#1E4D4D]'}`}><ArrowRightLeft size={15} /></span>
                      <span>التحويل الدوائي البيني</span>
                    </div>
                    {currentView === 'branch-transfers' && <motion.div layoutId="active-nav-transfers" className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />}
                  </button>
                )}

                {can(profile?.role, 'BRANCH_REPORT') && (
                  <button 
                    onClick={() => handleNav('branch-reports')}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-[11px] font-black transition-all group ${currentView === 'branch-reports' ? 'bg-[#1E4D4D] text-white shadow-lg shadow-emerald-950/10' : 'text-slate-500 hover:bg-slate-50 hover:text-[#1E4D4D]'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`${currentView === 'branch-reports' ? 'text-emerald-400' : 'text-slate-400 group-hover:text-[#1E4D4D]'}`}><Sparkles size={15} /></span>
                      <span>تقرير تحليلات الفروع الذكي</span>
                    </div>
                    {currentView === 'branch-reports' && <motion.div layoutId="active-nav-reports" className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />}
                  </button>
                )}

                {can(profile?.role, 'FINANCIAL_ACCESS') && (
                  <button 
                    onClick={() => handleNav('consolidation')}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-[16px] text-[11px] font-black transition-all group ${currentView === 'consolidation' ? 'bg-[#1E4D4D] text-white shadow-lg shadow-emerald-950/10' : 'text-slate-500 hover:bg-slate-50 hover:text-[#1E4D4D]'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`${currentView === 'consolidation' ? 'text-emerald-400' : 'text-slate-400 group-hover:text-[#1E4D4D]'}`}><TrendingUp size={15} /></span>
                      <span>الاندماج المالي الموحد</span>
                    </div>
                    {currentView === 'consolidation' && <motion.div layoutId="active-nav-consolidation" className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />}
                  </button>
                )}
              </div>
            </div>

            <div>
              <p className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-[2px] mb-3">النظام</p>
              <div className="space-y-1">
                {visibleModules.filter(m => m.group === 'settings').map(module => (
                  <button 
                    key={module.id}
                    onClick={() => handleNav(module.id)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-[13px] font-bold transition-all group ${currentView === module.id ? 'bg-[#1E4D4D] text-white shadow-lg shadow-emerald-900/10' : 'text-slate-500 hover:bg-slate-50 hover:text-[#1E4D4D]'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`${currentView === module.id ? 'text-emerald-400' : 'text-slate-400 group-hover:text-[#1E4D4D]'}`}>{module.icon}</span>
                      <span>{module.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </nav>

          <div className="p-4 border-t border-slate-50">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#1E4D4D] truncate">{profile?.email?.split('@')[0] || 'User'}</p>
              </div>
              <button onClick={() => signOut()} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        <SubscriptionGlobalUsageRibbon onUpgrade={handleUpgradeTrial} />
        {systemStatus === 'RECOVERY_MODE' && <SafeModePanel />}
        
        {riskScore >= 30 && systemStatus !== 'RECOVERY_MODE' && (
          <motion.div 
            initial={{ y: -50 }}
            animate={{ y: 0 }}
            className={`w-full py-2.5 px-6 flex items-center justify-center gap-3 text-white font-bold text-xs z-[200] shadow-lg ${riskScore >= 50 ? 'bg-red-600' : 'bg-amber-500'}`}
          >
            <ShieldCheck size={16} />
            <span>تنبيه أمني: مستوى التهديد مرتفع ({riskScore}%). {riskScore >= 50 ? 'تم تفعيل بروتوكولات الحماية المتقدمة.' : 'يرجى مراجعة سجلات النشاط.'}</span>
          </motion.div>
        )}

        {!hideHeader && !isOperationalView && (
          <Header 
            pageTitle={getLabel()} 
            showBackButton={currentView !== 'dashboard'} 
            onBackClick={() => {
              const view = currentView as any;
              if (view.startsWith?.('reports/') || view === 'aging-report') {
                handleNav('reports');
              } else {
                handleNav('dashboard');
              }
            }} 
          />
        )}

        <main className={`flex-1 overflow-y-auto bg-[#F8FAFA] custom-scrollbar h-screen ${isOperationalView ? 'p-1 sm:p-2 pt-0' : currentView === 'dashboard' ? 'p-0' : 'p-2 sm:p-4'}`}>
          <div className={currentView === 'dashboard' ? 'max-w-full px-0 mx-auto min-h-full' : 'max-w-full px-4 mx-auto min-h-full'}>
            <Suspense fallback={<div className="flex items-center justify-center h-full min-h-[400px]"><div className="w-10 h-10 border-4 border-[#10B981] border-t-transparent rounded-full animate-spin"></div></div>}>
              {(() => {
                switch (currentView) {
                  case 'sales': return <SalesModule onNavigate={handleNav} />;
                  case 'purchases': return <PurchasesView onNavigate={handleNav} />;
                  case 'supplier-payment': return <RoleGuard permission="CREATE_VOUCHER"><SupplierPaymentModule onNavigate={handleNav} /></RoleGuard>;
                  case 'customer-receipt': return <RoleGuard permission="CREATE_VOUCHER"><CustomerReceiptModule onNavigate={handleNav} /></RoleGuard>;
                  case 'vouchers': return <RoleGuard permission="CREATE_VOUCHER"><VouchersModule onNavigate={handleNav} initialType={viewParams?.type} /></RoleGuard>;
                  case 'inventory': return <InventoryModule onNavigate={handleNav} />;
                  case 'inventory-audit': return <InventoryAuditModule lang="ar" onNavigate={handleNav} />;
                  case 'accounting': return <RoleGuard permission="FINANCIAL_ACCESS"><AccountingModule onNavigate={handleNav} /></RoleGuard>;
                  case 'audit-history': return <RoleGuard permission="MANAGE_SYSTEM"><AuditHistoryModule onNavigate={handleNav} recordId={viewParams?.id} /></RoleGuard>;
                  case 'reconciliation': return <RoleGuard permission="FINANCIAL_ACCESS"><ReconciliationModule onNavigate={handleNav} /></RoleGuard>;
                  case 'system-health': return <RoleGuard permission="MANAGE_SYSTEM"><SystemHealthModule onNavigate={handleNav} /></RoleGuard>;
                  case 'invoices-archive': return <InvoicesArchiveModule onNavigate={handleNav} initialFilter={viewParams?.filter} />;
                  case 'invoice-history': return <RoleGuard permission="MANAGE_SYSTEM"><InvoiceHistoryModule onNavigate={handleNav} /></RoleGuard>;
                  case 'adjustments-registry': return <RoleGuard permission="FINANCIAL_ACCESS"><AdjustmentsArchiveModule onNavigate={handleNav} /></RoleGuard>;
                  case 'aging-report': return <RoleGuard permission="VIEW_REPORTS"><AgingReportModule onNavigate={handleNav} /></RoleGuard>;
                  case 'financial-dashboard': return <RoleGuard permission="VIEW_REPORTS"><FinancialDashboard onNavigate={handleNav} /></RoleGuard>;
                  case 'reports': return <RoleGuard permission="VIEW_REPORTS"><ReportsModule onNavigate={handleNav} /></RoleGuard>;
                  case 'partners': return <RoleGuard permission="MANAGE_PARTNERS"><PartnersModule onNavigate={handleNav} /></RoleGuard>;
                  case 'saas-portal': return <SaaSModule onNavigate={handleNav} />;
                  case 'advanced-reports': return <RoleGuard permission="VIEW_REPORTS"><AdvancedReportsModule onBack={() => handleNav('dashboard')} /></RoleGuard>;
                  
                  // Multi-branch module routing definitions
                  case 'branches': return <RoleGuard permission="BRANCH_VIEW"><BranchesList onNavigate={handleNav} /></RoleGuard>;
                  case 'branch-transfers': return <RoleGuard permission="BRANCH_TRANSFER"><BranchTransfers /></RoleGuard>;
                  case 'branch-reports': return <RoleGuard permission="BRANCH_REPORT"><BranchReports /></RoleGuard>;
                  case 'consolidation': return <RoleGuard permission="FINANCIAL_ACCESS"><ConsolidationDashboard onNavigate={handleNav} /></RoleGuard>;
                  
                  case 'reports/remaining-stock': return <RoleGuard permission="VIEW_REPORTS"><RemainingStockReport onNavigate={handleNav} /></RoleGuard>;
                  case 'reports/item-profits': return <RoleGuard permission="VIEW_REPORTS"><ItemProfitsReport onNavigate={handleNav} /></RoleGuard>;
                  case 'reports/customer-profit': return <RoleGuard permission="VIEW_REPORTS"><CustomerProfitReport onNavigate={handleNav} /></RoleGuard>;
                  case 'reports/supplier-profit': return <RoleGuard permission="VIEW_REPORTS"><SupplierProfitReport onNavigate={handleNav} /></RoleGuard>;
                  case 'reports/account-movement': return <RoleGuard permission="VIEW_REPORTS"><AccountMovementReport onNavigate={handleNav} /></RoleGuard>;
                  case 'reports/purchases-by-item': return <RoleGuard permission="VIEW_REPORTS"><PurchasesByItemReport onNavigate={handleNav} /></RoleGuard>;
                  case 'reports/sales-by-item': return <RoleGuard permission="VIEW_REPORTS"><SalesByItemReport onNavigate={handleNav} /></RoleGuard>;
                  case 'reports/item-movement-details': return <RoleGuard permission="VIEW_REPORTS"><ItemMovementDetailsReport onNavigate={handleNav} /></RoleGuard>;
                  case 'reports/expiry-items': return <RoleGuard permission="VIEW_REPORTS"><ExpiryItemsReport onNavigate={handleNav} /></RoleGuard>;
                  case 'reports/financial-engine': return <RoleGuard permission="VIEW_REPORTS"><FinancialEngineReport onNavigate={handleNav} /></RoleGuard>;

                  default: return <Dashboard lang="ar" onNavigate={handleNav} />;
                }
              })()}
            </Suspense>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4 md:p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#F8FAFA] w-full max-w-7xl h-[95vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col relative"
            >
               <div className="flex-1 overflow-y-auto w-full custom-scrollbar pt-6">
                 <RoleGuard permission="MANAGE_SYSTEM">
                    <SettingsModule onNavigate={(v: string) => { setSettingsOpen(false); handleNav(v); }} />
                 </RoleGuard>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="min-h-screen bg-[#F8FAFA] flex items-center justify-center font-black text-[#1E4D4D] animate-pulse">جاري تحميل النظام السيادي...</div>}>
        <MainLayout />
      </Suspense>
    </ErrorBoundary>
  );
}
