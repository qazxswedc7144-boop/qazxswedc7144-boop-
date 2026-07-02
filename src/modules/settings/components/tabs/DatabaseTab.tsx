import { useState, useEffect } from 'react';
import { SettingsCard } from '../shared/SettingsUI';
import { Database, HardDrive } from 'lucide-react';
import BackupManagementComponent from '../BackupManagement';
import { db } from '@/core/db';

export default function DatabaseTab() {
  const [stats, setStats] = useState({ tables: 0, totalRecords: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const tables = db.tables;
      let total = 0;
      for (const table of tables) {
        total += await table.count();
      }
      setStats({ tables: tables.length, totalRecords: total });
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <SettingsCard title="حالة قاعدة البيانات المحلية (Dexie)" description="إحصائيات مساحة التخزين الخاصة بالمتصفح" icon={HardDrive}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-slate-500 text-sm font-cairo">عدد الجداول</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{stats.tables}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-slate-500 text-sm font-cairo">إجمالي السجلات</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{stats.totalRecords.toLocaleString()}</p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="النسخ الاحتياطي والصيانة" description="إدارة النسخ المحلية والاستعادة" icon={Database}>
         <BackupManagementComponent />
      </SettingsCard>
    </div>
  );
}
