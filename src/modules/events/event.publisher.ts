import { BaseEventStoreItem } from './event.types';
import { ReadModelProjector } from './event.projector';

export class EventPublisher {
  private static instance: EventPublisher;
  private projectors: ReadModelProjector[] = [];

  private constructor() {}

  public static getInstance(): EventPublisher {
    if (!EventPublisher.instance) {
      EventPublisher.instance = new EventPublisher();
    }
    return EventPublisher.instance;
  }

  public registerProjector(projector: ReadModelProjector): void {
    this.projectors.push(projector);
  }

  public async publishEvent(event: BaseEventStoreItem): Promise<void> {
    // تشغيل الـ Projectors بالتوازي لتحديث كل نماذج القراءة (Read Models) بحصانة شاملة
    const projections = this.projectors.map((projector) =>
      projector.project(event).catch((err) => {
        console.error(`Projection Failure for ${projector.constructor.name}:`, err);
      })
    );
    await Promise.all(projections);
  }
}
