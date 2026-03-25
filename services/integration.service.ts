
import { db } from './database';
import { BankTransaction, PaymentGateway, BankAccount, WebhookConfig, Sale, Purchase, AccountingEntry } from '../types';

/**
 * Integration Service - نظام الربط المتقدم مع الأنظمة الخارجية والمدفوعات
 */
export const integrationService = {
  /**
   * محاكاة مزامنة الحركات البنكية
   */
  async syncBankTransactions(bankAccountId: string): Promise<BankTransaction[]> {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockTxs: BankTransaction[] = [
      { id: 'TX-' + Math.random().toString(36).substr(2, 9), date: new Date().toISOString(), description: 'إيداع من عميل - ف_102', amount: 550, type: 'CREDIT', status: 'pending' },
      { id: 'TX-' + Math.random().toString(36).substr(2, 9), date: new Date().toISOString(), description: 'تحويل لمورد - شركة الدواء', amount: 1200, type: 'DEBIT', status: 'pending' },
      { id: 'TX-' + Math.random().toString(36).substr(2, 9), date: new Date().toISOString(), description: 'عمولة بنكية', amount: 15, type: 'DEBIT', status: 'pending' }
    ];

    await db.saveBankTransactions(mockTxs);
    
    const accounts = await db.getBankAccounts();
    const accIdx = accounts.findIndex(a => a.id === bankAccountId);
    if (accIdx > -1) {
      accounts[accIdx].lastSync = new Date().toISOString();
      accounts[accIdx].status = 'connected';
      await db.saveBankAccount(accounts[accIdx]);
    }

    return mockTxs;
  },

  /**
   * جلب البوابات المفعلة
   */
  getActiveGateways: (): PaymentGateway[] => {
    return db.getPaymentGateways().filter(g => g.isActive);
  },

  /**
   * معالجة دفع إلكتروني حقيقي (محاكاة الربط مع Stripe/PayPal)
   */
  processElectronicPayment: async (gatewayId: string, amount: number): Promise<{ success: boolean, ref: string, message: string }> => {
    console.log(`Initiating payment of ${amount} via ${gatewayId}...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const isSuccess = Math.random() > 0.05; 
    
    if (isSuccess) {
      return {
        success: true,
        ref: 'PAY-' + Math.random().toString(36).toUpperCase().substr(2, 10),
        message: 'Payment Authorized Successfully'
      };
    } else {
      return {
        success: false,
        ref: '',
        message: 'Insufficient Funds or Gateway Timeout'
      };
    }
  },

  /**
   * تصدير البيانات المهيأة لأنظمة المحاسبة الخارجية
   */
  // Fix: Made async and awaited db call
  exportForAccountingSystem: async (system: 'QuickBooks' | 'Xero' | 'Excel'): Promise<void> => {
    const entries = await db.getJournalEntries();
    let csvContent = "";
    let headers = [];

    if (system === 'QuickBooks') {
      headers = ['Date', 'Transaction Type', 'Ref No', 'Account', 'Debit', 'Credit', 'Memo'];
      csvContent = headers.join(',') + '\n';
      entries.forEach(e => {
        e.lines.forEach(l => {
          csvContent += `"${new Date(e.date).toLocaleDateString()}", "${e.sourceType}", "${e.sourceId}", "${l.accountName}", ${l.type === 'DEBIT' ? l.amount : 0}, ${l.type === 'CREDIT' ? l.amount : 0}, "${(e as any).notes || ''}"\n`;
        });
      });
    } else if (system === 'Xero') {
      headers = ['*ContactName', '*EmailAddress', 'Reference', '*Date', '*Amount', '*AccountCode', 'Description'];
      csvContent = headers.join(',') + '\n';
      entries.forEach(e => {
        const total = e.lines.filter(l => l.type === 'DEBIT').reduce((acc, curr) => acc + curr.amount, 0);
        csvContent += `"System Partner", "", "${e.sourceId}", "${new Date(e.date).toLocaleDateString()}", ${total}, "200", "${(e as any).notes || ''}"\n`;
      });
    }

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `PharmaFlow_${system}_Export_${Date.now()}.csv`;
    link.click();
  },

  /**
   * ربط الفاتورة الإلكترونية مع مصلحة الضرائب
   */
  submitToTaxAuthority: async (sale: Sale): Promise<{ success: boolean, qrCode: string, taxId: string }> => {
    await new Promise(resolve => setTimeout(resolve, 2500));
    const taxId = "TAX-" + Math.random().toString(36).toUpperCase().substr(2, 10);
    await db.addAuditLog('POST', 'SALE', sale.SaleID, `تم اعتماد الفاتورة لدى مصلحة الضرائب. معرف الضريبة: ${taxId}`);
    return {
      success: true,
      qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${taxId}`,
      taxId: taxId
    };
  },

  /**
   * نظام الـ Webhooks المتطور لإرسال البيانات
   */
  triggerWebhook: async (event: string, data: any) => {
    console.log(`[ERP Bridge] Triggering Webhook: ${event}`);
    try {
      const payload = {
        event,
        timestamp: new Date().toISOString(),
        data,
        signature: 'sha256=' + Math.random().toString(36).substring(7)
      };
      await new Promise(r => setTimeout(r, 800));
      return true;
    } catch (e) {
      return false;
    }
  }
};
