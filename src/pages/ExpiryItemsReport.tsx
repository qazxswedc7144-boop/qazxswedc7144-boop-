
import React from 'react';
import BaseReportPage from '../components/BaseReportPage';

const ExpiryItemsReport: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  return (
    <BaseReportPage 
      title="تقرير الأصناف المنتهية" 
      subtitle="قائمة بالأصناف التي اقترب تاريخ انتهائها أو انتهت بالفعل"
      data={[]}
      columns={[]}
      onNavigate={onNavigate}
    />
  );
};

export default ExpiryItemsReport;
