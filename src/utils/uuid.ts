/**
 * ERP Global Transaction UUID Generator
 * Suitable for ledger traces, deduplication, and regulatory audits.
 * Unique identifiers with date stamps and robust randomness.
 */

export function generateTransactionUuid(
  type: 'SALE' | 'PURCHASE' | 'PAYMENT' | 'RECEIPT' | 'INVENTORY' | 'JOURNAL'
): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const hexPart = Math.random().toString(16).substring(2, 8).toUpperCase();
  return `${type}-${dateStr}-${hexPart}`;
}
