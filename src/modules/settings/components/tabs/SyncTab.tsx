
import { SettingsCard } from '../shared/SettingsUI';
import { RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { db } from '@/core/db';
import { useLiveQuery } from 'dexie-react-hooks';

export default function SyncTab() {
  const pendingCount = useLiveQuery(() => db.outbox.where('status').equals('pending').count()) || 0;
  const failedCount = useLiveQuery(() => db.outbox.where('status').equals('failed').count()) || 0;
  
  const handleForceSync = () => {
    // Dispatch a custom event to wake up the sync engine
    window.dispatchEvent(new CustomEvent('SYNC_WAKEUP'));
  };

  const handleClearFailed = async () => {
    await db.outbox.where('status').equals('failed').delete();
  };

  return (
    <div className="space-y-6">
      <SettingsCard title="لوحة المزامنة (Synchronization)" description="مراقبة الاتصال السحابي ومعالجة الطابور" icon={RefreshCw}>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-emerald-700 font-bold font-cairo">حالة الاتصال</p>
              <p className="text-sm text-emerald-600 font-cairo">متصل (Firebase)</p>
            </div>
            <CheckCircle2 size={24} className="text-emerald-500" />
          </div>
          
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-blue-700 font-bold font-cairo">قيد الانتظار</p>
              <p className="text-sm text-blue-600 font-cairo">{pendingCount} عملية (Outbox)</p>
            </div>
            <Clock size={24} className="text-blue-500" />
          </div>

          <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-red-700 font-bold font-cairo">فشل في المزامنة</p>
              <p className="text-sm text-red-600 font-cairo">{failedCount} عملية (Retrying)</p>
            </div>
            <AlertCircle size={24} className="text-red-500" />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button 
            onClick={handleForceSync}
            className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors font-cairo flex items-center gap-2"
          >
            <RefreshCw size={18} />
            إعادة محاولة المزامنة
          </button>
          
          {failedCount > 0 && (
            <button 
              onClick={handleClearFailed}
              className="px-6 py-2.5 bg-red-50 text-red-600 font-bold rounded-xl border border-red-200 hover:bg-red-100 transition-colors font-cairo"
            >
              حذف العمليات الفاشلة
            </button>
          )}
        </div>
      </SettingsCard>
    </div>
  );
}
