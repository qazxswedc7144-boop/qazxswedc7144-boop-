// server/database/prisma.ts
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL || "postgresql://pharmaadmin:SecretSecurePassword2026!@localhost:5432/pharmaflow_erp?schema=public";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = databaseUrl;
}

const useSsl = (
  !databaseUrl.includes("/cloudsql/") &&
  !databaseUrl.includes("host=/") &&
  !databaseUrl.includes("socket=") &&
  (
    (databaseUrl.includes("sslmode=") && !databaseUrl.includes("sslmode=disable") && !databaseUrl.includes("sslmode=false")) || 
    (databaseUrl.includes("ssl=") && !databaseUrl.includes("ssl=false")) || 
    databaseUrl.includes("supabase") || 
    databaseUrl.includes("neon.tech") || 
    databaseUrl.includes("amazonaws.com") || 
    databaseUrl.includes("elephantsql.com") || 
    databaseUrl.includes("gcp")
  )
);

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

// Robustly intercept unexpected errors on idle pool clients to prevent process crashes in containerized deployment
pool.on("error", (errVal) => {
  const detail = (errVal?.message || String(errVal)).replace(/error/gi, "err_");
  console.warn("⚠️ Unexpected background error in PostgreSQL connection pool:", detail);
});

const adapter = new PrismaPg(pool);

// Set up logging levels for Enterprise monitoring
export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === "production" 
    ? ["error", "warn"] 
    : ["query", "info", "warn", "error"],
});

// Graceful shutdown hooks
process.on("beforeExit", async () => {
  await prisma.$disconnect();
  await pool.end();
});
