// src/components/saas/SubscriptionWidgets.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, Sparkles, CheckCircle, XCircle, ArrowUpRight, 
  Settings, CreditCard, X
} from 'lucide-react';
import { SubscriptionService, SubscriptionStatus } from '@/services/saas/subscriptionService';
import { SubscriptionContactFooter } from './SubscriptionContactFooter';

export { SubscriptionContactFooter };

/**
 * Onboarding Modal Screen
 */
export function SubscriptionOnboardingModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1000] flex items-center justify-center p-4" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="bg-white dark:bg-gray-900 rounded-[32px] border border-slate-100 dark:border-gray-800 shadow-2xl max-w-lg w-full overflow-hidden text-right p-8 relative"
        >
          {/* Decorative Sparkle Background */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button 
            onClick={onClose} 
            className="absolute top-6 left-6 w-10 h-10 flex items-center justify-center bg-slate-50 dark:bg-gray-800 hover:bg-slate-150 dark:hover:bg-gray-700 text-slate-400 rounded-full transition-all"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-500">
              <Sparkles className="animate-pulse" size={28} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">مرحباً بك في PharmaFlow Pro</h2>
              <p className="text-xs font-bold text-slate-400 mt-1">نسخة تجريبية مجانية تامة الصلاحية</p>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <p className="text-slate-600 dark:text-gray-300 text-sm leading-relaxed">
              تم إعداد بيئة العمل السحابية الموحدة الخاصة بصيدليتك بنجاح. تمنحك هذه النسخة فرصة استكشاف كافة إمكانيات PharmaFlow Pro ERP دون قيود:
            </p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-slate-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-slate-100 dark:border-gray-850">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">العمليات المجانية</span>
                <span className="text-lg font-black text-slate-800 dark:text-white">200 عملية</span>
              </div>
              <div className="bg-slate-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-slate-100 dark:border-gray-850">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">الفروع النشطة</span>
                <span className="text-lg font-black text-slate-800 dark:text-white">فرع رئيسي 1</span>
              </div>
              <div className="bg-slate-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-slate-100 dark:border-gray-850">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">المستخدمين المتاحين</span>
                <span className="text-lg font-black text-slate-800 dark:text-white">مدير نظام 1</span>
              </div>
              <div className="bg-slate-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-slate-100 dark:border-gray-850">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">فئة الدعم الفني</span>
                <span className="text-lg font-black text-slate-800 dark:text-white">أساسي عام</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-[#1E4D4D] text-white py-4 rounded-2xl font-black text-sm hover:skew-x-1 transition-all shadow-xl shadow-slate-200 dark:shadow-none flex items-center justify-center gap-2 cursor-pointer animate-pulse"
          >
            <span>ابدأ التجربة المجانية الآن</span>
            <ArrowUpRight size={16} />
          </button>

          <SubscriptionContactFooter supportNumber="+96777xxxxxxx" systemVersion="1.0.0" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

/**
 * Top Global Usage Ribbon Component
 */
export function SubscriptionGlobalUsageRibbon({ onUpgrade }: { onUpgrade: () => void }) {
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);

  const refresh = async () => {
    const s = await SubscriptionService.getSubscriptionStatus();
    setSub(s);
  };

  useEffect(() => {
    refresh();
    window.addEventListener('saas-usage-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('saas-usage-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  if (!sub || !sub.isTrial) return null;

  // Compute color states matching thresholds specified
  // 0 to 100 Transactions consumed: Emerald Green (text-emerald-500 / bg-emerald-500/10)
  // 101 to 170 Transactions consumed: Amber Orange (text-amber-500 / bg-amber-500/10)
  // 171 to 200 Transactions consumed: Crimson Red (text-rose-500 / bg-rose-500/10)
  let ribbonColors = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
  let ribbonProgressColor = "bg-emerald-500";
  if (sub.currentUsage >= 101 && sub.currentUsage <= 170) {
    ribbonColors = "text-amber-500 bg-amber-500/10 border-amber-500/20";
    ribbonProgressColor = "bg-amber-500";
  } else if (sub.currentUsage > 170) {
    ribbonColors = "text-rose-500 bg-rose-500/10 border-rose-500/20";
    ribbonProgressColor = "bg-rose-500";
  }

  const durationPercentage = (sub.currentUsage / 200) * 100;

  return (
    <div className="w-full bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800/60 px-6 py-2">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-right">
        {/* Metric Label */}
        <div className="flex items-center gap-3">
          <div className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${ribbonColors} flex items-center gap-1.5`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
            <span>التجربة المجانية</span>
          </div>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            تم استخدام: <strong className="text-slate-800 dark:text-white font-black">{sub.currentUsage}</strong> / 200 عملية 
            <span className="mx-2">|</span>
            متبقي: <strong className="text-slate-800 dark:text-white font-black">{sub.remaining}</strong> عملية
          </span>
        </div>

        {/* Progress bar visual */}
        <div className="flex-1 max-w-xs h-1 px-4 hidden md:block">
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div className={`h-full ${ribbonProgressColor} transition-all duration-300`} style={{ width: `${Math.min(100, durationPercentage)}%` }} />
          </div>
        </div>

        {/* Upgrade conversion action button */}
        <button 
          onClick={onUpgrade}
          className="flex items-center gap-1 text-[11px] font-black bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer"
        >
          <span>[ ترقية الاشتراك ]</span>
          <ArrowUpRight size={13} />
        </button>
      </div>
    </div>
  );
}

/**
 * Warning Interceptor Modal (At >= 180 and < 200 Transactions)
 */
export function SubscriptionWarningInterceptor() {
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [hasDismissed, setHasDismissed] = useState(false);

  const refresh = async () => {
    const s = await SubscriptionService.getSubscriptionStatus();
    setSub(s);
  };

  useEffect(() => {
    refresh();
    window.addEventListener('saas-usage-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('saas-usage-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  if (!sub || !sub.isWarning || hasDismissed) return null;

  return (
    <AnimatePresence>
      <div className="fixed bottom-6 left-6 z-[900] max-w-sm w-full p-1" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-amber-400 p-5 shadow-2xl text-right flex flex-col gap-3 relative overflow-hidden"
        >
          {/* Subtle colored warning border glow */}
          <div className="absolute top-0 right-0 w-3 h-full bg-amber-400" />

          <button 
            onClick={() => setHasDismissed(true)}
            className="absolute top-4 left-4 text-slate-400 hover:text-slate-600"
          >
            <X size={15} />
          </button>

          <div className="pr-2">
            <div className="flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-500">
              <ShieldAlert size={18} />
              <h4 className="text-xs font-black">تحذير: شارف مخزون العمليات على الانتهاء</h4>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-300 leading-relaxed font-bold">
              بقي لديك <strong className="text-amber-600 dark:text-amber-400 font-extrabold">{sub.remaining}</strong> عملية فقط! لضمان استمرار العمل دون توقف قم بترقية الاشتراك الآن.
            </p>
          </div>

          <div className="flex gap-2 justify-end mt-1">
            <button 
              onClick={() => {
                setHasDismissed(true);
                // Trigger navigation to SaaS upgrade tab
                window.location.hash = "#/saas-portal";
              }} 
              className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black px-4 py-2 rounded-lg transition-all cursor-pointer"
            >
              ترقية الآن
            </button>
            <button 
              onClick={() => setHasDismissed(true)} 
              className="bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-300 text-[10px] font-bold px-3 py-2 rounded-lg transition-all cursor-pointer"
            >
              لاحقاً
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

/**
 * Total Trial Blockade UI Component (At >= 200 Transactions)
 */
export function SubscriptionBlockadeBackdrop({ onUpgrade }: { onUpgrade: () => void }) {
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);

  const refresh = async () => {
    const s = await SubscriptionService.getSubscriptionStatus();
    setSub(s);
  };

  useEffect(() => {
    refresh();
    window.addEventListener('saas-usage-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('saas-usage-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  if (!sub || !sub.isBlocked) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="bg-white dark:bg-gray-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-2xl max-w-xl w-full text-right p-8 relative overflow-hidden"
      >
        {/* Warning Badge & Title inside Blockade */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/45 text-rose-500 rounded-full flex items-center justify-center animate-bounce">
            <ShieldAlert size={36} />
          </div>
        </div>

        <h3 className="text-xl font-black text-rose-600 text-center mb-2">انتهت النسخة التجريبية</h3>
        <p className="text-slate-500 dark:text-gray-400 text-xs font-bold text-center mb-6">
          لقد استخدمت 200 من 200 عملية مجانية متاحة. تم قفل عمليات التخزين لمنع المزامنة السائبة.
        </p>

        {/* Feature Matrix lists */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {/* Allowed actions check */}
          <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-900/30 rounded-2xl p-4">
            <span className="text-[11px] font-black text-emerald-600 block mb-2 font-black">العمليات المسموح بها:</span>
            <ul className="space-y-2 text-xs font-bold text-slate-600 dark:text-gray-300">
              <li className="flex items-center gap-2">
                <CheckCircle className="text-emerald-500" size={14} />
                <span>عرض البيانات والتقارير</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="text-emerald-500" size={14} />
                <span>تصدير تقارير PDF وإكسيل</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="text-emerald-500" size={14} />
                <span>إدارة حساب الصيدلية والعمال</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="text-emerald-500" size={14} />
                <span>الوصول لإدارة المدفوعات والاشتراكات</span>
              </li>
            </ul>
          </div>

          {/* Blocked Actions crosses */}
          <div className="bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100/50 dark:border-rose-900/30 rounded-2xl p-4">
            <span className="text-[11px] font-black text-rose-600 block mb-2 font-black">العمليات المحظورة (مغلقة):</span>
            <ul className="space-y-2 text-xs font-bold text-slate-600 dark:text-gray-300">
              <li className="flex items-center gap-2">
                <XCircle className="text-rose-500" size={14} />
                <span>إنشاء فواتير بيع (كاشير مبيعات)</span>
              </li>
              <li className="flex items-center gap-2">
                <XCircle className="text-rose-500" size={14} />
                <span>إدخال وتوريد مشتريات</span>
              </li>
              <li className="flex items-center gap-2">
                <XCircle className="text-rose-500" size={14} />
                <span>تحويل مخزون دوائي بين الفروع</span>
              </li>
              <li className="flex items-center gap-2">
                <XCircle className="text-rose-500" size={14} />
                <span>إثبات مرتجعات أدوية</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Action controls */}
        <div className="space-y-3">
          <button 
            onClick={() => {
              // Set plan to Business for audit demo
              SubscriptionService.setPlan('BUSINESS');
              onUpgrade();
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer"
          >
            <CreditCard size={16} />
            <span>اشترك الآن (الترقية الفورية لخطة الأعمال)</span>
          </button>
          <div className="text-center">
            <span className="text-[9px] text-slate-400 font-bold block">يرجى الضغط على الزر أعلاه لترقية الاشتراك واستئناف كافة الصلاحيات بدون توقف.</span>
          </div>
          
          <SubscriptionContactFooter supportNumber="+96777xxxxxxx" systemVersion="1.0.0" />
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Super Admin Reviewer Controller Panel
 * This exposes utility sliders to dynamically bypass, test, or trigger
 * trial states during Phase 5 verification audits! Excellent for QA validation.
 */
export function ReviewerSaaSTester() {
  const [currentPlan, setCurrentPlan] = useState('TRIAL');
  const [offsetVal, setOffsetVal] = useState(0);

  useEffect(() => {
    setOffsetVal(parseInt(localStorage.getItem('saas_demo_usage_offset') || '0', 10));
    setCurrentPlan(localStorage.getItem('saas_active_plan') || 'TRIAL');
  }, []);

  const changePlan = (p: any) => {
    setCurrentPlan(p);
    SubscriptionService.setPlan(p);
  };

  const handleOffsetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setOffsetVal(val);
    SubscriptionService.setDemoUsageOffset(val);
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-5 rounded-2xl text-right mt-6">
      <div className="flex items-center gap-2 mb-4 text-purple-600 dark:text-purple-400">
        <Settings size={18} />
        <h4 className="text-xs font-black">لوحة تحكم فحص محاكاة اشتراك SaaS لدور المراجع</h4>
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 leading-relaxed font-bold">
        صُممت هذه اللوحة خصيصاً لمراجع النظام لاختبار حالات ترخيص SaaS بشكل ديناميكي دون الحاجة إلى ملء فواتير حقيقية.
      </p>

      <div className="space-y-4">
        {/* Sliders offset */}
        <div>
          <label className="text-[11px] text-slate-600 dark:text-slate-300 font-extrabold flex justify-between">
            <span>تعديل إجمالي المعاملات المحاكية:</span>
            <span className="text-purple-600 dark:text-purple-400 font-black">{offsetVal} معاملة</span>
          </label>
          <input 
            type="range" 
            min="0" 
            max="250" 
            value={offsetVal}
            onChange={handleOffsetChange}
            className="w-full Accent-purple-600 mt-2"
          />
          <div className="flex justify-between text-[9px] text-slate-400 font-bold mt-1">
            <span>0</span>
            <span className="text-amber-500">180 (تحذير)</span>
            <span className="text-rose-500 font-black">200 (حصار)</span>
            <span>250</span>
          </div>
        </div>

        {/* Plan Selector */}
        <div>
          <span className="text-[11px] text-slate-600 dark:text-slate-300 font-extrabold block mb-2">استبدال الخطة ترخيصاً:</span>
          <div className="grid grid-cols-4 gap-2">
            {[
              { code: 'TRIAL', label: 'تجريبية' },
              { code: 'BASIC', label: 'أساسية' },
              { code: 'BUSINESS', label: 'أعمال' },
              { code: 'ENTERPRISE', label: 'مؤسسات' }
            ].map(item => (
              <button
                key={item.code}
                onClick={() => changePlan(item.code as any)}
                className={`py-2 rounded-xl text-center text-[10px] font-black transition-all ${currentPlan === item.code ? 'bg-[#1E4D4D] text-white' : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 border border-slate-100 dark:border-gray-700 hover:bg-slate-50'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Shortcuts */}
        <div className="flex justify-between items-center bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-100 dark:border-gray-750">
          <span className="text-[10px] font-bold text-slate-500">مفاتيح اختبار سريعة:</span>
          <div className="flex gap-2">
            <button 
              onClick={() => {
                setOffsetVal(182);
                SubscriptionService.setDemoUsageOffset(182);
              }}
              className="px-2 py-1 text-[9px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 rounded border border-amber-200"
            >
              شغّل تحذير (182)
            </button>
            <button 
              onClick={() => {
                setOffsetVal(203);
                SubscriptionService.setDemoUsageOffset(203);
              }}
              className="px-2 py-1 text-[9px] font-bold text-rose-700 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 rounded border border-rose-200"
            >
              شغّل كتلة (203)
            </button>
            <button 
              onClick={() => {
                setOffsetVal(0);
                SubscriptionService.setDemoUsageOffset(0);
                changePlan('TRIAL');
              }}
              className="px-2 py-1 text-[9px] font-bold text-slate-600 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 rounded border border-slate-200"
            >
              إعادة تصفير
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Centered modal shown when trial count is exceeded.
 */
export function TrialBlockedModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[3000] flex items-center justify-center p-4 text-center" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-gray-900 rounded-[32px] border border-slate-100 dark:border-gray-800 shadow-2xl max-w-md w-full overflow-hidden p-8 relative"
      >
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/45 text-rose-500 rounded-full flex items-center justify-center animate-bounce">
            <ShieldAlert size={36} />
          </div>
        </div>
        
        <h3 className="text-xl font-black text-rose-600 mb-4">انتهت النسخة التجريبية</h3>
        <p className="text-slate-700 dark:text-gray-300 text-sm font-bold leading-relaxed mb-6">
          تم الوصول للحد التجريبي 200 عملية. يرجى الاشتراك للمتابعة.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => {
              SubscriptionService.setPlan('BUSINESS');
              onClose();
              window.dispatchEvent(new Event('saas-usage-updated'));
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer"
          >
            <CreditCard size={16} />
            <span>اشترك الآن (الترقية الفورية لخطة الأعمال)</span>
          </button>

          <button
            onClick={onClose}
            className="w-full bg-slate-50 hover:bg-slate-100 dark:bg-gray-800 dark:hover:bg-gray-750 text-slate-500 dark:text-gray-300 font-black py-3 rounded-2xl text-xs cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>
      </motion.div>
    </div>
  );
}

