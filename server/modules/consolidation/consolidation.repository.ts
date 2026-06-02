// server/modules/consolidation/consolidation.repository.ts

import { prisma } from "../../database/prisma";
import { Branch, Product, InventoryMovement } from "@prisma/client";

export class ConsolidationRepository {
  /**
   * Fetches all active billing/operational branches
   */
  static async getBranches(): Promise<Branch[]> {
    return prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" }
    });
  }

  /**
   * Retrieves paginated journal entries with lines and account types for financial calculations
   */
  static async getJournalEntries(page = 1, limit = 5000): Promise<{ entries: any[]; total: number }> {
    const skip = (page - 1) * limit;
    const [total, entries] = await Promise.all([
      prisma.journalEntry.count({
        where: { status: "POSTED" }
      }),
      prisma.journalEntry.findMany({
        where: { status: "POSTED" },
        include: {
          lines: {
            include: {
              account: true,
            }
          }
        },
        orderBy: { date: "desc" },
        skip,
        take: limit
      })
    ]);

    return { entries, total };
  }

  /**
   * Reads all journal lines directly as flat records for specific aggregation categories
   */
  static async getAllPostedJournalLines() {
    return prisma.journalLine.findMany({
      where: {
        entry: {
          status: "POSTED"
        }
      },
      include: {
        entry: true,
        account: true
      }
    });
  }

  /**
   * Fetches finished inter-branch stock transfers for eliminations
   */
  static async getCompletedBranchTransfers(): Promise<any[]> {
    return prisma.branchTransfer.findMany({
      where: {
        status: {
          in: ["RECEIVED", "IN_TRANSIT", "APPROVED"]
        }
      },
      include: {
        items: true,
        sourceBranch: true,
        targetBranch: true
      }
    });
  }

  /**
   * Fetches all invoices representing sales/purchases between branches or external vendors
   */
  static async getInvoices(page = 1, limit = 10000): Promise<any[]> {
    const skip = (page - 1) * limit;
    return prisma.invoice.findMany({
      where: {
        status: "CONFIRMED"
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: { date: "desc" },
      skip,
      take: limit
    });
  }

  /**
   * Returns complete inventory quantities per branch and product
   */
  static async getBranchInventoryLevels(): Promise<any[]> {
    return prisma.branchInventory.findMany({
      include: {
        branch: true
      }
    });
  }

  /**
   * Returns list of all products for catalog pricing
   */
  static async getProductCatalog(): Promise<Product[]> {
    return prisma.product.findMany({
      where: {
        isActive: true,
        deletedAt: null
      }
    });
  }

  /**
   * Returns inventory movements in last 90 days for velocity analysis (slow/fast indicators)
   */
  static async getHistoricalMovements(since: Date): Promise<InventoryMovement[]> {
    return prisma.inventoryMovement.findMany({
      where: {
        createdAt: {
          gte: since
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  /**
   * Fetches sales items since a specified calendar threshold
   */
  static async getSalesItems(since: Date): Promise<any[]> {
    return prisma.invoiceItem.findMany({
      where: {
        invoice: {
          type: "SALE",
          status: "CONFIRMED",
          date: { gte: since }
        }
      },
      include: {
        invoice: true,
        product: true
      }
    });
  }

  /**
   * Creates event records for audit traceability
   */
  static async writeAuditLog(userId: string | null, action: string, entityId: string, payload: any, ipAddress?: string) {
    return prisma.auditLog.create({
      data: {
        userId,
        action,
        entity: "FinancialConsolidation",
        entityId,
        before: null,
        after: JSON.stringify(payload),
        ipAddress: ipAddress || "SYSTEM",
        branchId: "CONSOLIDATED"
      }
    });
  }

  /**
   * Creates sync events inside the global event-sourced pipeline
   */
  static async publishSyncEvent(eventId: string, eventType: string, entityId: string, payload: any, userId: string | null) {
    return prisma.syncEvent.create({
      data: {
        eventId,
        clientTime: new Date(),
        userId,
        eventType,
        entityType: "CONSOLIDATION",
        entityId,
        payload: payload,
        branchId: "CONSOLIDATED",
        vectorClock: { value: 1 }
      }
    });
  }
}
