import { db } from '@/services/database'

/* --------------------------------------------------
MAIN ENGINE - محرك العمليات المحاسبي المركزي
------------------------------------------ */

/**
 * processTransaction
 * المحرك المركزي لمعالجة كافة العمليات المالية في النظام
 * يضمن تزامن المخزون، الحسابات، والقيود اليومية في خطوة واحدة
 */
export const processTransaction = async (type: string, data: any) => {

  if (!type) throw new Error("❌ نوع العملية مطلوب")

  const now = Date.now()

  /* ------------------------------------------
  VALIDATION
  ------------------------------------------ */
  if (["sale_cash", "sale_credit", "purchase_cash", "purchase_credit"].includes(type)) {
    if (!data?.items || data.items.length === 0) {
      throw new Error("❌ لا توجد عناصر في العملية")
    }
  }

  /* ------------------------------------------
  INITIALIZATION
  ------------------------------------------ */
  await ensureDefaultAccounts();

  /* ------------------------------------------
  ROUTER
  ------------------------------------------ */
  // استخدام runTransaction لضمان الـ Atomicity (الكل أو لا شيء)
  return await db.runTransaction(async () => {
    switch (type) {

      case "sale_cash":
        await handleSaleCash(data, now)
        break

      case "sale_credit":
        await handleSaleCredit(data, now)
        break

      case "purchase_cash":
        await handlePurchaseCash(data, now)
        break

      case "purchase_credit":
        await handlePurchaseCredit(data, now)
        break

      case "receipt":
        await handleReceipt(data, now)
        break

      case "payment":
        await handlePayment(data, now)
        break

      default:
        throw new Error("❌ نوع العملية غير معروف")
    }
    return true;
  });
}

/* --------------------------------------------------
HANDLERS
-------------------------------------------------- */

const handleSaleCash = async (data: any, now: number) => {
  const total = calcTotal(data.items)

  await db.invoices.put({
    ...data,
    type: "sale_cash",
    total,
    createdAt: now,
    updatedAt: now,
    status: 'posted'
  })

  await updateInventory(data.items, -1)

  await addJournal([
    { account: "cash", debit: total, credit: 0 },
    { account: "revenue", debit: 0, credit: total }
  ], now, data.id || "SALE-CASH")
}

const handleSaleCredit = async (data: any, now: number) => {
  const total = calcTotal(data.items)

  await db.invoices.put({
    ...data,
    type: "sale_credit",
    total,
    createdAt: now,
    updatedAt: now,
    status: 'posted'
  })

  await updateInventory(data.items, -1)
  await updateCustomerBalance(data.customerId, total)

  await addJournal([
    { account: "accounts_receivable", debit: total, credit: 0 },
    { account: "revenue", debit: 0, credit: total }
  ], now, data.id || "SALE-CREDIT")
}

const handlePurchaseCash = async (data: any, now: number) => {
  const total = calcTotal(data.items)

  await db.invoices.put({
    ...data,
    type: "purchase_cash",
    total,
    createdAt: now,
    updatedAt: now,
    status: 'posted'
  })

  await updateInventory(data.items, +1)

  await addJournal([
    { account: "inventory", debit: total, credit: 0 },
    { account: "cash", debit: 0, credit: total }
  ], now, data.id || "PURCH-CASH")
}

const handlePurchaseCredit = async (data: any, now: number) => {
  const total = calcTotal(data.items)

  await db.invoices.put({
    ...data,
    type: "purchase_credit",
    total,
    createdAt: now,
    updatedAt: now,
    status: 'posted'
  })

  await updateInventory(data.items, +1)
  await updateSupplierBalance(data.supplierId, total)

  await addJournal([
    { account: "inventory", debit: total, credit: 0 },
    { account: "accounts_payable", debit: 0, credit: total }
  ], now, data.id || "PURCH-CREDIT")
}

const handleReceipt = async (data: any, now: number) => {
  await updateCustomerBalance(data.customerId, -data.amount)

  await addJournal([
    { account: "cash", debit: data.amount, credit: 0 },
    { account: "accounts_receivable", debit: 0, credit: data.amount }
  ], now, data.id || "RECPT")
}

