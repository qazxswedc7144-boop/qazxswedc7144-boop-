
import React, { useState, useEffect, Suspense, lazy, useCallback, useTransition } from 'react';
import Dashboard from './components/Dashboard';
import { useUI } from './store/AppContext';
import { authService } from './services/auth.service';
import { db } from './services/database';
import { heartbeatService } from './services/heartbeat.service';
import { backupService } from './services/backup.service';
import { BackupService } from './services/backupService';
import { SyncService } from './services/SyncService';
import { FinancialHealthService } from './services/FinancialHealthService';
import { CurrencyService } from './services/CurrencyService';
import { LoadTestService } from './services/LoadTestService';
import { TestSuiteService } from './services/TestSuiteService';
import { SafeModePanel } from './components/SafeModePanel';
import { FinancialDefenseSystem } from './services/FinancialDefenseSystem';
import { useAppStore } from './store/useAppStore';
import { Permission } from './types';
import { Toast } from './components/SharedUI';
import NotificationCenter from './components/NotificationCenter'; 
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
const PurchasesView = lazy(() => import('./components/PurchasesInvoice'));
const SalesModule = lazy(() => import('./components/SalesModule'));
const InventoryModule = lazy(() => import('./components/InventoryModule'));
const InventoryAuditModule = lazy(() => import('./components/InventoryAuditModule'));
const SupplierManagement = lazy(() => import('./components/SupplierManagement'));
const AuditLogModule = lazy(() => import('./components/AuditLogModule'));
const AuditHistoryModule = lazy(() => import('./components/AuditHistoryModule')); 
const SettingsModule = lazy(() => import('./components/SettingsModule'));
const AccountingModule = lazy(() => import('./components/AccountingModule'));
const ReconciliationModule = lazy(() => import('./components/ReconciliationModule'));
const SystemHealthModule = lazy(() => import('./components/SystemHealthModule'));
const InvoicesArchiveModule = lazy(() => import('./components/InvoicesArchiveModule'));
const InvoiceHistoryModule = lazy(() => import('./components/InvoiceHistoryModule'));
const AdjustmentsArchiveModule = lazy(() => import('./components/AdjustmentsArchiveModule'));
const SupplierPaymentModule = lazy(() => import('./components/SupplierPaymentModule'));
const CustomerReceiptModule = lazy(() => import('./components/CustomerReceiptModule'));
const AgingReportModule = lazy(() => import('./components/AgingReportModule'));
const FinancialDashboard = lazy(() => import('./components/FinancialDashboard'));
const ReportsModule = lazy(() => import('./components/ReportsModule'));
const AdvancedReportsModule = lazy(() => import('./components/AdvancedReportsModule'));

// Lazy loading individual reports
const RemainingStockReport = lazy(() => import('./components/reports/RemainingStockReport'));
const ItemProfitsReport = lazy(() => import('./components/reports/ItemProfitsReport'));
const CustomerProfitReport = lazy(() => import('./components/reports/CustomerProfitReport'));
const SupplierProfitReport = lazy(() => import('./components/reports/SupplierProfitReport'));
const AccountMovementReport = lazy(() => import('./components/reports/AccountMovementReport'));
const PurchasesByItemReport = lazy(() => import('./components/reports/PurchasesByItemReport'));
const SalesByItemReport = lazy(() => import('./components/reports/SalesByItemReport'));
const ItemMovementDetailsReport = lazy(() => import('./components/reports/ItemMovementDetailsReport'));
const ExpiryItemsReport = lazy(() => import('./components/reports/ExpiryItemsReport'));

const MODULES: {id: any, label: string, icon: any, group: string, permission?: Permission}[] = [
  { id: 'dashboard', label: 'الرئيسية', icon: <Home size={20} />, group: 'core' },
  { id: 'sales', label: 'المبيعات', icon: <ShoppingBag size={20} />, group: 'sales_purchases', permission: 'POS_ACCESS' },
  { id: 'purchases', label: 'المشتريات', icon: <PackageIcon size={20} />, group: 'sales_purchases', permission: 'PURCHASE_ACCESS' },
  { id: 'inventory', label: 'المخزون', icon: <PackageIcon size={20} />, group: 'sales_purchases', permission: 'INVENTORY_VIEW' },
  { id: 'partners', label: 'العملاء والموردين', icon: <Users size={20} />, group: 'sales_purchases', permission: 'MANAGE_PARTNERS' },
  { id: 'accounting', label: 'المحاسبة', icon: <TableProperties size={20} />, group: 'sales_purchases', permission: 'FINANCIAL_ACCESS' },
  { id: 'aging-report', label: 'تعمير الذمم', icon: <Clock size={20} />, group: 'sales_purchases', permission: 'VIEW_REPORTS' },
  { id: 'audit-history', label: 'التدقيق', icon: <ShieldCheck size={20} />, group: 'sales_purchases', permission: 'MANAGE_SYSTEM' },
  { id: 'invoices-archive', label: 'الأرشيف', icon: <FolderArchive size={20} />, group: 'sales_purchases', permission: 'VIEW_REPORTS' },
  { id: 'adjustments-registry', label: 'الرسوم والخصومات', icon: <Tag size={20} />, group: 'admin', permission: 'FINANCIAL_ACCESS' },
  { id: 'system-health', label: 'صحة النظام', icon: <ShieldCheck size={20} />, group: 'admin', permission: 'MANAGE_SYSTEM' },
  { id: 'logs', label: 'سجل الرقابة', icon: <Database size={20} />, group: 'admin', permission: 'MANAGE_SYSTEM' },
  { id: 'settings', label: 'الإعدادات', icon: <Settings size={20} />, group: 'settings', permission: 'MANAGE_SYSTEM' },
  { id: 'reports', label: 'التقارير', icon: <BarChart3 size={20} />, group: 'admin', permission: 'VIEW_REPORTS' },
  { id: 'advanced-reports', label: 'تحليلات Gemini الذكية', icon: <AutoAwesome size={20} />, group: 'admin', permission: 'VIEW_REPORTS' },
];

