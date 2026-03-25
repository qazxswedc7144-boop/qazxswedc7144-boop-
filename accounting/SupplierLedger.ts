
import { accountingService as AccountingService } from "../services/accounting.service";
import { ACCOUNTS } from "./ChartOfAccounts";

/**
 * حساب إجمالي رصيد الموردين (الدائن)
 * يقوم بجمع كافة المبالغ التي وردت في الجانب الدائن لحساب الموردين من واقع الأسطر المحاسبية
 */
// Fix: Change to async to await AccountingService.getEntries()
export async function getSupplierBalance() {
  const entries = await AccountingService.getEntries();
  
  // Fix: Calculate balance by iterating through entry lines for the Supplier account name
  let totalCredit = 0;
  let totalDebit = 0;

  entries.forEach(e => {
    (e.lines || []).forEach(line => {
      // Fix: Checked accountName instead of account
      if (line.accountName === ACCOUNTS.SUPPLIERS) {
        if (line.type === 'CREDIT') totalCredit += line.amount;
        if (line.type === 'DEBIT') totalDebit += line.amount;
      }
    });
  });

  return totalCredit - totalDebit;
}

/**
 * جلب كشف حساب تفصيلي لمورد معين من واقع دفتر الأستاذ العام (نظام الأسطر)
 */
// Fix: Change to async to await AccountingService.getEntries()
export async function getSupplierStatement(sourceId?: string) {
  // Fix: Changed l.account to l.accountName to match JournalLine type
  const entries = await AccountingService.getEntries();
  return entries.filter(e => 
    e.lines.some(l => l.accountName === ACCOUNTS.SUPPLIERS) &&
    (!sourceId || e.sourceId === sourceId)
  );
}
