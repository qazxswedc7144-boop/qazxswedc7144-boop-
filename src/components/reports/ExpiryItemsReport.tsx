
import React from 'react';
import BaseReportPage from './BaseReportPage';

const ExpiryItemsReport: React.FC<{ onNavigate: (v: string) => void }> = ({ onNavigate }) => {
  return (
    <BaseReportPage title="الأصناف حسب الإنتهاء" onNavigate={onNavigate}>
      <div className="text-slate-500 text-sm">جاري فحص تواريخ الإنتهاء...</div>
    </BaseReportPage>
  );
};

export default ExpiryItemsReport;
