// server/jobs/cleanup-idempotency.job.ts
import { IdempotencyRepository } from "../modules/idempotency/idempotency.repository";
import pino from "pino";

const logger = pino({
  level: "info",
  base: { service: "pharmaflow-cleanup-job" },
  timestamp: pino.stdTimeFunctions.isoTime
});

/**
 * Sweeps expired keys from the PostgreSQL database.
 */
export async function runCleanupIdempotencyJob(): Promise<number> {
  logger.info("Starting scheduled sweep of expired idempotency keys...");
  try {
    const cleared = await IdempotencyRepository.deleteExpiredKeys();
    if (cleared > 0) {
      logger.info({ cleared }, `Cron job cleared ${cleared} expired records.`);
    } else {
      logger.debug("Cleanup scanned database. No expired idempotency keys found.");
    }
    return cleared;
  } catch (error) {
    logger.error(error, "Failed to execute expired idempotency keys cleanup transaction.");
    return 0;
  }
}

/**
 * Registers a simple system-level interval trigger to sweep expired records every hour
 */
export function registerIdempotencyCleanupCron(intervalMs = 60 * 60 * 1000) {
  logger.info(`Idempotency key automatic background monitor loaded. Sweeper runs every ${intervalMs / 60000} mins.`);
  
  // Run on startup
  runCleanupIdempotencyJob().catch(() => {});
  
  const timer = setInterval(() => {
    runCleanupIdempotencyJob().catch(() => {});
  }, intervalMs);
  
  if (timer.unref) {
    timer.unref(); // Allow process to exit cleanly if necessary
  }
  
  return timer;
}
