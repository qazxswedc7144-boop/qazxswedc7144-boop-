
import React, { useState, useEffect } from 'react';
import { db } from '@/core/db';
import { BackupService } from '@/services/backupService';
import { SystemBackup } from '@/types';
import { 
  Database, Download, RotateCcw, ShieldCheck, 
  History, AlertTriangle, CheckCircle2, XCircle,
  FileJson, Lock, Shield, Search, Trash2, AlertCircle,
  Cloud, RefreshCw, Upload
} from 'lucide-react';
import { Card, Button, Badge, Modal, Input } from '@/components/shared/SharedUI';
import { useUI } from '@/contexts/AppContext';
import { authService } from '@/modules/auth/services/authService';
import { ProductionCleanupService } from '@/services/system/ProductionCleanupService';

import { localBackupService } from '@/services/integrity/shared/localBackupService';
import { GoogleDriveService } from '@/services/backup/googleDriveService';
import { backupService, BackupScheduleConfig } from '@/services/backupScheduler';

const BackupManagement: React.FC = () => {
  const [backups, setBackups] = useState<SystemBackup[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupConfirmText, setCleanupConfirmText] = useState('');
  const { addToast, refreshGlobal } = useUI();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const user = authService.getCurrentUser();

  // Google Drive Integration States
  const [gdriveToken, setGdriveToken] = useState<string | null>(null);
  const [gdriveEmail, setGdriveEmail] = useState<string | null>(null);
  const [gdriveFiles, setGdriveFiles] = useState<any[]>([]);
  const [gdriveLoading, setGdriveLoading] = useState(false);

  // Scheduling Integration States
  const [scheduleConfig, setScheduleConfig] = useState<BackupScheduleConfig>({
    enabled: false,
    frequency: 'daily',
    destination: 'local',
    password: 'pharma-safe-123'
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await loadBackups();
      } catch (e) {
        console.error("BackupManagement init failed:", e);
      }

      try {
        const conf = await backupService.getConfig();
        setScheduleConfig(conf);
      } catch (e) {
        console.error("Failed to load backup schedule config:", e);
      }

      // Load existing GDrive credentials from memory/storage
      const token = GoogleDriveService.getAccessToken();
      const email = GoogleDriveService.getUserEmail();
      if (token) {
        setGdriveToken(token);
        setGdriveEmail(email);
        loadGDriveFiles(token);
      }
    };
    init();
  }, []);

  const loadGDriveFiles = async (token: string) => {
    setGdriveLoading(true);
    try {
      const files = await GoogleDriveService.listBackups(token);
      setGdriveFiles(files);
    } catch (err: any) {
      console.error("Drive list failed:", err);
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        await handleGDriveLogout();
        addToast('انتهت صلاحية جلسة Google، يرجى إعادة تسجيل الدخول 🔒', 'warning');
      } else {
        addToast('فشل تحميل سجلات جوجل درايف ❌', 'error');
      }
    } finally {
      setGdriveLoading(false);
    }
  };

  const handleGDriveLogin = async () => {
    setGdriveLoading(true);
    try {
      const { user: gUser, accessToken } = await GoogleDriveService.signIn();
      setGdriveToken(accessToken);
      setGdriveEmail(gUser.email);
      addToast('تم ربط حساب Google Drive بنجاح 🎉', 'success');
      await loadGDriveFiles(accessToken);
    } catch (err) {
      console.error(err);
      addToast('فشل ربط حساب Google Drive ❌', 'error');
    } finally {
      setGdriveLoading(false);
    }
  };

  const handleGDriveLogout = async () => {
    await GoogleDriveService.signOut();
    setGdriveToken(null);
    setGdriveEmail(null);
    setGdriveFiles([]);
    addToast('تم فصل حساب Google Drive 🔓', 'info');
  };

  const handleSaveSchedule = async (newConfig: BackupScheduleConfig) => {
    setSavingSchedule(true);
    try {
      if (newConfig.enabled && newConfig.destination === 'gdrive' && !gdriveToken) {
        addToast('يرجى ربط حساب Google Drive أولاً قبل تفعيل النسخ الاحتياطي السحابي ⚠️', 'warning');
        setSavingSchedule(false);
        return;
      }
      
      await backupService.saveConfig(newConfig);
      setScheduleConfig(newConfig);
      addToast('تم حفظ وتحديث إعدادات جدولة النسخ الاحتياطي بنجاح 💾✅', 'success');
    } catch (err: any) {
      console.error(err);
      addToast(`فشل حفظ إعدادات الجدولة: ${err.message}`, 'error');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleTriggerScheduledBackupNow = async () => {
    setLoading(true);
    try {
      if (scheduleConfig.destination === 'gdrive' && !gdriveToken) {
        addToast('يرجى ربط حساب Google Drive أولاً لتشغيل التجربة السحابية ⚠️', 'warning');
        return;
      }
      const bId = await backupService.runUnifiedBackup(scheduleConfig);
      addToast('تم تنفيذ نسخة احتياطية مجدولة بنجاح بقيمة ID: ' + bId + ' 🎉', 'success');
      await loadBackups();
    } catch (error: any) {
      console.error(error);
      addToast(`فشل تشغيل النسخ الاحتياطي الموحد: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGDriveUpload = async () => {
    if (!gdriveToken) return;

    const password = window.prompt('يرجى تعيين كلمة مرور لتشفير ملف النسخة الاحتياطية على جوجل درايف (.enc):');
    if (password === null) return;

    setGdriveLoading(true);
    try {
      const blob = await BackupService.exportBackupToFile(password || 'default_backup_password');
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `PharmaFlow_Cloud_Backup_${dateStr}_${Date.now()}.enc`;
      
      await GoogleDriveService.uploadBackup(fileName, blob, gdriveToken);
      addToast('تم رفع النسخة الاحتياطية المشفرة إلى Google Drive بنجاح ☁️✅', 'success');
      await loadGDriveFiles(gdriveToken);
    } catch (error: any) {
      console.error(error);
      addToast(`فشل الرفع السحابي: ${error.message}`, 'error');
    } finally {
      setGdriveLoading(false);
    }
  };

  const handleGDriveRestore = async (fileId: string, fileName: string) => {
    if (!gdriveToken) return;
    if (user?.Role !== 'Admin') {
      addToast('عذراً، هذه العملية تتطلب صلاحيات مدير النظام 🔒', 'error');
      return;
    }

    const password = window.prompt('يرجى إدخال كلمة مرور فك التشفير للنسخة المحددة:');
    if (password === null) return;

    const confirmRestore = window.confirm(
      `تحذير هام: أنت على وشك استعادة النظام من النسخة السحابية (${fileName}). سيؤدي هذا إلى مسح كافة البيانات الحالية واستبدالها ببيانات النسخة المحددة. هل أنت متأكد؟`
    );
    if (!confirmRestore) return;

    setGdriveLoading(true);
    try {
      const blob = await GoogleDriveService.downloadBackup(fileId, gdriveToken);
      await BackupService.restoreBackup(blob, password);
      addToast('تم تنزيل واستعادة النظام من السحابة بنجاح 🚀', 'success');
      refreshGlobal();
    } catch (error: any) {
      console.error(error);
      addToast(`فشل استعادة السحابة: ${error.message}`, 'error');
    } finally {
      setGdriveLoading(false);
    }
  };

  const handleGDriveDelete = async (fileId: string, fileName: string) => {
    if (!gdriveToken) return;

    const confirmDelete = window.confirm(`هل أنت متأكد من حذف هذه النسخة الاحتياطية من حساب Google Drive الخاص بك؟\n(${fileName})`);
    if (!confirmDelete) return;

    setGdriveLoading(true);
    try {
      await GoogleDriveService.deleteBackup(fileId, gdriveToken);
      addToast('تم حذف النسخة السحابية بنجاح 🗑️', 'success');
      await loadGDriveFiles(gdriveToken);
    } catch (error: any) {
      console.error(error);
      addToast(`فشل الحذف من السحابة: ${error.message}`, 'error');
    } finally {
      setGdriveLoading(false);
    }
  };

  const loadBackups = async () => {
    try {
      const data = await db.db.systemBackups.orderBy('createdAt').reverse().toArray();
      setBackups(data);
    } catch (e) {
      console.error("Failed to load backups:", e);
    }
  };

  const handleJSONExport = async () => {
    setLoading(true);
    try {
      await localBackupService.downloadBackup();
      addToast('تم تصدير النسخة الاحتياطية بنجاح ✅', 'success');
    } catch (e) {
      addToast('فشل التصدير', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleJSONImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      await localBackupService.restoreBackup(file);
    } catch (err: any) {
      addToast(`فشل الاسترجاع: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleManualBackup = async () => {
    const password = window.prompt('يرجى إدخال كلمة مرور لتشفير هذه النسخة (اختياري، اترك فارغاً للاستخدام الداخلي):');
    setLoading(true);
    try {
      await BackupService.createBackup('Manual Backup', 'MANUAL', false, password || undefined);
      addToast('تم إنشاء نسخة احتياطية مشفرة بنجاح ✅', 'success');
      await loadBackups();
    } catch (error) {
      addToast('فشل إنشاء النسخة الاحتياطية ❌', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBackupNow = async () => {
    const password = window.prompt('يرجى تعيين كلمة مرور لتشفير وحماية ملف النسخة الاحتياطية الفورية (.enc):\n(تنبيه: ستحتاج لكلمة المرور هذه مستقبلاً لفك التشفير والاسترجاع)');
    if (!password) {
      addToast('تم إلغاء عملية النسخ الاحتياطي ⚠️', 'warning');
      return;
    }

    setLoading(true);
    try {
      // 1. Generate local encrypted database snapshot immediately
      const blob = await BackupService.exportBackupToFile(password);
      
      // 2. Prompt user to download
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().split('T')[0];
      const timestamp = Date.now();
      a.download = `PharmaFlow_Backup_Now_${dateStr}_${timestamp}.enc`;
      a.click();
      
      // 3. Register it locally inside IndexedDB history for visibility & local restore records
      await BackupService.createBackup(`نسخة فورية - تحميل فوري محلي`, 'MANUAL', false, password);
      await loadBackups();
      
      addToast('تم إنشاء النسخة الاحتياطية المشفرة وتحميلها فوراً بنجاح 💾✅', 'success');
    } catch (error: any) {
      console.error(error);
      addToast(`فشل النسخ الاحتياطي الفوري: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (backup: SystemBackup) => {
    // If it's an old backup or we want a raw export of the record
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `PharmaFlow_Backup_${backup.backupName}_${backup.createdAt.split('T')[0]}.json`;
    a.click();
  };

  const handleExportEncrypted = async () => {
    const password = window.prompt('يرجى تعيين كلمة مرور لتشفير ملف النسخة الاحتياطية (.enc):');
    if (!password) return;

    setLoading(true);
    try {
      const blob = await BackupService.exportBackupToFile(password);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `backup_${new Date().toISOString().split('T')[0]}.enc`;
      a.click();
      addToast('تم تصدير ملف النسخة المشفرة بنجاح ✅', 'success');
    } catch (error: any) {
      addToast(`فشل التصدير: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImportEncrypted = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const password = window.prompt('يرجى إدخال كلمة مرور فك تشفير الملف:');
    if (!password) return;

    setLoading(true);
    try {
      await BackupService.restoreBackup(file, password);
      addToast('تم استيراد البيانات وفك التشفير بنجاح 🚀', 'success');
      refreshGlobal();
    } catch (error: any) {
      addToast(`فشل الاستيراد: ${error.message}`, 'error');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const handleRestore = async (backupId: string) => {
    if (user?.Role !== 'Admin') {
      addToast('عذراً، هذه العملية تتطلب صلاحيات مدير النظام 🔒', 'error');
      return;
    }

    const password = window.prompt('يرجى إدخال كلمة مرور فك التشفير (اترك فارغاً إذا كانت نسخة داخلية):');

    const confirmRestore = window.confirm(
      "تحذير هام: أنت على وشك استعادة النظام من نسخة احتياطية. سيؤدي هذا إلى مسح كافة البيانات الحالية واستبدالها ببيانات النسخة المختارة. هل أنت متأكد؟"
    );

    if (!confirmRestore) return;

    setLoading(true);
    try {
      await BackupService.restoreFromBackup(backupId, password || undefined);
      addToast('تمت استعادة النظام بنجاح 🚀 سيتم تحديث البيانات الآن.', 'success');
      refreshGlobal();
      await loadBackups();
    } catch (error: any) {
      addToast(`فشل الاستعادة: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteCleanup = async () => {
    if (cleanupConfirmText !== 'DELETE-DEMO') {
      addToast('يرجى كتابة رمز التأكيد بشكل صحيح', 'warning');
      return;
    }

    setLoading(true);
    try {
      const result = await ProductionCleanupService.runCleanup();
      if (result.success) {
        addToast(result.message, 'success');
        setShowCleanupModal(false);
        setCleanupConfirmText('');
        refreshGlobal();
      } else {
        addToast(result.message, 'error');
      }
    } catch (error: any) {
      addToast(`فشل التنظيف: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredBackups = backups.filter(b => 
    b.backupName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.backupType.includes(searchTerm.toUpperCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Action Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-3 !p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-none shadow-xl relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center md:text-right">
                <h3 className="text-xl font-black flex items-center gap-2 justify-center md:justify-start">
                  <Shield className="text-emerald-400" /> نظام النسخ الاحتياطي
                </h3>
                <p className="text-slate-400 text-xs font-bold">
                  حماية بياناتك هي أولويتنا. يتم تشفير كافة النسخ باستخدام AES-GCM (Web Crypto).
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button 
                  variant="primary" 
                  className="h-12 px-5 !rounded-2xl shadow-emerald-500/20 shadow-2xl hover:scale-105 transition-all text-xs"
                  onClick={handleJSONExport}
                  isLoading={loading}
                >
                  <FileJson className="ml-2" size={16} /> تصدير شامل (JSON)
                </Button>
                <label className="cursor-pointer">
                  <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleJSONImport} />
                  <div className="h-12 px-4 !rounded-2xl bg-amber-600 text-white flex items-center justify-center text-xs font-bold hover:bg-amber-500 transition-all shadow-lg mx-1">
                    <Upload className="ml-2" size={16} /> استيراد شامل (JSON)
                  </div>
                </label>

                <Button 
                  variant="primary" 
                  className="h-12 px-5 !rounded-2xl bg-teal-700 hover:bg-teal-600 shadow-emerald-500/20 shadow-2xl hover:scale-105 transition-all text-xs"
                  onClick={handleExportEncrypted}
                  isLoading={loading}
                >
                  <Lock className="ml-2" size={16} /> تصدير مشفر (.enc)
                </Button>
                <label className="cursor-pointer">
                  <input type="file" accept=".enc" className="hidden" onChange={handleImportEncrypted} />
                  <div className="h-12 px-4 !rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xs font-bold hover:bg-indigo-500 transition-all shadow-lg mx-1">
                    <Shield className="ml-2" size={16} /> استيراد مشفر (.enc)
                  </div>
                </label>

                <div className="h-full w-px bg-slate-600 mx-1 hidden md:block"></div>
                <Button 
                  variant="approve" 
                  className="h-12 px-5 !rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20 shadow-2xl hover:scale-105 transition-all text-xs font-black"
                  onClick={handleBackupNow}
                  isLoading={loading}
                  id="btn-backup-now-immediate"
                >
                  <Download className="ml-2" size={16} /> نسخ احتياطي الآن (Backup Now)
                </Button>
                <Button 
                  variant="approve" 
                  className="h-12 px-5 !rounded-2xl shadow-emerald-500/20 shadow-2xl hover:scale-105 transition-all text-xs"
                  onClick={handleManualBackup}
                  isLoading={loading}
                >
                  <Database className="ml-2" size={16} /> إنشاء نسخة داخلية
                </Button>
              </div>
            </div>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl"></div>
        </Card>
      </div>

      {/* Automated Backup Scheduler Config */}
      <Card className="!p-6 space-y-6 border border-slate-100 shadow-md animate-in fade-in">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-100 pb-4" dir="rtl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-[#1E4D4D] flex items-center justify-center">
              <RefreshCw size={24} className={savingSchedule ? "animate-spin" : ""} />
            </div>
            <div className="text-right">
              <h3 className="text-md font-black text-[#1E4D4D] flex items-center gap-2">
                جدولة النسخ الاحتياطي التلقائي الموحد (Unified Backup Scheduler)
              </h3>
              <p className="text-xs text-slate-400 font-bold">
                قم بتفعيل الجدولة التلقائية لحماية قاعدة بياناتك وتشفيرها محلياً أو رفعها مباشرة في سحابة Google Drive.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={scheduleConfig.enabled}
                onChange={(e) => handleSaveSchedule({ ...scheduleConfig, enabled: e.target.checked })}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              <span className="mr-3 text-xs font-black text-slate-500">
                {scheduleConfig.enabled ? 'مفعل وجاهز ✅' : 'معطل ❌'}
              </span>
            </label>
          </div>
        </div>

        {scheduleConfig.enabled && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in duration-300" dir="rtl">
            <div className="space-y-1 text-right">
              <label className="text-[11px] font-extrabold text-slate-400">تكرار ووتيرة الخطوة (Frequency)</label>
              <select 
                value={scheduleConfig.frequency} 
                onChange={(e) => handleSaveSchedule({ ...scheduleConfig, frequency: e.target.value as any })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-600 outline-none focus:ring-1 focus:ring-[#1E4D4D]"
              >
                <option value="daily">نسخ احتياطي يومي تلقائي</option>
                <option value="weekly">نسخ احتياطي أسبوعي تلقائي</option>
                <option value="monthly">نسخ احتياطي شهري تلقائي</option>
              </select>
            </div>

            <div className="space-y-1 text-right">
              <label className="text-[11px] font-extrabold text-slate-400 font-mono">الوجهة المستهدفة لحزام الأمان (Destination)</label>
              <select 
                value={scheduleConfig.destination} 
                onChange={(e) => handleSaveSchedule({ ...scheduleConfig, destination: e.target.value as any })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-600 outline-none focus:ring-1 focus:ring-[#1E4D4D]"
              >
                <option value="local">تصدير وتخزين محلي (IndexedDB)</option>
                <option value="gdrive">رفع وتأمين سحابي (Google Drive ☁️)</option>
              </select>
            </div>

            <div className="space-y-1 text-right md:col-span-2 flex flex-col justify-between">
              <div>
                <label className="text-[11px] font-extrabold text-slate-400">كلمة مرور تشفير AES-GCM للنسخة المجدولة</label>
                <div className="flex gap-2">
                  <Input 
                    type="password" 
                    value={scheduleConfig.password || ''}
                    onChange={(e) => setScheduleConfig({ ...scheduleConfig, password: e.target.value })}
                    placeholder="مفتاح الأمان السري للفك والتأمين" 
                    className="flex-1 bg-slate-50 border border-slate-200 hover:border-slate-350 text-xs font-mono font-bold text-slate-600 rounded-lg p-2 outline-none"
                  />
                  <Button
                    variant="neutral"
                    size="sm"
                    className="h-9 px-3 text-xs font-black !rounded-lg"
                    onClick={() => handleSaveSchedule(scheduleConfig)}
                    isLoading={savingSchedule}
                  >
                    حفظ المفتاح
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="md:col-span-4 border-t border-dashed border-slate-100 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 p-3 rounded-xl">
              <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5 text-right w-full sm:w-auto">
                <AlertCircle size={14} className="text-[#1E4D4D] shrink-0" />
                المحرك الموحد يقوم بالنسخ التلقائي في الخلفية لحماية المستحقات المترتبة والمخزون التشغيلي.
              </div>
              <Button
                variant="neutral"
                size="sm"
                className="text-xs bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[#1E4D4D] font-black w-full sm:w-auto"
                onClick={handleTriggerScheduledBackupNow}
                isLoading={loading}
              >
                ⚙️ اختبار تشغيل النسخة المجدولة الآن
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Google Drive Integration Card */}
      <Card className="!p-6 space-y-6 border border-slate-100 shadow-md">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-100 pb-4" dir="rtl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Cloud size={24} />
            </div>
            <div className="text-right">
              <h3 className="text-md font-black text-[#1E4D4D] flex items-center gap-2">
                النسخ الاحتياطي السحابي (Google Drive)
              </h3>
              <p className="text-xs text-slate-400 font-bold">
                احفظ واسترجع نسخك الاحتياطية المشفرة مباشرة من حسابك بمساحة جوجل درايف السحابية.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {gdriveToken ? (
              <div className="flex flex-col md:flex-row items-center gap-3">
                <div className="px-3 py-1.5 bg-slate-50 rounded-lg text-xs font-black text-slate-600 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  الحساب المتصل: <span className="text-[#1E4D4D]">{gdriveEmail}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="approve"
                    size="sm"
                    className="!rounded-xl text-xs font-black shadow-lg"
                    onClick={handleGDriveUpload}
                    isLoading={gdriveLoading}
                  >
                    رفع نسخة جديدة ☁️
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="!rounded-xl text-xs text-red-650 hover:bg-red-50 font-black"
                    onClick={handleGDriveLogout}
                  >
                    فصل الحساب 🔓
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="primary"
                className="font-black flex items-center gap-2 h-12 !rounded-xl text-sm"
                onClick={handleGDriveLogin}
                isLoading={gdriveLoading}
              >
                ربط حساب Google Drive 🌐
              </Button>
            )}
          </div>
        </div>

        {gdriveToken && (
          <div className="space-y-3" dir="rtl">
            <div className="flex items-center gap-2 text-xs font-black text-slate-400 text-right">
              <RefreshCw size={14} className={gdriveLoading ? "animate-spin" : ""} />
              نسخ احتياطية مخزنة على السحابة ({gdriveFiles.length})
            </div>

            {gdriveLoading && gdriveFiles.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 font-bold animate-pulse">
                جاري جلب قائمة النسخ الاحتياطية السحابية...
              </div>
            ) : gdriveFiles.length === 0 ? (
              <div className="py-8 text-center text-xs font-bold text-slate-400 bg-slate-50 border border-slate-100 rounded-xl border-dashed">
                لا توجد نسخ احتياطية مرفوعة على حسابك المربوط حالياً.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
                {gdriveFiles.map((file: any) => (
                  <div key={file.id} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between border border-slate-100 hover:bg-slate-100/50 transition-all text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
                        📁
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[#1E4D4D]">{file.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                          📅 {new Date(file.createdTime).toLocaleString('ar-SA')} | 📦 {Math.round(parseInt(file.size || '0') / 1024)} KB
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="!rounded-lg text-[10px] font-black"
                        onClick={() => handleGDriveRestore(file.id, file.name)}
                        isLoading={gdriveLoading}
                      >
                        <RotateCcw size={12} className="ml-1" />
                        استعادة السحابة
                      </Button>
                      <button
                        onClick={() => handleGDriveDelete(file.id, file.name)}
                        className="p-2 bg-red-50 text-red-650 rounded-lg hover:bg-red-100 hover:text-red-700 transition-all"
                        title="حذف من السحابة"
                        disabled={gdriveLoading}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Backup History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <History size={16} /> سجل النسخ الاحتياطية
          </h3>
          <div className="relative w-64">
            <input 
              type="text" 
              placeholder="بحث في السجلات..."
              className="w-full h-10 bg-white border border-slate-100 rounded-xl px-10 text-xs font-bold focus:border-emerald-500 outline-none transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
          </div>
        </div>

        <div className="space-y-3">
          {filteredBackups.map(backup => (
            <Card key={backup.id} className="!p-4 hover:shadow-md transition-all group">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${
                    backup.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                  }`}>
                    {backup.status === 'SUCCESS' ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-[#1E4D4D] text-sm">{backup.backupName}</h4>
                      <Badge variant={
                        backup.backupType.startsWith('SCHEDULED') ? 'info' : 
                        backup.backupType.startsWith('PRE_') ? 'warning' : 'success'
                      }>
                        {backup.backupType}
                      </Badge>
                      {backup.isIncremental && <Badge variant="info">Incremental</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-bold text-slate-400">📅 {new Date(backup.createdAt).toLocaleString('ar-SA')}</span>
                      <span className="text-[10px] font-bold text-slate-400">👤 {backup.createdBy}</span>
                      <span className="text-[10px] font-bold text-slate-400">📦 {backup.sizeInKB} KB</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  <button 
                    onClick={() => handleDownload(backup)}
                    className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all"
                    title="تحميل الملف"
                  >
                    <Download size={18} />
                  </button>
                  <button 
                    onClick={() => handleRestore(backup.id)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#1E4D4D] text-white rounded-xl font-black text-xs hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                  >
                    <RotateCcw size={14} /> استعادة النظام
                  </button>
                </div>
              </div>
            </Card>
          ))}

          {filteredBackups.length === 0 && (
            <div className="py-20 text-center space-y-4 bg-slate-50/50 rounded-[32px] border-2 border-dashed border-slate-100">
              <div className="text-4xl opacity-20">📂</div>
              <p className="text-slate-400 font-black italic">لا توجد سجلات نسخ احتياطي مطابقة</p>
            </div>
          )}
        </div>
      </div>

      {/* Security Info */}
      <Card className="!p-6 bg-amber-50 border-amber-100 flex gap-4">
        <AlertTriangle className="text-amber-600 shrink-0" />
        <div className="space-y-1">
          <h4 className="text-xs font-black text-amber-900">تنبيهات أمنية هامة:</h4>
          <ul className="text-[10px] font-bold text-amber-800 list-disc list-inside space-y-1">
            <li>يتم تشفير كافة البيانات محلياً قبل التخزين لضمان الخصوصية التامة.</li>
            <li>يحتفظ النظام بآخر 30 نسخة احتياطية فقط، ويتم حذف الأقدم تلقائياً.</li>
            <li>ينصح بتحميل نسخة احتياطية دورياً وتخزينها في مكان آمن خارج الجهاز.</li>
          </ul>
        </div>
      </Card>

      {/* Production Cleanup Section */}
      <Card className="!p-8 border-2 border-red-100 bg-red-50/30 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-[20px] flex items-center justify-center shadow-sm">
              <Trash2 size={28} />
            </div>
            <div>
              <h3 className="text-lg font-black text-red-900">تنظيف البيانات التجريبية (Production Cleanup)</h3>
              <p className="text-[11px] font-bold text-red-700/70">حذف كافة السجلات التي تم تمييزها كبيانات تجريبية أو اختبارية بأمان.</p>
            </div>
          </div>
          <Button 
            variant="danger" 
            className="h-14 px-8 !rounded-2xl shadow-xl shadow-red-200 hover:scale-105 transition-all"
            onClick={() => setShowCleanupModal(true)}
          >
            بدء عملية التنظيف
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white/50 rounded-2xl border border-red-100 flex items-center gap-3">
            <ShieldCheck className="text-emerald-600" size={18} />
            <span className="text-[10px] font-bold text-slate-600">حماية البيانات الحقيقية</span>
          </div>
          <div className="p-4 bg-white/50 rounded-2xl border border-red-100 flex items-center gap-3">
            <RotateCcw className="text-blue-600" size={18} />
            <span className="text-[10px] font-bold text-slate-600">عكس القيود المحاسبية</span>
          </div>
          <div className="p-4 bg-white/50 rounded-2xl border border-red-100 flex items-center gap-3">
            <AlertCircle className="text-amber-600" size={18} />
            <span className="text-[10px] font-bold text-slate-600">فحص سلامة الميزان</span>
          </div>
        </div>
      </Card>

      {/* Cleanup Confirmation Modal */}
      <Modal 
        isOpen={showCleanupModal} 
        onClose={() => setShowCleanupModal(false)} 
        title="تأكيد حذف البيانات التجريبية"
      >
        <div className="space-y-6 py-4 text-right" dir="rtl">
          <div className="p-6 bg-red-50 border border-red-100 rounded-[28px] flex gap-4">
            <AlertTriangle className="text-red-600 shrink-0" size={32} />
            <div className="space-y-2">
              <h4 className="text-sm font-black text-red-900">تحذير نهائي!</h4>
              <p className="text-[11px] font-bold text-red-800 leading-relaxed">
                سيتم حذف جميع الفواتير، السندات، والقيود المحاسبية التي تحمل علامة "تجريبي" أو تبدأ بـ "TEST-". هذه العملية لا يمكن التراجع عنها.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-black text-[#1E4D4D]">لتأكيد العملية، يرجى كتابة الرمز التالي:</p>
            <div className="p-4 bg-slate-100 rounded-2xl text-center font-mono font-black text-lg tracking-[0.5em] text-slate-600 select-none">
              DELETE-DEMO
            </div>
            <Input 
              placeholder="اكتب الرمز هنا..."
              value={cleanupConfirmText}
              onChange={e => setCleanupConfirmText(e.target.value)}
              className="text-center font-mono uppercase"
            />
          </div>

          <div className="flex gap-4">
            <Button 
              variant="danger" 
              className="flex-1 h-14 !rounded-2xl shadow-xl shadow-red-100"
              onClick={handleExecuteCleanup}
              isLoading={loading}
              disabled={cleanupConfirmText !== 'DELETE-DEMO'}
            >
              تأكيد الحذف النهائي
            </Button>
            <Button 
              variant="secondary" 
              className="flex-1 h-14 !rounded-2xl"
              onClick={() => setShowCleanupModal(false)}
            >
              إلغاء
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default BackupManagement;
