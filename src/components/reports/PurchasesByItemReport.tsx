
import React from 'react';
import BaseReportPage from './BaseReportPage';

const PurchasesByItemReport: React.FC<{ onNavigate: (v: string) => void }> = ({ onNavigate }) => {
  return (
    <BaseReportPage title="المشتريات حسب الصنف" onNavigate={onNavigate}>
      <div className="text-slate-500 text-sm">جاري جلب بيانات المشتريات...</div>
    </BaseReportPage>
  );
};

export default PurchasesByItemReport;
