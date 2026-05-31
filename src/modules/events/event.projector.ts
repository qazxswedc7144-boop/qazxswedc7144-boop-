import { BaseEventStoreItem } from './event.types';

export interface ReadModelProjector {
  project(event: BaseEventStoreItem): Promise<void>;
}

export class InvoiceProjector implements ReadModelProjector {
  async project(event: BaseEventStoreItem): Promise<void> {
    switch (event.eventType) {
      case 'INVOICE_CREATED':
        // هنا يتم تحديث جداول العرض والقراءة للفواتير في Dexie/Prisma
        break;
      case 'INVOICE_UPDATED':
        break;
    }
  }
}

export class InventoryProjector implements ReadModelProjector {
  async project(event: BaseEventStoreItem): Promise<void> {
    switch (event.eventType) {
      case 'STOCK_RESERVED':
      case 'SALE_POSTED':
        // حساب جرد الـ FIFO والـ FEFO الفوري وتعديل أرصدة المخازن للقرارات الحالية
        break;
    }
  }
}
