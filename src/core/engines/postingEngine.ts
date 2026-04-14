
import { db } from '@/services/database';
import { AccountingEntry, JournalLine, Sale, Purchase, InvoiceItem } from '@/types';
import { AccountingEngine } from '@/services/AccountingEngine';
import { FIFOEngine } from './fifoEngine';
import { StockMovementEngine } from './stockMovementEngine';
import { AIInsightsEngine } from './aiInsightsEngine';

export class PostingEngine {

  /**
   * MAIN FUNCTION: postInvoice(invoice)
   */
  static async postInvoice(invoice: Sale | Purchase): Promise<string> {
    const isSale = 'SaleID' in invoice;
    const invoiceId = invoice.id;
    const invoiceNumber = isSale ? (invoice as Sale).SaleID : (invoice as Purchase).invoiceId;
    const isPosted = isSale ? (invoice as Sale).InvoiceStatus === 'POSTED' : (invoice as Purchase).invoiceStatus === 'POSTED';
    const items = invoice.items;
    const total = isSale ? (invoice as Sale).finalTotal : (invoice as Purchase).totalAmount;
    const date = invoice.date;
    const tenantId = 'TEN-DEV-001';

    // 1. VALIDATION
    if (isPosted) {
      return ''; // Already posted, skip
    }
    if (!items || items.length === 0) {
      throw new Error("Invoice must have items.");
    }
    if (total <= 0) {
      throw new Error("Invoice total must be greater than 0.");
    }

    // 2. DETERMINE TYPE
    let type: 'sale_cash' | 'sale_credit' | 'purchase_cash' | 'purchase_credit' | 'sale_return_cash' | 'sale_return_credit' | 'purchase_return_cash' | 'purchase_return_credit';
    const isReturn = isSale ? (invoice as Sale).isReturn : (invoice as Purchase).invoiceType === 'مرتجع';

    if (isSale) {
      const s = invoice as Sale;
      if (isReturn) {
        type = s.paymentStatus === 'Cash' ? 'sale_return_cash' : 'sale_return_credit';
      } else {
        type = s.paymentStatus === 'Cash' ? 'sale_cash' : 'sale_credit';
      }
    } else {
      const p = invoice as Purchase;
      if (isReturn) {
        type = p.status === 'PAID' ? 'purchase_return_cash' : 'purchase_return_credit';
      } else {
        type = p.status === 'PAID' ? 'purchase_cash' : 'purchase_credit';
      }
    }

    const entryId = db.generateId('JE');
    let calculatedTotalCost = 0;

    // 3. FIFO & STOCK MOVEMENTS
    if (isSale) {
        if (isReturn) {
          // SALE RETURN: Increase Stock, Add FIFO Layer
          for (const item of items) {
            // We treat sale return as a purchase to restore stock
            await FIFOEngine.addPurchaseLayer(item.product_id, item.qty, item.price, invoiceId);
            await StockMovementEngine.recordPurchaseMovement(item.product_id, item.qty, item.price, invoiceId);
          }
        } else {
          // NORMAL SALE: Decrease Stock, Consume FIFO
          for (const item of items) {
            const { totalCost: itemCost } = await FIFOEngine.consumeFIFO(invoiceId, item.product_id, item.qty);
            calculatedTotalCost += itemCost;
            await StockMovementEngine.recordSaleMovement(item.product_id, item.qty, itemCost, invoiceId);
          }
        }
      } else {
        if (isReturn) {
          // PURCHASE RETURN: Decrease Stock, Consume FIFO
          for (const item of items) {
            const { totalCost: itemCost } = await FIFOEngine.consumeFIFO(invoiceId, item.product_id, item.qty);
            calculatedTotalCost += itemCost;
            await StockMovementEngine.recordSaleMovement(item.product_id, item.qty, itemCost, invoiceId);
          }
        } else {
          // NORMAL PURCHASE: Increase Stock, Add FIFO Layer
          for (const item of items) {
            await FIFOEngine.addPurchaseLayer(item.product_id, item.qty, item.price, invoiceId);
            await StockMovementEngine.recordPurchaseMovement(item.product_id, item.qty, item.price, invoiceId);
          }
        }
      }

      // 4. DETERMINE ACCOUNTS
      const cashAcc = await AccountingEngine.getCoreAccount('CASH');
      const arAcc = await AccountingEngine.getCoreAccount('RECEIVABLE');
      const apAcc = await AccountingEngine.getCoreAccount('PAYABLE');
      const invAcc = await AccountingEngine.getCoreAccount('INVENTORY');
      const revenueAcc = await AccountingEngine.getCoreAccount('SALES_REVENUE');
      const cogsAcc = await AccountingEngine.getCoreAccount('COGS');

      const lines: JournalLine[] = [];

      // 5. CREATE JOURNAL LINES BASED ON TYPE
      switch (type) {
        case 'sale_cash':
          lines.push(this.createLine(entryId, cashAcc, total, 0, tenantId));
          lines.push(this.createLine(entryId, revenueAcc, 0, total, tenantId));
          if (calculatedTotalCost > 0) {
            lines.push(this.createLine(entryId, cogsAcc, calculatedTotalCost, 0, tenantId));
            lines.push(this.createLine(entryId, invAcc, 0, calculatedTotalCost, tenantId));
          }
          break;

        case 'sale_credit':
          lines.push(this.createLine(entryId, arAcc, total, 0, tenantId));
          lines.push(this.createLine(entryId, revenueAcc, 0, total, tenantId));
          if (calculatedTotalCost > 0) {
            lines.push(this.createLine(entryId, cogsAcc, calculatedTotalCost, 0, tenantId));
            lines.push(this.createLine(entryId, invAcc, 0, calculatedTotalCost, tenantId));
          }
          break;

        case 'sale_return_cash':
          // Debit Revenue, Credit Cash
          lines.push(this.createLine(entryId, revenueAcc, total, 0, tenantId));
          lines.push(this.createLine(entryId, cashAcc, 0, total, tenantId));
          // Note: Stock increase is handled by FIFO/StockMovement above
          break;

        case 'sale_return_credit':
          // Debit Revenue, Credit AR
          lines.push(this.createLine(entryId, revenueAcc, total, 0, tenantId));
          lines.push(this.createLine(entryId, arAcc, 0, total, tenantId));
          break;

        case 'purchase_cash':
          lines.push(this.createLine(entryId, invAcc, total, 0, tenantId));
          lines.push(this.createLine(entryId, cashAcc, 0, total, tenantId));
          break;

        case 'purchase_credit':
          lines.push(this.createLine(entryId, invAcc, total, 0, tenantId));
          lines.push(this.createLine(entryId, apAcc, 0, total, tenantId));
          break;

        case 'purchase_return_cash':
          // Debit Cash, Credit Inventory
          lines.push(this.createLine(entryId, cashAcc, total, 0, tenantId));
          lines.push(this.createLine(entryId, invAcc, 0, total, tenantId));
          break;

        case 'purchase_return_credit':
          // Debit AP, Credit Inventory
          lines.push(this.createLine(entryId, apAcc, total, 0, tenantId));
          lines.push(this.createLine(entryId, invAcc, 0, total, tenantId));
          break;
      }

      // 6. VALIDATE BALANCE
      this.validateBalance(lines);

      // 7. CREATE JOURNAL ENTRY
      const entry: any = {
        id: entryId,
        entry_id: entryId,
        date: date,
        reference_id: invoiceId,
        type: type,
        description: `ترحيل آلي: ${type} #${invoiceNumber}`,
        TotalAmount: total,
        status: 'Posted',
        sourceId: invoiceId,
        sourceType: isSale ? 'SALE' : 'PURCHASE',
        lines,
        created_at: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        tenant_id: tenantId
      };

      // 8. SAVE TO DATABASE
      await db.db.journalEntries.add(entry);

      // 9. UPDATE ACCOUNT BALANCES
      for (const line of lines) {
        const account = await db.db.accounts.get(line.account_id);
        if (account) {
          const newBalance = (account.balance || 0) + (line.debit - line.credit);
          await db.db.accounts.update(line.account_id, { balance: newBalance });
        }
      }

      // 10. LINK INVOICE
      if (isSale) {
        const update = { 
          InvoiceStatus: 'POSTED',
          isArchived: true,
          lastPostedAt: new Date().toISOString(),
          totalCost: calculatedTotalCost,
          tenant_id: tenantId
        };
        await db.db.sales.update(invoiceId, update);
      } else {
        const update = { 
          invoiceStatus: 'POSTED',
          isArchived: true,
          lastPostedAt: new Date().toISOString(),
          tenant_id: tenantId
        };
        await db.db.purchases.update(invoiceId, update);
      }
    // End of posting logic
    AIInsightsEngine.runAnalysis();
    return entryId;
  }

