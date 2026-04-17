
import React, { useState, useEffect } from 'react';
import { db } from '../services/database';
import { integrationService } from '../services/integration.service';
import { BankAccount, PaymentGateway, BankTransaction, Account, WebhookConfig } from '../types';
import { Card, Button, Input, Modal, Badge } from './SharedUI';
import { Home } from 'lucide-react';

interface IntegrationsModuleProps {
  onNavigate?: (view: any) => void;
}

const IntegrationsModule: React.FC<IntegrationsModuleProps> = ({ onNavigate }) => {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'banks' | 'payments' | 'accounting' | 'webhooks'>('banks');
  const [internalAccounts, setInternalAccounts] = useState<Account[]>([]);
  
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([
    { id: 'wh-1', url: 'https://central-erp-system.com/webhooks/pharma', secret: '*****', events: ['sale_created', 'inventory_low'], isActive: true }
  ]);

  useEffect(() => {
    const loadData = async () => {
      setBankAccounts(await db.getBankAccounts());
      setGateways(await db.getPaymentGateways());
      setTransactions(await db.getBankTransactions());
      setInternalAccounts(await db.getAccounts());
    };
    loadData();
  }, []);

  const handleBankSync = async (id: string) => {
    setIsSyncing(true);
    try {
      await integrationService.syncBankTransactions(id);
      setTransactions(await db.getBankTransactions());
      setBankAccounts(await db.getBankAccounts());
      alert("✅ تمت مزامنة الحركات البنكية بنجاح!");
    } catch (e) {
      alert("❌ فشلت المزامنة. يرجى التحقق من بيانات الربط.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleGateway = (id: string) => {
    const list = [...gateways];
    const idx = list.findIndex(g => g.id === id);
    if (idx > -1) {
      list[idx].isActive = !list[idx].isActive;
      db.savePaymentGateway(list[idx]);
      setGateways(list);
    }
  };

  const handleAccountingExport = (system: any) => {
    integrationService.exportForAccountingSystem(system);
  };

  return (
    <div className="space-y-8 pb-32 text-right px-4 md:px-8 animate-in fade-in duration-500" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-[#1E4D4D] text-white rounded-[24px] flex items-center justify-center text-3xl shadow-xl">🔌</div>
          <div>
            <h2 className="text-3xl font-black text-[#1E4D4D]">مركز التكامل الإلكتروني</h2>
            <p className="text-slate-400 font-bold text-sm">أتمتة العمليات المالية والربط مع المنصات العالمية</p>
          </div>
        </div>
        <button onClick={() => onNavigate?.('dashboard')} className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-[#1E4D4D] shadow-sm hover:bg-slate-50 transition-colors">
          <Home size={24} />
        </button>
      </div>

      <div className="flex p-1.5 bg-white border border-slate-100 rounded-[32px] shadow-sm w-fit overflow-x-auto no-scrollbar shrink-0">
        <button onClick={() => setActiveTab('banks')} className={`px-8 py-3.5 rounded-2xl text-[10px] sm:text-xs font-black transition-all whitespace-nowrap ${activeTab === 'banks' ? 'bg-[#1E4D4D] text-white shadow-xl' : 'text-slate-400'}`}>البنوك</button>
        <button onClick={() => setActiveTab('payments')} className={`px-8 py-3.5 rounded-2xl text-[10px] sm:text-xs font-black transition-all whitespace-nowrap ${activeTab === 'payments' ? 'bg-[#1E4D4D] text-white shadow-xl' : 'text-slate-400'}`}>المدفوعات</button>
        <button onClick={() => setActiveTab('accounting')} className={`px-8 py-3.5 rounded-2xl text-[10px] sm:text-xs font-black transition-all whitespace-nowrap ${activeTab === 'accounting' ? 'bg-[#1E4D4D] text-white shadow-xl' : 'text-slate-400'}`}>الأنظمة المحاسبية</button>
        <button onClick={() => setActiveTab('webhooks')} className={`px-8 py-3.5 rounded-2xl text-[10px] sm:text-xs font-black transition-all whitespace-nowrap ${activeTab === 'webhooks' ? 'bg-[#1E4D4D] text-white shadow-xl' : 'text-slate-400'}`}>Webhooks / ERP</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {activeTab === 'banks' && (
          <>
            <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm space-y-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-black text-[#1E4D4D]">الحسابات البنكية المتصلة</h3>
                <Button variant="secondary" size="sm" onClick={() => setIsModalOpen(true)}>ربط حساب جديد +</Button>
              </div>
              <div className="space-y-4">
                {bankAccounts.map(acc => (
                  <div key={acc.id} className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-xl transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm">🏦</div>
                      <div>
                        <h4 className="font-black text-[#1E4D4D]">{acc.bankName}</h4>
                        <p className="text-[10px] text-slate-400 font-bold">{acc.accountNumber}</p>
                        <Badge variant={acc.status === 'connected' ? 'success' : 'danger'}>{acc.status === 'connected' ? 'متصل' : 'خطأ'}</Badge>
                      </div>
                    </div>
                    <button onClick={() => handleBankSync(acc.id)} disabled={isSyncing} className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-[#1E4D4D] shadow-sm hover:rotate-180 transition-transform">
                      {isSyncing ? '⌛' : '🔄'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <Card className="bg-[#1E4D4D] text-white space-y-6 shadow-2xl relative overflow-hidden flex flex-col justify-center">
               <div className="relative z-10 text-center space-y-4">
                  <span className="text-6xl block mb-2">⚡</span>
                  <h3 className="text-2xl font-black">أتمتة المطابقة البنكية</h3>
               </div>
            </Card>
          </>
        )}

        {activeTab === 'payments' && (
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {[
               { id: 'pay_stripe', name: 'Stripe API', icon: '💳', color: 'bg-indigo-600', desc: 'قبول البطاقات الائتمانية والدفع الرقمي العالمي' },
               { id: 'pay_paypal', name: 'PayPal Commerce', icon: '🅿️', color: 'bg-blue-500', desc: 'تفعيل الدفع عبر رصيد باي بال والمحافظ الإلكترونية' },
               { id: 'pay_mpesa', name: 'M-Pesa Gateway', icon: '📱', color: 'bg-emerald-600', desc: 'حلول الدفع عبر الموبايل للسوق الإفريقي والمحلي' },
               { id: 'pay_qr', name: 'Smart QR System', icon: '🔳', color: 'bg-slate-900', desc: 'إنشاء رموز QR مخصصة للدفع المباشر في الصيدلية' }
             ].map(gw => {
               const isActive = gateways.find(g => g.name === gw.name)?.isActive || false;
               return (
                <div key={gw.id} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-4 hover:shadow-xl transition-all border-b-8 border-b-slate-50 hover:border-b-[#1E4D4D]">
                   <div className={`w-20 h-20 ${gw.color} text-white rounded-[28px] flex items-center justify-center text-4xl shadow-xl`}>{gw.icon}</div>
                   <div>
                     <h4 className="text-lg font-black text-[#1E4D4D]">{gw.name}</h4>
                     <p className="text-[10px] text-slate-400 font-bold leading-relaxed mt-2">{gw.desc}</p>
                   </div>
                   <Button 
                    variant={isActive ? 'danger' : 'primary'}
                    className="w-full"
                    onClick={() => {
                      const existing = gateways.find(g => g.name === gw.name);
                      if (existing) handleToggleGateway(existing.id);
                      else {
                        db.savePaymentGateway({ id: db.generateId('GW'), name: gw.name, provider: 'BankTransfer', isActive: true, config: {} });
                        db.getPaymentGateways().then(setGateways);
                      }
                    }}
                   >
                     {isActive ? 'تعطيل الربط ✕' : 'تفعيل البوابة ✓'}
                   </Button>
                </div>
               );
             })}
          </div>
        )}

        {activeTab === 'accounting' && (
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
             <Card className="flex flex-col items-center text-center p-10 space-y-6">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center">
                   <img src="https://cdn.worldvectorlogo.com/logos/quickbooks.svg" alt="QuickBooks" className="w-16 h-16 grayscale opacity-50" />
                </div>
                <div>
                   <h4 className="text-xl font-black text-[#1E4D4D]">QuickBooks Online</h4>
                   <p className="text-xs text-slate-400 font-bold mt-2 leading-relaxed">تصدير قيود اليومية بنسق متوافق مع نظام كويك بوكس.</p>
                </div>
                <Button variant="secondary" className="w-full" onClick={() => handleAccountingExport('QuickBooks')}>تصدير بصيغة CSV 📥</Button>
             </Card>

             <Card className="flex flex-col items-center text-center p-10 space-y-6">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center">
                   <img src="https://cdn.worldvectorlogo.com/logos/xero-1.svg" alt="Xero" className="w-16 h-16 grayscale opacity-50" />
                </div>
                <div>
                   <h4 className="text-xl font-black text-[#1E4D4D]">Xero Accounting</h4>
                   <p className="text-xs text-slate-400 font-bold mt-2 leading-relaxed">تصدير المبيعات والمشتريات مباشرة لنظام Xero.</p>
                </div>
                <Button variant="secondary" className="w-full" onClick={() => handleAccountingExport('Xero')}>تصدير بصيغة CSV 📥</Button>
             </Card>
          </div>
        )}

        {activeTab === 'webhooks' && (
          <div className="lg:col-span-2 space-y-8">
             <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                   <h3 className="text-xl font-black text-[#1E4D4D]">إشعارات الـ Webhooks (ERP Bridge)</h3>
                   <Button variant="secondary" size="sm">رابط جديد +</Button>
                </div>
                <div className="space-y-4">
                   {webhooks.map(wh => (
                     <div key={wh.id} className="p-5 bg-slate-50 border border-slate-100 rounded-[28px] flex items-center justify-between">
                        <div className="flex items-center gap-4 min-w-0">
                           <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl">🚀</div>
                           <div className="min-w-0">
                              <p className="text-[10px] font-black text-[#1E4D4D] truncate">{wh.url}</p>
                           </div>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntegrationsModule;
