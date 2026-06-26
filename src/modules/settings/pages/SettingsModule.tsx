
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { db } from '@/core/db';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { 
  Settings, Lock, Plus, ShieldCheck, Receipt, Network, ArrowRightLeft, 
  Printer, Globe, Moon, RefreshCcw, 
  BarChart3, Landmark, Calculator, 
  KeyRound, ScanLine, 
  Info, Shield, 
  Clock, 
  User, Type, Phone, MapPin,
  History, RefreshCw,
  Users, DatabaseBackup, Sparkles, Brain, Eye, EyeOff,
  CreditCard, LayoutDashboard
} from 'lucide-react';
import { Button, Badge, Input, Modal } from '@/components/shared/SharedUI';
import { useUI } from '@/contexts/AppContext';
import { AccountingPeriodRepository } from '@/database/repositories/AccountingPeriodRepository';
import { authService } from '@/modules/auth/services/authService';
import { CurrencySelector } from '@/components/shared/CurrencySelector';
import { motion, AnimatePresence } from 'motion/react';
import { BackupService } from '@/services/backupService';
import { localBackupService } from '@/services/integrity/shared/localBackupService';
import { ReviewerSaaSTester, SubscriptionGlobalUsageRibbon } from '@/components/saas/SubscriptionWidgets';
import BackupManagementComponent from '@/modules/settings/components/BackupManagement';

// --- Tab Components ---

const SubscriptionTab = () => (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
        <ReviewerSaaSTester />
    </div>
);

