
import { JournalLine, AccountingEntry } from '../types';
import { db } from '../lib/database';

/**
 * FinancialEngine - العقل الرياضي للنظام مع دعم الذاكرة المؤقتة (Memoization)
 */
class FinancialEngineService {
  private memoCache: Map<string, { version: number; result: any }> = new Map();

  private memoize<T>(key: string, fn: () => T): T {
    const currentVersion = db.getVersion();
    const cached = this.memoCache.get(key);

    if (cached && cached.version === currentVersion) {
      return cached.result as T;
    }

    const result = fn();
    this.memoCache.set(key, { version: currentVersion, result });
    return result;
  }

  isBalanced(lines: JournalLine[]): boolean {
    const debit = lines.filter(l => l.type === 'DEBIT').reduce((s, l) => s + l.amount, 0);
    const credit = lines.filter(l => l.type === 'CREDIT').reduce((s, l) => s + l.amount, 0);
    return Math.abs(debit - credit) < 0.001;
  }

  calculateNetProfit(revenue: number, cogs: number, expenses: number): number {
    const key = `net_profit_${revenue}_${cogs}_${expenses}`;
    return this.memoize(key, () => revenue - cogs - expenses);
  }

  createSimplePaymentLines(amount: number, fromAccount: {id: string, name: string}, toAccount: {id: string, name: string}): JournalLine[] {
    const entryId = 'TEMP';
    return [
      { 
        id: db.generateId('L'),
        lineId: db.generateId('L'), 
        entryId, 
        accountId: toAccount.id, 
        accountName: toAccount.name, 
        amount, 
        type: 'DEBIT',
        debit: amount,
        credit: 0
      },
      { 
        id: db.generateId('L'),
        lineId: db.generateId('L'), 
        entryId, 
        accountId: fromAccount.id, 
        accountName: fromAccount.name, 
        amount, 
        type: 'CREDIT',
        debit: 0,
        credit: amount
      }
    ];
  }

  /**
   * التحقق من سلامة الأرصدة عبر مقارنة الأستاذ العام بالـ Ledger المساعد
   */
  // Fix: Made async and awaited async database calls
  async validatePartnerIntegrity(partnerId: string, type: 'S' | 'C'): Promise<boolean> {
    const ledgerBalance = await db.getAccountBalance(partnerId); 
    const latestLedgerEntry = await db.getLatestPartnerLedgerEntry(partnerId);
    const assistantBalance = latestLedgerEntry?.runningBalance || 0;
    
    return Math.abs(ledgerBalance - assistantBalance) < 0.01;
  }
}

export const FinancialEngine = new FinancialEngineService();
