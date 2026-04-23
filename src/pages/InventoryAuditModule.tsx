
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/database';
import { AuditItem, DailyAuditTask } from '../types';

interface InventoryAuditModuleProps {
  lang: 'en' | 'ar';
  onNavigate?: (view: any) => void;
}

const InventoryAuditModule: React.FC<InventoryAuditModuleProps> = ({ lang, onNavigate }) => {
  const isAr = lang === 'ar';
  const [task, setTask] = useState<DailyAuditTask | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFinished, setIsFinished] = useState(false);

  // Fix: Fetches task using await inside useEffect
  useEffect(() => {
    const fetchTask = async () => {
      const currentTask = await db.getDailyAuditTask();
      setTask(currentTask);
      if (currentTask.completed) setIsFinished(true);
    };
    fetchTask();
  }, []);

  const handleQtyChange = async (id: string, val: string) => {
    if (!task) return;
    const qty = parseInt(val);
    const updatedItems: AuditItem[] = task.items.map(item => {
      if (item.id === id) {
        const status: 'pending' | 'matched' | 'mismatch' = isNaN(qty) ? 'pending' : (qty === item.bookQty ? 'matched' : 'mismatch');
        return { ...item, actualQty: isNaN(qty) ? undefined : qty, status };
      }
      return item;
    });
    setTask({ ...task, items: updatedItems });
    // Fix: Await saveAuditProgress
    await db.saveAuditProgress(updatedItems);
  };

  const handleReasonChange = async (id: string, reason: string) => {
    if (!task) return;
    const updatedItems: AuditItem[] = task.items.map(item => 
      item.id === id ? { ...item, reason } : item
    );
    setTask({ ...task, items: updatedItems });
    // Fix: Await saveAuditProgress
    await db.saveAuditProgress(updatedItems);
  };

  const handleFinalize = async () => {
    if (!task) return;
    const allDone = task.items.every(i => i.status !== 'pending');
    if (!allDone) {
      alert(isAr ? "يرجى إكمال جرد كافة الأصناف" : "Please complete all items");
      return;
    }
    // Fix: Await finalizeAudit
    await db.finalizeAudit(task.items);
    setIsFinished(true);
  };

  const filteredItems = useMemo(() => {
    if (!task) return [];
    if (!searchTerm.trim()) return task.items;
    const term = searchTerm.toLowerCase();
    return task.items.filter(item => item.name.toLowerCase().includes(term));
  }, [task, searchTerm]);

  if (isFinished) {
    return (
      <div className="p-10 flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in duration-500 min-h-full bg-[#F0F7F7]">
        <div className="w-32 h-32 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-6xl shadow-inner mb-4">✨</div>
        <h2 className="text-3xl font-black text-[#1E4D4D]">{isAr ? 'رائع! عمل متقن' : 'Amazing! Great Job'}</h2>
        <p className="max-w-md text-slate-500 font-bold leading-relaxed">
          {isAr 
            ? 'لقد ساهمت في الحفاظ على دقة المخزون بنسبة 100% اليوم. تم تحديث كافة السجلات وتوثيق الفوارق بنجاح.' 
            : 'You helped maintain 100% stock accuracy today. All records updated and mismatches logged successfully.'}
        </p>
        <button 
          onClick={() => onNavigate?.('dashboard')}
          className="bg-[#1E4D4D] text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:scale-105 transition-transform"
        >
          {isAr ? 'العودة للرئيسية ➦' : 'Back to Dashboard ➦'}
        </button>
      </div>
    );
  }

  const progress = task ? (task.items.filter(i => i.status !== 'pending').length / task.items.length) * 100 : 0;

  return (
    <div className="p-6 md:p-10 space-y-8 bg-[#F0F7F7] min-h-full" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
           <div className="space-y-1">
              <h2 className="text-3xl font-black text-[#1E4D4D]">{isAr ? 'مهمة الجرد اليومية' : 'Daily Auditing Task'}</h2>
              <p className="text-slate-400 text-sm font-bold">{isAr ? `${task?.items.length || 0} أصناف لضمان دقة رفوفك اليوم` : `${task?.items.length || 0} items to ensure shelf accuracy today`}</p>
           </div>
           <button 
             onClick={() => onNavigate?.('dashboard')}
             className="bg-white border border-[#1E4D4D]/20 px-4 py-2 rounded-xl text-xs font-black text-[#1E4D4D] hover:bg-[#1E4D4D] hover:text-white transition-all shadow-sm flex items-center gap-1.5"
           >
             <span className="text-sm">➦</span> {isAr ? 'الرئيسية' : 'Home'}
           </button>
        </div>
        <div className="flex flex-col gap-2 w-full md:w-64">
           <div className="w-full bg-white rounded-full h-3 p-0.5 shadow-inner border border-slate-100 overflow-hidden">
              <div className="bg-[#1E4D4D] h-full rounded-full transition-all duration-700" style={{ width: `${progress}%` }}></div>
           </div>
           <p className="text-[10px] font-black text-slate-400 text-left uppercase">{Math.round(progress)}% {isAr ? 'مكتمل' : 'Completed'}</p>
        </div>
      </div>

      <div className="relative max-w-md">
         <input 
            type="text" 
            placeholder={isAr ? 'بحث عن صنف في المهمة...' : 'Search item in task...'}
            className="w-full bg-white border border-slate-100 rounded-2xl px-5 py-3 text-xs font-black focus:outline-none focus:border-[#1E4D4D] shadow-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
         />
         <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredItems.map((item, idx) => (
          <div key={item.id} className="bg-white rounded-[40px] p-8 border-2 border-white shadow-sm flex flex-col md:flex-row items-center gap-8 transition-all hover:shadow-md">
            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-4xl shadow-inner shrink-0">
               {idx % 2 === 0 ? '💊' : '🩹'}
            </div>
            
            <div className="flex-1 text-center md:text-right">
              <h3 className="text-xl font-black text-[#1E4D4D] mb-1">{item.name}</h3>
              <div className="flex items-center justify-center md:justify-start gap-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isAr ? 'الرصيد الدفتري:' : 'Book Balance:'}</span>
                <span className="text-lg font-black text-slate-700">{item.bookQty}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full md:w-48">
              <label className="text-[10px] font-black text-[#1E4D4D] uppercase tracking-widest text-center">{isAr ? 'العدد الفعلي' : 'Actual Count'}</label>
              <input 
                type="number"
                placeholder="0"
                value={item.actualQty ?? ''}
                onChange={(e) => handleQtyChange(item.id, e.target.value)}
                className={`w-full text-center py-4 rounded-2xl text-xl font-black border-4 focus:outline-none transition-all ${
                  item.status === 'matched' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 
                  item.status === 'mismatch' ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-100 bg-slate-50 text-slate-400'
                }`}
              />
            </div>

            {item.status === 'mismatch' && (
              <div className="w-full md:w-64 animate-in slide-in-from-top-2">
                <label className="text-[10px] font-black text-red-400 uppercase tracking-widest block mb-2">{isAr ? 'سبب الفارق' : 'Reason for mismatch'}</label>
                <select 
                  className="w-full bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm font-bold text-red-700 focus:outline-none"
                  value={item.reason || ''}
                  onChange={(e) => handleReasonChange(item.id, e.target.value)}
                >
                   <option value="">-- {isAr ? 'اختر السبب' : 'Select Reason'} --</option>
                   <option value="Damage">{isAr ? 'تلف صنف' : 'Damaged Item'}</option>
                   <option value="Entry Error">{isAr ? 'خطأ في الإدخال' : 'Data Entry Error'}</option>
                   <option value="Missing">{isAr ? 'فقدان / ضياع' : 'Missing Item'}</option>
                   <option value="Expired Not Removed">{isAr ? 'منتهي لم يستبعد' : 'Expired not removed'}</option>
                </select>
              </div>
            )}
          </div>
        ))}
        {filteredItems.length === 0 && (
          <div className="py-20 text-center text-slate-300 italic font-black">
             {isAr ? 'لا توجد أصناف تطابق بحثك في مهمة اليوم' : 'No matching items in today\'s task'}
          </div>
        )}
      </div>

      <div className="pt-10 flex justify-center pb-10">
        <button 
          onClick={handleFinalize}
          disabled={progress < 100}
          className={`px-16 py-6 rounded-3xl font-black text-xl shadow-2xl transition-all active:scale-95 ${
            progress === 100 ? 'bg-[#1E4D4D] text-white hover:bg-[#2A6666]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isAr ? 'تأكيد وحفظ الجرد 🔒' : 'Confirm & Save Audit 🔒'}
        </button>
      </div>
    </div>
  );
};

export default InventoryAuditModule;
