import React from 'react';

interface SubscriptionContactFooterProps {
  supportNumber: string; // مثال: "+96777xxxxxxx"
  systemVersion?: string;
}

export const SubscriptionContactFooter: React.FC<SubscriptionContactFooterProps> = ({ 
  supportNumber, 
  systemVersion = "1.0.0" 
}) => {
  
  // تجهيز روابط بروتوكولات الأجهزة الذكية للنظام المباشر
  const whatsappUrl = `https://wa.me/${supportNumber.replace('+', '')}?text=${encodeURIComponent('مرحباً إدارة PharmaFlow Pro، أود الاستفسار عن باقات الترقية والاشتراك السحابي لتطبيقي.')}`;
  const phoneUrl = `tel:${supportNumber}`;
  const smsUrl = `sms:${supportNumber}?body=${encodeURIComponent('أود ترقية حساب الصيدلية الخاص بي في PharmaFlow Pro.')}`;

  return (
    <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 text-center font-sans" dir="rtl">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
        لطلب الترقية الفورية أو الدعم الفني، تواصل مع الإدارة مباشرة:
      </p>
      
      {/* شبكة أزرار الاتصال الذكية */}
      <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
        
        {/* زر الواتساب */}
        <a 
          href={whatsappUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-600 hover:text-white transition-all duration-150 py-2 px-3 rounded-lg text-xs font-bold shadow-sm"
        >
          💬 واتساب
        </a>

        {/* زر الاتصال المباشر */}
        <a 
          href={phoneUrl}
          className="flex items-center justify-center gap-1.5 bg-blue-600/10 hover:bg-blue-600 text-blue-600 hover:text-white transition-all duration-150 py-2 px-3 rounded-lg text-xs font-bold shadow-sm"
        >
          📞 اتصال مباشر
        </a>

        {/* زر رسالة SMS */}
        <a 
          href={smsUrl}
          className="flex items-center justify-center gap-1.5 bg-slate-600/10 hover:bg-slate-600 text-slate-600 hover:text-white transition-all duration-150 py-2 px-3 rounded-lg text-xs font-bold shadow-sm"
        >
          ✉️ رسالة SMS
        </a>

      </div>

      {/* رقم العرض النصي أسفل الأزرار لزيادة الموثوقية وقراءته مباشرة */}
      <div className="mt-3 text-[11px] font-mono text-slate-400 dark:text-slate-500">
        رقم مركز الاشتراكات المعتمد: {supportNumber} | إصدار النظام: {systemVersion}
      </div>
    </div>
  );
};
