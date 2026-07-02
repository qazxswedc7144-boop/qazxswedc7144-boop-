import { useState, useEffect } from 'react';
import { SettingsCard, SettingToggle } from '../shared/SettingsUI';
import { Code } from 'lucide-react';
import { settingsService, type SettingValue } from '../../data/SettingsService';

export default function DeveloperTab() {
  const [settings, setSettings] = useState<Record<string, SettingValue>>({});

  useEffect(() => {
    settingsService.getSettingsGroup([
      'dev_debug_mode', 'dev_show_logs', 'dev_feature_flags'
    ]).then(setSettings);
  }, []);

  const handleChange = (key: string, value: SettingValue) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    settingsService.saveSetting(key, value, true);
  };

  return (
    <div className="space-y-6">
      <SettingsCard title="إعدادات المطور (Developer & Diagnostics)" description="أدوات متقدمة لتشخيص المشاكل واختبار الميزات الجديدة" icon={Code}>
         <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl mb-6 text-amber-800 text-sm font-cairo">
           <strong>تحذير:</strong> تغيير هذه الإعدادات قد يؤثر على استقرار النظام. لا تقم بتعديلها إلا إذا طلب منك فريق الدعم الفني ذلك.
         </div>

         <div className="space-y-4">
          <SettingToggle 
            label="وضع التصحيح (Debug Mode)" 
            description="إظهار تفاصيل الأخطاء الفنية (Stack Traces)" 
            checked={!!settings.dev_debug_mode} 
            onChange={(v: boolean) => handleChange('dev_debug_mode', v)} 
          />
          <SettingToggle 
            label="مراقبة الأداء (Performance Logs)" 
            description="تسجيل سرعة العمليات وتحليل الـ Render" 
            checked={!!settings.dev_show_logs} 
            onChange={(v: boolean) => handleChange('dev_show_logs', v)} 
          />
          <SettingToggle 
            label="الميزات التجريبية (Feature Flags)" 
            description="تفعيل الميزات التي لا تزال قيد التطوير (Beta)" 
            checked={!!settings.dev_feature_flags} 
            onChange={(v: boolean) => handleChange('dev_feature_flags', v)} 
          />
         </div>
      </SettingsCard>
    </div>
  );
}
