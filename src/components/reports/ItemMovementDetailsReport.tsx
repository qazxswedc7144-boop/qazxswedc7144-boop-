
import React from 'react';
import BaseReportPage from './BaseReportPage';

const ItemMovementDetailsReport: React.FC<{ onNavigate: (v: string) => void }> = ({ onNavigate }) => {
  return (
    <BaseReportPage title="تفاصيل حركة الأصناف" onNavigate={onNavigate}>
      <div className="text-slate-500 text-sm">جاري جلب حركة الأصناف...</div>
    </BaseReportPage>
  );
};

export default ItemMovementDetailsReport;
