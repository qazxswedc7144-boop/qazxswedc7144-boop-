// server/database/prisma.ts
import { PrismaClient } from "@prisma/client";

// Allow Prisma to be optional
const hasDb = !!process.env.DATABASE_URL;

export class OfflineDatabaseError extends Error {
  constructor(model: string, operation: string) {
    super(`Database unavailable. Cannot perform ${operation} on ${model}.`);
    this.name = 'OfflineDatabaseError';
  }
}

let basePrisma: PrismaClient | null = null;
let finalDbUrl: string | undefined = undefined;

if (hasDb) {
  let databaseUrl = process.env.DATABASE_URL!.trim().replace(/^['"]|['"]$/g, '');

  // Process the DATABASE_URL to inject resilient parameters and TCP keepalives
  function getResilientDatabaseUrl(rawUrl: string): string {
    try {
      if (rawUrl.includes("localhost") || rawUrl.includes("127.0.0.1")) {
        return rawUrl;
      }

      const urlObj = new URL(rawUrl);
      
      // Inject robust TCP Keepalives
      urlObj.searchParams.set("keepalives", "1");
      if (!urlObj.searchParams.has("keepalives_idle")) {
        urlObj.searchParams.set("keepalives_idle", "30");
      }
      if (!urlObj.searchParams.has("keepalives_interval")) {
        urlObj.searchParams.set("keepalives_interval", "10");
      }
      if (!urlObj.searchParams.has("keepalives_count")) {
        urlObj.searchParams.set("keepalives_count", "3");
      }
      if (!urlObj.searchParams.has("connect_timeout")) {
        urlObj.searchParams.set("connect_timeout", "30");
      }

      // Control maximum connections
      if (!urlObj.searchParams.has("connection_limit")) {
        urlObj.searchParams.set("connection_limit", "10");
      }
      
      if (!urlObj.searchParams.has("pool_timeout")) {
        urlObj.searchParams.set("pool_timeout", "60");
      }

      return urlObj.toString();
    } catch (error) {
      console.warn("⚠️ Failed to parse database URL for resilient attributes decoration:", error);
      const separator = rawUrl.includes("?") ? "&" : "?";
      let decorated = rawUrl;
      if (!rawUrl.includes("keepalives=")) decorated += `${separator}keepalives=1`;
      if (!rawUrl.includes("keepalives_idle=")) decorated += `&keepalives_idle=30`;
      if (!rawUrl.includes("keepalives_interval=")) decorated += `&keepalives_interval=10`;
      if (!rawUrl.includes("keepalives_count=")) decorated += `&keepalives_count=3`;
      if (!rawUrl.includes("connect_timeout=")) decorated += `&connect_timeout=30`;
      if (!rawUrl.includes("pool_timeout=")) decorated += `&pool_timeout=60`;
      if (!rawUrl.includes("connection_limit=")) decorated += `&connection_limit=10`;
      
      return decorated;
    }
  }

  finalDbUrl = getResilientDatabaseUrl(databaseUrl);
  process.env.DATABASE_URL = finalDbUrl;

  basePrisma = new PrismaClient({
    datasources: {
      db: {
        url: finalDbUrl,
      },
    },
    log: ["info", "warn", "error"],
  });
}

// Helper to handle optional prisma operations
const throwNoDb = () => {
  throw new Error("PostgreSQL is not configured. Application is running in offline/local mode.");
};

// Resilient query retry wrapper for connection issues
const prismaClient = basePrisma ? basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        let retries = 2;
        let lastError: any = null;
        while (retries > 0) {
          try {
            return await query(args);
          } catch (error: any) {
            retries--;
            lastError = error;
            const errorMessage = error?.message || String(error);
            const isConnectionClosed = 
              errorMessage.includes("Closed") || 
              errorMessage.includes("closed") || 
              errorMessage.includes("connection") || 
              errorMessage.includes("socket") ||
              errorMessage.includes("terminated") ||
              errorMessage.includes("reach database") ||
              errorMessage.includes("Can't reach");

            if (isConnectionClosed && retries > 0) {
              console.warn(`[Prisma Retry] Connection/socket closed on ${model}.${operation}. Performing a hard reset of pool and retrying...`);
              try {
                await basePrisma!.$disconnect();
                await new Promise((resolve) => setTimeout(resolve, 200));
                await basePrisma!.$connect();
              } catch (connectErr: any) {
                console.warn("[Prisma Retry] Hard reset notice:", connectErr?.message || connectErr);
              }
              await new Promise((resolve) => setTimeout(resolve, 500));
            } else {
              throw error;
            }
          }
        }
        throw lastError || new Error(`Failed to execute query on ${model}.${operation} after retries.`);
      },
    },
    async $queryRaw({ args, query }) {
      let retries = 2;
      let lastError: any = null;
      while (retries > 0) {
        try {
          return await query(args);
        } catch (error: any) {
          retries--;
          lastError = error;
          const errorMessage = error?.message || String(error);
          const isConnectionClosed = 
            errorMessage.includes("Closed") || 
            errorMessage.includes("closed") || 
            errorMessage.includes("connection") || 
            errorMessage.includes("socket") ||
            errorMessage.includes("terminated") ||
            errorMessage.includes("reach database") ||
            errorMessage.includes("Can't reach");

          if (isConnectionClosed && retries > 0) {
            console.warn(`[Prisma Retry] Connection/socket closed on $queryRaw. Performing a hard reset of pool and retrying...`);
            try {
              await basePrisma!.$disconnect();
              await new Promise((resolve) => setTimeout(resolve, 200));
              await basePrisma!.$connect();
            } catch (connectErr: any) {
              console.warn("[Prisma Retry] Hard reset notice:", connectErr?.message || connectErr);
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
          } else {
            throw error;
          }
        }
      }
      throw lastError || new Error(`Failed to execute $queryRaw after retries.`);
    },
    async $executeRaw({ args, query }) {
      let retries = 2;
      let lastError: any = null;
      while (retries > 0) {
        try {
          return await query(args);
        } catch (error: any) {
          retries--;
          lastError = error;
          const errorMessage = error?.message || String(error);
          const isConnectionClosed = 
            errorMessage.includes("Closed") || 
            errorMessage.includes("closed") || 
            errorMessage.includes("connection") || 
            errorMessage.includes("socket") ||
            errorMessage.includes("terminated") ||
            errorMessage.includes("reach database") ||
            errorMessage.includes("Can't reach");

          if (isConnectionClosed && retries > 0) {
            console.warn(`[Prisma Retry] Connection/socket closed on $executeRaw. Performing a hard reset of pool and retrying...`);
            try {
              await basePrisma!.$disconnect();
              await new Promise((resolve) => setTimeout(resolve, 200));
              await basePrisma!.$connect();
            } catch (connectErr: any) {
              console.warn("[Prisma Retry] Hard reset notice:", connectErr?.message || connectErr);
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
          } else {
            throw error;
          }
        }
      }
      throw lastError || new Error(`Failed to execute $executeRaw after retries.`);
    },
  },
}) : new Proxy({} as any, {
  get: (_target, prop) => {
    if (prop === '$connect' || prop === '$disconnect') return async () => {};
    if (prop === '$transaction' || prop === '$queryRaw' || prop === '$executeRaw') return throwNoDb;
    
    // Return a proxy that handles model accessors like auditLog, user, etc.
    return new Proxy({}, {
      get: (_modelTarget, modelProp) => {
        const operation = String(modelProp);
        
        // Read operations
        if (['findUnique', 'findFirst', 'findUniqueOrThrow', 'findFirstOrThrow'].includes(operation)) {
          return async () => null;
        }
        if (['findMany', 'groupBy'].includes(operation)) {
          return async () => [];
        }
        if (operation === 'count') {
          return async () => 0;
        }
        
        // Write operations
        if (['create', 'update', 'delete', 'upsert', 'createMany', 'updateMany', 'deleteMany'].includes(operation)) {
          throw new OfflineDatabaseError(String(prop), operation);
        }
        
        // Fallback
        return async () => null;
      }
    });
  }
});

export const prisma = prismaClient;

// Graceful shutdown hooks
process.on("beforeExit", async () => {
  if (basePrisma) {
    await basePrisma.$disconnect();
  }
});
