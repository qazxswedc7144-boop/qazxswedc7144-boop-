
import React, { useState, useEffect, Suspense, lazy, useCallback, useTransition } from 'react';
import Dashboard from './pages/Dashboard';
import { Logo, BrandName, Tagline } from './components/Logo';
import { useUI } from './store/AppContext';
import { authService } from './services/auth.service';
import { db } from './lib/database';
import { heartbeatService } from './services/heartbeat.service';
import { backupService } from './services/backup.service';
import { BackupService } from './services/backupService';
import { FinancialHealthService } from './services/FinancialHealthService';
import { CurrencyService } from './services/CurrencyService';
import { LoadTestService } from './services/LoadTestService';
import { TestSuiteService } from './services/TestSuiteService';
import { SafeModePanel } from './components/SafeModePanel';
import Header from './components/Header';
import { FinancialDefenseSystem } from './services/FinancialDefenseSystem';
import { useAppStore } from './store/useAppStore';
import { Permission } from './types';
import { Toast } from './components/SharedUI';
import RoleGuard from './components/RoleGuard';
import { IS_PREVIEW } from './constants';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, Settings, Menu, X, Database, TableProperties, ArrowRight, 
  ShieldCheck, FolderArchive, History, Tag, BarChart3, Fingerprint,
  ShoppingBag, CreditCard, Package as PackageIcon, Users, FileText,
  Cloud, CloudOff, CloudAlert, Sparkles as AutoAwesome,
  ChevronLeft, LogOut, Clock
} from 'lucide-react';

// Lazy loading views
const PurchasesView = lazy(() => import('./pages/PurchasesInvoice'));
const SalesModule = lazy(() => import('./pages/SalesModule'));
const InventoryModule = lazy(() => import('./pages/InventoryModule'));
const InventoryAuditModule = lazy(() => import('./pages/InventoryAuditModule'));
const AuditHistoryModule = lazy(() => import('./pages/AuditHistoryModule')); 
const SettingsModule = lazy(() => import('./pages/SettingsModule'));
const AccountingModule = lazy(() => import('./pages/AccountingModule'));
const ReconciliationModule = lazy(() => import('./pages/ReconciliationModule'));
const SystemHealthModule = lazy(() => import('./pages/SystemHealthModule'));
const InvoicesArchiveModule = lazy(() => import('./pages/InvoicesArchiveModule'));
const InvoiceHistoryModule = lazy(() => import('./pages/InvoiceHistoryModule'));
const AdjustmentsArchiveModule = lazy(() => import('./pages/AdjustmentsArchiveModule'));
const SupplierPaymentModule = lazy(() => import('./pages/SupplierPaymentModule'));
const CustomerReceiptModule = lazy(() => import('./pages/CustomerReceiptModule'));
const VouchersModule = lazy(() => import('./pages/VouchersModule'));
const AgingReportModule = lazy(() => import('./pages/AgingReportModule'));
const FinancialDashboard = lazy(() => import('./pages/FinancialDashboard'));
const ReportsModule = lazy(() => import('./pages/ReportsModule'));
const AdvancedReportsModule = lazy(() => import('./pages/AdvancedReportsModule'));

// Lazy loading individual reports
const RemainingStockReport = lazy(() => import('./pages/RemainingStockReport'));
const ItemProfitsReport = lazy(() => import('./pages/ItemProfitsReport'));
const CustomerProfitReport = lazy(() => import('./pages/CustomerProfitReport'));
const SupplierProfitReport = lazy(() => import('./pages/SupplierProfitReport'));
const AccountMovementReport = lazy(() => import('./pages/AccountMovementReport'));
const PurchasesByItemReport = lazy(() => import('./pages/PurchasesByItemReport'));
const SalesByItemReport = lazy(() => import('./pages/SalesByItemReport'));
const ItemMovementDetailsReport = lazy(() => import('./pages/ItemMovementDetailsReport'));
const ExpiryItemsReport = lazy(() => import('./pages/ExpiryItemsReport'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));

import { useAuth } from './hooks/useAuth';
import { can } from './lib/permissions';

