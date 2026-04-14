
import { BackupService } from '../services/backupService';

/**
 * 5. MERGE SYSTEM (CRITICAL 🔥)
 * 8. PREVENT DATA LOSS: If cloud empty, do not overwrite local
 */
export const mergeData = async (cloud: any) => {
  if (!cloud || !cloud.tables || Object.keys(cloud.tables).length === 0) {
    console.warn("Merge skipped: Cloud data is empty or invalid.");
    return;
  }

  const local = await BackupService.exportDatabase();
  
  // 6. ADD UPDATED TIMESTAMP: Ensure both have timestamps for comparison
  const cloudUpdate = cloud.updatedAt || cloud.timestamp || 0;
  const localUpdate = local.updatedAt || local.timestamp || 0;

  console.log(`Sync Merge: Cloud(${cloudUpdate}) vs Local(${localUpdate})`);

  // RULE: latest wins
  if (cloudUpdate > localUpdate) {
    console.log("Sync Merge: Cloud is newer. Overwriting local data...");
    
    try {
      // 3. clear DB
      await BackupService.clearAllTables();
      // 4. bulk insert all tables
      await BackupService.restoreTables(cloud.tables);
      
      console.log("Sync Merge: Local data updated successfully.");
      
      // Optional: Refresh app state if needed
      window.location.reload(); 
    } catch (error) {
      console.error("Sync Merge: Failed to restore cloud data", error);
    }
  } else {
    console.log("Sync Merge: Local data is up-to-date or newer. Skipping merge.");
  }
};
