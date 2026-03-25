
import React from 'react';
import BaseReportPage from './BaseReportPage';

const SupplierProfitReport: React.FC<{ onNavigate: (v: string) => void }> = ({ onNavigate }) => {
  return (
    <BaseReportPage title="الربح على مستوى المورد" onNavigate={onNavigate}>
      <div className="text-slate-500 text-sm">جاري حساب أرباح الموردين...</div>
    </BaseReportPage>
  );
};

export default SupplierProfitReport;
