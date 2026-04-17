import { supabase } from './supabaseClient';
import { db } from './database';
import { eventBus, EVENTS } from './eventBus';

/**
 * RealtimeSync Service - Handles live synchronization via Supabase Realtime SDK
 * Listen for database changes and updates local IndexedDB instantly.
 */
export const realtimeSync = {
  
  /**
   * Starts the realtime listeners for all ERP tables
   */
  async startRealtimeSync() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    console.log("⚡ Initializing Supabase Realtime Listeners for user:", user.id);

    const tables = [
      { name: 'products', localTable: db.products },
      { name: 'customers', localTable: db.customers },
      { name: 'suppliers', localTable: db.suppliers },
      { name: 'invoices', localTable: db.invoices },
      { name: 'journal_entries', localTable: db.journal_entries },
      { name: 'accounts', localTable: db.accounts },
      { name: 'audit_log', localTable: db.audit_log }
    ];

    tables.forEach(({ name, localTable }) => {
      supabase
        .channel(`public:${name}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: name,
            filter: `user_id=eq.${user.id}`
          },
          async (payload) => {
            console.log(`[Realtime] ${name} change detected:`, payload.eventType);
            
            try {
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const cloudItem = payload.new;
                const id = cloudItem.id || cloudItem.Invoice_ID || cloudItem.Entry_ID || cloudItem.Account_ID;
                
                if (!id) return;

                const local = await localTable.get(id);

                if (!local) {
                  // New record from another device
                  await localTable.put(cloudItem);
                } else {
                  // Conflict resolution (Temporal Merge)
                  const cloudDate = new Date(cloudItem.updated_at || cloudItem.updatedAt || 0).getTime();
                  const localDate = new Date(local.updatedAt || local.updated_at || local.timestamp || 0).getTime();

                  if (cloudDate > localDate) {
                    await localTable.put(cloudItem);
                  }
                }
              } else if (payload.eventType === 'DELETE') {
                const id = payload.old.id || payload.old.Invoice_ID || payload.old.Entry_ID || payload.old.Account_ID;
                if (id) {
                  await localTable.delete(id);
                }
              }

              // Refresh UI automatically
              eventBus.emit(EVENTS.DATA_REFRESHED);
              
            } catch (err) {
              console.error(`[Realtime] Failed to sync ${name}:`, err);
            }
          }
        )
        .subscribe();
    });
  }
};
