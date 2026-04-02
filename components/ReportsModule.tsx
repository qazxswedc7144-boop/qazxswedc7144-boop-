
import React from 'react';
import { motion } from 'motion/react';
import { 
  BarChart3, PieChart, TrendingUp, Users, Truck, Package, 
  Calendar, History, FileText, ArrowRight, Home, Search,
  ChevronRight, Filter, Download, Share2, Printer, Layers, Clock
} from 'lucide-react';

interface ReportCardProps {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
  description: string;
}

const ReportCard: React.FC<ReportCardProps> = ({ title, icon, onClick, description }) => {
  return (
    <motion.button
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex items-center gap-6 p-6 bg-white rounded-[32px] shadow-sm border border-slate-100 hover:shadow-2xl hover:border-[#1E4D4D]/20 transition-all group text-right relative overflow-hidden h-full"
    >
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-slate-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="w-16 h-16 bg-slate-50 text-[#1E4D4D] rounded-[24px] flex items-center justify-center shrink-0 group-hover:bg-[#1E4D4D] group-hover:text-white transition-all shadow-inner relative z-10">
        {icon}
      </div>
      <div className="flex-1 relative z-10">
        <h3 className="text-lg font-black text-[#1E4D4D] mb-1 group-hover:translate-x-[-4px] transition-transform">
          {title}
        </h3>
        <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
          {description}
        </p>
      </div>
      <div className="shrink-0 text-[#1E4D4D] opacity-0 group-hover:opacity-100 transition-all relative z-10">
        <ChevronRight size={16} />
      </div>
    </motion.button>
  );
};

interface ReportsModuleProps {
  onNavigate: (view: string, params?: any) => void;
}

const REPORTS = [
  { 
    id: 'remaining-stock', 
    title: 'المخزون المتبقي', 
    icon: <Package size={28} />, 
    route: 'reports/remaining-stock',
    description: 'عرض الكميات المتاحة حالياً في جميع المستودعات مع تنبيهات النواقص.'
  },
  { 
    id: 'item-profits', 
    title: 'أرباح الأصناف', 
    icon: <BarChart3 size={28} />, 
    route: 'reports/item-profits',
    description: 'تحليل الربحية لكل صنف بناءً على متوسط تكلفة الشراء وسعر البيع.'
  },
  { 
    id: 'customer-profit', 
    title: 'أرباح العملاء', 
    icon: <Users size={28} />, 
    route: 'reports/customer-profit',
    description: 'تحديد العملاء الأكثر ربحية وتحليل حجم مشترياتهم السنوية.'
  },
  { 
    id: 'supplier-profit', 
    title: 'أرباح الموردين', 
    icon: <Truck size={28} />, 
    route: 'reports/supplier-profit',
    description: 'تقييم الموردين بناءً على هوامش الربح وتكاليف التوريد.'
  },
  { 
    id: 'account-movement', 
    title: 'حركة الحسابات', 
    icon: <History size={28} />, 
    route: 'reports/account-movement',
    description: 'كشف تفصيلي لجميع الحركات المالية والقيود المحاسبية للفترة.'
  },
  { 
    id: 'purchases-by-item', 
    title: 'مشتريات الأصناف', 
    icon: <Download size={28} />, 
    route: 'reports/purchases-by-item',
    description: 'تقرير مجمع لجميع عمليات الشراء مصنفة حسب الصنف والمورد.'
  },
  { 
    id: 'sales-by-item', 
    title: 'مبيعات الأصناف', 
    icon: <TrendingUp size={28} />, 
    route: 'reports/sales-by-item',
    description: 'تحليل حجم المبيعات لكل صنف مع مقارنة الفترات الزمنية.'
  },
  { 
    id: 'item-movement-details', 
    title: 'حركة الأصناف', 
    icon: <Layers size={28} />, 
    route: 'reports/item-movement-details',
    description: 'تتبع كامل لدورة حياة الصنف من التوريد وحتى البيع النهائي.'
  },
  { 
    id: 'expiry-items', 
    title: 'تقرير الصلاحية', 
    icon: <Calendar size={28} />, 
    route: 'reports/expiry-items',
    description: 'تنبيهات مبكرة للأصناف القريبة من الانتهاء لتقليل الهالك.'
  },
];

const ReportsModule: React.FC<ReportsModuleProps> = ({ onNavigate }) => {
  return (
    <div className="flex flex-col h-full bg-[#F8FAFA] font-['Cairo'] overflow-hidden" dir="rtl">
      {/* Modern Header */}
      <header className="p-10 pb-10 shrink-0 bg-white border-b border-slate-100 z-20 flex flex-col items-center justify-center text-center">
        <div className="flex flex-col items-center gap-6 mb-8">
          <div className="w-24 h-24 bg-[#1E4D4D] text-white rounded-[36px] flex items-center justify-center shadow-2xl shadow-emerald-900/40">
            <PieChart size={42} />
          </div>
          <div>
            <h2 className="text-5xl font-black text-[#1E4D4D] tracking-tighter leading-none mb-4">مركز التقارير</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-[4px] opacity-60">Advanced Analytics & Reporting</p>
          </div>
        </div>

        <div className="w-full max-w-2xl">
          <div className="relative">
            <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
            <input 
              className="w-full h-16 bg-slate-50 border border-slate-100 rounded-[24px] pr-16 pl-6 text-sm font-black focus:bg-white focus:border-[#1E4D4D] outline-none shadow-inner transition-all" 
              placeholder="ابحث عن تقرير محدد..." 
            />
          </div>
        </div>
      </header>

      {/* Reports Grid */}
      <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {REPORTS.map((report) => (
            <ReportCard 
              key={report.id}
              title={report.title}
              icon={report.icon}
              description={report.description}
              onClick={() => onNavigate(report.route)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReportsModule;
