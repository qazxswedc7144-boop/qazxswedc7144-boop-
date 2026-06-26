// server/routes/accounting.routes.ts
import { Router, Response } from "express";
import { prisma, OfflineDatabaseError } from "../database/prisma";
import { runInTransaction } from "../core/database/transactionGuard";
import { authenticateToken, requireRoles, AuthenticatedRequest } from "../middleware/auth.middleware";
import { Prisma, Role } from "@prisma/client";
import { LockingService } from "../modules/locking/locking.service";
import { AccountingEntrySchema } from "../../src/shared/validation/accounting.schema";
import { validateRequestBody } from "../middleware/validate";

export const accountingRouter = Router();

/**
 * POST /api/accounting/journal
 * Manually posts a multi-line general journal entry directly to the Ledger.
 * Uses Row-Level Locking, version checks, and Double-entry balancing enforcement.
 */
accountingRouter.post("/journal", authenticateToken, requireRoles([Role.PLATFORM_OWNER, Role.TENANT_ADMIN, Role.ADMIN, Role.ACCOUNTANT]), validateRequestBody(AccountingEntrySchema), async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId || "SYSTEM";
  const branchId = "BRH-MAIN-001";
  const key = `purchase:journal:${userId}`;

  const lock = await LockingService.acquireLock({
    key,
    branchId,
    lockType: "PURCHASE",
    ownerId: userId,
    ttl: 15000
  });

  if (!lock) {
    return res.status(423).json({
      error: "LOCK_CONFLICT",
      message: "An active posting operation is already running for your account. Please wait."
    });
  }

  try {
    const data = req.body; // sanitized and verified by validateRequestBody

    const result = await runInTransaction("AccountingService", async (tx) => {
      const sumDebits = data.lines.reduce((sum: number, l: any) => sum + l.debit, 0);
      const sumCredits = data.lines.reduce((sum: number, l: any) => sum + l.credit, 0);

      // Verify general ledger balance
      if (Math.abs(sumDebits - sumCredits) > 0.0001) {
        throw new Error(`UNBALANCED_ENTRY: Debits sum (${sumDebits}) must exactly equal credits sum (${sumCredits}).`);
      }

      // Lock target account rows to avoid dirty checks
      const accountIds = data.lines.map((l: any) => l.accountId);
      await tx.$executeRaw(
        Prisma.sql`SELECT id FROM accounts WHERE id IN (${Prisma.join(accountIds)}) FOR UPDATE`
      );

      // Create main entry
      const entry = await tx.journalEntry.create({
        data: {
          date: new Date(),
          sourceType: "MANUAL",
          status: "POSTED",
          description: data.description || "قيد محاسبي يدوي",
          debitTotal: sumDebits,
          creditTotal: sumCredits,
          lines: {
            create: data.lines.map((line: any) => ({
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
              description: line.description
            }))
          }
        }
      });

      // Update account balances with version checking (Optimistic locking)
      for (const line of data.lines) {
        const adjustment = line.debit - line.credit;
        const currentAccount = await tx.account.findUnique({ where: { id: line.accountId } });
        if (!currentAccount) throw new Error(`ACCOUNT_NOT_FOUND: Account ID ${line.accountId} doesn't exist.`);

        await tx.account.update({
          where: { 
            id: line.accountId,
            version: currentAccount.version
          },
          data: {
            balance: { increment: adjustment },
            version: { increment: 1 }
          }
        });
      }

      // Record detailed Audit trail
      await tx.auditLog.create({
        data: {
          userId: req.user?.userId || null,
          action: "POST_MANUAL_JOURNAL",
          entity: "JournalEntry",
          entityId: entry.id,
          before: null,
          after: JSON.stringify(entry),
          ipAddress: req.ip
        }
      });

      return entry;
    });

    return res.status(201).json({
      success: true,
      message: "Journal registered and posted successfully.",
      journalId: result.id
    });
  } catch (err: any) {
    if (err instanceof OfflineDatabaseError) return res.status(503).json({ success: false, offline: true, message: "Database unavailable." });
    return res.status(400).json({
      error: "JOURNAL_FAILED",
      message: err.message || err
    });
  } finally {
    await LockingService.releaseLock(key, lock.id, branchId, userId);
  }
});

/**
 * GET /api/reports/trial-balance
 * Generates an instantaneous Trial Balance report mapping all debit/credit ledgers
 */
accountingRouter.get("/reports/trial-balance", authenticateToken, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const rawAccounts = await prisma.account.findMany({
      orderBy: { code: "asc" }
    });

    let cumulativeDebitSum = 0;
    let cumulativeCreditSum = 0;

    const trialEntries = rawAccounts.map(acc => {
      const balance = Number(acc.balance);
      let debitSummary = 0;
      let creditSummary = 0;

      // Depending on account type asset/expense debit increases balance, otherwise credit
      if (acc.type === "ASSET" || acc.type === "EXPENSE") {
        if (balance >= 0) {
          debitSummary = balance;
        } else {
          creditSummary = Math.abs(balance);
        }
      } else {
        if (balance >= 0) {
          creditSummary = balance;
        } else {
          debitSummary = Math.abs(balance);
        }
      }

      cumulativeDebitSum += debitSummary;
      cumulativeCreditSum += creditSummary;

      return {
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        debit: debitSummary,
        credit: creditSummary,
        rawBalance: balance
      };
    });

    return res.json({
      success: true,
      reportDate: new Date().toISOString(),
      summary: {
        totalDebits: cumulativeDebitSum,
        totalCredits: cumulativeCreditSum,
        isBalanced: Math.abs(cumulativeDebitSum - cumulativeCreditSum) < 0.01
      },
      accounts: trialEntries
    });
  } catch (err: any) {
    return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
  }
});

/**
 * GET /api/accounting/accounts
 * Fetch all registered chart of accounts
 */
accountingRouter.get("/accounts", authenticateToken, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: { code: "asc" },
      include: {
        parent: true
      }
    });

    return res.json({
      success: true,
      accounts
    });
  } catch (err: any) {
    return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
  }
});
