// src/types/branch.types.ts

import { SyncableEntity } from "./common.types";

export interface Branch extends SyncableEntity {
  id: string;
  code: string;
  name: string;
  location?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BranchSettings {
  id: string;
  branchId: string;
  minStockLevelAlert: boolean;
  autoReorderTargetDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface BranchInventory {
  id: string;
  branchId: string;
  productId: string;
  stockQuantity: number;
  reorderPoint: number;
  reorderQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export type TransferStatus = 'DRAFT' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';

export interface BranchTransfer {
  id: string;
  transferNumber: string;
  sourceBranchId: string;
  targetBranchId: string;
  status: TransferStatus;
  reason?: string;
  createdBy?: string;
  approvedBy?: string;
  shippedBy?: string;
  receivedBy?: string;
  shippedAt?: string;
  receivedAt?: string;
  createdAt: string;
  updatedAt: string;
  items?: BranchTransferItem[];
}

export interface BranchTransferItem {
  id: string;
  transferId: string;
  productId: string;
  qty: number;
  receivedQty: number;
  batchNumber?: string;
  expiryDate?: string;
  createdAt: string;
}

export interface BranchUser {
  id: string;
  branchId: string;
  userId: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
