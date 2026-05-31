
import { create } from 'zustand';

interface InventoryState {
  items: any[];
  isLoading: boolean;
  setItems: (items: any[]) => void;
  updateStock: (productId: string, quantity: number) => void;
}

export const useInventoryStore = create<InventoryState>((set) => ({
  items: [],
  isLoading: false,
  setItems: (items) => set({ items }),
  updateStock: (productId, quantity) => set((state) => ({
    items: state.items.map(item => item.id === productId ? { ...item, stock: quantity } : item)
  })),
}));
