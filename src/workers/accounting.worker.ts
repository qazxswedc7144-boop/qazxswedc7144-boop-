// ==========================================
// FILE: src/workers/accounting.worker.ts
// ==========================================

import { WorkerTask, WorkerResponse } from '../modules/workers/worker.types';

self.onmessage = (e: MessageEvent<WorkerTask>) => {
  const { id, type, payload } = e.data;
  const startTime = performance.now();

  try {
    let result: any;

    switch (type) {
      case 'TRIAL_BALANCE': {
        const { accounts, entries, start, end } = payload;
        result = calculateTrialBalance(accounts, entries, start, end);
        break;
      }
      case 'LEDGER_AGGREGATION': {
        const { entries, accountId } = payload;
        result = aggregateLedger(entries, accountId);
        break;
      }
      case 'JOURNAL_MAPPING': {
        const { invoice, items, settings, currencyBaseRate } = payload;
        result = mapJournalEntries(invoice, items, settings, currencyBaseRate);
        break;
      }
      default:
        throw new Error(`Execution mismatch: Task type '${type}' is not supported by accounting.worker.`);
    }

    sendSuccess(id, result, startTime);
  } catch (error: any) {
    sendError(id, error.message || String(error), startTime);
  }
};

function sendSuccess(id: string, result: any, startTime: number) {
  const durationMs = performance.now() - startTime;
  self.postMessage({
    id,
    success: true,
    result,
    durationMs,
  } as WorkerResponse);
}

function sendError(id: string, error: string, startTime: number) {
  const durationMs = performance.now() - startTime;
  self.postMessage({
    id,
    success: false,
    error,
    durationMs,
  } as WorkerResponse);
}

/**
 * GAAP-Compliant Trial Balance Calculations (Offloaded to worker)
 */
function calculateTrialBalance(accounts: any[], entries: any[], start?: string, end?: string) {
  const filteredEntries = (entries || []).filter((e: any) => {
    if (e.status !== 'Posted') return false;
    if (start && e.date < start) return false;
    if (end && e.date > end) return false;
    return true;
  });

  const movements: Record<string, { debit: number; credit: number }> = {};
  for (const acc of accounts) {
    movements[acc.id] = { debit: 0, credit: 0 };
  }

  // Aggregate in chunks if there are massive lines (Android UI safety)
  for (const e of filteredEntries) {
    if (!e.lines) continue;
    for (const l of e.lines) {
      const id = l.accountId;
      if (!movements[id]) {
        movements[id] = { debit: 0, credit: 0 };
      }
      movements[id].debit += Number(l.debit || 0);
      movements[id].credit += Number(l.credit || 0);
    }
  }

  return accounts.map(acc => {
    const mv = movements[acc.id] || { debit: 0, credit: 0 };
    const isDrType = acc.type === 'ASSET' || acc.type === 'EXPENSE';
    const netBalance = isDrType ? (mv.debit - mv.credit) : (mv.credit - mv.debit);

    return {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      debit: mv.debit,
      credit: mv.credit,
      endingDebit: isDrType && netBalance >= 0 ? netBalance : (isDrType ? 0 : (netBalance < 0 ? -netBalance : 0)),
      endingCredit: !isDrType && netBalance >= 0 ? netBalance : (!isDrType ? 0 : (netBalance < 0 ? -netBalance : 0))
    };
  });
}

/**
 * Large Ledger Aggregations (Offloaded to worker)
 */
function aggregateLedger(entries: any[], accountId?: string) {
  const movements: Record<string, { debit: number; credit: number; balance: number }> = {};
  let totalDebit = 0;
  let totalCredit = 0;

  for (const entry of (entries || [])) {
    if (entry.status !== 'Posted' && entry.status !== 'Posted' && entry.status !== 'LOCKED') continue;
    if (!entry.lines) continue;

    for (const line of entry.lines) {
      if (accountId && line.accountId !== accountId) continue;

      const actId = line.accountId;
      if (!movements[actId]) {
        movements[actId] = { debit: 0, credit: 0, balance: 0 };
      }

      const dr = Number(line.debit || 0);
      const cr = Number(line.credit || 0);

      movements[actId].debit += dr;
      movements[actId].credit += cr;
      movements[actId].balance += (dr - cr);

      totalDebit += dr;
      totalCredit += cr;
    }
  }

  return { movements, totalDebit, totalCredit };
}

