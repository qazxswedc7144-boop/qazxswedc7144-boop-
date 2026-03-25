
import React, { useState, useEffect, useMemo } from 'react';
import { AuditRepository } from '../repositories/AuditRepository';
import { FinancialAuditEntry } from '../types';
import { useUI } from '../store/AppContext';
import { Card, Badge, Button } from './SharedUI';
import { 
  History, Search, Filter, ArrowRight, User, 
  Clock, Database, ArrowUpRight, ChevronRight,
  ShieldCheck, AlertCircle, FileText, Trash2, Plus,
  Lock
} from 'lucide-react';

interface AuditHistoryModuleProps {
  onNavigate?: (view: any) => void;
  recordId?: string; 
  tableName?: string;
}

const AuditHistoryModule: React.FC<AuditHistoryModuleProps> = ({ onNavigate, recordId, tableName }) => {
  const { version } = useUI();
  const [logs, setLogs] = useState<FinancialAuditEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'ADD' | 'UPDATE' | 'DELETE'>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAuditLogs = async () => {
      setLoading(true);
      try {
        let allLogs: FinancialAuditEntry[] = [];
        if (recordId) {
          allLogs = await AuditRepository.getByRecord(recordId);
        } else {
          allLogs = await AuditRepository.getAll();
        }
        
        if (tableName) {
          allLogs = allLogs.filter(log => log.Table_Name === tableName);
        }

        setLogs(allLogs);
      } finally {
        setLoading(false);
      }
    };
    fetchAuditLogs();
  }, [version, recordId, tableName]);

  const filteredLogs = useMemo(() => {
    let list = [...logs];
    if (filterType !== 'ALL') {
      list = list.filter(l => l.Change_Type === filterType);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(l => 
        (l.Record_ID || '').toLowerCase().includes(term) || 
        (l.Modified_By || '').toLowerCase().includes(term) ||
        (l.Column_Name || '').toLowerCase().includes(term)
      );
    }
    return list;
  }, [logs, searchTerm, filterType]);

  const getActionStyles = (type: string) => {
    switch (type) {
      case 'ADD': return { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: <Plus size={14}/>, label: 'إضافة سجل' };
      case 'UPDATE': return { bg: 'bg-blue-50', text: 'text-blue-600', icon: <History size={14}/>, label: 'تحديث بيانات' };
      case 'DELETE': return { bg: 'bg-red-50', text: 'text-red-600', icon: <Trash2 size={14}/>, label: 'حذف نهائي' };
      default: return { bg: 'bg-slate-50', text: 'text-slate-400', icon: <FileText size={14}/>, label: 'عملية نظام' };
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 bg-[#F8FAFA] min-h-full pb-32 animate-in fade-in" dir="rtl">
      {/* Header - Immutable Security Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-slate-900 text-white rounded-[24px] flex items-center justify-center text-3xl shadow-xl border-4 border-emerald-950">
             <ShieldCheck size={32} className="text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl md:text-3xl font-black text-[#1E4D4D] tracking-tight">سجل الرقابة النهائية</h2>
              <div className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                <Lock size={12} className="text-slate-400" />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Immutable Logs</span>
              </div>
            </div>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest flex items-center gap-2 mt-1">
               <Database size={12}/> {recordId ? `تاريخ تدقيق المستند: #${recordId}` : 'الأرشيف المركزي غير القابل للتلاعب'}
            </p>
          </div>
        </div>
        {!recordId && (
          <button onClick={() => onNavigate?.('dashboard')} className="bg-white border border-slate-200 text-[#1E4D4D] px-8 py-4 rounded-[22px] text-xs font-black flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm active:scale-95">
             <ArrowRight size={20} /> الرئيسية
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-2 rounded-[32px] border border-slate-100 shadow-sm">
        <div className="flex p-1 bg-slate-50 rounded-[26px] w-fit overflow-x-auto no-scrollbar gap-1">
          {(['ALL', 'ADD', 'UPDATE', 'DELETE'] as const).map(type => (
            <button 
              key={type} 
              onClick={() => setFilterType(type)} 
              className={`px-8 py-3 rounded-2xl text-[11px] font-black transition-all whitespace-nowrap ${filterType === type ? 'bg-white text-[#1E4D4D] shadow-md' : 'text-slate-400 hover:text-[#1E4D4D]'}`}
            >
              {type === 'ALL' ? 'الكل' : type === 'ADD' ? 'الإضافة' : type === 'UPDATE' ? 'التعديلات' : 'الحذف'}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-80 group px-2">
          <input type="text" placeholder="بحث بالمرجع أو المسؤول..." className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-12 py-3 text-[11px] font-black focus:bg-white focus:border-slate-900 shadow-inner transition-all outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <Search size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300" />
        </div>
      </div>

      <Card noPadding className="shadow-2xl border-slate-100 overflow-hidden !rounded-[44px] bg-white">
        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center space-y-4">
             <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accessing Sealed Logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-32 text-center opacity-30 italic font-black uppercase tracking-[4px]">No Integrity Logs Captured</div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-right text-[11px]">
              <thead className="bg-[#F8FAFA] text-slate-400 font-black uppercase border-b-2 border-slate-100">
                <tr>
                  <th className="px-8 py-6">العملية</th>
                  <th className="px-8 py-6">المصدر / الحقل</th>
                  <th className="px-8 py-6">قبل (Before)</th>
                  <th className="px-8 py-6">بعد (After)</th>
                  <th className="px-8 py-6">المسؤول / الوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredLogs.map(log => {
                  const styles = getActionStyles(log.Change_Type);
                  return (
                    <tr key={log.Log_ID} className="hover:bg-slate-50 transition-all group border-r-4 border-transparent hover:border-r-slate-200">
                      <td className="px-8 py-6">
                         <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-black text-[9px] ${styles.bg} ${styles.text}`}>
                            {styles.icon} {styles.label}
                         </div>
                      </td>
                      <td className="px-8 py-6">
                         <div className="space-y-1">
                            <p className="font-black text-slate-800 text-sm">#{log.Record_ID}</p>
                            <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1 uppercase">
                               <FileText size={10}/> {log.Table_Name} <ChevronRight size={8}/> {log.Column_Name}
                            </p>
                         </div>
                      </td>
                      <td className="px-8 py-6">
                         <div className="max-w-[180px] truncate bg-slate-50 px-3 py-2 rounded-xl text-slate-400 font-bold border border-slate-100 shadow-inner italic">
                            {log.Old_Value || 'NULL'}
                         </div>
                      </td>
                      <td className="px-8 py-6">
                         <div className={`max-w-[180px] truncate px-3 py-2 rounded-xl font-black border-2 ${log.Change_Type === 'DELETE' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                            {log.New_Value}
                         </div>
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                               <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center text-[10px] font-black shadow-sm">
                                  {log.Modified_By.charAt(0).toUpperCase()}
                               </div>
                               <span className="font-black text-slate-700">{log.Modified_By.split('@')[0]}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400 font-bold">
                               <Clock size={10}/>
                               <span className="text-[10px]">{new Date(log.Modified_At).toLocaleString('ar-SA')}</span>
                            </div>
                         </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="flex items-center gap-4 bg-[#1E4D4D]/5 p-6 rounded-[32px] border-2 border-dashed border-[#1E4D4D]/20">
         <ShieldCheck className="text-[#1E4D4D] shrink-0" size={28} />
         <p className="text-[11px] font-bold text-[#1E4D4D] leading-relaxed">
            نظام الرقابة السيادي: كافة السجلات المعروضة هنا هي سجلات "نهائية" يتم توثيقها لحظة وقوع الحركة في قاعدة البيانات. 
            يمنع النظام برمجياً أي محاولة لتعديل أو حذف هذه الأسطر لضمان الشفافية المطلقة والمطابقة المحاسبية المستمرة.
         </p>
      </div>
    </div>
  );
};

export default AuditHistoryModule;
