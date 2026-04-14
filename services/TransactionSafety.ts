import { db } from './database';
import { processTransaction } from './TransactionEngine';

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
  const exist = await db.db.invoices
    .where("invoiceNumber")
    .equals(invoiceNumber)
    .first()

  if (exist) {
    throw new Error("❌ رقم الفاتورة مكرر")
  }
}

const validateStock = async (items: any[]) => {
  for (const item of items) {
    const product = await db.db.products
      .where("name")
      .equals(item.name)
      .first()

    if (product && product.StockQuantity < item.quantity) {
      throw new Error(`❌ المخزون غير كافي: ${item.name}`)
    }
  }
}

const validateCash = async (amount: number) => {
  const cash = await db.db.accounts
    .where("name")
    .equals("Cash")
    .first()

  if (cash && cash.balance < amount) {
    throw new Error("❌ لا يوجد رصيد كافي في الصندوق")
  }
}

export const safeProcessTransaction = async (type: string, data: any) => {
  try {
    lock()

    validateTransaction(type, data)

    if (data.invoiceNumber) {
      await checkDuplicateInvoice(data.invoiceNumber)
    }

    if (type.includes("sale")) {
      await validateStock(data.items)
    }

    if (type.includes("cash")) {
      await validateCash(data.total)
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
