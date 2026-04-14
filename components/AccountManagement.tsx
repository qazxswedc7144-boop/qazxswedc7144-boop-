
import React, { useState, useEffect } from 'react';
import { db } from '../services/database';
import { Account, AccountType } from '../types';

interface AccountManagementProps {
  onNavigate?: (view: any) => void;
}

const AccountManagement: React.FC<AccountManagementProps> = ({ onNavigate }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Partial<Account> | null>(null);

  useEffect(() => {
    setAccounts(db.getAccounts());
  }, []);

  const handleSave = async () => {
    if (!editingAccount?.name || !editingAccount?.code || !editingAccount?.type) return;
    
    const account: Account = {
      id: editingAccount.id || db.generateId('ACC'),
      code: editingAccount.code,
      name: editingAccount.name,
      type: editingAccount.type as AccountType,
      balance_type: (editingAccount.type === 'REVENUE' || editingAccount.type === 'LIABILITY' || editingAccount.type === 'EQUITY') ? 'CREDIT' : 'DEBIT',
      description: editingAccount.description || '',
      isSystem: editingAccount.isSystem || false,
      isActive: editingAccount.isActive !== undefined ? editingAccount.isActive : true,
      balance: editingAccount.balance || 0,
      debit: editingAccount.debit || 0,
      credit: editingAccount.credit || 0,
      updatedAt: new Date().toISOString()
    };

    await db.saveAccount(account);
    setAccounts(db.getAccounts());
    setIsModalOpen(false);
    setEditingAccount(null);
  };

  const getTypeLabel = (type: AccountType) => {
    const labels: Record<AccountType, string> = {
      ASSET: 'أصول',
      LIABILITY: 'خصوم',
      EQUITY: 'حقوق ملكية',
      REVENUE: 'إيرادات',
      EXPENSE: 'مصروفات'
    };
    return labels[type];
  };

  const getTypeColor = (type: AccountType) => {
    const colors: Record<AccountType, string> = {
      ASSET: 'bg-emerald-50 text-emerald-600',
      LIABILITY: 'bg-red-50 text-red-600',
      EQUITY: 'bg-blue-50 text-blue-600',
      REVENUE: 'bg-amber-50 text-amber-600',
      EXPENSE: 'bg-slate-50 text-slate-600'
    };
    return colors[type];
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500" dir="rtl">
      <div className="flex items-center justify-between bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#1E4D4D] text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg">⚖️</div>
          <div>
            <h2 className="text-2xl font-black text-[#1E4D4D]">الدليل المحاسبي</h2>
            <p className="text-xs font-bold text-slate-400">إدارة شجرة الحسابات العامة للصيدلية</p>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={() => { setEditingAccount({ type: 'EXPENSE', isActive: true }); setIsModalOpen(true); }} className="bg-[#1E4D4D] text-white px-6 py-3 rounded-2xl font-black text-xs shadow-lg hover:scale-105 transition-all">➕ إضافة حساب</button>
           <button onClick={() => onNavigate?.('dashboard')} className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-[#1E4D4D] text-xl font-black shadow-sm hover:bg-slate-50 transition-colors">➦</button>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-[#F8FAFA] text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
              <tr>
                <th className="px-8 py-5">رمز الحساب</th>
                <th className="px-8 py-5">اسم الحساب</th>
                <th className="px-8 py-5">النوع</th>
                <th className="px-8 py-5">الحالة</th>
                <th className="px-8 py-5">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {accounts.sort((a,b) => a.code.localeCompare(b.code)).map(account => (
                <tr key={account.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5 font-mono text-xs text-slate-400">{account.code}</td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-black text-[#1E4D4D]">{account.name}</p>
                    <p className="text-[10px] text-slate-300 truncate max-w-xs">{account.description || 'لا يوجد وصف'}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black ${getTypeColor(account.type)}`}>
                      {getTypeLabel(account.type)}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`w-2 h-2 rounded-full inline-block mr-2 ${account.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                    <span className="text-[10px] font-bold text-slate-500">{account.isActive ? 'نشط' : 'معطل'}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingAccount(account); setIsModalOpen(true); }} className="text-xs font-black text-blue-600 hover:underline">تعديل</button>
                      {!account.isSystem && (
                        <button onClick={async () => { if(confirm('حذف الحساب؟')) { await db.deleteAccount(account.id); setAccounts(db.getAccounts()); } }} className="text-xs font-black text-red-500 hover:underline">حذف</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-[340px] rounded-[32px] p-6 space-y-1 shadow-2xl animate-in zoom-in duration-200">
             <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                <h3 className="text-sm font-black text-[#1E4D4D]">{editingAccount?.id ? 'تعديل حساب' : 'إضافة حساب'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500">✕</button>
             </div>
             
             <div className="space-y-1 py-2">
                <div className="grid grid-cols-2 gap-1">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mr-1">رمز الحساب</label>
                    <input className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold" value={editingAccount?.code || ''} onChange={e => setEditingAccount({...editingAccount, code: e.target.value})} placeholder="مثلاً: 5103" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mr-1">النوع</label>
                    <select className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold appearance-none" value={editingAccount?.type || 'EXPENSE'} onChange={e => setEditingAccount({...editingAccount, type: e.target.value as AccountType})}>
                      <option value="ASSET">أصول</option>
                      <option value="LIABILITY">خصوم</option>
                      <option value="EQUITY">حقوق ملكية</option>
                      <option value="REVENUE">إيرادات</option>
                      <option value="EXPENSE">مصروفات</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mr-1">اسم الحساب</label>
                  <input className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold" value={editingAccount?.name || ''} onChange={e => setEditingAccount({...editingAccount, name: e.target.value})} placeholder="مثلاً: مصاريف الصيانة" />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mr-1">وصف إضافي</label>
                  <textarea className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold h-16" value={editingAccount?.description || ''} onChange={e => setEditingAccount({...editingAccount, description: e.target.value})} placeholder="اختياري..." />
                </div>

                <div className="flex items-center gap-2 px-2 pt-1">
                   <input type="checkbox" id="isActive" checked={editingAccount?.isActive} onChange={e => setEditingAccount({...editingAccount, isActive: e.target.checked})} className="w-4 h-4 rounded border-slate-300 text-[#1E4D4D]" />
                   <label htmlFor="isActive" className="text-[10px] font-bold text-slate-500">حساب نشط ومتاح</label>
                </div>
             </div>

             <div className="pt-1 flex gap-1">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-400 font-black text-xs hover:bg-slate-50 rounded-xl">إلغاء</button>
                <button onClick={handleSave} className="flex-1 bg-[#1E4D4D] text-white py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">حفظ ✅</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountManagement;
