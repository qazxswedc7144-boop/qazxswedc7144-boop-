// server/routes/invoice.routes.ts
import { Router, Response } from "express";
import { z } from "zod";
import { prisma, OfflineDatabaseError } from "../database/prisma";
import { FinancialTransactionService } from "../modules/accounting/services/financialTransaction.service";
import { authenticateToken, requireRoles, AuthenticatedRequest } from "../middleware/auth.middleware";
import { LockingService } from "../modules/locking/locking.service";
import { ReplicationPublisher } from "../modules/replication/replication.publisher";
import { InvoiceStatus, DocumentStatus, Role } from "@prisma/client";
import { InvoiceSchema } from "../../src/shared/validation/invoice.schema";
import { validateRequestBody } from "../middleware/validate";
import { UUIDSchema } from "../../src/shared/validation/common.schema";
import { SaasService } from "../modules/saas/saas.service";

export const invoiceRouter = Router();

/**
 * POST /api/invoices/create
 * Registers a new invoice. Saved as a DRAFT.
 */
invoiceRouter.post("/create", authenticateToken, requireRoles([Role.PLATFORM_OWNER, Role.TENANT_ADMIN, Role.ADMIN, Role.ACCOUNTANT, Role.PHARMACIST, Role.INVENTORY_MANAGER]), validateRequestBody(InvoiceSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = req.body; // sanitized and verified by validateRequestBody
    const tenantId = req.user?.tenantId;

    if (tenantId) {
      const checkLimit = await SaasService.checkSubscriptionLimit(tenantId);
      if (!checkLimit.allowed) {
        return res.status(403).json({
          error: "SUBSCRIPTION_LIMIT_REACHED",
          message: checkLimit.reason
        });
      }
    }

    const existing = await prisma.invoice.findUnique({
      where: { invoiceNumber: data.invoiceNumber }
    });

    if (existing) {
      return res.status(400).json({
        error: "INVOICE_EXISTS",
        message: `فاتورة برقم "${data.invoiceNumber}" مسجلة مسبقاً في النظام.`
      });
    }

    // Calculate invoice total amount by summing up items
    let calculatedTotal = 0;
    const itemData = data.items.map((item: any) => {
      const lineTotal = item.qty * item.price;
      calculatedTotal += lineTotal;
      return {
        productId: item.productId,
        qty: item.qty,
        price: item.price,
        cost: 0, // calculated later during GL posting/depletion
        total: lineTotal,
        expiryDate: item.expiryDate,
        note: item.note
      };
    });

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: data.invoiceNumber,
        type: data.type,
        partnerId: data.partnerId,
        partnerType: data.partnerType,
        totalAmount: calculatedTotal,
        status: InvoiceStatus.DRAFT,
        paymentStatus: data.paymentStatus,
        documentStatus: DocumentStatus.ACTIVE,
        tenantId: tenantId || null,
        items: {
          create: itemData
        }
      },
      include: {
        items: true
      }
    });

    // Write audit details
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId || null,
        action: "CREATE_INVOICE",
        entity: "Invoice",
        entityId: invoice.id,
        before: null,
        after: JSON.stringify(invoice),
        ipAddress: req.ip
      }
    });

    // Increment SaaS usage counter if tenant is configured
    if (tenantId) {
      await SaasService.incrementUsage(tenantId);
    }

    return res.status(201).json({
      success: true,
      invoice
    });
  } catch (err: any) {
    return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
  }
});

/**
 * POST /api/invoices/post
 * Enterprise endpoint to post and freeze an active draft invoice into General Ledger.
 */
invoiceRouter.post("/post", authenticateToken, requireRoles([Role.PLATFORM_OWNER, Role.TENANT_ADMIN, Role.ADMIN, Role.ACCOUNTANT, Role.PHARMACIST, Role.INVENTORY_MANAGER]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Validate request UUID with strict validator
    const bodyValidation = z.object({ invoiceId: UUIDSchema }).strict().safeParse(req.body);
    if (!bodyValidation.success) {
      return res.status(400).json({
        error: "VALIDATION_FAILED",
        message: "معرّف الفاتورة غير صالح أو مفقود."
      });
    }

    const { invoiceId } = bodyValidation.data;

    const key = `sales:${invoiceId}`;
    const branchId = "BRH-MAIN-001";
    const userId = req.user?.userId || "SYSTEM";

    const lock = await LockingService.acquireLock({
      key,
      branchId,
      lockType: "SALES",
      ownerId: userId,
      ttl: 20000
    });

    if (!lock) {
      return res.status(423).json({
        error: "LOCK_CONFLICT",
        message: "The requested invoice is currently being posted. Please wait."
      });
    }

    try {
      const result = await FinancialTransactionService.postInvoiceToLedger(
        invoiceId,
        req.user?.userId || null,
        req.ip || "127.0.0.1"
      );

      // Distribute replication events in real-time
      try {
        const invoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
          include: { items: true }
        });

        if (invoice) {
          const type = (invoice.type === "SALE" || invoice.type === "RETURN_SALE") ? "InvoicePosted" : "PurchasePosted";
          await ReplicationPublisher.publish({
            type,
            branchId: invoice.branchId || "BRH-MAIN-001",
            userId: req.user?.userId || "SYSTEM",
            payload: {
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              totalAmount: Number(invoice.totalAmount),
              type: invoice.type,
              itemsCount: invoice.items.length,
            }
          });
        }
      } catch (repErr: any) {
        console.warn("[REPLICATION] Failed to publish post-invoice event:", repErr.message);
      }

      return res.json({
        success: true,
        message: "Invoice successfully validated, costed via FIFO/FEFO, and posted to General Ledger accounts.",
        data: result
      });
    } finally {
      await LockingService.releaseLock(key, lock.id, branchId, userId);
    }
  } catch (err: any) {
    if (err instanceof OfflineDatabaseError) return res.status(503).json({ success: false, offline: true, message: "Database unavailable." });
    return res.status(400).json({
      error: "POST_FAILED",
      message: err.message || err
    });
  }
});

/**
 * GET /api/invoices
 * Retrieves a list of invoices with pagination.
 */
invoiceRouter.get("/", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const invoices = await prisma.invoice.findMany({
      take: limit,
      skip: offset,
      orderBy: { date: "desc" },
      include: {
        items: true
      }
    });

    const total = await prisma.invoice.count();

    return res.json({
      success: true,
      total,
      limit,
      offset,
      invoices
    });
  } catch (err: any) {
    if (err instanceof OfflineDatabaseError) return res.status(503).json({ success: false, offline: true, message: "Database unavailable." });
    return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
  }
});

/**
 * GET /api/invoices/:id
 * Retrieve a single invoice structure.
 */
invoiceRouter.get("/:id", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Invoice not found." });
    }

    return res.json({
      success: true,
      invoice
    });
  } catch (err: any) {
    if (err instanceof OfflineDatabaseError) return res.status(503).json({ success: false, offline: true, message: "Database unavailable." });
    return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
  }
});
