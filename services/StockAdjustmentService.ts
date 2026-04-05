
import { db } from './database';
import { InventoryService } from './InventoryService';
import { AccountingEngine } from './AccountingEngine';
import { AccountingEntry, JournalLine } from '../types';

export class StockAdjustmentService {
  
  static async performPhysicalCount(params: {
    productId: string,
    warehouseId: string,
    actualQty: number,
    userId: string,
    notes?: string
  }) {
    const { productId, warehouseId, actualQty, userId, notes } = params;
    const currentQty = await InventoryService.getWarehouseStock(warehouseId, productId);
    const diff = actualQty - currentQty;

    if (diff === 0) return;

    await db.runTransaction(async () => {
      // 1. Inventory Adjustment
      await InventoryService.recordMovement({
        type: 'ADJUSTMENT',
        productId,
        warehouseId,
        quantity: diff,
        sourceDocId: `ADJ-${Date.now()}`,
        sourceDocType: 'ADJUSTMENT',
        userId
      });

      // 2. Accounting Adjustment
      const invAcc = await AccountingEngine.getCoreAccount('INVENTORY');
      const gainAcc = 'ACC-INV-GAIN'; // Should be in settings
      const lossAcc = 'ACC-INV-LOSS'; // Should be in settings
      
      const product = await db.db.products.get(productId);
      const cost = product?.CostPrice || 0;
      const totalValue = Math.abs(diff * cost);

      const entryId = db.generateId('JE');
      const lines: JournalLine[] = [];

      if (diff > 0) {
        // Gain: Debit Inventory, Credit Gain
        lines.push(this.createLine(entryId, invAcc, totalValue, 0));
        lines.push(this.createLine(entryId, gainAcc, 0, totalValue));
      } else {
        // Loss: Debit Loss, Credit Inventory
        lines.push(this.createLine(entryId, lossAcc, totalValue, 0));
        lines.push(this.createLine(entryId, invAcc, 0, totalValue));
      }

      const entry: AccountingEntry = {
        id: entryId,
        date: new Date().toISOString(),
        description: notes || `تسوية جردية للصنف ${product?.Name} | فرق: ${diff}`,
        TotalAmount: totalValue,
        status: 'Posted',
        sourceId: productId,
        sourceType: 'ADJUSTMENT',
        lines,
        lastModified: new Date().toISOString()
      };

      await db.saveAccountingEntry(entry);
      
      // Update Account Balances
      for (const line of entry.lines) {
        await db.updateAccountBalance(line.accountId, line.debit - line.credit);
      }
    });
  }

  private static createLine(entryId: string, accountId: string, debit: number, credit: number): JournalLine {
    const id = db.generateId('JL');
    return {
      id,
      lineId: id,
      entryId,
      accountId,
      accountName: '',
      debit,
      credit,
      type: debit > 0 ? 'DEBIT' : 'CREDIT',
      amount: debit > 0 ? debit : credit
    };
  }
}
