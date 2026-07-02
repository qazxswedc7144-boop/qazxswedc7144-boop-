import sys

code = """
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { db } from '@/core/db';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { 
  Lock, Plus, ShieldCheck, KeyRound, ScanLine, Info, Shield, Clock, User, 
  RefreshCw, CreditCard, Settings, Users, Package, ShoppingCart, Truck, 
  Database, Code, Search, Save, AlertTriangle
} from 'lucide-react';
import { Button, Input, Modal } from '@/components/shared/SharedUI';
import { useUI } from '@/contexts/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { ReviewerSaaSTester, SubscriptionGlobalUsageRibbon } from '@/components/saas/SubscriptionWidgets';
import BackupManagementComponent from '@/modules/settings/components/BackupManagement';
import { appLockService } from '@/services/AppLockService';

const TABS = [
  { id: 'general', label: 'إعدادات عامة', icon: Settings },
  { id: 'users', label: 'المستخدمون', icon: Users },
  { id: 'inventory', label: 'المخزون', icon: Package },
  { id: 'sales', label: 'المبيعات', icon: ShoppingCart },
  { id: 'purchases', label: 'المشتريات', icon: Truck },
  { id: 'sync', label: 'المزامنة', icon: RefreshCw },
  { id: 'database', label: 'قاعدة البيانات', icon: Database },
  { id: 'security', label: 'الأمان', icon: ShieldCheck },
  { id: 'developer', label: 'المطور', icon: Code },
  { id: 'subscription', label: 'الاشتراك', icon: CreditCard }
];

const SettingToggle = ({ label, description, checked, onChange, icon: Icon }: any) => (
  <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-indigo-500/50 transition-colors shadow-sm">
    <div className="flex items-center gap-3">
      {Icon && <div className="p-2 bg-slate-50 dark:bg-gray-700 rounded-lg"><Icon className="text-indigo-600 dark:text-indigo-400" size={18} /></div>}
      <div>
        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 block">{label}</span>
        {description && <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">{description}</span>}
      </div>
    </div>
    <button 
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none ${checked ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'left-1 translate-x-6' : 'left-1'}`} />
    </button>
  </div>
);

const SettingInput = ({ label, value, onChange, type = 'text', placeholder = '' }: any) => (
  <div className="space-y-1.5">
    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</label>
    <input 
      type={type} 
      value={value || ''} 
      onChange={(e) => onChange(e.target.value)} 
      placeholder={placeholder}
      className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
    />
  </div>
);

const SettingSelect = ({ label, value, onChange, options }: any) => (
  <div className="space-y-1.5">
    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</label>
    <select 
      value={value || ''} 
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
    >
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

const GeneralSettings = ({ settings, updateSetting, saveSettings, isSaving }: any) => (
  <div className="space-y-6">
    <div className="flex justify-between items-center mb-4">
       <h3 className="text-lg font-black text-slate-800 dark:text-white">الإعدادات العامة</h3>
       <Button variant="primary" onClick={saveSettings} isLoading={isSaving} className="!rounded-xl text-xs px-4 h-9">
         <Save size={14} className="mr-1.5 ml-1.5" /> حفظ التغييرات
       </Button>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
        <h4 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-gray-700 pb-2">معلومات النظام</h4>
        <SettingInput label="اسم النظام / الصيدلية" value={settings.systemName} onChange={(v: string) => updateSetting('systemName', v)} />
        <SettingSelect label="اللغة الافتراضية" value={settings.language} onChange={(v: string) => updateSetting('language', v)} options={[
          {value: 'ar', label: 'العربية'}, {value: 'en', label: 'English'}
        ]} />
        <SettingSelect label="العملة" value={settings.currency} onChange={(v: string) => updateSetting('currency', v)} options={[
          {value: 'SAR', label: 'ريال سعودي (SAR)'}, {value: 'USD', label: 'دولار أمريكي (USD)'}, {value: 'YER', label: 'ريال يمني (YER)'}
        ]} />
        <SettingSelect label="المنطقة الزمنية" value={settings.timezone} onChange={(v: string) => updateSetting('timezone', v)} options={[
          {value: 'Asia/Riyadh', label: 'Asia/Riyadh'}, {value: 'Asia/Dubai', label: 'Asia/Dubai'}, {value: 'Africa/Cairo', label: 'Africa/Cairo'}
        ]} />
      </div>
      <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
        <h4 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-gray-700 pb-2">التنسيق والموقع</h4>
        <SettingSelect label="تنسيق التاريخ" value={settings.dateFormat} onChange={(v: string) => updateSetting('dateFormat', v)} options={[
          {value: 'YYYY-MM-DD', label: 'YYYY-MM-DD'}, {value: 'DD/MM/YYYY', label: 'DD/MM/YYYY'}
        ]} />
        <SettingSelect label="تنسيق الوقت" value={settings.timeFormat} onChange={(v: string) => updateSetting('timeFormat', v)} options={[
          {value: '24h', label: '24 ساعة'}, {value: '12h', label: '12 ساعة (AM/PM)'}
        ]} />
        <SettingInput label="الدولة" value={settings.country} onChange={(v: string) => updateSetting('country', v)} />
        <SettingInput label="المدينة" value={settings.city} onChange={(v: string) => updateSetting('city', v)} />
      </div>
    </div>
  </div>
);

const UsersAndRoles = () => {
  const [users, setUsers] = useState<any[]>([]);
  useEffect(() => { db.branchUsers.toArray().then(setUsers); }, []);
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
         <h3 className="text-lg font-black text-slate-800 dark:text-white">المستخدمون والصلاحيات</h3>
         <Button variant="primary" className="!rounded-xl text-xs px-4 h-9">
           <Plus size={14} className="mr-1.5 ml-1.5" /> إضافة مستخدم
         </Button>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-right">
          <thead className="bg-slate-50 dark:bg-gray-900 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-100 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3">اسم المستخدم</th>
              <th className="px-4 py-3">الدور (Role)</th>
              <th className="px-4 py-3">تاريخ الإنشاء</th>
              <th className="px-4 py-3">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-slate-50 dark:border-gray-700/50 hover:bg-slate-50/50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-bold text-slate-800 dark:text-white">{u.username}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">{u.role}</span>
                </td>
                <td className="px-4 py-3 text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <Button variant="secondary" className="!rounded-lg text-[10px] h-7 px-3">تعديل</Button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={4} className="text-center py-6 text-slate-500">لا يوجد مستخدمون محليون</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const InventorySettings = ({ settings, updateSetting, saveSettings, isSaving }: any) => (
  <div className="space-y-6">
    <div className="flex justify-between items-center mb-4">
       <h3 className="text-lg font-black text-slate-800 dark:text-white">إعدادات المخزون</h3>
       <Button variant="primary" onClick={saveSettings} isLoading={isSaving} className="!rounded-xl text-xs px-4 h-9">حفظ التغييرات</Button>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SettingToggle label="السماح بالمخزون السالب" checked={settings.allowNegativeStock} onChange={(v: boolean) => updateSetting('allowNegativeStock', v)} />
      <SettingToggle label="تتبع التشغيلة (Batches)" checked={settings.enableBatchTracking} onChange={(v: boolean) => updateSetting('enableBatchTracking', v)} />
      <SettingToggle label="تنبيهات الصلاحية" checked={settings.enableExpiryTracking} onChange={(v: boolean) => updateSetting('enableExpiryTracking', v)} />
      <SettingToggle label="استراتيجية FIFO" checked={settings.fifo} onChange={(v: boolean) => updateSetting('fifo', v)} />
    </div>
  </div>
);

const SalesSettings = ({ settings, updateSetting, saveSettings, isSaving }: any) => (
  <div className="space-y-6">
    <div className="flex justify-between items-center mb-4">
       <h3 className="text-lg font-black text-slate-800 dark:text-white">إعدادات المبيعات</h3>
       <Button variant="primary" onClick={saveSettings} isLoading={isSaving} className="!rounded-xl text-xs px-4 h-9">حفظ التغييرات</Button>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SettingToggle label="السماح بالخصومات" checked={settings.allowDiscounts} onChange={(v: boolean) => updateSetting('allowDiscounts', v)} />
      <SettingToggle label="السماح بالمرتجعات" checked={settings.salesReturns} onChange={(v: boolean) => updateSetting('salesReturns', v)} />
      <SettingToggle label="تقريب الأسعار" checked={settings.priceRounding} onChange={(v: boolean) => updateSetting('priceRounding', v)} />
    </div>
  </div>
);

const PurchasesSettings = ({ settings, updateSetting, saveSettings, isSaving }: any) => (
  <div className="space-y-6">
    <div className="flex justify-between items-center mb-4">
       <h3 className="text-lg font-black text-slate-800 dark:text-white">إعدادات المشتريات</h3>
       <Button variant="primary" onClick={saveSettings} isLoading={isSaving} className="!rounded-xl text-xs px-4 h-9">حفظ التغييرات</Button>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SettingToggle label="إنشاء فاتورة تلقائياً عند الاستلام" checked={settings.autoCreateInvoice} onChange={(v: boolean) => updateSetting('autoCreateInvoice', v)} />
      <SettingToggle label="الاستلام الجزئي" checked={settings.partialReceipt} onChange={(v: boolean) => updateSetting('partialReceipt', v)} />
    </div>
  </div>
);

const SyncTab = () => {
  const [stats, setStats] = useState({ outbox: 0, failed: 0, queue: 0 });
  const { addToast } = useUI();
  const refreshStats = async () => {
    try {
      const outboxCount = await db.outbox.count();
      const failedCount = await db.failedMutations.count();
      const queueCount = await db.syncQueue.count();
      setStats({ outbox: outboxCount, failed: failedCount, queue: queueCount });
    } catch(e) {}
  };
  useEffect(() => { refreshStats(); }, []);
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-black text-slate-800 dark:text-white">محرك المزامنة</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm text-center">
          <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{stats.outbox}</div>
          <div className="text-xs text-slate-500 font-bold mt-2">قائمة الانتظار (Outbox)</div>
        </div>
        <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm text-center">
          <div className="text-3xl font-black text-rose-500 dark:text-rose-400">{stats.failed}</div>
          <div className="text-xs text-slate-500 font-bold mt-2">عمليات فاشلة</div>
        </div>
      </div>
      <div className="flex gap-3">
        <Button variant="primary" onClick={() => addToast("جاري المزامنة...", "info")} className="flex-1 !rounded-xl">Force Sync الآن</Button>
      </div>
    </div>
  );
};

const DatabaseTab = () => {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-black text-slate-800 dark:text-white">إدارة قاعدة البيانات</h3>
      <BackupManagementComponent />
    </div>
  );
};

const DeveloperTab = () => (
  <div className="space-y-6">
    <h3 className="text-lg font-black text-slate-800 dark:text-white">إعدادات المطور</h3>
    <div className="p-5 bg-slate-900 rounded-2xl text-emerald-400 font-mono text-xs space-y-2">
      <p>&gt; System Version: v2.4.0</p>
      <p>&gt; Dexie DB Version: {db.getDataVersion()}</p>
    </div>
  </div>
);

const SettingsModule = ({ onNavigate }: any) => {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const { addToast } = useUI();
  const [themeMode, setThemeMode] = useState('system');
  const { authenticationEnabled, setAuthenticationEnabled } = useAuth();
  
  // Security
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [lockOnStartup, setLockOnStartup] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [autoLockEnabled, setAutoLockEnabled] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const dbSettings = await db.systemSettings.toArray();
        const obj: any = {};
        dbSettings.forEach(s => { obj[s.key] = s.value; });
        setSettings(obj);
        setAppLockEnabled(await appLockService.isSimpleLockEnabled());
      } catch(e) {}
    };
    loadSettings();
  }, []);

  const updateSetting = (key: string, value: any) => setSettings((p: any) => ({ ...p, [key]: value }));
  
  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const promises = Object.entries(settings).map(([key, value]) => db.systemSettings.put({ key, value }));
      await Promise.all(promises);
      addToast("تم حفظ الإعدادات بنجاح", "success");
    } catch(e) {
      addToast("فشل الحفظ", "error");
    } finally { setIsSaving(false); }
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'general': return <GeneralSettings settings={settings} updateSetting={updateSetting} saveSettings={saveSettings} isSaving={isSaving} />;
      case 'users': return <UsersAndRoles />;
      case 'inventory': return <InventorySettings settings={settings} updateSetting={updateSetting} saveSettings={saveSettings} isSaving={isSaving} />;
      case 'sales': return <SalesSettings settings={settings} updateSetting={updateSetting} saveSettings={saveSettings} isSaving={isSaving} />;
      case 'purchases': return <PurchasesSettings settings={settings} updateSetting={updateSetting} saveSettings={saveSettings} isSaving={isSaving} />;
      case 'sync': return <SyncTab />;
      case 'database': return <DatabaseTab />;
      case 'security': return (
        <div className="space-y-6">
          <h3 className="text-lg font-black text-slate-800 dark:text-white">الأمان والقفل</h3>
          <SettingToggle label="شاشة تسجيل الدخول الإلزامية" checked={authenticationEnabled} onChange={(v: boolean) => setAuthenticationEnabled(v)} />
          <SettingToggle label="تفعيل قفل التطبيق السريع (PIN)" checked={appLockEnabled} onChange={(v: boolean) => { setAppLockEnabled(v); appLockService.setSimpleLockEnabled(v); }} />
        </div>
      );
      case 'developer': return <DeveloperTab />;
      case 'subscription': return <div className="p-6 bg-white rounded-3xl"><ReviewerSaaSTester /></div>;
      default: return null;
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-50/50 dark:bg-gray-950 pb-32 font-sans text-right" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 mt-6 flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-64 shrink-0">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-2 overflow-y-auto max-h-[80vh] sticky top-24 space-y-1">
             {TABS.map(tab => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id)}
                 className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all text-right ${
                   activeTab === tab.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                 }`}
               >
                 <tab.icon size={18} /> {tab.label}
               </button>
             ))}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              {renderActiveTab()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
export default SettingsModule;
"""

with open('src/modules/settings/pages/SettingsModule.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
print('Done!')
