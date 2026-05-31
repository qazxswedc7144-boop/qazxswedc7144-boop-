import Dexie from 'dexie';
import { ReadModelProjector } from '../events/event.projector';
import { BaseEventStoreItem } from '../events/event.types';
import { PharmaFlowCqrsExtension } from './read.repository';

export class InventoryProjectionHandler implements ReadModelProjector {
  private db: Dexie & PharmaFlowCqrsExtension;

  constructor(dexieInstance: unknown) {
    this.db = dexieInstance as Dexie & PharmaFlowCqrsExtension;
  }

  async project(event: BaseEventStoreItem): Promise<void> {
    await this.db.transaction('rw', this.db.readInventory, async () => {
      const payload = event.payload;

      switch (event.eventType) {
        case 'STOCK_ADJUSTED': {
          const batchId = payload.batchId as string;
          await this.db.readInventory.put({
            batchId,
            productId: payload.productId as string,
            quantityOnHand: payload.newQuantity as number,
            expiryDate: new Date(payload.expiryDate as string),
            warehouseLocation: (payload.location as string) || 'Main Pharmacy',
            version: event.version,
            updatedAt: new Date(),
          });
          break;
        }

        case 'SALE_POSTED': {
          const batchId = payload.batchId as string;
          const current = await this.db.readInventory.get(batchId);
          if (current) {
            await this.db.readInventory.update(batchId, {
              quantityOnHand: current.quantityOnHand - (payload.quantity as number),
              version: event.version,
              updatedAt: new Date(),
            });
          }
          break;
        }
      }
    });
  }
}

export class LedgerProjectionHandler implements ReadModelProjector {
  private db: Dexie & PharmaFlowCqrsExtension;

  constructor(dexieInstance: unknown) {
    this.db = dexieInstance as Dexie & PharmaFlowCqrsExtension;
  }

  async project(event: BaseEventStoreItem): Promise<void> {
    await this.db.transaction('rw', this.db.readLedgers, async () => {
      const payload = event.payload;

      if (event.eventType === 'JOURNAL_POSTED') {
        const accountNumber = payload.accountNumber as string;
        const current = await this.db.readLedgers.get(accountNumber);
        
        const debit = payload.debit as number;
        const credit = payload.credit as number;

        if (current) {
          await this.db.readLedgers.update(accountNumber, {
            debitTotal: current.debitTotal + debit,
            creditTotal: current.creditTotal + credit,
            currentBalance: current.currentBalance + (debit - credit),
            updatedAt: new Date(),
          });
        }
      }
    });
  }
}
