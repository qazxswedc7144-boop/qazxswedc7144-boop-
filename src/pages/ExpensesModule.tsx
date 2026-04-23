
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../lib/database';
import { CashFlow } from '../types';

interface ExpensesModuleProps {
  lang: 'en' | 'ar';
  onNavigate?: (view: any) => void;
}

const ExpensesModule: React.FC<ExpensesModuleProps> = ({ lang, onNavigate }) => {
  const isAr = lang === 'ar';
  const [searchTerm, setSearchTerm] = useState('');
  const [history, setHistory] = useState<CashFlow[]>([]);
  const [formData, setFormData] = useState({
    amount: '',
    type: 'خرج' as 'دخل' | 'خرج',
    category: 'مصاريف تشغيلية',
    notes: ''
  });

  // Fix: Fetch history in useEffect since db.getCashFlow() is async
  useEffect(() => {
    const fetchHistory = async () => {
      const data = await db.getCashFlow();
      setHistory(data);
    };
    fetchHistory();
  }, []);

  const categories = {
    'دخل': isAr ? ['مبيعات', 'استرداد', 'أخرى'] : ['Sales', 'Refund', 'Other'],
    'خرج': isAr ? ['إيجار', 'رواتب', 'كهرباء ومياه', 'صيانة', 'مشتريات', 'أخرى'] : ['Rent', 'Salaries', 'Utilities', 'Maintenance', 'Purchases', 'Other']
  };

  const handleSave = async () => {
    if (!formData.amount || !formData.category) return;
    const id = db.generateId('CF');
    const entry: CashFlow = {
      id,
      transaction_id: id,
      date: new Date().toISOString(),
      type: formData.type,
      category: formData.category,
      name: formData.category, // Use category as name for expenses
      amount: parseFloat(formData.amount),
      notes: formData.notes,
      branchId: 'MAIN'
    };
    await db.recordCashFlow(entry);
    alert(isAr ? 'تم تسجيل العملية المالية بنجاح' : 'Financial transaction recorded!');
    setFormData({ amount: '', type: 'خرج', category: 'مصاريف تشغيلية', notes: '' });
    // Refresh history
    const data = await db.getCashFlow();
    setHistory(data);
  };
  
  const filteredHistory = useMemo(() => {
    if (!searchTerm.trim()) return history;
    const term = searchTerm.toLowerCase();
    return history.filter(tx => 
      tx.category.toLowerCase().includes(term) || 
      (tx.notes && tx.notes.toLowerCase().includes(term))
    );
  }, [history, searchTerm]);

  return (
    <div className="p-4 md:p-8 space-y-10 animate-in fade-in duration-500" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg">💸</div>
          <h2 className="text-3xl font-black text-[#1E4D4D]">{isAr ? 'التدفق النقدي' : 'Cash Flow Manager'}</h2>
        </div>
        <button onClick={() => onNavigate?.('dashboard')} className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-[#1E4D4D] text-xl font-black shadow-sm hover:bg-slate-50 transition-colors">➦</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm space-y-6 h-fit sticky top-8">
          <h3 className="text-xl font-black text-[#1E4D4D] mb-4">{isAr ? 'تسجيل عملية جديدة' : 'New Transaction'}</h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#1E4D4D] uppercase tracking-widest">{isAr ? 'نوع العملية' : 'Transaction Type'}</label>
              <select 
                className="w-full bg-[#F8FAFA] border-2 border-[#E0EAEA] rounded-2xl px-4 py-4 font-black focus:outline-none focus:border-amber-500 transition-all appearance-none text-lg"
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value as 'دخل' | 'خرج'})}
              >
                <option value="دخل">💰 {isAr ? 'دخل' : 'Income'}</option>
                <option value="خرج">💸 {isAr ? 'خرج' : 'Expense'}</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#1E4D4D] uppercase tracking-widest">{isAr ? 'الفئة' : 'Category'}</label>
              <select 
                className="w-full bg-[#F8FAFA] border-2 border-[#E0EAEA] rounded-2xl px-4 py-4 font-bold focus:outline-none focus:border-amber-500 transition-all"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
              >
                {categories[formData.type].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#1E4D4D] uppercase tracking-widest">{isAr ? 'المبلغ' : 'Amount'}</label>
              <input 
                type="number"
                className="w-full bg-[#F8FAFA] border-2 border-[#E0EAEA] rounded-2xl px-4 py-4 font-black text-xl focus:outline-none focus:border-amber-500 transition-all"
                placeholder="0.00"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#1E4D4D] uppercase tracking-widest">{isAr ? 'ملاحظات' : 'Notes'}</label>
              <textarea 
                className="w-full bg-[#F8FAFA] border-2 border-[#E0EAEA] rounded-2xl px-4 py-4 font-bold h-24 focus:outline-none focus:border-amber-500 transition-all"
                placeholder={isAr ? 'تفاصيل إضافية...' : 'Additional details...'}
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
              />
            </div>
          </div>

          <button 
            onClick={handleSave}
            className="w-full bg-[#1E4D4D] text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-emerald-100 hover:scale-[1.02] active:scale-95 transition-all"
          >
            {isAr ? 'تأكيد وحفظ 💾' : 'Confirm & Save 💾'}
          </button>
        </div>

        <div className="lg:col-span-2 bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
            <h3 className="text-xl font-black text-[#1E4D4D]">{isAr ? 'سجل العمليات الأخيرة' : 'Recent Ledger'}</h3>
            <div className="relative w-full sm:w-64">
              <input 
                type="text" 
                placeholder={isAr ? 'بحث في السجل...' : 'Search ledger...'}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2 text-xs font-bold focus:outline-none focus:border-amber-500 shadow-inner"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
            </div>
          </div>

          <div className="space-y-4 max-h-[700px] overflow-y-auto custom-scrollbar flex-1">
            {filteredHistory.length === 0 ? (
              <div className="py-20 text-center text-slate-300 italic font-black">
                {isAr ? 'لا توجد عمليات تطابق بحثك' : 'No matching transactions found.'}
              </div>
            ) : (
              filteredHistory.map(tx => (
                <div key={tx.transaction_id} className="flex items-center justify-between p-6 bg-[#F8FAFA] border border-slate-50 rounded-3xl hover:bg-white hover:shadow-md transition-all">
                  <div className="flex items-center gap-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${tx.type === 'دخل' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      {tx.type === 'دخل' ? '↓' : '↑'}
                    </div>
                    <div>
                      <h4 className="font-black text-[#1E4D4D]">{tx.category}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                        {new Date(tx.date).toLocaleDateString('ar-SA')} {tx.notes && `• ${tx.notes}`}
                      </p>
                    </div>
                  </div>
                  <div className={`text-xl font-black ${tx.type === 'دخل' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {tx.type === 'دخل' ? '+' : '-'}{tx.amount.toLocaleString()} <span className="text-xs opacity-60">د.إ</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpensesModule;
