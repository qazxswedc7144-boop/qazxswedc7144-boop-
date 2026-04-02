
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

  const flattenedLines = useMemo(() => {
    const lines: any[] = [];
    let runningBalance = 0;
    
    // Sort entries by date
    const sortedEntries = [...journalEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sortedEntries.forEach(entry => {
      entry.lines.forEach(line => {
        // Simple balance calculation: Debit increases, Credit decreases (or vice versa depending on account type)
        // For a general ledger view, we'll just show the net impact or a simple running total
        runningBalance += (line.debit - line.credit);
        
        lines.push({
          ...line,
          date: entry.date,
          description: entry.description,
          sourceId: entry.sourceId,
          sourceType: entry.sourceType,
          status: entry.status,
          runningBalance
        });
      });
    });
    
    // Reverse for display (newest first)
    return lines.reverse();
  }, [journalEntries]);

  const filteredLines = useMemo(() => {
    let baseData = (deferredSearch.trim() || showFullArchive) ? flattenedLines : flattenedLines.slice(0, 500);
    
    if (!deferredSearch.trim()) return baseData;
    
    const term = deferredSearch.toLowerCase();
    return flattenedLines.filter(l => 
      l.accountName.toLowerCase().includes(term) ||
      l.description?.toLowerCase().includes(term) ||
      l.sourceId.toLowerCase().includes(term) ||
      l.accountId.toLowerCase().includes(term)
    );
  }, [flattenedLines, deferredSearch, showFullArchive]);

  const stats = useMemo(() => ({
    totalVolume: journalEntries.reduce((acc, e) => acc + (e.lines.reduce((s, l) => s + l.debit, 0)), 0),
    entryCount: journalEntries.length
  }), [journalEntries]);

  useEffect(() => {
    const checkLocks = async () => {
      const dates: string[] = Array.from(new Set(filteredLines.map(l => l.date)));
      const locks: Record<string, boolean> = {};
      for (const d of dates) {
        locks[d] = await db.isDateLocked(d);
      }
      setLockedDates(locks);
    };
    checkLocks();
  }, [filteredLines]);

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const line = filteredLines[index];
    if (!line) return null;
    
    // Find original entry for modal
    const findEntry = () => {
      const entry = journalEntries.find(e => e.id === line.entryId || e.entry_id === line.entryId);
      if (entry) setSelectedEntry(entry);
    };
    
    return (
      <div 
        style={style} 
        className="px-0"
      >
        <motion.div 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border-b border-slate-100 h-full flex items-center px-3 hover:bg-slate-50/80 transition-all group cursor-pointer"
          onClick={findEntry}
        >
          <div className="w-[12%] px-3">
            <p className="text-[11px] font-black text-[#1E4D4D]">{new Date(line.date).toLocaleDateString('ar-SA')}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">REF: {line.sourceId}</p>
          </div>

          <div className="w-[20%] px-3">
            <p className="text-[11px] font-black text-[#1E4D4D] truncate">{line.accountName}</p>
            <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-0.5">ACC: {line.accountId}</p>
          </div>

          <div className="flex-1 px-3">
            <p className="text-[11px] font-bold text-slate-500 truncate">{line.description}</p>
          </div>

          <div className="w-[15%] px-3 text-center">
            {line.credit > 0 ? (
              <div className="flex items-center justify-center gap-1 text-emerald-600">
                <span className="text-[12px] font-black">{line.credit.toLocaleString()}</span>
                <ArrowUpRight size={14} className="stroke-[3px]" />
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1 text-red-500">
                <span className="text-[12px] font-black">{line.debit.toLocaleString()}</span>
                <ArrowDownLeft size={14} className="stroke-[3px]" />
              </div>
            )}
          </div>

          <div className="w-[15%] px-3 text-left">
            <p className={`text-[12px] font-black ${line.runningBalance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {line.runningBalance.toLocaleString()} <span className="text-[9px] opacity-40">{currency}</span>
            </p>
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFA] font-['Cairo'] overflow-hidden" dir="rtl">
      {/* Modern Header - Row 1 & 2 */}
      <header className="shrink-0 bg-white border-b border-slate-100 z-20">
        {/* Row 1: Back Button & Centered Titles */}
        <div className="px-6 py-4 flex items-center relative border-b border-slate-50">
          <div className="absolute right-6">
            <button 
              onClick={() => onNavigate?.('dashboard')}
              className="w-10 h-10 bg-slate-50 text-[#1E4D4D] rounded-xl flex items-center justify-center border border-slate-100 hover:bg-slate-100 transition-all"
              title="العودة"
            >
              <ArrowRight size={20} />
            </button>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <h2 className="text-2xl font-black text-[#1E4D4D] tracking-tighter leading-tight">دفتر الأستاذ العام</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[2px] mt-1 opacity-60">GENERAL LEDGER & JOURNAL ENTRIES</p>
          </div>
        </div>

        {/* Row 2: Search & Filters */}
        <div className="px-6 py-4 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
            <input 
              className="w-full h-12 bg-slate-50 border border-slate-100 rounded-[16px] pr-14 pl-6 text-sm font-black focus:bg-white focus:border-[#1E4D4D] outline-none shadow-inner transition-all" 
              placeholder="ابحث في القيود، الحسابات، المراجع، أو الأوصاف..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-[16px] border border-slate-100">
            <button 
              onClick={() => setShowFullArchive(!showFullArchive)}
              className={`px-6 h-9 rounded-[12px] text-[10px] font-black transition-all flex items-center gap-2 ${showFullArchive ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Layers size={12} /> {showFullArchive ? 'الأرشيف الكامل' : 'آخر 200 قيد'}
            </button>
            <button className="w-9 h-9 bg-white text-slate-400 rounded-[12px] flex items-center justify-center hover:text-[#1E4D4D] shadow-sm">
              <Filter size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Row 3: Table Header - Sticky */}
      <div className="px-0 bg-white border-b border-slate-200 flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0 sticky top-0 z-10">
        <div className="w-[12%] px-6 py-4">التاريخ</div>
        <div className="w-[20%] px-6 py-4">اسم الحساب</div>
        <div className="flex-1 px-6 py-4">البيان / الوصف</div>
        <div className="w-[15%] px-6 py-4 text-center">(دائن/مدين)</div>
        <div className="w-[15%] px-6 py-4 text-left">الرصيد</div>
      </div>

      {/* Journal List - Full Width & Full Height */}
      <div className="flex-1 min-h-0 bg-white border-x border-slate-100" ref={containerRef}>
        {filteredLines.length > 0 ? (
          <List
            height={listHeight}
            itemCount={filteredLines.length}
            itemSize={64}
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

      {/* Stats Card - Bottom Left */}
      <div className="fixed bottom-10 left-10 z-50">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#1E4D4D] text-white p-6 rounded-[32px] shadow-2xl shadow-emerald-900/40 border border-white/10 flex flex-col items-center min-w-[200px]"
        >
          <p className="text-[10px] font-black text-emerald-200/60 uppercase tracking-widest mb-2">إجمالي حجم العمليات</p>
          <p className="text-2xl font-black">{stats.totalVolume.toLocaleString()} <span className="text-xs opacity-40">{currency}</span></p>
        </motion.div>
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
