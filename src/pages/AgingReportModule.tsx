
import React, { useState, useEffect, useMemo } from 'react';
import { useUI } from '../store/AppContext';
import { accountingService, PartnerAging } from '../services/accounting.service';
import { Card, Badge, Button } from '../components/SharedUI';
import { useSafeNavigation } from '../utils/navigation';
import { 
  History, ArrowRight, User, Search, 
  Calendar, ArrowUpRight, BarChart3, Clock,
  Filter, Download, AlertCircle, CheckCircle2,
  TrendingDown, TrendingUp
} from 'lucide-react';
import { ExportService } from '../services/exportService';
import { motion, AnimatePresence } from 'motion/react';

const AgingReportModule: React.FC<{ onNavigate?: (v: any) => void }> = ({ onNavigate }) => {
  const { currency, version } = useUI();
  const { goDashboard } = useSafeNavigation();
  const [activeTab, setActiveTab] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PartnerAging[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      goDashboard();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [goDashboard]);

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
      'الإجمالي': d.buckets.total,
      'تاريخ أقدم فاتورة': d.oldestInvoiceDate ? new Date(d.oldestInvoiceDate).toLocaleDateString('ar-EG') : '-'
    }));
    ExportService.exportToExcel(exportData, `تقرير_تعمير_${activeTab === 'CUSTOMER' ? 'العملاء' : 'الموردين'}`, Object.keys(exportData[0] || {}));
  };

  const getRiskStatus = (buckets: any) => {
    if (buckets.overdue90 > 0) return { label: 'حرج جداً', color: 'text-red-600', bg: 'bg-red-50', dot: 'bg-red-600' };
    if (buckets.overdue60 > 0 || buckets.overdue30 > 0) return { label: 'تحذير', color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-600' };
    return { label: 'آمن', color: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-600' };
  };

  const criticalPercentage = totals.grand > 0 ? ((totals.o90 + totals.o60) / totals.grand) * 100 : 0;
  const healthyPercentage = totals.grand > 0 ? (totals.current / totals.grand) * 100 : 0;
  const warningPercentage = 100 - criticalPercentage - healthyPercentage;

  return (
    <div className="flex flex-col min-h-full bg-[#F8FAFA] font-sans" dir="rtl">
      {/* Top Toolbar */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={goDashboard} 
            className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-500"
          >
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="text-sm font-black text-[#1E4D4D]">تقرير تعمير الذمم (Aging)</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">تحليل المديونيات المتأخرة</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="secondary" 
            size="sm"
            onClick={handleExport} 
            className="!py-1.5 !px-4 !text-[10px]"
            icon={<Download size={14}/>}
          >
            تصدير CSV
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto w-full">
        {/* Tabs */}
        <div className="flex bg-white p-1 rounded-xl w-fit border border-slate-100 shadow-sm mx-auto">
           <button 
             onClick={() => setActiveTab('CUSTOMER')} 
             className={`px-6 py-2 rounded-lg text-[10px] font-black transition-all ${activeTab === 'CUSTOMER' ? 'bg-[#1E4D4D] text-white shadow-md' : 'text-slate-400 hover:text-[#1E4D4D]'}`}
           >
             ذمم العملاء (عليه)
           </button>
           <button 
             onClick={() => setActiveTab('SUPPLIER')} 
             className={`px-6 py-2 rounded-lg text-[10px] font-black transition-all ${activeTab === 'SUPPLIER' ? 'bg-[#1E4D4D] text-white shadow-md' : 'text-slate-400 hover:text-[#1E4D4D]'}`}
           >
             ذمم الموردين (له)
           </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             className="bg-gradient-to-br from-emerald-50 to-white p-5 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden group"
           >
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <CheckCircle2 size={12} /> 0-30 يوم (حالي)
              </p>
              <h3 className="text-2xl font-black text-[#1E4D4D]">{totals.current.toLocaleString()} <span className="text-xs opacity-40 font-normal">{currency}</span></h3>
              <div className="mt-2 flex items-center gap-1 text-[9px] font-bold text-emerald-500">
                <TrendingDown size={10} /> مديونية حديثة
              </div>
           </motion.div>

           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.1 }}
             className="bg-gradient-to-br from-amber-50 to-white p-5 rounded-2xl border border-amber-100 shadow-sm relative overflow-hidden group"
           >
              <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Clock size={12} /> 31-90 يوم (تحذير)
              </p>
              <h3 className="text-2xl font-black text-[#1E4D4D]">{(totals.o30 + totals.o60).toLocaleString()} <span className="text-xs opacity-40 font-normal">{currency}</span></h3>
              <div className="mt-2 flex items-center gap-1 text-[9px] font-bold text-amber-500">
                <AlertCircle size={10} /> تتطلب متابعة
              </div>
           </motion.div>

           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.2 }}
             className="bg-gradient-to-br from-red-50 to-white p-5 rounded-2xl border border-red-100 shadow-sm relative overflow-hidden group"
           >
              <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
              <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <AlertCircle size={12} /> +90 يوم (خطر)
              </p>
              <h3 className="text-2xl font-black text-[#1E4D4D]">{totals.o90.toLocaleString()} <span className="text-xs opacity-40 font-normal">{currency}</span></h3>
              <div className="mt-2 flex items-center gap-1 text-[9px] font-bold text-red-500">
                <TrendingUp size={10} /> مديونية حرجة
              </div>
           </motion.div>

           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.3 }}
             className="bg-[#1E4D4D] p-5 rounded-2xl shadow-xl relative overflow-hidden group"
           >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <BarChart3 size={64} />
              </div>
              <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-2">إجمالي الذمم المستحقة</p>
              <h3 className="text-2xl font-black text-white">{totals.grand.toLocaleString()} <span className="text-xs opacity-40 font-normal">{currency}</span></h3>
              <div className="mt-2 flex items-center gap-1 text-[9px] font-bold text-white/40">
                إجمالي المبالغ غير المحصلة
              </div>
           </motion.div>
        </div>

        {/* Search Bar */}
        <div className="relative group max-w-md mx-auto">
           <input 
             type="text" 
             placeholder="بحث باسم الشريك..." 
             className="w-full bg-white border border-slate-200 rounded-xl px-12 py-3 text-[11px] font-black focus:border-[#1E4D4D] focus:ring-4 focus:ring-[#1E4D4D]/5 outline-none shadow-sm transition-all"
             value={searchTerm}
             onChange={e => setSearchTerm(e.target.value)}
           />
           <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#1E4D4D] transition-colors" />
        </div>

        {/* Data Table */}
        <Card noPadding className="shadow-xl overflow-hidden !rounded-2xl border-slate-100">
          {loading ? (
            <div className="py-32 flex flex-col items-center justify-center space-y-4">
               <div className="w-10 h-10 border-4 border-[#1E4D4D] border-t-transparent rounded-full animate-spin"></div>
               <p className="text-xs font-black text-slate-400">جاري تحليل السجلات المالية...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="py-32 text-center text-slate-300 italic font-black text-sm">لا توجد ذمم مستحقة حالياً</div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
               <table className="w-full text-right text-[11px]">
                  <thead className="bg-slate-50/50 text-slate-400 font-black border-b border-slate-100 uppercase">
                     <tr>
                        <th className="px-6 py-4">الشريك</th>
                        <th className="px-6 py-4 text-center">أقدم فاتورة</th>
                        <th className="px-6 py-4 text-center">إجمالي الدين</th>
                        <th className="px-6 py-4 text-center">الحالة</th>
                        <th className="px-6 py-4 text-left">التفاصيل</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {filteredData.map(d => {
                       const risk = getRiskStatus(d.buckets);
                       return (
                        <tr key={d.partnerId} className="hover:bg-slate-50/50 transition-all group">
                           <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg ${risk.bg} ${risk.color} flex items-center justify-center font-black text-xs`}>
                                  {d.partnerName.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-black text-[#1E4D4D]">{d.partnerName}</p>
                                  <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">ID: {d.partnerId.split('-')[0]}</span>
                                </div>
                              </div>
                           </td>
                           <td className="px-6 py-4 text-center font-bold text-slate-500">
                             {d.oldestInvoiceDate ? new Date(d.oldestInvoiceDate).toLocaleDateString('ar-EG') : '-'}
                           </td>
                           <td className="px-6 py-4 text-center font-black text-[#1E4D4D]">
                             {d.buckets.total.toLocaleString()} <span className="text-[9px] opacity-30 font-normal">{currency}</span>
                           </td>
                           <td className="px-6 py-4 text-center">
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black inline-flex items-center gap-1.5 ${risk.bg} ${risk.color}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${risk.dot}`}></div>
                                {risk.label}
                              </span>
                           </td>
                           <td className="px-6 py-4 text-left">
                             <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               <div className="flex flex-col items-end">
                                 <span className="text-[8px] text-slate-400 font-bold">+90: {d.buckets.overdue90.toLocaleString()}</span>
                                 <span className="text-[8px] text-slate-400 font-bold">0-30: {d.buckets.current.toLocaleString()}</span>
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
      </div>

      {/* Footer Legend & Progress */}
      <div className="mt-auto bg-white border-t border-slate-100 p-4 space-y-4">
        <div className="max-w-4xl mx-auto space-y-3">
          {/* Progress Bar */}
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
            <div 
              className="h-full bg-emerald-500 transition-all duration-1000" 
              style={{ width: `${healthyPercentage}%` }}
              title={`Healthy: ${healthyPercentage.toFixed(1)}%`}
            ></div>
            <div 
              className="h-full bg-amber-500 transition-all duration-1000" 
              style={{ width: `${warningPercentage}%` }}
              title={`Warning: ${warningPercentage.toFixed(1)}%`}
            ></div>
            <div 
              className="h-full bg-red-600 transition-all duration-1000" 
              style={{ width: `${criticalPercentage}%` }}
              title={`Critical: ${criticalPercentage.toFixed(1)}%`}
            ></div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-6 items-center">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-[10px] font-black text-slate-400">ديون حديثة (Financial Safety)</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <span className="text-[10px] font-black text-slate-400">ديون قيد المتابعة (Warning)</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
                <span className="text-[10px] font-black text-slate-400">ديون حرجة (Immediate Action)</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgingReportModule;
