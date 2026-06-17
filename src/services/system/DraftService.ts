import { db } from '@/core/db';

export interface DraftData {
  id: string; // e.g., 'sales', 'purchases', 'supplier-payment', 'customer-receipt'
  moduleName: 'Sales Invoice' | 'Purchase Invoice' | 'Supplier Payment' | 'Customer Receipt';
  header: any;
  items: any[];
  totals: any;
  notes?: string;
  paymentType?: string;
  partner?: any; // Customer/Supplier details
  updatedAt: string;
}

export const DraftService = {
  saveDraft: async (
    id: string,
    moduleName: DraftData['moduleName'],
    data: Omit<DraftData, 'id' | 'moduleName' | 'updatedAt'>
  ): Promise<void> => {
    try {
      const draft: DraftData = {
        id,
        moduleName,
        header: data.header,
        items: data.items,
        totals: data.totals,
        notes: data.notes || '',
        paymentType: data.paymentType || '',
        partner: data.partner || null,
        updatedAt: new Date().toISOString()
      };
      await db.drafts.put(draft);
    } catch (e) {
      console.error(`[DraftService] Failed to auto-save draft for ${moduleName}:`, e);
    }
  },

  getDraft: async (id: string): Promise<DraftData | undefined> => {
    try {
      return await db.drafts.get(id);
    } catch (e) {
      console.error(`[DraftService] Failed to load draft for ${id}:`, e);
      return undefined;
    }
  },

  clearDraft: async (id: string): Promise<void> => {
    try {
      await db.drafts.delete(id);
    } catch (e) {
      console.error(`[DraftService] Failed to clear draft ${id}:`, e);
    }
  },

  hasDraft: async (id: string): Promise<boolean> => {
    try {
      const draft = await db.drafts.get(id);
      return !!draft;
    } catch (e) {
      return false;
    }
  },

  // Phase 5.2.5-C - Smart Auto Save Draft Engine
  saveInvoiceDraft: async (
    draftId: string,
    invoiceType: 'SALE' | 'PURCHASE',
    items: any[],
    totals: any,
    createdAt?: string
  ): Promise<void> => {
    try {
      const existing = await db.draft_invoices.get(draftId);
      const now = new Date().toISOString();
      const draft = {
        draftId,
        invoiceType,
        items,
        totals,
        createdAt: existing?.createdAt || createdAt || now,
        updatedAt: now
      };
      await db.draft_invoices.put(draft);
    } catch (e) {
      console.error(`[DraftService] Failed to save invoice draft ${draftId}:`, e);
    }
  },

  getInvoiceDraft: async (draftId: string): Promise<any | undefined> => {
    try {
      return await db.draft_invoices.get(draftId);
    } catch (e) {
      console.error(`[DraftService] Failed to load invoice draft ${draftId}:`, e);
      return undefined;
    }
  },

  getUnfinishedInvoiceDraft: async (invoiceType: 'SALE' | 'PURCHASE'): Promise<any | undefined> => {
    try {
      const drafts = await db.draft_invoices.where('invoiceType').equals(invoiceType).toArray();
      if (drafts && drafts.length > 0) {
        // Return most recently updated
        return drafts.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
      }
      return undefined;
    } catch (e) {
      console.error(`[DraftService] Failed to find unfinished draft:`, e);
      return undefined;
    }
  },

  clearInvoiceDraft: async (draftId: string): Promise<void> => {
    try {
      await db.draft_invoices.delete(draftId);
    } catch (e) {
      console.error(`[DraftService] Failed to clear invoice draft ${draftId}:`, e);
    }
  },

  hasInvoiceDraft: async (invoiceType: 'SALE' | 'PURCHASE'): Promise<boolean> => {
    try {
      const count = await db.draft_invoices.where('invoiceType').equals(invoiceType).count();
      return count > 0;
    } catch (e) {
      return false;
    }
  }
};
