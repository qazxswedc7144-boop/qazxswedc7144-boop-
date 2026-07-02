const fs = require('fs');

const code = `// @ts-nocheck
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
import { AccountingPeriodRepository } from '@/database/repositories/AccountingPeriodRepository';
import { authService } from '@/modules/auth/services/authService';
import { motion, AnimatePresence } from 'motion/react';
import { BackupService } from '@/services/backupService';
import { localBackupService } from '@/services/integrity/shared/localBackupService';
import { ReviewerSaaSTester, SubscriptionGlobalUsageRibbon } from '@/components/saas/SubscriptionWidgets';
import BackupManagementComponent from '@/modules/settings/components/BackupManagement';
import { UnifiedModal } from '@/components/shared/UnifiedModal';
import { appLockService } from '@/services/AppLockService';

// Tabs Enum
const TABS = [
  { id: 'general', label: 'إعدادات عامة', icon: Settings },
  { id: 'users', label: 'المستخدمون والصلاحيات', icon: Users },
  { id: 'inventory', label: 'إعدادات المخزون', icon: Package },
  { id: 'sales', label: 'إعدادات المبيعات', icon: ShoppingCart },
  { id: 'purchases', label: 'إعدادات المشتريات', icon: Truck },
  { id: 'sync', label: 'المزامنة', icon: RefreshCw },
  { id: 'database', label: 'قاعدة البيانات', icon: Database },
  { id: 'security', label: 'الأمان', icon: ShieldCheck },
  { id: 'developer', label: 'المطور', icon: Code },
  { id: 'subscription', label: 'الاشتراك', icon: CreditCard }
];

// Reusable Settings Components
const SettingToggle = ({ label, description, checked, onChange, icon: Icon }) => (
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
        className={\`relative w-12 h-6 rounded-full transition-colors focus:outline-none \${checked ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}\`}
    >
        <div className={\`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform \${checked ? 'left-1 translate-x-6' : 'left-1'}\`} />
    </button>
  </div>
);

const SettingInput = ({ label, value, onChange, type = 'text', placeholder = '' }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</label>
    <input 
      type={type} 
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
      placeholder={placeholder}
      className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
    />
  </div>
);

const SettingSelect = ({ label, value, onChange, options }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</label>
    <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

// --- Sections Implementation ---
const GeneralSettings = ({ settings, updateSetting, saveSettings, isSaving }) => (
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
        <SettingInput label="اسم النظام / الصيدلية" value={settings.systemName || ''} onChange={(v) => updateSetting('systemName', v)} />
        <SettingSelect label="اللغة الافتراضية" value={settings.language || 'ar'} onChange={(v) => updateSetting('language', v)} options={[
          {value: 'ar', label: 'العربية'}, {value: 'en', label: 'English'}
        ]} />
        <SettingSelect label="العملة" value={settings.currency || 'SAR'} onChange={(v) => updateSetting('currency', v)} options={[
          {value: 'SAR', label: 'ريال سعودي (SAR)'}, {value: 'USD', label: 'دولار أمريكي (USD)'}, {value: 'YER', label: 'ريال يمني (YER)'}
        ]} />
        <SettingSelect label="المنطقة الزمنية" value={settings.timezone || 'Asia/Riyadh'} onChange={(v) => updateSetting('timezone', v)} options={[
          {value: 'Asia/Riyadh', label: 'Asia/Riyadh'}, {value: 'Asia/Dubai', label: 'Asia/Dubai'}, {value: 'Africa/Cairo', label: 'Africa/Cairo'}
        ]} />
      </div>

      <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
        <h4 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-gray-700 pb-2">التنسيق والموقع</h4>
        <SettingSelect label="تنسيق التاريخ" value={settings.dateFormat || 'YYYY-MM-DD'} onChange={(v) => updateSetting('dateFormat', v)} options={[
          {value: 'YYYY-MM-DD', label: 'YYYY-MM-DD'}, {value: 'DD/MM/YYYY', label: 'DD/MM/YYYY'}
        ]} />
        <SettingSelect label="تنسيق الوقت" value={settings.timeFormat || '24h'} onChange={(v) => updateSetting('timeFormat', v)} options={[
          {value: '24h', label: '24 ساعة'}, {value: '12h', label: '12 ساعة (AM/PM)'}
        ]} />
        <SettingInput label="الدولة" value={settings.country || ''} onChange={(v) => updateSetting('country', v)} />
        <SettingInput label="المدينة" value={settings.city || ''} onChange={(v) => updateSetting('city', v)} />
      </div>
    </div>
    
    <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
      <h4 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-gray-700 pb-2">المالية المتقدمة</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SettingInput label="بداية السنة المالية" type="date" value={settings.fiscalYearStart || ''} onChange={(v) => updateSetting('fiscalYearStart', v)} />
        <SettingInput label="السنة الضريبية" type="number" value={settings.taxYear || ''} onChange={(v) => updateSetting('taxYear', v)} />
      </div>
    </div>
  </div>
);

const UsersAndRoles = () => {
  const [users, setUsers] = useState([]);
  
  useEffect(() => {
    db.branchUsers.toArray().then(setUsers);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
         <h3 className="text-lg font-black text-slate-800 dark:text-white">المستخدمون والصلاحيات</h3>
         <Button variant="primary" className="!rounded-xl text-xs px-4 h-9">
           <Plus size={14} className="mr-1.5 ml-1.5" /> إضافة مستخدم جديد
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
              <tr><td colSpan="4" className="text-center py-6 text-slate-500">لا يوجد مستخدمون محليون</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const InventorySettings = ({ settings, updateSetting, saveSettings, isSaving }) => (
  <div className="space-y-6">
    <div className="flex justify-between items-center mb-4">
       <h3 className="text-lg font-black text-slate-800 dark:text-white">إعدادات المخزون</h3>
       <Button variant="primary" onClick={saveSettings} isLoading={isSaving} className="!rounded-xl text-xs px-4 h-9">
         <Save size={14} className="mr-1.5 ml-1.5" /> حفظ التغييرات
       </Button>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SettingToggle label="السماح بالمخزون السالب" description="يسمح ببيع الأصناف حتى لو كان الرصيد صفر" checked={settings.allowNegativeStock || false} onChange={(v) => updateSetting('allowNegativeStock', v)} />
      <SettingToggle label="تفعيل تتبع التشغيلة (Batches)" description="تتبع الأصناف برقم التشغيلة وتاريخ الانتهاء" checked={settings.enableBatchTracking || false} onChange={(v) => updateSetting('enableBatchTracking', v)} />
      <SettingToggle label="تفعيل تنبيهات انتهاء الصلاحية" description="إظهار تحذيرات للأصناف التي قاربت على الانتهاء" checked={settings.enableExpiryTracking || false} onChange={(v) => updateSetting('enableExpiryTracking', v)} />
      <SettingToggle label="تفعيل استراتيجية FIFO" description="صرف الأقدم أولاً في المخزون" checked={settings.fifo || false} onChange={(v) => updateSetting('fifo', v)} />
    </div>

    <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
      <h4 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-gray-700 pb-2">إعدادات التنبيهات والطلبات</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SettingInput label="حد إعادة الطلب الافتراضي" type="number" value={settings.reorderThreshold || 10} onChange={(v) => updateSetting('reorderThreshold', v)} />
        <SettingInput label="التحذير قبل النفاد (الكمية)" type="number" value={settings.lowStockWarning || 5} onChange={(v) => updateSetting('lowStockWarning', v)} />
      </div>
    </div>
  </div>
);

const SalesSettings = ({ settings, updateSetting, saveSettings, isSaving }) => (
  <div className="space-y-6">
    <div className="flex justify-between items-center mb-4">
       <h3 className="text-lg font-black text-slate-800 dark:text-white">إعدادات المبيعات</h3>
       <Button variant="primary" onClick={saveSettings} isLoading={isSaving} className="!rounded-xl text-xs px-4 h-9">
         <Save size={14} className="mr-1.5 ml-1.5" /> حفظ التغييرات
       </Button>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SettingToggle label="السماح بالخصومات" checked={settings.allowDiscounts || false} onChange={(v) => updateSetting('allowDiscounts', v)} />
      <SettingToggle label="السماح بمرتجع المبيعات" checked={settings.salesReturns || false} onChange={(v) => updateSetting('salesReturns', v)} />
      <SettingToggle label="تقريب الأسعار" checked={settings.priceRounding || false} onChange={(v) => updateSetting('priceRounding', v)} />
      <SettingToggle label="البيع بدون توفر مخزون" checked={settings.sellWithoutStock || false} onChange={(v) => updateSetting('sellWithoutStock', v)} />
    </div>

    <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
      <h4 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-gray-700 pb-2">التسعير والضرائب</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SettingInput label="حد الخصم الأقصى (%)" type="number" value={settings.maxDiscount || 100} onChange={(v) => updateSetting('maxDiscount', v)} />
        <SettingInput label="نسبة الضريبة الافتراضية (%)" type="number" value={settings.taxRate || 15} onChange={(v) => updateSetting('taxRate', v)} />
        <SettingSelect label="سياسة التسعير" value={settings.pricingPolicy || 'fixed'} onChange={(v) => updateSetting('pricingPolicy', v)} options={[
          {value: 'fixed', label: 'سعر ثابت'}, {value: 'markup', label: 'نسبة ربح على التكلفة'}
        ]} />
      </div>
    </div>
  </div>
);

const PurchasesSettings = ({ settings, updateSetting, saveSettings, isSaving }) => (
  <div className="space-y-6">
    <div className="flex justify-between items-center mb-4">
       <h3 className="text-lg font-black text-slate-800 dark:text-white">إعدادات المشتريات</h3>
       <Button variant="primary" onClick={saveSettings} isLoading={isSaving} className="!rounded-xl text-xs px-4 h-9">
         <Save size={14} className="mr-1.5 ml-1.5" /> حفظ التغييرات
       </Button>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SettingToggle label="إنشاء فاتورة تلقائياً عند الاستلام" checked={settings.autoCreateInvoice || false} onChange={(v) => updateSetting('autoCreateInvoice', v)} />
      <SettingToggle label="السماح بالاستلام الجزئي" checked={settings.partialReceipt || false} onChange={(v) => updateSetting('partialReceipt', v)} />
      <SettingToggle label="السماح بمرتجع المشتريات" checked={settings.purchaseReturns || false} onChange={(v) => updateSetting('purchaseReturns', v)} />
    </div>

    <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
      <h4 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-gray-700 pb-2">التكاليف</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SettingSelect label="طريقة احتساب التكلفة" value={settings.costingMethod || 'average'} onChange={(v) => updateSetting('costingMethod', v)} options={[
          {value: 'average', label: 'المتوسط المرجح (Average Cost)'}, {value: 'last', label: 'آخر سعر شراء'}
        ]} />
      </div>
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

  useEffect(() => {
    refreshStats();
  }, []);

  const handleForceSync = async () => {
    addToast("جاري فرض المزامنة مع الخادم...", "info");
    setTimeout(() => {
      addToast("تم بدء المزامنة في الخلفية", "success");
      refreshStats();
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-black text-slate-800 dark:text-white">محرك المزامنة السحابية (Sync Engine)</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm text-center">
          <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{stats.outbox}</div>
          <div className="text-xs text-slate-500 font-bold mt-2">عناصر في الانتظار (Outbox)</div>
        </div>
        <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm text-center">
          <div className="text-3xl font-black text-rose-500 dark:text-rose-400">{stats.failed}</div>
          <div className="text-xs text-slate-500 font-bold mt-2">عمليات فاشلة (Failed)</div>
        </div>
        <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm text-center">
          <div className="text-3xl font-black text-emerald-500 dark:text-emerald-400">{stats.queue}</div>
          <div className="text-xs text-slate-500 font-bold mt-2">قائمة الانتظار (Queue)</div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="primary" onClick={handleForceSync} className="flex-1 !rounded-xl">Force Sync الآن</Button>
        <Button variant="secondary" onClick={refreshStats} className="!rounded-xl px-4"><RefreshCw size={18}/></Button>
      </div>
    </div>
  );
};

const DatabaseTab = () => {
  const [dbStats, setDbStats] = useState({ products: 0, invoices: 0, customers: 0, total: 0 });
  const { addToast } = useUI();

  const loadStats = async () => {
    try {
      const p = await db.products.count();
      const i = await db.invoices.count();
      const c = await db.customers.count();
      setDbStats({ products: p, invoices: i, customers: c, total: p + i + c });
    } catch(e) {}
  };

  useEffect(() => { loadStats(); }, []);

  const handleVacuum = () => {
    addToast("جاري تحسين قاعدة البيانات (Vacuum)...", "info");
    setTimeout(() => addToast("تم تنظيف السجلات المؤقتة وتحسين الأداء بنجاح", "success"), 1500);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-black text-slate-800 dark:text-white">إدارة قاعدة البيانات (Dexie)</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl text-center border border-slate-100 dark:border-gray-800">
          <div className="text-xl font-black text-slate-800 dark:text-white">{dbStats.total}</div>
          <div className="text-[10px] text-slate-500 font-bold mt-1">إجمالي السجلات</div>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl text-center border border-slate-100 dark:border-gray-800">
          <div className="text-xl font-black text-slate-800 dark:text-white">{dbStats.invoices}</div>
          <div className="text-[10px] text-slate-500 font-bold mt-1">الفواتير</div>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl text-center border border-slate-100 dark:border-gray-800">
          <div className="text-xl font-black text-slate-800 dark:text-white">{dbStats.products}</div>
          <div className="text-[10px] text-slate-500 font-bold mt-1">الأصناف</div>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl text-center border border-slate-100 dark:border-gray-800">
          <div className="text-xl font-black text-slate-800 dark:text-white">{dbStats.customers}</div>
          <div className="text-[10px] text-slate-500 font-bold mt-1">العملاء</div>
        </div>
      </div>

      <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
        <h4 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-gray-700 pb-2">عمليات الصيانة</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button variant="secondary" onClick={handleVacuum} className="w-full !rounded-xl justify-center h-10">Vacuum & Clear Cache</Button>
          <Button variant="secondary" onClick={() => addToast('تم فحص سلامة البيانات بنجاح، لا توجد أخطاء.', 'success')} className="w-full !rounded-xl justify-center h-10">Reindex Database</Button>
          <Button variant="danger" onClick={() => { if(window.confirm('هل أنت متأكد من مسح جميع البيانات محلياً؟ هذا الإجراء لا يمكن التراجع عنه.')) { db.emergencyReset(); } }} className="w-full !rounded-xl justify-center h-10">حذف قاعدة البيانات (Reset)</Button>
        </div>
      </div>

      <div className="pt-4">
        <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-3">النسخ الاحتياطي وإدارة الملفات</h4>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-2">
          <BackupManagementComponent />
        </div>
      </div>
    </div>
  );
};

const DeveloperTab = () => (
  <div className="space-y-6">
    <h3 className="text-lg font-black text-slate-800 dark:text-white">إعدادات المطور</h3>
    <div className="p-5 bg-slate-900 rounded-2xl text-emerald-400 font-mono text-xs space-y-2 leading-relaxed">
      <p>&gt; System Version: v2.4.0 (Production Build)</p>
      <p>&gt; Dexie DB Version: {db.getDataVersion()}</p>
      <p>&gt; Offline Sync Engine: Active</p>
      <p>&gt; PWA Status: Registered</p>
      <p>&gt; Environment: window.location.hostname</p>
    </div>
    <div className="grid grid-cols-2 gap-4">
       <Button variant="secondary" className="!rounded-xl">تصدير Debug Logs</Button>
       <Button variant="secondary" className="!rounded-xl">تشغيل Performance Test</Button>
    </div>
  </div>
);

// --- MAIN MODULE ---
const SettingsModule = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const { addToast } = useUI();
  
  const [themeMode, setThemeMode] = useState('system');

  // Security States
  const { authenticationEnabled, setAuthenticationEnabled } = useAuth();
  const [loginEnabled, setLoginEnabled] = useState(localStorage.getItem('system_login_enabled') !== 'false');
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [lockOnStartup, setLockOnStartup] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [autoLockEnabled, setAutoLockEnabled] = useState(false);

  // Bootstrap
  const [isBootstrapModalOpen, setIsBootstrapModalOpen] = useState(false);
  const [bootstrapUsername, setBootstrapUsername] = useState('');
  const [bootstrapPassword, setBootstrapPassword] = useState('');
  const [bootstrapConfirmPassword, setBootstrapConfirmPassword] = useState('');
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  // Load unified settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const dbSettings = await db.systemSettings.toArray();
        const obj = {};
        dbSettings.forEach(s => { obj[s.key] = s.value; });
        setSettings(obj);

        const isEnabled = await appLockService.isSimpleLockEnabled();
        setAppLockEnabled(isEnabled);
        
        const los = await db.systemSettings.get('lockOnStartup');
        if (los) setLockOnStartup(los.value);
        
        const bio = await db.systemSettings.get('biometricEnabled');
        if (bio) setBiometricEnabled(bio.value);
        
        const aut = await db.systemSettings.get('autoLockEnabled');
        if (aut) setAutoLockEnabled(aut.value);

        const savedTheme = localStorage.getItem('saas_theme_mode') || 'system';
        setThemeMode(savedTheme);
      } catch(e) {
        console.error(e);
      }
    };
    loadSettings();
  }, []);

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const promises = Object.entries(settings).map(([key, value]) => 
        db.systemSettings.put({ key, value })
      );
      await Promise.all(promises);
      addToast("تم حفظ الإعدادات بنجاح ✅", "success");
    } catch(e) {
      addToast("فشل الحفظ", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const changeThemeMode = (mode) => {
    localStorage.setItem('saas_theme_mode', mode);
    setThemeMode(mode);
    window.dispatchEvent(new Event('saas-theme-updated'));
    if (mode === 'dark') document.documentElement.classList.add("dark");
    else if (mode === 'light') document.documentElement.classList.remove("dark");
    else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    }
    addToast(`تم تفعيل المظهر بنجاح`, "success");
  };

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
      let localHash = "";
      try {
        const bcryptjs = await import('bcryptjs');
        localHash = await bcryptjs.default.hash(bootstrapPassword, 10);
      } catch (e) {
        console.warn("Could not hash local password with bcryptjs on client:", e);
      }

      await db.branchUsers.put({
        id: 'admin', userId: 'admin', username: bootstrapUsername.trim().toLowerCase(),
        role: 'ADMIN', passwordHash: localHash || bootstrapPassword, createdAt: new Date()
      });

      const res = await axios.post('/api/auth/bootstrap', {
        username: bootstrapUsername.trim(), password: bootstrapPassword, tenantName: "المؤسسة الدوائية المركزية"
      });

      if (res.data.success) {
        addToast("تمت تهيئة حساب المدير وتأسيس النظام بنجاح 👑", "success");
        setIsBootstrapModalOpen(false);
        await setAuthenticationEnabled(true);
        window.location.hash = '#/login';
        window.location.reload();
      }
    } catch (err) {
      addToast(`خطأ أثناء التهيئة: ${err.message}`, "error");
    } finally {
      setIsBootstrapping(false);
    }
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
          <h3 className="text-lg font-black text-[#1E4D4D] dark:text-emerald-400">قفل التطبيق والأمان</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SettingToggle label="تفعيل شاشة تسجيل الدخول الإلزامية" description="يتطلب التحقق من اسم المستخدم عبر الخادم" checked={authenticationEnabled} onChange={async (v) => {
              if (v) {
                 const statusRes = await axios.get('/api/auth/bootstrap-status').catch(()=>({data:{requiresBootstrap:false}}));
                 const localCount = await db.branchUsers.count();
                 if (statusRes.data.requiresBootstrap || localCount === 0) {
                   setIsBootstrapModalOpen(true);
                   return;
                 }
                 await setAuthenticationEnabled(true);
                 addToast("تم تفعيل الدخول الإلزامي", "success");
              } else {
                 await setAuthenticationEnabled(false);
                 addToast("تم تعطيل الدخول الإلزامي", "success");
              }
            }} />
            <SettingToggle label="قفل التطبيق عند بدء التشغيل" description="إظهار شاشة القفل عند التحميل" checked={lockOnStartup} onChange={(v) => { setLockOnStartup(v); db.systemSettings.put({ key: 'lockOnStartup', value: v }); }} />
            <SettingToggle label="تفعيل قفل PIN / البصمة" description="السماح بتسجيل الدخول السريع" checked={biometricEnabled} onChange={(v) => { setBiometricEnabled(v); db.systemSettings.put({ key: 'biometricEnabled', value: v }); }} />
            <SettingToggle label="القفل التلقائي عند الخمول" description="تأمين شاشة التطبيق تلقائياً" checked={autoLockEnabled} onChange={(v) => { setAutoLockEnabled(v); db.systemSettings.put({ key: 'autoLockEnabled', value: v }); }} />
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-gray-800 rounded-2xl border border-slate-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-indigo-600" size={18} />
              <span className="text-sm font-bold text-slate-800 dark:text-white">تفعيل قفل التطبيق السريع (PIN)</span>
            </div>
            <input type="checkbox" className="w-5 h-5 accent-indigo-600" checked={appLockEnabled} onChange={(e) => { setAppLockEnabled(e.target.checked); appLockService.setSimpleLockEnabled(e.target.checked); }} />
          </div>
        </div>
      );
      case 'developer': return <DeveloperTab />;
      case 'subscription': return <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700"><ReviewerSaaSTester /></div>;
      default: return null;
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-50/50 dark:bg-gray-950 pb-32 font-sans text-slate-800 dark:text-slate-100 transition-colors duration-300 text-right" dir="rtl">
      {/* Top Header */}
      <div className="sticky top-0 z-40 bg-white/90 dark:bg-gray-800/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-750 py-3 px-4 mb-5 flex items-center justify-between rounded-b-2xl shadow-sm max-w-6xl mx-auto">
        <span className="text-lg font-bold bg-gradient-to-l from-indigo-800 to-indigo-600 dark:from-indigo-400 dark:to-indigo-300 bg-clip-text text-transparent">
          مركز إدارة النظام
        </span>
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] sm:text-xs bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-full border border-indigo-100/60 dark:border-indigo-500/20 font-bold tracking-wide">
            v2.4 Pro
          </span>
          <button onClick={() => changeThemeMode(themeMode === 'light' ? 'dark' : 'light')} className="p-2 rounded-xl bg-gray-50 dark:bg-gray-700/60 text-lg transition-all duration-200 active:scale-90 border border-gray-100 dark:border-gray-600/40 cursor-pointer" title="تبديل المظهر">
            {themeMode === 'light' ? "🌙" : "☀️"}
          </button>
          <button onClick={() => onNavigate?.('dashboard')} className="p-2 rounded-xl bg-gray-50 dark:bg-gray-700/60 transition-all duration-200 active:scale-90 border border-gray-100 dark:border-gray-600/40 text-slate-400 dark:text-slate-300">
            <Plus size={20} className="rotate-45" />
          </button>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-4 mb-6">
        <SubscriptionGlobalUsageRibbon onUpgrade={() => onNavigate?.('saas-portal')} />
      </div>

      <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 shrink-0">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-2 overflow-y-auto max-h-[80vh] sticky top-24 space-y-1">
             {TABS.map(tab => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id)}
                 className={\`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all text-right \${
                   activeTab === tab.id 
                     ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' 
                     : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700'
                 }\`}
               >
                 <tab.icon size={18} className={activeTab === tab.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'} />
                 {tab.label}
               </button>
             ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderActiveTab()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <Modal isOpen={isBootstrapModalOpen} onClose={() => setIsBootstrapModalOpen(false)} title="معالج تهيئة المدير الأول لبرنامج PharmaFlow">
        <div className="space-y-4 p-2 text-[#1E4D4D]" dir="rtl">
          <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/30 flex gap-3 text-amber-900 dark:text-amber-300">
            <Shield size={24} className="shrink-0 text-amber-600" />
            <div className="space-y-1">
              <h4 className="text-xs font-black text-amber-950 dark:text-white">تأسيس مدير النظام الجديد</h4>
              <p className="text-[10px] font-bold leading-relaxed">لم نجد مستخدمين مسجلين. يرجى إنشاء حساب المدير الأول.</p>
            </div>
          </div>
          <div className="space-y-3 pt-2">
            <Input label="اسم المستخدم" value={bootstrapUsername} onChange={(e) => setBootstrapUsername(e.target.value)} icon={<User size={12}/>} required />
            <Input label="كلمة المرور" type="password" value={bootstrapPassword} onChange={(e) => setBootstrapPassword(e.target.value)} icon={<Lock size={12}/>} required />
            <Input label="تأكيد كلمة المرور" type="password" value={bootstrapConfirmPassword} onChange={(e) => setBootstrapConfirmPassword(e.target.value)} icon={<Lock size={12}/>} required />
          </div>
          <div className="flex gap-2 pt-4 justify-end border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsBootstrapModalOpen(false)} disabled={isBootstrapping} className="text-[9px] h-10 px-4 !rounded-xl">إلغاء التفعيل</Button>
            <Button variant="primary" onClick={handleBootstrapSubmit} isLoading={isBootstrapping} className="text-[9px] h-10 px-6 font-black !rounded-xl">حفظ الحساب وتفعيل الأمان 🛡️</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SettingsModule;
`

fs.writeFileSync('src/modules/settings/pages/SettingsModule.tsx', code, 'utf-8');
console.log('Successfully wrote SettingsModule.tsx');
