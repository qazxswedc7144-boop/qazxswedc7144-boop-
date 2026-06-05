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
  }
};
