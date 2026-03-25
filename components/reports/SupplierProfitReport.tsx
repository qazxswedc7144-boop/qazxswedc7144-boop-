
import React from 'react';
import BaseReportPage from './BaseReportPage';

const SupplierProfitReport: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  return (
    <BaseReportPage 
      title="أرباح الموردين" 
      subtitle="تحليل الربحية لكل مورد"
      data={[]}
      columns={[]}
      onNavigate={onNavigate}
    />
  );
};

export default SupplierProfitReport;
