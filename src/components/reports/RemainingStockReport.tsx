
import React from 'react';
import BaseReportPage from './BaseReportPage';

const RemainingStockReport: React.FC<{ onNavigate: (v: string) => void }> = ({ onNavigate }) => {
  return (
    <BaseReportPage title="المخزون المتبقي" onNavigate={onNavigate}>
      <div className="text-slate-500 text-sm">جاري جلب بيانات المخزون...</div>
    </BaseReportPage>
  );
};

export default RemainingStockReport;