  /**
   * UNPOST ENGINE: unpostInvoice(invoice)
   */
  static async unpostInvoice(invoiceId: string): Promise<void> {
    // 1. FIND JOURNAL BY REFERENCE_ID (sourceId)
    const entries = await db.getJournalEntries();
    const entry = entries.find(e => e.sourceId === invoiceId);
    
    if (!entry) return;

    // 2. REVERSE FIFO / STOCK MOVEMENTS
    if (entry.sourceType === 'SALE') {
      await FIFOEngine.reverseFIFO(invoiceId);
      await StockMovementEngine.reverseMovements(invoiceId);
    } else if (entry.sourceType === 'PURCHASE') {
      await FIFOEngine.removePurchaseLayer(invoiceId);
      await StockMovementEngine.reverseMovements(invoiceId);
    }

    // 3. REVERSE ALL JOURNAL LINES & UPDATE BALANCES
    for (const line of entry.lines) {
      await db.updateAccountBalance(line.accountId, line.credit - line.debit);
    }

    // 4. DELETE JOURNAL
    await db.db.journalEntries.delete(entry.id);

    // 5. SET INVOICE.IS_POSTED = FALSE
    const sale = await db.db.sales.get(invoiceId);
    if (sale) {
      await db.db.sales.update(invoiceId, { 
        InvoiceStatus: 'DRAFT_EDIT',
        isArchived: false
      });
    } else {
      const purchase = await db.db.purchases.get(invoiceId);
      if (purchase) {
        await db.db.purchases.update(invoiceId, { 
          invoiceStatus: 'DRAFT_EDIT',
          isArchived: false
        });
      }
    }
  }

  /**
   * REPOST ENGINE
   */
  static async repostInvoice(invoice: Sale | Purchase): Promise<string> {
    await this.unpostInvoice(invoice.id);
    return await this.postInvoice(invoice);
  }

  private static createLine(entryId: string, accountId: string, debit: number, credit: number, tenantId: string): JournalLine {
    const id = db.generateId('JL');
    return {
      id,
      lineId: id,
      entryId,
      entry_id: entryId,
      accountId,
      account_id: accountId,
      accountName: '',
      debit,
      credit,
      type: debit > 0 ? 'DEBIT' : 'CREDIT',
      amount: debit > 0 ? debit : credit,
      tenant_id: tenantId
    };
  }

  private static validateBalance(lines: JournalLine[]) {
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Unbalanced journal: Debit (${totalDebit}) != Credit (${totalCredit})`);
    }
  }
}
