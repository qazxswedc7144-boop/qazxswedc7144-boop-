import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Printer, PlusCircle, ArrowRight, ShieldCheck, Eye } from 'lucide-react';

interface SaveSuccessModalProps {
  isOpen: boolean;
  invoiceNumber: string;
  totalAmount: number;
  currency: string;
  type: 'SALE' | 'PURCHASE';
  date?: string;
  partnerName?: string;
  accountingStatus?: string;
  inventoryStatus?: string;
  balanceStatus?: string;
  onClose: () => void;
  onNewInvoice: () => void;
  onViewInvoice?: () => void;
}

export const SaveSuccessModal: React.FC<SaveSuccessModalProps> = ({
  isOpen,
  invoiceNumber,
  totalAmount,
  currency,
  type,
  date,
  partnerName,
  accountingStatus = 'مرحل ومقفل بنجاح',
  inventoryStatus = 'محدث ومقفل بالكامل',
  balanceStatus = 'محدث بالكامل',
  onClose,
  onNewInvoice,
  onViewInvoice
}) => {
  if (!isOpen) return null;

  const displayDate = date || new Date().toISOString().split('T')[0];
  const displayPartner = partnerName || (type === 'SALE' ? 'عميل كاشير عام' : 'مورد غير محدد');

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-[2200] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        dir="rtl"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 450, damping: 25 }}
          className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-[32px] border border-slate-100 dark:border-gray-800 shadow-2xl overflow-hidden text-center"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top colored visual bar representing high-integrity ERP system state */}
          <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-[#1E4D4D]" />

          <div className="p-8">
            {/* Pulsing Emerald Success Badge */}
            <div className="relative mx-auto w-20 h-20 mb-6 flex items-center justify-center">
              <motion.div 
                className="absolute inset-0 bg-emerald-100 dark:bg-emerald-900/20 rounded-full"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <div className="relative w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 size={36} className="stroke-[2.5]" />
              </div>
            </div>

            <h3 className="text-xl font-black text-[#1E4D4D] dark:text-emerald-400 mb-1 leading-tight flex items-center justify-center gap-2">
              <ShieldCheck size={22} className="text-emerald-500" />
              <span>تم حفظ المستند المحاسبي بنجاح ✅</span>
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold mb-6">
              تم تدوين الحركة وتدقيقها محاسبياً ومستودعياً وفق القيد المزدوج السيادي.
            </p>

            {/* Comprehensive Detail Table 2.0 to deliver professional ERP audit values */}
            <div className="bg-slate-50 dark:bg-gray-800/50 rounded-2xl border border-slate-100 dark:border-gray-800/80 p-5 space-y-3 text-right text-xs mb-6">
              
              <div className="flex justify-between items-center py-1.5 border-b border-dashed border-slate-200 dark:border-gray-800">
                <span className="font-extrabold text-slate-400">رقم الفاتورة:</span>
                <span className="font-mono font-black text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-gray-850 px-2.5 py-1 rounded-md">
                  #{invoiceNumber}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-dashed border-slate-200 dark:border-gray-800">
                <span className="font-extrabold text-slate-400">نوع العملية والتاريخ:</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400">
                  {type === 'SALE' ? 'مبيعات نقدية' : 'توريد مشتريات'} — <span className="font-mono text-slate-500">{displayDate}</span>
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-dashed border-slate-200 dark:border-gray-800">
                <span className="font-extrabold text-slate-400">الطرف الآخر (العميل/المورد):</span>
                <span className="font-black text-slate-600 dark:text-slate-300">
                  {displayPartner}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-dashed border-slate-200 dark:border-gray-800">
                <span className="font-extrabold text-slate-400">القيمة المالية الإجمالية:</span>
                <span className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400">
                  {Number(totalAmount).toLocaleString()} {currency}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-dashed border-slate-200 dark:border-gray-800">
                <span className="font-extrabold text-slate-400">القيد والترحيل العام (Ledger):</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  {accountingStatus}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-dashed border-slate-200 dark:border-gray-800">
                <span className="font-extrabold text-slate-400">المخزون والتبويب (Inventory):</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  {inventoryStatus}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5">
                <span className="font-extrabold text-slate-400">الأرصدة المعدلة (Balance):</span>
                <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-indigo-500" />
                  {balanceStatus}
                </span>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="flex flex-col gap-3">
              <button
                onClick={onNewInvoice}
                className="w-full py-4 bg-[#1E4D4D] text-white hover:bg-[#153636] rounded-2xl text-xs font-black shadow-lg shadow-emerald-990/10 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <PlusCircle size={15} />
                <span>إنشاء مستند جديد [فارغ]</span>
              </button>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    window.print();
                  }}
                  className="py-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 dark:bg-gray-800 dark:hover:bg-gray-750 dark:border-gray-750 rounded-2xl text-[11px] font-black text-slate-600 dark:text-slate-300 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <Printer size={16} className="text-[#1E4D4D] dark:text-emerald-400" />
                  <span>طباعة فورية</span>
                </button>

                {onViewInvoice && (
                  <button
                    onClick={onViewInvoice}
                    className="py-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 dark:bg-gray-800 dark:hover:bg-gray-750 dark:border-gray-750 rounded-2xl text-[11px] font-black text-slate-600 dark:text-slate-300 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
                  >
                    <Eye size={16} className="text-indigo-500" />
                    <span>عرض المستند</span>
                  </button>
                )}

                <button
                  onClick={onClose}
                  className={`py-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 dark:bg-gray-800 dark:hover:bg-gray-750 dark:border-gray-750 rounded-2xl text-[11px] font-black text-slate-600 dark:text-slate-300 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 ${onViewInvoice ? '' : 'col-span-2'}`}
                >
                  <ArrowRight size={16} className="text-slate-500" />
                  <span>لوحة المعالجة</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
