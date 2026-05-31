import React from 'react';

interface ResponsiveTableProps {
  children: React.ReactNode;
  maxHeightClass?: string;
}

export const ResponsiveTable: React.FC<ResponsiveTableProps> = ({ children, maxHeightClass = 'max-h-[60vh]' }) => {
  return (
    <div className={`w-full overflow-x-auto rounded-2xl border border-[#F1F5F9] bg-white ${maxHeightClass} custom-scrollbar relative`}>
      <table className="w-full text-right border-collapse min-w-[600px]">
        {children}
      </table>
    </div>
  );
};
