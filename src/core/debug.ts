// src/core/debug.ts

import { createInvoice } from "./accounting/invoiceService";
import { salesService } from "./sales/sales.service";
import { getStock, reduceStock } from "./inventory/inventory.service";
import { reportService } from "./reports/report.service";

declare global {
  interface Window {
    coreTest?: any;
  }
}

// ✅ نحمي التنفيذ
if (typeof window !== "undefined") {
  window.coreTest = window.coreTest || {};
  
  Object.assign(window.coreTest, {
    createInvoiceTest: () => {
      try {
        const invoice = createInvoice({
          customerId: "test-customer",
          items: [
            { productId: "p1", quantity: 2, price: 100 },
            { productId: "p2", quantity: 1, price: 50 },
          ],
        });

        console.log("🔥 Core Invoice:", invoice);
        return invoice;
      } catch (err) {
        console.error("❌ Core Error:", err);
      }
    },

    salesTransactionTest: () => {
      const result = salesService.processSale(
        "c1-test",
        [{ productId: "med-1", quantity: 1, price: 12.5 }],
        "cash"
      );
      console.log("💰 Sales Transaction:", result);
      return result;
    },

    inventoryAdjustmentTest: () => {
      console.log("📦 Current Stock p1:", getStock("p1"));
      const newStock = reduceStock([{ productId: "p1", quantity: 10 }]);
      console.log("📦 Stock after reduction:", newStock);
      return newStock;
    },

    reportGenerationTest: () => {
      const s1 = salesService.processSale("c1", [{ productId: "p1", quantity: 1, price: 100 }], "cash").sale;
      const s2 = salesService.processSale("c2", [{ productId: "p2", quantity: 1, price: 200 }], "card").sale;
      
      const summary = reportService.generateSalesSummary([s1, s2]);
      console.log("📊 Sales Summary:", summary);
      return summary;
    },

    getStock: () => {
      console.log("📦 Stock:", {
        p1: getStock("p1"),
        p2: getStock("p2"),
      });
    },
  });
}


