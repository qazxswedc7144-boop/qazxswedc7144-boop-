import React from 'react';

interface MobilePageLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  bottomBar?: React.ReactNode;
  dir?: 'rtl' | 'ltr';
}

export const MobilePageLayout: React.FC<MobilePageLayoutProps> = ({
  children,
  header,
  bottomBar,
  dir = 'rtl',
}) => {
  return (
    <div 
      className="flex flex-col min-h-screen h-screen bg-[#F8FAFA] font-cairo w-full relative overflow-hidden" 
      dir={dir}
    >
      {header && (
        <header className="sticky top-0 z-[100] shrink-0 bg-white border-b border-slate-100 shadow-sm">
          {header}
        </header>
      )}
      
      <main className="flex-1 overflow-y-auto bg-[#F8FAFA] custom-scrollbar px-4 py-3 md:p-6 pb-28 md:pb-24">
        <div className="max-w-7xl mx-auto space-y-4">
          {children}
        </div>
      </main>

      {bottomBar && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] md:static md:shadow-none md:border-t-0 md:bg-transparent md:px-0 md:py-0">
          <div className="max-w-7xl mx-auto">
            {bottomBar}
          </div>
        </div>
      )}
    </div>
  );
};
