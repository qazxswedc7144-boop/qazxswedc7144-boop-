// server/database/prisma.ts
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL || "postgresql://pharmaadmin:SecretSecurePassword2026!@localhost:5432/pharmaflow_erp?schema=public";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = databaseUrl;
}

// Set up logging levels for Enterprise monitoring
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "production" 
    ? ["error", "warn"] 
    : ["query", "info", "warn", "error"],
});

// Graceful shutdown hooks
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});
