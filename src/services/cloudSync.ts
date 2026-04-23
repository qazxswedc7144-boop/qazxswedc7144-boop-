import { db } from '../lib/database'

export const cloudSync = {

  pushProducts: async () => {
    // Offline mode: do nothing
  },

  pullProducts: async () => {
     // Offline mode: do nothing
  },

  /**
   * Optional manual wrapper
   */
  syncAll: async () => {
    // Offline mode: do nothing
  }
}

