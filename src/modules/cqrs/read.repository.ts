import Dexie, { type Table } from 'dexie';
import { 
  ProductReadModel, InventoryReadModel, InvoiceReadModel, 
  LedgerReadModel, AggregateSnapshot 
} from './read.types';

export interface PharmaFlowCqrsExtension {
  readProducts: Table<ProductReadModel, string>;
  readInventory: Table<InventoryReadModel, string>;
  readInvoices: Table<InvoiceReadModel, string>;
  readLedgers: Table<LedgerReadModel, string>;
  aggregateSnapshots: Table<AggregateSnapshot, [string, number]>; // مفتاح مركب: الكيان + النسخة
}

export const cqrsSchemaExtensions = {
  readProducts: 'productId, sku, category',
  readInventory: 'batchId, productId, expiryDate, [productId+expiryDate]',
  readInvoices: 'invoiceId, invoiceNumber, status, createdAt',
  readLedgers: 'accountNumber, currentBalance',
  aggregateSnapshots: '[aggregateId+version], aggregateType',
};

export class CqrsReadRepository {
  private db: Dexie & PharmaFlowCqrsExtension;

  constructor(dexieInstance: unknown) {
    this.db = dexieInstance as Dexie & PharmaFlowCqrsExtension;
  }

  // استعلام فوري فائق السلس يعتمد على الـ Cursor لحماية هواتف الأندرويد من انفجار الذاكرة
  async getInvoicesPaginated(limit: number, lastCreatedAt?: Date): Promise<InvoiceReadModel[]> {
    if (lastCreatedAt) {
      return await this.db.readInvoices
        .where('createdAt')
        .above(lastCreatedAt)
        .limit(limit)
        .toArray();
    }
    return await this.db.readInvoices.orderBy('createdAt').limit(limit).toArray();
  }

  async getInventoryByProduct(productId: string): Promise<InventoryReadModel[]> {
    return await this.db.readInventory
      .where('[productId+expiryDate]')
      .between([productId, Dexie.minKey], [productId, Dexie.maxKey])
      .toArray();
  }

  // إدارة وحفظ اللقطات الزهرية الحامية من تضخم سلاسل الأحداث
  async saveSnapshot(snapshot: AggregateSnapshot): Promise<void> {
    await this.db.aggregateSnapshots.put(snapshot);
  }

  async getLatestSnapshot(aggregateId: string): Promise<AggregateSnapshot | undefined> {
    return await this.db.aggregateSnapshots
      .where('[aggregateId+version]')
      .between([aggregateId, Dexie.minKey], [aggregateId, Dexie.maxKey])
      .reverse()
      .first();
  }
}
