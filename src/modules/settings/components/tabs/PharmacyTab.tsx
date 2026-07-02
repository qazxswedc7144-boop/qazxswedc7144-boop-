import { useState, useEffect } from 'react';
import { SettingsCard, Accordion, SettingInput, SettingToggle, SettingSelect } from '../shared/SettingsUI';
import { Building2, Printer } from 'lucide-react';
import { settingsService, type SettingValue } from '../../data/SettingsService';

export default function PharmacyTab() {
  const [settings, setSettings] = useState<Record<string, SettingValue>>({});

  useEffect(() => {
    settingsService.getSettingsGroup([
      'pharmacy_name', 'pharmacy_logo', 'pharmacy_address', 'pharmacy_phone', 
      'tax_number', 'commercial_record', 'invoice_qr', 'print_paper_size',
      'print_margin', 'print_copies', 'print_logo', 'invoice_footer'
    ]).then(setSettings);
  }, []);

  const handleChange = (key: string, value: SettingValue) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    settingsService.saveSetting(key, value, true);
  };

  return (
    <div className="space-y-6">
      <SettingsCard title="بيانات الصيدلية" description="تظهر هذه البيانات في الفواتير والتقارير" icon={Building2}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SettingInput label="اسم الصيدلية" value={settings.pharmacy_name} onChange={(v: string) => handleChange('pharmacy_name', v)} />
          <SettingInput label="رقم الهاتف" value={settings.pharmacy_phone} onChange={(v: string) => handleChange('pharmacy_phone', v)} />
          <SettingInput label="الرقم الضريبي" value={settings.tax_number} onChange={(v: string) => handleChange('tax_number', v)} />
          <SettingInput label="السجل التجاري" value={settings.commercial_record} onChange={(v: string) => handleChange('commercial_record', v)} />
          <div className="md:col-span-2">
             <SettingInput label="العنوان التفصيلي" value={settings.pharmacy_address} onChange={(v: string) => handleChange('pharmacy_address', v)} />
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="إعدادات الطباعة والفواتير" description="التحكم في شكل وطباعة الفاتورة" icon={Printer}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <SettingSelect
            label="مقاس الورق الافتراضي"
            value={(settings.print_paper_size as string) || 'receipt_80'}
            onChange={(v: string) => handleChange('print_paper_size', v)}
            options={[
              { value: 'receipt_80', label: 'رول إيصالات (80mm)' },
              { value: 'receipt_58', label: 'رول إيصالات (58mm)' },
              { value: 'a4', label: 'A4 كامل' },
              { value: 'a5', label: 'A5 نصف ورقة' }
            ]}
          />
          <SettingInput type="number" label="عدد النسخ الافتراضي" value={(settings.print_copies as string) || '1'} onChange={(v: string) => handleChange('print_copies', v)} />
        </div>
        
        <Accordion title="خيارات إضافية للطباعة">
          <div className="space-y-4">
            <SettingToggle label="طباعة الشعار على الفاتورة" checked={settings.print_logo} onChange={(v: boolean) => handleChange('print_logo', v)} />
            <SettingToggle label="توليد رمز QR للفاتورة (متوافق مع هيئة الزكاة)" checked={settings.invoice_qr} onChange={(v: boolean) => handleChange('invoice_qr', v)} />
            <SettingInput label="تذييل الفاتورة (رسالة ترحيبية)" value={(settings.invoice_footer as string) || 'نتمنى لكم دوام الصحة والعافية'} onChange={(v: string) => handleChange('invoice_footer', v)} />
          </div>
        </Accordion>
      </SettingsCard>
    </div>
  );
}
