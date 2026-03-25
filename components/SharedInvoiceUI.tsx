
import React from 'react';
import { Lock, ShieldAlert, BadgeInfo } from 'lucide-react';
import { Badge } from './SharedUI';
import { PaymentStatus } from '../types';

/**
 * Locked Banner - تنبيه المستند المقفل (Phase 11 Support)
 * يظهر عندما تكون الفترة مقفلة أو المستند مسدد (أو جزء منه)
 */
export const InvoiceLockedBanner: React.FC<{ isPeriodLocked: boolean, isAdmin: boolean, financialStatus: string }> = ({ 
  isPeriodLocked, isAdmin, financialStatus 
}) => {
  const isFinancialLocked = financialStatus && financialStatus !== 'Unpaid';
  if (!isPeriodLocked && !isFinancialLocked) return null;

  return (
    <div className={`p-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-1 rounded-xl border ${isPeriodLocked ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-blue-50 border-blue-100 text-blue-800'}`}>
       {isPeriodLocked ? <Lock size={18} className="text-amber-500" /> : <ShieldAlert size={18} className="text-blue-500" />}
       <div className="flex flex-col">
          <p className="text-[10px] font-black leading-tight">
             {isPeriodLocked && !isAdmin ? "هذا المستند يقع ضمن فترة محاسبية مغلقة 🔒." : 
              isFinancialLocked ? `هذا المستند مقفل للتعديل لاحتوائه على دفعات مالية مسجلة (${financialStatus}).` : "مستند للقراءة فقط"}
          </p>
          {isPeriodLocked && isAdmin && <p className="text-[8px] font-bold opacity-60">Admin Override Active: يمكنك التعديل بصفتك مديراً.</p>}
       </div>
    </div>
  );
};

/**
 * Payment Status Indicator - مؤشر حالة السداد الموحد
 */
export const PaymentBadge: React.FC<{ status: PaymentStatus }> = ({ status }) => {
  switch(status) {
    case 'Paid': return <Badge variant="success">مسددة بالكامل</Badge>;
    case 'Partially Paid': return <Badge variant="warning">مسددة جزئياً</Badge>;
    case 'Unpaid': return <Badge variant="danger">غير مسددة</Badge>;
    default: return <Badge variant="neutral">{status}</Badge>;
  }
};

/**
 * Common Input Handler for KeyDown (Shared logic)
 */
export const handleInvoiceKeyDown = (e: React.KeyboardEvent, nextAction: () => void) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    nextAction();
  }
};
