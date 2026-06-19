// server/core/database/transactionGuard.ts
import { prisma } from "../../../server/database/prisma";
import { Prisma } from "@prisma/client";

/**
 * Transaction Guard Safety Helper
 * Safely executes Prisma transactions with strict error filtering, 
 * prevention of internal database detail exposure, and friendly Arabic ERP messages.
 */
export async function runInTransaction<T>(
  serviceName: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }
): Promise<T> {
  const startTime = Date.now();
  let isCommittedOrAborted = false;

  try {
    return await prisma.$transaction(async (tx) => {
      // Intercept and track lifecycle of this specific transaction client via Proxy
      const txProxy = new Proxy(tx, {
        get(target, prop, receiver) {
          if (isCommittedOrAborted) {
            console.error(
              `🛑 [TRANSACTION_GUARD] Violation: Attempted to call "${String(prop)}" on a closed transaction in service [${serviceName}].`
            );
            throw new Error(`TRANSACTION_CLOSED: Use of transaction client after commit/rollback in ${serviceName}`);
          }
          const value = Reflect.get(target, prop, receiver);
          if (typeof value === "function") {
            return function (this: any, ...args: any[]) {
              if (isCommittedOrAborted) {
                console.error(
                  `🛑 [TRANSACTION_GUARD] Violation: Attempted call on closed transaction inside function block in service [${serviceName}].`
                );
                throw new Error("TRANSACTION_CLOSED: Action attempted on a terminated transaction.");
              }
              return (value as Function).apply(this === receiver ? target : this, args);
            };
          }
          return value;
        }
      });

      try {
        const result = await fn(txProxy as unknown as Prisma.TransactionClient);
        return result;
      } finally {
        isCommittedOrAborted = true;
      }
    }, options);
  } catch (error: any) {
    isCommittedOrAborted = true;
    const duration = Date.now() - startTime;
    const errorMsg = error?.message || String(error);
    
    // Log complete technical details only on the server, as requested
    console.error(`❌ [TRANSACTION_GUARD] [${serviceName}] Transaction failed after ${duration}ms:`, error);

    // Standardize ERP Arabic Error Message
    // Make sure we show "تعذر إكمال العملية حالياً، يرجى إعادة المحاولة." instead of engine-specific errors.
    const isTxError = 
      errorMsg.includes("committed too early") || 
      errorMsg.includes("transaction") || 
      errorMsg.includes("Transaction") || 
      errorMsg.includes("tx.") || 
      errorMsg.includes("interactive transactions") ||
      errorMsg.includes("PrismaClientKnownRequestError") ||
      errorMsg.includes("PrismaClientUnknownRequestError") ||
      errorMsg.includes("PrismaClientInitializationError") ||
      errorMsg.includes("PrismaClientRustPanicError") ||
      errorMsg.includes("TRANSACTION_CLOSED") ||
      error?.code?.startsWith("P2"); // Prisma error codes start with P2

    if (isTxError) {
      throw new Error("تعذر إكمال العملية حالياً، يرجى إعادة المحاولة.");
    }
    
    throw error;
  }
}
