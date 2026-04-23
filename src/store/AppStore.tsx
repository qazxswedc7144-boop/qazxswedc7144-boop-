
import React from 'react';

/**
 * DEPRECATED - REPLACED BY useAppStore.ts
 * This file is kept only for backward compatibility during build phase.
 */
export const AppStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
export const useStore = () => { return {}; };
