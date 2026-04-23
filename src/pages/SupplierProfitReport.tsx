
import React from 'react';
import BaseReportPage from '../components/BaseReportPage';

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