const MODULES: {id: any, label: string, icon: any, group: string, permission?: Permission}[] = [
  { id: 'dashboard', label: 'الرئيسية', icon: <Home size={20} />, group: 'core' },
  { id: 'partners', label: 'العملاء والموردين', icon: <Users size={20} />, group: 'core', permission: 'MANAGE_PARTNERS' },
  { id: 'reports', label: 'التقارير', icon: <BarChart3 size={20} />, group: 'admin', permission: 'VIEW_REPORTS' },
  { id: 'system-health', label: 'صحة النظام', icon: <ShieldCheck size={20} />, group: 'admin', permission: 'MANAGE_SYSTEM' },
  { id: 'settings', label: 'إعدادات النظام', icon: <Settings size={20} />, group: 'settings', permission: 'MANAGE_SYSTEM' },
];

function MainLayout() {
  const { profile, loading: authLoading, signInWithEmail, signOut } = useAuth(); 
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [viewParams, setViewParams] = useState<any>(null); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { setHeaderAction, refreshGlobal, toasts, removeToast } = useUI();
  const setEditingInvoiceId = useAppStore(state => state.setEditingInvoiceId);
  const systemStatus = useAppStore(state => state.systemStatus);
  const setSystemStatus = useAppStore(state => state.setSystemStatus);
  const syncStatus = useAppStore(state => state.syncStatus);
  const setSyncStatus = useAppStore(state => state.setSyncStatus);
  const setCurrency = useAppStore(state => state.setCurrency);
  const addToast = useAppStore(state => state.addToast);
  const [riskScore, setRiskScore] = useState<number>(0);
  const [isLocked, setIsLocked] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Session Tracking
  useEffect(() => {
    const handleActivity = () => {
      import('./services/AppLockService').then(({ appLockService }) => {
        appLockService.updateActivity();
      });
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
      const syncLockFlag = async () => {
        const { appLockService } = await import('./services/AppLockService');
        const settings = await appLockService.getSettings();
        if (settings?.is_enabled) {
          localStorage.setItem("app_lock_enabled", "true");
        } else {
          localStorage.removeItem("app_lock_enabled");
        }
      };
      syncLockFlag();

      const checkLock = async () => {
        const { appLockService } = await import('./services/AppLockService');
        const settings = await appLockService.getSettings();
        if (settings?.is_enabled && settings.lock_mode !== 'instant') {
          const shouldLock = await appLockService.shouldLock();
          if (shouldLock) setIsLocked(true);
        }
      };
  
      const handleVisibilityChange = async () => {
        const { appLockService } = await import('./services/AppLockService');
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
      };
  
      const interval = setInterval(checkLock, 30000); // 30s as requested
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', checkLock);
      window.addEventListener('blur', () => {
         import('./services/AppLockService').then(async ({ appLockService }) => {
           const settings = await appLockService.getSettings();
           if (settings?.is_enabled && settings.lock_mode === 'instant') {
             setIsLocked(true);
           }
         });
      });
  
      // Initial check on mount (App Resume)
      const initialCheck = async () => {
        const isLockEnabled = localStorage.getItem("app_lock_enabled") === "true";
        if (!isLockEnabled) return; // دخول طبيعي

        const { appLockService } = await import('./services/AppLockService');
        const settings = await appLockService.getSettings();
        
        if (settings?.is_enabled) {
          // في البداية نفتح مباشرة إلا إذا كان هناك سبب قوي للقفل
          const shouldLock = await appLockService.shouldLock();
          if (shouldLock) setIsLocked(true);
        }
      };
      initialCheck();
  
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
        view = parts[0];
        id = parts[1];
    }

    // List of valid views (based on the lazy loaded components)
    const validViews = [
      'dashboard', 'purchases', 'sales', 'inventory', 'inventory-audit',
      'suppliers', 'logs', 'audit-history', 'settings', 'accounting',
      'reconciliation', 'system-health', 'invoices-archive', 'invoice-history',
      'adjustments-archive', 'supplier-payment', 'customer-receipt', 'vouchers',
      'aging-report', 'partners', 'privacy', 'terms', 'reports', 'advanced-reports',
      'reports/remaining-stock', 'reports/item-profits', 'reports/customer-profit', 
      'reports/supplier-profit', 'reports/account-movement', 'reports/purchases-by-item',
      'reports/sales-by-item', 'reports/item-movement-details', 'reports/expiry-items'
    ];

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
    let cloudSyncInterval: any;

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

      const { AccountingEngine } = await import('./services/AccountingEngine');
      const { PeriodLockEngine } = await import('./services/PeriodLockEngine');
      
      await AccountingEngine.seedAccounts();
      await PeriodLockEngine.seedDefaultPeriod();

      heartbeatService.start(); 
      backupService.startAutoTimer();
      
      // 8. CLOUD BACKUP: Initial sync (now handles hybrid sync context)
      try {
        const syncData = async () => {
          const { cloudSync } = await import('./services/cloudSync');
          await cloudSync.pushProducts();
          await cloudSync.pullProducts();
        };
        await syncData();
        
        const internalKey = 'pharmaflow-internal-secure-key-2026';
        await BackupService.uploadBackup(internalKey);
      } catch (e) {
        console.warn("Initial cloud sync/backup failed:", e);
      }
      
      // Reset security system for development as requested
      await FinancialDefenseSystem.resetSecuritySystem();
      
      FinancialDefenseSystem.startBackgroundScanner();
      
      stopCurrencyObserver = CurrencyService.startCurrencyObserver((code) => {
        setCurrency(code);
      });

      await FinancialHealthService.refreshHealthMonitor();

      syncTimer = setInterval(async () => {
        const threat = await db.getSetting('SYSTEM_THREAT_LEVEL', '0');
        setRiskScore(parseInt(threat));
      }, 5000);

      // Removed per user request - no auto sync
      // import('./services/cloudSync').then(({ cloudSync }) => {
      //   cloudSyncInterval = cloudSync.startSyncEngine();
      // });

      // NEW: Supabase  Listeners
      // Removed per user request
      // import('./services/realtimeSync').then(({ realtimeSync }) => {
      //   realtimeSync.startRealtimeSync();
      // });
      
      let health = await BackupService.runIntegrityChecks();
      const savedStatus = await db.getSetting('SYSTEM_STATUS', 'ACTIVE');
      
      if (!health.success || savedStatus === 'RECOVERY_MODE') {
        if (IS_PREVIEW) {
          const { IntegritySweepService } = await import('./services/IntegritySweepService');
          const fixed = await IntegritySweepService.runSweep(true);
          if (fixed) {
            setSystemStatus('ACTIVE');
            refreshGlobal();
            return;
          }
          setSystemStatus('ACTIVE');
          return;
        }
        if (!health.success && savedStatus !== 'RECOVERY_MODE') {
          await BackupService.createEmergencySnapshot();
        }
        setSystemStatus('RECOVERY_MODE');
        addToast("وضع الأمان مفعل", "error");
      } else {
        setSystemStatus('ACTIVE');
      }

      refreshGlobal(); 
      parseRoute();
    };
    init();
    window.addEventListener('hashchange', parseRoute);
    return () => {
      heartbeatService.stop();
      backupService.stopAutoTimer();
      clearInterval(syncTimer);
      clearInterval(cloudSyncInterval);
      if (stopCurrencyObserver) stopCurrencyObserver();
      window.removeEventListener('hashchange', parseRoute);
    };
  }, [refreshGlobal, parseRoute, setCurrency, setSyncStatus, setSystemStatus, addToast]);

  const handleNav = useCallback((view: string, params: any = null) => {
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
    return 'العملية';
  };

  const isOperationalView = ['sales', 'purchases', 'invoice-registry', 'sales-archive', 'invoices-archive', 'invoice-history', 'adjustments-registry', 'supplier-payment', 'customer-receipt', 'aging-report', 'partners', 'inventory', 'audit-history', 'accounting'].includes(currentView);

  const visibleModules = MODULES.filter(m => !m.permission || can(profile?.role, m.permission));

  if (authLoading) {
    return <div className="min-h-screen bg-[#F8FAFA] flex items-center justify-center font-black text-[#1E4D4D] animate-pulse">جاري تسجيل الدخول...</div>;
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

  if (!profile) {
    return (
      <div className="flex h-screen bg-[#F8FAFA] items-center justify-center p-4" dir="rtl">
        <div className="bg-white p-8 rounded-[32px] shadow-2xl shadow-emerald-900/5 flex flex-col items-center gap-6 max-w-sm w-full mx-4 border border-slate-100">
          <div className="bg-emerald-50 w-24 h-24 rounded-[28px] flex flex-col items-center justify-center mb-2 shadow-inner">
            <Logo size={70} />
          </div>
          <BrandName className="text-3xl justify-center mb-[-10px]" />
          <p className="text-slate-500 text-sm font-bold text-center px-4">النظام السحابي المحلي</p>
          
          <form className="w-full flex md:auto flex-col gap-4 mt-2" onSubmit={async (e) => {
            e.preventDefault();
            setLoginError('');
            setIsSubmitting(true);
            
            // Explicit guard against unconfigured API keys failing silently
            if (import.meta.env.VITE_SUPABASE_ANON_KEY === 'YOUR_ANON_KEY_HERE' || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
               setLoginError('خطأ: لم تقم بإضافة مفتاح Supabase (ANON_KEY) في إعدادات التطبيق. السيرفر لا يستطيع استقبال الطلب.');
               return;
            }

            try {
              console.log("Connecting to:", import.meta.env.VITE_SUPABASE_URL);
              const cleanEmail = loginEmail.trim().toLowerCase();
              const { error, data } = await signInWithEmail(cleanEmail, loginPassword);
              
              if (error) {
                console.error("Login Error Details:", error);
                
                if (cleanEmail === 'admin@pharmaflow.com' && loginPassword === '123456') {
                  setLoginError('يرجى استخدام كلمة المرور الجديدة: Abdullah@Pharma2026');
                } else if (error.message.includes('API key')) {
                  setLoginError('مفتاح Supabase (ANON_KEY) مفقود في ملف .env');
                } else if (error.message.includes('Invalid login') || error.message.includes('credentials')) {
                  setLoginError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
                } else {
                  setLoginError(error.message);
                }
              }
              // useAuth hook will automatically update `profile` when auth changes, causing re-render and exiting the login screen.
            } catch (err: any) {
              console.error("Critical Login Error:", err);
              setLoginError(err?.message || 'حدث خطأ في الاتصال بالخادم. يرجى التحقق من اتصالك.');
            } finally {
              setIsSubmitting(false); // Enable the button again
            }
          }}>
            {loginError && <p className="text-sm text-red-500 font-bold text-center bg-red-50 p-2 rounded-lg">{loginError}</p>}
            
            <input 
              type="email" 
              placeholder="البريد الإلكتروني" 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#1E4D4D] focus:ring-1 focus:ring-[#1E4D4D] outline-none transition-all"
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
              required
              disabled={isSubmitting}
            />
            <input 
              type="password" 
              placeholder="رمــز الدخــول" 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#1E4D4D] focus:ring-1 focus:ring-[#1E4D4D] outline-none transition-all"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              required
              disabled={isSubmitting}
            />
            
            <button 
              type="submit"
              disabled={isSubmitting}
              className={`w-full flex items-center justify-center gap-3 bg-[#1E4D4D] hover:bg-[#153636] active:scale-[0.98] rounded-xl py-3 px-4 font-black text-white transition-all shadow-lg shadow-emerald-900/20 mt-2 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'تسجيل الدخـول الآمـن'
              )}
            </button>
          </form>

          <div className="w-full flex items-center justify-center gap-4 mt-4">
            <button onClick={() => window.location.hash = '#/privacy'} className="text-xs font-bold text-slate-400 hover:text-[#1E4D4D] underline transition-colors">
              الخصوصية
            </button>
            <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
            <button onClick={() => window.location.hash = '#/terms'} className="text-xs font-bold text-slate-400 hover:text-[#1E4D4D] underline transition-colors">
              الشروط
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] min-h-screen w-full bg-[#F8FAFA] overflow-hidden font-sans relative text-slate-900" dir="rtl">
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

      <aside className={`fixed inset-y-0 right-0 w-64 bg-white border-l border-slate-100 z-[210] transition-all duration-500 lg:translate-x-0 lg:static ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full'}`}>
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
              <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-[2px] mb-3">القائمة الرئيسية</p>
              <div className="space-y-1">
                {visibleModules.filter(m => m.group === 'core').map(module => (
                  <button 
                    key={module.id}
                    onClick={() => handleNav(module.id)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-[13px] font-bold transition-all group ${currentView === module.id ? 'bg-[#1E4D4D] text-white shadow-lg shadow-emerald-900/10' : 'text-slate-500 hover:bg-slate-50 hover:text-[#1E4D4D]'}`}
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
              <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-[2px] mb-3">المبيعات والمشتريات</p>
              <div className="space-y-1">
                {visibleModules.filter(m => m.group === 'sales_purchases').map(module => (
                  <button 
                    key={module.id}
                    onClick={() => handleNav(module.id)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-[13px] font-bold transition-all group ${currentView === module.id ? 'bg-[#1E4D4D] text-white shadow-lg shadow-emerald-900/10' : 'text-slate-500 hover:bg-slate-50 hover:text-[#1E4D4D]'}`}
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
              <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-[2px] mb-3">الإدارة والتقارير</p>
              <div className="space-y-1">
                {visibleModules.filter(m => m.group === 'admin').map(module => (
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

            <div>
              <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-[2px] mb-3">النظام</p>
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

        {!isOperationalView && (
          <Header 
            pageTitle={getLabel()} 
            showBackButton={currentView !== 'dashboard'} 
            onBackClick={() => {
              if (currentView.startsWith('reports/') || currentView === 'aging-report') {
                handleNav('reports');
              } else {
                handleNav('dashboard');
              }
            }} 
          />
        )}

        <main className={`flex-1 overflow-y-auto bg-[#F8FAFA] custom-scrollbar ${isOperationalView ? 'p-1 sm:p-2 pt-0' : 'p-2 sm:p-4'}`}>
          <div className="max-w-full px-4 mx-auto min-h-full">
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
                  case 'settings': return <RoleGuard permission="MANAGE_SYSTEM"><SettingsModule onNavigate={handleNav} /></RoleGuard>;
                  case 'reconciliation': return <RoleGuard permission="FINANCIAL_ACCESS"><ReconciliationModule onNavigate={handleNav} /></RoleGuard>;
                  case 'system-health': return <RoleGuard permission="MANAGE_SYSTEM"><SystemHealthModule onNavigate={handleNav} /></RoleGuard>;
                  case 'invoices-archive': return <InvoicesArchiveModule onNavigate={handleNav} initialFilter={viewParams?.filter} />;
                  case 'invoice-history': return <RoleGuard permission="MANAGE_SYSTEM"><InvoiceHistoryModule onNavigate={handleNav} /></RoleGuard>;
                  case 'adjustments-registry': return <RoleGuard permission="FINANCIAL_ACCESS"><AdjustmentsArchiveModule onNavigate={handleNav} /></RoleGuard>;
                  case 'aging-report': return <RoleGuard permission="VIEW_REPORTS"><AgingReportModule onNavigate={handleNav} /></RoleGuard>;
                  case 'financial-dashboard': return <RoleGuard permission="VIEW_REPORTS"><FinancialDashboard onNavigate={handleNav} /></RoleGuard>;
                  case 'reports': return <RoleGuard permission="VIEW_REPORTS"><ReportsModule onNavigate={handleNav} /></RoleGuard>;
                  case 'advanced-reports': return <RoleGuard permission="VIEW_REPORTS"><AdvancedReportsModule onBack={() => handleNav('dashboard')} /></RoleGuard>;
                  
                  case 'reports/remaining-stock': return <RoleGuard permission="VIEW_REPORTS"><RemainingStockReport onNavigate={handleNav} /></RoleGuard>;
                  case 'reports/item-profits': return <RoleGuard permission="VIEW_REPORTS"><ItemProfitsReport onNavigate={handleNav} /></RoleGuard>;
                  case 'reports/customer-profit': return <RoleGuard permission="VIEW_REPORTS"><CustomerProfitReport onNavigate={handleNav} /></RoleGuard>;
                  case 'reports/supplier-profit': return <RoleGuard permission="VIEW_REPORTS"><SupplierProfitReport onNavigate={handleNav} /></RoleGuard>;
                  case 'reports/account-movement': return <RoleGuard permission="VIEW_REPORTS"><AccountMovementReport onNavigate={handleNav} /></RoleGuard>;
                  case 'reports/purchases-by-item': return <RoleGuard permission="VIEW_REPORTS"><PurchasesByItemReport onNavigate={handleNav} /></RoleGuard>;
                  case 'reports/sales-by-item': return <RoleGuard permission="VIEW_REPORTS"><SalesByItemReport onNavigate={handleNav} /></RoleGuard>;
                  case 'reports/item-movement-details': return <RoleGuard permission="VIEW_REPORTS"><ItemMovementDetailsReport onNavigate={handleNav} /></RoleGuard>;
                  case 'reports/expiry-items': return <RoleGuard permission="VIEW_REPORTS"><ExpiryItemsReport onNavigate={handleNav} /></RoleGuard>;

                  default: return <Dashboard lang="ar" onNavigate={handleNav} />;
                }
              })()}
            </Suspense>
          </div>
        </main>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-10 z-[1000] flex flex-col items-center">
        {toasts.map(t => <div key={t.id} className="pointer-events-auto"><Toast key={t.id} message={t.message} type={t.type as any} onClose={() => removeToast(t.id)} /></div>)}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8FAFA] flex items-center justify-center font-black text-[#1E4D4D] animate-pulse">جاري تحميل النظام السيادي...</div>}>
      <MainLayout />
    </Suspense>
  );
}

const LockScreen: React.FC<{ onUnlock: () => void }> = ({ onUnlock }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    try {
      const simplePass = localStorage.getItem("app_lock_pass") || "1234";
      const { appLockService } = await import('./services/AppLockService');
      
      // Check simple pass first, then secure service
      const isSimpleValid = password === simplePass;
      const isSecureValid = await appLockService.verifyPassword(password);

      if (isSimpleValid || isSecureValid) {
        await appLockService.updateActivity();
        onUnlock();
      } else {
        setError(true);
        setPassword('');
        setTimeout(() => setError(false), 2000);
      }
    } catch (err) {
      console.error("Unlock error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-[#1E4D4D]/95 backdrop-blur-xl flex items-center justify-center p-6 text-right" 
      dir="rtl"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        className="w-full max-w-md bg-white rounded-[40px] p-10 shadow-2xl space-y-8"
      >
        <div className="flex flex-col items-center gap-4">
          <Logo size={80} />
          <div className="text-center">
            <BrandName className="text-2xl justify-center" />
            <p className="text-slate-400 font-bold text-xs mt-1">يرجى إدخال كلمة المرور للمتابعة</p>
          </div>
        </div>

        <form onSubmit={handleUnlock} className="space-y-6">
          <div className="space-y-2">
            <input 
              type="password" 
              autoFocus
              placeholder="كلمة المرور"
              className={`w-full h-16 bg-slate-50 border-2 rounded-2xl px-6 text-center text-xl font-black outline-none transition-all ${error ? 'border-red-500 bg-red-50 animate-bounce' : 'border-transparent focus:border-blue-500'}`}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            {error && <p className="text-red-500 text-[10px] font-black text-center">كلمة المرور غير صحيحة</p>}
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full h-16 bg-[#1E4D4D] text-white rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            {loading ? 'جاري التحقق...' : <>فتح القفل <ArrowRight size={20} /></>}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
};
