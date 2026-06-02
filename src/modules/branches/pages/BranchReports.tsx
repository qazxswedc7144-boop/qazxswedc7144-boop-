// src/modules/branches/pages/BranchReports.tsx

import React, { useState, useEffect } from 'react';
import { BranchService } from '../services/BranchService';
import { Branch } from '@/types';
import { useUI } from '@/contexts/AppContext';
import { 
  PieChart as PieChartIcon, TrendingUp, Sparkles, AlertTriangle, 
  Package, DollarSign, Wallet2, RefreshCw, Zap
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

export const BranchReports: React.FC = () => {
  const { addToast, currency } = useUI();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);

  // Scoped metrics and AI predictions
  const [reportMetrics, setReportMetrics] = useState({
    inventoryValue: 0,
    totalSales: 0,
    totalProfit: 0,
    lowStockCount: 0,
    itemsProcessed: 0
  });

  const [aiPredictions, setAiPredictions] = useState<{
    lowStockPredictions: any[];
    demandForecasts: any[];
    autoReorders: any[];
  }>({
    lowStockPredictions: [],
    demandForecasts: [],
    autoReorders: []
  });

  const loadBranches = async () => {
    try {
      const data = await BranchService.getBranches();
      setBranches(data);
    } catch {
      addToast("خطأ أثناء جلب قائمة الفروع", "error");
    }
  };

  const calculateReportData = async () => {
    setIsLoading(true);
    try {
      const metrics = await BranchService.getBranchScopedReports(selectedBranchId);
      setReportMetrics(metrics);

      // Load predictions for target branch (or use MAIN if ALL is selected)
      const targetBranchId = selectedBranchId === "ALL" ? "BRH-MAIN-001" : selectedBranchId;
      const predictions = await BranchService.generateAIInventoryPredictions(targetBranchId);
      setAiPredictions(predictions);
    } catch {
      addToast("فشل تجميع مستند التقارير للفروع", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    calculateReportData();
  }, [selectedBranchId]);

  // Chart data simulation matching specific branches
  const chartSalesData = [
    { name: 'يناير', 'المبيعات': reportMetrics.totalSales * 0.7, 'الأرباح': reportMetrics.totalProfit * 0.7 },
    { name: 'فبراير', 'المبيعات': reportMetrics.totalSales * 0.8, 'الأرباح': reportMetrics.totalProfit * 0.8 },
    { name: 'مارس', 'المبيعات': reportMetrics.totalSales * 0.9, 'الأرباح': reportMetrics.totalProfit * 0.9 },
    { name: 'أبريل', 'المبيعات': reportMetrics.totalSales * 1.0, 'الأرباح': reportMetrics.totalProfit * 1.0 },
    { name: 'مايو', 'المبيعات': reportMetrics.totalSales * 1.15, 'الأرباح': reportMetrics.totalProfit * 1.15 }
  ];

  const pieData = branches.map((b, i) => {
    const val = i === 0 ? 124000 : i === 1 ? 67000 : 32000;
    return {
      name: b.name.replace("فرع صيدلية بلسم", "").trim(),
      value: selectedBranchId === "ALL" ? val : (selectedBranchId === b.id ? reportMetrics.inventoryValue : 0)
    };
  }).filter(item => item.value > 0);

  const COLORS = ['#1E4D4D', '#10B981', '#3B82F6', '#F59E0B'];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Scope Filtering header action row */}
      <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-[#1E4D4D]">لوحة تحليلات وتقارير الفروع</h1>
          <p className="text-xs text-slate-400 font-bold mt-0.5">تقارير إحصائية، قوائم تقييم المخازن، وتنبؤات كفاءة الطلب على الأدوية</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="text-xs font-black text-slate-400 shrink-0">نطاق التقرير:</label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="flex-1 md:flex-initial px-4 py-3 bg-slate-50 border border-slate-100 text-slate-700 font-black rounded-2xl focus:outline-none focus:ring-1 focus:ring-[#1E4D4D] text-xs min-w-[200px]"
          >
            <option value="ALL">كل الفروع (تقرير مجمع)</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <button 
            type="button"
            onClick={calculateReportData}
            className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl transition-all"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Metrics summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-lg shadow-inner"><Package size={22} /></div>
              <div>
                <span className="text-[10px] text-slate-450 font-black text-slate-400 block uppercase">قيمة بضاعة المخازن</span>
                <span className="text-lg font-black text-slate-800 mt-1 block">{reportMetrics.inventoryValue.toLocaleString()} {currency}</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg shadow-inner"><DollarSign size={22} /></div>
              <div>
                <span className="text-[10px] text-slate-450 font-black text-slate-400 block uppercase">إجمالي مبيعات المبيعات</span>
                <span className="text-lg font-black text-slate-800 mt-1 block">{reportMetrics.totalSales.toLocaleString()} {currency}</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-teal-50 text-[#1E4D4D] flex items-center justify-center font-bold text-lg shadow-inner"><Wallet2 size={22} /></div>
              <div>
                <span className="text-[10px] text-slate-450 font-black text-slate-400 block uppercase">إجمالي الأرباح التقديرية</span>
                <span className="text-lg font-black text-slate-800 mt-1 block">{reportMetrics.totalProfit.toLocaleString()} {currency}</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-inner ${reportMetrics.lowStockCount > 0 ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-400"}`}><AlertTriangle size={22} /></div>
              <div>
                <span className="text-[10px] text-slate-450 font-black text-slate-400 block uppercase">أصناف تحت حد إعادة الطلب</span>
                <span className="text-lg font-black text-slate-800 mt-1 block">{reportMetrics.lowStockCount} دواء</span>
              </div>
            </div>
          </div>

          {/* Graphical Analytics section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-md lg:col-span-2 space-y-4">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-500" />
                <span>منحنى نمو مبيعات الربح الشهري بالفروع</span>
              </h3>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartSalesData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    <Bar dataKey="المبيعات" fill="#1E4D4D" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="الأرباح" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-md space-y-4">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <PieChartIcon size={16} className="text-[#1E4D4D]" />
                <span>حصة توزيع المخزون المالي</span>
              </h3>

              {pieData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-slate-400">لا توجد أرقام كافية لدائرة الحصص</div>
              ) : (
                <div className="h-56 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => `${(value || 0).toLocaleString()} ${currency}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Legends */}
              <div className="space-y-2 mt-2 font-bold text-xs text-slate-600">
                {pieData.map((item, idx) => (
                  <div key={item.name} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span>{item.name}</span>
                    </div>
                    <span className="font-black text-slate-800">{item.value.toLocaleString()} {currency}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AI Decision Hub - Forecast modules */}
          <div className="bg-slate-900 text-white rounded-[32px] p-8 space-y-6 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-80 h-80 bg-white/[0.02] rounded-full pointer-events-none -mr-20 -mt-20" />
            <div className="absolute left-0 bottom-0 w-48 h-48 bg-emerald-500/[0.02] rounded-full pointer-events-none -ml-10 -mb-10" />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black">مركز التنبؤات والذكاء الاصطناعي للمخزون</h3>
                  <p className="text-xs text-slate-400 font-bold mt-1">تحديد فترات التوريد المثالية، وتقديم اقتراحات لإعادة تعبئة الفروع بناءً على مبيعاتها الحالية</p>
                </div>
              </div>

              <div className="text-xs font-black bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <Zap size={12} fill="currentColor" />
                <span>التنبؤ نشط ولحظي</span>
              </div>
            </div>

            {/* predictions details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
              {/* Product Out predictions */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                  <AlertTriangle size={14} />
                  <span>تنبؤ بنفاذ المخزون الدوائي (أيام الأمان المتبقية)</span>
                </h4>

                {aiPredictions.lowStockPredictions.length === 0 ? (
                  <p className="text-xs text-slate-500 font-bold bg-white/5 p-4 rounded-2xl text-center">لا توجد مخاطر نفاذ فورية بالصيدلية المحددة.</p>
                ) : (
                  <div className="space-y-3">
                    {aiPredictions.lowStockPredictions.slice(0, 3).map(pred => (
                      <div key={pred.productId} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center gap-4 text-xs">
                        <div>
                          <span className="font-black block text-sm">{pred.productName}</span>
                          <span className="text-slate-400 block mt-1">مستوى المخازن الحالي: {pred.stockQuantity} عبوة</span>
                        </div>
                        <div className="text-right">
                          <span className="bg-rose-500/10 text-rose-400 px-3 py-1 rounded-full text-[10px] font-black">{pred.recommendation}</span>
                          <span className="text-emerald-400 font-black block mt-1.5">نفاذ خلال: {pred.daysToStockout} أيام</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Demand Forecasting predictions */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                  <TrendingUp size={14} />
                  <span>الطلب الشهري المتوقع بناءً على مبيعات الفروع</span>
                </h4>

                {aiPredictions.demandForecasts.length === 0 ? (
                  <p className="text-xs text-slate-500 font-bold bg-white/5 p-4 rounded-2xl text-center">مؤشرات الطلب بانتظار تنشيط العمليات.</p>
                ) : (
                  <div className="space-y-3">
                    {aiPredictions.demandForecasts.slice(0, 3).map(forecast => (
                      <div key={forecast.productId} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center gap-4 text-xs">
                        <div>
                          <span className="font-black block text-sm">{forecast.productName}</span>
                          <span className="text-slate-400 block mt-1">المبيعات الأسبوعية التقريبية: {forecast.weeklyAverageDemand} عبوة</span>
                        </div>
                        <div className="text-right">
                          <span className="text-emerald-400 font-black block">مستهدف الطلب الشهري: {forecast.projectedMonthlyDemand}</span>
                          <span className="text-slate-500 block text-[10px] mt-1">نسبة الدقة المتوقعة: {Math.floor(forecast.confidenceLevel * 100)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Auto reorders Suggestion list */}
            <div className="pt-4 border-t border-white/10 relative z-10">
              <h4 className="text-xs font-black text-emerald-400 mb-4 flex items-center gap-1.5">
                <Sparkles size={14} />
                <span>جدول إعادة التموين التلقائي المقترح من محرك التنبؤ للفرع:</span>
              </h4>

              {aiPredictions.autoReorders.length === 0 ? (
                <p className="text-xs text-slate-500 font-bold bg-white/5 p-4 rounded-2xl text-center">لا توجد مقترحات إعادة ملء حالياً. مستويات المخزون بالدائرة الخضراء.</p>
              ) : (
                <div className="overflow-x-auto bg-white/5 rounded-2xl border border-white/5">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-white/5 text-slate-400 font-black">
                        <th className="p-3">اسم المستحضر العقاري</th>
                        <th className="p-3 text-center">المخزون الحالي</th>
                        <th className="p-3 text-center">الكمية المقترحة للشراء</th>
                        <th className="p-3 text-center">التكلفة التقديرية للشراء</th>
                        <th className="p-3 text-center">مستوى الأولوية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-semibold text-slate-350">
                      {aiPredictions.autoReorders.slice(0, 4).map(reorder => (
                        <tr key={reorder.productId}>
                          <td className="p-3 font-black text-white">{reorder.productName}</td>
                          <td className="p-3 text-center">{reorder.currentStock}</td>
                          <td className="p-3 text-center text-emerald-400 font-black">{reorder.suggestedReorderQuantity} عبوة</td>
                          <td className="p-3 text-center">{reorder.estimatedCost.toLocaleString()} {currency}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black ${reorder.priority === 'HIGH' ? "bg-rose-500/10 text-rose-400" : "bg-amber-500/10 text-amber-400"}`}>
                              {reorder.priority === 'HIGH' ? 'قصوى' : 'متوسطة'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
