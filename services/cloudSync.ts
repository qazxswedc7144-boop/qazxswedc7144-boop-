import { supabase } from './supabaseClient'
import { db } from './database'

export const cloudSync = {

  async pushTable(tableName: string, localTable: any) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return;

      const data = await localTable.toArray()
      if (!data || data.length === 0) return;

      for (const item of data) {
        if (!item?.id) continue;
        await supabase
          .from(tableName)
          .upsert({
            ...item,
            user_id: user.id,
            updated_at: item.updatedAt || item.updated_at || item.timestamp || Date.now()
          })
      }
    } catch (e) {
      console.warn(`Push Table ${tableName} Error:`, e);
    }
  },

  async pullTable(tableName: string, localTable: any) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return;

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('user_id', user.id)

      if (error) {
        console.error(`Error pulling ${tableName}:`, error);
        return;
      }

      for (const cloudItem of data || []) {
        if (!cloudItem?.id) continue;
        const local = await localTable.get(cloudItem.id)

        if (!local) {
          await localTable.put(cloudItem)
        } else {
          const cloudUpdated = new Date(cloudItem.updated_at || 0).getTime();
          const localUpdated = new Date(local.updatedAt || local.updated_at || local.timestamp || 0).getTime();
          
          if (cloudUpdated > localUpdated) {
            await localTable.put(cloudItem)
          }
        }
      }
    } catch (e) {
      console.warn(`Pull Table ${tableName} Error:`, e);
    }
  },

  async syncAll() {
    const tables = [
      { name: 'products', table: db.products },
      { name: 'customers', table: db.customers },
      { name: 'suppliers', table: db.suppliers },
      { name: 'invoices', table: db.invoices },
      { name: 'journal_entries', table: db.journal_entries },
      { name: 'accounts', table: db.accounts }
    ];

    for (const t of tables) {
      if (t.table) {
        await this.pushTable(t.name, t.table);
        await this.pullTable(t.name, t.table);
      }
    }
  },

  startSyncEngine: () => {
    // Initial sync
    cloudSync.syncAll();

    // Auto Sync Interval
    const interval = setInterval(async () => {
      try {
        await cloudSync.syncAll();
      } catch (e) {
        console.warn("Cloud Sync Engine Error:", e);
      }
    }, 30000); // Increased interval for full ERP sync

    return () => clearInterval(interval);
  }

}