function MainLayout() {
  const user = authService.getCurrentUser(); 
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

  const parseRoute = useCallback(() => {
    const hash = window.location.hash.replace('#/', '');
    if (!hash) return;
    const parts = hash.split('/');
    const view = parts[0];
    const id = parts[1];
    startTransition(() => {
      setCurrentView(view);
      if (id) {
        setEditingInvoiceId(id);
        setViewParams({ id });
      }
    });
  }, [setEditingInvoiceId]);

  useEffect(() => {
    let stopCurrencyObserver: (() => void) | null = null;

    const init = async () => { 
      await db.init();
      const { AccountingEngine } = await import('./services/AccountingEngine');
      await AccountingEngine.seedAccounts();
      heartbeatService.start(); 
      backupService.startAutoTimer();
      SyncService.startWorker();
      FinancialDefenseSystem.startBackgroundScanner();
      
      stopCurrencyObserver = CurrencyService.startCurrencyObserver((code) => {
        setCurrency(code);
      });

      await FinancialHealthService.refreshHealthMonitor();

      const syncTimer = setInterval(async () => {
        const status = await SyncService.getSyncStatus();
        setSyncStatus(status);
        const threat = await db.getSetting('SYSTEM_THREAT_LEVEL', '0');
        setRiskScore(parseInt(threat));
      }, 5000);
      
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
      SyncService.stopWorker();
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
    return 'العملية';
  };

  const isOperationalView = ['sales', 'purchases', 'invoice-registry', 'sales-archive', 'invoices-archive', 'invoice-history', 'adjustments-registry', 'supplier-payment', 'customer-receipt', 'aging-report', 'partners', 'inventory', 'audit-history'].includes(currentView);

  const visibleModules = MODULES.filter(m => !m.permission || authService.hasPermission(m.permission));

  return (
    <div className="flex h-screen bg-[#F8FAFA] overflow-hidden font-sans relative text-slate-900" dir="rtl">
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
          <div className="px-8 py-8 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1E4D4D] rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/20">
                <PackageIcon className="text-white" size={20} />
              </div>
              <span className="text-xl font-black text-[#1E4D4D] tracking-tighter">PharmaFlow</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden w-10 h-10 flex items-center justify-center bg-slate-50 rounded-xl text-slate-400 hover:bg-slate-100 transition-all"><X size={20} /></button>
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
                <p className="text-xs font-bold text-[#1E4D4D] truncate">{user.User_Name}</p>
              </div>
              <button onClick={() => authService.logout()} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
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
          <header className="h-14 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center px-6 sm:px-8 shrink-0 z-[150] sticky top-0 shadow-sm">
            <div className="flex-1 flex items-center gap-4">
              {currentView === 'dashboard' && (
                <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-[#1E4D4D] shadow-sm hover:bg-slate-50 transition-all"><Menu size={22} /></button>
              )}
              {currentView !== 'dashboard' && (
                <button 
                  onClick={() => {
                    if (currentView.startsWith('reports/') || currentView === 'aging-report') {
                      handleNav('reports');
                    } else {
                      handleNav('dashboard');
                    }
                  }} 
                  className="w-10 h-10 bg-slate-50 text-[#1E4D4D] rounded-xl flex items-center justify-center border border-slate-100 hover:bg-slate-100 transition-all"
                  title="العودة"
                >
                  <ArrowRight size={20} />
                </button>
              )}
            </div>
            
            <div className="flex-1 flex justify-center items-center">
              {currentView !== 'reports' && (
                <h1 className="text-sm font-bold text-[#1E4D4D] bg-slate-50 px-6 py-2 rounded-full border border-slate-100 whitespace-nowrap">
                  {getLabel()}
                </h1>
              )}
            </div>

            <div className="flex-1 flex items-center justify-end gap-4">
            </div>
          </header>
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
                  case 'partners': return <RoleGuard permission="FINANCIAL_ACCESS"><SupplierManagement lang="ar" onNavigate={handleNav} /></RoleGuard>;
                  case 'inventory': return <InventoryModule onNavigate={handleNav} />;
                  case 'inventory-audit': return <InventoryAuditModule lang="ar" onNavigate={handleNav} />;
                  case 'accounting': return <RoleGuard permission="FINANCIAL_ACCESS"><AccountingModule onNavigate={handleNav} /></RoleGuard>;
                  case 'audit-history': return <RoleGuard permission="MANAGE_SYSTEM"><AuditHistoryModule onNavigate={handleNav} recordId={viewParams?.id} /></RoleGuard>;
                  case 'settings': return <RoleGuard permission="MANAGE_SYSTEM"><SettingsModule onNavigate={handleNav} /></RoleGuard>;
                  case 'logs': return <RoleGuard permission="MANAGE_SYSTEM"><AuditLogModule onNavigate={handleNav} /></RoleGuard>;
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
  return <MainLayout />;
}
