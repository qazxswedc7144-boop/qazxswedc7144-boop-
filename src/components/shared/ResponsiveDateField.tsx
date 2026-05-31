import React from 'react';

interface ResponsiveDateFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const ResponsiveDateField: React.FC<ResponsiveDateFieldProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1 w-full sm:w-auto">
      {label && <label className="text-sm font-bold text-slate-500 mb-1">{label}</label>}
      <div className="min-w-[160px] flex items-center h-12 px-4 border border-slate-100 rounded-2xl bg-slate-50/50 hover:border-slate-50 transition-colors focus-within:border-[#1E4D4D]/35 focus-within:bg-white overflow-hidden">
        <input
          type="date"
          className={`bg-transparent text-base font-medium text-[#1E4D4D] outline-none w-full text-center p-0 whitespace-nowrap ${className}`}
          {...props}
        />
      </div>
    </div>
  );
};