/**
 * Auto Journal Mapping Pipeline
 */
function mapJournalEntries(invoice: any, _items: any[], settings: Record<string, string>, currencyBaseRate: number) {
  const type = invoice.type || (invoice.customerId ? 'SALE' : 'PURCHASE');
  const isReturn = !!invoice.isReturn;
  const baseRate = currencyBaseRate || 1.0;

  const lines: any[] = [];
  const entryId = `JE-${Date.now()}`;

  // Helper defaults
  const cashAcc = settings['ACCOUNT_CASH'] || 'ACC-101';
  const arAcc = settings['ACCOUNT_RECEIVABLE'] || 'ACC-103';
  const apAcc = settings['ACCOUNT_PAYABLE'] || 'ACC-201';
  const invAcc = settings['ACCOUNT_INVENTORY'] || 'ACC-102';
  const revenueAcc = settings['ACCOUNT_SALES_REVENUE'] || 'ACC-401';

  const totalAmountBase = Number(invoice.total || invoice.finalTotal || 0) * baseRate;

  if (type === 'SALE') {
    if (isReturn) {
      // Reverse Revenue: Debit Revenue, Credit Cash/AR
      lines.push({ id: `JL-${Math.random()}`, entryId, accountId: revenueAcc, debit: totalAmountBase, credit: 0 });
      if (invoice.paymentStatus === 'Cash') {
        lines.push({ id: `JL-${Math.random()}`, entryId, accountId: cashAcc, debit: 0, credit: totalAmountBase });
      } else {
        lines.push({ id: `JL-${Math.random()}`, entryId, accountId: arAcc, debit: 0, credit: totalAmountBase });
      }
    } else {
      // Normal Revenue: Debit Cash/AR, Credit Revenue
      if (invoice.paymentStatus === 'Cash') {
        lines.push({ id: `JL-${Math.random()}`, entryId, accountId: cashAcc, debit: totalAmountBase, credit: 0 });
      } else {
        lines.push({ id: `JL-${Math.random()}`, entryId, accountId: arAcc, debit: totalAmountBase, credit: 0 });
      }
      lines.push({ id: `JL-${Math.random()}`, entryId, accountId: revenueAcc, debit: 0, credit: totalAmountBase });
    }
  } else {
    // Purchase or Purchase Return
    if (isReturn) {
      // Dr Ap / Cash, Cr Inv
      if (invoice.isCash) {
        lines.push({ id: `JL-${Math.random()}`, entryId, accountId: cashAcc, debit: totalAmountBase, credit: 0 });
      } else {
        lines.push({ id: `JL-${Math.random()}`, entryId, accountId: apAcc, debit: totalAmountBase, credit: 0 });
      }
      lines.push({ id: `JL-${Math.random()}`, entryId, accountId: invAcc, debit: 0, credit: totalAmountBase });
    } else {
      // Dr Inv, Cr Ap / Cash
      lines.push({ id: `JL-${Math.random()}`, entryId, accountId: invAcc, debit: totalAmountBase, credit: 0 });
      if (invoice.isCash || invoice.status === 'PAID') {
        lines.push({ id: `JL-${Math.random()}`, entryId, accountId: cashAcc, debit: 0, credit: totalAmountBase });
      } else {
        lines.push({ id: `JL-${Math.random()}`, entryId, accountId: apAcc, debit: 0, credit: totalAmountBase });
      }
    }
  }

  // Double Check Balance
  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return {
    lines,
    totalDebit,
    totalCredit,
    isBalanced,
  };
}
