import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface ResponsiveHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
}

export const ResponsiveHeader: React.FC<ResponsiveHeaderProps> = ({
  title,
  subtitle,
  onBack,
  actions,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white select-none">
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-[#1E4D4D] hover:bg-slate-100 transition-all shrink-0 active:scale-95"
            type="button"
          >
            <ArrowLeft size={18} className="transform rotate-180" />
          </button>
        )}
        <div>
          <h1 className="text-base font-black text-slate-800 tracking-tight leading-tight">{title}</h1>
          {subtitle && <p className="text-[11px] font-bold text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {actions}
        </div>
      )}
    </div>
  );
};
