// server/modules/accounting/services/financialTransaction.service.ts
import { runInTransaction } from "../../../core/database/transactionGuard";
import { FifoService } from "../../inventory/services/fifo.service";
import { Prisma, InvoiceStatus, DocumentStatus, InvoiceType } from "@prisma/client";

export class FinancialTransactionService {
  /**
   * Helper to fetch or bootstrap system accounting ledger codes safely
   */
  private static async getOrCreateAccount(
    tx: Prisma.TransactionClient,
    code: string,
    name: string,
    type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE"
  ) {
    let account = await tx.account.findUnique({ where: { code } });
    if (!account) {
      account = await tx.account.create({
        data: {
          code,
          name,
          type,
          isSystem: true,
          balance: 0.00
        }
      });
    }
    return account;
  }

  /**
   * Safe transaction router to post any Invoice (Sale/Purchase/Returns) dynamically to General Ledger.
   * Completely encapsulated inside an ACID prisma transaction.
   */
  static async postInvoiceToLedger(
    invoiceId: string,
    userId: string | null = null,
    ipAddress: string | null = null
  ) {
    return await runInTransaction("AccountingService", async (tx) => {
      // 1. Fetch invoice and include all line items with product definitions
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { items: { include: { product: true } } }
      });

      if (!invoice) {
        throw new Error(`INVOICE_NOT_FOUND: Invoice ID ${invoiceId} doesn't exist.`);
      }

      if (invoice.documentStatus === "POSTED" || invoice.status === "CONFIRMED") {
        throw new Error(`ALREADY_POSTED: Invoice ${invoice.invoiceNumber} is already posted.`);
      }

      const totalInvoiceAmount = Number(invoice.totalAmount);
      const isCash = invoice.paymentStatus === "PAID" || invoice.paymentStatus === "CASH" as any;

      // 2. Lock core accounts involved in the transaction to prevent concurrent race conditions
      // We will bootstrap core accounts: Cash ('101001'), A/R ('101002'), Inventory ('101003'), Rev ('401001'), COGS ('501001'), A/P ('201001')
      const cashAcc = await this.getOrCreateAccount(tx, "101001", "الصندوق والبنك (النقدية)", "ASSET");
      const arAcc = await this.getOrCreateAccount(tx, "101002", "ذمم مدنية عملاء (أوراق القبض)", "ASSET");
      const invAcc = await this.getOrCreateAccount(tx, "101003", "مخزون الأدوية والمواد الطبية", "ASSET");
      const revAcc = await this.getOrCreateAccount(tx, "401001", "إيرادات المبيعات الدوائية", "REVENUE");
      const cogsAcc = await this.getOrCreateAccount(tx, "501001", "تكلفة المبيعات (COGS)", "EXPENSE");
      const apAcc = await this.getOrCreateAccount(tx, "201001", "ذمم دائنة موردين (أوراق الدفع)", "LIABILITY");

      // Lock current accounts for row-level balance security
      const accountIdsToLock = [cashAcc.id, arAcc.id, invAcc.id, revAcc.id, cogsAcc.id, apAcc.id];
      await tx.$executeRaw(
        Prisma.sql`SELECT id FROM accounts WHERE id IN (${Prisma.join(accountIdsToLock)}) FOR UPDATE`
      );

      let totalComputatedCogs = 0;
      const ledgerLines: { accountId: string; debit: number; credit: number; description: string }[] = [];

      // Preserve snapshot state before mutation for auditing purposes
      const invoiceSnapshotBefore = JSON.stringify(invoice);

      // 3. Process Inventory depletion or inclusion & map COGS/Stock entries
      if (invoice.type === InvoiceType.SALE) {
        // SALE: Deplete stock from FIFO batches and calculate actual Cost of Goods Sold
        for (const item of invoice.items) {
          const fifoResult = await FifoService.depleteStock(
            tx,
            item.productId,
            item.qty,
            invoice.id,
            "INVOICE",
            `صرف مبيعات - فاتورة #${invoice.invoiceNumber}`
          );
          
          totalComputatedCogs += fifoResult.totalCost;

          // Update actual cost in line item
          await tx.invoiceItem.update({
            where: { id: item.id },
            data: { cost: fifoResult.totalCost / item.qty }
          });
        }

        // Ledger Entry: Debit Cash or Accounts Receivable, Credit Sales Revenue
        if (isCash) {
          ledgerLines.push({
            accountId: cashAcc.id,
            debit: totalInvoiceAmount,
            credit: 0,
            description: `نقدية مبيعات فاتورة #${invoice.invoiceNumber}`
          });
        } else {
          ledgerLines.push({
            accountId: arAcc.id,
            debit: totalInvoiceAmount,
            credit: 0,
            description: `آجل مبيعات فاتورة #${invoice.invoiceNumber}`
          });
        }

        ledgerLines.push({
          accountId: revAcc.id,
          debit: 0,
          credit: totalInvoiceAmount,
          description: `مبيعات فاتورة #${invoice.invoiceNumber}`
        });

        // Ledger Entry for COGS: Debit COGS, Credit Inventory
        if (totalComputatedCogs > 0) {
          ledgerLines.push({
            accountId: cogsAcc.id,
            debit: totalComputatedCogs,
            credit: 0,
            description: `تكلفة مبيعات فاتورة #${invoice.invoiceNumber}`
          });
          ledgerLines.push({
            accountId: invAcc.id,
            debit: 0,
            credit: totalComputatedCogs,
            description: `انخفاض المخزون مبيعات فاتورة #${invoice.invoiceNumber}`
          });
        }

      } else if (invoice.type === InvoiceType.PURCHASE) {
        // PURCHASE: Increase inventory layers
        for (const item of invoice.items) {
          const batchNumber = item.note || `BATCH-${Date.now()}`;
          await FifoService.addStock(
            tx,
            item.productId,
            batchNumber,
            item.qty,
            Number(item.price),
            item.expiryDate,
            invoice.id,
            "INVOICE",
            `توريد مشتريات - فاتورة #${invoice.invoiceNumber}`
          );
        }

        // Ledger Entry: Debit Inventory, Credit Cash or Accounts Payable
        ledgerLines.push({
          accountId: invAcc.id,
          debit: totalInvoiceAmount,
          credit: 0,
          description: `زيادة مخزون مشتريات فاتورة #${invoice.invoiceNumber}`
        });

        if (isCash) {
          ledgerLines.push({
            accountId: cashAcc.id,
            debit: 0,
            credit: totalInvoiceAmount,
            description: `نقدية مشتريات فاتورة #${invoice.invoiceNumber}`
          });
        } else {
          ledgerLines.push({
            accountId: apAcc.id,
            debit: 0,
            credit: totalInvoiceAmount,
            description: `آجل مشتريات فاتورة #${invoice.invoiceNumber}`
          });
        }

      } else {
        throw new Error(`UNSUPPORTED_TYPE: Invoice type ${invoice.type} is not yet supported in automatic ledger mapping.`);
      }

      // 4. Double-Entry Enforcement Rule: totalDebit === totalCredit
      const sumDebits = ledgerLines.reduce((acc, l) => acc + l.debit, 0);
      const sumCredits = ledgerLines.reduce((acc, l) => acc + l.credit, 0);

      if (Math.abs(sumDebits - sumCredits) > 0.0001) {
        throw new Error(
          `UNBALANCED_ENTRY: Financial posting aborted. Total Debits [${sumDebits}] must strictly equal Total Credits [${sumCredits}]`
        );
      }

      // 5. Create general ledger Journal Entry
      const journalEntry = await tx.journalEntry.create({
        data: {
          date: invoice.date,
          sourceId: invoice.id,
          sourceType: "INVOICE",
          referenceId: invoice.invoiceNumber,
          status: "POSTED",
          description: `قيد ترحيل آلي لفاتورة ${invoice.type === "SALE" ? "مبيعات" : "مشتريات"} رقم #${invoice.invoiceNumber}`,
          debitTotal: sumDebits,
          creditTotal: sumCredits,
          lines: {
            create: ledgerLines.map(line => ({
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
              description: line.description
            }))
          }
        }
      });

      // 6. Persist core account balance mutations & Optimistic Locking version checks
      for (const line of ledgerLines) {
        const adjustment = line.debit - line.credit;
        const currentAccount = await tx.account.findUnique({ where: { id: line.accountId } });
        if (!currentAccount) throw new Error(`ACCOUNT_NOT_FOUND: Ledger target ID ${line.accountId} lacks setup.`);

        const updatedAccount = await tx.account.update({
          where: { 
            id: line.accountId,
            version: currentAccount.version // Optimistic lock validation!
          },
          data: {
            balance: { increment: adjustment },
            version: { increment: 1 }
          }
        });

        // Trigger safety check if update failed or missed due to race condition
        if (!updatedAccount) {
          throw new Error(`CONCURRENT_MUTATION_ERROR: Concurrent change detected on Account ${currentAccount.name}. Please retry operation.`);
        }
      }

      // 7. Lock the invoice status as "CONFIRMED" and "POSTED".
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.CONFIRMED,
          documentStatus: DocumentStatus.POSTED
        }
      });

      // 8. Capture immutable Audit Trail
      await tx.auditLog.create({
        data: {
          userId,
          action: "POST_JOURNAL",
          entity: "Invoice",
          entityId: invoiceId,
          before: invoiceSnapshotBefore,
          after: JSON.stringify(updatedInvoice),
          ipAddress
        }
      });

      return {
        success: true,
        journalId: journalEntry.id,
        invoiceNumber: invoice.invoiceNumber,
        cogs: totalComputatedCogs
      };
    });
  }
}
