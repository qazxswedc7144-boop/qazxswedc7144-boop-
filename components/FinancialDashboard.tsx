import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getLiveMetrics } from '../src/core/reports/liveDashboard';
import { accountingService } from '../services/accounting.service';
import { analyticsEngine } from '../services/analyticsEngine';
import { useUI } from '../store/AppContext';
import { Card, Badge } from './SharedUI';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend, 
  Filler 
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { 
  TrendingUp, TrendingDown, Users, Truck, Activity, 
  ArrowUpRight, BarChart3, ShieldCheck, Lock, Clock, Info,
  Zap, Snail, Skull, Wallet2, DollarSign, ArrowDownCircle, CreditCard
} from 'lucide-react';

// تسجيل المكونات المطلوبة لـ Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const FinancialDashboard: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  const { version, currency } = useUI();
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [chartData, setChartData] = useState<any>(null);
  const [inventoryStats, setInventoryStats] = useState<any[]>([]);

  // ⚡ REALTIME LIVE QUERY ⚡
  // Reacts automatically to any change in the IndexedDB 'accounts' table
  const metrics = useLiveQuery(async () => {
    return await getLiveMetrics();
  }, [], {
    cash: 0,
    revenue: 0,
    expenses: 0,
    netProfit: 0,
    receivables: 0,
    payables: 0,
    timestamp: new Date().toISOString()
  });

  useEffect(() => {
    const loadDashboardAnalyticData = async () => {
      setLoadingAnalytics(true);
      try {
        const [c, movement] = await Promise.all([
          accountingService.getChartAnalyticsAsync(30),
          analyticsEngine.getProductMovementAnalysis(30)
        ]);

        setChartData(c);
        setInventoryStats(movement);
      } catch (err) {
        console.error("Analytic data failed to load", err);
      } finally {
        setLoadingAnalytics(false);
      }
    };

    loadDashboardAnalyticData();
  }, [version]);

  const topSelling = useMemo(() => (inventoryStats || []).slice(0, 5), [inventoryStats]);
  const slowMoving = useMemo(() => 
    (inventoryStats || []).filter(i => i.velocity === 'Slow' || i.velocity === 'Dead').slice(0, 5), 
  [inventoryStats]);

  const chartConfig = useMemo(() => {
    if (!chartData || !chartData.revenue || !chartData.expense) return null;
    return {
      labels: chartData.labels || [],
      datasets: [
        {
          label: 'الأرباح التشغيلية',
          data: chartData.revenue.map((r: number, i: number) => r - (chartData.expense[i] || 0)),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0
        }
      ]
    };
  }, [chartData]);

  return (
    <div className="space-y-8 pb-32 animate-in fade-in" dir="rtl">
      {/* Realtime Banner */}
      <div className="bg-slate-900 text-white p-4 rounded-[28px] flex items-center justify-between shadow-xl">
         <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-emerald-400">
               <ShieldCheck size={24} />
            </div>
            <div>
               <h2 className="text-sm font-black tracking-tight">لوحة الرقابة المالية اللحظية (Reactive Dashboard)</h2>
               <p className="text-[10px] opacity-60 font-bold uppercase tracking-widest">تحديث تلقائي عبر Dexie LiveQuery & Supabase Realtime</p>
            </div>
         </div>
         <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
            <span className="text-[9px] font-black text-emerald-400 uppercase">Realtime Active</span>
         </div>
      </div>

      {/* KPI Section - Reactive Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <Card className="!p-6 border-r-8 border-[#1E4D4D] group hover:scale-[1.02] transition-transform">
            <div className="flex justify-between items-start mb-4">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">السيولة الصندوقية (Cash)</p>
               <Wallet2 className="text-[#1E4D4D] opacity-20" size={20} />
            </div>
            <h3 className="text-2xl font-black text-[#1E4D4D]">{(metrics?.cash || 0).toLocaleString()} <span className="text-xs opacity-40 font-bold uppercase">{currency}</span></h3>
            <div className="mt-4 flex items-center gap-2">
               <Badge variant="success">لحظي</Badge>
            </div>
         </Card>

         <Card className="!p-6 border-r-8 border-emerald-500 group hover:scale-[1.02] transition-transform shadow-lg">
            <div className="flex justify-between items-start mb-4">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إجمالي الإيرادات</p>
               <DollarSign className="text-emerald-500 opacity-20" size={20} />
            </div>
            <h3 className="text-2xl font-black text-[#1E4D4D]">{(metrics?.revenue || 0).toLocaleString()} <span className="text-xs opacity-40 font-bold uppercase">{currency}</span></h3>
            <div className="mt-4 flex items-center gap-2">
               <TrendingUp size={12} className="text-emerald-500" />
               <span className="text-[10px] font-black text-emerald-600">تحديث مباشر</span>
            </div>
         </Card>

         <Card className="!p-6 border-r-8 border-red-500 group hover:scale-[1.02] transition-transform">
            <div className="flex justify-between items-start mb-4">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إجمالي المصروفات</p>
               <ArrowDownCircle className="text-red-500 opacity-30" size={20} />
            </div>
            <h3 className="text-2xl font-black text-[#1E4D4D]">{(metrics?.expenses || 0).toLocaleString()} <span className="text-xs opacity-40 font-bold uppercase">{currency}</span></h3>
            <div className="mt-4 flex items-center gap-2 text-red-500">
               <span className="text-[10px] font-black">تشغيلي</span>
            </div>
         </Card>

         <Card className="!p-6 bg-gradient-to-br from-[#1E4D4D] to-[#0d2121] text-white overflow-hidden relative group hover:scale-[1.02] transition-transform shadow-2xl">
            <div className="relative z-10">
               <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-4">صافي الأرباح اللحظية</p>
               <h3 className="text-2xl font-black">{(metrics?.netProfit || 0).toLocaleString()} <span className="text-xs opacity-40 font-bold uppercase">{currency}</span></h3>
               <div className="mt-4 flex items-center gap-2">
                  <Activity size={12} className="text-emerald-400" />
                  <span className="text-[10px] font-black text-emerald-400">Net Profit</span>
               </div>
            </div>
            <Activity className="absolute -right-4 -bottom-4 text-white opacity-5 group-hover:scale-110 transition-transform" size={100} />
         </Card>
      </div>

      {/* Second Row KPIs - Receivables & Payables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="!p-6 border-r-8 border-blue-600 group hover:scale-[1.02] transition-transform">
           <div className="flex justify-between items-start mb-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ذمم العملاء (مدين)</p>
              <Users className="text-blue-600 opacity-20" size={20} />
           </div>
           <h3 className="text-2xl font-black text-[#1E4D4D]">{(metrics?.receivables || 0).toLocaleString()} <span className="text-xs opacity-40 font-bold uppercase">{currency}</span></h3>
           <div className="mt-4 flex items-center gap-2">
              <Badge variant="info">أصول متداولة</Badge>
           </div>
        </Card>

        <Card className="!p-6 border-r-8 border-amber-500 group hover:scale-[1.02] transition-transform">
           <div className="flex justify-between items-start mb-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">مستحقات الموردين (دائن)</p>
              <Truck className="text-amber-500 opacity-20" size={20} />
           </div>
           <h3 className="text-2xl font-black text-[#1E4D4D]">{(metrics?.payables || 0).toLocaleString()} <span className="text-xs opacity-40 font-bold uppercase">{currency}</span></h3>
           <div className="mt-4 flex items-center gap-2">
              <Badge variant="warning">التزامات قائمة</Badge>
           </div>
        </Card>
      </div>

      {/* Main Charts & Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-8 space-y-8">
            <Card className="h-96 !p-8">
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                     <BarChart3 className="text-emerald-500" size={24} />
                     <h3 className="text-lg font-black text-[#1E4D4D]">منحنى الربحية التشغيلية (30 يوم)</h3>
                  </div>
                  <Badge variant="neutral">Analytics Update</Badge>
               </div>
               <div className="h-64">
                  {chartConfig && (
                    <Line 
                      data={chartConfig} 
                      options={{ 
                        responsive: true, 
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { 
                          x: { grid: { display: false }, ticks: { font: { size: 9, weight: 'bold' } } },
                          y: { ticks: { font: { size: 9, weight: 'bold' } } }
                        }
                      }} 
                    />
                  )}
               </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <Card noPadding className="shadow-xl overflow-hidden !rounded-[32px] border-slate-100">
                  <div className="bg-emerald-50 px-6 py-4 flex items-center justify-between border-b border-emerald-100">
                     <h4 className="text-xs font-black text-emerald-800 uppercase tracking-widest flex items-center gap-2">
                        <Zap size={14} /> الأصناف الأكثر مبيعاً
                     </h4>
                     <Badge variant="success">Power Items</Badge>
                  </div>
                  <div className="divide-y divide-slate-50">
                     {topSelling.map((item, idx) => (
                        <div key={idx} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                           <div className="min-w-0">
                              <p className="text-xs font-black text-slate-700 truncate">{item.product?.Name}</p>
                              <p className="text-[9px] font-bold text-slate-400">مباع: {item.soldQty} وحدة</p>
                           </div>
                           <p className="text-xs font-black text-emerald-600">{(item.revenue || 0).toLocaleString()}</p>
                        </div>
                     ))}
                     {topSelling.length === 0 && <div className="p-10 text-center text-slate-300 italic text-xs">لا توجد بيانات حركة كافية</div>}
                  </div>
               </Card>

               <Card noPadding className="shadow-xl overflow-hidden !rounded-[32px] border-slate-100">
                  <div className="bg-amber-50 px-6 py-4 flex items-center justify-between border-b border-amber-100">
                     <h4 className="text-xs font-black text-amber-800 uppercase tracking-widest flex items-center gap-2">
                        <Skull size={14} /> مخزون راكد (Slow Moving)
                     </h4>
                     <Badge variant="warning">Cash Trap</Badge>
                  </div>
                  <div className="divide-y divide-slate-50">
                     {slowMoving.map((item, idx) => (
                        <div key={idx} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                           <div className="min-w-0">
                               <p className="text-xs font-black text-slate-700 truncate">{item.product?.Name}</p>
                               <p className="text-[9px] font-bold text-slate-400">المخزون: {item.product?.StockQuantity}</p>
                           </div>
                           <span className={`w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 text-slate-400`}>
                              {item.velocity === 'Dead' ? <Skull size={14}/> : <Snail size={14}/>}
                           </span>
                        </div>
                     ))}
                     {slowMoving.length === 0 && <div className="p-10 text-center text-slate-300 italic text-xs">كافة الأصناف تتحرك بمعدل جيد</div>}
                  </div>
               </Card>
            </div>
         </div>

         <div className="lg:col-span-4 space-y-8">
            <Card className="!p-8 space-y-6">
               <h3 className="text-sm font-black text-[#1E4D4D] border-b border-slate-50 pb-4 flex items-center gap-2">
                  <Activity size={18} className="text-blue-500" /> تحليل السيولة اللحظي
               </h3>
               <div className="space-y-6">
                  <div className="flex justify-between items-center">
                     <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">المبيعات الكلية</p>
                        <p className="text-lg font-black text-emerald-600">{(metrics?.revenue || 0).toLocaleString()}</p>
                     </div>
                     <ArrowUpRight className="text-emerald-500 opacity-20" size={32} />
                  </div>
                  <div className="flex justify-between items-center">
                     <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">المصاريف الكلية</p>
                        <p className="text-lg font-black text-red-500">{(metrics?.expenses || 0).toLocaleString()}</p>
                     </div>
                     <TrendingDown className="text-red-500 opacity-20" size={32} />
                  </div>
               </div>
               
               <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-start gap-3">
                     <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                     <p className="text-[10px] font-bold text-slate-500 leading-relaxed">تحديث البيانات يتم بشكل لحظي بمجرد حدوث أي حركة مالية في النظام أو مزامنة سحابية.</p>
                  </div>
               </div>
            </Card>

            <Card className="bg-slate-900 text-white !p-10 space-y-8 !rounded-[48px] shadow-2xl">
               <div className="space-y-2">
                  <h3 className="text-xl font-black">نزاهة السجلات (Audit)</h3>
                  <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">Realtime Verification</p>
               </div>
               <div className="p-6 bg-white/5 rounded-3xl border border-white/10 flex items-center gap-4">
                  <Lock className="text-emerald-400" size={24} />
                  <p className="text-[11px] font-bold leading-relaxed opacity-80">
                      يتم تتبع كافة التغييرات المالية عبر سجل الرقابة اللحظي لضمان عدم التلاعب.
                  </p>
               </div>
               <div className="flex justify-center py-4 opacity-30">
                  <ShieldCheck size={100} />
               </div>
            </Card>
         </div>
      </div>
    </div>
  );
};

export default FinancialDashboard;
