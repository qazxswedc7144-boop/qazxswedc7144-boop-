import { useState, useEffect } from 'react';
import { SettingsCard, SettingToggle } from '../shared/SettingsUI';
import { ShieldCheck } from 'lucide-react';
import { settingsService, type SettingValue } from '../../data/SettingsService';

export default function SecurityTab() {
  const [settings, setSettings] = useState<Record<string, SettingValue>>({});

  useEffect(() => {
    settingsService.getSettingsGroup([
      'security_require_pin', 'security_session_timeout', 'security_audit_log'
    ]).then(setSettings);
  }, []);

  const handleChange = (key: string, value: SettingValue) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    settingsService.saveSetting(key, value, true);
  };

  return (
    <div className="space-y-6">
      <SettingsCard title="إعدادات الأمان (Security)" description="حماية النظام وتتبع العمليات" icon={ShieldCheck}>
        <div className="space-y-4">
          <SettingToggle 
            label="قفل الشاشة السريع (PIN)" 
            description="طلب رمز PIN عند ترك الجهاز لفترة" 
            checked={!!settings.security_require_pin} 
            onChange={(v: boolean) => handleChange('security_require_pin', v)} 
          />
          <SettingToggle 
            label="انتهاء الجلسة التلقائي" 
            description="تسجيل الخروج التلقائي بعد 30 دقيقة من الخمول" 
            checked={!!settings.security_session_timeout} 
            onChange={(v: boolean) => handleChange('security_session_timeout', v)} 
          />
          <SettingToggle 
            label="تسجيل العمليات (Audit Log)" 
            description="حفظ سجل مفصل لكل عملية وتغيير في النظام" 
            checked={!!settings.security_audit_log} 
            onChange={(v: boolean) => handleChange('security_audit_log', v)} 
          />
        </div>
      </SettingsCard>
    </div>
  );
}
