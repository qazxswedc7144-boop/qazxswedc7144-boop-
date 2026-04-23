
import { db } from '../lib/database';
import { AccountingEntry, JournalLine } from '../types';
import { AccountingEngine } from './AccountingEngine';
import { createSafeDateRange, safeBetween } from '../utils/safeRange';

export class YearEndClosingService {
  
  static async closeYear(year: number, userId: string) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    await db.runTransaction(async () => {
      // 1. Check if period is already locked
      const period = await db.db.Accounting_Periods.filter(p => p.Start_Date === startDate).first();
      if (period?.Is_Locked) throw new Error("السنة المالية مقفلة بالفعل.");

      // 2. Calculate Net Profit for the year
      const range = createSafeDateRange(`${year}-01-01`, `${year}-12-31`);
      if (!range) throw new Error("نطاق تاريخ غير صالح للسنة المالية.");

      const entries = await safeBetween('journalEntries', 'date', `${year}-01-01`, `${year}-12-31`);
      const revenueAcc = await AccountingEngine.getCoreAccount('SALES_REVENUE');
      const expenseAcc = await AccountingEngine.getCoreAccount('EXPENSE');
      const retainedEarningsAcc = 'ACC-RETAINED-EARNINGS';

      let totalRevenue = 0;
      let totalExpenses = 0;

      entries.forEach(e => {
        e.lines.forEach(l => {
          if (l.accountId === revenueAcc) totalRevenue += (l.credit - l.debit);
          if (l.accountId === expenseAcc) totalExpenses += (l.debit - l.credit);
        });
      });

      const netProfit = totalRevenue - totalExpenses;

      // 3. Create Closing Entry
      const entryId = db.generateId('JE-CLOSE');
      const lines: JournalLine[] = [];

      // Close Revenue (Debit Revenue, Credit Retained Earnings)
      if (totalRevenue !== 0) {
        lines.push(this.createLine(entryId, revenueAcc, totalRevenue, 0));
      }

      // Close Expenses (Credit Expenses, Debit Retained Earnings)
      if (totalExpenses !== 0) {
        lines.push(this.createLine(entryId, expenseAcc, 0, totalExpenses));
      }

      // Transfer to Retained Earnings
      if (netProfit > 0) {
        lines.push(this.createLine(entryId, retainedEarningsAcc, 0, netProfit));
      } else if (netProfit < 0) {
        lines.push(this.createLine(entryId, retainedEarningsAcc, Math.abs(netProfit), 0));
      }

      const closingEntry: AccountingEntry = {
        id: entryId,
        date: endDate,
        description: `قيد إغلاق السنة المالية ${year}`,
        TotalAmount: Math.abs(netProfit),
        status: 'Posted',
        sourceId: String(year),
        sourceType: 'YEAR_CLOSE',
        lines,
        lastModified: new Date().toISOString()
      };

      await db.saveAccountingEntry(closingEntry);

      // 4. Lock Period
      if (period) {
        await db.db.Accounting_Periods.update(period.id, {
          Is_Locked: true,
          Locked_By: userId,
          Locked_At: new Date().toISOString(),
          lastModified: new Date().toISOString()
        });
      } else {
        await db.db.Accounting_Periods.put({
          id: db.generateId('PER'),
          Start_Date: startDate,
          End_Date: endDate,
          Is_Locked: true,
          Locked_By: userId,
          Locked_At: new Date().toISOString(),
          lastModified: new Date().toISOString()
        });
      }

      console.log(`Year ${year} closed successfully with net profit: ${netProfit}`);
    });
  }

  private static createLine(entryId: string, accountId: string, debit: number, credit: number): JournalLine {
    const id = db.generateId('JL');
    return {
      id,
      lineId: id,
      entryId,
      accountId,
      accountName: '',
      debit,
      credit,
      type: debit > 0 ? 'DEBIT' : 'CREDIT',
      amount: debit > 0 ? debit : credit
    };
  }
}
