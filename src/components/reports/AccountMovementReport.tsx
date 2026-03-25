
import React from 'react';
import BaseReportPage from './BaseReportPage';

const AccountMovementReport: React.FC<{ onNavigate: (v: string) => void }> = ({ onNavigate }) => {
  return (
    <BaseReportPage title="حركة الحسابات" onNavigate={onNavigate}>
      <div className="text-slate-500 text-sm">جاري جلب كشف الحساب...</div>
    </BaseReportPage>
  );
};

export default AccountMovementReport;
