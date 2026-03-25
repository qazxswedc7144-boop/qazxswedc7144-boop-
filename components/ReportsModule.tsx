
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
      className="flex flex-col p-8 bg-white rounded-[40px] shadow-sm border border-slate-100 hover:shadow-2xl hover:border-[#1E4D4D]/20 transition-all group text-right relative overflow-hidden h-full"
    >
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-slate-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="w-16 h-16 bg-slate-50 text-[#1E4D4D] rounded-[24px] flex items-center justify-center mb-6 group-hover:bg-[#1E4D4D] group-hover:text-white transition-all shadow-inner">
        {icon}
      </div>
      <h3 className="text-lg font-black text-[#1E4D4D] mb-2 group-hover:translate-x-[-4px] transition-transform">
        {title}
      </h3>
      <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
        {description}
      </p>
      <div className="mt-auto pt-6 flex items-center justify-end text-[#1E4D4D] opacity-0 group-hover:opacity-100 transition-all">
        <span className="text-[10px] font-black uppercase tracking-widest ml-2">فتح التقرير</span>
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
  { 
    id: 'aging-report', 
    title: 'تعمير الذمم (Aging)', 
    icon: <Clock size={28} />, 
    route: 'aging-report',
    description: 'تحليل مديونيات العملاء والموردين المتأخرة حسب الفترات الزمنية (0-90+ يوم).'
  },
];

const ReportsModule: React.FC<ReportsModuleProps> = ({ onNavigate }) => {
  return (
    <div className="flex flex-col h-full bg-[#F8FAFA] font-['Cairo'] overflow-hidden" dir="rtl">
      {/* Modern Header */}
      <header className="p-10 pb-6 shrink-0 bg-white border-b border-slate-100 z-20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10">
          <div className="flex items-center gap-8">
            <div className="w-20 h-20 bg-[#1E4D4D] text-white rounded-[32px] flex items-center justify-center shadow-2xl shadow-emerald-900/40">
              <PieChart size={36} />
            </div>
            <div>
              <h2 className="text-4xl font-black text-[#1E4D4D] tracking-tighter leading-none">مركز التقارير</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-[4px] mt-3 opacity-60">Advanced Analytics & Reporting</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="h-14 px-8 bg-white border border-slate-100 text-[#1E4D4D] rounded-[20px] flex items-center gap-3 text-sm font-black shadow-sm hover:bg-slate-50 transition-all">
              <Printer size={20} />
              <span>طباعة الكل</span>
            </button>
            <button 
              onClick={() => onNavigate('dashboard')}
              className="w-14 h-14 bg-slate-50 text-slate-400 rounded-[20px] flex items-center justify-center hover:bg-slate-100 transition-all"
            >
              <Home size={24} />
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="relative flex-1">
            <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
            <input 
              className="w-full h-16 bg-slate-50 border border-slate-100 rounded-[24px] pr-16 pl-6 text-sm font-black focus:bg-white focus:border-[#1E4D4D] outline-none shadow-inner transition-all" 
              placeholder="ابحث عن تقرير محدد..." 
            />
          </div>
          
          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-[24px] border border-slate-100">
            <button className="px-8 h-12 rounded-[18px] text-[11px] font-black transition-all bg-[#1E4D4D] text-white shadow-lg">جميع التقارير</button>
            <button className="px-8 h-12 rounded-[18px] text-[11px] font-black transition-all text-slate-400 hover:text-slate-600">تقارير مالية</button>
            <button className="px-8 h-12 rounded-[18px] text-[11px] font-black transition-all text-slate-400 hover:text-slate-600">تقارير مخزنية</button>
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

        {/* Footer Info */}
        <div className="mt-16 p-10 bg-white border border-slate-100 rounded-[48px] flex flex-col md:flex-row items-center justify-between gap-8 opacity-60">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm font-black text-[#1E4D4D]">تحتاج لتقرير مخصص؟</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1">يمكنك طلب تقارير مخصصة من فريق الدعم الفني.</p>
            </div>
          </div>
          <button className="px-8 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all">
            طلب تقرير مخصص
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportsModule;
