
import React, { useState, useEffect } from 'react';
import { db } from '../services/database';
import { BackupService } from '../services/backupService';
import { SystemBackup } from '../types';
import { 
  Database, Download, RotateCcw, ShieldCheck, 
  History, AlertTriangle, CheckCircle2, XCircle,
  FileJson, Lock, Shield, Search, Trash2, AlertCircle
} from 'lucide-react';
import { Card, Button, Badge, Modal, Input } from './SharedUI';
import { useUI } from '../store/AppContext';
import { authService } from '../services/auth.service';
import { ProductionCleanupService } from '../services/ProductionCleanupService';

import { Cloud, CloudOff, RefreshCw, Upload } from 'lucide-react';
import { GoogleDriveService } from '../services/GoogleDriveService';

const BackupManagement: React.FC = () => {
  const [backups, setBackups] = useState<SystemBackup[]>([]);
  const [loading, setLoading] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupConfirmText, setCleanupConfirmText] = useState('');
  const { addToast, refreshGlobal } = useUI();
  const user = authService.getCurrentUser();

  useEffect(() => {
    loadBackups();
    // Initialize Google Drive Service
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (clientId) {
      GoogleDriveService.init(clientId).catch(console.error);
    }
  }, []);

  const handleGoogleConnect = async () => {
    try {
      setLoading(true);
      await GoogleDriveService.authenticate();
      setIsGoogleConnected(true);
      addToast('تم ربط حساب Google Drive بنجاح ✅', 'success');
    } catch (error: any) {
      addToast(`فشل الربط: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSync = async () => {
    try {
      setLoading(true);
      const password = window.prompt('يرجى إدخال كلمة مرور التشفير للنسخة الاحتياطية:');
      if (!password) return;

      const blob = await BackupService.exportBackupToFile(password);
      const fileName = `PharmaFlow_Backup_${new Date().toISOString().split('T')[0]}.enc`;
      await GoogleDriveService.uploadFile(blob, fileName);
      addToast('تم رفع النسخة الاحتياطية إلى Google Drive بنجاح ✅', 'success');
    } catch (error: any) {
      addToast(`فشل المزامنة: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadBackups = async () => {
    const data = await db.db.systemBackups.orderBy('createdAt').reverse().toArray();
    setBackups(data);
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
      await BackupService.importBackupFromFile(file, password);
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
        <Card className="md:col-span-2 !p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-none shadow-xl relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center md:text-right">
                <h3 className="text-xl font-black flex items-center gap-2 justify-center md:justify-start">
                  <Shield className="text-emerald-400" /> نظام النسخ الاحتياطي المتقدم
                </h3>
                <p className="text-slate-400 text-xs font-bold">
                  حماية بياناتك هي أولويتنا. يتم تشفير كافة النسخ باستخدام AES-GCM (Web Crypto).
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button 
                  variant="approve" 
                  className="h-14 px-8 !rounded-2xl shadow-emerald-500/20 shadow-2xl hover:scale-105 transition-all"
                  onClick={handleManualBackup}
                  isLoading={loading}
                >
                  <Database className="ml-2" size={20} /> إنشاء نسخة
                </Button>
                <Button 
                  variant="secondary" 
                  className="h-14 px-6 !rounded-2xl bg-slate-700 text-white border-none hover:bg-slate-600"
                  onClick={handleExportEncrypted}
                  isLoading={loading}
                >
                  <Download className="ml-2" size={20} /> تصدير .enc
                </Button>
                <label className="cursor-pointer">
                  <input type="file" accept=".enc" className="hidden" onChange={handleImportEncrypted} />
                  <div className="h-14 px-6 !rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold hover:bg-blue-500 transition-all shadow-lg">
                    <Upload className="ml-2" size={20} /> استيراد .enc
                  </div>
                </label>
              </div>
            </div>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl"></div>
        </Card>

        <Card className="!p-6 flex flex-col items-center justify-center text-center space-y-3 bg-blue-50 border-blue-100">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${isGoogleConnected ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
            {isGoogleConnected ? <Cloud size={24} /> : <CloudOff size={24} />}
          </div>
          <div>
            <h4 className="text-sm font-black text-[#1E4D4D]">المزامنة السحابية</h4>
            <p className="text-[10px] text-blue-700 font-bold mb-2">
              {isGoogleConnected ? 'متصل بجوجل درايف' : 'غير متصل بالسحابة'}
            </p>
            {isGoogleConnected ? (
              <Button 
                size="sm" 
                variant="secondary" 
                className="h-8 text-[10px] !rounded-lg w-full"
                onClick={handleGoogleSync}
                isLoading={loading}
              >
                <RefreshCw size={12} className="ml-1" /> مزامنة الآن
              </Button>
            ) : (
              <Button 
                size="sm" 
                variant="primary" 
                className="h-8 text-[10px] !rounded-lg w-full"
                onClick={handleGoogleConnect}
              >
                ربط الحساب
              </Button>
            )}
          </div>
        </Card>
      </div>

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