const handlePayment = async (data: any, now: number) => {
  await updateSupplierBalance(data.supplierId, -data.amount)

  await addJournal([
    { account: "accounts_payable", debit: data.amount, credit: 0 },
    { account: "cash", debit: 0, credit: data.amount }
  ], now, data.id || "PAYMT")
}

/* --------------------------------------------------
HELPERS
-------------------------------------------------- */

const calcTotal = (items: any[]) => {
  return items.reduce((sum, i) => sum + ((i.price || 0) * (i.qty || i.quantity || 0)), 0)
}

const updateInventory = async (items: any[], direction: number) => {
  for (const item of items) {
    const id = item.product_id || item.productId;
    const qty = item.qty || item.quantity || 0;
    
    if (!id) continue;

    const product = await db.products.get(id)
    if (!product) continue

    const currentStock = product.StockQuantity || product.stock || 0;
    const newStock = currentStock + (qty * direction)

    if (newStock < 0) {
      throw new Error(`❌ مخزون غير كافي للصنف: ${product.Name || id}`)
    }

    await db.products.update(id, {
      StockQuantity: newStock,
      updatedAt: Date.now()
    })
  }
}

const updateCustomerBalance = async (id: string, amount: number) => {
  if (!id) return
  const c = await db.customers.get(id)
  if (!c) return

  await db.customers.update(id, {
    Balance: (c.Balance || c.balance || 0) + amount,
    lastModified: new Date().toISOString()
  })
}

const updateSupplierBalance = async (id: string, amount: number) => {
  if (!id) return
  const s = await db.suppliers.get(id)
  if (!s) return

  await db.suppliers.update(id, {
    Balance: (s.Balance || s.balance || 0) + amount,
    lastModified: new Date().toISOString()
  })
}

const updateLedger = async (entries: any[]) => {
  for (const e of entries) {
    const acc = await db.accounts.get(e.account)
    if (!acc) {
      console.warn(`⚠️ Account ${e.account} not found for ledger update. Seeding default accounts...`);
      await ensureDefaultAccounts();
      const reacc = await db.accounts.get(e.account);
      if(!reacc) continue;
      
      let newBalance = reacc.balance || 0;
      if (e.debit) newBalance += e.debit;
      if (e.credit) newBalance -= e.credit;
      await db.accounts.update(reacc.id, { balance: newBalance });
      continue;
    }

    let newBalance = acc.balance || 0
    if (e.debit) newBalance += e.debit
    if (e.credit) newBalance -= e.credit

    await db.accounts.update(acc.id, {
      balance: newBalance
    })
  }
}

const ensureDefaultAccounts = async () => {
  const defaults = [
    { id: 'cash', name: 'الصندوق', type: 'assets', balance: 0 },
    { id: 'accounts_receivable', name: 'المدينون', type: 'assets', balance: 0 },
    { id: 'accounts_payable', name: 'الدائنون', type: 'liabilities', balance: 0 },
    { id: 'inventory', name: 'المخزون', type: 'assets', balance: 0 },
    { id: 'revenue', name: 'المبيعات', type: 'revenue', balance: 0 },
    { id: 'expense', name: 'المصاريف', type: 'expense', balance: 0 }
  ];

  for (const acc of defaults) {
    const existing = await db.accounts.get(acc.id);
    if (!existing) {
      await db.accounts.put(acc);
    }
  }
}

const addJournal = async (lines: any[], now: number, sourceId: string) => {
  // نقوم بتحويل البيانات لتناسب هيكلية JournalEntry في النظام
  await db.journalEntries.add({
    id: db.generateId('JRN'),
    date: new Date(now).toISOString().split('T')[0],
    createdAt: now,
    sourceId: sourceId,
    lines: lines.map((l, index) => ({
      lineId: `${sourceId}-L${index}`,
      accountId: l.account, // في نظام حقيقي نستخدم ID الحساب، هنا نستخدم الكود الممرر
      accountName: l.account,
      debit: l.debit || 0,
      credit: l.credit || 0
    }))
  })

  // 🔥 تحديث الأرصدة المباشرة في دفتر الأستاذ
  await updateLedger(lines)
}
