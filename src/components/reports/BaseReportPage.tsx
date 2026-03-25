
import React from 'react';
import { ChevronLeft, Home } from 'lucide-react';

interface BaseReportPageProps {
  title: string;
  children: React.ReactNode;
  onNavigate: (view: string) => void;
}

const BaseReportPage: React.FC<BaseReportPageProps> = ({ title, children, onNavigate }) => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
        <button 
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-1 hover:text-[#1E4D4D] transition-colors"
        >
          <Home size={12} />
          الرئيسية
        </button>
        <ChevronLeft size={12} />
        <button 
          onClick={() => onNavigate('reports')}
          className="hover:text-[#1E4D4D] transition-colors"
        >
          التقارير
        </button>
        <ChevronLeft size={12} />
        <span className="text-[#1E4D4D]">{title}</span>
      </nav>

      <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-50 min-h-[400px]">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-lg font-black text-[#1E4D4D]">{title}</h2>
        </div>
        
        {children}
      </div>
    </div>
  );
};

export default BaseReportPage;
