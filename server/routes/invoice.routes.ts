// server/routes/invoice.routes.ts
import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../database/prisma";
import { FinancialTransactionService } from "../modules/accounting/services/financialTransaction.service";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth.middleware";
import { InvoiceStatus, DocumentStatus } from "@prisma/client";
import { InvoiceSchema } from "../../src/shared/validation/invoice.schema";
import { validateRequestBody } from "../middleware/validate";
import { UUIDSchema } from "../../src/shared/validation/common.schema";

export const invoiceRouter = Router();

/**
 * POST /api/invoices/create
 * Registers a new invoice. Saved as a DRAFT.
 */
invoiceRouter.post("/create", authenticateToken, validateRequestBody(InvoiceSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = req.body; // sanitized and verified by validateRequestBody

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
invoiceRouter.post("/post", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
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

    const result = await FinancialTransactionService.postInvoiceToLedger(
      invoiceId,
      req.user?.userId || null,
      req.ip || "127.0.0.1"
    );

    return res.json({
      success: true,
      message: "Invoice successfully validated, costed via FIFO/FEFO, and posted to General Ledger accounts.",
      data: result
    });
  } catch (err: any) {
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
    return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
  }
});
