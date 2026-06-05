import React from 'react';
import { createRoot } from 'react-dom/client';
import { InvoiceTemplate, InvoiceItem, InvoiceTemplateProps } from '@/components/print/InvoiceTemplate';
import { db } from '@/core/db';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LayoutConfiguration {
  primaryColor?: string;
  font?: string;
}

interface CompanyConfiguration {
  pharmacyName?: string;
  address?: string;
  phone?: string;
  taxNumber?: string;
  footerNote?: string;
}

export const PrintEngine = {
  /**
   * Safe rendering engine that opens a printable window, configures head styles,
   * copies application stylesheets directly, and safely mounts the React component tree
   * dynamically using React createRoot. Completely avoids document.write or unsafe html injections.
   * 
   * Fully supports 58mm, 80mm, and A4 responsive paper sizes dynamically.
   */
  async renderAndPrint(
    data: any,
    type: 'SALE' | 'PURCHASE' | 'VOUCHER' | 'REPORT',
    mode: 'A4' | 'THERMAL' | '58mm' | '80mm' = 'A4',
    propItems?: InvoiceItem[]
  ): Promise<void> {
    const refId = data.SaleID || data.invoiceId || data.purchase_id || data.id || 'N/A';
    
    // 1. Fetch system configurations from Dexie db securely
    const layoutConfig: LayoutConfiguration = {
      primaryColor: '#1E4D4D',
      font: 'Cairo'
    };
    
    const companyConfig: CompanyConfiguration = await db.getSetting('invoice_config', {
      pharmacyName: 'PharmaFlow Pro ERP',
      address: 'دبي، الإمارات العربية المتحدة',
      phone: '+971 4 000 0000',
      taxNumber: '100234567800003',
      footerNote: 'شكراً لزيارتكم! متمنين لكم دوام الصحة والعافية.'
    });

    // 2. Select paper profile dynamically based on mode & saved settings
    let finalMode: 'A4' | '58mm' | '80mm' = 'A4';
    if (mode === 'A4') {
      finalMode = 'A4';
    } else if (mode === '58mm') {
      finalMode = '58mm';
    } else if (mode === '80mm') {
      finalMode = '80mm';
    } else if (mode === 'THERMAL') {
      // Auto-format based on paper size saved in settings
      const savedProfile = localStorage.getItem('saas_printer_profile') as any || '80mm';
      finalMode = savedProfile === 'a4' ? 'A4' : (savedProfile === '58mm' ? '58mm' : '80mm');
    }

    // 3. Open a secure, blank window for rendering
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('PRINT_BLOCKED: Could not open the print window. Please allow popups.');
    }

    // 4. Set basic document structure and metadata safely via Document web APIs
    printWindow.document.title = `${type}_Invoice_${refId}`;
    
    // Set direction and baseline responsive styles safely
    const baseHtml = printWindow.document.documentElement;
    baseHtml.setAttribute('dir', 'rtl');
    baseHtml.setAttribute('lang', 'ar');
    
    // Inject custom Tailwind CSS configuration safely on the children document head
    const styleSheetLink = printWindow.document.createElement('script');
    styleSheetLink.src = 'https://cdn.tailwindcss.com';
    printWindow.document.head.appendChild(styleSheetLink);

    // Dynamic Google Fonts configuration
    const fontLink = printWindow.document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;700;900&display=swap';
    printWindow.document.head.appendChild(fontLink);

    // Custom preview padded views
    const viewPadding = finalMode === 'A4' ? '40px' : '4px';
    const bgPreview = finalMode === 'A4' ? '#f8fafc' : '#ffffff';

    // Apply baseline CSS overrides safely to prevent header/footer print line breaks
    const styleOverride = printWindow.document.createElement('style');
    styleOverride.textContent = `
      body {
        background-color: ${bgPreview};
        padding: ${viewPadding};
        font-family: 'Cairo', sans-serif;
      }
      @media print {
        body {
          background-color: #ffffff !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .no-print-controls {
          display: none !important;
        }
        @page {
          size: auto;
          margin: 0;
        }
        /* Ensure backgrounds render well when printed */
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `;
    printWindow.document.head.appendChild(styleOverride);

    // 5. Create mounting node container element safely
    const container = printWindow.document.createElement('div');
    container.id = 'print-root';
    printWindow.document.body.appendChild(container);

    // 6. Add printed floating action bar safely inside container
    const actionControls = printWindow.document.createElement('div');
    actionControls.className = 'fixed bottom-8 left-0 right-0 flex justify-center gap-4 no-print-controls';
    
    const printButton = printWindow.document.createElement('button');
    printButton.textContent = 'طباعة المستند الحسابي المعمد 🖨️';
    printButton.className = 'bg-[#1E4D4D] text-white px-8 py-3.5 rounded-2xl text-sm font-black shadow-2xl hover:scale-[1.02] transform transition-all active:scale-95 duration-150';
    printButton.onclick = () => {
      printWindow.print();
    };

    const closeButton = printWindow.document.createElement('button');
    closeButton.textContent = 'إغلاق نافذة الطباعة';
    closeButton.className = 'bg-white border border-slate-200 text-slate-500 px-6 py-3.5 rounded-2xl text-sm font-bold shadow-lg hover:bg-slate-50 transition-colors';
    closeButton.onclick = () => {
      printWindow.close();
    };

    actionControls.appendChild(printButton);
    actionControls.appendChild(closeButton);
    printWindow.document.body.appendChild(actionControls);

    // 7. Mount the safe enterprise InvoiceTemplate inside the print window node
    const root = createRoot(container);
    
    const props: InvoiceTemplateProps = {
      data,
      type,
      items: propItems || data.items || [],
      mode: finalMode,
      layoutConfig,
      invoiceConfig: companyConfig
    };

    root.render(React.createElement(InvoiceTemplate, props));

    // 8. Insert audit entry for traceability
    await db.addAuditLog(
      'SYSTEM',
      type === 'REPORT' ? 'OTHER' : (type as any),
      refId,
      `Safe Print triggered using PrintEngine Core for document type: ${type} Reference: ${refId} Size: ${finalMode}`
    );
  },

  /**
   * PDF Generator with vector-accurate rendering
   */
  async generateHighFidelityPDF(
    data: any,
    type: 'SALE' | 'PURCHASE' | 'VOUCHER' | 'REPORT',
    propItems?: InvoiceItem[]
  ): Promise<void> {
    const refId = data.SaleID || data.invoiceId || data.purchase_id || data.id || 'N/A';
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    const companyConfig: CompanyConfiguration = await db.getSetting('invoice_config', {
      pharmacyName: 'PharmaFlow Pro ERP',
      address: 'دبي، الإمارات العربية المتحدة',
      phone: '+971 4 000 0000',
      taxNumber: '100234567800003',
      footerNote: 'شكراً لزيارتكم! متمنين لكم دوام الصحة والعافية.'
    });

    const title = `${type === 'SALE' ? 'فاتورة مبيعات معتمدة' : type === 'PURCHASE' ? 'فاتورة مشتريات معتمدة' : 'سند مالي رسمي'}`;
    
    // Design elegant PDF layout header
    doc.setFillColor(30, 77, 77); // primary color
    doc.rect(0, 0, 210, 15, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(companyConfig.pharmacyName || 'PharmaFlow Pro ERP', 15, 10);
    doc.text('ERP Pro Platform', 150, 10);

    doc.setTextColor(51, 65, 85);
    doc.setFontSize(16);
    doc.text(title, 15, 30);
    
    doc.setFontSize(10);
    doc.text(`رقم المستند: #${refId}`, 150, 30);
    doc.text(`التاريخ: ${new Date(data.date || data.Date || Date.now()).toLocaleDateString('ar-AE')}`, 150, 36);
    
    // Address detail metadata
    doc.setFontSize(9);
    doc.text(`العنوان: ${companyConfig.address}`, 15, 42);
    doc.text(`الهاتف: ${companyConfig.phone}`, 15, 48);
    doc.text(`الرقم الضريبي المستحق: ${companyConfig.taxNumber}`, 15, 54);

    const itemsList: InvoiceItem[] = propItems || data.items || [];
    const columns = ['الصنف / البيان', 'سعر الوحدة', 'الكمية', 'الإجمالي'];
    const rows = itemsList.map(item => [
      item.name,
      ((item.sum || (item.price * item.qty)) / (item.qty || 1)).toFixed(2),
      item.qty.toString(),
      (item.sum || (item.price * item.qty)).toFixed(2)
    ]);

    autoTable(doc, {
      head: [columns],
      body: rows,
      startY: 65,
      theme: 'grid',
      headStyles: { fillColor: [30, 77, 77], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { halign: 'right', fontSize: 10 },
      alternateRowStyles: { fillColor: [248, 250, 250] }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 120;
    
    // Financial numbers
    const total = Number(data.finalTotal || data.totalAmount || data.amount || 0);
    doc.setFontSize(11);
    doc.text(`إجمالي الخاضع للضريبة: ${(total / 1.05).toFixed(2)} AED`, 120, finalY + 15);
    doc.text(`ضريبة القيمة المضافة (5% VAT): ${(total * 0.05 / 1.05).toFixed(2)} AED`, 120, finalY + 22);
    
    doc.setFontSize(13);
    doc.setTextColor(30, 77, 77);
    doc.text(`الإجمالي العام المستحق: ${total.toFixed(2)} AED`, 120, finalY + 30);

    // Save of document
    doc.save(`Invoice_${refId}.pdf`);

    await db.addAuditLog(
      'SYSTEM',
      type === 'REPORT' ? 'OTHER' : (type as any),
      refId,
      `High Fidelity PDF File generated for ${type} Reference: ${refId}`
    );
  }
};
