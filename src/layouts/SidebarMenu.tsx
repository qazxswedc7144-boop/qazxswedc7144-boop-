import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Database, Settings, CreditCard, 
  ChevronDown, ChevronUp,
  CloudUpload, Printer, LogOut,
  FileSpreadsheet, FileJson, Upload, Phone, LifeBuoy, Key, User, Moon
} from 'lucide-react';

interface SidebarMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const AccordionSection = ({ title, icon: Icon, children, defaultOpen = false }: any) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 dark:border-gray-700/50">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-3 text-[#1E4D4D] dark:text-emerald-400 font-bold">
          <Icon size={18} />
          <span className="text-sm font-cairo">{title}</span>
        </div>
        {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-gray-50/30 dark:bg-gray-900/30"
          >
            <div className="p-4 space-y-4 font-cairo">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const SidebarMenu: React.FC<SidebarMenuProps> = ({ isOpen, onClose }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />
          <motion.div 
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-[340px] max-w-[90vw] bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col font-cairo"
            dir="rtl"
          >
            <div className="p-4 border-b dark:border-gray-800 flex items-center justify-between bg-[#1E4D4D] text-white">
              <h2 className="font-bold text-lg">قائمة النظام</h2>
              <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors focus:outline-none"><X size={20} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {/* 1️⃣ Backup & Security */}
              <AccordionSection title="النسخ الاحتياطي والأمان" icon={Database}>
                <button className="w-full text-right text-sm text-[#1E4D4D] dark:text-emerald-100 bg-emerald-50 dark:bg-emerald-900/20 py-2.5 px-3 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-800/40 transition-colors flex items-center justify-center gap-2 border border-emerald-100 dark:border-emerald-800/50 focus:outline-none">
                  <Database size={16} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="font-bold text-emerald-800 dark:text-emerald-300">نسخ احتياطي فوري للبيانات</span>
                </button>
                
                <div className="space-y-1 mt-3">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400">استعادة نسخة احتياطية سابقة</label>
                  <label className="flex items-center justify-center gap-2 w-full text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 py-3 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <CloudUpload size={18} className="text-gray-400" />
                    <span>اختر ملف النسخة الاحتياطية</span>
                    <input type="file" className="hidden" accept=".json,.bak" />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100 dark:border-gray-700/50 mt-3">
                  <button className="flex items-center justify-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 py-2.5 px-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none">
                    <FileSpreadsheet size={14} className="text-green-600" /> تصدير الأصناف
                  </button>
                  <button className="flex items-center justify-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 py-2.5 px-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none">
                    <FileJson size={14} className="text-blue-500" /> تصدير العملاء
                  </button>
                </div>
              </AccordionSection>

              {/* 2️⃣ Pharmacy & Printing */}
              <AccordionSection title="بيانات الصيدلية والطباعة" icon={Printer}>
                <div className="space-y-3">
                  <input type="text" placeholder="اسم الصيدلية" className="w-full text-sm p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-[#10B981] outline-none transition-all" />
                  <input type="text" placeholder="العنوان" className="w-full text-sm p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-[#10B981] outline-none transition-all" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="tel" placeholder="رقم الهاتف" className="w-full text-sm p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-[#10B981] outline-none transition-all" />
                    <input type="text" placeholder="الرقم الضريبي" className="w-full text-sm p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-[#10B981] outline-none transition-all" />
                  </div>
                </div>

                <button className="w-full mt-3 flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none">
                  <Upload size={16} /> رفع شعار الصيدلية (Logo)
                </button>

                <div className="space-y-2 pt-3 border-t border-gray-100 dark:border-gray-700/50 mt-3">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400">قياس ورق الفاتورة الافتراضي</label>
                  <select className="w-full text-sm p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-[#10B981] outline-none transition-all cursor-pointer">
                    <option value="80mm">ورق حراري 80mm</option>
                    <option value="a4">ورق A4</option>
                    <option value="a5">ورق A5</option>
                  </select>
                  <input type="text" placeholder="تذييل الفاتورة (مثال: البضاعة المباعة لا ترد)" className="w-full text-sm p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-[#10B981] outline-none transition-all mt-2" />
                </div>
              </AccordionSection>

              {/* 3️⃣ Subscription */}
              <AccordionSection title="الحسابات والاشتراك" icon={CreditCard}>
                <div className="bg-gradient-to-br from-[#1E4D4D] to-[#2A6B6B] p-4 rounded-xl text-white shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-full bg-white/5 opacity-50 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '16px 16px' }} />
                  <div className="relative z-10 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-emerald-200 text-xs font-bold">نوع الباقة</span>
                      <span className="font-bold text-xs bg-white/20 px-2 py-0.5 rounded text-white border border-white/10">بروفيشنال</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-emerald-200 text-xs font-bold">حالة الاشتراك</span>
                      <span className="font-bold text-xs flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>نشط</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-emerald-200 text-xs font-bold">تاريخ الانتهاء</span>
                      <span className="font-bold text-xs">2026/12/31</span>
                    </div>
                  </div>
                </div>

                <button className="w-full mt-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-sm py-2.5 rounded-lg font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 focus:outline-none">
                  <CreditCard size={18} /> ترقية / تجديد الاشتراك
                </button>

                <div className="pt-4 border-t border-gray-100 dark:border-gray-700/50 mt-4">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-3">الدعم الفني السريع</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="flex flex-col items-center justify-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none">
                      <Phone size={18} className="text-blue-500" /> اتصال بالدعم
                    </button>
                    <button className="flex flex-col items-center justify-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none">
                      <LifeBuoy size={18} className="text-orange-500" /> تذكرة صيانة
                    </button>
                  </div>
                </div>
              </AccordionSection>

              {/* 4️⃣ System */}
              <AccordionSection title="إعدادات النظام" icon={Settings}>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 block">إدارة المستخدمين والصلاحيات</label>
                    <div className="flex flex-col gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#1E4D4D]/10 dark:bg-emerald-900/30 flex items-center justify-center text-[#1E4D4D] dark:text-emerald-400 shrink-0">
                          <User size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Administrator</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">مدير النظام</p>
                        </div>
                      </div>
                      <button className="flex items-center justify-center gap-1.5 w-full text-xs font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none">
                        <Key size={14} /> تغيير كلمة المرور
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                      <Moon size={18} className="text-indigo-500" /> الوضع الليلي (Dark Mode)
                    </div>
                    <button 
                      onClick={() => setIsDarkMode(!isDarkMode)}
                      className={`w-11 h-6 rounded-full transition-colors relative flex items-center focus:outline-none ${isDarkMode ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${isDarkMode ? 'translate-x-1 left-0' : 'translate-x-6 left-0'}`} />
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 block">العملة الافتراضية للنظام</label>
                    <select className="w-full text-sm p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-[#10B981] outline-none transition-all cursor-pointer">
                      <option value="YER">ريال يمني (YER)</option>
                      <option value="SAR">ريال سعودي (SAR)</option>
                      <option value="USD">دولار أمريكي (USD)</option>
                    </select>
                  </div>
                </div>
              </AccordionSection>
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 mt-auto">
              <button className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400 text-sm font-bold w-full py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors focus:outline-none">
                <LogOut size={18} /> تسجيل الخروج
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
