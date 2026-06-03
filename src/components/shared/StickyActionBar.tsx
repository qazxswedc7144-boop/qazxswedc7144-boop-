import React from 'react';

interface StickyActionBarProps {
  children: React.ReactNode;
}

export const StickyActionBar: React.FC<StickyActionBarProps> = ({ children }) => {
  return (
    <div className="sticky bottom-0 w-full z-50 bg-white border-t border-[#E2E8F0] p-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] md:relative md:border-0 md:p-0 md:shadow-none bg-opacity-95 backdrop-blur-md rounded-b-2xl">
      <div className="max-w-7xl mx-auto flex gap-3 items-center justify-between">
        {children}
      </div>
    </div>
  );
};
