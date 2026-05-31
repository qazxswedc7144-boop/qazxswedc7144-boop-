import { db } from '@/core/db';
import { ProfitHealth, Sale, Purchase, UnifiedInvoice } from '@/types';
import { AlertCenter } from '@/services/notifications/AlertCenter';

// Adapter to safely map UnifiedInvoice to Sale
function mapInvoiceToSale(inv: UnifiedInvoice): Sale {
  return {
    ...inv,
    SaleID: inv.id,
    customerId: inv.partnerId,
    branchId: 'main',
    totalCost: inv.subtotal * 0.7, // COGS estimate
    InvoiceStatus: inv.documentStatus,
    paidAmount: inv.paidAmount,
    items: inv.items,
    finalTotal: inv.finalTotal,
    paymentStatus: inv.paymentStatus,
    riskLevel: 'LOW', // default
    auditScore: 100 // default
  } as unknown as Sale;
}

// Adapter to safely map UnifiedInvoice to Purchase
function mapInvoiceToPurchase(inv: UnifiedInvoice): Purchase {
  return {
    ...inv,
    purchase_id: inv.id,
    supplierId: inv.partnerId,
    supplierName: inv.partnerName,
    invoiceStatus: inv.documentStatus,
    paidAmount: inv.paidAmount,
    totalAmount: inv.finalTotal,
    status: inv.financialStatus === 'Paid' ? 'PAID' : 'UNPAID',
    items: inv.items,
    finalTotal: inv.finalTotal
  } as unknown as Purchase;
}

export class ProfitHealthAnalyzer {
  static async computeDailyHealth() {
    console.log("[ProfitHealthAnalyzer] Computing Daily Health Metrics...");
    
    const today = new Date().toISOString().split('T')[0] || '';
    const rawSales = await db.getSales();
    const rawPurchases = await db.getPurchases();
    const sales = rawSales.map(mapInvoiceToSale);
    const purchases = rawPurchases.map(mapInvoiceToPurchase);
    const products = await db.getProducts();
    
    // 1. Gross Profit %
    const totalSales = sales.reduce((sum, s) => sum + s.finalTotal, 0);
    const totalCost = sales.reduce((sum, s) => sum + (s.totalCost || 0), 0);
    const gpPercent = totalSales > 0 ? ((totalSales - totalCost) / totalSales) * 100 : 0;
    
    // 2. Net Movement
    const totalPurchases = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const netMovement = totalSales - totalPurchases;
    
    // 3. Inventory Turnover (Simplified)
    const inventoryValue = products.reduce((sum, p) => sum + ((p.stock || p.StockQuantity || 0) * (p.CostPrice || 0)), 0);
    const turnover = inventoryValue > 0 ? totalCost / inventoryValue : 0;
    
    // 4. Top 5 Products
    const topProducts = products
      .map(p => ({ 
        id: p.id, 
        name: p.name || p.Name || 'غير معروف', 
        value: (p.stock || p.StockQuantity || 0) * (p.price || p.UnitPrice || 0) 
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
      
    // 5. Slow Moving Items (No sales in 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentSales = sales.filter(s => s.date > thirtyDaysAgo);
    const soldProductIds = new Set(recentSales.flatMap(s => (s.items || []).map((it: any) => it.product_id)));
    const slowMovingItems = products
      .filter(p => (p.stock || p.StockQuantity || 0) > 0 && !soldProductIds.has(p.id))
      .map(p => ({ id: p.id, name: p.name || p.Name || 'غير معروف', daysSinceLastSale: 30 }))
      .slice(0, 5);
      
    // 6. High Risk Entities
    const highRiskEntities = sales
      .filter(s => (s as any).riskLevel === 'HIGH')
      .map(s => ({ id: s.customerId, name: s.customerId, riskScore: (s as any).auditScore || 0 }))
      .slice(0, 5);
      
    // 7. Health Status
    let healthStatus: 'Healthy' | 'Needs Attention' | 'Critical' = 'Healthy';
    if (gpPercent < 15 || turnover < 0.5) healthStatus = 'Needs Attention';
    if (gpPercent < 5 || netMovement < -10000) healthStatus = 'Critical';
    
    const health: ProfitHealth = {
      id: `PH-${today}`,
      date: today,
      grossProfitPercent: gpPercent,
      netMovement,
      inventoryTurnover: turnover,
      healthStatus,
      topProducts,
      slowMovingItems,
      highRiskEntities
    };
    
    await db.db.profitHealth.put(health);
    
    if (healthStatus === 'Critical') {
      await AlertCenter.addAlert({
        type: 'FINANCIAL',
        severity: 'CRITICAL',
        message: `تنبيه: حالة الربحية حرجة (${gpPercent.toFixed(2)}%) 🚨`,
        metadata: { gpPercent, netMovement }
      });
    }
    
    return health;
  }

  static async getLatestHealth() {
    return await db.db.profitHealth.orderBy('date').last();
  }
}
