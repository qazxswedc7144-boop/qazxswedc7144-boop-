import React from 'react';
import { sanitizeHTML } from '@/services/print/sanitizeHTML';

export interface InvoiceItem {
  name: string;
  qty: number;
  price: number;
  sum: number;
}

export interface InvoiceTemplateProps {
  data: any;
  type: 'SALE' | 'PURCHASE' | 'VOUCHER' | 'REPORT';
  items?: InvoiceItem[];
  mode: 'A4' | 'THERMAL';
  layoutConfig?: {
    primaryColor?: string;
    font?: string;
  };
  invoiceConfig?: {
    pharmacyName?: string;
    address?: string;
    phone?: string;
    taxNumber?: string;
    footerNote?: string;
  };
}

export const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({
  data,
  type,
  items: propItems,
  mode,
  layoutConfig = { primaryColor: '#1E4D4D', font: 'Cairo' },
  invoiceConfig = {
    pharmacyName: 'PharmaFlow ERP Pro',
    address: 'شارع الشيخ زايد، دبي، الإمارات العربية المتحدة',
    phone: '+971 4 123 4567',
    taxNumber: '100234567800003',
    footerNote: 'شكراً لزيارتكم! متمنين لكم دوام الصحة والعافية.'
  }
}) => {
  const refId = data.SaleID || data.invoiceId || data.purchase_id || data.id || 'N/A';
  const displayDate = new Date(data.date || data.Date || data.timestamp || Date.now()).toLocaleDateString('ar-AE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const finalItems: InvoiceItem[] = propItems || data.items || [];
  const total = Number(data.finalTotal || data.totalAmount || data.amount || 0);
  const taxRate = 0.05; // 5% VAT
  const vatAmount = total * (taxRate / (1 + taxRate)); // inclusive tax calculation
  const netTotal = total - vatAmount;

  // Render raw notes safely using SanitizeHTML constraint
  const rawNoteHTML = data.notes || data.Notes || '';
  const sanitizedNote = sanitizeHTML(rawNoteHTML);

  if (mode === 'THERMAL') {
    // High-performance thermal printer support (80mm narrow POS monochrome structure)
    return (
      <div 
        dir="rtl" 
        className="w-[80mm] max-w-[80mm] bg-white text-black text-[11px] font-mono leading-relaxed p-2 mx-auto"
        style={{ fontFamily: 'Courier, monospace' }}
      >
        {/* Header */}
        <div className="text-center border-b border-dashed border-gray-400 pb-2 mb-2">
          <h2 className="text-sm font-bold tracking-tight uppercase m-0 leading-tight">
            {invoiceConfig.pharmacyName}
          </h2>
          <p className="text-[9px] m-0 mt-0.5 opacity-80">{invoiceConfig.address}</p>
          <p className="text-[9px] m-0 opacity-80">هاتف: {invoiceConfig.phone}</p>
          <p className="text-[9px] m-0 font-bold mt-1">الرقم الضريبي: {invoiceConfig.taxNumber}</p>
        </div>

        {/* Invoice Info */}
        <div className="space-y-0.5 mb-2 pb-2 border-b border-dashed border-gray-400 text-[10px]">
          <div className="flex justify-between">
            <span>نوع المستند:</span>
            <span className="font-bold">
              {type === 'SALE' ? 'فاتورة مبسطة' : 
               type === 'PURCHASE' ? 'فاتورة شراء مبسطة' : 
               type === 'VOUCHER' ? 'سند قبض/صرف' : 'تقرير مخازن'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>رقم المستند:</span>
            <span className="font-bold">#{refId}</span>
          </div>
          <div className="flex justify-between">
            <span>التاريخ:</span>
            <span>{displayDate}</span>
          </div>
          <div className="flex justify-between">
            <span>العميل:</span>
            <span className="font-bold">{data.customerId || data.partnerName || data.name || 'عميل نقدي'}</span>
          </div>
        </div>

        {/* Table Items */}
        {type !== 'REPORT' ? (
          <div className="mb-2 pb-2 border-b border-dashed border-gray-400">
            <div className="flex justify-between font-bold border-b border-gray-400 pb-1 mb-1 text-[10px]">
              <span className="w-1/2 text-right">الصنف</span>
              <span className="w-1/6 text-center">الكمية</span>
              <span className="w-1/3 text-left">المجموع</span>
            </div>
            <div className="space-y-1">
              {finalItems.map((item, index) => (
                <div key={index} className="flex justify-between">
                  <span className="w-1/2 text-right truncate font-bold">{item.name}</span>
                  <span className="w-1/6 text-center">x{item.qty}</span>
                  <span className="w-1/3 text-left font-bold">{(item.sum || (item.price * item.qty)).toFixed(2)}</span>
                </div>
              ))}
              {type === 'VOUCHER' && (
                <div className="text-center py-2 italic text-[10px]">
                  {sanitizedNote ? (
                    <div dangerouslySetInnerHTML={{ __html: sanitizedNote }} />
                  ) : (
                    "سند نقدي مرجعي من النظام"
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-2 pb-2 border-b border-dashed border-gray-400">
            <p className="text-center font-bold tracking-wider underline mb-1">{data.reportName || 'تقرير عام'}</p>
            <div className="space-y-1 text-[10px]">
              {(data.summary || []).map((s: any, idx: number) => (
                <div key={idx} className="flex justify-between">
                  <span>{s.label}:</span>
                  <span className="font-bold">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totals Section */}
        <div className="space-y-1 text-[11px] pb-2 mb-2 border-b border-dashed border-gray-400">
          <div className="flex justify-between text-[10px]">
            <span>الإجمالي الخاضع للضريبة (Net):</span>
            <span>{netTotal.toFixed(2)} AED</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span>ضريبة القيمة المضافة (5% VAT):</span>
            <span>{vatAmount.toFixed(2)} AED</span>
          </div>
          <div className="flex justify-between text-xs font-black pt-1 border-t border-dotted border-gray-500">
            <span>الإجمالي المستحق (Total):</span>
            <span>{total.toFixed(2)} AED</span>
          </div>
        </div>

        {/* Footer Barcode / QR Placeholder and message */}
        <div className="text-center space-y-1 text-[9px] mt-2 opacity-90 leading-normal">
          <p className="font-bold">{invoiceConfig.footerNote}</p>
          <div className="py-2 inline-block">
            {/* Safe visual custom barcode layout for thermal POS output */}
            <div className="flex justify-center gap-0.5 items-center h-6 bg-black px-4 py-1 rounded">
              <span className="text-white text-[8px] font-bold tracking-widest leading-none">*{refId}*</span>
            </div>
          </div>
          <p className="text-[8px] uppercase font-bold text-gray-400">PharmaFlow POS Secure Printing V2.5</p>
        </div>
      </div>
    );
  }

  // Standard A4 Layout with modern elegant enterprise aesthetics
  return (
    <div 
      dir="rtl" 
      className="max-w-4xl mx-auto bg-white p-10 rounded-[32px] border border-slate-200 shadow-xl relative min-h-[29.7cm] flex flex-col justify-between font-sans leading-relaxed"
      style={{ fontFamily: layoutConfig.font || 'Cairo, sans-serif' }}
    >
      {/* Decorative top border layout color */}
      <div 
        className="absolute top-0 left-0 right-0 h-3 rounded-t-[32px]"
        style={{ backgroundColor: layoutConfig.primaryColor }}
      />

      {/* Corporate Header Block */}
      <div>
        <div className="flex justify-between items-start mb-10 pb-6 border-b-2 border-slate-100">
          <div>
            <h1 
              className="text-3xl font-black tracking-tight"
              style={{ color: layoutConfig.primaryColor }}
            >
              {invoiceConfig.pharmacyName}
            </h1>
            <p className="text-xs text-slate-500 font-bold mt-1.5 leading-snug max-w-xs">{invoiceConfig.address}</p>
            <p className="text-xs text-slate-500 font-bold mt-1">الهاتف: {invoiceConfig.phone}</p>
            <p className="text-xs text-slate-500 font-black mt-1">الرقم الضريبي المستحق: {invoiceConfig.taxNumber}</p>
          </div>
          <div className="text-left font-sans">
            <span 
              className="inline-block px-4 py-1.5 text-[10px] font-black tracking-widest uppercase rounded-full mb-3"
              style={{ backgroundColor: `${layoutConfig.primaryColor}15`, color: layoutConfig.primaryColor }}
            >
              Enterprise Safe Layout
            </span>
            <h2 className="text-2xl font-black uppercase text-slate-800 tracking-tight">
              {type === 'SALE' ? 'فاتورة مبيعات' : 
               type === 'PURCHASE' ? 'فاتورة مشتريات' : 
               type === 'VOUCHER' ? 'سند مالي معتمد' : 'تقرير إداري رسمي'}
            </h2>
            <p className="text-sm font-black text-slate-600 mt-1">رمز المستند: <span className="font-mono">#{refId}</span></p>
            <p className="text-xs text-slate-400 font-medium mt-0.5">{displayDate}</p>
          </div>
        </div>

        {/* Billing Info Grid */}
        <div className="grid grid-cols-2 gap-8 mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">بيانات الطرف الثنائي</p>
            <p className="text-base font-black text-[#1E4D4D]">{data.customerId || data.partnerName || data.name || 'عميل نقدي عام'}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-bold">الرقم المرجعي أو الهاتف: {data.phone || '-'}</p>
          </div>
          <div className="text-left">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">حالة الحساب المالي</p>
            <span className="inline-block px-3 py-1 text-xs font-black text-emerald-700 bg-emerald-50 rounded-lg">
              {type === 'VOUCHER' ? 'سند مقيد ومعتمد' : 'جاهز ومعتمد ضريبياً'}
            </span>
            <p className="text-[10px] text-slate-400 mt-1.5 font-bold">الرقم الضريبي للمستند: {invoiceConfig.taxNumber}</p>
          </div>
        </div>

        {/* Details Table */}
        {type !== 'REPORT' ? (
          <div className="mb-8 overflow-hidden rounded-2xl border border-slate-100">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200">
                  <th className="py-4 px-6 text-xs font-black text-[#1E4D4D]">الصنف / البيان</th>
                  <th className="py-4 px-4 text-center text-xs font-black text-[#1E4D4D]">سعر الوحدة</th>
                  <th className="py-4 px-4 text-center text-xs font-black text-[#1E4D4D]">الكمية</th>
                  <th className="py-4 px-6 text-left text-xs font-black text-[#1E4D4D]">الإجمالي الفرعي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {finalItems.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 text-xs font-black text-slate-800">{item.name}</td>
                    <td className="py-4 px-4 text-center text-xs text-slate-500 font-bold">
                      {((item.sum || (item.price * item.qty)) / (item.qty || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-4 text-center text-xs font-mono font-black text-slate-800">{item.qty}</td>
                    <td className="py-4 px-6 text-left text-xs font-black text-slate-900">
                      {item.sum ? item.sum.toLocaleString() : (item.price * item.qty).toLocaleString()} AED
                    </td>
                  </tr>
                ))}
                {finalItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400 font-bold">لا يوجد أصناف في هذا المستند مضافة حالياً.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mb-8">
            <h3 className="text-lg font-black text-[#1E4D4D] mb-4">بيان وبنية تفاصيل التقرير</h3>
            <div className="grid grid-cols-4 gap-4 mb-6">
              {(data.summary || []).map((s: any, idx: number) => (
                <div key={idx} className="p-4 bg-slate-50 border border-slate-200/50 rounded-2xl text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
                  <p className="text-xl font-black text-slate-800">{s.value}</p>
                </div>
              ))}
            </div>
            
            <table className="w-full text-right border-collapse rounded-2xl border border-slate-100 overflow-hidden">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  {(data.headers || []).map((h: string, idx: number) => (
                    <th key={idx} className="py-3 px-4 text-xs font-black text-[#1E4D4D]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data.rows || []).map((row: any, rowIdx: number) => (
                  <tr key={rowIdx} className="hover:bg-slate-50/50 transition-colors">
                    {(data.headers || []).map((h: string, colIdx: number) => {
                      const headersList = data.headers || [];
                      const keyIndex = headersList.indexOf(h);
                      const keyOfRow = keyIndex !== -1 ? Object.keys(row)[keyIndex] : undefined;
                      const value = row[h] || (keyOfRow !== undefined ? row[keyOfRow] : '') || '';
                      return (
                        <td key={colIdx} className="py-3 px-4 text-xs font-medium text-slate-700">
                          {String(value)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Invoice Notes / Statement */}
        {(sanitizedNote || type === 'VOUCHER') && (
          <div className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600">
            <p className="font-black text-slate-400 mb-2 uppercase tracking-wider text-[10px]">ملاحظات وبيان وعاء الضريبة</p>
            {sanitizedNote ? (
              <div 
                className="prose prose-slate prose-sm text-right"
                dangerouslySetInnerHTML={{ __html: sanitizedNote }} 
              />
            ) : (
              <p className="font-bold">سند رسمي مسجل في الدفاتر المالية المعتمدة للشركة.</p>
            )}
          </div>
        )}
      </div>

      {/* Bill Totals Container */}
      <div className="mt-auto border-t border-slate-100 pt-8">
        <div className="flex justify-between items-end">
          <div className="text-slate-400 max-w-sm">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#1E4D4D] mb-1">البيئة الإرشادية والخدمية للشركة</h4>
            <p className="text-[10px] leading-relaxed font-bold">{invoiceConfig.footerNote}</p>
          </div>
          <div className="w-72 space-y-2 text-right">
            <div className="flex justify-between text-xs text-slate-500 font-bold">
              <span>قيمة البضاعة غير شامل الضريبة:</span>
              <span>{netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500 font-bold">
              <span>ضريبة القيمة المضافة (5% VAT):</span>
              <span>{vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>
            </div>
            <div 
              className="flex justify-between text-lg font-black pt-3 border-t-2 border-slate-100/80"
              style={{ color: layoutConfig.primaryColor }}
            >
              <span>الإجمالي العام للفرع الحسابي:</span>
              <span>{total.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>
            </div>
          </div>
        </div>

        {/* Audit Trailer & System Stamp */}
        <div className="mt-8 border-t border-slate-100 pt-4 flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
          <div>
            <span>PharmaFlow Pro Document rendering engine v2.5.0-Enterprise</span>
          </div>
          <div>
            <span>التوثيق المؤتمن: مستند معتمد ولا يتطلب توقيع فيزيائي</span>
          </div>
        </div>
      </div>
    </div>
  );
};
