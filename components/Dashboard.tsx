
import NotificationCenter from './NotificationCenter';
import { authService } from '../services/auth.service';
import React, { useMemo, useState, useEffect } from 'react';
import { useUI, useAccounting } from '../store/AppContext';
import { AccountingRepository } from '../repositories/AccountingRepository';
import { db } from '../services/database';
import { syncService } from '../services/sync.service';
import { FinancialHealthService } from '../services/FinancialHealthService';
import { useAppStore } from '../store/useAppStore';
import { Card, Badge } from './SharedUI';
import { FinancialHealthSnapshot } from '../types';
import InstallPWAButton from './InstallPWAButton';
import { UI_CONFIG } from '../constants';
import RoleGuard from './RoleGuard';
import { AISummaryPanel } from './AISummaryPanel';
import { ProfitHealthAnalyzer } from '../services/ProfitHealthAnalyzer';
import { motion } from 'motion/react';
import { 
  PackagePlus, FileText, DollarSign, PackageCheck, Sparkles as AutoAwesome,
  Users, Home, ShieldCheck, RefreshCw, Plus, ArrowUpRight, LayoutList, ShoppingCart,
  Clock, ArrowDownCircle, CreditCard, Wallet2, TrendingUp, Activity, BarChart3, PieChart as PieChartIcon,
  Search, Bell, Calendar, Package as PackageIcon, History
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [delayedSyncEnabled, setDelayedSyncEnabled] = useState(true);
  const [stats, setStats] = useState({ 
    todaySalesTotal: 0, 
    todayInvoicesCount: 0,
    activeInvoicesCount: 0,
    monthSalesTotal: 0,
    stockValue: 0,
    salesTrend: [] as any[],
    categoryData: [] as any[],
    recentTransactions: [] as any[]
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
        todaySalesTotal: todaySales.reduce((acc, s) => acc + s.amount, 0),
        todayInvoicesCount: todaySales.length,
        activeInvoicesCount: activeSales.length,
        monthSalesTotal: transactions.filter(t => t.type === 'sale').reduce((acc, s) => acc + s.amount, 0),
        stockValue: products.reduce((acc, p) => acc + (p.StockQuantity * (p.CostPrice || 0)), 0),
        salesTrend,
        categoryData,
        recentTransactions: transactions.slice(-5).reverse()
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
    <div className="h-full flex flex-col bg-[#F8FAFA] font-['Cairo'] overflow-hidden" dir="rtl">
      {/* Modern Header */}
      <div className="px-6 sm:px-10 py-8 bg-white/40 backdrop-blur-xl border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <NotificationCenter />
          <div>
            <h2 className="text-2xl font-black text-[#1E4D4D] tracking-tight leading-none mb-2">أهلاً بك، {user?.User_Name}</h2>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-full border border-slate-100 w-fit">
              <Calendar size={12} className="text-slate-400" />
              <span className="text-[10px] font-bold text-slate-500">{new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <QuickActionBtn icon={<PackageIcon size={24} />} label="المخزون" onClick={() => onNavigate?.('inventory')} color="bg-purple-500" />
          <QuickActionBtn icon={<Users size={24} />} label="العملاء" onClick={() => onNavigate?.('partners')} color="bg-blue-500" />
          <QuickActionBtn icon={<Wallet2 size={24} />} label="المحاسبة" onClick={() => onNavigate?.('accounting')} color="bg-amber-500" />
          <QuickActionBtn icon={<Clock size={24} />} label="تعمير الذمم" onClick={() => onNavigate?.('aging-report')} color="bg-red-500" />
          <QuickActionBtn icon={<ShieldCheck size={24} />} label="التدقيق" onClick={() => onNavigate?.('audit-history')} color="bg-emerald-600" />
          <QuickActionBtn icon={<History size={24} />} label="الأرشيف" onClick={() => onNavigate?.('invoices-archive')} color="bg-slate-500" />
        </div>

        {/* 2. Primary Stats Row - Below Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatMiniCard label="إيرادات اليوم" value={stats.todaySalesTotal} icon={<DollarSign size={24} />} color="border-emerald-500" unit={currency} />
          <StatMiniCard label="فواتير اليوم" value={stats.todayInvoicesCount} icon={<FileText size={24} />} color="border-[#1E4D4D]" unit="وثيقة" />
        </div>

        {/* 3. Secondary Stats Row - Visual Hierarchy */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatMiniCard label="فواتير نشطة" value={stats.activeInvoicesCount} icon={<Clock size={24} />} color="border-amber-500" unit="مسودة" />
          <StatMiniCard label="قيمة المخزون" value={stats.stockValue} icon={<PackageCheck size={24} />} color="border-blue-500" unit={currency} />
          <StatMiniCard label="مبيعات الشهر" value={stats.monthSalesTotal} icon={<Activity size={24} />} color="border-purple-500" unit={currency} />
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
              <div className="flex-1 h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
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
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
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
    className="flex flex-col items-center gap-2 p-4 bg-white border border-slate-100 rounded-[24px] shadow-sm hover:shadow-md transition-all group"
  >
    <div className={`w-12 h-12 ${color} text-white rounded-2xl flex items-center justify-center shadow-md group-hover:rotate-3 transition-transform`}>
      {icon}
    </div>
    <span className="text-[10px] font-black text-[#1E4D4D] uppercase tracking-widest">{label}</span>
  </motion.button>
);

export default Dashboard;
