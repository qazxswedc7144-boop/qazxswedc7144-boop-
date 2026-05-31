// ==========================================
// FILE: src/modules/workers/worker.types.ts
// ==========================================

export type WorkerTaskType =
  | 'FIFO'
  | 'FEFO'
  | 'JOURNAL_MAPPING'
  | 'INVENTORY_RECONCILIATION'
  | 'TRIAL_BALANCE'
  | 'LEDGER_AGGREGATION';

export interface WorkerTask<T = any> {
  id: string;
  type: WorkerTaskType;
  payload: T;
  timestamp: number;
}

export interface WorkerResponse<R = any> {
  id: string;
  success: boolean;
  result?: R;
  error?: string;
  durationMs?: number;
}

// Result structures for Worker Client API
export interface FIFOResult {
  totalCost: number;
  unitCost: number;
  itemCosts: Record<string, number>;
  updatedLayers: {
    id: string;
    item_id: string;
    quantity_remaining: number;
    unit_cost: number;
    created_at: string;
    reference_id: string;
    lastModified: string;
    tenant_id: string;
  }[];
  consumptionLogs: {
    id: string;
    sale_id: string;
    item_id: string;
    layer_id: string;
    quantity_consumed: number;
    unit_cost: number;
    consumed_at: string;
    lastModified: string;
    tenant_id: string;
  }[];
}

export interface FEFOResult {
  totalCost: number;
  unitCost: number;
  itemCosts: Record<string, number>;
  updatedBatches: {
    id: string;
    productId: string;
    quantity: number;
    expiryDate: string;
    batchNumber: string;
    createdAt: string;
  }[];
  consumptionLogs: any[];
}

export interface JournalMappingResult {
  lines: {
    id: string;
    entryId: string;
    accountId: string;
    debit: number;
    credit: number;
    description?: string;
  }[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export interface InventoryReconciliationResult {
  productId: string;
  calculatedStock: number;
  discrepancy: number;
  reconciled: boolean;
}

export interface TrialBalanceItem {
  id: string;
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  endingDebit: number;
  endingCredit: number;
}

export interface LedgerAggregationResult {
  movements: Record<string, { debit: number; credit: number; balance: number }>;
  totalDebit: number;
  totalCredit: number;
}

// Monitoring metrics
export interface WorkerMetrics {
  durationMs: number;
  queueDepth: number;
  utilization: number;
  failures: number;
  activeWorkers: number;
}
