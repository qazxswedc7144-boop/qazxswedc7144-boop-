// server/database/prisma.ts
import { PrismaClient } from "@prisma/client";

let databaseUrl = process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy";
if (typeof databaseUrl === "string") {
  databaseUrl = databaseUrl.trim().replace(/^['"]|['"]$/g, '');
}

if (!process.env.DATABASE_URL) {
  console.warn("⚠️ Warning: DATABASE_URL environment variable is missing. Setting up fallback to prevent container boot failures.");
}

// Process the DATABASE_URL to inject PgBouncer / Neon specific resilient parameters and TCP keepalives
function getResilientDatabaseUrl(rawUrl: string): string {
  try {
    // If it's a localhost URL, keep it simple
    if (rawUrl.includes("localhost") || rawUrl.includes("127.0.0.1")) {
      return rawUrl;
    }

    const urlObj = new URL(rawUrl);
    
    // Inject robust TCP Keepalives to prevent idle socket terminations by network gateways/firewalls
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

    // Automatically configure PgBouncer / Neon pooled connection enhancements
    const isPooler = urlObj.hostname.includes("-pooler") || urlObj.hostname.includes("pooler") || urlObj.port === "6543" || urlObj.searchParams.get("pgbouncer") === "true";
    
    if (isPooler) {
      // For transaction pooling in PgBouncer/Neon, pgbouncer=true is MANDATORY
      urlObj.searchParams.set("pgbouncer", "true");
      
      if (!urlObj.searchParams.has("pool_timeout")) {
        urlObj.searchParams.set("pool_timeout", "30");
      }
    }

    // Control maximum connections per container in serverless Cloud Run environments (default to 3 to prevent pool exhaustion)
    if (!urlObj.searchParams.has("connection_limit")) {
      urlObj.searchParams.set("connection_limit", "3");
    }

    return urlObj.toString();
  } catch (error) {
    console.warn("⚠️ Failed to parse database URL for resilient attributes decoration:", error);
    // If parse fails (e.g. because of unusual characters), do a safe manual suffix injection
    const separator = rawUrl.includes("?") ? "&" : "?";
    let decorated = rawUrl;
    if (!rawUrl.includes("keepalives=")) decorated += `${separator}keepalives=1`;
    if (!rawUrl.includes("keepalives_idle=")) decorated += `&keepalives_idle=30`;
    if (!rawUrl.includes("keepalives_interval=")) decorated += `&keepalives_interval=10`;
    if (!rawUrl.includes("keepalives_count=")) decorated += `&keepalives_count=3`;
    if (!rawUrl.includes("connect_timeout=")) decorated += `&connect_timeout=30`;

    const isPooler = rawUrl.includes("-pooler") || rawUrl.includes("pooler") || rawUrl.includes(":6543");
    if (isPooler) {
      if (!rawUrl.includes("pgbouncer=")) decorated += `&pgbouncer=true`;
      if (!rawUrl.includes("pool_timeout=")) decorated += `&pool_timeout=30`;
    }
    if (!rawUrl.includes("connection_limit=")) decorated += `&connection_limit=3`;
    
    return decorated;
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
  log: ["warn"],
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
              console.warn(`[Prisma Retry] Connection/socket closed on ${model}.${operation}. Performing a hard reset of pool and retrying...`);
              try {
                await basePrisma.$disconnect();
                await new Promise((resolve) => setTimeout(resolve, 200));
                await basePrisma.$connect();
              } catch (connectErr: any) {
                console.warn("[Prisma Retry] Hard reset notice:", connectErr?.message || connectErr);
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
            console.warn(`[Prisma Retry] Connection/socket closed on $queryRaw. Performing a hard reset of pool and retrying...`);
            try {
              await basePrisma.$disconnect();
              await new Promise((resolve) => setTimeout(resolve, 200));
              await basePrisma.$connect();
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
              await basePrisma.$disconnect();
              await new Promise((resolve) => setTimeout(resolve, 200));
              await basePrisma.$connect();
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
});

// Graceful shutdown hooks
process.on("beforeExit", async () => {
  await basePrisma.$disconnect();
});
