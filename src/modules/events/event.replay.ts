import { AggregateType, AggregateSnapshot } from './event.types';
import { EventStoreRepository } from './event.repository';
import { EventPublisher } from './event.publisher';

export class EventReplayEngine {
  private repository: EventStoreRepository;
  private publisher: EventPublisher;
  private getLatestSnapshotFn?: (aggregateId: string) => Promise<AggregateSnapshot | undefined>;

  constructor(
    repository: EventStoreRepository,
    getLatestSnapshotFn?: (aggregateId: string) => Promise<AggregateSnapshot | undefined>
  ) {
    this.repository = repository;
    this.publisher = EventPublisher.getInstance();
    this.getLatestSnapshotFn = getLatestSnapshotFn;
  }

  // إعادة بناء حالة كيان معين من الصفر أو من آخر لقطة حاسمة (القفز التاريخي الفوري) لتسريع الـ Replay
  async replayAggregate(aggregateType: AggregateType, aggregateId: string): Promise<void> {
    let startingVersion = 0;
    
    if (this.getLatestSnapshotFn) {
      const latestSnapshot = await this.getLatestSnapshotFn(aggregateId);
      if (latestSnapshot) {
        startingVersion = latestSnapshot.version + 1;
        console.log(`🚀 [Snapshot Store] Found snapshot for ${aggregateId} at version ${latestSnapshot.version}. Accelerating replay & jumping instantly to version ${startingVersion}.`);
      }
    }

    const stream = await this.repository.getStream(aggregateType, aggregateId, startingVersion);
    for (const event of stream) {
      await this.publisher.publishEvent(event);
    }
  }
}
