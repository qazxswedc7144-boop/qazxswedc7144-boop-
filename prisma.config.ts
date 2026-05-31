// prisma.config.ts
import { defineConfig } from "@prisma/config";

const databaseUrl = process.env.DATABASE_URL || "postgresql://pharmaadmin:SecretSecurePassword2026!@localhost:5432/pharmaflow_erp?schema=public";

export default defineConfig({
  datasource: {
    url: databaseUrl
  }
});
