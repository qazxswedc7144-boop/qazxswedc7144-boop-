
import { processTransaction as runTransaction } from './TransactionEngine';
import { pushChanges } from './syncService';

export const TYPES = {
  SALE_CASH: 'sale_cash',
  SALE_CREDIT: 'sale_credit',
  PURCHASE_CASH: 'purchase_cash',
  PURCHASE_CREDIT: 'purchase_credit',
  RETURN_SALE: 'sale_return',
  RETURN_PURCHASE: 'purchase_return',
  RECEIPT: 'receipt',
  PAYMENT: 'payment'
} as const;

export async function processTransaction(type: string, data: any) {
  await runTransaction(type, data);
}

/**
 * Helper to process a transaction and immediately sync to cloud.
 */
export const saveAndSync = async (type: string, data: any) => {
  try {
    await processTransaction(type, data);
    await pushChanges();
  } catch (e) {
    console.error("Save failed:", e);
    throw e;
  }
};
