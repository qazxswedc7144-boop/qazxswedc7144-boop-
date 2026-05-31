
import { create } from 'zustand';

interface UIState {
  isSidebarOpen: boolean;
  theme: 'light' | 'dark';
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  notifications: any[];
  addNotification: (notif: any) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: true,
  theme: 'light',
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setTheme: (theme) => set({ theme }),
  notifications: [],
  addNotification: (notif) => set((state) => ({ notifications: [...state.notifications, notif] })),
}));
