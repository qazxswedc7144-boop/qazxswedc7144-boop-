import { useState, useEffect } from 'react';
import { SettingsCard, SettingToggle, SettingInput } from '../shared/SettingsUI';
import { Package } from 'lucide-react';
import { settingsService, type SettingValue } from '../../data/SettingsService';

export default function InventoryTab() {
  const [settings, setSettings] = useState<Record<string, SettingValue>>({});

  useEffect(() => {
    settingsService.getSettingsGroup([
      'inventory_alert_limit', 'inventory_track_batches', 'inventory_barcode_generation'
    ]).then(setSettings);
  }, []);

  const handleChange = (key: string, value: SettingValue) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    settingsService.saveSetting(key, value, true);
  };

  return (
    <div className="space-y-6">
      <SettingsCard title="إعدادات المخزون" description="إدارة الأصناف والكميات" icon={Package}>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <SettingInput type="number" label="حد التنبيه الافتراضي (نواقص)" value={(settings.inventory_alert_limit as string) || '10'} onChange={(v: string) => handleChange('inventory_alert_limit', v)} />
         </div>
         <div className="space-y-4 pt-4 border-t border-slate-100">
           <SettingToggle 
             label="تتبع الدفعات (Batches & Expiry)" 
             description="إلزام إدخال رقم الدفعة وتاريخ الصلاحية عند الشراء" 
             checked={!!settings.inventory_track_batches} 
             onChange={(v: boolean) => handleChange('inventory_track_batches', v)} 
           />
           <SettingToggle 
             label="التوليد التلقائي للباركود" 
             description="إذا لم يملك الصنف باركود عالمي، يتم توليد رقم تسلسلي له" 
             checked={!!settings.inventory_barcode_generation} 
             onChange={(v: boolean) => handleChange('inventory_barcode_generation', v)} 
           />
         </div>
      </SettingsCard>
    </div>
  );
}
