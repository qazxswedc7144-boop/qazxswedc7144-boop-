import { db } from './database';
import { processTransaction } from './TransactionEngine';
import { safeWhereEqual } from '../utils/dexieSafe';

let isProcessing = false

const lock = () => {
  if (isProcessing) {
    throw new Error("⏳ العملية قيد التنفيذ")
  }
  isProcessing = true
}

const unlock = () => {
  isProcessing = false
}

const validateTransaction = (type: string, data: any) => {
  if (!data) throw new Error("❌ لا توجد بيانات")

  if (!data.items || data.items.length === 0) {
    throw new Error("❌ لا توجد أصناف")
  }

  data.items.forEach((item: any) => {
    if (!item.name) {
      throw new Error("❌ اسم الصنف فارغ")
    }

    if (!item.quantity || item.quantity <= 0) {
      throw new Error("❌ كمية غير صحيحة")
    }

    if (!item.price || item.price < 0) {
      throw new Error("❌ سعر غير صحيح")
    }
  })
}

const checkDuplicateInvoice = async (invoiceNumber: string) => {
  const invoices = await safeWhereEqual(db.db.invoices, "invoiceNumber", invoiceNumber);
  if (invoices.length > 0) {
    throw new Error("❌ رقم الفاتورة مكرر")
  }
}

const validateStock = async (items: any[]) => {
  for (const item of items) {
    const products = await safeWhereEqual(db.db.products, "Name", item.name);
    const product = products[0] || null;

    if (product && product.StockQuantity < item.quantity) {
      throw new Error(`❌ المخزون غير كافي: ${item.name}`)
    }
  }
}

const validateCash = async (amount: number) => {
  const cashAccounts = await safeWhereEqual(db.db.accounts, "name", "Cash");
  const cash = cashAccounts[0] || null;

  if (cash && cash.balance < amount) {
    throw new Error("❌ لا يوجد رصيد كافي في الصندوق")
  }
}

const validateJournal = (entries: any[]) => {
  let debit = 0
  let credit = 0

  entries.forEach(e => {
    debit += e.debit || 0
    credit += e.credit || 0
  })

  if (Math.abs(debit - credit) > 0.01) {
    throw new Error("❌ القيد غير متوازن")
  }
}

export const safeProcessTransaction = async (type: string, data: any) => {
  try {
    lock()

    validateTransaction(type, data)
    await validateStock(data.items)
    await validateCash(data.total)

    if (data.invoiceNumber) {
      await checkDuplicateInvoice(data.invoiceNumber)
    }

    if (data.entries) {
        validateJournal(data.entries)
    }

    await processTransaction(type, data)
  } catch (e: any) {
    console.error("❌ ERROR:", e.message)
    
    await db.db.System_Error_Log.add({
      id: crypto.randomUUID(),
      Error_ID: 'TX_ERR_' + Date.now(),
      Error_Message: e.message,
      Module_Name: 'TransactionSafety',
      Record_ID: 'N/A',
      User_Email: 'system@system.com',
      Timestamp: Date.now().toString(),
      updatedAt: Date.now().toString(),
      isSynced: false
    })

    alert(e.message)
    throw e;
  } finally {
    unlock()
  }
}
