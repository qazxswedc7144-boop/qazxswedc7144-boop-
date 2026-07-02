
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SafeMarkdown } from '@/components/shared/SafeMarkdown';
import { 
  BarChart3, PieChart, TrendingUp, Users, Truck, Package, 
  Calendar, History, ArrowRight, Search, 
  Layers, Clock, LayoutGrid, Sparkles, BrainCircuit,
  Download
} from 'lucide-react';

import { GeminiAnalyticsService } from '@/modules/ai/services/GeminiAnalyticsService';

interface ReportCardProps {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
  description: string;
  color: string;
}

const ReportCard: React.FC<ReportCardProps> = ({ title, icon, onClick, description, color }) => {
  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-3 p-6 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all group text-center relative overflow-hidden w-full border border-slate-100"
    >
      <div className={`w-16 h-16 ${color} rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-sm`}>
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-bold text-slate-800 mb-2 font-cairo group-hover:text-[#1E4D4D] transition-colors">
          {title}
        </h3>
        <p className="text-sm font-medium text-slate-500 leading-relaxed font-cairo max-w-2xl mx-auto">
          {description}
        </p>
      </div>
    </motion.button>
  );
};

interface ReportsModuleProps {
  onNavigate: (view: string, params?: any) => void;
}

const CATEGORIES = [
  { id: 'all', title: 'الكل', icon: <LayoutGrid size={18} /> },
  { id: 'stock', title: 'المخزون', icon: <Package size={18} /> },
  { id: 'sales', title: 'المبيعات', icon: <TrendingUp size={18} /> },
  { id: 'financial', title: 'المالية', icon: <BarChart3 size={18} /> },
  { id: 'partners', title: 'الشركاء', icon: <Users size={18} /> },
];

const REPORTS = [
  { 
    id: 'financial-engine', 
    category: 'financial',
    title: 'محرك التقارير المالية المتكامل', 
    icon: <BarChart3 size={24} className="text-white" />, 
    color: 'bg-emerald-700',
    route: 'reports/financial-engine',
    description: 'الميزان التجاري، الأرباح والخسائر، الميزانية العمومية، التدفقات النقدية، تقييم المخزون والضرائب مجمعة.'
  },
  { 
    id: 'remaining-stock', 
    category: 'stock',
    title: 'المخزون المتبقي', 
    icon: <Package size={24} className="text-white" />, 
    color: 'bg-blue-500',
    route: 'reports/remaining-stock',
    description: 'عرض الكميات المتاحة حالياً في جميع المستودعات مع تنبيهات النواقص.'
  },
  { 
    id: 'expiry-items', 
    category: 'stock',
    title: 'تقرير الصلاحية', 
    icon: <Calendar size={24} className="text-white" />, 
    color: 'bg-amber-500',
    route: 'reports/expiry-items',
    description: 'تنبيهات مبكرة للأصناف القريبة من الانتهاء لتقليل الهالك.'
  },
  { 
    id: 'item-movement-details', 
    category: 'stock',
    title: 'حركة الأصناف', 
    icon: <Layers size={24} className="text-white" />, 
    color: 'bg-purple-500',
    route: 'reports/item-movement-details',
    description: 'تتبع كامل لدورة حياة الصنف من التوريد وحتى البيع النهائي.'
  },
  { 
    id: 'sales-by-item', 
    category: 'sales',
    title: 'مبيعات الأصناف', 
    icon: <TrendingUp size={24} className="text-white" />, 
    color: 'bg-emerald-500',
    route: 'reports/sales-by-item',
    description: 'تحليل حجم المبيعات لكل صنف مع مقارنة الفترات الزمنية.'
  },
  { 
    id: 'item-profits', 
    category: 'sales',
    title: 'أرباح الأصناف', 
    icon: <BarChart3 size={24} className="text-white" />, 
    color: 'bg-indigo-500',
    route: 'reports/item-profits',
    description: 'تحليل الربحية لكل صنف بناءً على متوسط تكلفة الشراء وسعر البيع.'
  },
  { 
    id: 'customer-profit', 
    category: 'partners',
    title: 'أرباح العملاء', 
    icon: <Users size={24} className="text-white" />, 
    color: 'bg-pink-500',
    route: 'reports/customer-profit',
    description: 'تحديد العملاء الأكثر ربحية وتحليل حجم مشترياتهم السنوية.'
  },
  { 
    id: 'supplier-profit', 
    category: 'partners',
    title: 'أرباح الموردين', 
    icon: <Truck size={24} className="text-white" />, 
    color: 'bg-orange-500',
    route: 'reports/supplier-profit',
    description: 'تقييم الموردين بناءً على هوامش الربح وتكاليف التوريد.'
  },
  { 
    id: 'purchases-by-item', 
    category: 'stock',
    title: 'مشتريات الأصناف', 
    icon: <Download size={24} className="text-white" />, 
    color: 'bg-teal-500',
    route: 'reports/purchases-by-item',
    description: 'تقرير مجمع لجميع عمليات الشراء مصنفة حسب الصنف والمورد.'
  },
  { 
    id: 'account-movement', 
    category: 'financial',
    title: 'حركة الحسابات', 
    icon: <History size={24} className="text-white" />, 
    color: 'bg-slate-700',
    route: 'reports/account-movement',
    description: 'كشف تفصيلي لجميع الحركات المالية والقيود المحاسبية للفترة.'
  },
  { 
    id: 'aging-report', 
    category: 'financial',
    title: 'تعمير الذمم', 
    icon: <Clock size={24} className="text-white" />, 
    color: 'bg-red-500',
    route: 'aging-report',
    description: 'تحليل المديونيات المتأخرة للعملاء والموردين حسب الفترات الزمنية.'
  },
];

