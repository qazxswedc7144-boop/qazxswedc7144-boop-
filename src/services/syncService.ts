
import { BackupService } from './backupService';
import { db } from '../lib/database';

const SYNC_URL = import.meta.env.VITE_BACKUP_SCRIPT_URL || "PUT_YOUR_APPS_SCRIPT_URL_HERE";
const TOKEN = "abc123"; // 9. OPTIONAL SECURITY

export const pushData = async (data: any) => {
  if (!SYNC_URL || SYNC_URL.includes("PUT_YOUR_APPS_SCRIPT_URL_HERE")) {
    console.warn("Sync URL not configured. Skipping push.");
    return;
  }

  try {
    // Ensure updatedAt is present
    data.updatedAt = data.updatedAt || data.timestamp || Date.now();

    const response = await fetch(SYNC_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "push",
        data,
        token: TOKEN
      }),
      headers: {
        "Content-Type": "application/json"
      }
    });
    
    if (response.ok) {
      console.log("Cloud sync: Push successful.");
    } else {
      console.warn(`Cloud sync push returned status ${response.status}`);
    }
  } catch (e) {
    console.error("Push failed", e);
  }
};

export const pullData = async () => {
  if (!SYNC_URL || SYNC_URL.includes("PUT_YOUR_APPS_SCRIPT_URL_HERE")) {
    console.warn("Sync URL not configured. Skipping pull.");
    return null;
  }

  try {
    const res = await fetch(SYNC_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "pull",
        token: TOKEN
      }),
      headers: {
        "Content-Type": "application/json"
      }
    });

    const json = await res.json();
    if (json.status === "ok") {
      return json.data;
    }
    return null;
  } catch (e) {
    console.error("Pull failed", e);
    return null;
  }
};

export const syncFromCloud = async () => {
  const cloud = await pullData();
  if (!cloud || Object.keys(cloud).length === 0) {
    console.log("Cloud sync: Cloud is empty or pull failed. Skipping merge.");
    return;
  }

  const { mergeData } = await import('../utils/merge');
  await mergeData(cloud);
};

export async function pushChanges() {
  const tables = ["invoices", "products", "customers", "suppliers"] as const;

  for (const table of tables) {
    const tableInstance = (db as any)[table];
    if (!tableInstance) continue;

    const unsynced = await tableInstance
      .where('isSynced')
      .equals(false)
      .toArray();

    if (unsynced.length === 0) continue;

    try {
      const response = await fetch(SYNC_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "push",
          table,
          records: unsynced,
          token: TOKEN
        }),
        headers: {
          "Content-Type": "application/json"
        }
      });

      if (response.ok) {
        // تحديث الحالة فقط إذا نجح الاتصال
        for (const r of unsynced) {
          r.isSynced = true;
          await tableInstance.put(r);
        }
      }
    } catch (err) {
      console.error(`Failed to push changes for table ${table}:`, err);
    }
  }
}

export async function pullChanges() {
  if (!SYNC_URL || SYNC_URL.includes("PUT_YOUR_APPS_SCRIPT_URL_HERE")) {
    console.warn("Sync URL not configured. Skipping pull.");
    return;
  }

  try {
    const res = await fetch(SYNC_URL, {
      method: "POST",
      body: JSON.stringify({ 
        action: "pull",
        token: TOKEN
      }),
      headers: {
        "Content-Type": "application/json"
      }
    });

    const cloud = await res.json();
    if (cloud.status !== "ok" || !cloud.data) return;

    for (const table in cloud.data) {
      const tableInstance = (db as any)[table];
      if (!tableInstance) continue;

      for (const rec of cloud.data[table]) {
        const local = await tableInstance.get(rec.id);

        if (!local) {
          // Mark as synced since it's coming from cloud
          rec.isSynced = true;
          await tableInstance.put(rec);
        } else {
          const cloudUpdate = rec.updatedAt || rec.timestamp || 0;
          const localUpdate = local.updatedAt || local.timestamp || 0;

          if (cloudUpdate > localUpdate) {
            rec.isSynced = true;
            await tableInstance.put(rec);
          }
        }
      }
    }
    console.log("Cloud sync: Pull successful.");
  } catch (e) {
    console.error("Pull failed", e);
  }
}
