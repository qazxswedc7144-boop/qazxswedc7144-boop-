import { supabase } from '@/services/supabaseClient';
import { db } from '@/services/database';

/**
 * CloudSync Service - Handles full persistence between IndexedDB and Supabase
 * Focuses on high-integrity ERP synchronization for Pharmacy data
 */
export const cloudSync = {
  
  /**
   * Pushes all records from a local table to Supabase using record-level upsert
   */
  async pushTable(tableName: string, localTable: any) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const data = await localTable.toArray();
      if (!data || data.length === 0) return;

      for (const item of data) {
        if (!item?.id && !item?.Invoice_ID && !item?.Entry_ID && !item?.Account_ID) continue;
        
        // Ensure every record has a user_id for cloud ownership
        await supabase
          .from(tableName)
          .upsert({
            ...item,
            user_id: user.id,
            updated_at: item.updatedAt || item.updated_at || item.timestamp || new Date().toISOString()
          });
      }
    } catch (e) {
      console.warn(`[Sync] Push failed for ${tableName}:`, e);
    }
  },

  /**
   * Pulls all records from Supabase and merges them locally based on updatedAt
   */
  async pullTable(tableName: string, localTable: any) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      for (const cloudItem of data || []) {
        const id = cloudItem.id || cloudItem.Invoice_ID || cloudItem.Entry_ID || cloudItem.Account_ID;
        if (!id) continue;

        const local = await localTable.get(id);

        if (!local) {
          // If not exists locally, just put it
          await localTable.put(cloudItem);
        } else {
          // Version collision check (Temporal Merge)
          const cloudDate = new Date(cloudItem.updated_at || 0).getTime();
          const localDate = new Date(local.updatedAt || local.updated_at || local.timestamp || 0).getTime();

          if (cloudDate > localDate) {
            await localTable.put(cloudItem);
          }
        }
      }
    } catch (e) {
      console.warn(`[Sync] Pull failed for ${tableName}:`, e);
    }
  },

  /**
   * Orchestrates a full bidirectional sync for all ERP tables
   */
  async syncAll() {
    console.log("☁️ Starting Full ERP Cloud Sync...");
    const tables = [
      { name: 'products', table: db.products },
      { name: 'customers', table: db.customers },
      { name: 'suppliers', table: db.suppliers },
      { name: 'invoices', table: db.invoices },
      { name: 'journal_entries', table: db.journal_entries },
      { name: 'accounts', table: db.accounts },
      { name: 'audit_log', table: db.audit_log }
    ];

    for (const t of tables) {
      if (t.table) {
        await this.pushTable(t.name, t.table);
        await this.pullTable(t.name, t.table);
      }
    }
    console.log("✅ Cloud Sync Complete.");
  },

  /**
   * Background engine that keeps cloud and local in sync
   */
  startSyncEngine() {
    this.syncAll(); // Initial run

    const interval = setInterval(async () => {
      try {
        await this.syncAll();
      } catch (e) {
        console.error("Cloud Sync background failure:", e);
      }
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }
};