const SecurityTab = ({ loginEnabled, toggleLogin }: { loginEnabled: boolean; toggleLogin: () => void }) => (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl">
            <div>
                <p className="font-bold text-slate-800 dark:text-slate-100">تفعيل شاشة تسجيل دخول النظام</p>
                <p className="text-xs text-slate-500 mt-1">عند التعطيل، سيتم تجاوز شاشة الدخول تلقائياً</p>
            </div>
            <button 
                onClick={toggleLogin}
                className={`w-12 h-6 rounded-full transition-colors ${loginEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
            >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${loginEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        </div>
        {/* Placeholder for user permission matrix */}
        <div className="p-4 border border-dashed rounded-2xl text-center text-slate-400 text-xs">
            مصفوفة صلاحيات المستخدمين (قريباً)
        </div>
    </div>
);


const ProfileTab = ({ invoiceConfig, setInvoiceConfig, saveInvoiceConfig }: any) => (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="اسم الصيدلية" value={invoiceConfig.pharmacyName} onChange={e => setInvoiceConfig({...invoiceConfig, pharmacyName: e.target.value})} icon={<Type size={14}/>} />
            <Input label="رقم الهاتف" value={invoiceConfig.phone} onChange={e => setInvoiceConfig({...invoiceConfig, phone: e.target.value})} icon={<Phone size={14}/>} />
            <Input label="العنوان" value={invoiceConfig.address} onChange={e => setInvoiceConfig({...invoiceConfig, address: e.target.value})} icon={<MapPin size={14}/>} />
            <Input label="الرقم الضريبي" value={invoiceConfig.taxNumber} onChange={e => setInvoiceConfig({...invoiceConfig, taxNumber: e.target.value})} icon={<Info size={14}/>} />
        </div>
        <CurrencySelector />
        <Button variant="approve" onClick={() => saveInvoiceConfig(invoiceConfig)}>حفظ التغييرات</Button>
    </div>
);

const SyncTab = ({ handleExportBackup, handleImportBackup, loading }: any) => (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
        <div className="grid grid-cols-2 gap-4">
            <Button variant="primary" onClick={handleExportBackup} isLoading={loading}>إنشاء نسخة احتياطية</Button>
            <Button variant="secondary" onClick={handleImportBackup} isLoading={loading}>استعادة نسخة</Button>
        </div>
        <Button variant="neutral" className="w-full" onClick={() => console.log('Syncing...')}>مزامنة يدوية مع السحابة</Button>
    </div>
);



interface InvoiceConfig {
  pharmacyName: string;
  address: string;
  phone: string;
  taxNumber: string;
  footerNote: string;
  layoutType: 'standard' | 'compact' | 'detailed';
  showLogo: boolean;
}

const Section = React.memo(({ 
  title, 
  desc, 
  icon: Icon, 
  isOpen, 
  toggle, 
  children,
  badge
}: { 
  title: string; 
  desc: string; 
  icon: any; 
  isOpen: boolean; 
  toggle: () => void; 
  children: React.ReactNode;
  badge?: string;
}) => {
  return (
    <motion.div
      layout
      className={`bg-white dark:bg-gray-800 rounded-2xl border overflow-hidden cursor-pointer shadow-sm transition-all duration-200 ${
        isOpen
          ? "border-indigo-500/50 dark:border-indigo-400/50 shadow-md shadow-indigo-500/5"
          : "border-gray-100 dark:border-gray-700/70 hover:border-gray-200 dark:hover:border-gray-600"
      }`}
      whileHover={{ scale: 1.002 }}
      whileTap={{ scale: 0.998 }}
      onClick={toggle}
    >
      {/* Header Part */}
      <div className="flex justify-between items-center px-5 py-4">
        <div className="flex items-center gap-3.5 text-right">
          <span className={`transition-colors duration-200 ${
            isOpen ? "text-indigo-500 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"
          }`}>
            <Icon size={22} strokeWidth={2} />
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span
                className={`font-bold text-base transition-colors duration-200 ${
                  isOpen
                    ? "text-indigo-500 dark:text-indigo-400"
                    : "text-slate-700 dark:text-slate-200"
                }`}
              >
                {title}
              </span>
              {badge && (
                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full border border-indigo-100/60 dark:border-indigo-500/20 font-bold uppercase tracking-tighter">
                  {badge}
                </span>
              )}
            </div>
            {!isOpen && <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">{desc}</p>}
          </div>
        </div>
        <motion.span
          className={`text-[10px] p-1.5 rounded-lg transition-colors ${
            isOpen
              ? "bg-indigo-50 text-indigo-500 dark:bg-indigo-950 dark:text-indigo-400"
              : "bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-slate-400"
          }`}
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25 }}
        >
          ▼
        </motion.span>
      </div>

      {/* Internal Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 29 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-3 border-t border-gray-50 dark:border-gray-700/40" onClick={(e) => e.stopPropagation()}>
               {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

const SettingsModule: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('subscription');
  const [loginEnabled, setLoginEnabled] = useState(localStorage.getItem('system_login_enabled') !== 'false');
  
  // Custom states matching Objective 5 and 6
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('system');
  const [printerProfile, setPrinterProfile] = useState<'58mm' | '80mm' | 'a4'>('80mm');
  const [printCopies, setPrintCopies] = useState<number>(1);
  const [printLogo, setPrintLogo] = useState<boolean>(true);
  const [printQR, setPrintQR] = useState<boolean>(true);
  const [showPrivacyModal, setShowPrivacyModal] = useState<boolean>(false);
  const [showDevInfo, setShowDevInfo] = useState<boolean>(false);

  const handleDeveloperClick = () => {
    setShowDevInfo(true);
    // Auto-hide after 7 seconds for a smooth user experience
    setTimeout(() => setShowDevInfo(false), 7000);
  };

  const [modalConfig, setModalConfig] = useState<{
    open: boolean;
    type: string;
    requiredFields: string[];
    saveFunction: ((data: any) => Promise<void>) | null;
  }>({
    open: false,
    type: "",
    requiredFields: [],
    saveFunction: null
  });

  const [newDocData, setNewDocData] = useState<any>({});

  const [invoiceConfig, setInvoiceConfig] = useState<InvoiceConfig>({
    pharmacyName: 'صيدلية فارما فلو',
    address: 'دبي، الإمارات العربية المتحدة',
    phone: '050XXXXXXX',
    taxNumber: '100XXXXXXXXXXXX',
    footerNote: 'شكراً لزيارتكم، نتمنى لكم دوام الصحة والعافية.',
    layoutType: 'standard',
    showLogo: true
  });
  
  const [periods, setPeriods] = useState<any[]>([]);
  const [newPeriod, setNewPeriod] = useState({ start: '', end: '' });
  const [stats, setStats] = useState({ products: 0, invoices: 0, customers: 0, records: 0 });
  const [loading, setLoading] = useState(false);
  const [showBackupHistory, setShowBackupHistory] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);

  const { refreshGlobal, addToast, version } = useUI();
  const user = authService.getCurrentUser();

  // Load SaaS & Printers Settings on Mount
  useEffect(() => {
    const load = async () => {
      try {
        const savedConfig = await db.getSetting('invoice_config', null);
        if (savedConfig) setInvoiceConfig(savedConfig);

        // Load thermal/printer matrix settings
        const savedProfile = localStorage.getItem('saas_printer_profile') as any || '80mm';
        const savedCopies = parseInt(localStorage.getItem('saas_print_copies') || '1', 10);
        const savedLogo = localStorage.getItem('saas_print_logo') !== 'false';
        const savedQR = localStorage.getItem('saas_print_qr') !== 'false';
        
        setPrinterProfile(savedProfile);
        setPrintCopies(savedCopies);
        setPrintLogo(savedLogo);
        setPrintQR(savedQR);

        // Load theme preferences
        const savedTheme = localStorage.getItem('saas_theme_mode') as any || 'system';
        setThemeMode(savedTheme);

        const pList = await AccountingPeriodRepository.getAll();
        setPeriods(pList);

        const pCount = await db.products.count();
        const iCount = await db.invoices.count();
        const cCount = await db.customers.count();
        setStats({ products: pCount, invoices: iCount, customers: cCount, records: pCount + iCount + cCount });

        const savedGeminiKey = await db.getSetting('gemini_api_key', '');
        setGeminiKey(savedGeminiKey);
      } catch (e) {
        console.error("load settings failed:", e);
      }
    };
    load();
  }, [version]);

  // Bi-valent Theme Engine Effect
  useEffect(() => {
    let isDark = false;
    if (themeMode === 'dark') {
      isDark = true;
    } else if (themeMode === 'system') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [themeMode]);

  const changeThemeMode = (mode: 'light' | 'dark' | 'system') => {
    localStorage.setItem('saas_theme_mode', mode);
    setThemeMode(mode);
    window.dispatchEvent(new Event('saas-theme-updated'));
    addToast(`تم تفعيل المظهر بنجاح`, "success");
  };

  const handleUpdatePrinterSetting = (key: string, value: any) => {
    localStorage.setItem(key, String(value));
  };

  const toggleSection = (id: string) => {
    setOpenSection(openSection === id ? null : id);
  };

  const saveInvoiceConfig = async (newConfig: InvoiceConfig) => {
    try {
      setInvoiceConfig(newConfig);
      await db.saveSetting('invoice_config', newConfig);
      addToast("تم حفظ إعدادات الفاتورة بنجاح ✅", "success");
    } catch (e) {
      addToast("فشل حفظ إعدادات الفاتورة", "error");
    }
  };

  const handleCreatePeriod = async () => {
    if (!newPeriod.start || !newPeriod.end) {
      addToast("يرجى تحديد تاريخ البداية والنهاية", "warning");
      return;
    }
    try {
      await AccountingPeriodRepository.createPeriod(newPeriod.start, newPeriod.end);
      addToast("تم إنشاء الفترة المحاسبية بنجاح ✅", "success");
      setNewPeriod({ start: '', end: '' });
      refreshGlobal();
    } catch (e) {
      addToast("فشل إنشاء الفترة المحاسبية", "error");
    }
  };

  const handleTogglePeriod = async (id: string, currentlyClosed: boolean) => {
    try {
      if (currentlyClosed) {
        await AccountingPeriodRepository.openPeriod(id);
        addToast("تم فتح الفترة المحاسبية", "info");
      } else {
        await AccountingPeriodRepository.closePeriod(id, user?.User_Email || 'SYSTEM');
        addToast("تم إغلاق الفترة بنجاح 🔒", "success");
      }
      refreshGlobal();
    } catch (e) {
      addToast("فشل تغيير حالة الفترة المحاسبية", "error");
    }
  };

  const handleExportBackup = async () => {
    const password = window.prompt('يرجى تعيين كلمة مرور لتشفير ملف النسخة الاحتياطية (.enc):');
    if (!password) {
      addToast('كلمة المرور مطلوبة ولا يمكن أن تكون فارغة.', 'error');
      return;
    }
    setLoading(true);
    try {
      const blob = await BackupService.exportBackupToFile(password);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `pharmaflow_backup_${new Date().toISOString().split('T')[0]}.enc`;
      a.click();
      addToast('تم تصدير ملف النسخة بنجاح ✅', 'success');
    } catch (error: any) {
      addToast(`فشل التصدير: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImportBackup = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.enc,.json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const isEnc = file.name.endsWith('.enc');
      let password = '';
      if (isEnc) {
        const p = window.prompt('يرجى إدخال كلمة مرور فك تشفير الملف:');
        if (p === null) return;
        password = p;
      }

      setLoading(true);
      try {
        if (isEnc) {
          await BackupService.restoreBackup(file, password);
        } else {
          await localBackupService.restoreBackup(file);
        }
        addToast('تم استعادة البيانات بنجاح 🚀', 'success');
        refreshGlobal();
      } catch (err: any) {
        addToast(`فشل الاستعادة: ${err.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };
    input.click();
  };

  const handleSaveGeminiKey = async () => {
    try {
      await db.saveSetting('gemini_api_key', geminiKey);
      addToast("تم حفظ مفتاح Gemini API بنجاح ✅", "success");
    } catch (e) {
      addToast("فشل حفظ مفتاح API", "error");
    }
  };

  const handleTestGeminiConnection = async () => {
    if (!geminiKey) {
      addToast("يرجى إدخال مفتاح API أولاً", "warning");
      return;
    }
    
    setIsTestingKey(true);
    try {
      const token = localStorage.getItem("pharmaflow_token") || localStorage.getItem("token") || "";
      const response = await fetch("/api/ai/test-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ key: geminiKey })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${response.status}`);
      }

      const resData = await response.json();
      if (resData.success) {
        addToast(`نجح الاتصال: ${resData.text}`, "success");
      } else {
        throw new Error(resData.message || "فشل الاتصال بمفتاح الـ API");
      }
    } catch (error: any) {
      console.error("Gemini Test Failed:", error);
      addToast(`فشل الاتصال: ${error.message || 'خطأ غير معروف'}`, "error");
    } finally {
      setIsTestingKey(false);
    }
  };

  const saveDocument = async (data: any) => {
    if (modalConfig.saveFunction) {
      await modalConfig.saveFunction(data);
    }
  };

  return (
    <div
      className="w-full min-h-screen bg-slate-50/50 dark:bg-gray-950 pb-32 font-sans text-slate-800 dark:text-slate-100 transition-colors duration-300 text-right"
      dir="rtl"
    >
      {/* الهيدر العلوي - متناسق وعائم */}
      <div className="sticky top-0 z-40 bg-white/90 dark:bg-gray-800/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-750 py-3 px-4 mb-5 flex items-center justify-between rounded-b-2xl shadow-sm max-w-3xl mx-auto">
        <span className="text-lg font-bold bg-gradient-to-l from-slate-800 to-slate-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
          إعدادات النظام
        </span>
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] sm:text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-100/60 dark:border-emerald-500/20 font-bold tracking-wide">
            PharmaFlow v2.4
          </span>
          <button
            onClick={() => changeThemeMode(themeMode === 'light' ? 'dark' : 'light')}
            className="p-2 rounded-xl bg-gray-50 dark:bg-gray-700/60 text-lg leading-none transition-all duration-200 active:scale-90 border border-gray-100 dark:border-gray-600/40 cursor-pointer"
            title="تبديل المظهر"
          >
            {themeMode === 'light' ? "🌙" : "☀️"}
          </button>
          <button 
            onClick={() => onNavigate?.('dashboard')} 
            className="p-2 rounded-xl bg-gray-50 dark:bg-gray-700/60 transition-all duration-200 active:scale-90 border border-gray-100 dark:border-gray-600/40 text-slate-400 dark:text-slate-300"
          >
            <Plus size={20} className="rotate-45" />
          </button>
        </div>
      </div>
      
      <div className="max-w-3xl mx-auto">
        <SubscriptionGlobalUsageRibbon onUpgrade={() => onNavigate?.('saas-portal')} />
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-6">
        {/* تبويبات التنقل */}
        <div className="flex gap-2 p-1 bg-white dark:bg-gray-800 rounded-xl mb-6 shadow-sm border border-gray-100 dark:border-gray-700">
            {[
                { id: 'subscription', label: 'الاشتراك', icon: CreditCard },
                { id: 'security', label: 'الأمان', icon: ShieldCheck },
                { id: 'profile', label: 'الملف', icon: User },
                { id: 'sync', label: 'المزامنة', icon: RefreshCw }
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all ${activeTab === tab.id ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <tab.icon size={18} />
                    {tab.label}
                </button>
            ))}
        </div>

        {/* محتوى التبويبات */}
        <div className="mt-4">
            {activeTab === 'subscription' && <SubscriptionTab />}
            {activeTab === 'security' && (
              <SecurityTab 
                loginEnabled={loginEnabled} 
                toggleLogin={() => {
                  const next = !loginEnabled;
                  setLoginEnabled(next);
                  localStorage.setItem('system_login_enabled', String(next));
                }} 
              />
            )}


                 <div className="text-center mt-6">
                    <span className="text-[9px] text-slate-400 font-black uppercase">© PharmaFlow Pro 2026. جميع الحقوق محفوظة لمالك المنصة.</span>
                 </div>
              </div>
          </div>



      <Modal 
        isOpen={showBackupHistory} 
        onClose={() => setShowBackupHistory(false)} 
        title="سجل النسخ الاحتياطية"
        maxWidth="max-w-3xl"
      >
        <div className="p-2 overflow-x-hidden">
           <BackupManagementComponent />
        </div>
      </Modal>

      {/* Privacy Policy and Google Play Console Compliance Modal */}
      <Modal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        title="وثيقة معايير الخصوصية وحماية بيانات الرعاية الصحية (Google Play Compliant)"
        maxWidth="max-w-2xl"
      >
        <div className="p-6 text-right space-y-5 overflow-y-auto max-h-[85vh] dark:bg-slate-900" dir="rtl">
          <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300">
            <h5 className="text-xs font-black mb-1 flex items-center gap-1.5">
              <span>✓ مطابقة شروط حماية البيانات الصحية والمالية في متجر Google Play</span>
            </h5>
            <p className="text-[10px] sm:text-xs leading-relaxed font-bold">
              تلتزم منصة PharmaFlow Pro بمتطلبات تشفير وحفظ السجلات الصحية الصارمة متضمنة HIPAA لبيانات المرضى وGDPR للخصوصية. لا يتم بيع البيانات إطلاقاً وللمستأجر الحق الكامل في طلب التصفير.
            </p>
          </div>

          {/* Section 1: UI Compact text pane */}
          <div className="space-y-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <h4 className="text-xs font-black text-slate-800 dark:text-white">1. نطاق جمع البيانات ومسؤولية المنصة (Data Custody Policy)</h4>
            <div className="bg-slate-50 dark:bg-gray-850 p-4 rounded-xl text-[11px] text-slate-600 dark:text-gray-300 space-y-2 leading-relaxed font-bold">
              <p>
                <strong>نطاق حيازة البيانات:</strong> نجمع بيانات الصيدلية، الأدوية والأصناف، الفواتير، بيانات المرضى، والعمليات التجارية لغرض الحسابات وحظر تكرار فروع الصيدليات.
              </p>
              <p>
                <strong>مشاركة البيانات:</strong> لا يتم بيع أو تأجير أو مشاركة أي جزء من البيانات الصحية أو المحاسبية إلى أي طرف ثالث على الإطلاق. البيانات مشفرة محلياً على جهاز العميل ومحمية بنظام AES-GCM 256.
              </p>
              <p>
                <strong>طلب الإزالة الفورية:</strong> تتيح المنصة بروتوكول حذف وسحب البيانات بالكامل عبر حساب المالك الرئيسي والتحميل الفوري للنسخ الاحتياطية.
              </p>
            </div>
          </div>

          {/* Section 2: External Compliance Page */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-800 dark:text-white">2. كود موقع سياسة الخصوصية لمتجر Google Play Console</h4>
            <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
              قم بنسخ كود HTML الجاهز هذا ورفعه كصفحة إنترنت مستضافة لعرض سياسة الخصوصية الرسمية للامتثال لمتطلبات جوجل بلاي:
            </p>
            <div className="relative">
              <textarea
                readOnly
                value={`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>سياسة الخصوصية لـ PharmaFlow Pro ERP</title>
</head>
<body style="font-family: sans-serif; padding: 40px; color: #333;">
    <h1>سياسة الخصوصية وحماية بيانات المرضى لبرنامج PharmaFlow Pro ERP</h1>
    <p>تاريخ آخر تحديث: 2 يونيو 2026</p>
    <h2>1. البيانات التي يتم جمعها وحفظها:</h2>
    <p>يتعامل التطبيق مع بيانات صيدلانية حساسة لحسابات الفواتير، والأصناف، والتحويلات الدوائية، وإثبات هويات العملاء والموظفين تماشياً مع معايير HIPAA.</p>
    <h2>2. بروتوكول التشفير والأمان:</h2>
    <p>تُخزن كافة البيانات التجارية والصيدلانية محلياً بشكل مشفر باستخدام خوارزميات AES-GCM ولا يتم مشاركتها أو بيعها لأي جهة إعلانية أو طرف ثالث.</p>
    <h2>3. حق حذف البيانات:</h2>
    <p>يمكن للمستخدمين الاتصال بمالك المنصة وحذف كافة حسابات الفروع ومعلومات المزامنة بشكل فوري عبر لوحة الإدارة.</p>
</body>
</html>`}
                className="w-full h-32 font-mono text-[9px] bg-slate-900 text-emerald-400 p-3 rounded-2xl outline-none select-all animate-none"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>سياسة الخصوصية لـ PharmaFlow Pro ERP</title>
</head>
<body style="font-family: sans-serif; padding: 40px; color: #333;">
    <h1>سياسة الخصوصية وحماية بيانات المرضى لبرنامج PharmaFlow Pro ERP</h1>
    <p>تاريخ آخر تحديث: 2 يونيو 2026</p>
    <h2>1. البيانات التي يتم جمعها وحفظها:</h2>
    <p>يتعامل التطبيق مع بيانات صيدلانية حساسة لحسابات الفواتير، والأصناف، والتحويلات الدوائية، وإثبات هويات العملاء والموظفين تماشياً مع معايير HIPAA.</p>
    <h2>2. بروتوكول التشفير والأمان:</h2>
    <p>تُخزن كافة البيانات التجارية والصيدلانية محلياً بشكل مشفر باستخدام خوارزميات AES-GCM ولا يتم مشاركتها أو بيعها لأي جهة إعلانية أو طرف ثالث.</p>
    <h2>3. حق حذف البيانات:</h2>
    <p>يمكن للمستخدمين الاتصال بمالك المنصة وحذف كافة حسابات الفروع ومعلومات المزامنة بشكل فوري عبر لوحة الإدارة.</p>
</body>
</html>`);
                  addToast("تم نسخ الكود الرسمي بنجاح📋", "success");
                }}
                className="absolute left-3 bottom-3 bg-slate-800 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold hover:bg-[#1E4D4D] cursor-pointer"
              >
                نسخ كود HTML المتكامل
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <AnimatePresence>
        {modalConfig.open && (
          <UnifiedModal
            type={modalConfig.type}
            saveFunction={saveDocument}
            requiredFields={modalConfig.requiredFields}
            formData={newDocData}
            setFormData={setNewDocData}
            onClose={() => setModalConfig({ ...modalConfig, open: false })}
          >
            <div className="p-4 bg-indigo-50 dark:bg-indigo-500/5 rounded-2xl border border-indigo-100 dark:border-indigo-500/20">
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold leading-relaxed text-center">
                سيتم ترحيل هذا المستند إلى السجلات المحاسبية (Dexie) فور الحفظ. يرجى مراجعة المبالغ بدقة.
              </p>
            </div>
          </UnifiedModal>
        )}
      </AnimatePresence>
    </div>
  );
};

const SecuritySettingsTab: React.FC = () => {
  const { authenticationEnabled, setAuthenticationEnabled } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [simplePin, setSimplePin] = useState('');
  const [form, setForm] = useState({ username: '', password: '', confirm: '', mode: '5m' as any });
  const { addToast, refreshGlobal } = useUI();
  const [loading, setLoading] = useState(false);

  // Task 2: Additional security parameters tracked in Dexie systemSettings
  const [lockOnStartup, setLockOnStartup] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [autoLockEnabled, setAutoLockEnabled] = useState(false);

  // Task 3: First Admin Bootstrap Wizard elements
  const [isBootstrapModalOpen, setIsBootstrapModalOpen] = useState(false);
  const [bootstrapUsername, setBootstrapUsername] = useState('');
  const [bootstrapPassword, setBootstrapPassword] = useState('');
  const [bootstrapConfirmPassword, setBootstrapConfirmPassword] = useState('');
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  const handleBootstrapSubmit = async () => {
    if (!bootstrapUsername || !bootstrapPassword || !bootstrapConfirmPassword) {
      addToast("الرجاء ملء جميع الحقول المطلوبة ⚠️", "warning");
      return;
    }
    if (bootstrapPassword !== bootstrapConfirmPassword) {
      addToast("كلمة المرور وتأكيدها غير متطابقتين ❌", "error");
      return;
    }
    if (bootstrapPassword.length < 6) {
      addToast("يجب أن تكون كلمة المرور مكونة من 6 أحرف على الأقل 🛡️", "warning");
      return;
    }
    setIsBootstrapping(true);
    try {
      // Hash the password using bcryptjs on the frontend for local database recording
      let localHash = "";
      try {
        const bcryptjs = await import('bcryptjs');
        localHash = await bcryptjs.default.hash(bootstrapPassword, 10);
      } catch (e) {
        console.warn("Could not hash local password with bcryptjs on client:", e);
      }

      // Record the user as ADMIN in the local indexDb database
      try {
        await db.branchUsers.put({
          id: 'admin',
          userId: 'admin',
          username: bootstrapUsername.trim().toLowerCase(),
          role: 'ADMIN',
          passwordHash: localHash || bootstrapPassword,
          createdAt: new Date()
        });
      } catch (e) {
        console.error("Local save of admin user failed:", e);
      }

      // Provision user in server registry
      const res = await axios.post('/api/auth/bootstrap', {
        username: bootstrapUsername.trim(),
        password: bootstrapPassword,
        tenantName: "المؤسسة الدوائية المركزية"
      });

      if (res.data.success) {
        addToast("تمت تهيئة حساب المدير وتأسيس النظام الفيدرالي بنجاح 👑", "success");
        setIsBootstrapModalOpen(false);
        // Clear wizard fields
        setBootstrapUsername('');
        setBootstrapPassword('');
        setBootstrapConfirmPassword('');
        
        // Once account is provisioned, set authenticationEnabled = true, revoke local-admin, clear context, and force a redirection to LoginScreen
        await setAuthenticationEnabled(true);
        window.location.hash = '#/login';
        window.location.reload();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "فشلت عملية تهيئة المدير";
      addToast(`خطأ أثناء التهيئة: ${msg} ❌`, "error");
    } finally {
      setIsBootstrapping(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const isEnabled = await appLockService.isSimpleLockEnabled();
        setAppLockEnabled(isEnabled);
        const s = await appLockService.getSettings();
        setSettings(s);
        if (s) {
          setForm(f => ({ ...f, username: s.username, mode: s.lock_mode }));
        }

        // Load Dexie local system security parameters
        const los = await db.systemSettings.get('lockOnStartup');
        if (los !== undefined) {
          setLockOnStartup(los.value === true);
        }
        const bio = await db.systemSettings.get('biometricEnabled');
        if (bio !== undefined) {
          setBiometricEnabled(bio.value === true);
        }
        const aut = await db.systemSettings.get('autoLockEnabled');
        if (aut !== undefined) {
          setAutoLockEnabled(aut.value === true);
        }
      } catch (e) {
        console.error("load security settings failed:", e);
      }
    };
    load();
  }, []);

  const toggleAppLock = async (value: boolean) => {
    try {
      setAppLockEnabled(value);
      await appLockService.setSimpleLockEnabled(value);
      addToast(value ? "تم تفعيل القفل السريع" : "تم تعطيل القفل السريع", "info");
    } catch (e) {
      addToast("فشل تغيير حالة القفل", "error");
    }
  };

  const toggleLockOnStartup = async (checked: boolean) => {
    try {
      setLockOnStartup(checked);
      await db.systemSettings.put({ key: 'lockOnStartup', value: checked });
      addToast(checked ? "تم تفعيل القفل تلقائياً عند بدء التشغيل 🔒" : "تم تعطيل قفل بدء التشغيل 🔓", "success");
    } catch (e) {
      addToast("فشل تفعيل/تعطيل خيار قفل التشغيل", "error");
    }
  };

  const toggleBiometric = async (checked: boolean) => {
    try {
      setBiometricEnabled(checked);
      await db.systemSettings.put({ key: 'biometricEnabled', value: checked });
      addToast(checked ? "تم تفعيل المصادقة الحيوية والبصمة بنجاح 🧬" : "تم تعطيل المصادقة الحيوية 🔓", "success");
    } catch (e) {
      addToast("فشل تفعيل/تعطيل بصمة الإصبع والوجه", "error");
    }
  };

  const toggleAutoLock = async (checked: boolean) => {
    try {
      setAutoLockEnabled(checked);
      await db.systemSettings.put({ key: 'autoLockEnabled', value: checked });
      addToast(checked ? "تم تفعيل القفل التلقائي عند الخمول والتوقف ⏱️" : "تم تعطيل القفل التلقائي للخمول 🔓", "success");
    } catch (e) {
      addToast("فشل تفعيل/تعطيل القفل التلقائي", "error");
    }
  };

  const handleSaveSimplePin = async () => {
    if (!simplePin) return;
    try {
      await appLockService.setSimplePin(simplePin);
      addToast("تم حفظ رمز القفل السريع بنجاح ✅", "success");
      setSimplePin('');
    } catch (e) {
      addToast("فشل حفظ رمز القفل", "error");
    }
  };

  const handleEnable = async () => {
    if (!form.username || !form.password) {
      addToast("يرجى إدخال اسم المستخدم وكلمة المرور", "warning");
      return;
    }
    setLoading(true);
    try {
      await appLockService.enableSecurity(form.username, form.password, form.mode);
      addToast("تم تفعيل أمان التطبيق بنجاح ✅", "success");
      const s = await appLockService.getSettings();
      setSettings(s);
      refreshGlobal();
    } catch (e) {
      addToast("فشل تفعيل الأمان", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-black text-[#1E4D4D] flex items-center gap-2 border-b border-slate-50 pb-3">
        <Lock size={16} className="text-blue-500" /> قفل التطبيق والأمان
      </h3>
      
      {/* 4 Security Toggles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Toggle 1: Enable System Login (authenticationEnabled) */}
        <div className="flex items-center justify-between p-4 bg-indigo-50/30 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100/60 dark:border-indigo-900/40 hover:bg-indigo-50/50 transition-all duration-200">
          <div className="flex items-center gap-3">
            <Shield className="text-indigo-600 dark:text-indigo-400" size={18} />
            <div>
              <span className="text-[10px] font-black text-[#1E4D4D] dark:text-indigo-300 block">تفعيل شاشة تسجيل الدخول الإلزامية</span>
              <span className="text-[8px] text-slate-500 dark:text-slate-400 font-bold block">يتطلب التحقق من اسم المستخدم وكلمة المرور عبر الخادم بدلاً من الدخول كمسؤول تلقائي</span>
            </div>
          </div>
          <input
            type="checkbox"
            className="w-5 h-5 accent-indigo-600 cursor-pointer rounded-md"
            checked={authenticationEnabled}
            onChange={async (e) => {
              const checked = e.target.checked;
              if (checked) {
                try {
                  setLoading(true);
                  // 1. CONTEXT CHECK: check if standard server registry or browser's local users database is empty
                  const statusRes = await axios.get('/api/auth/bootstrap-status');
                  let localEmpty = true;
                  try {
                    const localCount = await db.branchUsers.count();
                    localEmpty = localCount === 0;
                  } catch (e) {
                    console.warn("Could not check local users db count:", e);
                  }

                  if (statusRes.data.requiresBootstrap || localEmpty) {
                    // Halt transition and open First Administrator Registration Wizard
                    setIsBootstrapModalOpen(true);
                    setLoading(false);
                    return;
                  }
                  
                  await setAuthenticationEnabled(true);
                  addToast("تم تفعيل تسجيل الدخول الإلزامي 🔒", "success");
                } catch (err: any) {
                  addToast("فشل التحقق من حالة نظام الأمان التلقائي ⚠️", "error");
                } finally {
                  setLoading(false);
                }
              } else {
                try {
                  await setAuthenticationEnabled(false);
                  addToast("تم تعطيل شاشة الدخول وتفعيل وضع المسؤول المحلي التلقائي 🔓", "success");
                } catch (err: any) {
                  addToast("فشل تعطيل خيار تسجيل الدخول الإلزامي", "error");
                }
              }
            }}
          />
        </div>

        {/* Toggle 2: Lock Application On Startup (lockOnStartup) */}
        <div className="flex items-center justify-between p-4 bg-emerald-50/30 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100/60 dark:border-emerald-900/40 hover:bg-emerald-50/50 transition-all duration-200">
          <div className="flex items-center gap-3">
            <Lock className="text-emerald-700 dark:text-emerald-400" size={18} />
            <div>
              <span className="text-[10px] font-black text-[#1E4D4D] dark:text-emerald-300 block">قفل التطبيق عند بدء التشغيل</span>
              <span className="text-[8px] text-slate-500 dark:text-slate-400 font-bold block">إظهار شاشة القفل عند بدء فتح أو تحميل التطبيق لأول مرة</span>
            </div>
          </div>
          <input
            type="checkbox"
            className="w-5 h-5 accent-emerald-600 cursor-pointer rounded-md"
            checked={lockOnStartup}
            onChange={(e) => toggleLockOnStartup(e.target.checked)}
          />
        </div>

        {/* Toggle 3: Enable PIN/Biometric Lock (biometricEnabled) */}
        <div className="flex items-center justify-between p-4 bg-sky-50/30 dark:bg-sky-950/20 rounded-2xl border border-sky-100/60 dark:border-sky-900/40 hover:bg-sky-50/50 transition-all duration-200">
          <div className="flex items-center gap-3">
            <ScanLine className="text-sky-600 dark:text-sky-400" size={18} />
            <div>
              <span className="text-[10px] font-black text-[#1E4D4D] dark:text-sky-300 block">تفعيل قفل PIN / البصمة الحيوية</span>
              <span className="text-[8px] text-slate-500 dark:text-slate-400 font-bold block">السماح بتسجيل الدخول السريع باستخدام الرقم السري أو بصمة الإصبع والوجه</span>
            </div>
          </div>
          <input
            type="checkbox"
            className="w-5 h-5 accent-sky-600 cursor-pointer rounded-md"
            checked={biometricEnabled}
            onChange={(e) => toggleBiometric(e.target.checked)}
          />
        </div>

        {/* Toggle 4: Auto Lock After Inactivity (autoLockEnabled) */}
        <div className="flex items-center justify-between p-4 bg-amber-50/30 dark:bg-amber-950/20 rounded-2xl border border-amber-100/60 dark:border-amber-900/40 hover:bg-amber-50/50 transition-all duration-200">
          <div className="flex items-center gap-3">
            <Clock className="text-amber-600 dark:text-amber-400" size={18} />
            <div>
              <span className="text-[10px] font-black text-[#1E4D4D] dark:text-amber-300 block">القفل التلقائي عند الخمول</span>
              <span className="text-[8px] text-slate-500 dark:text-slate-400 font-bold block">تأمين وقفل شاشة التطبيق تلقائياً عند عدم رصد أي حركة لفترة معينة</span>
            </div>
          </div>
          <input
            type="checkbox"
            className="w-5 h-5 accent-amber-600 cursor-pointer rounded-md"
            checked={autoLockEnabled}
            onChange={(e) => toggleAutoLock(e.target.checked)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-[#1E4D4D]" size={18} />
          <span className="text-[10px] font-black text-[#1E4D4D]">تفعيل قفل التطبيق السريع</span>
        </div>
        <input
          type="checkbox"
          className="w-5 h-5 accent-[#1E4D4D] cursor-pointer"
          checked={appLockEnabled}
          onChange={(e) => toggleAppLock(e.target.checked)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
           <Input 
             label="تعيين PIN سريع" 
             type="password" 
             value={simplePin} 
             onChange={e => setSimplePin(e.target.value)} 
             icon={<KeyRound size={12}/>}
             placeholder="4 - 6 أرقام" 
           />
           <Button type="button" onClick={handleSaveSimplePin} variant="secondary" className="w-full text-[9px] h-10 !rounded-xl">حفظ الرمز السريع</Button>
        </div>
        <div className="p-4 bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/20 rounded-2xl flex gap-3">
           <Info size={16} className="text-blue-500 dark:text-blue-400 shrink-0" />
           <p className="text-[9px] font-bold text-blue-800 dark:text-blue-300 leading-relaxed">يتطلب هذا الرمز عند العودة للتطبيق لضمان عدم وصول المتطفلين لبياناتك.</p>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 space-y-4">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">الأمان المتقدم (مسؤول النظام)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
           <Input label="اسم المستخدم" value={form.username} onChange={e => setForm({...form, username: e.target.value})} icon={<Users size={12}/>} />
           <Input label="كلمة المرور" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} icon={<Lock size={12}/>} />
           <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">مهلة الخمول</label>
              <select 
                className="w-full h-[32px] bg-slate-50 border-2 border-transparent rounded-[12px] px-3 text-[9px] font-black text-[#1E4D4D] outline-none focus:bg-white focus:border-[#1E4D4D]"
                value={form.mode}
                onChange={e => setForm({...form, mode: e.target.value as any})}
              >
                <option value="instant">فوري</option>
                <option value="1m">دقيقة واحدة</option>
                <option value="5m">5 دقائق</option>
                <option value="10m">10 دقائق</option>
                <option value="30m">30 دقيقة</option>
                <option value="1h">ساعة واحدة</option>
              </select>
           </div>
        </div>
        <Button 
          variant="primary" 
          className="w-full h-12 shadow-md !rounded-xl" 
          onClick={handleEnable}
          isLoading={loading}
        >
          {settings?.is_enabled ? 'تحديث إعدادات الأمان المتقدم' : 'تفعيل الأمان المتقدم الآن'}
        </Button>
      </div>

      {/* First Administrator Registration Wizard Modal */}
      <AnimatePresence>
        {isBootstrapModalOpen && (
          <Modal 
            isOpen={isBootstrapModalOpen} 
            onClose={() => setIsBootstrapModalOpen(false)}
            title="معالج تهيئة المدير الأول لبرنامج PharmaFlow"
          >
            <div className="space-y-4 p-2 text-[#1E4D4D]" dir="rtl">
              <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/30 flex gap-3 text-amber-900 dark:text-amber-300">
                <Shield size={24} className="shrink-0 text-amber-600" />
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-amber-950 dark:text-white">تأسيس مدير النظام الجديد (First Admin Configuration Wizard)</h4>
                  <p className="text-[10px] font-bold leading-relaxed">
                    لم نجد أي مستخدمين مسجلين في قاعدة البيانات. لتفعيل شاشة تسجيل الدخول الإلزامية وتأمين النظام، يرجى تأسيس حساب المدير العام (ADMIN) الأول الآن.
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Input 
                  label="اسم مستخدم المدير الأول" 
                  value={bootstrapUsername} 
                  onChange={(e: any) => setBootstrapUsername(e.target.value)} 
                  placeholder="مثال: admin" 
                  icon={<User size={12}/>} 
                  required
                />
                
                <Input 
                  label="كلمة المرور" 
                  type="password" 
                  value={bootstrapPassword} 
                  onChange={(e: any) => setBootstrapPassword(e.target.value)} 
                  placeholder="6 رموز على الأقل" 
                  icon={<Lock size={12}/>} 
                  required
                />

                <Input 
                  label="تأكيد كلمة المرور" 
                  type="password" 
                  value={bootstrapConfirmPassword} 
                  onChange={(e: any) => setBootstrapConfirmPassword(e.target.value)} 
                  placeholder="أعد إدخال كلمة المرور" 
                  icon={<Lock size={12}/>} 
                  required
                />
              </div>

              <div className="flex gap-2 pt-4 justify-end border-t border-slate-100">
                <Button 
                  variant="secondary" 
                  onClick={() => setIsBootstrapModalOpen(false)}
                  disabled={isBootstrapping}
                  className="text-[9px] h-10 px-4 !rounded-xl"
                >
                  إلغاء التفعيل
                </Button>
                <Button 
                  variant="primary" 
                  onClick={handleBootstrapSubmit}
                  isLoading={isBootstrapping}
                  className="text-[9px] h-10 px-6 font-black !rounded-xl shadow-md"
                >
                  حفظ الحساب وتفعيل الأمان 🛡️
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SettingsModule;
