
import React, { useState, useEffect, useMemo } from 'react';
import { useUI } from '../store/AppContext';
import { accountingService, PartnerAging } from '../services/accounting.service';
import { Card, Badge, Button } from './SharedUI';
import { 
  History, ArrowRight, User, Search, 
  Calendar, ArrowUpRight, BarChart3, Clock,
  Filter, Download
} from 'lucide-react';
import { ExportService } from '../services/exportService';

const AgingReportModule: React.FC<{ onNavigate?: (v: any) => void }> = ({ onNavigate }) => {
  const { currency, version } = useUI();
  const [activeTab, setActiveTab] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PartnerAging[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadAging = async () => {
      setLoading(true);
      try {
        const report = await accountingService.getAgingReport(activeTab);
        setData(report);
      } finally {
        setLoading(false);
      }
    };
    loadAging();
  }, [activeTab, version]);

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(d => d.partnerName.toLowerCase().includes(term) || d.partnerId.toLowerCase().includes(term));
  }, [data, searchTerm]);

  const totals = useMemo(() => {
    const t = { current: 0, o30: 0, o60: 0, o90: 0, grand: 0 };
    data.forEach(d => {
      t.current += d.buckets.current;
      t.o30 += d.buckets.overdue30;
      t.o60 += d.buckets.overdue60;
      t.o90 += d.buckets.overdue90;
      t.grand += d.buckets.total;
    });
    return t;
  }, [data]);

  const handleExport = () => {
    const exportData = filteredData.map(d => ({
      'الاسم': d.partnerName,
      '0-30 يوم': d.buckets.current,
      '31-60 يوم': d.buckets.overdue30,
      '61-90 يوم': d.buckets.overdue60,
      '+90 يوم': d.buckets.overdue90,
      'الإجمالي': d.buckets.total
    }));
    ExportService.exportToExcel(exportData, `تقرير_تعمير_${activeTab === 'CUSTOMER' ? 'العملاء' : 'الموردين'}`, Object.keys(exportData[0] || {}));
  };

  return (
    <div className="p-4 md:p-8 space-y-6 bg-[#F8FAFA] min-h-full pb-32 animate-in fade-in" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-[#1E4D4D] text-white rounded-[20px] flex items-center justify-center text-2xl shadow-xl"><Clock size={24} /></div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-[#1E4D4D]">تقرير تعمير الذمم (Aging)</h2>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">تحليل المديونيات المتأخرة حسب المدة الزمنية</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExport} icon={<Download size={16}/>}>تصدير CSV</Button>
          <button onClick={() => onNavigate?.('dashboard')} className="w-10 h-10 bg-white border border-slate-200 text-[#1E4D4D] rounded-xl flex items-center justify-center shadow-sm active:scale-90 transition-all"><ArrowRight size={20} /></button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex bg-white p-1.5 rounded-[22px] w-fit border border-slate-100 shadow-sm">
         <button onClick={() => setActiveTab('CUSTOMER')} className={`px-8 py-3 rounded-2xl text-[11px] font-black transition-all ${activeTab === 'CUSTOMER' ? 'bg-[#1E4D4D] text-white shadow-xl' : 'text-slate-400 hover:text-[#1E4D4D]'}`}>ذمم العملاء (عليه)</button>
         <button onClick={() => setActiveTab('SUPPLIER')} className={`px-8 py-3 rounded-2xl text-[11px] font-black transition-all ${activeTab === 'SUPPLIER' ? 'bg-[#1E4D4D] text-white shadow-xl' : 'text-slate-400 hover:text-[#1E4D4D]'}`}>ذمم الموردين (له)</button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
         <Card className="!p-5 border-r-4 border-emerald-500">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">0-30 يوم (حالي)</p>
            <h3 className="text-lg font-black text-emerald-600">{totals.current.toLocaleString()} <span className="text-[8px] opacity-40">{currency}</span></h3>
         </Card>
         <Card className="!p-5 border-r-4 border-blue-500">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">31-60 يوم</p>
            <h3 className="text-lg font-black text-blue-600">{totals.o30.toLocaleString()} <span className="text-[8px] opacity-40">{currency}</span></h3>
         </Card>
         <Card className="!p-5 border-r-4 border-amber-500">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">61-90 يوم</p>
            <h3 className="text-lg font-black text-amber-600">{totals.o60.toLocaleString()} <span className="text-[8px] opacity-40">{currency}</span></h3>
         </Card>
         <Card className="!p-5 border-r-4 border-red-500">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">+90 يوم (خطر)</p>
            <h3 className="text-lg font-black text-red-600">{totals.o90.toLocaleString()} <span className="text-[8px] opacity-40">{currency}</span></h3>
         </Card>
         <Card className="!p-5 bg-[#1E4D4D] text-white">
            <p className="text-[9px] font-black opacity-60 uppercase tracking-widest mb-1">إجمالي الذمم</p>
            <h3 className="text-xl font-black">{totals.grand.toLocaleString()} <span className="text-[8px] opacity-40">AED</span></h3>
         </Card>
      </div>

      {/* Search and Table */}
      <div className="space-y-4">
        <div className="relative group max-w-md">
           <input 
             type="text" 
             placeholder="بحث باسم الشريك..." 
             className="w-full bg-white border border-slate-100 rounded-2xl px-12 py-3.5 text-[11px] font-black focus:border-[#1E4D4D] outline-none shadow-sm transition-all"
             value={searchTerm}
             onChange={e => setSearchTerm(e.target.value)}
           />
           <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
        </div>

        <Card noPadding className="shadow-xl overflow-hidden !rounded-[32px] border-slate-100">
          {loading ? (
            <div className="py-32 flex flex-col items-center justify-center space-y-4">
               <div className="w-10 h-10 border-4 border-[#1E4D4D] border-t-transparent rounded-full animate-spin"></div>
               <p className="text-xs font-black text-slate-400">جاري تحليل السجلات المالية...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="py-32 text-center opacity-30 italic font-black">لا توجد ذمم مستحقة حالياً</div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
               <table className="w-full text-right text-[10px]">
                  <thead className="bg-[#F8FAFA] text-slate-400 font-black border-b border-slate-50 uppercase">
                     <tr>
                        <th className="px-8 py-5">الاسم / المعرف</th>
                        <th className="px-6 py-5 text-center">0-30 يوم</th>
                        <th className="px-6 py-5 text-center">31-60 يوم</th>
                        <th className="px-6 py-5 text-center">61-90 يوم</th>
                        <th className="px-6 py-5 text-center font-black text-red-600">+90 يوم</th>
                        <th className="px-8 py-5 text-left bg-slate-50/50">الإجمالي</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {filteredData.map(d => (
                        <tr key={d.partnerId} className="hover:bg-slate-50 transition-all group">
                           <td className="px-8 py-5">
                              <p className="font-black text-[#1E4D4D]">{d.partnerName}</p>
                              <span className="text-[8px] font-bold text-slate-300">ID: {d.partnerId.split('-')[0]}</span>
                           </td>
                           <td className="px-6 py-5 text-center font-bold text-emerald-600">{d.buckets.current.toLocaleString() || '-'}</td>
                           <td className="px-6 py-5 text-center font-bold text-blue-600">{d.buckets.overdue30.toLocaleString() || '-'}</td>
                           <td className="px-6 py-5 text-center font-bold text-amber-600">{d.buckets.overdue60.toLocaleString() || '-'}</td>
                           <td className="px-6 py-5 text-center font-black text-red-600">{d.buckets.overdue90.toLocaleString() || '-'}</td>
                           <td className="px-8 py-5 text-left font-black text-[#1E4D4D] bg-slate-50/30 text-xs">
                              {d.buckets.total.toLocaleString()} <span className="text-[9px] opacity-30 font-normal">{currency}</span>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          )}
        </Card>
      </div>

      {/* Legend / Info */}
      <div className="flex flex-wrap gap-6 items-center px-4">
         <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-[9px] font-black text-slate-400">ديون حديثة (مستوى أمان عالي)</span>
         </div>
         <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-[9px] font-black text-slate-400">ديون حرجة (تتطلب إجراء فوري)</span>
         </div>
      </div>
    </div>
  );
};

export default AgingReportModule;