const ReportsModule: React.FC<ReportsModuleProps> = ({ onNavigate }) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  const filteredReports = useMemo(() => {
    return REPORTS.filter(report => {
      const matchesCategory = activeCategory === 'all' || report.category === activeCategory;
      const matchesSearch = report.title.includes(searchTerm) || report.description.includes(searchTerm);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchTerm]);

  const handleGenerateAIInsights = async () => {
    setIsAnalyzing(true);
    try {
      const analysis = await GeminiAnalyticsService.getEnterpriseInsights();
      setAiAnalysis(analysis);
    } catch (error) {
      console.error('AI Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full h-full bg-[#F8FAFA] font-cairo overflow-x-hidden w-full relative" dir="rtl" id="reports-module-root">
      {/* Header Section */}
      <header className="px-6 py-6 sm:p-10 pb-8 shrink-0 bg-white border-b border-slate-100 z-20 relative" id="reports-header-section">
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col">
          {/* Row 1: Single Horizontal Row [Back Arrow] [Reports Icon] مركز التقارير الذكي */}
          <div className="flex items-center gap-3 w-full" id="reports-header-row-1">
            <button 
              onClick={() => onNavigate?.('dashboard')}
              className="w-12 h-12 bg-white border-2 border-slate-50 text-[#1E4D4D] rounded-[18px] flex items-center justify-center shadow-lg shadow-slate-200/40 active:scale-95 active:bg-slate-100 hover:bg-slate-50 transition-all shrink-0"
              id="reports-back-btn"
            >
              <ArrowRight size={22} strokeWidth={3.5} />
            </button>
            <div className="w-12 h-12 bg-[#1E4D4D] text-white rounded-[18px] flex items-center justify-center shadow-md shrink-0" id="reports-icon-wrapper">
              <PieChart size={24} />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-[#1E4D4D] tracking-tight leading-none whitespace-nowrap overflow-hidden text-ellipsis flex-1" id="reports-arabic-title">
              مركز التقارير الذكي
            </h2>
          </div>

          {/* Row 2: English Subtitle */}
          <div className="w-full text-center" style={{ marginTop: '8px' }} id="reports-header-row-2">
            <p className="text-xs tracking-[0.25em] font-medium text-slate-400 whitespace-nowrap uppercase" id="reports-english-subtitle">
              Intelligence Reports Center
            </p>
          </div>

          {/* Row 3: Button - تحليل ذكي للأداء */}
          <div className="w-full" style={{ marginTop: '20px' }} id="reports-header-row-3">
            <button 
              onClick={handleGenerateAIInsights}
              disabled={isAnalyzing}
              className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-[#1E4D4D] text-white rounded-2xl font-black shadow-xl shadow-emerald-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
              id="btn-smart-analysis"
            >
              {isAnalyzing ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" id="btn-smart-analysis-spinner" />
              ) : (
                <Sparkles size={20} />
              )}
              {isAnalyzing ? 'جاري التحليل...' : 'تحليل ذكي للأداء'}
            </button>
          </div>

          {/* Row 4: Search Field */}
          <div className="w-full" style={{ marginTop: '16px' }} id="reports-header-row-4">
            <div className="w-full relative group" id="reports-search-input-wrapper">
              <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#1E4D4D] transition-colors" size={20} />
              <input 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-14 bg-slate-50 border border-slate-100 rounded-[20px] pr-14 pl-6 text-xs font-black focus:bg-white focus:border-[#1E4D4D] outline-none shadow-inner transition-all" 
                placeholder="ابحث عن تقرير" 
                id="reports-search-input"
              />
            </div>
          </div>

          {/* Category Tabs Section (positioned directly below Search Field with 16px mt) */}
          <div className="w-full flex justify-center" style={{ marginTop: '16px' }} id="reports-categories-container">
            <div className="flex items-center gap-2 p-1.5 bg-slate-50 rounded-[22px] border border-slate-100 overflow-x-auto no-scrollbar max-w-full justify-start md:justify-center" id="reports-categories-tabs-track">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-[18px] text-[11px] font-black transition-all whitespace-nowrap ${
                    activeCategory === cat.id 
                    ? 'bg-white text-[#1E4D4D] shadow-sm border border-slate-100' 
                    : 'text-slate-400 hover:text-[#1E4D4D]'
                  }`}
                  id={`cat-tab-${cat.id}`}
                >
                  {cat.icon}
                  {cat.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* AI Analysis Result */}
      <div className="max-w-7xl mx-auto px-6 w-full relative z-10" id="ai-analysis-wrapper">
        <AnimatePresence>
          {aiAnalysis && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 overflow-hidden"
              id="ai-analysis-container"
            >
              <div className="p-8 bg-white rounded-[32px] border border-emerald-100 shadow-2xl shadow-emerald-900/5 relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600" id="ai-analysis-icon">
                      <BrainCircuit size={28} id="ai-analysis-brain-icon-svg" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-[#1E4D4D]" id="ai-analysis-title">توصيات Gemini AI</h3>
                      <p className="text-[10px] text-slate-400 font-bold" id="ai-analysis-subtitle">تحليل شامل للبيانات المالية والتشغيلية</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setAiAnalysis(null)}
                    className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-slate-600 transition-colors"
                    id="btn-close-ai-analysis"
                  >
                    <ArrowRight className="rotate-180" size={20} id="btn-close-ai-analysis-arrow" />
                  </button>
                </div>
                <div className="prose prose-emerald max-w-none text-slate-600 leading-relaxed" id="ai-analysis-content-markdown">
                  <div className="markdown-body">
                    <SafeMarkdown>{aiAnalysis}</SafeMarkdown>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reports Grid */}
      <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="popLayout">
            {filteredReports.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-32 flex flex-col items-center justify-center text-center space-y-4 opacity-30"
              >
                <Search size={64} />
                <p className="text-lg font-black italic">لا توجد نتائج تطابق بحثك</p>
              </motion.div>
            ) : (
              <motion.div 
                layout
                className="grid grid-cols-1 gap-4"
              >
                {filteredReports.map((report) => (
                  <motion.div
                    layout
                    key={report.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ReportCard 
                      title={report.title}
                      icon={report.icon}
                      color={report.color}
                      description={report.description}
                      onClick={() => onNavigate(report.route)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer Info */}
      <footer className="px-10 py-4 bg-white border-t border-slate-100 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <p className="text-[10px] font-bold text-slate-400">إجمالي التقارير المتاحة: {REPORTS.length}</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">تحديث مباشر</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ReportsModule;
