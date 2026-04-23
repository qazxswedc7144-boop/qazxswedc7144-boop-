
import { authService } from '../services/auth.service';
import React, { useMemo, useState, useEffect } from 'react';
import { useUI, useAccounting } from '../store/AppContext';
import { AccountingRepository } from '../repositories/AccountingRepository';
import { db } from '../lib/database';
import { syncService } from '../services/sync.service';
import { FinancialHealthService } from '../services/FinancialHealthService';
import { useAppStore } from '../store/useAppStore';
import { useSafeNavigation } from '../utils/navigation';
import { Card, Badge } from '../components/SharedUI';
import { FinancialHealthSnapshot } from '../types';
import InstallPWAButton from '../components/InstallPWAButton';
import { UI_CONFIG } from '../constants';
import RoleGuard from '../components/RoleGuard';
import { AISummaryPanel } from '../components/AISummaryPanel';
import { ProfitHealthAnalyzer } from '../services/ProfitHealthAnalyzer';
import { useLiveMetrics } from '../hooks/useLiveMetrics';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PackagePlus, FileText, DollarSign, PackageCheck, Sparkles as AutoAwesome,
  Users, Home, ShieldCheck, RefreshCw, Plus, ArrowUpRight, LayoutList, ShoppingCart,
  Clock, ArrowDownCircle, CreditCard, Wallet2, TrendingUp, Activity, BarChart3, PieChart as PieChartIcon,
  Search, Bell, Calendar, Package as PackageIcon, History
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const StatMiniCard = React.memo(({ label, value, icon, color, unit, trend }: { label: string, value: string | number, icon: React.ReactNode, color: string, unit?: string, trend?: string }) => (
  <Card className={`flex flex-col justify-between h-40 border-b-4 ${color} group hover:shadow-2xl transition-all !p-6 bg-white relative overflow-hidden !rounded-[32px]`}>
    <div className="flex justify-between items-start relative z-10">
        <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[2px] opacity-80">{label}</p>
            <h2 className="text-2xl font-black text-[#1E4D4D] leading-none">{value.toLocaleString()} <span className="text-[10px] opacity-30 font-bold uppercase">{unit}</span></h2>
        </div>
        <div className={`w-12 h-12 bg-slate-50 text-[#1E4D4D] rounded-2xl flex items-center justify-center text-[24px] shadow-inner group-hover:scale-110 transition-transform`}>{icon}</div>
    </div>
    {trend && (
        <div className="flex items-center gap-1 mt-4 relative z-10">
            <TrendingUp size={12} className="text-emerald-500" />
            <span className="text-[10px] font-black text-emerald-600">{trend}</span>
            <span className="text-[10px] font-bold text-slate-300 mr-1">مقارنة بالأمس</span>
        </div>
    )}
    <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-slate-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700"></div>
  </Card>
));

