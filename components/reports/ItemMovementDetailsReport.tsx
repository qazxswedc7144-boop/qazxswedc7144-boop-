
import React from 'react';
import BaseReportPage from './BaseReportPage';

const ItemMovementDetailsReport: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  return (
    <BaseReportPage 
      title="تفاصيل حركة الصنف" 
      subtitle="سجل تفصيلي لكافة الحركات المخزنية لصنف معين"
      data={[]}
      columns={[]}
      onNavigate={onNavigate}
    />
  );
};

export default ItemMovementDetailsReport;
