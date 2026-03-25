
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/database';
import { AuditLogEntry } from '../types';
import { FixedSizeList as List } from 'react-window';
import { Home, Search } from 'lucide-react';

interface AuditLogModuleProps {
  onNavigate?: (view: any) => void;
}

const AuditLogModule: React.FC<AuditLogModuleProps> = ({ onNavigate }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(500);

  // Fix: Fetch logs inside useEffect since db.getAuditLogs() is async
  useEffect(() => {
    const fetchLogs = async () => {
      const allLogs = await db.getAuditLogs();
      setLogs(allLogs);
    };
    fetchLogs();
    
    const updateHeight = () => {
      if (containerRef.current) setListHeight(containerRef.current.clientHeight);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) return logs;
    const term = searchTerm.toLowerCase();
    return logs.filter(l => 
      (l.action || '').toLowerCase().includes(term) || 
      (l.target_type || '').toLowerCase().includes(term) ||
      (l.details || '').toLowerCase().includes(term)
    );
  }, [logs, searchTerm]);

  const getActionIcon = (action?: string) => {
    if (!action) return '📜';
    if (action.includes('بيع')) return '💳';
    if (action.includes('شراء')) return '🛒';
    if (action.includes('خطأ')) return '⚠️';
    if (action.includes('حذف')) return '🗑️';
    return '📜';
  };

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const log = filteredLogs[index];
    return (
      <div style={style} className="flex border-b border-slate-50 hover:bg-slate-50/50 transition-colors items-center">
        <div className="w-1/4 px-8 py-3">
          <p className="text-xs font-black text-[#1E4D4D]">{new Date(log.timestamp).toLocaleTimeString('ar-SA')}</p>
          <p className="text-[10px] font-bold text-slate-400">{new Date(log.timestamp).toLocaleDateString('ar-SA')}</p>
        </div>
        <div className="w-1/4 px-8 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base">{getActionIcon(log.action)}</span>
            <span className={`px-3 py-1 rounded-full text-[9px] font-black border transition-all bg-slate-50 text-slate-500 border-slate-100`}>
              {log.action}
            </span>
          </div>
        </div>
        <div className="w-1/4 px-8 py-3">
          <p className="text-xs font-black text-[#1E4D4D] truncate">{log.target_type}: {log.target_id}</p>
          <p className="text-[8px] font-bold text-slate-300 uppercase">USR: {log.user_id}</p>
        </div>
        <div className="w-1/4 px-8 py-3">
          <p className={`text-[10px] font-bold truncate text-slate-500`} title={log.details}>
            {log.details || '---'}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-20 text-right flex flex-col h-full overflow-hidden" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4 shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-3xl font-black text-[#1E4D4D]">سجل الرقابة والتدقيق</h2>
            <p className="text-slate-400 font-bold text-sm">تتبع الأنشطة • عرض آخر 300 سجل للأداء</p>
          </div>
          <button onClick={() => onNavigate?.('dashboard')} className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-[#1E4D4D] shadow-sm hover:bg-slate-50 transition-colors">
            <Home size={20} />
          </button>
        </div>
        <div className="relative w-full md:w-80">
          <input 
            className="w-full bg-white border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold focus:outline-none focus:border-[#1E4D4D] shadow-sm"
            placeholder="بحث في السجلات الحديثة..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
        </div>
      </div>

      <div className="bg-white mx-4 rounded-[40px] shadow-sm border border-slate-100 overflow-hidden flex flex-col flex-1">
        <div className="bg-[#F8FAFA] text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 flex shrink-0">
          <div className="w-1/4 px-8 py-4">الوقت والتاريخ</div>
          <div className="w-1/4 px-8 py-4">الحالة / العملية</div>
          <div className="w-1/4 px-8 py-4">المستهدف</div>
          <div className="w-1/4 px-8 py-4">التفاصيل</div>
        </div>
        
        <div className="flex-1 min-h-0" ref={containerRef}>
          {filteredLogs.length > 0 ? (
            <List
              height={listHeight}
              itemCount={filteredLogs.length}
              itemSize={70}
              width="100%"
              className="custom-scrollbar"
            >
              {Row}
            </List>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-300 italic font-bold">
               لا توجد سجلات حديثة حالياً
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditLogModule;
