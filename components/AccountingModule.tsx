
import React, { useState, useMemo, useRef, useDeferredValue, useEffect } from 'react';
import { useAccounting, useUI } from '../store/AppContext';
import { AccountingEntry } from '../types';
import { FixedSizeList as List } from 'react-window';
import { Card, Button, Modal, Badge } from './SharedUI';
import { db } from '../services/database';
import { 
  Search, Scale, FileText, LayoutList, ArrowRight, Home, 
  ChevronRight, Calendar, Hash, Info, Filter, MoreVertical,
  ArrowUpRight, ArrowDownLeft, BookOpen, Layers, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AccountingModuleProps {
  onNavigate?: (view: any) => void;
}

const AccountingModule: React.FC<AccountingModuleProps> = ({ onNavigate }) => {
  const { journalEntries } = useAccounting();
  const { currency } = useUI();
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [selectedEntry, setSelectedEntry] = useState<AccountingEntry | null>(null);
  const [showFullArchive, setShowFullArchive] = useState(false);
  const [lockedDates, setLockedDates] = useState<Record<string, boolean>>({});
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(600);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) setListHeight(containerRef.current.clientHeight);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const filteredEntries = useMemo<AccountingEntry[]>(() => {
    let baseData = (deferredSearch.trim() || showFullArchive) ? journalEntries : journalEntries.slice(0, 200);
    
    if (!deferredSearch.trim()) return baseData;
    
    const term = deferredSearch.toLowerCase();
    return journalEntries.filter(e => 
      e.sourceType.toLowerCase().includes(term) ||
      e.sourceId.toLowerCase().includes(term) ||
      e.description?.toLowerCase().includes(term) ||
      e.lines.some(l => l.accountName.toLowerCase().includes(term))
    );
  }, [journalEntries, deferredSearch, showFullArchive]);

  const stats = useMemo(() => ({
    totalVolume: journalEntries.reduce((acc, e) => acc + (e.lines.reduce((s, l) => s + l.debit, 0)), 0),
    entryCount: journalEntries.length
  }), [journalEntries]);

  useEffect(() => {
    const checkLocks = async () => {
      const dates: string[] = Array.from(new Set(filteredEntries.map(e => e.date)));
      const locks: Record<string, boolean> = {};
      for (const d of dates) {
        locks[d] = await db.isDateLocked(d);
      }
      setLockedDates(locks);
    };
    checkLocks();
  }, [filteredEntries]);

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const entry = filteredEntries[index];
    if (!entry) return null;
    const isLocked = entry.status === 'Posted' || lockedDates[entry.date];
    
    return (
      <div 
        style={style} 
        className="px-10 py-3"
      >
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-white border rounded-[40px] h-full flex items-center justify-between px-10 shadow-sm hover:shadow-xl hover:border-[#1E4D4D]/20 transition-all cursor-pointer group border-slate-100 ${isLocked ? 'bg-slate-50/30' : ''}`}
          onClick={() => setSelectedEntry(entry)}
        >
           <div className="w-1/4 min-w-0 flex items-center gap-6">
              <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-[#1E4D4D] group-hover:text-white transition-all">
                <Hash size={20} />
              </div>
              <div>
                <p className="text-xs font-black text-[#1E4D4D]">{new Date(entry.date).toLocaleDateString('ar-SA')}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">REF: {entry.sourceId}</p>
              </div>
           </div>
           
           <div className="flex-1 px-10 space-y-2 hidden lg:block border-r border-slate-50">
              {entry.lines.slice(0, 2).map((l, i) => (
                <div key={i} className="flex items-center gap-4 text-[11px] font-bold">
                   <div className={`w-2 h-2 rounded-full ${l.debit > 0 ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                   <span className="text-slate-600 truncate max-w-[180px]">{l.accountName}</span>
                   <span className={`ml-auto font-black ${l.debit > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    { (l.debit || l.credit).toLocaleString() } {currency}
                   </span>
                </div>
              ))}
           </div>

           <div className="w-1/3 text-left flex items-center justify-end gap-8">
              <div className="text-right">
                <p className="text-sm font-black text-[#1E4D4D] truncate max-w-[200px]">{entry.description}</p>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <Badge variant={entry.status === 'Posted' ? 'success' : 'neutral'} className="!rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest">
                    {entry.status === 'Posted' ? 'مرحّل نهائياً' : 'مسودة'}
                  </Badge>
                  {isLocked && <Lock size={12} className="text-slate-300" />}
                </div>
              </div>
              <div className="w-10 h-10 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center group-hover:bg-[#1E4D4D] group-hover:text-white transition-all">
                <ChevronRight size={20} />
              </div>
           </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFA] font-['Cairo'] overflow-hidden" dir="rtl">
      {/* Modern Header */}
      <header className="p-10 pb-6 shrink-0 bg-white border-b border-slate-100 z-20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10">
          <div className="flex items-center gap-8">
            <div className="w-20 h-20 bg-[#1E4D4D] text-white rounded-[32px] flex items-center justify-center shadow-2xl shadow-emerald-900/40">
              <BookOpen size={36} />
            </div>
            <div>
              <h2 className="text-4xl font-black text-[#1E4D4D] tracking-tighter leading-none">دفتر الأستاذ العام</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-[4px] mt-3 opacity-60">General Ledger & Journal Entries</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-slate-50 px-8 py-4 rounded-[24px] border border-slate-100 flex flex-col items-center justify-center">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">إجمالي حجم العمليات</p>
              <p className="text-xl font-black text-[#1E4D4D]">{stats.totalVolume.toLocaleString()} <span className="text-xs opacity-40">{currency}</span></p>
            </div>
            <button 
              onClick={() => onNavigate?.('dashboard')}
              className="w-14 h-14 bg-slate-50 text-slate-400 rounded-[20px] flex items-center justify-center hover:bg-slate-100 transition-all"
            >
              <ArrowRight size={24} />
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="relative flex-1">
            <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
            <input 
              className="w-full h-16 bg-slate-50 border border-slate-100 rounded-[24px] pr-16 pl-6 text-sm font-black focus:bg-white focus:border-[#1E4D4D] outline-none shadow-inner transition-all" 
              placeholder="ابحث في القيود، الحسابات، المراجع، أو الأوصاف..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-[24px] border border-slate-100">
            <button 
              onClick={() => setShowFullArchive(!showFullArchive)}
              className={`px-8 h-12 rounded-[18px] text-[11px] font-black transition-all flex items-center gap-3 ${showFullArchive ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Layers size={14} /> {showFullArchive ? 'الأرشيف الكامل' : 'آخر 200 قيد'}
            </button>
            <button className="w-12 h-12 bg-white text-slate-400 rounded-[18px] flex items-center justify-center hover:text-[#1E4D4D] shadow-sm">
              <Filter size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Journal List */}
      <div className="flex-1 min-h-0 bg-[#F8FAFA] pt-6" ref={containerRef}>
        {filteredEntries.length > 0 ? (
          <List
            height={listHeight}
            itemCount={filteredEntries.length}
            itemSize={100}
            width="100%"
            className="custom-scrollbar"
          >
            {Row}
          </List>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-6">
             <div className="w-32 h-32 bg-slate-100 rounded-[48px] flex items-center justify-center opacity-20">
              <FileText size={64} />
             </div>
             <p className="text-lg font-black uppercase tracking-[4px] opacity-20">لا توجد قيود مسجلة حالياً</p>
          </div>
        )}
      </div>

      {/* Entry Detail Modal */}
      <AnimatePresence>
        {selectedEntry && (
          <Modal isOpen={!!selectedEntry} onClose={() => setSelectedEntry(null)} title="تفاصيل القيد المحاسبي" noPadding>
            <div className="flex flex-col h-[80vh] font-sans" dir="rtl">
              <div className="p-10 space-y-10 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-8">
                  <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">تاريخ القيد</p>
                    <p className="text-lg font-black text-[#1E4D4D]">{new Date(selectedEntry.date).toLocaleDateString('ar-SA')}</p>
                  </div>
                  <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">المرجع / المصدر</p>
                    <p className="text-lg font-black text-[#1E4D4D]">{selectedEntry.sourceType} #{selectedEntry.sourceId}</p>
                  </div>
                </div>

                <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-4">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">البيان المحاسبي</p>
                   <p className="text-xl font-black text-[#1E4D4D] leading-relaxed">{selectedEntry.description}</p>
                </div>

                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[3px] mr-4">تفاصيل الحسابات (Double Entry)</h4>
                  <div className="bg-white border border-slate-100 rounded-[40px] overflow-hidden shadow-sm">
                    <table className="w-full text-right">
                      <thead className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <tr>
                          <th className="py-6 px-10">الحساب</th>
                          <th className="py-6 px-10 text-center">مدين (Debit)</th>
                          <th className="py-6 px-10 text-left">دائن (Credit)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {selectedEntry.lines.map((l, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-6 px-10">
                              <p className="text-sm font-black text-[#1E4D4D]">{l.accountName}</p>
                              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-1">ACC: {l.accountId}</p>
                            </td>
                            <td className="py-6 px-10 text-center text-base font-black text-red-500">
                              {l.debit > 0 ? l.debit.toLocaleString() : '-'}
                            </td>
                            <td className="py-6 px-10 text-left text-base font-black text-emerald-600">
                              {l.credit > 0 ? l.credit.toLocaleString() : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50/50 border-t border-slate-100">
                        <tr>
                          <td className="py-6 px-10 text-sm font-black text-[#1E4D4D]">الإجمالي المتوازن</td>
                          <td className="py-6 px-10 text-center text-lg font-black text-red-500">
                            {selectedEntry.lines.reduce((acc, l) => acc + l.debit, 0).toLocaleString()}
                          </td>
                          <td className="py-6 px-10 text-left text-lg font-black text-emerald-600">
                            {selectedEntry.lines.reduce((acc, l) => acc + l.credit, 0).toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              <div className="p-10 border-t border-slate-50 shrink-0 flex gap-4">
                <Button variant="neutral" className="flex-1 !rounded-2xl" onClick={() => setSelectedEntry(null)}>إغلاق</Button>
                <Button variant="primary" className="flex-1 !rounded-2xl shadow-xl" onClick={() => window.print()}>طباعة القيد</Button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AccountingModule;
