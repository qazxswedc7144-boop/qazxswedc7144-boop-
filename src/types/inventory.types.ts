// src/types/inventory.types.ts
import { SyncableEntity } from "./common.types";

export type InventoryTransactionType = 'SALE' | 'PURCHASE' | 'RETURN' | 'ADJUSTMENT' | 'INITIAL' | 'TRANSFER';

export interface Product extends SyncableEntity {
  id: string;
  name: string;      
  DefaultUnit?: string; 
  LastPurchasePrice?: number; 
  TaxDefault?: number; 
  price?: number; 
  Price?: number;
  UnitPrice?: number;
  CostPrice?: number; 
  stock?: number; 
  MinLevel?: number;
  ExpiryDate?: string;
  supplierId?: string;
  supplierName?: string;
  categoryId?: string;
  categoryName?: string;
  barcode?: string;
  usageCount?: number; 
  ProfitMargin?: number;
  Is_Active?: boolean;
  branchId?: string;
  avgCost?: number;
  totalValue?: number;
  minStock?: number;
  lastUpdated?: number;

  // Transitional/Compatibility Properties
  Name?: string;
  StockQuantity?: number;
  stock_qty?: number;
  expiry_date?: string;
  is_taxable?: boolean;
  Tax_Default?: number;
  is_active?: boolean;
  created_at?: string;
  cost?: number;
  unit?: string;
  Stock_Quantity?: number;
}

export interface InventoryTransaction extends SyncableEntity {
  TransactionID: string;
  productId: string;
  warehouseId: string;
  SourceDocumentType: 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN' | 'INITIAL' | 'MANUAL';
  SourceDocumentID: string;
  QuantityChange: number; 
  before_qty: number;
  after_qty: number;
  TransactionType: InventoryTransactionType;
  TransactionDate: string;
  UserID: string;
  branchId?: string;
  notes?: string;
}

export interface StockReservation extends SyncableEntity {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  sourceDocId: string;
  expiresAt: string;
}

export interface StockMovement extends SyncableEntity {
  id: string;
  item_id: string;
  type: 'purchase' | 'sale' | 'return' | 'adjustment';
  quantity_before: number;
  quantity_change: number;
  quantity_after: number;
  unit_cost: number;
  total_cost: number;
  reference_id: string;
  created_at: string;
}

export interface InventoryLayer extends SyncableEntity {
  id: string;
  item_id: string;
  quantity_remaining: number;
  unit_cost: number;
  created_at: string;
  reference_id: string; 
}

export interface FIFOConsumptionLog extends SyncableEntity {
  id: string;
  sale_id: string;
  item_id: string;
  layer_id: string;
  quantity_consumed: number;
  unit_cost: number;
  consumed_at: string;
}

export interface FIFOCostLayer extends SyncableEntity {
  id: string;
  productId: string;
  quantityRemaining: number;
  unitCost: number;
  purchaseDate: string;
  referenceId: string;
  isClosed: boolean;
}

export interface MedicineBatch extends SyncableEntity {
  id: string;
  BatchID: string;
  productId: string;
  warehouseId: string;
  ExpiryDate: string;
  Quantity: number;
  unitCost?: number;
  lastUpdated?: string;
}

export interface Warehouse extends SyncableEntity {
  id: string;
  name: string;
  location?: string;
  isDefault: boolean;
}

export interface WarehouseStock extends SyncableEntity {
  id: string; 
  warehouseId: string;
  productId: string;
  quantity: number;
  lastUpdated: string;
}
