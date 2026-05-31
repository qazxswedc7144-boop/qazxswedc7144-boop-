// ==========================================
// FILE: src/modules/workers/worker.pool.ts
// ==========================================

import { WorkerTask, WorkerResponse, WorkerMetrics } from './worker.types';

export class WorkerPool {
  private static instance: WorkerPool;
  
  // Pool capacities
  private maxWorkers: number;
  private activeWorkers = new Set<Worker>();
  private idleWorkers: { worker: Worker; type: string; lastUsed: number }[] = [];
  private taskQueue: { 
    type: 'accounting' | 'inventory' | 'reporting';
    task: WorkerTask;
    resolve: (val: WorkerResponse) => void;
    reject: (err: Error) => void;
  }[] = [];

  // Monitoring
  private executionsCount = 0;
  private totalDurationMs = 0;
  private failuresCount = 0;
  private maxQueueDepth = 0;

  // Cleanup timers
  private idleCheckInterval: any = null;

  private constructor() {
    // navigator.hardwareConcurrency - 1, fallback to 2
    const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 3) : 3;
    this.maxWorkers = Math.max(2, cores - 1);

    // Run interval to sweep idle workers every 30 seconds to protect low-memory Android devices
    if (typeof window !== 'undefined') {
      this.idleCheckInterval = setInterval(() => this.reclaimIdleWorkers(), 30000);
    }
  }

  public static getInstance(): WorkerPool {
    if (!WorkerPool.instance) {
      WorkerPool.instance = new WorkerPool();
    }
    return WorkerPool.instance;
  }

  /**
   * Run a task via the worker pool. If workers are blocked or fail to instantiate,
   * it falls back to a scheduled micro-task on the main thread.
   */
  public runTask(
    type: 'accounting' | 'inventory' | 'reporting',
    task: WorkerTask,
    mainThreadFallback: () => any
  ): Promise<WorkerResponse> {
    const startTime = performance.now();
    this.executionsCount++;

    return new Promise<WorkerResponse>((resolve, reject) => {
      // 1. Check if Web Workers are supported and enabled
      if (typeof Worker === 'undefined') {
        this.runOnMainThread(task, mainThreadFallback, startTime, resolve);
        return;
      }

      this.enqueueTask(type, task, resolve, reject, mainThreadFallback, startTime);
    });
  }

  private enqueueTask(
    type: 'accounting' | 'inventory' | 'reporting',
    task: WorkerTask,
    resolve: (val: WorkerResponse) => void,
    reject: (err: Error) => void,
    mainThreadFallback: () => any,
    startTime: number
  ) {
    this.taskQueue.push({ type, task, resolve, reject });
    if (this.taskQueue.length > this.maxQueueDepth) {
      this.maxQueueDepth = this.taskQueue.length;
    }

    this.processNext(mainThreadFallback, startTime);
  }

  private processNext(mainThreadFallback: () => any, startTime: number) {
    if (this.taskQueue.length === 0) return;

    // Retrieve next item safely
    const item = this.taskQueue[0];
    if (!item) return;

    // Find if we have an idle worker of matching type
    const idleIndex = this.idleWorkers.findIndex(iw => iw.type === item.type);
    
    if (idleIndex !== -1) {
      const spliced = this.idleWorkers.splice(idleIndex, 1);
      if (spliced.length > 0 && spliced[0]) {
        const worker = spliced[0].worker;
        this.taskQueue.shift(); // remove from queue
        this.dispatchToWorker(worker, item.type, item.task, item.resolve, item.reject, mainThreadFallback, startTime);
        return;
      }
    }

    // Try to spawn a new worker if under max limit
    if (this.activeWorkers.size < this.maxWorkers) {
      this.taskQueue.shift(); // remove from queue
      try {
        const worker = this.createWorkerInstance(item.type);
        this.activeWorkers.add(worker);
        this.dispatchToWorker(worker, item.type, item.task, item.resolve, item.reject, mainThreadFallback, startTime);
      } catch (err) {
        console.warn(`[WorkerPool] Failed to instantiate worker of type '${item.type}'. Falling back to Main Thread execution. Error:`, err);
        this.runOnMainThread(item.task, mainThreadFallback, startTime, item.resolve);
      }
      return;
    }

    // Otherwise, let requestIdleCallback or setTimeout schedule the next processing round
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => this.processNext(mainThreadFallback, startTime));
    } else {
      setTimeout(() => this.processNext(mainThreadFallback, startTime), 10);
    }
  }

  private createWorkerInstance(type: 'accounting' | 'inventory' | 'reporting'): Worker {
    let workerUrl = '';
    
    // Construct URLs relatively relative to entry points
    if (type === 'accounting') {
      workerUrl = new URL('../../workers/accounting.worker.ts', import.meta.url).href;
    } else if (type === 'inventory') {
      workerUrl = new URL('../../workers/inventory.worker.ts', import.meta.url).href;
    } else {
      workerUrl = new URL('../../workers/reporting.worker.ts', import.meta.url).href;
    }

    // Standard Vite dynamic ES module web worker instantiator
    return new Worker(workerUrl, { type: 'module' });
  }

  private dispatchToWorker(
    worker: Worker,
    type: string,
    task: WorkerTask,
    resolve: (val: WorkerResponse) => void,
    _reject: (err: Error) => void,
    mainThreadFallback: () => any,
    startTime: number
  ) {
    const handleMessage = (e: MessageEvent) => {
      const response: WorkerResponse = e.data;
      if (response && response.id === task.id) {
        worker.removeEventListener('message', handleMessage);
        worker.removeEventListener('error', handleError);

        const endTime = performance.now();
        const duration = endTime - startTime;
        this.totalDurationMs += duration;

        response.durationMs = duration;
        
        if (!response.success) {
          this.failuresCount++;
        }

        // Return worker back to the idle queue
        this.idleWorkers.push({ worker, type, lastUsed: Date.now() });
        resolve(response);

        // Process next queued task
        this.processNext(mainThreadFallback, startTime);
      }
    };

    const handleError = (err: ErrorEvent) => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      
      this.failuresCount++;
      this.activeWorkers.delete(worker);
      try {
        worker.terminate();
      } catch (e) {}

      console.warn(`[WorkerPool] Worker crashed! Falling back to Main Thread fallback. Error:`, err.message);
      this.runOnMainThread(task, mainThreadFallback, startTime, resolve);
      
      this.processNext(mainThreadFallback, startTime);
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);

    // Send payload
    worker.postMessage(task);
  }

  private runOnMainThread(
    task: WorkerTask,
    mainThreadFallback: () => any,
    startTime: number,
    resolve: (val: WorkerResponse) => void
  ) {
    // Schedule on macroTask queue to prevent freezing the UI/Typing thread (< 16ms typing latency)
    setTimeout(async () => {
      try {
        const result = await mainThreadFallback();
        const endTime = performance.now();
        const duration = endTime - startTime;
        this.totalDurationMs += duration;

        resolve({
          id: task.id,
          success: true,
          result,
          durationMs: duration,
        });
      } catch (err: any) {
        this.failuresCount++;
        resolve({
          id: task.id,
          success: false,
          error: err.message || String(err),
          durationMs: performance.now() - startTime,
        });
      }
    }, 0);
  }

  /**
   * Memory Protection for Low-Memory and Mobile Android Devices:
   * Sweeps idle workers that have spent >15s without any task activity.
   */
  private reclaimIdleWorkers() {
    const now = Date.now();

    // Retain only those active less than 15 seconds
    const expired: typeof this.idleWorkers = [];
    this.idleWorkers = this.idleWorkers.filter(w => {
      if (now - w.lastUsed > 15000) {
        expired.push(w);
        return false;
      }
      return true;
    });

    for (const item of expired) {
      try {
        item.worker.terminate();
      } catch (e) {}
      this.activeWorkers.delete(item.worker);
    }

    if (expired.length > 0) {
      console.log(`[WorkerPool Memory Sweeper] Terminated ${expired.length} idle workers. Remaining active workers: ${this.activeWorkers.size}`);
    }
  }

  /**
   * Retrieves operational health monitor indicators for administrators
   */
  public getMetrics(): WorkerMetrics {
    const avgDuration = this.executionsCount > 0 ? (this.totalDurationMs / this.executionsCount) : 0;
    const utilization = this.executionsCount > 0 
      ? (this.activeWorkers.size - this.idleWorkers.length) / this.maxWorkers 
      : 0;

    return {
      durationMs: avgDuration,
      queueDepth: this.taskQueue.length,
      utilization: Math.max(0, Math.min(1, utilization)),
      failures: this.failuresCount,
      activeWorkers: this.activeWorkers.size,
    };
  }

  public shutdown() {
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
    }
    for (const w of this.activeWorkers) {
      try { w.terminate(); } catch (e) {}
    }
    this.activeWorkers.clear();
    this.idleWorkers = [];
    this.taskQueue = [];
  }
}
