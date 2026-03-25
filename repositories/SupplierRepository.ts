
import { db } from '../services/database';
import { Supplier, SupplierLedgerEntry, PurchaseRecord, PartnerLedgerEntry } from '../types';
import { VoucherInvoiceLinkRepository } from './VoucherInvoiceLinkRepository';
import { AccountStatementRepository } from './AccountStatementRepository';
import { ReferentialIntegrityGuard } from '../services/validators/ReferentialIntegrityGuard';
import { useAppStore } from '../store/useAppStore';

/**
 * Supplier Repository - إدارة الموردين والعملاء مع دعم الرصيد التراكمي الذكي والربط المالي
 */
export const SupplierRepository = {
  getSuppliers: (): Supplier[] => {
    return db.getSuppliers().filter(s => s.Is_Active !== false);
  },

  getCustomers: (): Supplier[] => {
    return db.getCustomers().filter(c => c.Is_Active !== false);
  },

  getById: (id: string, type: 'S' | 'C'): Supplier | undefined => {
    const list = type === 'S' ? db.getSuppliers() : db.getCustomers();
    return list.find(p => p.Supplier_ID === id);
  },

  getLedger: async (partnerId: string, startDate?: string, endDate?: string): Promise<any[]> => {
    if (!partnerId) return [];
    const type = partnerId.startsWith('S') ? 'S' : 'C';
    const partner = SupplierRepository.getById(partnerId, type);
    if (!partner) return [];

    const partnerType = type === 'S' ? 'Supplier' : 'Customer';
    let statement = await AccountStatementRepository.getStatement(partner.Supplier_Name, partnerType);
    
    if (startDate) {
      statement = statement.filter(e => new Date(e.date) >= new Date(startDate));
    }
    if (endDate) {
      statement = statement.filter(e => new Date(e.date) <= new Date(endDate));
    }

    const enriched = await Promise.all(statement.map(async (entry: any) => {
      if (entry.referenceId && (entry.referenceId.startsWith('V-') || entry.referenceId.startsWith('VOU-'))) {
        const links = await VoucherInvoiceLinkRepository.getByVoucher(entry.referenceId);
        if (links.length > 0) {
          const invoiceList = links.map(l => `#${l.invoiceId}`).join('، ');
          return { ...entry, linkedInvoices: invoiceList };
        }
      }
      return entry;
    }));

    return enriched;
  },

  getPartnerBalance: async (partnerId: string, type: 'S' | 'C'): Promise<number> => {
    const partner = SupplierRepository.getById(partnerId, type);
    if (!partner) return 0;
    
    const statement = await AccountStatementRepository.getStatement(
      partner.Supplier_Name, 
      type === 'S' ? 'Supplier' : 'Customer'
    );
    
    if (statement.length === 0) return partner.openingBalance || 0;
    return statement[statement.length - 1].runningBalance;
  },

  save: async (partner: Supplier, type: 'S' | 'C') => {
    if (partner.Is_Active === undefined) partner.Is_Active = true;
    if (type === 'S') await db.saveSupplier(partner);
    else await db.saveCustomer(partner);
  },

  delete: async (id: string, type: 'S' | 'C') => {
    const partner = SupplierRepository.getById(id, type);
    if (!partner) return;

    // فحص النزاهة المرجعية
    const hasRefs = await ReferentialIntegrityGuard.checkPartnerReferences(partner.Supplier_ID);
    const hasBalance = Math.abs(partner.Balance) > 0.01;

    if (hasRefs || hasBalance) {
      // تعطيل الحساب بدلاً من حذفه
      partner.Is_Active = false;
      partner.lastModified = new Date().toISOString();
      await SupplierRepository.save(partner, type);
      useAppStore.getState().addToast(`تم تعطيل حساب [${partner.Supplier_Name}] بدلاً من حذفه لوجود أرصدة أو عمليات سابقة 🛡️`, 'info');
    } else {
      // حذف فيزيائي إذا لم يوجد أي نشاط تاريخي
      if (type === 'S') {
        await db.db.suppliers.delete(id);
      } else {
        await db.db.customers.delete(id);
      }
      useAppStore.getState().addToast(`تم حذف الشريك بنجاح`, 'success');
    }
  },

  postToLedger: async (entry: Omit<PartnerLedgerEntry, 'runningBalance'>) => {
    await db.addPartnerLedgerEntry(entry);
  },

  getInvoicePaymentHistory: async (invoiceId: string) => {
    return await VoucherInvoiceLinkRepository.getByInvoice(invoiceId);
  }
};
