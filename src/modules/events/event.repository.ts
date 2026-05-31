import Dexie, { type Table } from 'dexie';
import { BaseEventStoreItem, AggregateType } from './event.types';

export interface EventSourcingDexieExtension {
  eventStore: Table<BaseEventStoreItem, number>;
}

// امتداد آمن للمخطط المحلي بالإصدار الجديد دون تدمير البيانات الحالية
export const eventStoreSchemaExtension = {
  eventStore: '++id, eventId, aggregateId, aggregateType, eventType, createdAt, [aggregateType+aggregateId]',
};

export class EventStoreRepository {
  private db: Dexie & EventSourcingDexieExtension;

  constructor(dexieInstance: unknown) {
    this.db = dexieInstance as Dexie & EventSourcingDexieExtension;
  }

  // الحفظ الإلحاقي الصارم فقط (Append-Only) لمنع التعديل أو الحذف
  async append(event: Omit<BaseEventStoreItem, 'id' | 'createdAt'>): Promise<number> {
    return await this.db.transaction('rw', this.db.eventStore, async () => {
      // التحقق من عدم تكرار الحدث (Event Idempotency)
      const existing = await this.db.eventStore.where('eventId').equals(event.eventId).first();
      if (existing) {
        throw new Error(`Event Dispatched Duplicate Error: ${event.eventId}`);
      }

      // التحقق من تسلسل الإصدارات (Version Sequence Check) لمنع تضارب الحالة
      const lastEvent = await this.db.eventStore
        .where('[aggregateType+aggregateId]')
        .equals([event.aggregateType, event.aggregateId])
        .reverse()
        .first();

      const expectedVersion = lastEvent ? lastEvent.version + 1 : 1;
      if (event.version !== expectedVersion) {
        throw new Error(`Concurrency Violation! Aggregate [${event.aggregateType}:${event.aggregateId}] expected version ${expectedVersion}, got ${event.version}`);
      }

      return await this.db.eventStore.add({
        ...event,
        createdAt: new Date(),
      } as BaseEventStoreItem);
    });
  }

  async getStream(aggregateType: AggregateType, aggregateId: string, fromVersion = 0): Promise<BaseEventStoreItem[]> {
    const stream = await this.db.eventStore
      .where('[aggregateType+aggregateId]')
      .equals([aggregateType, aggregateId])
      .sortBy('version');
    return stream.filter(event => event.version >= fromVersion);
  }
}
