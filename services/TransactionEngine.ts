import { db } from './database';
import { createJournalEntry } from './LedgerEngine';
import { safeWhereEqual, safeEquals } from '../utils/dexieSafe';

export const processTransaction = async (type: string, data: any) => {

  console.log("PROCESS:", type, data)

  data.items = data.items.filter((i: any) => i.name && i.quantity)

  if (!data || !data.items || data.items.length === 0) {
    throw new Error("❌ لا توجد بيانات صالحة")
  }

  const total = data.total || 0

  // 1. SAVE INVOICE
  const invoice = {
    id: crypto.randomUUID(),
    type,
    ...data,
    createdAt: Date.now()
  }

  await db.db.invoices.add(invoice)

  // 2. INVENTORY ENGINE
  const productsToUpdate = [];
  for (const item of data.items) {

    if (!item.name) continue

    let product = await safeEquals(db.db.products, "name", item.name);

    if (!product) {
      product = {
        id: crypto.randomUUID(),
        name: item.name,
        StockQuantity: 0,
        avgCost: 0
      }
    }

    if (type.includes("purchase")) {
      product.StockQuantity += item.quantity
      product.avgCost = item.price
    }

    if (type.includes("sale")) {

      if (product.StockQuantity < item.quantity) {
        throw new Error("المخزون غير كافي")
      }

      product.StockQuantity -= item.quantity
    }

    if (type.includes("return")) {
      product.StockQuantity += item.quantity
    }

    productsToUpdate.push(product);
  }
  await db.db.products.bulkPut(productsToUpdate);

  // 3. ACCOUNTING ENGINE
  let entries: { account: string, debit: number, credit: number }[] = []

  switch (type) {

    case "sale_cash":
      entries = [
        { account: "Cash", debit: total, credit: 0 },
        { account: "Revenue", debit: 0, credit: total }
      ]
      break

    case "sale_credit":
      entries = [
        { account: "Accounts Receivable", debit: total, credit: 0 },
        { account: "Revenue", debit: 0, credit: total }
      ]
      break

    case "purchase_cash":
      entries = [
        { account: "Inventory", debit: total, credit: 0 },
        { account: "Cash", debit: 0, credit: total }
      ]
      break

    case "purchase_credit":
      entries = [
        { account: "Inventory", debit: total, credit: 0 },
        { account: "Accounts Payable", debit: 0, credit: total }
      ]
      break

    case "receipt":
      entries = [
        { account: "Cash", debit: total, credit: 0 },
        { account: "Accounts Receivable", debit: 0, credit: total }
      ]
      break

    case "payment":
      entries = [
        { account: "Accounts Payable", debit: total, credit: 0 },
        { account: "Cash", debit: 0, credit: total }
      ]
      break
  }

  await createJournalEntry(entries)

  // 4. CUSTOMER / SUPPLIER BALANCE
  if (type.includes("sale") && data.customer) {

    const customers = await safeWhereEqual(db.customers, "name", data.customer);
    let c = customers[0] || null;

    if (!c) {
      c = { name: data.customer, balance: 0 }
    }

    if (type === "sale_credit") {
      c.balance += total
    }

    if (type === "receipt") {
      c.balance -= total
    }

    await db.db.customers.put(c)
  }

  if (type.includes("purchase") && data.supplier) {

    const suppliers = await safeWhereEqual(db.db.suppliers, "name", data.supplier);
    let s = suppliers[0] || null;

    if (!s) {
      s = { name: data.supplier, balance: 0 }
    }

    if (type === "purchase_credit") {
      s.balance += total
    }

    if (type === "payment") {
      s.balance -= total
    }

    await db.db.suppliers.put(s)
  }

  // 5. CASH FLOW LOG
  await db.db.cash_logs.add({
    id: crypto.randomUUID(),
    type,
    amount: total,
    date: Date.now()
  })

  // 6. FINAL
  console.log("DONE ✅")
}
