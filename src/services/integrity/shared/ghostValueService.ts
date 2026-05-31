
export const ghostValueService = {
  checkGhostValue: (_entityId: string, _value: any) => {
    return false;
  },
  getPurchaseHints: (_id: string) => ({ lastPurchasePrice: 0, currentStock: 0 }),
  getSalesHints: (_id: string) => ({ lastSalePrice: 0, availableStock: 0 }),
};
