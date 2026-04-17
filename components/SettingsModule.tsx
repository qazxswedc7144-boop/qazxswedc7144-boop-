
import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/services/database';
import { 
  Settings, Database, Sliders, CloudLightning, CheckCircle2, 
  Upload, FileJson, Smartphone, Save, FileText, Layout, 
  Type, MapPin, Phone, Info, Clock, Calendar, Lock, Unlock, Plus,
  Users, ShieldCheck, Download, Shield
} from 'lucide-react';
import { Card, Button, Badge, Input } from '@/components/SharedUI';
import { useUI } from '@/store/AppContext';
import { AccountingPeriodRepository } from '@/repositories/AccountingPeriodRepository';
import { authService } from '@/services/auth.service';
import BackupManagement from '@/repositories/BackupManagement';
import { CurrencySelector } from '@/components/CurrencySelector';

interface InvoiceConfig {
  pharmacyName: string;
  address: string;
  phone: string;
  taxNumber: string;
  footerNote: string;
  layoutType: 'standard' | 'compact' | 'detailed';
  showLogo: boolean;
}

const SettingsModule: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  const [currentView, setCurrentView] = useState<'main' | 'ux' | 'invoice' | 'periods' | 'backup' | 'security'>('main');
  const [uxSettings, setUxSettings] = useState({ delayedSync: false });
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

  const { refreshGlobal, addToast, version } = useUI();
  const user = authService.getCurrentUser();

  useEffect(() => {
    const load = async () => {
      setUxSettings({ delayedSync: false });
      
      const savedConfig = await db.getSetting('invoice_config', null);
      if (savedConfig) setInvoiceConfig(savedConfig);

      const pList = await AccountingPeriodRepository.getAll();
      setPeriods(pList);
    };
    load();
  }, [version]);

  const saveInvoiceConfig = async (newConfig: InvoiceConfig) => {
    setInvoiceConfig(newConfig);
    await db.saveSetting('invoice_config', newConfig);
    addToast("تم حفظ إعدادات الفاتورة بنجاح ✅", "success");
  };

  const handleCreatePeriod = async () => {
    if (!newPeriod.start || !newPeriod.end) {
      addToast("يرجى تحديد تاريخ البداية والنهاية", "warning");
      return;
    }
    await AccountingPeriodRepository.createPeriod(newPeriod.start, newPeriod.end);
    addToast("تم إنشاء الفترة المحاسبية بنجاح ✅", "success");
    setNewPeriod({ start: '', end: '' });
    refreshGlobal();
  };

  const handleTogglePeriod = async (id: string, currentlyClosed: boolean) => {
    if (currentlyClosed) {
      await AccountingPeriodRepository.openPeriod(id);
      addToast("تم فتح الفترة المحاسبية", "info");
    } else {
      await AccountingPeriodRepository.closePeriod(id, user?.User_Email || 'SYSTEM');
      addToast("تم إغلاق الفترة بنجاح 🔒", "success");
    }
    refreshGlobal();
  };

  const renderHeader = (title: string, subtitle: string, onBack?: () => void) => (
    <div className="flex items-center justify-between bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm mb-6">
      <div className="flex items-center gap-4">
        {onBack ? (
          <button 
            onClick={onBack}
            className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shadow-sm active:scale-90 transition-all"
          >
            <Plus size={20} className="rotate-45" />
          </button>
        ) : (
          <div className="w-12 h-12 bg-[#1E4D4D] text-white rounded-2xl flex items-center justify-center shadow-lg">
            <Settings size={24} />
          </div>
        )}
        <div>
          <h2 className="text-xl font-black text-[#1E4D4D]">{title}</h2>
          <p className="text-slate-400 font-bold text-[10px]">{subtitle}</p>
        </div>
      </div>
      {!onBack && (
        <button 
          onClick={() => onNavigate?.('dashboard')} 
          className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-[#1E4D4D] text-xl font-black shadow-sm active:scale-90 transition-all"
        >
          ➦
        </button>
      )}
    </div>
  );

  const SettingsCard = ({ id, title, desc, icon, color }: { id: any, title: string, desc: string, icon: React.ReactNode, color: string }) => (
    <Card 
      onClick={() => setCurrentView(id)}
      className="!p-6 border-r-8 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group"
      style={{ borderRightColor: color }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110" style={{ backgroundColor: color }}>
            {icon}
          </div>
          <div className="text-right">
            <h3 className="text-lg font-black text-[#1E4D4D]">{title}</h3>
            <p className="text-xs text-slate-400 font-bold mt-1">{desc}</p>
          </div>
        </div>
        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-all">
          <Plus size={20} />
        </div>
      </div>
    </Card>
  );

  if (currentView === 'main') {
    return (
      <div className="space-y-6 pb-32 text-right px-4 md:px-0 animate-in fade-in duration-500" dir="rtl">
        {renderHeader("إعدادات النظام", "إدارة السجلات وخيارات النظام")}
        
        <div className="grid grid-cols-1 gap-4">
          <SettingsCard 
            id="ux" 
            title="تثبيت الجوال" 
            desc="ربط الأجهزة ومزامنة المتصفح" 
            icon={<Smartphone size={24} />} 
            color="#10b981" 
          />
          <SettingsCard 
            id="invoice" 
            title="تخصيص الفواتير" 
            desc="تصميم الفاتورة وشعار الصيدلية" 
            icon={<FileText size={24} />} 
            color="#3b82f6" 
          />
          <SettingsCard 
            id="periods" 
            title="الفترات المحاسبية" 
            desc="إدارة السنوات المالية والإغلاق" 
            icon={<Clock size={24} />} 
            color="#f59e0b" 
          />
          <SettingsCard 
            id="security" 
            title="أمان التطبيق" 
            desc="كلمات المرور وقفل الشاشة التلقائي" 
            icon={<Lock size={24} />} 
            color="#6366f1" 
          />
          <SettingsCard 
            id="backup" 
            title="البيانات والنسخ الاحتياطي" 
            desc="تصدير واسترجاع البيانات محلياً ومع Drive" 
            icon={<Database size={24} />} 
            color="#1E4D4D" 
          />
        </div>

        {/* قسم النسخ الاحتياطي السريع */}
        <div className="mt-8">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mr-2 mb-4 flex items-center gap-2">
            <Download size={16} /> تصدير نسخة احتياطية سريعة
          </h3>
          <Card className="!p-6 border-l-8 border-l-[#1E4D4D] bg-emerald-50/30">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-[#1E4D4D] text-white rounded-2xl flex items-center justify-center shadow-lg">
                  <Shield size={28} />
                </div>
                <div>
                  <h4 className="font-black text-[#1E4D4D] text-sm">تنزيل نسخة مشفرة (.enc)</h4>
                  <p className="text-[10px] text-slate-500 font-bold leading-relaxed max-w-[300px]">
                    قم بتنزيل ملف يحتوي على كافة بيانات النظام مشفرة بكلمة مرور. يمكنك استعادة هذه النسخة في أي وقت.
                  </p>
                </div>
              </div>
              <Button 
                variant="primary" 
                className="h-12 px-8 !rounded-xl shadow-lg bg-[#1E4D4D] hover:bg-slate-800"
                onClick={async () => {
                  const password = window.prompt('يرجى تعيين كلمة مرور لتشفير ملف النسخة الاحتياطية (.enc):');
                  if (!password) return;
                  try {
                    const blob = await (await import('@/services/backupService')).BackupService.exportBackupToFile(password);
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `pharmaflow_backup_${new Date().toISOString().split('T')[0]}.enc`;
                    a.click();
                    addToast('تم تصدير ملف النسخة المشفرة بنجاح ✅', 'success');
                  } catch (error: any) {
                    addToast(`فشل التصدير: ${error.message}`, 'error');
                  }
                }}
              >
                <Download className="ml-2" size={18} /> تنزيل النسخة الآن
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-32 text-right px-4 md:px-0 animate-in slide-in-from-left-4 duration-500" dir="rtl">
      {currentView === 'ux' && (
        <>
          {renderHeader("تثبيت الجوال", "ربط الأجهزة ومزامنة المتصفح", () => setCurrentView('main'))}
          <Card className="!p-6 border-l-8 border-l-emerald-500 space-y-8">
             <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-[#1E4D4D]">إعدادات الاستقرار والسرعة</h3>
                <Badge variant="info">Mobile Optimized</Badge>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 bg-emerald-50/50 border border-emerald-100 rounded-[28px] flex items-center justify-between group hover:bg-emerald-50 transition-all">
                  <div className="flex items-center gap-4 text-right">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg"><CloudLightning size={24} /></div>
                    <div>
                        <h4 className="font-black text-[#1E4D4D] text-sm">المزامنة اللحظية</h4>
                        <p className="text-[9px] text-slate-500 font-bold leading-relaxed max-w-[180px]">رفع البيانات فور الحفظ لضمان عدم الضياع.</p>
                    </div>
                  </div>
                  <Badge variant="success">نشط</Badge>
                </div>
                <div className="p-6 bg-blue-50/50 rounded-[28px] border border-blue-100 flex items-center justify-between group hover:bg-blue-50 transition-all">
                  <div className="flex items-center gap-4 text-right">
                    <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg"><Save size={24} /></div>
                    <div>
                        <h4 className="font-black text-[#1E4D4D] text-sm">الحفظ التلقائي</h4>
                        <p className="text-[9px] text-slate-500 font-bold leading-relaxed max-w-[180px]">حفظ التغييرات لحظياً في الذاكرة المحلية.</p>
                    </div>
                  </div>
                  <Badge variant="info">مفعل ⚡</Badge>
                </div>
             </div>
             <div className="max-w-md">
                <CurrencySelector />
             </div>
          </Card>
        </>
      )}

      {currentView === 'invoice' && (
        <>
          {renderHeader("تخصيص الفواتير", "تصميم الفاتورة وشعار الصيدلية", () => setCurrentView('main'))}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="!p-6 space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
                  <Layout className="text-[#1E4D4D]" size={20} />
                  <h3 className="text-lg font-black text-[#1E4D4D]">ترويسة الفاتورة</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="اسم الصيدلية" value={invoiceConfig.pharmacyName} onChange={e => setInvoiceConfig({...invoiceConfig, pharmacyName: e.target.value})} icon={<Type size={14}/>} className="!py-3" />
                  <Input label="رقم الهاتف" value={invoiceConfig.phone} onChange={e => setInvoiceConfig({...invoiceConfig, phone: e.target.value})} icon={<Phone size={14}/>} className="!py-3" />
                  <Input label="العنوان" value={invoiceConfig.address} onChange={e => setInvoiceConfig({...invoiceConfig, address: e.target.value})} icon={<MapPin size={14}/>} className="!py-3" />
                  <Input label="الرقم الضريبي" value={invoiceConfig.taxNumber} onChange={e => setInvoiceConfig({...invoiceConfig, taxNumber: e.target.value})} icon={<Info size={14}/>} className="!py-3" />
                </div>
              </Card>
              <Card className="!p-6 space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
                  <FileText className="text-[#1E4D4D]" size={20} />
                  <h3 className="text-lg font-black text-[#1E4D4D]">تذييل الفاتورة</h3>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">ملاحظات التذييل</label>
                  <textarea className="w-full bg-[#F8FAFA] border-2 border-transparent rounded-[20px] p-4 text-sm font-black text-[#1E4D4D] focus:bg-white focus:border-[#1E4D4D] transition-all outline-none min-h-[80px] resize-none" value={invoiceConfig.footerNote} onChange={e => setInvoiceConfig({...invoiceConfig, footerNote: e.target.value})} />
                </div>
              </Card>
            </div>
            <div className="lg:col-span-1">
              <Card className="!p-6 bg-slate-900 text-white !rounded-[32px]">
                <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-6">تخطيط البنود</h3>
                <div className="space-y-3">
                  {['standard', 'compact', 'detailed'].map(l => (
                    <label key={l} className={`flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 cursor-pointer ${invoiceConfig.layoutType === l ? 'border-emerald-500 bg-emerald-500/10' : ''}`}>
                      <input type="radio" checked={invoiceConfig.layoutType === l} onChange={() => setInvoiceConfig({...invoiceConfig, layoutType: l as any})} className="accent-emerald-500" />
                      <span className="text-xs font-black uppercase">{l}</span>
                    </label>
                  ))}
                </div>
                <Button variant="approve" className="w-full h-12 mt-6" onClick={() => saveInvoiceConfig(invoiceConfig)}>حفظ المظهر</Button>
              </Card>
            </div>
          </div>
        </>
      )}

      {currentView === 'periods' && (
        <>
          {renderHeader("الفترات المحاسبية", "إدارة السنوات المالية والإغلاق", () => setCurrentView('main'))}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
             <div className="lg:col-span-4 space-y-6">
                <Card className="!p-8 space-y-6">
                   <h3 className="text-lg font-black text-[#1E4D4D] flex items-center gap-2 border-b border-slate-50 pb-4">
                     <Plus size={20} className="text-emerald-500" /> إنشاء فترة جديدة
                   </h3>
                   <div className="space-y-4">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase">تاريخ البداية</label>
                         <input type="date" className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 font-black text-xs" value={newPeriod.start} onChange={e => setNewPeriod({...newPeriod, start: e.target.value})} />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase">تاريخ النهاية</label>
                         <input type="date" className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 font-black text-xs" value={newPeriod.end} onChange={e => setNewPeriod({...newPeriod, end: e.target.value})} />
                      </div>
                      <Button variant="primary" className="w-full h-14 !rounded-xl shadow-lg" onClick={handleCreatePeriod}>إضافة الفترة للنظام</Button>
                   </div>
                </Card>
                <Card className="bg-amber-50 border-amber-100 flex gap-4 p-6">
                   <Info className="text-amber-600 shrink-0" />
                   <p className="text-[11px] font-bold text-amber-800 leading-relaxed">تنبيه: إغلاق الفترة سيمنع كافة المستخدمين (باستثناء المسؤولين) من إضافة أو تعديل أو حذف أي مستند يقع تاريخه ضمن نطاق الفترة.</p>
                </Card>
             </div>

             <div className="lg:col-span-8 space-y-4">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mr-2 flex items-center gap-2">
                   <Lock size={16} /> سجل الفترات المحاسبية
                </h3>
                <div className="space-y-4">
                   {periods.map(p => (
                     <Card key={p.id} className={`transition-all border-r-8 ${p.Is_Closed ? 'border-r-red-500 bg-red-50/20' : 'border-r-emerald-500 shadow-lg'}`}>
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-6">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${p.Is_Closed ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                 {p.Is_Closed ? <Lock size={20} /> : <Unlock size={20} />}
                              </div>
                              <div>
                                 <h4 className="font-black text-[#1E4D4D] text-sm">
                                    {new Date(p.Start_Date).toLocaleDateString('ar-SA')} ← {new Date(p.End_Date).toLocaleDateString('ar-SA')}
                                 </h4>
                                 <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                                    الحالة: {p.Is_Closed ? `مغلقة بواسطة ${p.closedBy?.split('@')[0]}` : 'فترة مفتوحة ونشطة'}
                                 </p>
                              </div>
                           </div>
                           <button 
                             onClick={() => handleTogglePeriod(p.id, p.Is_Closed)}
                             className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${p.Is_Closed ? 'bg-white border-2 border-red-200 text-red-600 hover:bg-red-500 hover:text-white' : 'bg-[#1E4D4D] text-white shadow-xl hover:scale-105'}`}
                           >
                              {p.Is_Closed ? 'إعادة فتح' : 'إغلاق الآن 🔒'}
                           </button>
                        </div>
                     </Card>
                   ))}
                   {periods.length === 0 && (
                     <div className="py-20 text-center opacity-30 italic font-black">لا توجد فترات محاسبية مسجلة</div>
                   )}
                </div>
             </div>
          </div>
        </>
      )}

      {currentView === 'backup' && (
        <>
          {renderHeader("البيانات والنسخ الاحتياطي", "تصدير واسترجاع البيانات محلياً ومع Drive", () => setCurrentView('main'))}
          <BackupManagement />
        </>
      )}

      {currentView === 'security' && (
        <>
          {renderHeader("أمان التطبيق", "كلمات المرور وقفل الشاشة التلقائي", () => setCurrentView('main'))}
          <SecuritySettingsTab />
        </>
      )}
    </div>
  );
};

const SecuritySettingsTab: React.FC = () => {
  const [settings, setSettings] = useState<any>(null);
  const [appLockEnabled, setAppLockEnabled] = useState(
    localStorage.getItem("app_lock_enabled") === "true"
  );
  const [form, setForm] = useState({ username: '', password: '', confirm: '', mode: '5m' as any });
  const { addToast, refreshGlobal } = useUI();
  const [loading, setLoading] = useState(false);

  const toggleAppLock = (value: boolean) => {
    setAppLockEnabled(value);
    if (value) {
      localStorage.setItem("app_lock_enabled", "true");
    } else {
      localStorage.removeItem("app_lock_enabled");
    }
  };

  const setPassword = (newPass: string) => {
    localStorage.setItem("app_lock_pass", newPass);
    refreshGlobal();
  };

  useEffect(() => {
    const load = async () => {
      const { appLockService } = await import('../services/AppLockService');
      const s = await appLockService.getSettings();
      setSettings(s);
      if (s) {
        setForm(f => ({ ...f, username: s.username, mode: s.lock_mode }));
        toggleAppLock(s.is_enabled);
      }
    };
    load();
  }, []);

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
      const { appLockService } = await import('../services/AppLockService');
      await appLockService.enableSecurity(form.username, form.password, form.mode);
      addToast("تم تفعيل أمان التطبيق بنجاح ✅", "success");
      const s = await appLockService.getSettings();
      setSettings(s);
      toggleAppLock(true);
      refreshGlobal();
    } catch (e) {
      addToast("فشل تفعيل الأمان", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    try {
      const { appLockService } = await import('../services/AppLockService');
      await appLockService.disableSecurity();
      addToast("تم تعطيل أمان التطبيق", "info");
      const s = await appLockService.getSettings();
      setSettings(s);
      toggleAppLock(false);
      refreshGlobal();
    } catch (e) {
      addToast("فشل تعطيل الأمان", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-4 space-y-6">
        <Card className="!p-8 space-y-6">
          <h3 className="text-lg font-black text-[#1E4D4D] flex items-center gap-2 border-b border-slate-50 pb-4">
            <Lock size={20} className="text-blue-500" /> {settings?.is_enabled ? 'تعديل الأمان' : 'تفعيل قفل التطبيق'}
          </h3>
          
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-[#1E4D4D]" size={20} />
              <span className="text-sm font-black text-[#1E4D4D]">تفعيل قفل التطبيق</span>
            </div>
            <input
              type="checkbox"
              className="w-5 h-5 accent-[#1E4D4D] cursor-pointer"
              checked={appLockEnabled}
              onChange={(e) => toggleAppLock(e.target.checked)}
            />
          </div>

          <div className="space-y-4">
            <Input label="اسم المستخدم" value={form.username} onChange={e => setForm({...form, username: e.target.value})} icon={<Users size={14}/>} />
            <Input 
              label="رمز القفل السريع (localStorage)" 
              type="text" 
              value={localStorage.getItem("app_lock_pass") || "1234"} 
              onChange={e => setPassword(e.target.value)} 
              icon={<ShieldCheck size={14}/>} 
            />
            <Input label="كلمة المرور" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} icon={<Lock size={14}/>} />
            <Input label="تأكيد كلمة المرور" type="password" value={form.confirm} onChange={e => setForm({...form, confirm: e.target.value})} icon={<Lock size={14}/>} />
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase">وضع القفل التلقائي</label>
              <select 
                className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 font-black text-xs outline-none focus:border-blue-500 transition-all"
                value={form.mode}
                onChange={e => setForm({...form, mode: e.target.value as any})}
              >
                <option value="instant">فوري (عند الخروج)</option>
                <option value="5m">بعد 5 دقائق خمول</option>
                <option value="10m">بعد 10 دقائق خمول</option>
                <option value="20m">بعد 20 دقيقة خمول</option>
                <option value="30m">بعد 30 دقيقة خمول</option>
              </select>
            </div>

            <Button 
              variant="primary" 
              className="w-full h-14 !rounded-xl shadow-lg" 
              onClick={handleEnable}
              disabled={loading}
            >
              {settings?.is_enabled ? 'تحديث الإعدادات' : 'تفعيل الآن'}
            </Button>

            {settings?.is_enabled && (
              <Button 
                variant="danger" 
                className="w-full h-12 !rounded-xl" 
                onClick={handleDisable}
                disabled={loading}
              >
                تعطيل الأمان
              </Button>
            )}
          </div>
        </Card>
      </div>

      <div className="lg:col-span-8">
        <Card className="bg-blue-50 border-blue-100 flex gap-4 p-8">
          <ShieldCheck className="text-blue-600 shrink-0" size={32} />
          <div className="space-y-2">
            <h4 className="font-black text-blue-900 text-sm">نظام حماية التطبيق المحلي</h4>
            <p className="text-[11px] font-bold text-blue-800 leading-relaxed">
              هذا النظام يوفر طبقة حماية إضافية لبياناتك المحلية. عند تفعيله، سيطلب التطبيق كلمة المرور بعد فترة من الخمول أو عند إعادة فتح التطبيق.
              <br/><br/>
              • يتم تشفير كلمة المرور محلياً ولا يتم إرسالها لأي خادم.
              <br/>
              • في حال نسيان كلمة المرور، ستحتاج لمسح بيانات المتصفح (مما قد يؤدي لفقدان البيانات غير المزامنة).
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SettingsModule;
