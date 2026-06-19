// server/database/prisma.ts
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL || "postgresql://pharmaadmin:SecretSecurePassword2026!@localhost:5432/pharmaflow_erp?schema=public";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = databaseUrl;
}

// Process the DATABASE_URL to inject PgBouncer / Neon specific resilient parameters
function getResilientDatabaseUrl(rawUrl: string): string {
  try {
    // If it's a localhost URL, keep it simple
    if (rawUrl.includes("localhost") || rawUrl.includes("127.0.0.1")) {
      return rawUrl;
    }

    const urlObj = new URL(rawUrl);
    
    // Automatically configure PgBouncer / Neon pooled connection enhancements
    const isPooler = urlObj.hostname.includes("-pooler") || urlObj.hostname.includes("pooler");
    const isNeon = urlObj.hostname.includes("neon.tech");

    if (isPooler || isNeon) {
      // For transaction pooling in PgBouncer/Neon, pgbouncer=true is MANDATORY
      urlObj.searchParams.set("pgbouncer", "true");
      
      // Prevent connection timeouts during scaling sleep periods (scale-to-zero)
      if (!urlObj.searchParams.has("connect_timeout")) {
        urlObj.searchParams.set("connect_timeout", "30");
      }
      if (!urlObj.searchParams.has("pool_timeout")) {
        urlObj.searchParams.set("pool_timeout", "30");
      }
      
      // Control maximum connections per container in Cloud Run serverless environments
      if (!urlObj.searchParams.has("connection_limit")) {
        urlObj.searchParams.set("connection_limit", "10");
      }
    }

    return urlObj.toString();
  } catch (error) {
    console.warn("⚠️ Failed to parse database URL for resilient attributes decoration:", error);
    // If parse fails (e.g. because of unusual characters), do a safe manual suffix injection
    if (rawUrl.includes("-pooler") || rawUrl.includes("neon.tech")) {
      const separator = rawUrl.includes("?") ? "&" : "?";
      let decorated = rawUrl;
      if (!rawUrl.includes("pgbouncer=")) decorated += `${separator}pgbouncer=true`;
      if (!rawUrl.includes("connect_timeout=")) decorated += `&connect_timeout=30`;
      if (!rawUrl.includes("pool_timeout=")) decorated += `&pool_timeout=30`;
      if (!rawUrl.includes("connection_limit=")) decorated += `&connection_limit=10`;
      return decorated;
    }
    return rawUrl;
  }
}

const finalDbUrl = getResilientDatabaseUrl(databaseUrl);

// Update process.env.DATABASE_URL to be the resilient/decorated URL, so child processes (like Prisma CLI db push) also benefit from PgBouncer configurations
process.env.DATABASE_URL = finalDbUrl;

// Set up logging levels for Enterprise monitoring
const basePrisma = new PrismaClient({
  datasources: {
    db: {
      url: finalDbUrl,
    },
  },
  log: process.env.NODE_ENV === "production" 
    ? ["error", "warn"] 
    : ["query", "info", "warn", "error"],
});

// Resilient query retry wrapper for connection issues (stale pool, scale-to-zero, etc.)
export const prisma = basePrisma.$extends({
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
              console.warn(`[Prisma Retry] Connection/socket closed on ${model}.${operation}. Attempting reconnect and retry...`);
              try {
                await basePrisma.$connect();
              } catch (connectErr) {
                console.error("[Prisma Retry] Reconnection helper failed:", connectErr);
              }
              // Wait briefly before retry to allow database recovery/wakeup
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
            console.warn(`[Prisma Retry] Connection/socket closed on $queryRaw. Attempting reconnect and retry...`);
            try {
              await basePrisma.$connect();
            } catch (connectErr) {
              console.error("[Prisma Retry] Reconnection helper failed:", connectErr);
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
            console.warn(`[Prisma Retry] Connection/socket closed on $executeRaw. Attempting reconnect and retry...`);
            try {
              await basePrisma.$connect();
            } catch (connectErr) {
              console.error("[Prisma Retry] Reconnection helper failed:", connectErr);
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
});

// Graceful shutdown hooks
process.on("beforeExit", async () => {
  await basePrisma.$disconnect();
});
