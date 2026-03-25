
import React from 'react';
import { motion } from 'motion/react';
import { 
  Package, BarChart3, User, Factory, 
  ArrowLeftRight, ShoppingCart, Banknote, 
  ScrollText, Clock, ChevronLeft
} from 'lucide-react';

interface ReportCardProps {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
}

const ReportCard: React.FC<ReportCardProps> = ({ title, icon, onClick }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex flex-col items-center justify-center p-6 bg-white rounded-[16px] shadow-sm border border-slate-50 hover:shadow-md transition-all group relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-slate-50/50 opacity-0 group-active:opacity-100 transition-opacity" />
      <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-[#1E4D4D] mb-4 group-hover:bg-[#1E4D4D] group-hover:text-white transition-colors">
        {icon}
      </div>
      <span className="text-[13px] font-black text-[#1E4D4D] text-center leading-tight">
        {title}
      </span>
    </motion.button>
  );
};

interface ReportsModuleProps {
  onNavigate: (view: string, params?: any) => void;
}

const REPORTS = [
  { id: 'remaining-stock', title: 'المخزون المتبقي', icon: <Package size={24} />, route: 'reports/remaining-stock' },
  { id: 'item-profits', title: 'أرباح الأصناف', icon: <BarChart3 size={24} />, route: 'reports/item-profits' },
  { id: 'customer-profit', title: 'الربح على مستوى العميل', icon: <User size={24} />, route: 'reports/customer-profit' },
  { id: 'supplier-profit', title: 'الربح على مستوى المورد', icon: <Factory size={24} />, route: 'reports/supplier-profit' },
  { id: 'account-movement', title: 'حركة الحسابات', icon: <ArrowLeftRight size={24} />, route: 'reports/account-movement' },
  { id: 'purchases-by-item', title: 'المشتريات حسب الصنف', icon: <ShoppingCart size={24} />, route: 'reports/purchases-by-item' },
  { id: 'sales-by-item', title: 'المبيعات حسب الصنف', icon: <Banknote size={24} />, route: 'reports/sales-by-item' },
  { id: 'item-movement-details', title: 'تفاصيل حركة الأصناف', icon: <ScrollText size={24} />, route: 'reports/item-movement-details' },
  { id: 'expiry-items', title: 'الأصناف حسب الإنتهاء', icon: <Clock size={24} />, route: 'reports/expiry-items' },
];

const ReportsModule: React.FC<ReportsModuleProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col items-center justify-center space-y-2">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        <h2 className="text-xl font-black text-[#1E4D4D] px-4 py-2 bg-[#F8FAFA] relative -top-6">
          تقارير أخرى
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 px-1">
        {REPORTS.map((report) => (
          <ReportCard 
            key={report.id}
            title={report.title}
            icon={report.icon}
            onClick={() => onNavigate(report.route)}
          />
        ))}
      </div>
    </div>
  );
};

export default ReportsModule;
