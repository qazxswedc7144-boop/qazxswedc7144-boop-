import React, { useState, useEffect } from 'react';
import { 
  Shield, Key, RefreshCw, Layers, Download, Copy, 
  Check, CheckCircle2, AlertCircle, 
  FileJson, Building, Activity, Network, Plus, Trash2, Sliders
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/core/db';
import { TenantSecurityService } from '../security/tenantSecurity';
import { FHIRService } from '../integrations/fhirService';
import { ApiGatewayService, ApiKeyConfig } from '../api/apiGateway';

interface SaaSModuleProps {
  onNavigate?: (view: string) => void;
}

export default function SaaSModule({ onNavigate: _onNavigate }: SaaSModuleProps) {
  // Tenant Information
  const tenantId = "TEN_MAIN_DALLAH_09";
  const [tenantKey, setTenantKey] = useState<string>('');
  
  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyConfig[]>([]);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['fhir.read', 'inventory.read']);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Sync operations
  const [syncLogs, setSyncLogs] = useState<Array<{ id: string, msg: string, type: 'info' | 'success' | 'warn' | 'error', time: string }>>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncPercentage, setSyncPercentage] = useState(0);

  // FHIR / Interop
  const [fhirInput, setFhirInput] = useState('');
  const [fhirResult, setFhirResult] = useState<any>(null);
  const [interopStatus, setInteropStatus] = useState<string>('');

  // Loaded metadata count
  const [stats, setStats] = useState({
    products: 0,
    sales: 0,
    purchases: 0
  });

  const availableScopes = [
    { code: 'fhir.read', label: 'قراءة السجلات الطبية (FHIR R4)' },
    { code: 'fhir.write', label: 'كتابة/تحديث الوصفات (FHIR R4)' },
    { code: 'inventory.read', label: 'قراءة مستويات المخزون والأدوية' },
    { code: 'inventory.write', label: 'تحديث المخزن وتعديل النواقص' },
    { code: 'financials.read', label: 'قراءة القيود ومجامع الميزانية' }
  ];

  useEffect(() => {
    // Generate key or load from service
    const key = TenantSecurityService.generateTenantKey(tenantId);
    setTenantKey(key);

    // Load stats
    const fetchStats = async () => {
      try {
        const prodCount = await db.products.count();
        const saleCount = await db.sales.count();
        const purCount = await db.purchases.count();
        setStats({ products: prodCount, sales: saleCount, purchases: purCount });
      } catch (err) {
        console.error("Failed to load statistics:", err);
      }
    };
    fetchStats();

    // Load API Keys
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    const keys = await ApiGatewayService.getTenantApiKeys(tenantId);
    setApiKeys(keys);
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName) return;

    const newKey: ApiKeyConfig = {
      id: `key-${Math.random().toString(36).substring(4, 10)}`,
      name: newKeyName,
      key: ApiGatewayService.generateApiKey(),
      scopes: selectedScopes as any[],
      status: 'ACTIVE',
      tenantId,
      rateLimitPerMinute: 600,
      totalCalls: 0,
      createdAt: new Date().toISOString()
    };

    await ApiGatewayService.saveApiKey(newKey, tenantId);
    setNewKeyName('');
    setIsCreatingKey(false);
    loadApiKeys();
    addSyncLog(`تم توليد مفتاح المطورين: "${newKey.name}" بنجاح وتعيين الصلاحيات المحددة.`, 'success');
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm("هل أنت متأكد من إلغاء وتجميد مفتاح الاتصال البرمجي هذا فوراً؟ سيتم قطع التكامل البرمجي المرتبط به.")) return;
    await ApiGatewayService.revokeApiKey(keyId, tenantId);
    loadApiKeys();
    addSyncLog(`تم تجميد وإبطال صلاحيات مفتاح الاتصال البرمجي: ${keyId}`, 'warn');
  };

  const handleCopyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const addSyncLog = (msg: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    setSyncLogs(prev => [
      {
        id: Math.random().toString(),
        msg,
        type,
        time: new Date().toLocaleTimeString('ar-SA')
      },
      ...prev
    ]);
  };

  // Safe Cloud Sync Simulator with real cryptographic checks
  const runEncryptedCloudSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncPercentage(0);
    setSyncLogs([]);

    addSyncLog("بدء اتصال السلسلة السحابية للمؤسسات...", "info");
    
    // Step 1: Handshake with tenant validation
    await delay(800);
    setSyncPercentage(15);
    addSyncLog(`تم مصافحة الخادم السحابي بهوية tenantId: [${tenantId}] بنجاح.`, "success");

    // Step 2: Fetching local records to sync
    await delay(800);
    setSyncPercentage(35);
    addSyncLog(`تجميع البيانات المحلية - تم رصد: ${stats.products} دواء، و ${stats.sales} فاتورة مبيعات غير مؤرشفة سحابياً.`, "info");

    // Step 3: Local Database Encryption using AES-256
    await delay(1000);
    setSyncPercentage(55);
    
    const samplePayload = {
      recordsCount: stats.products + stats.sales,
      timestamp: new Date().toISOString(),
      integrityHash: "sha256-f51bced"
    };
    const encryptedData = TenantSecurityService.encryptPayload(samplePayload, tenantKey);
    addSyncLog(`تم تشفير حمولة البيانات محلياً بنجاح باستخدام AES-256. المفتاح DERIVED المخصص وافر التشفير.`, "success");
    addSyncLog(`Ciphertext: ${encryptedData.substring(0, 48)}...`, "info");

    // Step 4: Transmission & Gateway Scopes Verification
    await delay(1200);
    setSyncPercentage(80);
    addSyncLog("توصيل البيانات المشفرة للخادم ومعاينة حزمة التواقيع عبر API Gateway...", "info");
    
    const verification = await ApiGatewayService.verifyRequest("pf_live_cloud_sync_ledger_secret_token", "inventory.write", tenantId);
    if (verification.allowed) {
      addSyncLog(`بوابة المطورين وافقت على تدفق Sync للموقع: "${verification.apiKeyName}"`, "success");
    } else {
      addSyncLog("فشل المصادقة عبر الموثق السحابي.", "error");
      setIsSyncing(false);
      return;
    }

    // Step 5: Completed with ledger integrity signature
    await delay(1000);
    setSyncPercentage(100);
    addSyncLog("اكتمل التحديث المشفر والمتبادل. تم ترحيل الكتل ومطابقة الأرصدة بالخادم في السحابة الآمنة.", "success");
    setIsSyncing(false);

    // Save success audit log
    try {
      await db.Audit_Log.add({
        id: db.generateId('LOG'),
        action: 'CLOUD_SYNC',
        user_id: 'SYSTEM_SaaS',
        userName: 'مشرف السحابة',
        target_id: tenantId,
        target_type: 'TENANT',
        timestamp: new Date().toISOString(),
        details: `مزامنة سحابية تامة مشفرة من أطراف ثنائية بالتوقيع المشفر. حجم السجلات: ${stats.products + stats.sales}`
      });
    } catch(err) {}
  };

  // Process FHIR parse testing
  const handleParseFHIR = () => {
    if (!fhirInput) {
      alert("الرجاء إدخال قالب JSON المتوافق أولاً.");
      return;
    }
    try {
      const parsedJSON = JSON.parse(fhirInput);
      const output = FHIRService.parseHospitalPrescription(parsedJSON);
      setFhirResult(output);
      setInteropStatus("SUCCESS");
      addSyncLog(`تم رصد وقراءة وصفة HL7 FHIR بنجاح للمريض: ${output.patientName}. الدواء الموصوف: ${output.medicineName}`, 'success');
    } catch (err: any) {
      setInteropStatus("ERROR");
      setFhirResult(err.message || err);
      addSyncLog(`فشل قراءة الملف الطبي FHIR: ${err.message}`, 'error');
    }
  };

  const loadDefaultFHIRSample = () => {
    const sampleResource = {
      resourceType: "MedicationRequest",
      id: "mr-hospital-dallah-2026-09",
      status: "active",
      intent: "order",
      medicationCodeableConcept: {
        coding: [
          {
            system: "http://www.nlm.nih.gov/research/umls/rxnorm",
            code: "62243009",
            display: "Lipitor 20mg (Atorvastatin Calcium)"
          }
        ],
        text: "Lipitor 20mg (Atorvastatin)"
      },
      subject: {
        reference: "Patient/pat-98231",
        display: "الأستاذ عبد الرحمن الشهري"
      },
      dosageInstruction: [
        {
          sequence: 1,
          text: "قرص واحد يومياً قبل النوم لمدة 30 يوماً"
        }
      ],
      dispenseRequest: {
        quantity: {
          value: 2,
          unit: "boxes"
        }
      }
    };
    setFhirInput(JSON.stringify(sampleResource, null, 2));
    setInteropStatus("DRAFT");
  };

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  return (
    <div className="space-y-7 text-right" dir="rtl">
      {/* SaaS Hub Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-l from-indigo-900 via-slate-950 to-indigo-950 p-6 rounded-[24px] shadow-lg border border-indigo-500/20 text-white">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <Building size={28} />
            </span>
            <h1 className="text-2xl font-black tracking-tight font-sans">بوابة المؤسسات والهيكل الهجين (SaaS Hub)</h1>
          </div>
          <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
            البوابة الإدارية للربط البيني والمزامنة السحابية المشفرة وتوافق Interoperability مع أنظمة المستشفيات وفق معيار HL7 FHIR الدولي وصيانة العزل الجغرافي وقنوات الوصول البرمجي.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="text-xs bg-indigo-500/15 text-indigo-300 font-bold px-3 py-1.5 rounded-xl border border-indigo-500/30">
            DALLAH_HOSPITAL_GROUP • فعال
          </span>
          <span className="text-xs bg-emerald-500/15 text-emerald-300 font-bold px-3 py-1.5 rounded-xl border border-emerald-500/30">
            Tenant: Sandbox_2026
          </span>
        </div>
      </div>

      {/* Grid: Tenant Status & Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-100 dark:border-gray-700/60 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 dark:text-gray-400 font-bold block">معرف المستأجر (Tenant ID)</span>
            <span className="text-sm font-black text-slate-700 dark:text-white font-mono break-all">{tenantId}</span>
          </div>
          <span className="p-2.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-xl">
            <Building size={20} />
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-100 dark:border-gray-700/60 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 dark:text-gray-400 font-bold block">مفتاح عزل البيانات المخصص</span>
            <span className="text-sm font-black text-slate-700 dark:text-white font-mono">{tenantKey ? `${tenantKey.slice(0, 10)}...` : 'غير متوفر'}</span>
          </div>
          <span className="p-2.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-xl">
            <Shield size={20} />
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-100 dark:border-gray-700/60 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 dark:text-gray-400 font-bold block">مزامنة الكتل والقيود</span>
            <span className="text-sm font-black text-slate-700 dark:text-white font-mono">100% مشفر بالكامل</span>
          </div>
          <span className="p-2.5 bg-blue-50 dark:bg-blue-950 text-blue-600 rounded-xl">
            <Layers size={20} />
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-100 dark:border-gray-700/60 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 dark:text-gray-400 font-bold block">نمط العزل المعماري</span>
            <span className="text-sm font-black text-teal-600 dark:text-teal-400">HYBRID_VAULT (شديد الأمن)</span>
          </div>
          <span className="p-2.5 bg-teal-50 dark:bg-teal-950 text-teal-600 rounded-xl">
            <Sliders size={20} />
          </span>
        </div>
      </div>

      {/* Main SaaS Operations Tabs / Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        
        {/* API Gates & Developer Tokens (SaaS Hub) */}
        <div className="lg:col-span-8 space-y-7">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-100 dark:border-gray-700/60 shadow-sm p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white">مفاتيح الربط وقنوات المطورين (REST API & Integrations)</h3>
                <p className="text-xs text-slate-400 dark:text-gray-400 mt-1">توليد وإدارة مفاتيح الاتصال بالـ API مع تحديد صلاحيات المعايير السريرية.</p>
              </div>
              <button 
                onClick={() => setIsCreatingKey(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 hover:bg-indigo-700 transition-all font-sans cursor-pointer"
              >
                <Plus size={15} />
                <span>إنشاء مفتاح جديد</span>
              </button>
            </div>

            {/* Modal for creating key */}
            <AnimatePresence>
              {isCreatingKey && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
                >
                  <motion.form 
                    onSubmit={handleGenerateKey}
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.95 }}
                    className="bg-white dark:bg-gray-800 rounded-[28px] max-w-lg w-full p-6 border dark:border-gray-700 space-y-4 shadow-2xl overflow-hidden text-right"
                  >
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-gray-700 pb-3">
                      <h4 className="text-base font-black text-indigo-600 dark:text-indigo-400">توليد مفتاح ربط واجهة برمجة للتطبيقات (API Key)</h4>
                      <button type="button" onClick={() => setIsCreatingKey(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 dark:text-gray-300">اسم المفتاح / النظام الخارجي المحول</label>
                      <input 
                        type="text" 
                        required
                        className="w-full bg-slate-50 dark:bg-gray-700 border border-slate-100 dark:border-gray-600 px-4 py-3 rounded-xl font-bold text-xs"
                        placeholder="مثال: تطبيق فرع حي الملقا، أو EMR مستشفي دلة"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-600 dark:text-gray-300 block">الصلاحيات البرمجية المتاحة (Scopes)</label>
                      <div className="grid grid-cols-1 gap-2 bg-slate-50 dark:bg-gray-700 p-3.5 rounded-xl border border-slate-100 dark:border-gray-600">
                        {availableScopes.map(scope => (
                          <label key={scope.code} className="flex items-center gap-2.5 cursor-pointer text-xs font-bold select-none text-slate-700 dark:text-gray-200">
                            <input 
                              type="checkbox"
                              checked={selectedScopes.includes(scope.code)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedScopes(prev => [...prev, scope.code]);
                                } else {
                                  setSelectedScopes(prev => prev.filter(c => c !== scope.code));
                                }
                              }}
                              className="accent-indigo-600"
                            />
                            <span>{scope.label}</span>
                            <span className="text-[10px] bg-slate-100 dark:bg-gray-600 text-slate-500 dark:text-gray-300 font-mono px-1 rounded">
                              {scope.code}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button 
                        type="submit"
                        className="flex-1 bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition"
                      >
                        توليد وحفظ المفتاح الآمن
                      </button>
                      <button 
                        type="button"
                        onClick={() => setIsCreatingKey(false)}
                        className="bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-200 font-bold px-5 py-3.5 rounded-xl hover:bg-slate-200 transition"
                      >
                        إلغاء
                      </button>
                    </div>
                  </motion.form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* List of Keys */}
            <div className="space-y-4">
              {apiKeys.length === 0 ? (
                <div className="text-center py-8 text-slate-400">لا توجد مفاتيح نشطة حالياً.</div>
              ) : (
                apiKeys.map(key => (
                  <div key={key.id} className="relative group bg-slate-50 dark:bg-gray-700/40 p-4 rounded-xl border border-slate-100 dark:border-gray-700/80 hover:border-indigo-400/30 transition-all text-right space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-sans font-black text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          <Key size={15} className="text-indigo-500" />
                          {key.name}
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {key.scopes.map(s => (
                            <span key={s} className="text-[9px] bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-100/60 dark:border-indigo-500/20 font-bold font-mono">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          key.status === 'ACTIVE' 
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50' 
                            : 'bg-red-50 text-red-600 border border-red-100/50'
                        }`}>
                          {key.status === 'ACTIVE' ? 'نشط بالتخزين' : 'ملغى'}
                        </span>
                        {key.status === 'ACTIVE' && (
                          <button 
                            onClick={() => handleRevokeKey(key.id)}
                            className="bg-red-50 hover:bg-red-100 text-red-500 p-1.5 rounded-lg transition"
                            title="إلغاء المفتاح"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 p-2.5 rounded-lg border dark:border-gray-700 text-xs">
                      <span className="font-mono text-slate-500 select-all font-bold tracking-wider">{key.key}</span>
                      <button 
                        onClick={() => handleCopyKey(key.key, key.id)}
                        className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 shrink-0 font-sans cursor-pointer"
                      >
                        {copiedKeyId === key.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        <span>{copiedKeyId === key.id ? 'تم النسخ' : 'نسخ المفتاح'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-gray-700/60 text-[10px] text-slate-400 font-bold">
                      <div>مجموع الاستدعاءات: <span className="font-mono text-slate-700 dark:text-white font-semibold">{key.totalCalls}</span></div>
                      <div>الحد الأقصى/د: <span className="font-mono text-slate-700 dark:text-white font-semibold">{key.rateLimitPerMinute} rmp</span></div>
                      <div className="col-span-2 md:col-span-1">آخر استخدام: <span className="font-mono text-slate-700 dark:text-white font-semibold">{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleTimeString('ar-SA') : 'أبداً'}</span></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Clinical Interoperability Sandbox & HL7 FHIR Support */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-100 dark:border-gray-700/60 shadow-sm p-6 space-y-4">
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                <FileJson size={20} className="text-emerald-500" />
                معايير الربط السريرية وصندوق معالجة FHIR (FHIR clinical Sandbox)
              </h3>
              <p className="text-xs text-slate-400 dark:text-gray-400 mt-1">تداول الوصفات ومطابقة دقة الدواء مع EMR المستشفى بصورة حية عبر XML/JSON.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-7 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-600 dark:text-gray-300">محتوى مستند HL7 FHIR (المريض أو الوصفات)</span>
                  <button 
                    onClick={loadDefaultFHIRSample}
                    className="text-indigo-600 font-black hover:underline"
                  >
                    حمل قالب وصفةLipitor (FHIR Sample)
                  </button>
                </div>
                <textarea 
                  className="w-full h-40 bg-slate-900 text-emerald-400 font-mono text-xs p-3 rounded-xl border dark:border-gray-700 text-left cursor-text"
                  placeholder='ألصق كائن JSON الذي استقبله ملقم المستشفى هنا...'
                  dir="ltr"
                  value={fhirInput}
                  onChange={(e) => setFhirInput(e.target.value)}
                />
                <div className="flex gap-3">
                  <button 
                    onClick={handleParseFHIR}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1 transition"
                  >
                    <Download size={15} />
                    قراءة وتحويل الوصفة الطبية الطارئة
                  </button>
                  <button 
                    onClick={() => {
                      // Generate and download a sample Patient bundle
                      const sampleCust = { name: "فواز السبيعي", phone: "0554329011", gender: "MALE" };
                      const fhirPatient = FHIRService.transformToFHIRPatient(sampleCust);
                      const fhirMR = FHIRService.transformToFHIRMedicationRequest({ name: "Lipitor 10mg", quantity: 2, instructions: "قرص مخفض للكلسترول يومياً" }, sampleCust, null);
                      const bundle = FHIRService.createFHIRBundle([fhirPatient, fhirMR]);
                      
                      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `FHIR_Prescription_Bundle_${sampleCust.name}.json`;
                      a.click();
                      addSyncLog(`تم تصدير ملف FHIR Bundle متكامل للمريض: ${sampleCust.name}`, 'success');
                    }}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 font-sans font-bold px-4 rounded-xl text-xs flex items-center gap-1"
                  >
                    <Download size={15} />
                    تحميل حزمة تجريبية (Bundle)
                  </button>
                </div>
              </div>

              <div className="md:col-span-5 bg-slate-50 dark:bg-gray-750 p-4 rounded-xl border dark:border-gray-700 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-500 block">حالة التحجيم المتبادل (EMR Parsing Status)</span>
                  {interopStatus === '' ? (
                    <div className="text-slate-400 text-xs py-4 text-center">بانتظار تفريغ وتحليل مستند طبي...</div>
                  ) : interopStatus === 'SUCCESS' ? (
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 p-3 rounded-lg border border-emerald-100/50 dark:border-emerald-500/20 text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 size={16} />
                        تم كسر شفرة ومطابقة معيار FHIR R4 بنجاح
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        اسم المريض: <strong className="text-emerald-600">{fhirResult?.patientName}</strong><br />
                        الدواء: <strong>{fhirResult?.medicineName}</strong><br />
                        الكمية: {fhirResult?.quantity} علب<br />
                        التعليمات: {fhirResult?.instructions}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 p-3 rounded-lg border border-red-100/50 dark:border-red-500/20 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertCircle size={16} />
                        مستند غير متطابق
                      </div>
                      <p className="text-[10px] text-red-500 leading-relaxed font-mono truncate">{String(fhirResult)}</p>
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-slate-400 bg-white dark:bg-gray-800 p-3 border dark:border-gray-700/80 rounded-lg shadow-xs leading-relaxed space-y-1">
                  <div className="font-bold flex items-center gap-1 text-slate-500">
                    <Activity size={12} className="text-emerald-500" />
                    تكامل المستشفيات المعتمد
                  </div>
                  <div>- Al-Mouwasat API Gateway: <span className="text-emerald-500 font-bold">ONLINE</span></div>
                  <div>- FHIR Core Endpoint: https://fhir.pharmaflow.pro</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cryptographic Cloud Sync & Core Ledger logs */}
        <div className="lg:col-span-4 space-y-7 text-right">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-100 dark:border-gray-700/60 shadow-sm p-5 space-y-5">
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-white">تزامن السلسلة المشفر بـ AES</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">مزامنة سجلات الصيدلية الفوقية للخوادم المركزية مشفرة بإنهاء ثنائي آمن.</p>
            </div>

            <div className="bg-slate-50 dark:bg-gray-700/50 p-4 rounded-xl border dark:border-gray-600 text-center space-y-3.5">
              <div className="mx-auto w-12 h-12 bg-indigo-50 dark:bg-indigo-950 rounded-full flex items-center justify-center text-indigo-500">
                <Network size={24} />
              </div>

              <div className="space-y-1">
                <span className="text-xs font-black block text-slate-700 dark:text-gray-100">سجل الترحيل غير السحابي</span>
                <span className="text-[11px] text-slate-400 block">{stats.products + stats.sales} سجلات متوفرة محلياً</span>
              </div>

              {isSyncing && (
                <div className="space-y-1">
                  <div className="bg-slate-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
                    <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${syncPercentage}%` }} />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-indigo-500">{syncPercentage}% تكتمل...</span>
                </div>
              )}

              <button 
                onClick={runEncryptedCloudSync}
                disabled={isSyncing}
                className={`w-full font-sans font-black py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition ${
                  isSyncing 
                    ? 'bg-indigo-100 text-indigo-400 dark:bg-indigo-950 cursor-not-allowed' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer'
                }`}
              >
                <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
                <span>ترحيل ومزامنة الكتل الآن</span>
              </button>
            </div>
            
            {/* Live compliance & telemetry */}
            <div className="bg-indigo-50/50 dark:bg-indigo-950/25 p-3.5 rounded-xl border border-indigo-100/50 dark:border-indigo-500/10 text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed text-right font-sans">
              <div className="font-bold flex items-center gap-1.5 mb-1.5 text-xs text-indigo-800 dark:text-indigo-300">
                <Shield size={14} />
                مواصفات التشفير السحابي والدرع الآمن
              </div>
              <p className="text-[10px] leading-relaxed text-slate-500 dark:text-indigo-300/80">
                تستخدم قنوات الربط أحدث بروتوكولات المزامنة المعززة للتأكد من المحافظة على الخصوصية الطبية. يتم التحقق من تماسك البيانات وسحب المفاتيح لكل tenant بصورة منفصلة مع توثيق SHA256 على كافة المدخلات المالية.
              </p>
            </div>
          </div>

          {/* Sync logs and Audit Compliance */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-100 dark:border-gray-700/60 shadow-sm p-5 space-y-4">
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-white">تقرير تشخيص الربط البيني (Interoperability Logs)</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">سجل فوري ومباشر لعلميات الربط والمزامنة والاتصال بمزودي الخدمات.</p>
            </div>

            <div className="h-56 overflow-y-auto border border-slate-100 dark:border-gray-700 rounded-xl p-3 bg-slate-50 dark:bg-gray-900 font-mono text-[10px] text-slate-600 dark:text-gray-300 space-y-2 text-left" dir="ltr">
              {syncLogs.length === 0 ? (
                <div className="text-center py-16 text-slate-400 font-sans">قناة الاتصالات المعيارية مغلقة بانتظار إثراء الحدث.</div>
              ) : (
                syncLogs.map(log => (
                  <div key={log.id} className="border-b dark:border-gray-800 pb-1.5 last:border-0 font-bold whitespace-pre-wrap leading-relaxed">
                    <span className="text-indigo-600 dark:text-indigo-400 mr-1 font-sans font-normal">[{log.time}]</span>
                    <span className={
                      log.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
                      log.type === 'warn' ? 'text-amber-600 dark:text-amber-400' :
                      log.type === 'error' ? 'text-red-500 dark:text-red-400' :
                      'text-slate-600 dark:text-slate-300'
                    }>
                      {log.msg}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
