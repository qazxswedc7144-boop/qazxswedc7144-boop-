
import React, { useState, useEffect } from 'react';
import { db } from '@/core/db';
import { 
  Settings, Lock, Plus, ShieldCheck, Receipt, Network, ArrowRightLeft, 
  Printer, Globe, Moon, RefreshCcw, 
  BarChart3, Landmark, Calculator, 
  KeyRound, ScanLine, 
  BadgeInfo, Info, Shield, 
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
  const [darkMode, setDarkMode] = useState(false);
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

  useEffect(() => {
    const load = async () => {
      try {
        const savedConfig = await db.getSetting('invoice_config', null);
        if (savedConfig) setInvoiceConfig(savedConfig);

        const savedTheme = await db.getSetting('THEME_DARK', false);
        setDarkMode(savedTheme);

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

  // Dark mode side effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    db.saveSetting('THEME_DARK', darkMode);
  }, [darkMode]);

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
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-xl bg-gray-50 dark:bg-gray-700/60 text-lg leading-none transition-all duration-200 active:scale-90 border border-gray-100 dark:border-gray-600/40"
            title="تبديل المظهر"
          >
            {darkMode ? "☀️" : "🌙"}
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
             <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div className="flex items-center gap-3">
                   <Moon className="text-[#1E4D4D] dark:text-indigo-400" size={20} />
                   <span className="text-xs font-black text-[#1E4D4D] dark:text-indigo-400">الوضع الليلي</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={darkMode} 
                  onChange={e => setDarkMode(e.target.checked)} 
                  className="w-5 h-5 accent-indigo-500 cursor-pointer" 
                />
             </div>
             <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
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
          title="الأجهزة والطباعة" 
          desc="إدارة الأجهزة المتصلة" 
          icon={Printer} 
          isOpen={openSection === 'devices'} 
          toggle={() => toggleSection('devices')}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl flex items-center gap-4 group hover:border-[#1E4D4D] transition-all cursor-pointer">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#1E4D4D] shadow-sm group-hover:scale-110 transition-transform"><Printer size={24} /></div>
                <div className="flex-1">
                   <p className="text-xs font-black text-[#1E4D4D]">طابعة الفواتير (Thermal)</p>
                   <p className="text-[9px] text-slate-400 font-bold uppercase">Generic 80mm POS</p>
                </div>
                <Badge variant="success">متصل</Badge>
             </div>
             <div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl flex items-center gap-4 group hover:border-[#1E4D4D] transition-all cursor-pointer">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#1E4D4D] shadow-sm group-hover:scale-110 transition-transform"><ScanLine size={24} /></div>
                <div className="flex-1">
                   <p className="text-xs font-black text-[#1E4D4D]">قارئ الباركود</p>
                   <p className="text-[9px] text-slate-400 font-bold uppercase">Standard USB Scanner</p>
                </div>
                <Badge variant="success">نشط</Badge>
             </div>
             <Button variant="neutral" className="md:col-span-2 h-12 !rounded-xl text-[10px]">فحص الأجهزة وتحديث التعريفات</Button>
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
                   <p className="text-[10px] text-slate-400 dark:text-gray-400 font-black uppercase">معيار الامتثال الدولي والأمني</p>
                   <p className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1">
                      <ShieldCheck size={14} className="text-emerald-500" />
                      <span>HL7 FHIR R4 Compliant Sandbox</span>
                   </p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-gray-850 rounded-2xl border border-slate-100 dark:border-gray-700 text-right space-y-1">
                   <p className="text-[10px] text-slate-400 dark:text-gray-400 font-black uppercase">مفاتيح المطورين والاتصال البرمجي</p>
                   <p className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1">
                      <KeyRound size={14} className="text-indigo-500" />
                      <span>بوابة المطورين REST API نشطة</span>
                   </p>
                </div>
             </div>
          </div>
        </Section>

        {/* SECTION: حول النظام */}
        <Section 
          title="حول النظام" 
          desc="معلومات تقنية وتشخيصية" 
          icon={Info} 
          isOpen={openSection === 'about'} 
          toggle={() => toggleSection('about')}
        >
          <div className="space-y-6">
             <div className="flex items-center gap-4 bg-[#1E4D4D] p-6 rounded-[32px] text-white overflow-hidden relative">
                <div className="relative z-10">
                   <h4 className="text-lg font-black italic">PharmaFlow ERP</h4>
                   <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[4px]">Advanced Enterprise Solutions</p>
                </div>
                <div className="absolute -right-4 -top-4 opacity-5 rotate-12"><Settings size={120} /></div>
             </div>
             
             <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                   <p className="text-[8px] text-slate-400 font-black uppercase mb-1">إصدار النظام</p>
                   <p className="text-xs font-black text-[#1E4D4D]">2.4.10-PRO</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                   <p className="text-[8px] text-slate-400 font-black uppercase mb-1">عدد الأصناف</p>
                   <p className="text-xs font-black text-[#1E4D4D]">{stats.products}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                   <p className="text-[8px] text-slate-400 font-black uppercase mb-1">إجمالي السجلات</p>
                   <p className="text-xs font-black text-[#1E4D4D]">{stats.records}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                   <p className="text-[8px] text-slate-400 font-black uppercase mb-1">تخزين المتصفح</p>
                   <p className="text-xs font-black text-emerald-500">1.2 MB</p>
                </div>
             </div>

             <div className="space-y-2 pt-2">
                <Button variant="ghost" className="w-full justify-between h-12 text-[10px] hover:bg-slate-50 !rounded-xl" onClick={() => addToast("جاري تحميل وثيقة الخصوصية...", "info")}>
                   سياسة الخصوصية وشروط الاستخدام <Info size={14} />
                </Button>
                <Button variant="ghost" className="w-full justify-between h-12 text-[10px] hover:bg-slate-50 !rounded-xl" onClick={() => addToast("المطور: PharmaFlow Engineering Team", "info")}>
                   معلومات المطور <BadgeInfo size={14} />
                </Button>
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
