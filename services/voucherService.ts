import { db } from './database';
import { Receipt, Payment } from '../types';
import { AccountingEngine } from './AccountingEngine';
import { generateId } from '../utils/id';

export class VoucherService {
  /**
   * Creates a new receipt voucher and its corresponding accounting entry.
   */
  static async createReceipt(data: {
    date: string;
    customer_id: string;
    amount: number;
    notes?: string;
  }) {
    this.validate(data);

    const receipt: Receipt = {
      id: generateId('rcpt'),
      date: data.date,
      customer_id: data.customer_id,
      amount: data.amount,
      notes: data.notes,
      created_at: new Date().toISOString(),
      tenant_id: db.db.users.get('current')?.then(u => u?.tenant_id) as any // Simplified for now
    };

    // Use transaction for consistency
    return await db.runTransaction(async () => {
      await db.db.receipts.put(receipt);

      // ACCOUNTING ENTRY
      const entry = await AccountingEngine.generateVoucherEntry({
        type: 'RECEIPT',
        amount: receipt.amount,
        partnerId: receipt.customer_id,
        date: receipt.date,
        refId: receipt.id,
        notes: receipt.notes
      });

      await db.addJournalEntry(entry);

      // UPDATE CUSTOMER BALANCE
      const customer = await db.db.customers.get(receipt.customer_id);
      if (customer) {
        customer.Balance = (customer.Balance || 0) - receipt.amount;
        await db.db.customers.put(customer);
      }

      return receipt;
    });
  }

  /**
   * Creates a new payment voucher and its corresponding accounting entry.
   */
  static async createPayment(data: {
    date: string;
    supplier_id: string;
    amount: number;
    notes?: string;
  }) {
    this.validate(data);

    const payment: Payment = {
      id: generateId('pay'),
      date: data.date,
      supplier_id: data.supplier_id,
      amount: data.amount,
      notes: data.notes,
      created_at: new Date().toISOString(),
      tenant_id: db.db.users.get('current')?.then(u => u?.tenant_id) as any // Simplified for now
    };

    // Use transaction for consistency
    return await db.runTransaction(async () => {
      await db.db.payments.put(payment);

      // ACCOUNTING ENTRY
      const entry = await AccountingEngine.generateVoucherEntry({
        type: 'PAYMENT',
        amount: payment.amount,
        partnerId: payment.supplier_id,
        date: payment.date,
        refId: payment.id,
        notes: payment.notes
      });

      await db.addJournalEntry(entry);

      // UPDATE SUPPLIER BALANCE
      const supplier = await db.db.suppliers.get(payment.supplier_id);
      if (supplier) {
        supplier.Balance = (supplier.Balance || 0) - payment.amount;
        await db.db.suppliers.put(supplier);
      }

      return payment;
    });
  }

  private static validate(data: any) {
    if (!data.amount || data.amount <= 0) {
      throw new Error('المبلغ يجب أن يكون أكبر من صفر');
    }
    if (!data.date) {
      throw new Error('التاريخ مطلوب');
    }
    if (!data.customer_id && !data.supplier_id) {
      throw new Error('يجب تحديد العميل أو المورد');
    }
  }

  static async getReceipts() {
    return await db.db.receipts.toArray();
  }

  static async getPayments() {
    return await db.db.payments.toArray();
  }
}
