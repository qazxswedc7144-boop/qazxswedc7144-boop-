
import React from 'react';
import BaseReportPage from './BaseReportPage';

const CustomerProfitReport: React.FC<{ onNavigate: (v: string) => void }> = ({ onNavigate }) => {
  return (
    <BaseReportPage title="الربح على مستوى العميل" onNavigate={onNavigate}>
      <div className="text-slate-500 text-sm">جاري حساب أرباح العملاء...</div>
    </BaseReportPage>
  );
};

export default CustomerProfitReport;
