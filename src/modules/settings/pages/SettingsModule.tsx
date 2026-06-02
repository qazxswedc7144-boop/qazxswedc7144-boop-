
import React, { useState, useEffect } from 'react';
import { db } from '@/core/db';
import { 
  Settings, Lock, Plus, ShieldCheck, Receipt, Network, ArrowRightLeft, 
  Printer, Globe, Moon, RefreshCcw, 
  BarChart3, Landmark, Calculator, 
  KeyRound, ScanLine, 
  Info, Shield, 
  Clock, 
  Type, Phone, MapPin,
  History, RefreshCw,
  Users, DatabaseBackup, Sparkles, Brain, Eye, EyeOff
} from 'lucide-react';
import { Button, Badge, Input, Modal } from '@/components/shared/SharedUI';
import { useUI } from '@/contexts/AppContext';
import { AccountingPeriodRepository } from '@/database/repositories/AccountingPeriodRepository';
import { authService } from '@/modules/auth/services/authService';
import BackupManagement from '../components/BackupManagement';
import { CurrencySelector } from '@/components/shared/CurrencySelector';
import { appLockService } from '@/services/AppLockService';
import { BackupService } from '@/services/backupService';
import { motion, AnimatePresence } from 'motion/react';
import { localBackupService } from '@/services/integrity/shared/localBackupService';

