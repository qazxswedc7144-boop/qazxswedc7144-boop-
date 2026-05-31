import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  dir?: 'rtl' | 'ltr';
}

export const PageContainer: React.FC<PageContainerProps> = ({ children, className = '', dir = 'rtl' }) => {
  return (
    <div className={`p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto pb-32 md:pb-24 ${className}`} dir={dir}>
      {children}
    </div>
  );
};
