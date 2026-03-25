
import { db } from './database';
import { PrintTemplateEngine } from './templateEngine.service';
import { authService } from './auth.service';

/**
 * Export Service - محرك الطباعة والتصدير الموحد المطور (Unified Template Engine)
 */
export const ExportService = {
  /**
   * تصدير البيانات إلى ملف Excel (CSV)
   */
  exportToExcel: (items: any[], fileName: string, headers: string[]) => {
    const BOM = '\uFEFF';
    let csvContent = headers.join(',') + '\n';
    
    items.forEach(row => {
      const values = headers.map(h => {
        const key = Object.keys(row).find(k => k === h || k.includes(h)) || h;
        const val = row[key] !== undefined ? row[key] : '';
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      csvContent += values.join(',') + '\n';
    });

    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    db.addAuditLog('SYSTEM', 'OTHER', fileName, "تم تصدير البيانات بصيغة جدولية");
  },

  /**
   * محرك الرندرة الموحد المعتمد على القوالب (Smart Template Renderer)
   */
  exportToPDF: async (data: any, type: 'SALE' | 'PURCHASE' | 'VOUCHER' | 'REPORT') => {
    // 1. تحميل القالب النشط من المحرك
    const activeTemplate = await PrintTemplateEngine.getActiveTemplate(type);
    const layoutConfig = JSON.parse(activeTemplate.TemplateLayoutJSON || '{}');
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const invoiceConfig = await db.getSetting('invoice_config', {
      pharmacyName: 'PharmaFlow ERP',
      address: 'الموقع غير محدد',
      phone: '-',
      taxNumber: '-',
      footerNote: 'شكراً لتعاملكم معنا'
    });

    const refId = data.SaleID || data.invoiceId || data.purchase_id || data.id || 'N/A';
    const date = new Date(data.date || data.Date || Date.now()).toLocaleDateString('ar-SA');
    const total = data.finalTotal || data.totalAmount || data.amount || 0;
    const currency = 'AED';
    const user = authService.getCurrentUser();

    let contentHtml = '';

    if (type === 'REPORT') {
      contentHtml = `
        <div class="mb-8">
          <h2 class="text-xl font-black border-b-2 pb-2 mb-4" style="color: ${layoutConfig.primaryColor || '#1E4D4D'}">تقرير إحصائي: ${data.reportName || 'عام'}</h2>
          <div class="grid grid-cols-2 gap-4">
             ${(data.summary || []).map((s: any) => `
               <div class="p-4 bg-slate-50 rounded-xl">
                  <p class="text-[10px] font-bold opacity-50 uppercase">${s.label}</p>
                  <p class="text-lg font-black">${s.value}</p>
               </div>
             `).join('')}
          </div>
        </div>
        <table class="w-full text-right border-collapse">
          <thead>
            <tr class="bg-slate-100 border-y-2 border-slate-200">
               ${(data.headers || []).map((h: string) => `<th class="py-3 px-2 text-xs font-black">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${(data.rows || []).map((row: any) => `
              <tr class="border-b border-slate-100">
                ${(data.headers || []).map((h: string) => `<td class="py-3 px-2 text-xs font-bold">${row[h] || row[Object.keys(row)[data.headers.indexOf(h)]] || ''}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      contentHtml = `
        <div class="grid grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded-2xl">
           <div>
              <p class="text-[9px] font-black opacity-40 uppercase">الطرف الثاني / العميل</p>
              <p class="text-sm font-black">${data.customerId || data.partnerName || data.name || 'عميل نقدي'}</p>
           </div>
           <div class="text-left">
              <p class="text-[9px] font-black opacity-40 uppercase">الرقم الضريبي</p>
              <p class="text-sm font-black">${invoiceConfig.taxNumber}</p>
           </div>
        </div>

        <table class="w-full text-right mb-8">
          <thead>
            <tr class="border-b-2 border-slate-200" style="border-color: ${layoutConfig.primaryColor || '#1E4D4D'}">
              <th class="py-2 text-xs font-black">الصنف / البيان</th>
              <th class="py-2 text-center text-xs font-black">الكمية</th>
              <th class="py-2 text-left text-xs font-black">المجموع</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${(data.items || []).map((it: any) => `
              <tr>
                <td class="py-3 text-xs font-bold">${it.name}</td>
                <td class="py-3 text-center text-xs font-bold">${it.qty}</td>
                <td class="py-3 text-left text-xs font-black">${it.sum.toLocaleString()}</td>
              </tr>
            `).join('')}
            ${type === 'VOUCHER' ? `<tr><td colspan="3" class="py-10 text-center font-bold border-2 border-dashed rounded-xl mt-4">${data.notes || 'لا توجد ملاحظات'}</td></tr>` : ''}
          </tbody>
        </table>

        <div class="flex justify-end pt-4 border-t-4 border-double border-slate-200">
          <div class="text-left">
            <p class="text-[10px] font-black opacity-40 uppercase">الإجمالي النهائي المستحق</p>
            <p class="text-3xl font-black" style="color: ${layoutConfig.primaryColor || '#1E4D4D'}">${total.toLocaleString()} <span class="text-xs">${currency}</span></p>
          </div>
        </div>
      `;
    }

    const html = `
      <html dir="${activeTemplate.RTL_Support ? 'rtl' : 'ltr'}">
        <head>
          <title>${activeTemplate.TemplateName}_${refId}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=${layoutConfig.font || 'Cairo'}:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            body { font-family: '${layoutConfig.font || 'Cairo'}', sans-serif; padding: 40px; color: #1E4D4D; }
            @media print { 
               .no-print { display: none; } 
               body { padding: 0; }
               .print-container { border: none !important; box-shadow: none !important; }
            }
          </style>
        </head>
        <body class="bg-gray-50">
          <div class="print-container max-w-2xl mx-auto border-2 border-slate-100 p-8 rounded-[40px] shadow-sm bg-white min-h-[29.7cm]">
            <div class="flex justify-between items-start mb-8 border-b-2 pb-4" style="border-color: ${layoutConfig.primaryColor || '#1E4D4D'}">
              <div>
                <h1 class="text-2xl font-black" style="color: ${layoutConfig.primaryColor || '#1E4D4D'}">${invoiceConfig.pharmacyName}</h1>
                <p class="text-[10px] font-bold opacity-60">${invoiceConfig.address}</p>
                <p class="text-[10px] font-bold opacity-60">هاتف: ${invoiceConfig.phone}</p>
              </div>
              <div class="text-left">
                <h2 class="text-xl font-black uppercase">${
                  type === 'SALE' ? 'فاتورة مبيعات' : 
                  type === 'PURCHASE' ? 'فاتورة مشتريات' : 
                  type === 'VOUCHER' ? 'سند مالي' : 'تقرير نظام'
                }</h2>
                <p class="text-xs font-black">#${refId}</p>
                <p class="text-[10px] font-bold opacity-60">${date}</p>
              </div>
            </div>

            ${contentHtml}

            <div class="mt-12 pt-6 border-t border-slate-100 text-center">
               <p class="text-[10px] font-bold text-slate-400 italic">${invoiceConfig.footerNote}</p>
               <div class="mt-4 opacity-30 text-[8px] font-black uppercase">Printed by: ${user.User_Name} | Template: ${activeTemplate.TemplateName}</div>
            </div>
          </div>
          
          <div class="fixed bottom-10 left-0 right-0 flex justify-center no-print gap-4">
             <button onclick="window.print()" class="bg-[#1E4D4D] text-white px-12 py-4 rounded-2xl font-black shadow-2xl active:scale-95 transition-all">طباعة المستند 🖨️</button>
             <button onclick="window.close()" class="bg-white border-2 border-slate-100 text-slate-400 px-6 py-4 rounded-2xl font-black shadow-lg">إغلاق</button>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();

    // توثيق عملية الطباعة (Audit Trail)
    db.addAuditLog(
      'SYSTEM', 
      type === 'REPORT' ? 'OTHER' : type as any, 
      refId, 
      `تم طباعة مستند [${type}] باستخدام قالب [${activeTemplate.TemplateName}] بصيغة PDF/PRINT`
    );
  }
};