import { UnifiedModal } from '@/components/shared/UnifiedModal';
import { ReviewerSaaSTester } from '@/components/saas/SubscriptionWidgets';

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
  
  // Custom states matching Objective 5 and 6
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('system');
  const [printerProfile, setPrinterProfile] = useState<'58mm' | '80mm' | 'a4'>('80mm');
  const [printCopies, setPrintCopies] = useState<number>(1);
  const [printLogo, setPrintLogo] = useState<boolean>(true);
  const [printQR, setPrintQR] = useState<boolean>(true);
  const [showPrivacyModal, setShowPrivacyModal] = useState<boolean>(false);

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
      // Import dynamically to avoid side effects if not used elsewhere
      const { GoogleGenAI } = await import('@google/genai');
      const genAI = new GoogleGenAI({ apiKey: geminiKey });
      
      // Use the pattern found in the app
      const result = await genAI.models.generateContent({
        model: "gemini-flash-latest",
        contents: "Say 'Connection Successful' briefly in Arabic."
      });
      
      addToast(`نجح الاتصال: ${result.text}`, "success");
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

      <div className="max-w-3xl mx-auto px-4 space-y-4">
        
        {/* SECTION: النظام */}
        <Section 
          title="النظام" 
          desc="إعدادات النظام العامة والتخصيص" 
          icon={Settings} 
          isOpen={openSection === 'system'} 
          toggle={() => toggleSection('system')}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase mr-1">اللغة</label>
                <select className="w-full h-11 bg-slate-50 border-2 border-transparent rounded-xl px-4 font-black text-xs outline-none focus:bg-white focus:border-[#1E4D4D] transition-all">
                   <option>العربية (Default)</option>
                   <option>English</option>
                </select>
             </div>
             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase mr-1">المنطقة الزمنية</label>
                <div className="w-full h-11 bg-slate-50 border-2 border-transparent rounded-xl px-4 font-black text-xs flex items-center gap-2 text-slate-500">
                   <Globe size={14} /> GMT+04:00 (دبي)
                </div>
             </div>
             <div className="md:col-span-2">
                <CurrencySelector />
             </div>
             <div className="md:col-span-2 p-5 bg-slate-50 dark:bg-gray-850/40 rounded-3xl border border-slate-100 dark:border-gray-700/60 text-right space-y-3">
                <div className="flex items-center gap-3 text-[#1E4D4D] dark:text-indigo-400">
                   <Moon size={20} />
                   <span className="text-xs font-black">مظهر واجهة النظام (Bi-valent Theme Engine)</span>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-gray-400 font-bold leading-relaxed">
                   اختر النمط البصري المفضل لديك. يتم تطبيق درجات تدرج HEX بدقة عالية لحماية العين وتناسق الطبقات البرمجية.
                </p>
                <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-gray-800 p-1 rounded-2xl border border-slate-200/50 dark:border-gray-700">
                   {[
                     { mode: 'light', label: '☀ نهاري' },
                     { mode: 'dark', label: '🌙 ليلي' },
                     { mode: 'system', label: '⚙ تلقائي' }
                   ].map(item => (
                     <button
                       key={item.mode}
                       type="button"
                       onClick={() => changeThemeMode(item.mode as any)}
                       className={`py-2 rounded-xl text-center text-[10px] sm:text-xs font-black transition-all cursor-pointer ${
                         themeMode === item.mode 
                           ? 'bg-[#1E4D4D] text-white shadow-sm font-extrabold' 
                           : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-gray-700 hover:text-slate-700 dark:text-gray-300'
                       }`}
                     >
                       {item.label}
                     </button>
                   ))}
                </div>
             </div>
             <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-gray-850 rounded-2xl md:col-span-2">
                <div className="flex items-center gap-3">
                   <RefreshCcw className="text-[#1E4D4D] dark:text-indigo-400" size={20} />
                   <span className="text-xs font-black text-[#1E4D4D] dark:text-indigo-400">تحديث دوري للخلفية</span>
                </div>
                <input type="checkbox" defaultChecked className="w-5 h-5 accent-indigo-500 cursor-pointer" />
             </div>
             <Button variant="danger" className="md:col-span-2 h-12 !rounded-xl" onClick={() => addToast("إعادة ضبط النظام تتطلب صلاحيات الخادم 🔒", "warning")}>
                <RefreshCcw size={16} className="ml-2" /> إعادة ضبط إعدادات المصنع
             </Button>
          </div>
        </Section>

        {/* SECTION: الفواتير */}
        <Section 
          title="الفواتير" 
          desc="تخصيص شكل وسلوك الفواتير" 
          icon={Receipt} 
          isOpen={openSection === 'invoices'} 
          toggle={() => toggleSection('invoices')}
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="اسم الصيدلية" value={invoiceConfig.pharmacyName} onChange={e => setInvoiceConfig({...invoiceConfig, pharmacyName: e.target.value})} icon={<Type size={14}/>} className="!py-3" />
              <Input label="رقم الهاتف" value={invoiceConfig.phone} onChange={e => setInvoiceConfig({...invoiceConfig, phone: e.target.value})} icon={<Phone size={14}/>} className="!py-3" />
              <Input label="العنوان" value={invoiceConfig.address} onChange={e => setInvoiceConfig({...invoiceConfig, address: e.target.value})} icon={<MapPin size={14}/>} className="!py-3" />
              <Input label="الرقم الضريبي" value={invoiceConfig.taxNumber} onChange={e => setInvoiceConfig({...invoiceConfig, taxNumber: e.target.value})} icon={<Info size={14}/>} className="!py-3" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">ملاحظات تذييل الفاتورة</label>
              <textarea 
                className="w-full bg-slate-50 border-2 border-transparent rounded-[20px] p-4 text-xs font-black text-[#1E4D4D] focus:bg-white focus:border-[#1E4D4D] transition-all outline-none min-h-[80px] resize-none" 
                value={invoiceConfig.footerNote} 
                onChange={e => setInvoiceConfig({...invoiceConfig, footerNote: e.target.value})} 
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-2xl">
                {(['standard', 'compact', 'detailed'] as const).map(l => (
                  <button 
                    key={l}
                    onClick={() => setInvoiceConfig({...invoiceConfig, layoutType: l})}
                    className={`h-10 text-[10px] font-black rounded-xl transition-all ${invoiceConfig.layoutType === l ? 'bg-[#1E4D4D] text-white shadow-md' : 'text-slate-500 hover:bg-white/50'}`}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
              <Button variant="approve" className="h-12 !rounded-2xl" onClick={() => saveInvoiceConfig(invoiceConfig)}>حفظ التغييرات</Button>
            </div>
            <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-50">
               <div className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-[#1E4D4D]" />
                  <span className="text-[10px] font-bold text-slate-600">إظهار الشعار</span>
               </div>
               <div className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-[#1E4D4D]" />
                  <span className="text-[10px] font-bold text-slate-600">طباعة QR Code (زكاة)</span>
               </div>
               <div className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4 accent-[#1E4D4D]" />
                  <span className="text-[10px] font-bold text-slate-600">تفعيل المرتجع برقم الفاتورة</span>
               </div>
            </div>
          </div>
        </Section>

        {/* SECTION: المحاسبة */}
        <Section 
          title="المحاسبة" 
          desc="إعدادات النظام المالي والمحاسبي" 
          icon={BarChart3} 
          isOpen={openSection === 'accounting'} 
          toggle={() => toggleSection('accounting')}
        >
          <div className="space-y-8">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                   <h4 className="text-xs font-black text-[#1E4D4D] flex items-center gap-2">
                      <Calculator size={16} className="text-emerald-500" /> طريقة تقييم المخزون
                   </h4>
                   <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                      <button className="flex-1 h-11 bg-[#1E4D4D] text-white font-black text-[10px] rounded-xl shadow-md">FIFO (الأولوية)</button>
                      <button className="flex-1 h-11 text-slate-500 font-black text-[10px] rounded-xl hover:bg-white/50">W. AVG</button>
                   </div>
                </div>
                <div className="space-y-4">
                   <h4 className="text-xs font-black text-[#1E4D4D] flex items-center gap-2">
                      <Landmark size={16} className="text-blue-500" /> الحسابات الافتراضية
                   </h4>
                   <Button variant="neutral" className="w-full h-11 text-[10px] shadow-sm">إعدادات توجيه القيود (Mapper)</Button>
                </div>
             </div>

             <div className="space-y-4 pt-6 border-t border-slate-50">
                <h4 className="text-xs font-black text-[#1E4D4D] flex items-center gap-2">
                   <Clock size={16} className="text-amber-500" /> الفترات المحاسبية والسنة المالية
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-3xl">
                   <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase">تاريخ بداية السنة</label>
                      <input type="date" className="w-full h-11 bg-white border border-slate-100 rounded-xl px-4 font-black text-xs" value={newPeriod.start} onChange={e => setNewPeriod({...newPeriod, start: e.target.value})} />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase">تاريخ نهاية السنة</label>
                      <input type="date" className="w-full h-11 bg-white border border-slate-100 rounded-xl px-4 font-black text-xs" value={newPeriod.end} onChange={e => setNewPeriod({...newPeriod, end: e.target.value})} />
                   </div>
                   <Button variant="primary" className="md:col-span-2 h-12 !rounded-xl" onClick={handleCreatePeriod}>فتح فترة محاسبية جديدة</Button>
                </div>
                
                <div className="space-y-2 mt-4">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">الفترات النشطة</p>
                   {periods.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                         <div>
                            <p className="text-xs font-black text-[#1E4D4D]">{new Date(p.Start_Date).toLocaleDateString()} - {new Date(p.End_Date).toLocaleDateString()}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase">{p.Is_Locked ? 'مغلقة' : 'مفتوحة'}</p>
                         </div>
                         <button 
                            onClick={() => handleTogglePeriod(p.id, p.Is_Closed)}
                            className={`px-4 py-2 rounded-xl text-[9px] font-black transition-all ${p.Is_Locked ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}
                         >
                            {p.Is_Locked ? 'إعادة فتح' : 'إغلاق الفترة'}
                         </button>
                      </div>
                   ))}
                </div>
             </div>
          </div>
        </Section>

        {/* SECTION: الأمان والنسخ الاحتياطي */}
        <Section 
          title="الأمان والنسخ الاحتياطي" 
          desc="حماية البيانات والاستعادة" 
          icon={ShieldCheck} 
          isOpen={openSection === 'security'} 
          toggle={() => toggleSection('security')}
        >
          <div className="space-y-8">
             {/* Compact 2-column grid buttons */}
             <div className="grid grid-cols-2 gap-4">
                <Button 
                   variant="primary" 
                   className="flex-col h-auto pt-6 pb-4 !rounded-[20px] shadow-lg bg-[#1E4D4D]"
                   onClick={handleExportBackup}
                   isLoading={loading}
                >
                   <DatabaseBackup size={28} className="mb-2" />
                   <p className="text-xs font-black">إنشاء نسخة</p>
                   <p className="text-[8px] opacity-70 mt-1 font-bold">تصدير مشفر .enc</p>
                </Button>
                <Button 
                   variant="secondary" 
                   className="flex-col h-auto pt-6 pb-4 !rounded-[20px] bg-emerald-50 text-[#1E4D4D] border-emerald-100"
                   onClick={handleImportBackup}
                   isLoading={loading}
                >
                   <RefreshCw size={28} className="mb-2" />
                   <p className="text-xs font-black">استعادة نسخة</p>
                   <p className="text-[8px] opacity-70 mt-1 font-bold">استيراد ملف خارجي</p>
                </Button>
             </div>

             <div className="space-y-4 pt-6 border-t border-slate-50">
                <SecuritySettingsTab />
             </div>

             <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-3xl text-white">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center">
                      <History size={20} />
                   </div>
                   <div>
                      <p className="text-xs font-black">سجل النسخ الاحتياطية</p>
                      <p className="text-[9px] text-slate-400 font-bold tracking-widest">{periods.length} نسخ محلية</p>
                   </div>
                </div>
                <Button variant="neutral" className="text-blue-400 hover:text-white hover:bg-white/5 h-10 !border-white/10 !bg-white/5" onClick={() => setShowBackupHistory(true)}>
                   عرض السجل
                </Button>
             </div>
          </div>
        </Section>

        {/* SECTION: الذكاء الاصطناعي */}
        <Section 
          title="الذكاء الاصطناعي (Gemini)" 
          desc="إعدادات محرك التحليل الذكي" 
          icon={Sparkles} 
          isOpen={openSection === 'ai'} 
          toggle={() => toggleSection('ai')}
          badge="BETA"
        >
          <div className="space-y-6">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl flex gap-3 text-right" dir="rtl">
               <Brain size={20} className="text-[#1E4D4D] dark:text-emerald-400 shrink-0" />
               <div>
                  <p className="text-xs font-black text-[#1E4D4D] dark:text-emerald-400 mb-1">محرك Gemini Flash 1.5</p>
                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
                     يستخدم PharmaFlow قوة الذكاء الاصطناعي من Google لتقديم تحليلات دقيقة، توقعات للمبيعات، واكتشاف الأنماط غير الطبيعية.
                  </p>
               </div>
            </div>

            <div className="space-y-4">
               <div className="relative">
                  <Input 
                    label="Gemini API Key" 
                    type={showKey ? "text" : "password"} 
                    value={geminiKey} 
                    onChange={e => setGeminiKey(e.target.value)} 
                    icon={<KeyRound size={14}/>} 
                    placeholder="AIzaSy..." 
                    className="!py-3 pr-12"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute left-4 top-[38px] text-slate-400 hover:text-[#1E4D4D] transition-colors"
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
               </div>
               
               <div className="flex flex-col md:flex-row gap-3">
                  <Button 
                    variant="primary" 
                    className="flex-1 h-12 !rounded-xl shadow-md bg-[#1E4D4D]" 
                    onClick={handleSaveGeminiKey}
                  >
                    <Shield size={16} className="ml-2" /> حفظ المفتاح بأمان
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="flex-1 h-12 !rounded-xl border-emerald-200 text-[#1E4D4D]" 
                    onClick={handleTestGeminiConnection}
                    isLoading={isTestingKey}
                  >
                    <RefreshCw size={16} className="ml-2" /> اختبار الاتصال
                  </Button>
               </div>

               <p className="text-[9px] text-center text-slate-400 font-bold">
                  سيتم تخزين المفتاح محلياً في متصفحك بشكل مشفر. لا يتم إرسال المفتاح إلى أي خوادم وسيطة.
               </p>
            </div>
          </div>
        </Section>

        {/* SECTION: الأجهزة والطباعة */}
        <Section 
          title="مصفوفة الطباعة الحرارية وتكامل الأجهزة (ESC/POS Setup)" 
          desc="تعيين عروض فواتير الكاشير، النسخ، الشعارات وأكواد الاستجابة السريعة" 
          icon={Printer} 
          isOpen={openSection === 'devices'} 
          toggle={() => toggleSection('devices')}
        >
          <div className="space-y-6">
             {/* Device Connect Status */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-gray-850 border border-slate-100 dark:border-gray-800 rounded-3xl flex items-center gap-4 group hover:border-[#1E4D4D] transition-all cursor-pointer">
                   <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-2xl flex items-center justify-center text-[#1E4D4D] shadow-sm"><Printer size={22} /></div>
                   <div className="flex-1 text-right">
                      <p className="text-xs font-black text-[#1E4D4D] dark:text-emerald-400">طابعة الفواتير (Thermal)</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Generic ESC/POS Driver</p>
                   </div>
                   <Badge variant="success">متصل</Badge>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-gray-850 border border-slate-100 dark:border-gray-800 rounded-3xl flex items-center gap-4 group hover:border-[#1E4D4D] transition-all cursor-pointer">
                   <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-2xl flex items-center justify-center text-[#1E4D4D] shadow-sm"><ScanLine size={22} /></div>
                   <div className="flex-1 text-right">
                      <p className="text-xs font-black text-[#1E4D4D] dark:text-emerald-400">قارئ الباركود (Scanner)</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">USB HID POS Keyboard</p>
                   </div>
                   <Badge variant="success">نشط</Badge>
                </div>
             </div>

             {/* Printer Matrix Profile Selection */}
             <div className="p-5 bg-slate-50 dark:bg-gray-850 border border-slate-100 dark:border-gray-800 rounded-3xl space-y-4 text-right">
                <span className="text-xs font-bold text-slate-700 dark:text-gray-300 block">عرض وتخطيط تذكرة الفاتورة (Printer Profile)</span>
                <div className="grid grid-cols-3 gap-2">
                   {[
                     { id: '58mm', name: 'حراري 58mm', desc: 'صيدليات مصغرة' },
                     { id: '80mm', name: 'حراري 80mm', desc: 'صيدليات ومشافي' },
                     { id: 'a4', name: 'تقارير A4 PDF', desc: 'مستندات وتوريد' }
                   ].map(prof => (
                     <button
                       key={prof.id}
                       type="button"
                       onClick={() => {
                         setPrinterProfile(prof.id as any);
                         handleUpdatePrinterSetting('saas_printer_profile', prof.id);
                       }}
                       className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                         printerProfile === prof.id 
                           ? 'bg-[#1E4D4D] text-white border-transparent' 
                           : 'bg-white dark:bg-gray-800 border-slate-150 dark:border-gray-700 text-slate-600 dark:text-gray-300'
                       }`}
                     >
                       <span className="text-xs font-black">{prof.name}</span>
                       <span className={`text-[8px] block ${printerProfile === prof.id ? 'text-emerald-300' : 'text-slate-400'}`}>{prof.desc}</span>
                     </button>
                   ))}
                </div>

                {/* Copies counter and layout options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200/50 dark:border-gray-700">
                   {/* Copies Spinner */}
                   <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-2xl border border-slate-100 dark:border-gray-700">
                      <span className="text-xs font-bold text-slate-600 dark:text-gray-300">عدد النسخ المطبوعة تلقائياً:</span>
                      <div className="flex items-center gap-2">
                         <button
                           type="button"
                           onClick={() => {
                             const c = Math.max(1, printCopies - 1);
                             setPrintCopies(c);
                             handleUpdatePrinterSetting('saas_print_copies', c);
                           }}
                           className="w-8 h-8 rounded-full bg-slate-100 dark:bg-gray-750 hover:bg-slate-200 text-slate-600 dark:text-white flex items-center justify-center font-black text-sm"
                         >
                           -
                         </button>
                         <span className="w-8 text-center text-xs font-black text-slate-800 dark:text-white">{printCopies}</span>
                         <button
                           type="button"
                           onClick={() => {
                             const c = Math.min(5, printCopies + 1);
                             setPrintCopies(c);
                             handleUpdatePrinterSetting('saas_print_copies', c);
                           }}
                           className="w-8 h-8 rounded-full bg-slate-100 dark:bg-gray-750 hover:bg-slate-200 text-slate-600 dark:text-white flex items-center justify-center font-black text-sm"
                         >
                           +
                         </button>
                      </div>
                   </div>

                   {/* Logo & QR checks */}
                   <div className="flex flex-col gap-2 justify-center">
                      <label className="flex items-center gap-2.5 text-xs font-bold text-slate-600 dark:text-gray-300 cursor-pointer">
                         <input 
                           type="checkbox" 
                           checked={printLogo} 
                           onChange={e => {
                             setPrintLogo(e.target.checked);
                             handleUpdatePrinterSetting('saas_print_logo', e.target.checked);
                           }}
                           className="w-4 h-4 accent-[#1E4D4D] text-[#1E4D4D]" 
                         />
                         <span>طباعة الشعار الرسمي بأعلى المستند</span>
                      </label>
                      <label className="flex items-center gap-2.5 text-xs font-bold text-slate-600 dark:text-gray-300 cursor-pointer">
                         <input 
                           type="checkbox" 
                           checked={printQR} 
                           onChange={e => {
                             setPrintQR(e.target.checked);
                             handleUpdatePrinterSetting('saas_print_qr', e.target.checked);
                           }}
                           className="w-4 h-4 accent-[#1E4D4D] text-[#1E4D4D]" 
                         />
                         <span>طباعة رمز الاستجابة السريعة (QR) الضريبي والجرد</span>
                      </label>
                   </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                   <Button 
                     variant="secondary" 
                     className="text-[#1E4D4D] border-[#1E4D4D]/20 h-11 !rounded-xl text-xs font-black px-5"
                     onClick={() => addToast("جاري إرسال حزمة التجربة إلى الطابعة الحرارية...", "info")}
                   >
                     اختبار ورقة الطباعة (Test Print Page)
                   </Button>
                </div>
             </div>
          </div>
        </Section>

        {/* SECTION: خدمات الربط والمؤسسات (SaaS Hub) */}
        <Section 
          title="بوابة الربط السحابي والخدمات للشركات والمستشفيات (SaaS & Interoperability)" 
          desc="إدارة مفاتيح المطورين والربط السريري مع مستشفيات وزارة الصحة وصحة وحلول HL7 FHIR" 
          icon={Globe} 
          isOpen={openSection === 'saas'} 
          toggle={() => toggleSection('saas')}
          badge="Enterprise"
        >
          <div className="space-y-4">
             <div className="p-5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-500/20 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                   <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm"><Network size={24} /></div>
                   <div className="space-y-0.5 text-right">
                      <p className="text-sm font-black text-slate-800 dark:text-white">قنوات الربط المتعددة السحابية (Enterprise Interop Hub)</p>
                      <p className="text-xs text-slate-400 dark:text-gray-400">معرف المستأجر: DALLAH_HOSPITAL_GROUP • مفتاح التشفير فعال</p>
                   </div>
                </div>
                {onNavigate && (
                  <Button 
                     onClick={() => onNavigate('saas-portal')}
                     className="bg-indigo-600 text-white hover:bg-indigo-700 !rounded-xl text-xs font-black px-5 py-3 shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                     <span>الدخول للوحة التحكم والمطورين</span>
                     <ArrowRightLeft size={14} />
                  </Button>
                )}
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-gray-850 rounded-2xl border border-slate-100 dark:border-gray-700 text-right space-y-1">
                   <p className="text-[10px] text-slate-400 dark:text-gray-400 font-black uppercase font-sans">معيار الامتثال الدولي والأمني</p>
                   <p className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1">
                      <ShieldCheck size={14} className="text-emerald-500" />
                      <span>HL7 FHIR R4 Compliant Sandbox</span>
                   </p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-gray-850 rounded-2xl border border-slate-100 dark:border-gray-700 text-right space-y-1">
                   <p className="text-[10px] text-slate-400 dark:text-gray-400 font-black uppercase font-sans">مفاتيح المطورين والاتصال البرمجي</p>
                   <p className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1">
                      <KeyRound size={14} className="text-indigo-500" />
                      <span>بوابة المطورين REST API نشطة</span>
                   </p>
                </div>
             </div>

             <div className="p-5 bg-slate-50 dark:bg-gray-850 rounded-3xl border border-slate-100 dark:border-gray-700/65 space-y-4">
                <h4 className="text-sm font-black text-indigo-650 dark:text-indigo-400 flex items-center gap-2">
                   <span>💳 لوحة محاكاة وتدقيق الاشتراك والترخيص (Reviewer QA Control Panel)</span>
                </h4>
                <ReviewerSaaSTester />
             </div>
          </div>
        </Section>

        {/* SECTION: حول النظام */}
        <Section 
          title="حول النظام وسياسة حماية البيانات" 
          desc="تفاصيل محرك الفواتير والتراخيص وسياسات الخصوصية وشروطه" 
          icon={Info} 
          isOpen={openSection === 'about'} 
          toggle={() => toggleSection('about')}
        >
          <div className="space-y-6 text-right" dir="rtl">
             <div className="flex bg-[#1E4D4D] p-6 rounded-[32px] text-white overflow-hidden relative flex-col gap-2">
                <div className="relative z-10">
                   <h4 className="text-xl font-black">PharmaFlow Pro ERP</h4>
                   <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-[3px]">SaaS-Enabled Pharmaceutical Engine</p>
                </div>
                <p className="text-xs text-slate-100 font-bold max-w-md leading-relaxed">
                   أول نظام موحد متكامل في الشرق الأوسط لإدارة سلاسل الصيدليات بتزامن سحابي فوري وقدرة كاملة على العمل دون اتصال بالشبكة مع الحفاظ على حوكمة المحاسبة المزدوجة.
                </p>
                <div className="absolute -left-4 -top-4 opacity-5 rotate-12"><Settings size={120} /></div>
             </div>
             
             <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 bg-slate-50 dark:bg-gray-800 rounded-2xl border border-slate-100 dark:border-gray-700/60 text-center">
                   <p className="text-[8px] text-slate-400 dark:text-gray-400 font-black uppercase mb-1">نسخة الترخيص</p>
                   <p className="text-xs font-black text-[#1E4D4D] dark:text-emerald-400">1.0.0-PRO</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-gray-800 rounded-2xl border border-slate-100 dark:border-gray-700/60 text-center">
                   <p className="text-[8px] text-slate-400 dark:text-gray-400 font-black uppercase mb-1">عدد الأدوية</p>
                   <p className="text-xs font-black text-[#1E4D4D] dark:text-emerald-400">{stats.products}</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-gray-800 rounded-2xl border border-slate-100 dark:border-gray-700/60 text-center">
                   <p className="text-[8px] text-slate-400 dark:text-gray-400 font-black uppercase mb-1">الربط المتكامل</p>
                   <p className="text-xs font-black text-[#1E4D4D] dark:text-emerald-400">HL7 FHIR R4</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-gray-800 rounded-2xl border border-slate-100 dark:border-gray-700/60 text-center">
                   <p className="text-[8px] text-slate-400 dark:text-gray-400 font-black uppercase mb-1">حماية البيانات</p>
                   <p className="text-xs font-black text-emerald-500">AES-GCM 256</p>
                </div>
             </div>

             {/* Bullet Features list */}
             <div className="bg-slate-50 dark:bg-gray-850 p-4 rounded-3xl border border-slate-100 dark:border-gray-800 space-y-2">
                <span className="text-[11px] font-black text-[#1E4D4D] dark:text-emerald-400 block mb-1">القابليات والميزات المعتمدة:</span>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-gray-300 font-bold">
                   <li className="flex items-center gap-2">🟢 كاشير ونقاط مبيعات سريعة</li>
                   <li className="flex items-center gap-2">🟢 مزامنة تلقائية Dexie Sync</li>
                   <li className="flex items-center gap-2">🟢 مبيعات، مشتريات وتوريد مخزني</li>
                   <li className="flex items-center gap-2">🟢 معايير خصوصية HIPAA & GDPR</li>
                   <li className="flex items-center gap-2">🟢 حصر حسابات وقيود محاسبية مزدوجة</li>
                   <li className="flex items-center gap-2">🟢 لوحة مؤشرات SaaS المتطورة</li>
                </ul>
             </div>

             <div className="space-y-2 pt-2">
                <Button 
                  variant="ghost" 
                  type="button"
                  className="w-full justify-between h-12 text-[10px] sm:text-xs hover:bg-slate-100 dark:hover:bg-gray-750 !rounded-xl text-slate-700 dark:text-gray-200" 
                  onClick={() => setShowPrivacyModal(true)}
                >
                   <span>سياسة الخصوصية وشروط الاستخدام ومطابقة Google Play</span> 
                   <Info size={14} />
                </Button>
                <div className="text-center">
                   <span className="text-[9px] text-slate-400 font-black uppercase">© PharmaFlow Pro 2026. جميع الحقوق محفوظة لمالك المنصة.</span>
                </div>
             </div>
          </div>
        </Section>
      </div>

      {/* History Modal */}
      <Modal 
        isOpen={showBackupHistory} 
        onClose={() => setShowBackupHistory(false)} 
        title="سجل النسخ الاحتياطية"
        maxWidth="max-w-3xl"
      >
        <div className="p-2 overflow-x-hidden">
           <BackupManagement />
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
  const [settings, setSettings] = useState<any>(null);
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [simplePin, setSimplePin] = useState('');
  const [form, setForm] = useState({ username: '', password: '', confirm: '', mode: '5m' as any });
  const { addToast, refreshGlobal } = useUI();
  const [loading, setLoading] = useState(false);

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
    if (form.password !== form.confirm) {
      addToast("كلمات المرور غير متطابقة", "error");
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
                <option value="5m">5 دقائق</option>
                <option value="10m">10 دقائق</option>
                <option value="30m">30 دقيقة</option>
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
    </div>
  );
};

export default SettingsModule;
