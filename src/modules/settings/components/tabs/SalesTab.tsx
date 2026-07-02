import { useState, useEffect } from 'react';
import { SettingsCard, SettingToggle, SettingInput, SettingSelect } from '../shared/SettingsUI';
import { ShoppingCart } from 'lucide-react';
import { settingsService, type SettingValue } from '../../data/SettingsService';

export default function SalesTab() {
  const [settings, setSettings] = useState<Record<string, SettingValue>>({});

  useEffect(() => {
    settingsService.getSettingsGroup([
      'sales_allow_negative', 'sales_max_discount', 'sales_invoice_prefix', 'sales_default_tax'
    ]).then(setSettings);
  }, []);

  const handleChange = (key: string, value: SettingValue) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    settingsService.saveSetting(key, value, true);
  };

  return (
    <div className="space-y-6">
      <SettingsCard title="إعدادات المبيعات" description="التحكم في نقاط البيع (POS) والفواتير" icon={ShoppingCart}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <SettingInput label="بادئة الفاتورة (Prefix)" value={(settings.sales_invoice_prefix as string) || 'INV-'} onChange={(v: string) => handleChange('sales_invoice_prefix', v)} />
          <SettingSelect
            label="الضريبة الافتراضية (%)"
            value={(settings.sales_default_tax as string) || '15'}
            onChange={(v: string) => handleChange('sales_default_tax', v)}
            options={[
              { value: '0', label: '0% (معفى)' },
              { value: '5', label: '5%' },
              { value: '15', label: '15%' }
            ]}
          />
          <SettingInput type="number" label="الحد الأقصى للخصم (%)" value={(settings.sales_max_discount as string) || '10'} onChange={(v: string) => handleChange('sales_max_discount', v)} />
        </div>
        <div className="space-y-4 pt-4 border-t border-slate-100">
           <SettingToggle 
             label="البيع بالسالب" 
             description="السماح ببيع المنتجات حتى لو كان المخزون صفراً" 
             checked={!!settings.sales_allow_negative} 
             onChange={(v: boolean) => handleChange('sales_allow_negative', v)} 
           />
        </div>
      </SettingsCard>
    </div>
  );
}
