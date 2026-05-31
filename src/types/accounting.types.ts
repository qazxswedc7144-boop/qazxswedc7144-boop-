// src/types/accounting.types.ts
import { SyncableEntity } from "./common.types";

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface Account extends SyncableEntity {
  id: string;
  account_id?: string;
  code: string;
  name: string;
  account_name?: string;
  type: AccountType;
  account_type?: AccountType;
  parent_id?: string;
  parentId?: string;
  balance_type: 'DEBIT' | 'CREDIT';
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  balance: number;
  debit: number;
  credit: number;
  updatedAt: string;
}

export interface JournalLine extends SyncableEntity {
  lineId: string;
  entry_id?: string;
  entryId: string;
  account_id?: string;
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
}

export interface AccountingEntry extends SyncableEntity {
  id: string;
  entry_id?: string;
  date: string;
  reference_id?: string;
  description?: string;
  TotalAmount: number;
  status: 'Posted' | 'Saved';
  sourceId: string;
  sourceType: string;
  branchId?: string;
  lines: JournalLine[];
  hash?: string;
  created_at?: string;
  timestamp?: string;
}

export interface PartnerLedgerEntry extends SyncableEntity {
  id: string;
  partnerId: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  referenceId: string;
  runningBalance?: number;
}

export interface AccountingPeriod extends SyncableEntity {
  id: string;
  Start_Date: string;
  End_Date: string;
  Is_Locked: boolean;
  Locked_By?: string;
  Locked_At?: string;
  lastModified?: string;
}
