// src/core/inventory/inventory.service.ts

export type StockItem = {
  productId: string;
  quantity: number;
};

const mockStock: Record<string, number> = {
  p1: 100,
  p2: 50,
};

export function getStock(productId: string) {
  return mockStock[productId] || 0;
}

export function reduceStock(items: StockItem[]) {
  if (!Array.isArray(items)) {
    console.warn("inventory.service: items is not an array");
    return mockStock;
  }

  items.forEach((item) => {
    // 1. Validation
    if (!item || !item.productId) {
      console.warn("inventory.service: Invalid item ignored", item);
      return;
    }

    if (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || !Number.isInteger(item.quantity)) {
      console.warn(`inventory.service: Invalid or non-integer quantity (${item.quantity}) for product ${item.productId}`);
      return;
    }

    if (!mockStock[item.productId]) {
      mockStock[item.productId] = 0;
    }

    mockStock[item.productId] -= item.quantity;

    // 2. Prevent negative stock
    if (mockStock[item.productId] < 0) {
      console.warn(`inventory.service: Prevented negative stock for ${item.productId}. Clamping to 0.`);
      mockStock[item.productId] = 0;
    }
  });

  return mockStock;
}

export function resetStock(productId: string) {
  if (!productId) return mockStock;
  mockStock[productId] = 0;
  console.log(`inventory.service: Reset stock to 0 for ${productId}`);
  return mockStock;
}
