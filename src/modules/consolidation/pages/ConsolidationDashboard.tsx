// src/modules/consolidation/pages/ConsolidationDashboard.tsx

import { useState, useEffect, startTransition } from "react";
import { financialApiClient } from "@/shared/network/idempotency";
import { motion, AnimatePresence } from "motion/react";
import {
  TrendingUp,
  Sliders,
  FileText,
  DollarSign,
  Activity,
  Package,
  Layers,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Search,
  CheckCircle,
  Clock,
  ShieldAlert,
  ArrowUpRight
} from "lucide-react";
import {
  ConsolidationSummary,
  ConsolidatedBalanceSheet,
  ConsolidatedIncomeStatement,
  ConsolidatedCashFlow,
  ConsolidatedTrialBalance,
  ConsolidatedInventoryValuation
} from "../consolidation.types";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie
} from "recharts";

interface Props {
  onNavigate?: (view: string, params?: any) => void;
}

const COLORS = ["#10B981", "#1E4D4D", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6"];

export default function ConsolidationDashboard({ onNavigate: _onNavigate }: Props) {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Data states
  const [summary, setSummary] = useState<ConsolidationSummary | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<ConsolidatedBalanceSheet | null>(null);
  const [incomeStatement, setIncomeStatement] = useState<ConsolidatedIncomeStatement | null>(null);
  const [cashFlow, setCashFlow] = useState<ConsolidatedCashFlow | null>(null);
  const [trialBalance, setTrialBalance] = useState<ConsolidatedTrialBalance | null>(null);
  const [inventory, setInventory] = useState<ConsolidatedInventoryValuation | null>(null);

  // Search filter for Trial Balance
  const [termSearch, setTermSearch] = useState<string>("");

  const loadAllData = async (forceRef: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      const suffix = forceRef ? "?refresh=true" : "";

      const [sumRes, balRes, incRes, cashRes, triRes, invRes] = await Promise.all([
        financialApiClient.get(`/api/consolidation/summary${suffix}`),
        financialApiClient.get(`/api/consolidation/balance-sheet${suffix}`),
        financialApiClient.get(`/api/consolidation/income-statement${suffix}`),
        financialApiClient.get(`/api/consolidation/cash-flow${suffix}`),
        financialApiClient.get(`/api/consolidation/trial-balance${suffix}`),
        financialApiClient.get(`/api/consolidation/inventory${suffix}`)
      ]);

      setSummary(sumRes.data);
      setBalanceSheet(balRes.data);
      setIncomeStatement(incRes.data);
      setCashFlow(cashRes.data);
      setTrialBalance(triRes.data);
      setInventory(invRes.data);
    } catch (err: any) {
      console.error("Error loading consolidation data:", err);
      setError(err?.response?.data?.message || "فشلت عملية سحب البيانات الموحدة. يرجى التحقق من الصلاحيات والاتصال.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData().catch(e => console.error("Error on init:", e));
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadAllData(true).catch(e => {
       console.error(e);
       setRefreshing(false);
    });
  };

  if (loading && !refreshing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
        <div className="w-14 h-14 border-4 border-[#1E4D4D] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-slate-500 animate-pulse">جاري تشغيل محرك الاندماج ومعالجة الموازين الفيدرالية...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-2xl mx-auto mt-12 bg-white rounded-3xl border border-red-100 shadow-xl text-center">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-xl font-black text-[#1E4D4D] mb-4">خطأ في الاتصال الفيدرالي</h2>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">{error}</p>
        <button
          onClick={() => loadAllData(true)}
          className="px-6 py-3 bg-[#1E4D4D] text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 mx-auto hover:bg-[#153a3a] transition-all"
        >
          <RefreshCw size={14} />
          <span>إعادة المحاولة النظيفة</span>
        </button>
      </div>
    );
  }

  // Pre-process metrics
  const branchChartData = balanceSheet?.branchBreakdown
    ? Object.entries(balanceSheet.branchBreakdown).map(([, d]) => ({
        name: d.branchName,
        assets: Math.round(d.assets),
        liabilities: Math.round(d.liabilities),
        equity: Math.round(d.equity)
      }))
    : [];

  const inventoryBreakdown = inventory?.branchBreakdown
    ? Object.entries(inventory.branchBreakdown).map(([, d]) => ({
        name: d.branchName,
        value: d.value,
        quantity: d.quantity
      }))
    : [];

  const filteredTrialBalanceRows = trialBalance?.rows.filter(
    r =>
      r.accountName.includes(termSearch) ||
      r.accountCode.includes(termSearch) ||
      r.accountType.includes(termSearch.toUpperCase())
  ) || [];

  return (
    <div className="space-y-6 pt-2 pb-16 px-1 md:px-0 text-right" dir="rtl">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white rounded-[24px] border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Layers size={20} /></span>
            <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100/60 font-mono">النسخة القياسية 4.3</span>
          </div>
          <h1 className="text-2xl font-black text-[#1E4D4D] tracking-tight">بوابة الاندماج المالي والتحليلات الفيدرالية الموحدة</h1>
          <p className="text-slate-400 text-xs mt-1">تجميع فوري للمركز المالي للأستاذ والذمم والمخزون عبر كافة صيدليات المجموعة مع إلغاء المعاملات البينية.</p>
        </div>

        <div className="flex items-center gap-3 self-end md:self-center">
          <div className="text-left md:text-right">
            <p className="text-[10px] font-bold text-slate-400">آخر تحديث فيدرالي</p>
            <p className="text-xs font-mono font-bold text-slate-500 mt-0.5">{new Date(summary?.timestamp || "").toLocaleTimeString()}</p>
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="p-3.5 bg-slate-50 border border-slate-100 hover:bg-slate-100/80 rounded-2xl text-slate-600 transition-all cursor-pointer relative"
            title="تحديث البيانات الموحدة"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Main Stats Bento Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-5 bg-white rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <p className="text-slate-400 text-[11px] font-bold mb-1">إجمالي الإيرادات الموحدة</p>
            <h3 className="text-xl md:text-2xl font-mono font-black text-[#1E4D4D]">${summary?.aggregateRevenue.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</h3>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-emerald-600">
            <span className="text-[10px] bg-emerald-50 font-black px-2 py-0.5 rounded-full flex items-center gap-0.5"><ArrowUpRight size={10} /> +12%</span>
            <span className="text-[10px] text-slate-400">منظور مستقر</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-5 bg-white rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <p className="text-slate-400 text-[11px] font-bold mb-1">صافي الأرباح الموحدة</p>
            <h3 className="text-xl md:text-2xl font-mono font-black text-[#1E4D4D]">${summary?.aggregateNetIncome.toLocaleString(undefined, { minimumFractionDigits: 1 })}</h3>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-emerald-600">
            <span className="text-[10px] bg-emerald-50 font-black px-2 py-0.5 rounded-full flex items-center gap-0.5"><CheckCircle size={10} /> متوازن</span>
            <span className="text-[10px] text-slate-400">هامش ربح متميز</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-5 bg-white rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <p className="text-slate-400 text-[11px] font-bold mb-1">قيمة أصول المجموعة</p>
            <h3 className="text-xl md:text-2xl font-mono font-black text-[#1E4D4D]">${summary?.aggregateAssets.toLocaleString(undefined, { minimumFractionDigits:1 })}</h3>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-slate-500">
            <span className="text-[10px] bg-slate-50 font-bold px-2 py-0.5 rounded-full font-mono">{summary?.activeBranchesCount} فروع مجمعة</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5 bg-white rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <p className="text-slate-400 text-[11px] font-bold mb-1">إجمالي التسويات والإلغاءات</p>
            <h3 className="text-xl md:text-2xl font-mono font-black text-[#1E4D4D]">{summary?.totalEliminationsDone} معملات متبادلة</h3>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-[#115E59]">
            <span className="text-[10px] bg-[#CCFBF1] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5"><Clock /> غسيل مركزي</span>
            <span className="text-[10px] text-slate-400">منع الازدواجية</span>
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-slate-100 gap-1 overflow-x-auto custom-scrollbar no-scrollbar py-1">
        {[
          { id: "overview", label: "الذكاء المالي والتقرير التحليلي", icon: <Sparkles size={14} /> },
          { id: "balance", label: "الميزانية الموحدة", icon: <FileText size={14} /> },
          { id: "income", label: "قائمة الدخل الموحدة", icon: <Sliders size={14} /> },
          { id: "cash", label: "جدول التدفقات النقدية", icon: <DollarSign size={14} /> },
          { id: "trial", label: "ميزان المراجعة المشترك", icon: <Activity size={14} /> },
          { id: "inventory", label: "لوجستيات المخزون والوفرة", icon: <Package size={14} /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              startTransition(() => {
                setActiveTab(tab.id);
              });
            }}
            className={`px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${activeTab === tab.id ? "bg-[#1E4D4D] text-white shadow-md shadow-emerald-900/10" : "text-slate-500 hover:bg-slate-50 hover:text-[#1E4D4D]"}`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Panels Contents */}
      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              {/* Gemini AI Insights Panel */}
              <div className="p-6 bg-gradient-to-br from-[#1E4D4D] to-[#123131] rounded-[32px] text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px]"></div>
                
                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                  <div className="flex items-center gap-3">
                    <span className="p-2 bg-emerald-400 text-[#1E4D4D] rounded-2xl shadow-lg animate-pulse"><Sparkles size={20} /></span>
                    <div>
                      <h2 className="text-lg font-black tracking-tight">خدمة التحليل المالي والآفاق الفيدرالية المتقدمة (Gemini AI)</h2>
                      <p className="text-[11px] text-emerald-300">تقرير استشاري رفيع المستوى لوحدات اتخاذ القرار بالمجموعة الصيدلية.</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-[1.5px] px-3 py-1 bg-white/10 rounded-full">تحليل اللحظة الفورية</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Revenue Insights */}
                  <div className="p-5 bg-white/5 rounded-2xl border border-white/5 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-black text-emerald-300 mb-2">أداء وحجم نمو المجموعة</h4>
                      <p className="text-xs leading-relaxed text-slate-100">{summary?.insights.revenueGrowthTrends}</p>
                    </div>
                  </div>

                  {/* Margins Insights */}
                  <div className="p-5 bg-white/5 rounded-2xl border border-white/5 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-black text-emerald-300 mb-2">تحليل الربحية والهياكل</h4>
                      <p className="text-xs leading-relaxed text-slate-100">{summary?.insights.profitabilityAnalysis}</p>
                    </div>
                  </div>

                  {/* Stock Insights */}
                  <div className="p-5 bg-white/5 rounded-2xl border border-white/5 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-black text-emerald-300 mb-2">محرك المخزون واللوجستيات</h4>
                      <p className="text-xs leading-relaxed text-slate-100">{summary?.insights.inventoryTurnoverAnalysis}</p>
                    </div>
                  </div>
                </div>

                {/* Stock warnings banner */}
                {summary?.insights.stockRiskWarnings && summary.insights.stockRiskWarnings.length > 0 && (
                  <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3">
                    <ShieldAlert className="text-amber-400 shrink-0" size={18} />
                    <div>
                      <h5 className="text-xs font-black text-amber-300">تحذيرات أمنية من المخزون الراكد أو شحيح الفعالية</h5>
                      <ul className="list-disc list-inside text-xs text-slate-200 mt-1.5 space-y-1">
                        {summary.insights.stockRiskWarnings.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Graphical representation of the federated structure */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Branches comparative ledger status */}
                <div className="lg:col-span-2 p-6 bg-white rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-black text-[#1E4D4D] mb-4">أرصدة الفروع المجمعة للفروع الفعالة</h3>
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={branchChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                          <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} fontFamily="Inter, sans-serif" />
                          <YAxis stroke="#94A3B8" fontSize={10} />
                          <Tooltip formatter={(value) => [`$${Number(value || 0).toLocaleString()}`]} />
                          <Bar dataKey="assets" name="المركز للأصول" fill="#1E4D4D" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="liabilities" name="إجمالي الالتزامات" fill="#EF4444" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="equity" name="رأس المال/الاحتياطي" fill="#10B981" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Branch inventory distribution pie map */}
                <div className="p-6 bg-white rounded-[28px] border border-slate-100 shadow-sm">
                  <h3 className="text-sm font-black text-[#1E4D4D] mb-4">التوزيع النسبي للمخزون الفيدرالي</h3>
                  <div className="h-[180px] flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={inventoryBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {inventoryBreakdown.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`$${Number(value || 0).toLocaleString()}`]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
                      <p className="text-[10px] font-bold text-slate-400">قيمة المستودعات</p>
                      <p className="text-xs font-mono font-black text-[#1E4D4D]">${inventory?.totalInventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {inventoryBreakdown.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                          <span className="font-bold text-slate-500">{item.name}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-700">${item.value.toLocaleString()} ({item.quantity} عبوة)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Smart AI stock reorder suggestions */}
              <div className="p-6 bg-white rounded-[28px] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black text-[#1E4D4D]">توجيهات إعادة توريد ذكية (سريع المفعول)</h3>
                  <span className="text-[10px] text-slate-400 font-mono">حساب معدل السحب الفعلي</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-black">
                        <th className="py-2.5">الصنف</th>
                        <th className="py-2.5">SKU الفيدرالي</th>
                        <th className="py-2.5 text-center">المقدار الحالي</th>
                        <th className="py-2.5 text-center">الكمية المقترحة</th>
                        <th className="py-2.5 text-left">فجوة المخزون</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {summary?.insights.reorderRecommendations.map(p => (
                        <tr key={p.productId}>
                          <td className="py-3 font-semibold text-slate-600">{p.productName}</td>
                          <td className="py-3 font-mono font-bold text-slate-400">{p.sku}</td>
                          <td className="py-3 text-center font-mono font-bold text-slate-500">{p.currentStock} عبوة</td>
                          <td className="py-3 text-center font-mono font-black text-emerald-600">{p.reorderQuantity} عبوة</td>
                          <td className="py-3 text-left">
                            <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-md font-bold text-[10px]">-{p.percentageGap}% حد أدنى</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "balance" && (
            <motion.div
              key="balance"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              {/* Balance Equations Checks */}
              <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="text-emerald-500 shrink-0" />
                  <div>
                    <h4 className="text-xs font-black text-[#1E4D4D]">فحص مطابقة الموازنة الفيدرالية الموحدة</h4>
                    <p className="text-[10px] text-slate-500">تم مراجعة مخرجات الأستاذ الموحد بالكامل ومعادلة التوازن الأساسية: الأصول = الالتزامات + حقوق الملكية.</p>
                  </div>
                </div>
                <div className="font-mono text-xs font-black text-emerald-700 bg-emerald-100 rounded-full px-4 py-1">الأرصدة متطابقة ومغلقة</div>
              </div>

              {/* Side-by-side balanced ledger sheets */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Assets Column */}
                <div className="p-6 bg-white rounded-[28px] border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                    <h3 className="font-black text-[#1E4D4D] text-sm">أصول المجموعة الموحدة (Assets)</h3>
                    <span className="font-mono font-bold text-xs text-slate-400">الجانب المدين</span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-50">
                      <span className="text-slate-500 font-bold">النقدية وما يعادلها (صندوق، بنوك)</span>
                      <span className="font-mono font-bold text-slate-700">${balanceSheet?.assets.cashAndCashEquivalents.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-50">
                      <span className="text-slate-500 font-bold">الحسابات المدينة والذمم العملاء (مخصوم منها البيني)</span>
                      <span className="font-mono font-bold text-slate-700">${balanceSheet?.assets.accountsReceivable.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-50">
                      <span className="text-slate-500 font-bold">قيمة مخزون الأدوية الفعلي (بالتكلفة المتوسطة للفروع)</span>
                      <span className="font-mono font-bold text-slate-700">${balanceSheet?.assets.inventoryValue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-50">
                      <span className="text-slate-500 font-bold">أصول متداولة أخرى</span>
                      <span className="font-mono font-bold text-slate-700">${balanceSheet?.assets.otherCurrentAssets.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                      <span className="text-slate-500 font-bold">الأصول الثابتة وغير المتداولة</span>
                      <span className="font-mono font-bold text-slate-700">${balanceSheet?.assets.nonCurrentAssets.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-black text-[#1E4D4D] pt-2">
                      <span>إجمالي الأصول الموحدة</span>
                      <span className="font-mono">${balanceSheet?.assets.totalAssets.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Liability and Equities Column */}
                <div className="p-6 bg-white rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                      <h3 className="font-black text-[#1E4D4D] text-sm">التزامات وحقوق ملكية المجموعة (Liabilities & Equity)</h3>
                      <span className="font-mono font-bold text-xs text-slate-400">الجانب الدائن</span>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">الالتزامات الموحدة</p>
                      <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-50">
                        <span className="text-slate-500 font-bold">الذمم الدائمة وحسابات الموردين (بعد الإقصاء)</span>
                        <span className="font-mono font-bold text-slate-700">${balanceSheet?.liabilities.accountsPayable.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-50">
                        <span className="text-slate-500 font-bold">التزامات متداولة أخرى</span>
                        <span className="font-mono font-bold text-slate-700">${balanceSheet?.liabilities.otherCurrentLiabilities.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                        <span className="text-slate-500 font-bold">التزامات غير متداولة</span>
                        <span className="font-mono font-bold text-slate-700">${balanceSheet?.liabilities.nonCurrentLiabilities.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-black text-slate-800 pt-1 pb-3">
                        <span>إجمالي الالتزامات</span>
                        <span className="font-mono">${balanceSheet?.liabilities.totalLiabilities.toLocaleString()}</span>
                      </div>

                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 pt-2">حقوق الملكية الموحدة</p>
                      <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-50">
                        <span className="text-slate-500 font-bold">رأس مال الشركاء والمجموعة الفيدرالية</span>
                        <span className="font-mono font-bold text-slate-700">${balanceSheet?.equity.shareCapital.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                        <span className="text-slate-500 font-bold font-black text-emerald-600">الأرباح والخسائر المبقاة الموحدة</span>
                        <span className="font-mono font-bold text-slate-700">${balanceSheet?.equity.retainedEarnings.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-black text-slate-800 pt-1">
                        <span>إجمالي حقوق الملكية</span>
                        <span className="font-mono">${balanceSheet?.equity.totalEquity.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-sm font-black text-[#1E4D4D] pt-4 border-t border-slate-100 mt-4">
                    <span>إجمالي الالتزامات وحقوق المساهمين</span>
                    <span className="font-mono">${(Number(balanceSheet?.liabilities.totalLiabilities) + Number(balanceSheet?.equity.totalEquity)).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Elimination adjusting logs */}
              {balanceSheet?.eliminations && balanceSheet.eliminations.length > 0 && (
                <div className="p-6 bg-white rounded-[28px] border border-slate-100 shadow-sm">
                  <h3 className="font-black text-[#1E4D4D] text-sm mb-3">سجل تعديلات وإلغاءات المركز المالي البيني للمجموعة</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-black">
                          <th className="py-2.5">معرف التعديل</th>
                          <th className="py-2.5">طبيعة وقناة الإلغاء البيني</th>
                          <th className="py-2.5">المرجع</th>
                          <th className="py-2.5 text-center">التاريخ التقديري</th>
                          <th className="py-2.5 text-left">خصم من المركز المشترك</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {balanceSheet.eliminations.map(el => (
                          <tr key={el.id}>
                            <td className="py-3 font-mono text-slate-400 text-[10px]">{el.id.slice(0, 8)}...</td>
                            <td className="py-3 text-slate-600">{el.description}</td>
                            <td className="py-3 font-mono font-bold text-slate-500">{el.referenceId || "تسوية مجمعة"}</td>
                            <td className="py-3 text-center text-slate-400">{new Date(el.timestamp).toLocaleDateString()}</td>
                            <td className="py-3 text-left font-mono font-black text-red-500">-${el.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "income" && (
            <motion.div
              key="income"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              {/* Income statement dynamic metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Gross Profit Indicator */}
                <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm text-center">
                  <p className="text-slate-400 text-xs mb-1">نسبة مجمل الربح المشترك</p>
                  <h2 className="text-2xl font-mono font-black text-emerald-600">
                    {incomeStatement?.revenue ? ((incomeStatement.grossProfit / incomeStatement.revenue) * 100).toFixed(1) : 0}%
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-2">متوافق مع الهيكل العام للتجزئة الدوائية</p>
                </div>

                {/* Net Income margins */}
                <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm text-center">
                  <p className="text-slate-400 text-xs mb-1">هامش صافي أرباح الفدرالية</p>
                  <h2 className="text-2xl font-mono font-black text-[#1E4D4D]">
                    {incomeStatement?.revenue ? ((incomeStatement.netIncome / incomeStatement.revenue) * 100).toFixed(1) : 0}%
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-2">عائد ممتاز على المبيعات المستخلصة</p>
                </div>

                {/* OPEX structures */}
                <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm text-center">
                  <p className="text-slate-400 text-xs mb-1">هامش المصروفات التشغيلية</p>
                  <h2 className="text-2xl font-mono font-black text-slate-600">
                    {incomeStatement?.revenue ? ((incomeStatement.operatingExpenses.totalOPEX / incomeStatement.revenue) * 100).toFixed(1) : 0}%
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-2">كفاءة في تخصيص مصاريف التشغيل</p>
                </div>
              </div>

              {/* Master core statement */}
              <div className="p-6 bg-white rounded-[28px] border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-6">
                  <h3 className="font-black text-[#1E4D4D] text-sm">بيان الأرباح والخسائر الموحد (Consolidated Income Statement)</h3>
                  <span className="text-[10px] font-bold text-slate-400 font-mono">طريقة الإقصاء البيني المباشر</span>
                </div>

                <div className="space-y-4 max-w-3xl mx-auto">
                  <div className="flex justify-between items-center text-xs pb-2.5 border-b border-slate-50">
                    <span className="text-slate-800 font-bold">أعمال وإيرادات مبيعات المجموعة (بعد إقصاء الصفقات البينية)</span>
                    <span className="font-mono font-bold text-slate-800 text-sm">${incomeStatement?.revenue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pb-2.5 border-b border-slate-100 text-red-500">
                    <span className="font-bold">تكلفة المبيعات وضريبة المخزون السلعي (COGS)</span>
                    <span className="font-mono font-bold">-${incomeStatement?.costOfGoodsSold.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between items-center text-sm font-black text-emerald-600 bg-emerald-50/40 p-3 rounded-2xl">
                    <span>مجمل أرباح النشاط (Gross Profit)</span>
                    <span className="font-mono">${incomeStatement?.grossProfit.toLocaleString()}</span>
                  </div>

                  {/* OPEX Items nested */}
                  <div className="pr-4 space-y-2 pt-1 border-r-2 border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 mb-2">المصروفات التشغيلية الموزعة (OPEX)</p>
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span>الرواتب والأجور الفروع</span>
                      <span className="font-mono font-bold">${incomeStatement?.operatingExpenses.salary.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span>إيجارات العقارات والمواقع والفرع الرئيسي</span>
                      <span className="font-mono font-bold">${incomeStatement?.operatingExpenses.rent.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span>الخدمات والكهرباء والإنترنت والربط الفيدرالي</span>
                      <span className="font-mono font-bold">${incomeStatement?.operatingExpenses.utilities.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span>الترويج والمشاركات والحملات التسويقية</span>
                      <span className="font-mono font-bold">${incomeStatement?.operatingExpenses.marketing.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span>المصروفات العامة والإدارية وعقود الصيانة والأنظمة</span>
                      <span className="font-mono font-bold">${incomeStatement?.operatingExpenses.other.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold text-slate-600 pt-2 border-t border-slate-50">
                      <span>إجمالي مصروفات التشغيل</span>
                      <span className="font-mono">${incomeStatement?.operatingExpenses.totalOPEX.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs pb-2.5 pt-2 border-b border-slate-50">
                    <span className="text-slate-800 font-bold">الأرباح والوفر قبل اقتطاع المخصصات الضريبية</span>
                    <span className="font-mono font-bold text-[#1E4D4D] text-sm">${incomeStatement?.operatingProfit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pb-2.5 border-b border-slate-100 text-red-500">
                    <span className="font-bold">مخصص ضريبة الدخل والزكاة المقررة</span>
                    <span className="font-mono font-bold">-${incomeStatement?.tax.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between items-center text-base font-black text-white bg-[#1E4D4D] p-4 rounded-2xl shadow-md">
                    <span>صافي أرباح الفدرالية (Consolidated Net Income)</span>
                    <span className="font-mono">${incomeStatement?.netIncome.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "cash" && (
            <motion.div
              key="cash"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              {/* Cash Flow standard layout */}
              <div className="p-6 bg-white rounded-[28px] border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-6">
                  <h3 className="font-black text-[#1E4D4D] text-sm">بيان التدفقات النقدية الموحد (Consolidated Statement of Cash Flows)</h3>
                  <span className="text-[10px] text-slate-400 font-mono font-bold">الطريقة المباشرة</span>
                </div>

                <div className="space-y-6 max-w-3xl mx-auto">
                  {/* Operating Cash */}
                  <div>
                    <h4 className="text-xs font-black text-[#1E4D4D] border-b border-slate-100 pb-1.5 mb-2">1. التدفقات النقدية من الأنشطة التشغيلية (Operating Activities)</h4>
                    <div className="space-y-2 pr-4 text-xs">
                      <div className="flex justify-between text-slate-500">
                        <span>المقبوضات النقدية من صفقات المبيعات وسجل العملاء</span>
                        <span className="font-mono font-bold text-emerald-600">+${cashFlow?.operatingActivities.cashInflowSales.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>النقد المدفوع لقاء توريد الأدوية والمستندات واللوجستيات</span>
                        <span className="font-mono font-bold text-red-500">-${cashFlow?.operatingActivities.cashOutflowInventory.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>النقد المدفوع لقاء الأجور والمصروفات الإدارية والمقرر</span>
                        <span className="font-mono font-bold text-red-500">-${cashFlow?.operatingActivities.cashOutflowOPEX.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-700 bg-slate-50 p-2 rounded-xl">
                        <span>صافي نقد العمليات والتشغيل</span>
                        <span className="font-mono">${cashFlow?.operatingActivities.netOperatingCash.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Investing Cash */}
                  <div>
                    <h4 className="text-xs font-black text-[#1E4D4D] border-b border-slate-100 pb-1.5 mb-2">2. التدفقات النقدية من الأنشطة الاستثمارية (Investing Activities)</h4>
                    <div className="space-y-2 pr-4 text-xs">
                      <div className="flex justify-between text-slate-500">
                        <span>الإنفاق الرأسمالي وشراء رفوف وتجهيزات الفروع</span>
                        <span className="font-mono font-bold text-red-500">-${cashFlow?.investingActivities.capitalExpenditure.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-700 bg-slate-50 p-2 rounded-xl">
                        <span>صافي نقد الاستثمار الرأسمالي</span>
                        <span className="font-mono">${cashFlow?.investingActivities.netInvestingCash.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Financing Cash */}
                  <div>
                    <h4 className="text-xs font-black text-[#1E4D4D] border-b border-slate-100 pb-1.5 mb-2">3. التدفقات النقدية من الأنشطة التمويلية (Financing Activities)</h4>
                    <div className="space-y-2 pr-4 text-xs">
                      <div className="flex justify-between text-slate-500">
                        <span>إيرادات من رأس مال إضافي أو منح الشركاء</span>
                        <span className="font-mono font-bold text-emerald-600">+${cashFlow?.financingActivities.equityIssued.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>سداد القروض والخدمات البنكية والعوائد الفيدرالية</span>
                        <span className="font-mono font-bold text-red-500">-${cashFlow?.financingActivities.debtServicing.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-700 bg-slate-50 p-2 rounded-xl">
                        <span>صافي نقد نشاط التمويل</span>
                        <span className="font-mono">${cashFlow?.financingActivities.netFinancingCash.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ending summary reconciliation */}
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 mb-2.5">المطابقة والتسوية النقدية لسيولة المجموعة</p>
                    <div className="bg-slate-50 p-4 rounded-2xl text-xs space-y-2">
                      <div className="flex justify-between text-slate-600 font-bold">
                        <span>رصيد نقدية المجموعة الموحدة في بداية الفترة الأستاذية</span>
                        <span className="font-mono">${cashFlow?.beginningCashBalance.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>صافي التغير والتأثير النقدي في الوعاء العام</span>
                        <span className="font-mono font-bold text-[#1E4D4D]">${cashFlow?.netChangeInCash.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm font-black text-[#1E4D4D] pt-2 border-t border-slate-200">
                        <span>النقد ونظائر النقد في نهاية الفترة الميدانية الموحدة</span>
                        <span className="font-mono">${cashFlow?.endingCashBalance.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "trial" && (
            <motion.div
              key="trial"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              {/* Search and control box */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div className="relative w-full max-w-md">
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                    <Search size={15} />
                  </div>
                  <input
                    type="text"
                    value={termSearch}
                    onChange={(e) => setTermSearch(e.target.value)}
                    placeholder="ابحث بكود الحساب الفرعي، الاسم، طبيعته..."
                    className="w-full text-xs font-bold bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-100 rounded-xl pr-10 pl-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1E4D4D]/25 focus:border-[#1E4D4D] transition-all"
                  />
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="font-bold text-slate-500">
                    مجموع أرصدة المدين: <span className="font-mono text-[#1E4D4D] font-black">${trialBalance?.totalDebit.toLocaleString()}</span>
                  </div>
                  <span className="h-4 w-px bg-slate-200"></span>
                  <div className="font-bold text-slate-500">
                    مجموع أرصدة الدائن: <span className="font-mono text-[#1E4D4D] font-black">${trialBalance?.totalCredit.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Federated Trial Balance Grid table */}
              <div className="p-6 bg-white rounded-[28px] border border-slate-100 shadow-sm">
                <h3 className="font-black text-[#1E4D4D] text-sm mb-4">ميزان المراجعة المشترك والأرصدة التفصيلية للفروع</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-black">
                        <th className="py-2.5">الكود الأستاذي</th>
                        <th className="py-2.5">اسم الحساب</th>
                        <th className="py-2.5">النوع</th>
                        <th className="py-2.5 text-center">إجمالي المدين</th>
                        <th className="py-2.5 text-center">إجمالي الدائن</th>
                        <th className="py-2.5 text-left">الرصيد المشترك الصافي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredTrialBalanceRows.map(row => (
                        <tr key={row.accountCode} className="hover:bg-slate-50/50">
                          <td className="py-3 font-mono font-bold text-slate-500">{row.accountCode}</td>
                          <td className="py-3 font-semibold text-slate-600">{row.accountName}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                              row.accountType === "ASSET" ? "bg-emerald-50 text-emerald-600" :
                              row.accountType === "LIABILITY" ? "bg-red-50 text-red-600" :
                              row.accountType === "EQUITY" ? "bg-blue-50 text-blue-600" :
                              row.accountType === "REVENUE" ? "bg-purple-50 text-purple-600" : "bg-slate-50 text-slate-500"
                            }`}>{row.accountType}</span>
                          </td>
                          <td className="py-3 text-center font-mono font-semibold text-slate-600">${row.debit.toLocaleString()}</td>
                          <td className="py-3 text-center font-mono font-semibold text-slate-600">${row.credit.toLocaleString()}</td>
                          <td className="py-3 text-left font-mono font-black text-slate-800">
                            ${row.netBalance.toLocaleString()} {row.balanceType === "DEBIT" ? "أ.م" : "أ.د"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "inventory" && (
            <motion.div
              key="inventory"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              {/* Inventory high-level summaries */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Metric 1 */}
                <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-[10px] font-bold mb-1">الكميات الفيدرالية الإجمالية</p>
                    <h3 className="text-xl font-mono font-black text-[#1E4D4D]">{inventory?.totalInventoryQuantity.toLocaleString()} عبوة</h3>
                  </div>
                  <span className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl"><Package /></span>
                </div>

                {/* Metric 2 */}
                <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-[10px] font-bold mb-1">عدد المنتجات والتصنيفات</p>
                    <h3 className="text-xl font-mono font-black text-[#1E4D4D]">{inventory?.uniqueSKUsCount} SKUs فعال</h3>
                  </div>
                  <span className="p-3.5 bg-[#CCFBF1] text-[#115E59] rounded-2xl"><Sliders /></span>
                </div>

                {/* Metric 3 */}
                <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-[10px] font-bold mb-1">المتوسط المرجح للتكلفة</p>
                    <h3 className="text-xl font-mono font-black text-[#1E4D4D]">${inventory?.averageItemCost.toFixed(2)}</h3>
                  </div>
                  <span className="p-3.5 bg-yellow-50 text-yellow-600 rounded-2xl"><DollarSign /></span>
                </div>
              </div>

              {/* Velocity analysis split */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* High velocity fast selling products */}
                <div className="p-6 bg-white rounded-[28px] border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-2">
                    <h3 className="text-sm font-black text-[#1E4D4D] flex items-center gap-2">
                      <TrendingUp size={16} className="text-emerald-500" />
                      <span>1. السحب الفعال والعلاجية السريعة (المنتجات الأكثر مبيعاً)</span>
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-semibold text-[11px]">
                          <th className="py-2">الصنف الدوائي</th>
                          <th className="py-2 text-center">أماكن مخزونه</th>
                          <th className="py-2 text-center">صفقات السحب</th>
                          <th className="py-2 text-left">قيمة العائد</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {inventory?.fastMovingProducts.map(p => (
                          <tr key={p.id}>
                            <td className="py-3 font-semibold text-slate-700">{p.name}</td>
                            <td className="py-3 text-center font-mono text-slate-400">{p.stockQuantity}</td>
                            <td className="py-3 text-center font-mono font-bold text-emerald-600">+{p.salesVolume} صفقات</td>
                            <td className="py-3 text-left font-mono font-bold text-slate-800">${p.revenueGenerated.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Low velocity slow moving / stagnant stocks */}
                <div className="p-6 bg-white rounded-[28px] border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-2">
                    <h3 className="text-sm font-black text-[#1E4D4D] flex items-center gap-2">
                      <AlarmAlert size={16} className="text-yellow-500" />
                      <span>2. كواشف الركود والمخزون خامل الفعالية (Slow Moving)</span>
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-semibold text-[11px]">
                          <th className="py-2">الصنف خامل الأداء</th>
                          <th className="py-2 text-center">التكلفة المفردة</th>
                          <th className="py-2 text-center">الكمية الخاملة</th>
                          <th className="py-2 text-left">القيمة المستهدفة بالركود</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {inventory?.slowMovingProducts.map(p => (
                          <tr key={p.id}>
                            <td className="py-3 font-semibold text-slate-700">{p.name}</td>
                            <td className="py-3 text-center font-mono text-slate-400">${p.cost.toFixed(2)}</td>
                            <td className="py-3 text-center font-mono text-slate-500 font-bold">{p.stockQuantity} عبوات</td>
                            <td className="py-3 text-left font-mono font-black text-amber-600">${p.totalValue.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Consolidation master audit logs footer card */}
      <div className="p-6 bg-[#FAFBFB] rounded-[24px] border border-slate-100 shadow-inner flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Clock className="text-slate-400 shrink-0" size={18} />
          <div>
            <h4 className="text-xs font-black text-slate-600">محرك إثبات المراجعة وسجلات النشاط الفيدرالية المغلقة</h4>
            <p className="text-[10px] text-slate-400">إلغاء المعاملات يطابق التراخيص والمحاسبة الفيدرالية المتوافقة مع معايير IFRS وبالمزامنة مع محرك الأحداث.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="text-[10px] bg-slate-100 text-slate-500 px-2.5 py-1 rounded-md font-mono">Run Hash: {summary?.runId.slice(0, 12)}</span>
          <span className="text-[10px] bg-[#E0F2FE] text-[#0369A1] px-2.5 py-1 rounded-md font-bold">حالة المراجعة: مصدق وموقع إلكترونياً</span>
        </div>
      </div>
    </div>
  );
}

// Low-profile helper sub-icons
function AlarmAlert({ className, size }: { className?: string; size?: number }) {
  return <AlertTriangle className={className} size={size} />;
}
