// ==========================================
// FILE: src/modules/sync/sync.events.ts
// ==========================================

import { create } from 'zustand';
import { NetworkState } from './sync.types';

interface SyncStoreState {
  status: NetworkState['status'];
  isQueueDraining: boolean;
  setNetworkStatus: (status: NetworkState['status']) => void;
  setQueueDraining: (isDraining: boolean) => void;
}

const useSyncStoreBase = create<SyncStoreState>((set) => ({
  status: 'ONLINE',
  isQueueDraining: false,
  setNetworkStatus: (status) => set((state) => state.status !== status ? { status } : {}),
  setQueueDraining: (isQueueDraining) => set((state) => state.isQueueDraining !== isQueueDraining ? { isQueueDraining } : {}),
}));

// الميكرو-محددات لحماية أداء الهاتف ومنع إعادة رندرة الواجهات (Micro-Selectors)
export const useSyncStatus = () => useSyncStoreBase((state) => state.status);
export const useIsSyncing = () => useSyncStoreBase((state) => state.isQueueDraining);
export const useSyncActions = () => ({
  setNetworkStatus: useSyncStoreBase.getState().setNetworkStatus,
  setQueueDraining: useSyncStoreBase.getState().setQueueDraining,
});
export const getSyncActions = () => ({
  setNetworkStatus: useSyncStoreBase.getState().setNetworkStatus,
  setQueueDraining: useSyncStoreBase.getState().setQueueDraining,
});
