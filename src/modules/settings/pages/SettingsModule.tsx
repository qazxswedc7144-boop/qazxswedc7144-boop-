import { useState, Suspense, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, Building2, Users, ShoppingCart, Truck, 
  Package, RefreshCw, Database, ShieldCheck, Code,
  Search, Save, ArrowRight
} from 'lucide-react';
import { LoadingSkeleton } from '../components/shared/SettingsUI';

// Lazy load tabs for performance
import { lazy } from 'react';
const GeneralTab = lazy(() => import('../components/tabs/GeneralTab'));
const PharmacyTab = lazy(() => import('../components/tabs/PharmacyTab'));
const UsersTab = lazy(() => import('../components/tabs/UsersTab'));
const SalesTab = lazy(() => import('../components/tabs/SalesTab'));
const PurchasesTab = lazy(() => import('../components/tabs/PurchasesTab'));
const InventoryTab = lazy(() => import('../components/tabs/InventoryTab'));
const SyncTab = lazy(() => import('../components/tabs/SyncTab'));
const DatabaseTab = lazy(() => import('../components/tabs/DatabaseTab'));
const SecurityTab = lazy(() => import('../components/tabs/SecurityTab'));
const DeveloperTab = lazy(() => import('../components/tabs/DeveloperTab'));

const TABS = [
  { id: 'general', label: 'إعدادات عامة', icon: Settings, component: GeneralTab },
  { id: 'pharmacy', label: 'الصيدلية', icon: Building2, component: PharmacyTab },
  { id: 'users', label: 'المستخدمون', icon: Users, component: UsersTab },
  { id: 'sales', label: 'المبيعات', icon: ShoppingCart, component: SalesTab },
  { id: 'purchases', label: 'المشتريات', icon: Truck, component: PurchasesTab },
  { id: 'inventory', label: 'المخزون', icon: Package, component: InventoryTab },
  { id: 'sync', label: 'المزامنة', icon: RefreshCw, component: SyncTab },
  { id: 'database', label: 'قاعدة البيانات', icon: Database, component: DatabaseTab },
  { id: 'security', label: 'الأمان', icon: ShieldCheck, component: SecurityTab },
  { id: 'developer', label: 'المطور', icon: Code, component: DeveloperTab }
];

interface SettingsModuleProps {
  onNavigate?: (view: string) => void;
}

export default function SettingsModule({ onNavigate }: SettingsModuleProps) {
  const [activeTab, setActiveTab] = useState(TABS[0]?.id || 'general');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const filteredTabs = useMemo(() => {
    if (!searchQuery) return TABS;
    return TABS.filter(t => t.label.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery]);

  const ActiveComponent = useMemo(() => {
    const tab = TABS.find(t => t.id === activeTab);
    return tab ? tab.component : GeneralTab;
  }, [activeTab]);

  const handleManualSave = async () => {
    setIsSaving(true);
    // Settings are already saved locally onChange in their respective tabs.
    // This button serves as a user-reassurance and triggers the Sync wake up.
    window.dispatchEvent(new CustomEvent('SYNC_WAKEUP'));
    
    setTimeout(() => {
      setIsSaving(false);
      setToastMessage('تم حفظ الإعدادات بنجاح وإرسالها للمزامنة');
      setTimeout(() => setToastMessage(''), 3000);
    }, 800);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-0 left-1/2 z-50 px-6 py-3 bg-slate-800 text-white rounded-xl shadow-2xl font-cairo text-sm font-bold flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate?.('dashboard')}
            className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <ArrowRight size={20} />
          </button>
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
            <Settings size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 font-cairo">مركز الإدارة</h1>
            <p className="text-sm text-slate-500 font-cairo">Enterprise Administration Center</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative w-full md:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="ابحث في الإعدادات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-cairo"
            />
          </div>
          <button
            onClick={handleManualSave}
            disabled={isSaving}
            className={`px-6 py-2.5 rounded-xl text-white font-bold font-cairo flex items-center gap-2 transition-all shadow-sm
              ${isSaving ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-md'}
            `}
          >
            <Save size={18} className={isSaving ? 'animate-pulse' : ''} />
            {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-white border-l border-slate-200 overflow-y-auto custom-scrollbar shrink-0 hidden md:block">
          <div className="p-4 space-y-1">
            {filteredTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-cairo text-right
                  ${activeTab === tab.id 
                    ? 'bg-indigo-50 text-indigo-700 font-bold' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                  }
                `}
              >
                <tab.icon size={18} className={activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'} />
                {tab.label}
              </button>
            ))}
            {filteredTabs.length === 0 && (
              <div className="text-center p-4 text-slate-500 text-sm font-cairo">
                لا توجد نتائج
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto">
             <Suspense fallback={<LoadingSkeleton />}>
                <ActiveComponent />
             </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