const Dashboard: React.FC<{ lang?: 'ar', onNavigate?: (view: any, params?: any) => void }> = ({ onNavigate }) => {
  const { currency, version, addToast } = useUI();
  const { metrics, isLoading: isMetricsLoading } = useLiveMetrics();
  const { goDebts, goReports } = useSafeNavigation();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [delayedSyncEnabled, setDelayedSyncEnabled] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const [stats, setStats] = useState({ 
    todaySalesTotal: 0, 
    todayInvoicesCount: 0,
    activeInvoicesCount: 0,
    monthSalesTotal: 0,
    stockValue: 0,
    salesTrend: [] as any[],
    categoryData: [] as any[],
    recentTransactions: [] as any[],
    riskScore: 'LOW' as 'LOW' | 'MEDIUM' | 'HIGH',
    alertsCount: 0
  });
  const [health, setHealth] = useState<FinancialHealthSnapshot | null>(null);
  
  const user = authService.getCurrentUser();
  
  useEffect(() => {
    const checkSync = async () => {
      const ops = await db.getPendingOperations();
      setPendingCount(ops.length);
      const isEnabled = await db.getSetting('delayed_sync_enabled', true);
      setDelayedSyncEnabled(isEnabled);
    };
    checkSync();
  }, [version]);

  const handleSyncNow = async () => {
    if (isSyncing || !navigator.onLine) return;
    setIsSyncing(true);
    try {
      await syncService.performSync();
      addToast("تمت المزامنة بنجاح ✅", "success");
      setPendingCount(0);
    } catch (e) {
      addToast("فشل المزامنة", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      const { AIDashboardEngine } = await import('../services/AIDashboardEngine');
      const metrics = await AIDashboardEngine.getMetrics(false);
      
      const today = new Date().toISOString().split('T')[0];
      const transactions = await AccountingRepository.getTransactions();
      const products = await db.getProducts();
      const sales = await db.getSales();
      
      const todaySales = transactions.filter(t => t.type === 'sale' && t.date.startsWith(today));
      const activeSales = sales.filter(s => s.InvoiceStatus !== 'CANCELLED' && (s.finalTotal - (s.paidAmount || 0)) > 0.01);
      
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
      });

      const salesTrend = last7Days.map(date => {
        const daySales = transactions.filter(t => t.type === 'sale' && t.date.startsWith(date));
        return {
          name: new Date(date).toLocaleDateString('ar-SA', { weekday: 'short' }),
          amount: daySales.reduce((acc, s) => acc + s.amount, 0)
        };
      });

      const categories = [...new Set(products.map(p => p.categoryName || 'عام'))];
      const categoryData = categories.map(cat => ({
        name: cat,
        value: products.filter(p => p.categoryName === cat).length
      })).slice(0, 5);

      setStats({
        todaySalesTotal: metrics.todaySummary.sales,
        todayInvoicesCount: todaySales.length,
        activeInvoicesCount: activeSales.length,
        monthSalesTotal: metrics.netProfit, // Use netProfit for the "Total Profit" card
        stockValue: metrics.totalPurchases - metrics.cogs, // Estimated stock value
        salesTrend,
        categoryData,
        recentTransactions: transactions.slice(-5).reverse(),
        riskScore: metrics.riskScore,
        alertsCount: metrics.lowStockAlerts.length + metrics.expiryAlerts.length + metrics.anomalies.length
      });

      const healthData = await FinancialHealthService.getLatestSnapshot();
      if (healthData) setHealth(healthData);

      if (user?.Role === 'Admin') {
        await ProfitHealthAnalyzer.computeDailyHealth();
      }
    };
    fetchStats();
  }, [version]);

  return (
    <div className="min-h-full h-full flex flex-col bg-[#F8FAFA] font-['Cairo'] overflow-hidden w-full relative" dir="rtl">
      {/* Modern Centered Branding Header */}
      <div className="px-6 sm:px-10 py-12 bg-white border-b border-slate-100 flex flex-col items-center justify-center gap-8 shrink-0 z-20 shadow-sm relative overflow-hidden w-full">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-20 -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl opacity-20 -ml-32 -mb-32"></div>

        <div className="flex flex-col items-center text-center gap-8 relative z-10 w-full max-w-2xl">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex flex-col items-center gap-4"
          >
            <img 
              src="data:image/png;base64,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/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//X3fX/vH79//Z" 
              alt="PharmaFlow Logo" 
              className="h-32 sm:h-48 w-auto object-contain drop-shadow-2xl" 
              referrerPolicy="no-referrer"
            />
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="space-y-1"
          >
            <h2 className="text-3xl font-black text-[#1E4D4D] tracking-tight">أهلاً بك، {user?.User_Name}</h2>
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-50 rounded-full border border-slate-100 shadow-sm">
                <Calendar size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-500">{new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              </div>
              {stats.riskScore && (
                <div className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full border shadow-sm ${
                  stats.riskScore === 'LOW' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                  stats.riskScore === 'MEDIUM' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                  'bg-red-50 border-red-100 text-red-600'
                }`}>
                  <ShieldCheck size={14} />
                  <span className="text-xs font-bold">مستوى المخاطرة: {stats.riskScore === 'LOW' ? 'منخفض' : stats.riskScore === 'MEDIUM' ? 'متوسط' : 'مرتفع'}</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-4 left-10 hidden sm:block">
          <InstallPWAButton />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-8 custom-scrollbar">
        
        {/* 1. Main Action Cards - Top Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <motion.button 
            whileHover={{ y: -2 }}
            onClick={() => onNavigate?.('sales')}
            className="group h-24 bg-gradient-to-br from-[#10B981] to-[#059669] text-white p-4 rounded-[24px] flex items-center gap-4 text-right transition-all shadow-lg shadow-emerald-900/10 relative overflow-hidden"
          >
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md shrink-0">
              <ShoppingCart size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">المبيعات</h3>
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">فاتورة بيع جديدة</p>
            </div>
            <ArrowUpRight size={18} className="absolute top-4 left-4 opacity-40 group-hover:opacity-100 transition-opacity" />
          </motion.button>

          <motion.button 
            whileHover={{ y: -2 }}
            onClick={() => onNavigate?.('purchases')}
            className="group h-24 bg-gradient-to-br from-[#1E4D4D] to-[#0f2a2a] text-white p-4 rounded-[24px] flex items-center gap-4 text-right transition-all shadow-lg shadow-emerald-900/10 relative overflow-hidden"
          >
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md shrink-0">
              <PackagePlus size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">المشتريات</h3>
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">توريد بضاعة للمخزن</p>
            </div>
            <ArrowUpRight size={18} className="absolute top-4 left-4 opacity-40 group-hover:opacity-100 transition-opacity" />
          </motion.button>
        </div>

        {/* Quick Access Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
          <QuickActionBtn icon={<PackageIcon size={24} />} label="المخزون" onClick={() => onNavigate?.('inventory')} color="bg-purple-500" />
          
          <div className="relative h-full">
            <QuickActionBtn 
              icon={<CreditCard size={24} />} 
              label="قبض - صرف" 
              onClick={() => onNavigate?.('vouchers')} 
              color="bg-blue-500" 
            />
          </div>

          <QuickActionBtn icon={<Wallet2 size={24} />} label="المحاسبة" onClick={() => onNavigate?.('accounting')} color="bg-amber-500" />
          <QuickActionBtn icon={<Clock size={24} />} label="تعمير الذمم" onClick={goDebts} color="bg-red-500" />
          <QuickActionBtn icon={<BarChart3 size={24} />} label="التقارير" onClick={goReports} color="bg-indigo-600" />
          <QuickActionBtn icon={<ShieldCheck size={24} />} label="التدقيق" onClick={() => onNavigate?.('audit-history')} color="bg-emerald-600" />
          <QuickActionBtn icon={<History size={24} />} label="الأرشيف" onClick={() => onNavigate?.('invoices-archive')} color="bg-slate-500" />
        </div>

        {/* 2. Primary Stats Row - Realtime Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatMiniCard label="السيولة الصندوقية" value={metrics.cash} icon={<Wallet2 size={24} />} color="border-[#1E4D4D]" unit={currency} trend="لحظي" />
          <StatMiniCard label="إيرادات المبيعات" value={metrics.revenue} icon={<DollarSign size={24} />} color="border-emerald-500" unit={currency} trend="مباشر" />
          <StatMiniCard label="صافي الربح" value={metrics.netProfit} icon={<Activity size={24} />} color="border-purple-500" unit={currency} />
          <StatMiniCard label="المصروفات" value={metrics.expenses} icon={<ArrowDownCircle size={24} />} color="border-red-500" unit={currency} />
        </div>

        {/* 3. Secondary Stats Row - Operational Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatMiniCard label="ذمم مدنية (لنا)" value={metrics.receivables} icon={<ArrowUpRight size={24} />} color="border-blue-500" unit={currency} />
          <StatMiniCard label="ذمم دائنة (علينا)" value={metrics.payables} icon={<CreditCard size={24} />} color="border-amber-600" unit={currency} />
          <StatMiniCard label="فواتير مسودة" value={stats.activeInvoicesCount} icon={<Clock size={24} />} color="border-slate-400" unit="فاتورة" />
          <StatMiniCard label="فواتير اليوم" value={stats.todayInvoicesCount} icon={<FileText size={24} />} color="border-slate-200" unit="وثيقة" />
        </div>

        {/* Bento Grid Layout - Distribution and AI */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Side Bento Column */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="!p-4 !rounded-[24px] bg-white border border-slate-100 shadow-sm h-full flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-black text-[#1E4D4D]">توزيع الأصناف</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">حسب التصنيف الرئيسي</p>
                </div>
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <PieChartIcon size={24} />
                </div>
              </div>
              <div className="flex-1 w-full" style={{ minHeight: '300px' }}>
                {isMounted && (
                  <ResponsiveContainer width="100%" height="100%" aspect={2} debounce={50}>
                    <PieChart>
                      <Pie
                        data={stats.categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#10B981', '#1E4D4D', '#3B82F6', '#8B5CF6', '#F59E0B'][index % 5]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="mt-6 space-y-3">
                {stats.categoryData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] font-bold">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ['#10B981', '#1E4D4D', '#3B82F6', '#8B5CF6', '#F59E0B'][i % 5] }}></div>
                      <span className="text-slate-600">{item.name}</span>
                    </div>
                    <span className="text-slate-400">{item.value} صنف</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* AI Summary Panel */}
          <div className="lg:col-span-8">
            <RoleGuard permission="VIEW_REPORTS" hideOnFailure>
              <AISummaryPanel />
            </RoleGuard>
          </div>
        </div>

        {/* Charts and Lists Bento */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Sales Trend */}
          <Card className="lg:col-span-8 !p-6 !rounded-[32px] bg-white border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-black text-[#1E4D4D]">اتجاه المبيعات الأسبوعي</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">آخر 7 أيام من النشاط المالي</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest">مباشر</div>
                <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:text-[#1E4D4D] transition-colors cursor-pointer">
                  <RefreshCw size={18} />
                </div>
              </div>
            </div>
            <div className="w-full" style={{ minHeight: '300px' }}>
              {isMounted && (
                <ResponsiveContainer width="100%" height="100%" aspect={2} debounce={50}>
                  <AreaChart data={stats.salesTrend}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 11, fontWeight: 700, fill: '#94a3b8'}} 
                    dy={15}
                  />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', fontSize: '12px', fontWeight: '900', padding: '16px' }}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#10B981" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Recent Transactions */}
          <Card className="lg:col-span-4 !p-6 !rounded-[32px] bg-white border border-slate-100 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-black text-[#1E4D4D]">أحدث العمليات</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">آخر الحركات</p>
              </div>
              <button onClick={() => onNavigate?.('logs')} className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline">عرض الكل</button>
            </div>
            <div className="flex-1 space-y-5">
              {stats.recentTransactions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 italic font-bold text-xs space-y-4">
                  <Activity size={48} />
                  <p>لا توجد عمليات مسجلة</p>
                </div>
              ) : (
                stats.recentTransactions.map((tx, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    key={idx} 
                    className="flex items-center justify-between p-5 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-white hover:shadow-xl hover:scale-[1.02] transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg ${tx.type === 'sale' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                        {tx.type === 'sale' ? <ShoppingCart size={24} /> : <PackagePlus size={24} />}
                      </div>
                      <div>
                        <p className="text-xs font-black text-[#1E4D4D]">{tx.type === 'sale' ? 'مبيعات' : 'مشتريات'}</p>
                        <p className="text-[10px] font-bold text-slate-400">{new Date(tx.date).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className={`text-sm font-black ${tx.type === 'sale' ? 'text-emerald-600' : 'text-blue-600'}`}>{tx.amount.toLocaleString()} {currency}</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </Card>
        </div>


      </main>
    </div>
  );
};

const QuickActionBtn = ({ icon, label, onClick, color }: { icon: React.ReactNode, label: string, onClick: () => void, color: string }) => (
  <motion.button 
    whileHover={{ scale: 1.02, y: -2 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="flex flex-col items-center justify-center gap-2 p-4 bg-white border border-slate-100 rounded-[24px] shadow-sm hover:shadow-md transition-all group h-full w-full"
  >
    <div className={`w-12 h-12 ${color} text-white rounded-2xl flex items-center justify-center shadow-md group-hover:rotate-3 transition-transform`}>
      {icon}
    </div>
    <span className="text-[10px] font-black text-[#1E4D4D] uppercase tracking-widest text-center">{label}</span>
  </motion.button>
);

export default Dashboard;
