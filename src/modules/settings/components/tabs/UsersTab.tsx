import { useState, useEffect } from 'react';
import { SettingsCard, SettingToggle } from '../shared/SettingsUI';
import { Users, UserCog, Lock } from 'lucide-react';
import { settingsService, type SettingValue } from '../../data/SettingsService';

export default function UsersTab() {
  const [settings, setSettings] = useState<Record<string, SettingValue>>({});

  useEffect(() => {
    settingsService.getSettingsGroup([
      'perm_print', 'perm_delete_invoice', 'perm_returns', 'perm_discount', 'perm_backup'
    ]).then(setSettings);
  }, []);

  const handleChange = (key: string, value: SettingValue) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    settingsService.saveSetting(key, value, true);
  };

  return (
    <div className="space-y-6">
      <SettingsCard title="إدارة المستخدمين" description="هذه الصفحة حالياً تعرض إعدادات الصلاحيات العامة. سيتم توجيهك قريباً لصفحة إدارة المستخدمين التفصيلية." icon={Users}>
        <div className="p-4 bg-indigo-50 text-indigo-700 rounded-xl font-cairo text-sm font-medium">
          لإضافة أو تعديل المستخدمين، يرجى استخدام "إدارة المستخدمين" من القائمة الرئيسية.
        </div>
      </SettingsCard>

      <SettingsCard title="الصلاحيات الافتراضية للكاشير" description="التحكم فيما يمكن للصيادلة (الكاشير) القيام به" icon={UserCog}>
         <div className="space-y-4">
            <SettingToggle label="السماح بطباعة نسخ إضافية من الفاتورة" checked={!!settings.perm_print} onChange={(v: boolean) => handleChange('perm_print', v)} />
            <SettingToggle label="السماح بعمل مرتجع" checked={!!settings.perm_returns} onChange={(v: boolean) => handleChange('perm_returns', v)} />
            <SettingToggle label="السماح بمنح خصم إضافي" checked={!!settings.perm_discount} onChange={(v: boolean) => handleChange('perm_discount', v)} />
         </div>
      </SettingsCard>

      <SettingsCard title="صلاحيات خطرة (للمشرفين فقط)" description="صلاحيات مقيدة تتطلب تحقق إضافي" icon={Lock}>
         <div className="space-y-4">
            <SettingToggle label="السماح بحذف الفواتير نهائياً" checked={!!settings.perm_delete_invoice} onChange={(v: boolean) => handleChange('perm_delete_invoice', v)} />
            <SettingToggle label="السماح بسحب أو استعادة النسخ الاحتياطية" checked={!!settings.perm_backup} onChange={(v: boolean) => handleChange('perm_backup', v)} />
         </div>
      </SettingsCard>
    </div>
  );
}
