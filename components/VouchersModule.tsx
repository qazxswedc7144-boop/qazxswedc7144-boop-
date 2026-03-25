
import React, { useState, useMemo, useEffect } from 'react';
import { accountingService } from '../services/accounting.service';
import { CashFlow } from '../types';
import { useUI } from '../store/AppContext';
import { useAppStore } from '../store/useAppStore';
import PrintMenu from './PrintMenu';
import { 
  Search, X
} from 'lucide-react';

interface VouchersModuleProps {
  onNavigate?: (view: any) => void;
}

const VouchersModule: React.FC<VouchersModuleProps> = ({ onNavigate }) => {
  const { version, refreshGlobal } = useUI();
  const systemStatus = useAppStore(state => state.systemStatus);
  const isRecovery = systemStatus === 'RECOVERY_MODE';
  const [vType, setVType] = useState<'دخل' | 'خرج'>('دخل');
  const [searchTerm, setSearchTerm] = useState('');
  const [history, setHistory] = useState<CashFlow[]>([]);
  const [form, setForm] = useState({
    name: '',
    amount: '',
    category: 'نثرية',
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const fetchHistory = async () => {
      const data = await accountingService.getCashFlow();
      setHistory(data.filter(h => h.notes?.includes('سند')));
    };
    fetchHistory();
  }, [version]);

  const handleSave = async () => {
    if (isRecovery) return;
    if (!form.name || !form.amount) {
      alert("يرجى إكمال البيانات الأساسية");
      return;
    }
    
    try {
      await accountingService.recordVoucher(
        vType,
        form.name,
        parseFloat(form.amount),
        form.category,
        form.notes
      );

      alert(`تم حفظ سند ${vType === 'دخل' ? 'القبض' : 'الصرف'} بنجاح`);
      setForm({ name: '', amount: '', category: 'نثرية', notes: '', date: new Date().toISOString().split('T')[0] });
      
      const data = await accountingService.getCashFlow();
      setHistory(data.filter(h => h.notes?.includes('سند')));
      refreshGlobal();
    } catch (err: any) {
      alert(err.message || "فشل الحفظ");
    }
  };

  const filteredHistory = useMemo(() => {
    if (!searchTerm.trim()) return history;
    const term = searchTerm.toLowerCase();
    return history.filter(h => {
       const isNoteMatch = h.notes?.toLowerCase().includes(term);
       const isCategoryMatch = h.category.toLowerCase().includes(term);
       const isAmountMatch = h.amount.toString().includes(term);
       const isDateMatch = h.date.includes(term);
       return isNoteMatch || isCategoryMatch || isAmountMatch || isDateMatch;
    });
  }, [history, searchTerm]);

  return (
    <div className="p-4 md:p-8 space-y-8 pb-24" dir="rtl">
      <div className="flex items-center justify-between bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#1E4D4D] text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg">🧾</div>
            <div>
               <h2 className="text-xl md:text-2xl font-black text-[#1E4D4D]">سندات القبض والصرف</h2>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">إدارة التحويلات النقدية والعهدة</p>
            </div>
         </div>
         <button onClick={() => onNavigate?.('dashboard')} className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-[#1E4D4D] text-xl font-black hover:bg-slate-100 transition-colors">➦</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-white rounded-[40px] p-8 shadow-sm border border-slate-100 space-y-8 h-fit lg:sticky lg:top-8">
          <div className="flex p-1.5 bg-[#F8FAFA] rounded-3xl border border-slate-100">
             <button 
               disabled={isRecovery}
               onClick={() => setVType('دخل')} 
               className={`flex-1 py-4 rounded-2xl font-black text-sm transition-all ${vType === 'دخل' ? 'bg-emerald-600 text-white shadow-xl' : 'text-slate-400 hover:text-emerald-600'} ${isRecovery ? 'opacity-50 grayscale' : ''}`}
             >سند قبض 📥</button>
             <button 
               disabled={isRecovery}
               onClick={() => setVType('خرج')} 
               className={`flex-1 py-4 rounded-2xl font-black text-sm transition-all ${vType === 'خرج' ? 'bg-red-500 text-white shadow-xl' : 'text-slate-400 hover:text-red-500'} ${isRecovery ? 'opacity-50 grayscale' : ''}`}
             >سند صرف 📤</button>
          </div>

          <div className="space-y-5">
             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mr-1">يصرف لـ / يستلم من</label>
                <input 
                  disabled={isRecovery}
                  className="w-full bg-[#F8FAFA] border-2 border-slate-50 rounded-2xl px-5 py-4 font-black text-[#1E4D4D] focus:outline-none focus:border-[#1E4D4D] transition-all"
                  placeholder="الاسم الكامل للجهة..."
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                />
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mr-1">المبلغ (AED)</label>
                   <input 
                     disabled={isRecovery}
                     type="number"
                     className="w-full bg-[#F8FAFA] border-2 border-slate-50 rounded-2xl px-5 py-4 font-black text-[#1E4D4D] text-center text-xl"
                     placeholder="0.00"
                     value={form.amount}
                     onChange={e => setForm({...form, amount: e.target.value})}
                   />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mr-1">التاريخ</label>
                   <input 
                     disabled={isRecovery}
                     type="date"
                     className="w-full bg-[#F8FAFA] border-2 border-slate-50 rounded-2xl px-3 py-4 font-black text-slate-600 text-xs"
                     value={form.date}
                     onChange={e => setForm({...form, date: e.target.value})}
                   />
                </div>
             </div>
             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mr-1">البيان والتفاصيل</label>
                <textarea 
                  disabled={isRecovery}
                  className="w-full bg-[#F8FAFA] border-2 border-slate-50 rounded-2xl px-5 py-4 font-bold text-slate-700 h-28 focus:outline-none focus:border-[#1E4D4D] transition-all"
                  placeholder="اكتب سبب العملية المالية هنا..."
                  value={form.notes}
                  onChange={e => setForm({...form, notes: e.target.value})}
                />
             </div>
          </div>

          <button 
            disabled={isRecovery}
            onClick={handleSave}
            className={`w-full py-5 rounded-[24px] font-black text-lg text-white shadow-2xl transition-all active:scale-95 ${vType === 'دخل' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100' : 'bg-red-500 hover:bg-red-600 shadow-red-100'} ${isRecovery ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
          >{isRecovery ? 'وضع التعافي ⚠️' : 'إتمام العملية وحفظ السند ✨'}</button>
        </div>

        <div className="lg:col-span-2 bg-white rounded-[40px] p-8 shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full min-h-[600px]">
           <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
              <div>
                <h3 className="text-xl font-black text-[#1E4D4D]">أرشيف السندات</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">مراجعة العمليات المالية السابقة</p>
              </div>
              
              <div className="relative w-full md:w-80 group">
                <input 
                   type="text" 
                   placeholder="ابحث بالاسم، المبلغ، أو الفئة..." 
                   className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-12 py-3.5 text-xs font-black focus:outline-none focus:border-[#1E4D4D] focus:bg-white shadow-inner transition-all group-hover:border-slate-200"
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl opacity-30 group-focus-within:opacity-100 transition-opacity">🔍</span>
              </div>
           </div>
           
           <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2 flex-1 pb-4">
              {filteredHistory.map(h => (
                <div key={h.transaction_id} className="flex flex-col sm:flex-row items-center justify-between p-6 bg-[#F8FAFA] border border-slate-50 rounded-[32px] hover:bg-white hover:shadow-xl transition-all group relative overflow-hidden">
                   <div className="flex items-center gap-6 w-full sm:w-auto">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm shrink-0 transition-transform group-hover:scale-110 ${h.type === 'دخل' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                        {h.type === 'دخل' ? '📥' : '📤'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-black text-[#1E4D4D] truncate group-hover:text-black transition-colors">
                          {h.notes?.split('|')[0].replace('سند قبض لـ: ', '').replace('سند صرف لـ: ', '') || 'سند مالي غير معنون'}
                        </h4>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5">
                          <span className="text-[10px] font-black text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-100">
                             📅 {new Date(h.date).toLocaleDateString('ar-SA')}
                          </span>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${h.type === 'دخل' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                             {h.category}
                          </span>
                        </div>
                      </div>
                   </div>
                   
                   <div className="text-center sm:text-left mt-4 sm:mt-0 w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-100">
                      <p className={`text-2xl font-black ${h.type === 'دخل' ? 'text-emerald-600' : 'text-red-500'} mb-2`}>
                        {h.type === 'دخل' ? '+' : '-'}{h.amount.toLocaleString()} <span className="text-xs font-normal opacity-40">AED</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <PrintMenu data={h} type="VOUCHER" />
                        <button 
                          disabled={isRecovery}
                          onClick={async () => {
                            if (isRecovery) return;
                            if (window.confirm('هل أنت متأكد من حذف هذا السند؟ سيتم عكس كافة القيود المالية المرتبطة به.')) {
                              try {
                                await accountingService.deleteVoucher(h.transaction_id);
                                alert('تم حذف السند بنجاح ✅');
                                refreshGlobal();
                              } catch (e: any) {
                                alert(`فشل الحذف: ${e.message}`);
                              }
                            }
                          }}
                          className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                          title="حذف السند"
                        >
                          <X size={16} />
                        </button>
                      </div>
                   </div>
                   
                   <div className={`absolute -right-4 -bottom-4 w-12 h-12 rounded-full opacity-5 transition-transform group-hover:scale-[3] ${h.type === 'دخل' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                </div>
              ))}
              
              {filteredHistory.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                   <div className="text-5xl opacity-20">📂</div>
                   <p className="text-slate-400 font-black italic">الأرشيف فارغ حالياً</p>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default VouchersModule;
