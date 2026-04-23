import { db } from '../lib/database';
import { Product, Sale, Purchase, Category } from '../types';

export const importExportService = {
  
  exportDataJSON: async (pharmacyName: string = "صيدلية فارما فلو") => {
    try {
      // Gather all local data
      const settings = {
        currency: await db.getSetting('currency', 'SAR'),
        taxRate: await db.getSetting('taxRate', 0.15),
        enableFEFO: await db.getSetting('enableFEFO', true)
      };

      const categories = await db.categories.toArray();
      const medicines = await db.products.toArray();
      const batches = await db.medicineBatches.toArray();
      const sales = await db.sales.toArray();
      const purchases = await db.purchases.toArray();
      
      const payload = {
        metadata: {
          pharmacyName,
          exportDate: new Date().toISOString(),
          version: "1.0",
          recordCounts: {
            categories: categories.length,
            medicines: medicines.length,
            batches: batches.length,
            sales: sales.length,
            purchases: purchases.length,
          }
        },
        settings,
        categories,
        medicines,
        batches,
        sales,
        purchases
      };

      // Create downloadable file
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `PharmaFlow_Backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      
      return { success: true };
    } catch (error: any) {
      console.error("Export Error:", error);
      return { success: false, error: error.message };
    }
  },

  importDataJSON: async (fileList: FileList) => {
    if (fileList.length === 0) throw new Error("No file selected.");
    const file = fileList[0];

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const contents = e.target?.result;
          if (typeof contents !== 'string') throw new Error("Invalid file content.");
          
          const payload = JSON.parse(contents);

          // Validation
          if (!payload.metadata || !payload.medicines) {
            throw new Error("ملف النسخة الاحتياطية غير صالح أو تالف.");
          }

          // Run transaction to prevent partial state on error
          await db.transaction('rw', 
            db.settings, db.categories, db.products, 
            db.medicineBatches, db.sales, db.purchases, 
            async () => {
              
            // 1. Clear old data
            await db.categories.clear();
            await db.products.clear();
            await db.medicineBatches.clear();
            await db.sales.clear();
            await db.purchases.clear();

            // 2. Insert Settings
            if (payload.settings) {
              await db.saveSetting('currency', payload.settings.currency);
              await db.saveSetting('taxRate', payload.settings.taxRate);
              await db.saveSetting('enableFEFO', payload.settings.enableFEFO);
            }

            // 3. Bulk Insert Data
            if (payload.categories?.length) await db.categories.bulkPut(payload.categories);
            if (payload.medicines?.length) await db.products.bulkPut(payload.medicines);
            if (payload.batches?.length) await db.medicineBatches.bulkPut(payload.batches);
            if (payload.sales?.length) await db.sales.bulkPut(payload.sales);
            if (payload.purchases?.length) await db.purchases.bulkPut(payload.purchases);
          });

          resolve({ success: true, count: payload.metadata.recordCounts });
        } catch (error: any) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }
};
