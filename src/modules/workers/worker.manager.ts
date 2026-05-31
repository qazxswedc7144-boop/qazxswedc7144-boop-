// ==========================================
// FILE: src/modules/workers/worker.manager.ts
// ==========================================

import { WorkerPool } from './worker.pool';
import { WorkerMetrics } from './worker.types';

export const WorkerManager = {
  /**
   * Retrieves operational tracking indicators for display
   */
  getSystemMetrics(): WorkerMetrics {
    return WorkerPool.getInstance().getMetrics();
  },

  /**
   * Destroys all active workers in the pool (e.g. during logout, safe mode trigger, or hot-reloading)
   */
  purgePool(): void {
    console.log("[WorkerManager] Shutting down active worker pool and clearing task queue resources.");
    WorkerPool.getInstance().shutdown();
  },
};
