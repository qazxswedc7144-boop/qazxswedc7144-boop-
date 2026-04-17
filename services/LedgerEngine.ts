
import { db } from './database';
import { Account } from '../types';
import { safeWhereEqual } from '../utils/dexieSafe';

const detectAccountType = (name: string): 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' => {
  if (name.includes("Cash")) return "ASSET";
  if (name.includes("Inventory")) return "ASSET";
  if (name.includes("Receivable")) return "ASSET";
  if (name.includes("Payable")) return "LIABILITY";
  if (name.includes("Revenue")) return "REVENUE";
  return "EXPENSE";
};

export const updateLedger = async (accountName: string, debit: number, credit: number) => {
  const accounts = await safeWhereEqual(db.db.accounts, "name", accountName);
  let acc = accounts[0] || null;

  if (!acc) {
    acc = {
      id: crypto.randomUUID(),
      code: 'AUTO',
      name: accountName,
      type: detectAccountType(accountName),
      balance_type: 'DEBIT',
      isSystem: false,
      isActive: true,
      debit: 0,
      credit: 0,
      balance: 0,
      updatedAt: new Date().toISOString()
    } as Account;
  }

  acc.debit = (acc.debit || 0) + debit;
  acc.credit = (acc.credit || 0) + credit;
  acc.balance = acc.debit - acc.credit;
  acc.updatedAt = new Date().toISOString();

  await db.db.accounts.put(acc);
};

export const createJournalEntry = async (lines: { account: string, debit: number, credit: number }[]) => {
  const entry = {
    id: crypto.randomUUID(),
    lines,
    createdAt: Date.now()
  };

  await db.db.journalEntries.add(entry as any);

  for (const l of lines) {
    await updateLedger(l.account, l.debit || 0, l.credit || 0);
  }
};

export const getProfitLoss = async () => {
  const accounts = await db.db.accounts.toArray();
  let revenue = 0;
  let expenses = 0;

  accounts.forEach(acc => {
    if (acc.type === "REVENUE") {
      revenue += acc.credit;
    }
    if (acc.type === "EXPENSE") {
      expenses += acc.debit;
    }
  });

  return { revenue, expenses, profit: revenue - expenses };
};

export const getBalanceSheet = async () => {
  const accounts = await db.db.accounts.toArray();
  let assets = 0;
  let liabilities = 0;

  accounts.forEach(acc => {
    if (acc.type === "ASSET") {
      assets += acc.balance;
    }
    if (acc.type === "LIABILITY") {
      liabilities += acc.balance;
    }
  });

  return { assets, liabilities, equity: assets - liabilities };
};

export const getCashFlow = async () => {
  const cashAccounts = await safeWhereEqual(db.db.accounts, "name", "Cash");
  const cash = cashAccounts[0] || null;
  return { balance: cash?.balance || 0 };
};

export const getAging = async () => {
  const customers = await db.db.customers.toArray();
  return customers.map(c => {
    const days = (Date.now() - (new Date(c.updatedAt || Date.now()).getTime())) / (1000 * 60 * 60 * 24);
    return {
      name: c.Supplier_Name || c.Supplier_Name || 'Unknown',
      balance: c.Balance,
      aging: days <= 30 ? "0-30" : days <= 60 ? "30-60" : "60+"
    };
  });
};
