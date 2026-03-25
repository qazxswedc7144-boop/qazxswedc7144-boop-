
import React from 'react';
import BaseReportPage from './BaseReportPage';

const SalesByItemReport: React.FC<{ onNavigate: (v: string) => void }> = ({ onNavigate }) => {
  return (
    <BaseReportPage title="المبيعات حسب الصنف" onNavigate={onNavigate}>
      <div className="text-slate-500 text-sm">جاري جلب بيانات المبيعات...</div>
    </BaseReportPage>
  );
};

export default SalesByItemReport;
