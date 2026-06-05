import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileDown, RefreshCw, Trash2, Calendar, FileText } from 'lucide-react';

interface DraftRecoveryDialogProps {
  isOpen: boolean;
  moduleName: string;
  updatedAt: string;
  itemCount: number;
  totalAmount?: number;
  onRestore: () => void;
  onDiscard: () => void;
}

export const DraftRecoveryDialog: React.FC<DraftRecoveryDialogProps> = ({
  isOpen,
  moduleName,
  updatedAt,
  itemCount,
  totalAmount,
  onRestore,
  onDiscard
}) => {
  if (!isOpen) return null;

  const dateStr = new Date(updatedAt).toLocaleString('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-[2200] flex items-center justify-center p-4 text-slate-800 dark:text-slate-100"
        role="dialog"
        aria-modal="true"
        dir="rtl"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 450, damping: 25 }}
          className="w-full max-w-md bg-white dark:bg-gray-900 rounded-[30px] border border-slate-100 dark:border-gray-800 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top warning ribbon */}
          <div className="h-2 w-full bg-amber-500" />

          <div className="p-7 text-center">
            {/* Visual Icon Badge */}
            <div className="mx-auto w-16 h-16 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mb-5 shadow-inner">
              <FileDown size={30} className="stroke-[2.5]" />
            </div>

            <h3 className="text-lg font-black text-[#1E4D4D] dark:text-amber-400 mb-2 leading-tight">
              تم العثور على مسودة غير محفوظة 💾
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              لقد تم الاحتفاظ بنسخة حية احتياطية لجلسة العمل السابقة في <span className="font-extrabold text-[#1E4D4D] dark:text-slate-350">{moduleName}</span> لتجنب فقدان البيانات نتيجة الإغلاق المفاجئ.
            </p>

            {/* Brief info summary container */}
            <div className="bg-slate-50 dark:bg-gray-800/40 rounded-2xl p-4.5 border border-slate-100 dark:border-gray-800/60 text-right text-xs space-y-3.5 mb-6 leading-tight">
              <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
                <Calendar size={14} className="text-amber-500" />
                <span className="font-black text-slate-400">آخر تحديث تلقائي:</span>
                <span className="font-mono font-black select-all ml-auto text-slate-700 dark:text-slate-250">
                  {dateStr}
                </span>
              </div>

              <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
                <FileText size={14} className="text-amber-500" />
                <span className="font-black text-slate-400">محتويات النسخة الاحتياطية:</span>
                <span className="font-bold ml-auto text-slate-700 dark:text-slate-250">
                  {itemCount} أصناف محاسبية
                </span>
              </div>

              {totalAmount !== undefined && (
                <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-200 dark:border-gray-800 text-slate-600 dark:text-slate-300">
                  <span className="font-black text-slate-400">إجمالي الفاتورة المحفوظة:</span>
                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                    {Number(totalAmount).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Bottom actions list */}
            <div className="flex flex-col gap-2.5">
              <button
                onClick={onRestore}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white rounded-xl text-xs font-black shadow-lg shadow-amber-500/10 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={15} />
                <span>استعادة المسودة ومتابعة العمل</span>
              </button>

              <button
                onClick={onDiscard}
                className="w-full py-3 hover:bg-red-50 text-red-500 dark:hover:bg-red-950/20 active:scale-[0.98] border border-red-100 dark:border-red-950/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                <Trash2 size={14} />
                <span>إنشاء مستند جديد (حذف المسودة)</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
