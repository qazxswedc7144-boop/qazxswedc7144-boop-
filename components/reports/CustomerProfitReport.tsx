
import React from 'react';
import BaseReportPage from './BaseReportPage';

const CustomerProfitReport: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  return (
    <BaseReportPage 
      title="أرباح العملاء" 
      subtitle="تحليل الربحية لكل عميل"
      data={[]}
      columns={[]}
      onNavigate={onNavigate}
    />
  );
};

export default CustomerProfitReport;
