
import { create } from 'zustand';

interface AccountingState {
  ledgerEntries: any[];
  balances: Record<string, number>;
  setEntries: (entries: any[]) => void;
  updateBalance: (accountId: string, amount: number) => void;
}

export const useAccountingStore = create<AccountingState>((set) => ({
  ledgerEntries: [],
  balances: {},
  setEntries: (entries) => set({ ledgerEntries: entries }),
  updateBalance: (accountId, amount) => set((state) => ({
    balances: { ...state.balances, [accountId]: amount }
  })),
}));
