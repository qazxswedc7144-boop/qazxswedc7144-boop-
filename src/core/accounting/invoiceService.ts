// src/core/accounting/invoiceService.ts

import { reduceStock } from "../inventory/inventory.service";

export type InvoiceItem = {
  productId: string;
  quantity: number;
  price: number;
};

export type Invoice = {
  id: string;
  customerId: string;
  items: InvoiceItem[];
  total: number;
  createdAt: string;
};

export type InvoiceInput = {
  customerId: string;
  items: InvoiceItem[];
};

export function createInvoice(data: InvoiceInput): Invoice {
  const total = data.items.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  );

  // 🔥 ربط المخزون (بدون UI)
  reduceStock(data.items);

  return {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
    customerId: data.customerId,
    items: data.items,
    total,
    createdAt: new Date().toISOString(),
  };
}
/**
 * Enhanced Invoice Service for Core Accounting
 */
export const invoiceService = {
  /**
   * Generates a new invoice with initial status and unique ID
   */
  initiateInvoice(data: InvoiceInput): Invoice {
    return createInvoice(data);
  },

  /**
   * Validates invoice data before processing
   */
  validateInvoice(data: InvoiceInput): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!data.customerId) errors.push('Customer ID is required');
    if (!data.items || data.items.length === 0) errors.push('Invoice must have at least one item');
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

