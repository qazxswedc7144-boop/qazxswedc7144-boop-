// ==========================================
// FILE: src/workers/reporting.worker.ts
// ==========================================

import { WorkerTask, WorkerResponse } from '../modules/workers/worker.types';

self.onmessage = (e: MessageEvent<WorkerTask>) => {
  const { id, type, payload } = e.data;
  const startTime = performance.now();

  try {
    let result: any;

    switch (type) {
      case 'LEDGER_AGGREGATION': {
        const { accounts, entries, filterAccountId } = payload;
        result = runLedgerAggregation(accounts, entries, filterAccountId);
        break;
      }
      default:
        throw new Error(`Execution mismatch: Task type '${type}' is not supported by reporting.worker.`);
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
 * Consolidate large collections of journal lines into readable ledger report states
 */
function runLedgerAggregation(accounts: any[], entries: any[], filterAccountId?: string) {
  const ledgerMap: Record<string, {
    accountId: string;
    code: string;
    name: string;
    type: string;
    openingBalance: number;
    debitTotal: number;
    creditTotal: number;
    closingBalance: number;
    lines: any[];
  }> = {};

  // Setup initial accounts mapping
  for (const acc of accounts) {
    if (filterAccountId && acc.id !== filterAccountId) continue;
    ledgerMap[acc.id] = {
      accountId: acc.id,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      openingBalance: acc.openingBalance || 0,
      debitTotal: 0,
      creditTotal: 0,
      closingBalance: acc.openingBalance || 0,
      lines: []
    };
  }

  // Iterate over entries and lines in chunks to remain non-blocking (simulated via simple loop in worker)
  for (const entry of (entries || [])) {
    if (entry.status !== 'Posted') continue;
    if (!entry.lines) continue;

    for (const line of entry.lines) {
      const actId = line.accountId;
      if (!ledgerMap[actId]) continue;

      const dr = Number(line.debit || 0);
      const cr = Number(line.credit || 0);

      ledgerMap[actId].debitTotal += dr;
      ledgerMap[actId].creditTotal += cr;

      ledgerMap[actId].lines.push({
        id: line.id,
        entryId: entry.id,
        date: entry.date,
        reference_id: entry.reference_id,
        description: entry.description,
        debit: dr,
        credit: cr
      });
    }
  }

  // Finalize ending balance calculation based on account type
  for (const actId in ledgerMap) {
    const report = ledgerMap[actId];
    if (!report) continue;
    const isDrType = report.type === 'ASSET' || report.type === 'EXPENSE';
    
    if (isDrType) {
      report.closingBalance = report.openingBalance + (report.debitTotal - report.creditTotal);
    } else {
      report.closingBalance = report.openingBalance + (report.creditTotal - report.debitTotal);
    }

    // Sort ledger postings chronologically
    report.lines.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  return filterAccountId ? ledgerMap[filterAccountId] : Object.values(ledgerMap);
}
