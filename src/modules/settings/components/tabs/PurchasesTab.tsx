import { useState, useEffect } from 'react';
import { SettingsCard, SettingInput } from '../shared/SettingsUI';
import { Truck } from 'lucide-react';
import { settingsService, type SettingValue } from '../../data/SettingsService';

export default function PurchasesTab() {
  const [settings, setSettings] = useState<Record<string, SettingValue>>({});

  useEffect(() => {
    settingsService.getSettingsGroup([
      'purchase_invoice_prefix', 'purchase_price_limit'
    ]).then(setSettings);
  }, []);

  const handleChange = (key: string, value: SettingValue) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    settingsService.saveSetting(key, value, true);
  };

  return (
    <div className="space-y-6">
      <SettingsCard title="إعدادات المشتريات والموردين" description="تنظيم أوامر الشراء وفواتير الموردين" icon={Truck}>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SettingInput label="بادئة فاتورة الشراء" value={(settings.purchase_invoice_prefix as string) || 'PO-'} onChange={(v: string) => handleChange('purchase_invoice_prefix', v)} />
          <SettingInput type="number" label="حد تحذير اختلاف سعر الشراء (%)" description="تنبيه إذا اختلف السعر عن آخر شراء بهذا المقدار" value={(settings.purchase_price_limit as string) || '5'} onChange={(v: string) => handleChange('purchase_price_limit', v)} />
         </div>
      </SettingsCard>
    </div>
  );
}
