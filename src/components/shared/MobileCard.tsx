import React from 'react';

interface MobileCardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const MobileCard: React.FC<MobileCardProps> = ({
  title,
  subtitle,
  children,
  actions,
  className = '',
}) => {
  return (
    <div className={`p-4 bg-white rounded-2xl border border-[#F1F5F9] shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-3 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#F8FAFC] select-none">
          <div>
            {title && <h2 className="text-sm font-black text-[#1E4D4D] tracking-tight">{title}</h2>}
            {subtitle && <p className="text-[10px] font-bold text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
        </div>
      )}
      <div className="text-sm text-slate-600">
        {children}
      </div>
    </div>
  );
};
