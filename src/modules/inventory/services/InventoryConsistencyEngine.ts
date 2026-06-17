import { db } from '@/core/db';
import { logger } from '@/services/loggerService';

export interface StockReconciliationItem {
  productId: string;
  name: string;
  category: string;
  openingStock: number;
  purchases: number;
  sales: number;
  returns: number;
  adjustments: number;
  currentStock: number; // Listed in DB
  calculatedStock: number; // Opening + Purchases - Sales + Adjustments
  batchesSum: number;
  mismatch: boolean;
  mismatchReason: string[];
}

export interface ConsistencyAuditReport {
  success: boolean;
  timestamp: string;
  totalProductsCount: number;
  matchedProductsCount: number;
  mismatchedProductsCount: number;
  negativeStockCount: number;
  duplicateMovementsCount: number;
  missingMovementsCount: number;
  orphanMovementsCount: number;
  reconciliationItems: StockReconciliationItem[];
  mismatches: Array<{
    type: 'MISMATCH' | 'NEGATIVE_STOCK' | 'DUPLICATE' | 'MISSING' | 'ORPHAN';
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    productId?: string;
    productName?: string;
    description: string;
    recommendation: string;
    id: string;
  }>;
}

export class InventoryConsistencyEngine {

  /**
   * RUN FULL AUDIT
   */
  static async runFullAudit(): Promise<ConsistencyAuditReport> {
    try {
      const products = await db.products.toArray();
      const movements = await db.stock_movements.toArray();
      const invoices = await db.invoices.toArray();
      const batches = await db.medicineBatches.toArray();

      const items: StockReconciliationItem[] = [];
      const mismatches: ConsistencyAuditReport['mismatches'] = [];

      let duplicateMovementsCount = 0;
      let missingMovementsCount = 0;
      let orphanMovementsCount = 0;
      let negativeStockCount = 0;

      // 1. Detect Orphan Movements (movement references product that does not exist)
      const productIdsSet = new Set(products.map(p => p.id));

      for (const move of movements) {
        if (!productIdsSet.has(move.item_id)) {
          orphanMovementsCount++;
          mismatches.push({
            id: `ORPHAN-${move.id}`,
            type: 'ORPHAN',
            severity: 'HIGH',
            productId: move.item_id,
            description: `حركة مخزنية يتيمة رقم [${move.id}] تشير لصنف غير موجود في قاعدة البيانات معرفه: ${move.item_id}`,
            recommendation: 'حذف الحركة المخزنية اليتيمة لاستبعاد البيانات المشوهة.',
          });
        }
      }

      // 2. Scan every product for detail reconciliation
      for (const prod of products) {
        const prodId = prod.id;
        const prodName = prod.name || prod.Name || 'Unlabeled';
        const prodCat = (prod as any).category || prod.categoryName || 'General';

        // Filter stock movements of this product
        const prodMovs = movements.filter(m => m.item_id === prodId);

        // Calculate opening stock:
        // We can establish that Opening Stock is equal to the first movement's "quantity_before" if it exists.
        // If there are no movements, opening stock is the product's current stock (or 0).
        let openingStock = 0;
        if (prodMovs.length > 0) {
          // Sort movements by created_at or id to find the earliest
          const sortedMovs = [...prodMovs].sort((a, b) => {
            const timeA = new Date(a.created_at || 0).getTime();
            const timeB = new Date(b.created_at || 0).getTime();
            return timeA - timeB;
          });
          openingStock = sortedMovs[0].quantity_before || 0;
        } else {
          // If no recorded movements, look for any initial stock or default to current
          openingStock = prod.stock || prod.StockQuantity || 0;
        }

        // Aggregate ledger variables
        let purchases = 0;
        let sales = 0;
        let returns = 0;
        let adjustments = 0;

        for (const m of prodMovs) {
          const type = (m.type || '').toLowerCase();
          const qty = Number(m.quantity_change);

          if (type === 'purchase') {
            purchases += qty;
          } else if (type === 'sale') {
            sales += Math.abs(qty); // positive represent outward
          } else if (type === 'return') {
            returns += qty; // can be negative or positive depending on direction
          } else if (type === 'adjustment') {
            adjustments += qty;
          }
        }

        // Expected current stock calculation
        const calculatedStock = openingStock + purchases - sales + returns + adjustments;
        const currentStock = prod.stock !== undefined ? prod.stock : (prod.StockQuantity || 0);

        // Check batches
        const prodBatches = batches.filter(b => b.productId === prodId);
        const batchesSum = prodBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);

        // Mismatches collection
        const reasons: string[] = [];
        let isMismatch = false;

        // Detect stock mismatch
        if (Math.abs(currentStock - calculatedStock) > 0.001) {
          isMismatch = true;
          reasons.push(`انحراف الرصيد: الرصيد التقويمي (${calculatedStock}) لا يتطابق مع رصيد البطاقة المسجل (${currentStock})`);
          mismatches.push({
            id: `MISMATCH-STOCK-${prodId}`,
            type: 'MISMATCH',
            severity: 'HIGH',
            productId: prodId,
            productName: prodName,
            description: `رصيد الصنف [${prodName}] الدفتري غير متطابق مع الحركات المتجمعة. مسجل: ${currentStock}، المتجمع: ${calculatedStock}`,
            recommendation: 'إجراء تسوية ذكية لإعادة ضبط رصيد البطاقة تزامناً مع حركات المخزون والموردين.',
          });
        }

        // Detect batch to stock count mismatch
        if (prodBatches.length > 0 && Math.abs(currentStock - batchesSum) > 0.001) {
          isMismatch = true;
          reasons.push(`عدم اتساق التشغيلات: مجموع كميات التشغيلات (${batchesSum}) لا يتوافق مع رصيد الصنف (${currentStock})`);
          mismatches.push({
            id: `MISMATCH-BATCH-${prodId}`,
            type: 'MISMATCH',
            severity: 'MEDIUM',
            productId: prodId,
            productName: prodName,
            description: `مجموع التشغيلات النشطة للصنف [${prodName}] (${batchesSum}) يختلف عن رصيد الصنف الحالي (${currentStock})`,
            recommendation: 'إعادة توزيع أو تنظيف كميات التشغيلات منقضية الصلاحية لتطابق الرصيد الفعلي.',
          });
        }

        // Negative stock occurrence
        if (currentStock < 0 || calculatedStock < 0) {
          negativeStockCount++;
          isMismatch = true;
          reasons.push('رصيد سالب: يحتوي المستودع على رصيد سالب لهذا الصنف');
          mismatches.push({
            id: `NEG-STOCK-${prodId}`,
            type: 'NEGATIVE_STOCK',
            severity: 'HIGH',
            productId: prodId,
            productName: prodName,
            description: `الصنف [${prodName}] يمتلك رصيد سالب (${currentStock || calculatedStock}). هذا يضر بسلامة تكلفة البضاعة المباعة.`,
            recommendation: 'تسجيل تسوية جردية موجبة لسد العجز لتجنب تشوه هوامش الربح.',
          });
        }

        // Scan transactions for duplicates (multiple movements with same reference_id for same product)
        const refCounts: Record<string, number> = {};
        for (const m of prodMovs) {
          if (m.reference_id && m.reference_id !== 'N/A') {
            const currentCount = (refCounts[m.reference_id] || 0) + 1;
            refCounts[m.reference_id] = currentCount;
            if (currentCount > 1) {
              duplicateMovementsCount++;
              isMismatch = true;
              reasons.push(`حركات مكررة للمستند #${m.reference_id}`);
              mismatches.push({
                id: `DUP-MOV-${m.id}`,
                type: 'DUPLICATE',
                severity: 'MEDIUM',
                productId: prodId,
                productName: prodName,
                description: `تم رصد حركة مكررة مسجلة على نفس مستند المرجع #${m.reference_id} للصنف [${prodName}]`,
                recommendation: 'إزالة القيود المكررة والاحتفاظ بقيد حركة رئيسي واحد لكل مستند مرجعي.',
              });
            }
          }
        }

        // Scan for missing movements (invoice has this item, but no stock_movements exist)
        const prodInvoices = invoices.filter(inv => 
          inv.documentStatus === 'POSTED' && 
          inv.items && 
          inv.items.some((it: any) => it.product_id === prodId || it.productId === prodId)
        );

        for (const inv of prodInvoices) {
          const hasMovement = prodMovs.some(m => m.reference_id === inv.id);
          if (!hasMovement) {
            missingMovementsCount++;
            isMismatch = true;
            reasons.push(`قيد حركة مفقود للفاتورة #${inv.invoiceNumber || inv.id}`);
            mismatches.push({
              id: `MISSING-MOV-${inv.id}-${prodId}`,
              type: 'MISSING',
              severity: 'HIGH',
              productId: prodId,
              productName: prodName,
              description: `الفاتورة المرحّلةرقم #${inv.invoiceNumber || inv.id} تحتوي على الصنف [${prodName}] ولكن لا يوجد حركة مخزنية مسجلة له!`,
              recommendation: 'توليد قيد حركة مخزنية تراجعي آلي لإثبات تكلفة وحركة الصنف المعني.',
            });
          }
        }

        items.push({
          productId: prodId,
          name: prodName,
          category: prodCat,
          openingStock,
          purchases,
          sales,
          returns,
          adjustments,
          currentStock,
          calculatedStock,
          batchesSum,
          mismatch: isMismatch,
          mismatchReason: reasons,
        });
      }

      const mismatchedItems = items.filter(i => i.mismatch);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        totalProductsCount: products.length,
        matchedProductsCount: products.length - mismatchedItems.length,
        mismatchedProductsCount: mismatchedItems.length,
        negativeStockCount,
        duplicateMovementsCount,
        missingMovementsCount,
        orphanMovementsCount,
        reconciliationItems: items,
        mismatches: mismatches,
      };

    } catch (err: any) {
      console.error("[InventoryConsistencyEngine] Failed running consistency audit:", err);
      return {
        success: false,
        timestamp: new Date().toISOString(),
        totalProductsCount: 0,
        matchedProductsCount: 0,
        mismatchedProductsCount: 0,
        negativeStockCount: 0,
        duplicateMovementsCount: 0,
        missingMovementsCount: 0,
        orphanMovementsCount: 0,
        reconciliationItems: [],
        mismatches: [{
          id: 'CRITICAL-ERR',
          type: 'MISMATCH',
          severity: 'HIGH',
          description: `فشل تشغيل عملية فحص ومطابقة المخزون: ${err.message}`,
          recommendation: 'تفحص سجل الأخطاء للتأكد من سلامة كائنات Dexie وجداول المعاملات.',
        }],
      };
    }
  }

  /**
   * REPAIR ALL DETECTED STOCK MISMATCHES
   */
  static async repairMismatches(report: ConsistencyAuditReport): Promise<{ success: boolean; repairedCount: number }> {
    let repairedCount = 0;
    try {
      await db.runTransaction(async () => {
        // 1. Clean orphan movements (where product does not exist)
        const orphanIds = report.mismatches
          .filter(m => m.type === 'ORPHAN')
          .map(m => (m.id || '').replace('ORPHAN-', ''));
        
        if (orphanIds.length > 0) {
          for (const id of orphanIds) {
            await db.stock_movements.delete(id);
            repairedCount++;
          }
        }

        // 2. Repair stock counts to match calculated ledger calculations
        const mismatchProducts = report.reconciliationItems.filter(item => item.mismatch);
        for (const item of mismatchProducts) {
          // If stock quantity is incorrect, override with calculated
          const actualCalculation = item.calculatedStock;
          
          await db.products.update(item.productId, {
            stock: actualCalculation,
            StockQuantity: actualCalculation,
            stock_qty: actualCalculation
          });

          // Also make sure warehouseStock counts match WH-MAIN
          const ws = await db.warehouseStock
            .where('[warehouseId+productId]')
            .equals(['WH-MAIN', item.productId])
            .first();

          if (ws) {
            await db.warehouseStock.update(ws.id, {
              quantity: Math.max(0, actualCalculation)
            });
          } else {
            await db.warehouseStock.add({
              id: db.generateId('WHS'),
              warehouseId: 'WH-MAIN',
              productId: item.productId,
              quantity: Math.max(0, actualCalculation),
              lastUpdated: new Date().toISOString()
            });
          }

          // 3. For batches sum discrepancy, if there is a discrepancy and batches exist, repair the batches
          const batches = await db.medicineBatches.where('productId').equals(item.productId).toArray();
          if (batches.length > 0) {
            // Adjust the largest or latest active batch to reconcile, OR distribute
            const sortedBatches = [...batches].sort((a, b) => b.quantity - a.quantity);
            if (sortedBatches[0]) {
              // Re-calculate other batches sum
              const otherBatchesSum = sortedBatches.slice(1).reduce((acc, b) => acc + (b.quantity || 0), 0);
              const correctedQtyForLeadingBatch = Math.max(0, actualCalculation - otherBatchesSum);
              await db.medicineBatches.update(sortedBatches[0].id, {
                quantity: correctedQtyForLeadingBatch
              });
            }
          }

          repairedCount++;
        }

        // 4. Generate missing movements for posted invoices that didn't record movements
        const missingList = report.mismatches.filter(m => m.type === 'MISSING');
        for (const missing of missingList) {
          if (missing.productId) {
            const invoiceId = missing.id.replace(`MISSING-MOV-`, '').replace(`-${missing.productId}`, '');
            const inv = await db.invoices.get(invoiceId);
            const prod = await db.products.get(missing.productId);
            if (inv && prod) {
              const matchedItem = inv.items?.find((it: any) => it.product_id === missing.productId || it.productId === missing.productId);
              const qty = Number(matchedItem?.qty || 0);
              const price = Number(matchedItem?.price || 0);

              const currentStock = await db.stock_movements
                .where('item_id')
                .equals(missing.productId)
                .toArray()
                .then(movs => (movs || []).reduce((sum, m: any) => sum + m.quantity_change, 0));

              const isPurchase = inv.type === 'PURCHASE';
              const change = isPurchase ? qty : -qty;

              await db.stock_movements.add({
                id: `MOV-REPAIR-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                item_id: missing.productId,
                product_id: missing.productId,
                type: isPurchase ? 'purchase' : 'sale',
                quantity_before: currentStock,
                quantity_change: change,
                quantity_after: currentStock + change,
                unit_cost: price,
                total_cost: qty * price,
                reference_id: invoiceId,
                tenant_id: 'TEN-DEV-001',
                created_at: new Date().toISOString()
              });

              repairedCount++;
            }
          }
        }

        // 5. Clean up duplicate stock movements (keep only 1 per reference_id & product_id combination)
        const dupList = report.mismatches.filter(m => m.type === 'DUPLICATE');
        for (const dup of dupList) {
          if (dup.productId) {
            const prodMovs = await db.stock_movements.where('item_id').equals(dup.productId).toArray();
            const refGroups: Record<string, typeof prodMovs> = {};
            for (const m of prodMovs) {
              if (m.reference_id && m.reference_id !== 'N/A') {
                const list = refGroups[m.reference_id] || [];
                list.push(m);
                refGroups[m.reference_id] = list;
              }
            }

            for (const refId in refGroups) {
              const group = refGroups[refId] || [];
              if (group.length > 1) {
                // Keep the first, delete the others
                for (let i = 1; i < group.length; i++) {
                  const mToDelete = group[i];
                  if (mToDelete && mToDelete.id) {
                    await db.stock_movements.delete(mToDelete.id);
                    repairedCount++;
                  }
                }
              }
            }
          }
        }

        // Log audit log for repair action
        await db.auditLogs.add({
          id: `REPAIR-AUDIT-${Date.now()}`,
          action: 'UPDATE',
          module: 'INVENTORY_AUDIT',
          username: 'SYSTEM_REPAIR_ENGINE',
          recordId: 'RECONCILIATION_RUN',
          details: `تم تشغيل محرك معالجة انحرافات المخزون بنجاح. تم إصلاح عدد ${repairedCount} فوارق وسجلات مع تفعيل الذرية الفولاذية.`,
          userId: 'SYSTEM',
          timestamp: new Date().toISOString()
        } as any);

        logger.info("InventoryReconciliation", "Repair", `تم إصلاح ${repairedCount} معاملات وتطابق فوارق جرد المخازن.`);
      });

      return { success: true, repairedCount };
    } catch (err: any) {
      console.error("[InventoryConsistencyEngine] Repair failed:", err);
      return { success: false, repairedCount: 0 };
    }
  }
}
