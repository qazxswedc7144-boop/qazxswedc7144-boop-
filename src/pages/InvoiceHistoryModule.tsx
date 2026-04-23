
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../lib/database';
import { InvoiceHistory } from '../types';
import { useUI } from '../store/AppContext';
import { useAppStore } from '../store/useAppStore';
import { Card, Badge } from '../components/SharedUI';
import { Search, History, User, Clock, ChevronRight } from 'lucide-react';

interface InvoiceHistoryModuleProps {
  onNavigate?: (view: any) => void;
}

const InvoiceHistoryModule: React.FC<InvoiceHistoryModuleProps> = ({ onNavigate }) => {
  const { version } = useUI();
  const setEditingInvoiceId = useAppStore(state => state.setEditingInvoiceId);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [historyList, setHistoryList] = useState<InvoiceHistory[]>([]);
  const [filterAction, setFilterAction] = useState<string>('ALL');

  useEffect(() => {
    const fetchHistory = async () => {
      // Fix: Await async database calls
      const allSales = await db.getSales();
      const results: InvoiceHistory[] = [];
      
      for (const sale of allSales) {
        const h = await db.getInvoiceHistory(sale.SaleID);
        if (Array.isArray(h)) results.push(...h);
      }

      // Fix: Await async database calls
      const allPurchases = await db.getPurchases();
      for (const pur of allPurchases) {
        const h = await db.getInvoiceHistory(pur.invoiceId);
        if (Array.isArray(h)) results.push(...h);
      }

      setHistoryList(results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    };
    fetchHistory();
  }, [version]);

  const filteredHistory = useMemo(() => {
    let list = [...historyList];
    if (filterAction !== 'ALL') {
      list = list.filter(h => h.action === filterAction);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(h => 
        (h.invoiceId || '').toLowerCase().includes(term) || 
        (h.userName || '').toLowerCase().includes(term) ||
        (h.details || '').toLowerCase().includes(term)
      );
    }
    return list;
  }, [historyList, searchTerm, filterAction]);

  const handleSelectRow = async (h: InvoiceHistory) => {
    setEditingInvoiceId(h.invoiceId);
    // Fix: Await async database call
    const sales = await db.getSales();
    const isSale = sales.some(s => s.SaleID === h.invoiceId);
    onNavigate?.(isSale ? 'sales' : 'purchases');
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'POSTED': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'CREATED': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'CANCELLED': return 'bg-red-50 text-red-600 border-red-100';
      default: return 'bg-amber-50 text-amber-600 border-amber-100';
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 bg-[#F8FAFA] min-h-full pb-32 animate-in fade-in duration-500" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white text-blue-600 border-2 border-slate-100 rounded-[24px] flex items-center justify-center text-3xl shadow-sm"><History size={32} /></div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-[#1E4D4D] tracking-tight">سجل تاريخ العمليات</h2>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">مراجعة تعديلات وتغييرات الفواتير</p>
          </div>
        </div>
        <button onClick={() => onNavigate?.('dashboard')} className="bg-white border border-slate-200 text-[#1E4D4D] px-8 py-4 rounded-[22px] text-xs font-black flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm">🏠 الرئيسية</button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-3 rounded-[32px] border border-slate-100 shadow-sm">
        <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100 shadow-inner">
           {['ALL', 'CREATED', 'POSTED', 'UPDATED'].map(act => (
             <button 
               key={act}
               onClick={() => setFilterAction(act)} 
               className={`px-4 py-2.5 rounded-xl text-[9px] font-black transition-all ${filterAction === act ? 'bg-[#1E4D4D] text-white shadow-md' : 'text-slate-400'}`}
             >
               {act === 'ALL' ? 'الكل' : act}
             </button>
           ))}
        </div>

        <div className="relative w-full md:w-80 group px-2">
          <input 
            type="text" 
            placeholder="بحث برقم الفاتورة أو المستخدم..." 
            className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-12 py-3.5 text-[11px] font-black focus:bg-white focus:border-blue-500 outline-none shadow-inner transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
        </div>
      </div>

      <div className="relative border-r-4 border-slate-100 pr-8 space-y-10 py-4">
        {filteredHistory.length === 0 ? (
          <div className="py-20 text-center text-slate-300 italic font-black uppercase tracking-[4px]">No History Records Found</div>
        ) : filteredHistory.map((entry, idx) => (
          <div 
            key={idx} 
            onClick={() => handleSelectRow(entry)}
            className="relative group cursor-pointer"
          >
            <div className={`absolute -right-[42px] top-4 w-5 h-5 rounded-full border-4 bg-white shadow-md z-10 transition-transform group-hover:scale-125 ${
              entry.action === 'POSTED' ? 'border-emerald-500' : 'border-blue-500'
            }`}></div>
            
            <Card className="!p-6 bg-white border-slate-50 shadow-sm hover:shadow-xl hover:translate-x-[-4px] transition-all !rounded-[32px] active:scale-[0.98]">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="space-y-3 flex-1">
                   <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black border ${getActionColor(entry.action)}`}>
                        {entry.action}
                      </span>
                      <span className="text-sm font-black text-[#1E4D4D]">فاتورة #{entry.invoiceId}</span>
                   </div>
                   <p className="text-xs font-bold text-slate-600 leading-relaxed">{entry.details}</p>
                   
                   <div className="flex items-center gap-4 pt-4 border-t border-slate-50">
                      <div className="flex items-center gap-2">
                         <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 shadow-inner"><User size={14}/></div>
                         <div>
                            <p className="text-[10px] font-black text-slate-500">{entry.userName}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 shadow-inner"><Clock size={14}/></div>
                         <div>
                            <p className="text-[10px] font-black text-slate-500">{new Date(entry.timestamp).toLocaleString('ar-SA')}</p>
                         </div>
                      </div>
                   </div>
                </div>
                <button className="w-10 h-10 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <ChevronRight size={20} />
                </button>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InvoiceHistoryModule;
