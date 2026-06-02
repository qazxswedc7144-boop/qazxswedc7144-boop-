import React, { useEffect } from 'react';

interface SupplierBalanceAlertProps {
  balance: number;
  currency?: string;
  isVisible: boolean;
  onClose: () => void;
}

export const SupplierBalanceAlert: React.FC<SupplierBalanceAlertProps> = ({
  balance,
  currency = "YER", // ضبط العملة الافتراضية للنظام المالي اليمني
  isVisible,
  onClose
}) => {
  
  // إخفاء الإشعار تلقائياً بعد 3 ثوانٍ لمنع تكدس الواجهات
  useEffect(() => {
    if (!isVisible) {
      return () => {};
    }
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none animate-fade-in animate-duration-200">
      <div className="bg-slate-900/95 dark:bg-slate-950/95 text-slate-100 px-6 py-3 rounded-xl shadow-xl border border-slate-800 flex items-center gap-3 max-w-sm w-full pointer-events-auto justify-between font-sans" dir="rtl">
        <div className="flex items-center gap-2.5">
          {/* أيقونة معلومات زرقاء محترفة */}
          <span className="text-blue-500 bg-blue-500/10 p-1.5 rounded-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          <p className="text-sm font-medium">
            رصيد المورد الحالي: <span className="font-mono text-blue-400 font-bold">{balance.toLocaleString()}</span> {currency}
          </p>
        </div>
        
        {/* زر الإغلاق اليدوي السريع */}
        <button 
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 p-1 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
