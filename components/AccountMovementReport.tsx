
import React from 'react';
import BaseReportPage from './reports/BaseReportPage';

const AccountMovementReport: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  return (
    <BaseReportPage 
      title="حركة الحسابات" 
      subtitle="كشف تفصيلي لحركات الحسابات المالية"
      data={[]}
      columns={[]}
      onNavigate={onNavigate}
    />
  );
};

export default AccountMovementReport;
