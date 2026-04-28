// src/core/sales/sales.service.ts

import { Invoice, createInvoice, InvoiceItem } from "../accounting/invoiceService";

export type SaleRecord = {
  id: string;
  invoiceId: string;
  timestamp: string;
  totalAmount: number;
  paymentMethod: "cash" | "card" | "credit";
};

/**
 * Sales Service
 * Processes transactions and links them to invoices.
 */
export const salesService = {
  /**
   * Completes a sale by linking it to an invoice
   */
  processSale(customerId: string, items: InvoiceItem[], paymentMethod: SaleRecord["paymentMethod"]): { sale: SaleRecord; invoice: Invoice } {
    const invoice = createInvoice({ customerId, items });
    
    const sale: SaleRecord = {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      invoiceId: invoice.id,
      timestamp: new Date().toISOString(),
      totalAmount: invoice.total,
      paymentMethod
    };

    return { sale, invoice };
  }
};
