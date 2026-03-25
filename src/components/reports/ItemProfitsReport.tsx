
import React from 'react';
import BaseReportPage from './BaseReportPage';

const ItemProfitsReport: React.FC<{ onNavigate: (v: string) => void }> = ({ onNavigate }) => {
  return (
    <BaseReportPage title="أرباح الأصناف" onNavigate={onNavigate}>
      <div className="text-slate-500 text-sm">جاري تحليل الأرباح...</div>
    </BaseReportPage>
  );
};

export default ItemProfitsReport;
