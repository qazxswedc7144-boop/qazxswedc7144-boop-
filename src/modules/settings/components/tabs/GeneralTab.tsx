import { useState, useEffect } from 'react';
import { SettingsCard, Accordion, SettingInput, SettingSelect } from '../shared/SettingsUI';
import { Settings, Hash } from 'lucide-react';
import { settingsService, type SettingValue } from '../../data/SettingsService';

export default function GeneralTab() {
  const [settings, setSettings] = useState<Record<string, SettingValue>>({});

  useEffect(() => {
    settingsService.getSettingsGroup(['system_name', 'language', 'timezone', 'currency', 'date_format', 'time_format']).then(setSettings);
  }, []);

  const handleChange = (key: string, value: SettingValue) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    settingsService.saveSetting(key, value, true);
  };

  return (
    <div className="space-y-6">
      <SettingsCard title="إعدادات النظام العامة" description="تخصيص الهوية الأساسية للنظام" icon={Settings}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SettingInput
            label="اسم النظام"
            value={(settings.system_name as string) || 'PharmaFlow Pro'}
            onChange={(val: string) => handleChange('system_name', val)}
          />
          <SettingSelect
            label="اللغة الافتراضية"
            value={(settings.language as string) || 'ar'}
            onChange={(val: string) => handleChange('language', val)}
            options={[
              { value: 'ar', label: 'العربية' },
              { value: 'en', label: 'English' }
            ]}
          />
        </div>
      </SettingsCard>

      <Accordion title="المنطقة والعملة" defaultOpen>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SettingSelect
            label="العملة"
            value={(settings.currency as string) || 'SAR'}
            onChange={(val: string) => handleChange('currency', val)}
            options={[
              { value: 'SAR', label: 'ريال سعودي (SAR)' },
              { value: 'USD', label: 'دولار أمريكي (USD)' },
              { value: 'EGP', label: 'جنيه مصري (EGP)' },
              { value: 'AED', label: 'درهم إماراتي (AED)' }
            ]}
          />
          <SettingSelect
            label="المنطقة الزمنية"
            value={(settings.timezone as string) || 'Asia/Riyadh'}
            onChange={(val: string) => handleChange('timezone', val)}
            options={[
              { value: 'Asia/Riyadh', label: 'توقيت السعودية (الرياض)' },
              { value: 'Africa/Cairo', label: 'توقيت مصر (القاهرة)' },
              { value: 'Asia/Dubai', label: 'توقيت الإمارات (دبي)' }
            ]}
          />
        </div>
      </Accordion>

      <Accordion title="التاريخ والوقت">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SettingSelect
            label="صيغة التاريخ"
            value={(settings.date_format as string) || 'YYYY-MM-DD'}
            onChange={(val: string) => handleChange('date_format', val)}
            options={[
              { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2026-12-31)' },
              { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2026)' },
              { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2026)' }
            ]}
          />
          <SettingSelect
            label="صيغة الوقت"
            value={(settings.time_format as string) || '24h'}
            onChange={(val: string) => handleChange('time_format', val)}
            options={[
              { value: '24h', label: '24 ساعة (14:30)' },
              { value: '12h', label: '12 ساعة (02:30 م)' }
            ]}
          />
        </div>
      </Accordion>
      
      <SettingsCard title="بيانات الترخيص والإصدار" description="معلومات النسخة الحالية" icon={Hash}>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SettingInput label="رقم الإصدار" value="v2.0.0 Enterprise" disabled />
          <SettingInput label="حالة الترخيص" value="مفعل - Enterprise Edition" disabled />
         </div>
      </SettingsCard>
    </div>
  );
}
