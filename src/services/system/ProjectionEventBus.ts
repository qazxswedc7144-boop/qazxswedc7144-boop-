import { db } from '@/core/db';
import { reportEngine } from '@/services/reports/reportEngine';

export interface ProjectionEvent {
  id?: number;
  eventId: string;
  eventType: string;
  aggregateId: string;
  payload: any;
  createdAt: string;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  errorMessage?: string;
}

export interface ProjectionCheckpoint {
  id: string; // usually 'report-projector'
  sequence: number;
  lastProcessedEventId: string;
  updatedAt: string;
}

export interface ProjectionHealth {
  projectionLag: number;
  projectionFailure: boolean;
  failedEventsCount: number;
  projectionQueueDepth: number;
  lastError?: string;
  checkpointSequence: number;
  newestSequence: number;
}

export class ReportProjector {
  /**
   * Projects an event into the reporting states / report engine.
   * If report cache flushing/refreshing fails, this will throw an error to fail the projection safely.
   */
  static async project(event: ProjectionEvent): Promise<void> {
    console.log(`[ReportProjector] Received event ${event.eventType} for aggregate ${event.aggregateId}`);
    
    // Invalidate reportCache and trigger reports re-aggregation safely on any invoice state change
    if (
      event.eventType === 'INVOICE_POSTED' || 
      event.eventType === 'INVOICE_UNPOSTED' || 
      event.eventType === 'INVOICE_DELETED'
    ) {
      if (reportEngine && typeof reportEngine.refresh === 'function') {
        await reportEngine.refresh();
      } else {
        throw new Error("ReportEngine.refresh is not defined or initialized");
      }
    }
  }
}

export class ProjectionEventBus {
  private static isProcessing = false;

  /**
   * Publishes an event to the projection event bus.
   * Runs asynchronous processing of the event queue immediately in the background.
   */
  static async publish(eventType: string, aggregateId: string, payload: any = {}): Promise<void> {
    try {
      const eventId = `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const eventRecord: ProjectionEvent = {
        eventId,
        eventType,
        aggregateId,
        payload,
        createdAt: new Date().toISOString(),
        status: 'PENDING'
      };

      // Add to indexedDb projectionEvents log
      await db.projectionEvents.add(eventRecord);
      console.log(`[ProjectionEventBus] Published Event: ${eventType} (ID: ${eventId})`);

      // Trigger background worker process stream (async/non-blocking)
      ProjectionEventBus.processQueue().catch((err) => {
        console.error('[ProjectionEventBus] Error in automatic queue trigger:', err);
      });
    } catch (err) {
      console.error('[ProjectionEventBus] Failed to publish projection event:', err);
    }
  }

  /**
   * Sequential background worker processor. Ensures events are processed FIFO style.
   */
  static async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // 1. Fetch current projection checkpoint state
      let checkpoint = await db.projectionCheckpoints.get('report-projector');
      if (!checkpoint) {
        checkpoint = {
          id: 'report-projector',
          sequence: 0,
          lastProcessedEventId: '',
          updatedAt: new Date().toISOString()
        };
        await db.projectionCheckpoints.add(checkpoint);
      }

      // 2. Fetch all unprocessed events in strict order of generation (id ascending)
      const events = await db.projectionEvents
        .where('id')
        .above(checkpoint.sequence)
        .sortBy('id');

      for (const event of events) {
        console.log(`[ProjectionEventBus] Processing sequence: ${event.id} (Type: ${event.eventType})`);
        
        try {
          // Project event state
          await ReportProjector.project(event);

          // Update event to processed
          await db.projectionEvents.update(event.id!, {
            status: 'PROCESSED',
            errorMessage: undefined
          });

          // Move checkpoint sequence forward safely
          checkpoint.sequence = event.id!;
          checkpoint.lastProcessedEventId = event.eventId;
          checkpoint.updatedAt = new Date().toISOString();
          await db.projectionCheckpoints.put(checkpoint);

        } catch (projErr: any) {
          console.error(`[ProjectionEventBus] Projection failed for event ${event.eventId} (Seq: ${event.id}):`, projErr);
          
          await db.projectionEvents.update(event.id!, {
            status: 'FAILED',
            errorMessage: projErr?.message || String(projErr)
          });

          // Break sequence processing. We preserve FIFO order and keep checkpoint where it failed.
          // This creates a safe stop where lag grows, raising flags to system administration.
          break;
        }
      }
    } catch (err) {
      console.error('[ProjectionEventBus] Global queue processing failure:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Resets all report projection checkpoints, purges caches, and replays all events from scratch.
   */
  static async rollbackAndReplay(): Promise<void> {
    try {
      console.warn('[ProjectionEventBus] Replaying and Rebuilding Report Projections from historical event store...');
      
      // 1. Reset Checkpoint to sequence 0
      const checkpoint = {
        id: 'report-projector',
        sequence: 0,
        lastProcessedEventId: '',
        updatedAt: new Date().toISOString()
      };
      await db.projectionCheckpoints.put(checkpoint);

      // 2. Reset status of all events back to PENDING
      const events = await db.projectionEvents.toArray();
      for (const event of events) {
        await db.projectionEvents.update(event.id!, {
          status: 'PENDING',
          errorMessage: undefined
        });
      }

      // 3. Clear report caches proactively
      if (reportEngine && typeof reportEngine.refresh === 'function') {
        await reportEngine.refresh();
      }

      // 4. Trigger reprocessing
      await ProjectionEventBus.processQueue();
      console.log('[ProjectionEventBus] Replay and projection rebuild sequence completed successfully!');
    } catch (err) {
      console.error('[ProjectionEventBus] Error replaying projections:', err);
      throw err;
    }
  }

  /**
   * Returns comprehensive health check metrics on the event projection engine.
   */
  static async getHealth(): Promise<ProjectionHealth> {
    try {
      // Latest event
      const newestEvent = await db.projectionEvents.toCollection().last();
      const newestSequence = newestEvent?.id || 0;

      // Checkpoint
      const checkpoint = await db.projectionCheckpoints.get('report-projector');
      const checkpointSequence = checkpoint?.sequence || 0;

      // Unprocessed PENDING events count (Queue Depth)
      const projectionQueueDepth = await db.projectionEvents
        .where('status')
        .equals('PENDING')
        .count();

      // Number of FAILED events
      const failedEventsCount = await db.projectionEvents
        .where('status')
        .equals('FAILED')
        .count();

      // Find first error message
      let lastError: string | undefined;
      if (failedEventsCount > 0) {
        const firstFailed = await db.projectionEvents
          .where('status')
          .equals('FAILED')
          .first();
        lastError = firstFailed?.errorMessage;
      }

      // Calculate Lag: Difference between latest sequence index generated and latest index projected
      const projectionLag = Math.max(0, newestSequence - checkpointSequence);

      return {
        projectionLag,
        projectionFailure: failedEventsCount > 0,
        failedEventsCount,
        projectionQueueDepth,
        lastError,
        checkpointSequence,
        newestSequence
      };
    } catch (err: any) {
      console.error('[ProjectionEventBus] Failed to compile health status:', err);
      return {
        projectionLag: -1,
        projectionFailure: true,
        failedEventsCount: 1,
        projectionQueueDepth: -1,
        checkpointSequence: -1,
        newestSequence: -1,
        lastError: err?.message || String(err)
      };
    }
  }
}
