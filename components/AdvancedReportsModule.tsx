import React, { useState, useEffect, useMemo } from 'react';
import { 
  Inventory2, ShowChart, PersonOutline, LocalShipping, 
  SwapHoriz, ShoppingCart, EventBusy, AutoAwesome,
  Download, FilterList, Refresh
} from '@mui/icons-material';
import { ArrowRight } from 'lucide-react';
import { db } from '@/services/database';
import { useUI } from '@/store/AppContext';
import { Card, Button, Badge, Modal, Input } from '@/components/SharedUI';
import { GeminiAnalyticsService } from '@/services/GeminiAnalyticsService';
import { AccountingReportsService } from '@/services/AccountingReportsService';
import Markdown from 'react-markdown';

const AdvancedReportsModule: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { addToast, currency } = useUI();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const sections = [
    { id: 'inventory', title: 'المخزون المتبقي', icon: <Inventory2 />, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'item-profits', title: 'أرباح الأصناف', icon: <ShowChart />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'customer-profits', title: 'الربح على مستوى العميل', icon: <PersonOutline />, color: 'text-orange-600', bg: 'bg-orange-50' },
    { id: 'supplier-profits', title: 'الربح على مستوى المورد', icon: <LocalShipping />, color: 'text-purple-600', bg: 'bg-purple-50' },
    { id: 'account-movements', title: 'حركة الحسابات', icon: <SwapHoriz />, color: 'text-red-600', bg: 'bg-red-50' },
    { id: 'purchases', title: 'المشتريات حسب الصنف', icon: <ShoppingCart />, color: 'text-teal-600', bg: 'bg-teal-50' },
    { id: 'expiring', title: 'الأصناف حسب الانتهاء', icon: <EventBusy />, color: 'text-amber-600', bg: 'bg-amber-50' },
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
      const analysis = await GeminiAnalyticsService.analyzeData(prompt, data.slice(0, 50)); // Limit data for AI
      setAiAnalysis(analysis);
    } catch (error) {
      addToast("فشل الاتصال بـ Gemini AI", "error");
    } finally {
      setIsAiLoading(false);
    }
  };

  const renderSectionContent = () => {
    if (loading) return <div className="p-20 text-center animate-pulse text-slate-400">جاري تحميل البيانات...</div>;
    if (!data.length) return <div className="p-20 text-center text-slate-300 italic">لا توجد بيانات متاحة حالياً لهذا القسم.</div>;

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={<Refresh sx={{ fontSize: 16 }} />} onClick={() => loadSectionData(activeSection!)}>تحديث</Button>
            <Button variant="secondary" size="sm" icon={<Download sx={{ fontSize: 16 }} />}>تصدير Excel</Button>
          </div>
          <Button 
            variant="approve" 
            size="md" 
            icon={<AutoAwesome sx={{ fontSize: 18 }} />} 
            onClick={handleAiAnalysis}
            disabled={isAiLoading}
          >
            {isAiLoading ? 'جاري التحليل...' : 'تحليل ذكي بواسطة Gemini'}
          </Button>
        </div>

        {aiAnalysis && (
          <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100 shadow-lg animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3 mb-4 text-indigo-600">
              <AutoAwesome />
              <h3 className="font-black text-lg">رؤية Gemini AI الذكية</h3>
            </div>
            <div className="prose prose-slate max-w-none text-right" dir="rtl">
              <Markdown>{aiAnalysis}</Markdown>
            </div>
          </Card>
        )}

        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
          <table className="w-full text-right">
            <thead className="bg-slate-50 text-slate-400 font-black text-xs uppercase tracking-widest">
              <tr>
                {activeSection === 'inventory' && (
                  <>
                    <th className="px-6 py-4">الصنف</th>
                    <th className="px-6 py-4">الفئة</th>
                    <th className="px-6 py-4">الكمية</th>
                    <th className="px-6 py-4">الحالة</th>
                  </>
                )}
                {activeSection === 'customer-profits' && (
                  <>
                    <th className="px-6 py-4">العميل</th>
                    <th className="px-6 py-4">إجمالي المشتريات</th>
                    <th className="px-6 py-4">صافي الربح</th>
                    <th className="px-6 py-4">عدد العمليات</th>
                  </>
                )}
                {activeSection === 'account-movements' && (
                  <>
                    <th className="px-6 py-4">التاريخ</th>
                    <th className="px-6 py-4">النوع</th>
                    <th className="px-6 py-4">المبلغ</th>
                    <th className="px-6 py-4">الوصف</th>
                  </>
                )}
                {activeSection === 'item-profits' && (
                  <>
                    <th className="px-6 py-4">الصنف</th>
                    <th className="px-6 py-4">المبيعات</th>
                    <th className="px-6 py-4">الربح</th>
                    <th className="px-6 py-4">الهامش</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  {activeSection === 'inventory' && (
                    <>
                      <td className="px-6 py-4 font-bold text-slate-700">{item.itemName}</td>
                      <td className="px-6 py-4 text-slate-500">{item.category}</td>
                      <td className="px-6 py-4 font-black">{item.currentQuantity}</td>
                      <td className="px-6 py-4">
                        <Badge variant={item.status === 'low_stock' ? 'danger' : 'success'}>
                          {item.status === 'low_stock' ? 'منخفض' : 'جيد'}
                        </Badge>
                      </td>
                    </>
                  )}
                  {activeSection === 'customer-profits' && (
                    <>
                      <td className="px-6 py-4 font-bold text-slate-700">{item.customerName}</td>
                      <td className="px-6 py-4 font-black">{item.totalPurchases.toLocaleString()} {currency}</td>
                      <td className="px-6 py-4 font-black text-emerald-600">{item.totalProfit.toLocaleString()} {currency}</td>
                      <td className="px-6 py-4 text-slate-400">{item.transactionsCount}</td>
                    </>
                  )}
                  {activeSection === 'account-movements' && (
                    <>
                      <td className="px-6 py-4 text-slate-500">{new Date(item.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <Badge variant={item.type === 'income' ? 'success' : 'danger'}>
                          {item.type === 'income' ? 'دخل' : 'مصروف'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-black">{item.amount.toLocaleString()} {currency}</td>
                      <td className="px-6 py-4 text-slate-600">{item.description}</td>
                    </>
                  )}
                  {activeSection === 'item-profits' && (
                    <>
                      <td className="px-6 py-4 font-bold text-slate-700">{item.itemName}</td>
                      <td className="px-6 py-4 font-black text-blue-600">{item.totalSales.toLocaleString()} {currency}</td>
                      <td className="px-6 py-4 font-black text-emerald-600">{item.grossProfit.toLocaleString()} {currency}</td>
                      <td className="px-6 py-4 text-slate-400">%{item.profitMargin}</td>
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
    <div className="flex flex-col h-full bg-[#F8FAFA] font-['Cairo'] overflow-hidden" dir="rtl">
      <div className="p-8 space-y-8 shrink-0 bg-white border-b border-slate-100 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-[#1E4D4D] text-white rounded-2xl flex items-center justify-center shadow-lg">
              <ShowChart sx={{ fontSize: 32 }} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#1E4D4D]">مركز التقارير والتحليلات الذكية</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Advanced Accounting Intelligence</p>
            </div>
          </div>
          <Button variant="secondary" icon={<ArrowRight />} onClick={activeSection ? () => setActiveSection(null) : onBack} title="العودة للرئيسية">
            {activeSection ? 'العودة للقائمة' : ''}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {!activeSection ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className="group relative bg-white p-6 rounded-[32px] border border-slate-100 hover:border-[#1E4D4D]/20 hover:shadow-2xl transition-all duration-500 text-right active:scale-95 flex items-center gap-5"
              >
                <div className={`w-16 h-16 ${section.bg} ${section.color} rounded-2xl flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-500`}>
                  {React.cloneElement(section.icon as React.ReactElement<any>, { sx: { fontSize: 32 } })}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-black text-[#1E4D4D] mb-1">{section.title}</h3>
                  <p className="text-[10px] text-slate-400 font-bold leading-relaxed">عرض التقارير التفصيلية والتحليلات الذكية.</p>
                </div>
                <div className="absolute bottom-4 left-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <AutoAwesome sx={{ fontSize: 18 }} className="text-indigo-400 animate-pulse" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          renderSectionContent()
        )}
      </div>
    </div>
  );
};

export default AdvancedReportsModule;
