import React from 'react';

interface FormSectionProps {
  title?: string;
  children: React.ReactNode;
  columns?: '1' | '2' | '3' | 'dynamic';
  className?: string;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  children,
  columns = 'dynamic',
  className = '',
}) => {
  const getGridCols = () => {
    switch (columns) {
      case '1': return 'grid-cols-1';
      case '2': return 'grid-cols-1 md:grid-cols-2';
      case '3': return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      case 'dynamic':
      default: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {title && (
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mr-1 mb-2 select-none">
          {title}
        </h3>
      )}
      <div className={`grid gap-3.5 ${getGridCols()}`}>
        {children}
      </div>
    </div>
  );
};
