import React, { useState, useEffect } from 'react';
import { 
  Package, TrendingUp, User, Truck, 
  Repeat, ShoppingCart, CalendarOff, Sparkles
} from 'lucide-react';
import { db } from '@/core/db';
import { useUI } from '@/contexts/AppContext';
import { Badge } from '@/components/shared/SharedUI';
import { GeminiAnalyticsService } from '@/modules/ai/services/GeminiAnalyticsService';
import { AccountingReportsService } from '@/modules/accounting/services/AccountingReportsService';
import { SafeMarkdown } from '@/components/shared/SafeMarkdown';
import ReportPageLayout from '../components/ReportPageLayout';

const AdvancedReportsModule: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { addToast, currency } = useUI();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const sections = [
    { id: 'inventory', title: 'المخزون المتبقي', icon: <Package />, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'item-profits', title: 'أرباح الأصناف', icon: <TrendingUp />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'customer-profits', title: 'الربح على مستوى العميل', icon: <User />, color: 'text-orange-600', bg: 'bg-orange-50' },
    { id: 'supplier-profits', title: 'الربح على مستوى المورد', icon: <Truck />, color: 'text-purple-600', bg: 'bg-purple-50' },
    { id: 'account-movements', title: 'حركة الحسابات', icon: <Repeat />, color: 'text-red-600', bg: 'bg-red-50' },
    { id: 'purchases', title: 'المشتريات حسب الصنف', icon: <ShoppingCart />, color: 'text-teal-600', bg: 'bg-teal-50' },
    { id: 'expiring', title: 'الأصناف حسب الانتهاء', icon: <CalendarOff />, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  useEffect(() => {
    if (activeSection) {
      loadSectionData(activeSection);
    }
  }, [activeSection]);

  const loadSectionData = async (sectionId: string) => {
    setLoading(true);
    setAiAnalysis(null);
    try {
      let result: any[] = [];
      switch (sectionId) {
        case 'inventory':
          result = await AccountingReportsService.getLowStockItems();
          if (!result.length) result = await db.db.inventory.toArray();
          break;
        case 'item-profits':
          result = await db.db.itemProfits.toArray();
          break;
        case 'customer-profits':
          result = await AccountingReportsService.getTopProfitableCustomers();
          break;
        case 'supplier-profits':
          result = await db.db.supplierProfits.toArray();
          break;
        case 'account-movements':
          result = await AccountingReportsService.getRecentAccountMovements();
          break;
        case 'purchases':
          result = await db.db.purchasesByItem.toArray();
          break;
        case 'expiring':
          result = await AccountingReportsService.getExpiringSoonItems();
          break;
      }
      setData(result);
    } catch (error) {
      addToast("فشل تحميل البيانات", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAiAnalysis = async () => {
    if (!data.length) return;
    setIsAiLoading(true);
    try {
      const prompt = `قم بتحليل بيانات قسم ${sections.find(s => s.id === activeSection)?.title} واكتشف الأنماط، التناقضات، وقدم نصائح لتحسين الربحية والكفاءة.`;
      const analysis = await GeminiAnalyticsService.analyzeData(prompt, data.slice(0, 50)); 
      setAiAnalysis(analysis);
    } catch (error) {
      addToast("فشل الاتصال بـ Gemini AI", "error");
    } finally {
      setIsAiLoading(false);
    }
  };

  const renderSectionContent = () => {
    if (loading) return <div className="p-20 text-center animate-pulse text-slate-400 font-black">جاري تحميل البيانات...</div>;
    if (!data.length) return <div className="p-20 text-center text-slate-300 italic font-black">لا توجد بيانات متاحة لهذا القسم.</div>;

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-emerald-50 p-6 rounded-[24px] border border-emerald-100 shadow-inner">
          <div className="flex flex-col">
            <h4 className="text-sm font-black text-[#1E4D4D]">التحليلات الذكية</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Gemini AI Insights Engine</p>
          </div>
          <button 
            onClick={handleAiAnalysis}
            disabled={isAiLoading}
            className="px-6 py-3 bg-[#1E4D4D] text-white rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            {isAiLoading ? 'جاري التحليل...' : 'تحليل ذكي'}
            <Sparkles size={16} />
          </button>
        </div>

        {aiAnalysis && (
          <div className="bg-white p-8 rounded-[32px] border border-indigo-100 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500" />
            <div className="prose prose-slate max-w-none text-right" dir="rtl">
              <SafeMarkdown>{aiAnalysis}</SafeMarkdown>
            </div>
          </div>
        )}

        <div className="overflow-x-auto relative">
          <table className="w-full text-right zebra-table">
            <thead className="bg-[#F8FAFA] text-slate-400 font-black text-[10px] uppercase tracking-widest border-b border-slate-100">
              <tr>
                {activeSection === 'inventory' && (
                  <>
                    <th className="px-6 py-5">الصنف</th>
                    <th className="px-6 py-5">الفئة</th>
                    <th className="px-6 py-5">الكمية</th>
                    <th className="px-6 py-5">الحالة</th>
                  </>
                )}
                {activeSection === 'customer-profits' && (
                  <>
                    <th className="px-6 py-5">العميل</th>
                    <th className="px-6 py-5">إجمالي المشتريات</th>
                    <th className="px-6 py-5">صافي الربح</th>
                    <th className="px-6 py-5">عدد العمليات</th>
                  </>
                )}
                {activeSection === 'account-movements' && (
                  <>
                    <th className="px-6 py-5">التاريخ</th>
                    <th className="px-6 py-5">النوع</th>
                    <th className="px-6 py-5">المبلغ</th>
                    <th className="px-6 py-5">الوصف</th>
                  </>
                )}
                {activeSection === 'item-profits' && (
                  <>
                    <th className="px-6 py-5">الصنف</th>
                    <th className="px-6 py-5">المبيعات</th>
                    <th className="px-6 py-5">الربح</th>
                    <th className="px-6 py-5">الهامش</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  {activeSection === 'inventory' && (
                    <>
                      <td className="px-6 py-5 font-bold text-slate-700">{item.itemName}</td>
                      <td className="px-6 py-5 text-slate-500 text-xs">{item.category}</td>
                      <td className="px-6 py-5 font-black">{item.currentQuantity}</td>
                      <td className="px-6 py-5">
                        <Badge variant={item.status === 'low_stock' ? 'danger' : 'success'}>
                          {item.status === 'low_stock' ? 'منخفض' : 'جيد'}
                        </Badge>
                      </td>
                    </>
                  )}
                  {activeSection === 'customer-profits' && (
                    <>
                      <td className="px-6 py-5 font-bold text-slate-700">{item.customerName}</td>
                      <td className="px-6 py-5 font-black">{item.totalPurchases.toLocaleString()} {currency}</td>
                      <td className="px-6 py-5 font-black text-emerald-600">{item.totalProfit.toLocaleString()} {currency}</td>
                      <td className="px-6 py-5 text-slate-400 text-xs">{item.transactionsCount}</td>
                    </>
                  )}
                  {activeSection === 'account-movements' && (
                    <>
                      <td className="px-6 py-5 text-slate-500 text-xs">{new Date(item.date).toLocaleDateString()}</td>
                      <td className="px-6 py-5">
                        <Badge variant={item.type === 'income' ? 'success' : 'danger'}>
                          {item.type === 'income' ? 'دخل' : 'مصروف'}
                        </Badge>
                      </td>
                      <td className="px-6 py-5 font-black">{item.amount.toLocaleString()} {currency}</td>
                      <td className="px-6 py-5 text-slate-600 text-xs">{item.description}</td>
                    </>
                  )}
                  {activeSection === 'item-profits' && (
                    <>
                      <td className="px-6 py-5 font-bold text-slate-700">{item.itemName}</td>
                      <td className="px-6 py-5 font-black text-blue-600">{item.totalSales.toLocaleString()} {currency}</td>
                      <td className="px-6 py-5 font-black text-emerald-600">{item.grossProfit.toLocaleString()} {currency}</td>
                      <td className="px-6 py-5 text-slate-400 text-xs">%{item.profitMargin}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <ReportPageLayout
      title={activeSection ? sections.find(s => s.id === activeSection)?.title || 'التقارير المتقدمة' : 'مركز التقارير والتحليلات'}
      onBack={activeSection ? () => setActiveSection(null) : onBack}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      onPrint={() => window.print()}
    >
      <div className="p-8">
        {!activeSection ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className="group relative bg-white p-6 rounded-[32px] border border-slate-100 hover:border-[#1E4D4D]/20 hover:shadow-xl transition-all duration-500 text-right active:scale-95 flex items-center gap-5"
              >
                <div className={`w-16 h-16 ${section.bg} ${section.color} rounded-2xl flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-500`}>
                  {React.cloneElement(section.icon as React.ReactElement<any>, { sx: { fontSize: 32 } })}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-black text-[#1E4D4D] mb-1">{section.title}</h3>
                  <p className="text-[10px] text-slate-400 font-bold leading-relaxed">عرض التقارير التفصيلية والتحليلات الذكية.</p>
                </div>
                <Sparkles size={18} className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 left-6" />
              </button>
            ))}
          </div>
        ) : (
          renderSectionContent()
        )}
      </div>
    </ReportPageLayout>
  );
};

export default AdvancedReportsModule;
