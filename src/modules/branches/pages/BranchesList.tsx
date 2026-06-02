// src/modules/branches/pages/BranchesList.tsx

import React, { useState, useEffect } from 'react';
import { BranchService } from '../services/BranchService';
import { Branch, BranchSettings } from '@/types';
import { useUI } from '@/contexts/AppContext';
import { 
  Building2, MapPin, Phone, Sliders, 
  Plus, Search, Edit2, RotateCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const BranchesList: React.FC<{ onNavigate?: (view: string) => void }> = ({ onNavigate: _onNavigate }) => {
  const { addToast } = useUI();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals / Editors state
  const [isEditing, setIsEditing] = useState(false);
  const [currentBranch, setCurrentBranch] = useState<Partial<Branch> | null>(null);
  
  const [isConfiguringSettings, setIsConfiguringSettings] = useState(false);
  const [selectedSettings, setSelectedSettings] = useState<BranchSettings | null>(null);

  const fetchBranches = async () => {
    setIsLoading(true);
    try {
      const data = await BranchService.getBranches();
      setBranches(data);
    } catch (e) {
      addToast("خطأ أثناء جلب الفروع", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBranch?.name || !currentBranch?.code) {
      addToast("يرجى إدخال اسم ورمز الفرع", "warning");
      return;
    }
    try {
      await BranchService.saveBranch(currentBranch);
      addToast("تم حفظ الفرع بنجاح", "success");
      setIsEditing(false);
      setCurrentBranch(null);
      fetchBranches();
    } catch {
      addToast("فشل حفظ الفرع", "error");
    }
  };

  const handleConfigureSettings = async (branchId: string) => {
    try {
      const settings = await BranchService.getBranchSettings(branchId);
      setSelectedSettings(settings);
      setIsConfiguringSettings(true);
    } catch {
      addToast("خطأ أثناء جلب إعدادات الفرع", "error");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSettings) return;
    try {
      await BranchService.saveBranchSettings(selectedSettings);
      addToast("تم تحديث خيارات التنبيهات وإعادة الطلب بنجاح", "success");
      setIsConfiguringSettings(false);
      setSelectedSettings(null);
    } catch {
      addToast("فشل تحديث إعدادات الفرع", "error");
    }
  };

  const filteredBranches = branches.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.location || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-[#1E4D4D] to-[#123131] rounded-[32px] p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/[0.03] rounded-full -mr-16 -mt-16 pointer-events-none" />
        <div className="absolute left-10 bottom-0 w-32 h-32 bg-white/[0.02] rounded-full pointer-events-none" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/10 rounded-2xl">
                <Building2 className="text-emerald-400" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-black">إدارة فروع المؤسسة</h1>
                <p className="text-[11px] text-emerald-300 font-bold mt-1">إدارة شاملة للمخازن والتحويلات البينية مع عزل كامل للصلاحيات</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              onClick={() => {
                setCurrentBranch({
                  code: '',
                  name: '',
                  location: '',
                  phone: '',
                  isActive: true
                });
                setIsEditing(true);
              }}
              className="flex-1 md:flex-initial bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-6 py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              <span>إضافة فرع جديد</span>
            </button>
            <button 
              onClick={fetchBranches}
              className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"
            >
              <RotateCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Control Actions Row */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="ابحث بالاسم، الرمز، أو العنوان..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-11 py-3 text-sm bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-[#1E4D4D] text-black"
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        </div>
        <div className="text-[11px] font-black text-slate-400 uppercase tracking-wide">
          الفروع النشطة: {branches.filter(b => b.isActive).length} من أصل {branches.length}
        </div>
      </div>

      {/* Grid List */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="bg-white rounded-[32px] p-12 text-center border border-slate-100 shadow-md">
          <Building2 className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-500 font-bold">لا توجد فروع لمطابقة البحث</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBranches.map((branch) => (
            <motion.div
              layout
              key={branch.id}
              className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-md hover:shadow-xl transition-all relative overflow-hidden"
            >
              {/* Card Decoration */}
              <div className="absolute left-0 top-0 w-2 h-full bg-[#1E4D4D]" />
              
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">
                    {branch.code}
                  </span>
                  <h3 className="text-base font-black text-slate-800 mt-2">{branch.name}</h3>
                </div>
                <div className={`w-3 h-3 rounded-full ${branch.isActive ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-slate-300'}`} />
              </div>

              {/* Info Details */}
              <div className="space-y-3 my-6 pt-4 border-t border-slate-50 text-xs text-slate-500 font-bold">
                <div className="flex items-center gap-2">
                  <MapPin className="text-slate-400" size={14} />
                  <span>{branch.location || "بدون عنوان محدد"}</span>
                </div>
                {branch.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="text-slate-400" size={14} />
                    <span>{branch.phone}</span>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-4 border-t border-slate-50">
                <button
                  onClick={() => handleConfigureSettings(branch.id)}
                  className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-[11px] py-3 rounded-xl transition-all flex items-center justify-center gap-1.5"
                >
                  <Sliders size={13} />
                  <span>خيارات التنبؤ</span>
                </button>
                <button
                  onClick={() => {
                    setCurrentBranch(branch);
                    setIsEditing(true);
                  }}
                  className="px-4 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-[11px] py-3 rounded-xl transition-all flex items-center justify-center"
                >
                  <Edit2 size={13} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Edit / Create branch Modal */}
      <AnimatePresence>
        {isEditing && currentBranch && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsEditing(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[32px] p-8 max-w-md w-full relative z-10 shadow-2xl border border-slate-50"
            >
              <h2 className="text-lg font-black text-[#1E4D4D] mb-6">
                {currentBranch.id ? 'تعديل بيانات الفرع' : 'إضافة فرع جديد'}
              </h2>

              <form onSubmit={handleSaveBranch} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-2">رمز الفرع الفريد</label>
                  <input
                    type="text"
                    required
                    disabled={!!currentBranch.id}
                    placeholder="مثال: BRH-NORTH"
                    value={currentBranch.code}
                    onChange={(e) => setCurrentBranch({...currentBranch, code: e.target.value.toUpperCase()})}
                    className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-[#1E4D4D] text-black disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-2">اسم الفرع</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: فرع الرياض - المروج"
                    value={currentBranch.name}
                    onChange={(e) => setCurrentBranch({...currentBranch, name: e.target.value})}
                    className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-[#1E4D4D] text-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-2">جهة الرياض / العنوان</label>
                  <input
                    type="text"
                    placeholder="العنوان الكامل للفرع"
                    value={currentBranch.location}
                    onChange={(e) => setCurrentBranch({...currentBranch, location: e.target.value})}
                    className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-[#1E4D4D] text-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-2">رقم الهاتف</label>
                  <input
                    type="text"
                    placeholder="مثال: 9665555555"
                    value={currentBranch.phone}
                    onChange={(e) => setCurrentBranch({...currentBranch, phone: e.target.value})}
                    className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-[#1E4D4D] text-black"
                  />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="branch-active"
                    checked={currentBranch.isActive}
                    onChange={(e) => setCurrentBranch({...currentBranch, isActive: e.target.checked})}
                    className="w-4 h-4 text-[#1E4D4D] focus:ring-[#1E4D4D] border-slate-200 rounded"
                  />
                  <label htmlFor="branch-active" className="text-xs font-black text-slate-600 cursor-pointer">الفرع نشط ويستقبل حركات المخزون والبيع</label>
                </div>

                <div className="flex gap-2 pt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-[#1E4D4D] hover:bg-[#153a3a] text-white font-black text-xs py-4 rounded-2xl transition-all shadow-lg shadow-teal-900/10"
                  >
                    حفظ التغييرات
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-4 bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold text-xs rounded-2xl transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Configure Settings Modal */}
      <AnimatePresence>
        {isConfiguringSettings && selectedSettings && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsConfiguringSettings(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[32px] p-8 max-w-md w-full relative z-10 shadow-2xl border border-slate-50"
            >
              <h2 className="text-lg font-black text-[#1E4D4D] mb-6 flex items-center gap-2">
                <Sliders size={20} className="text-emerald-500" />
                <span>خيارات التنبؤ والطلب التلقائي للفرع</span>
              </h2>

              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="stock-alert"
                      checked={selectedSettings.minStockLevelAlert}
                      onChange={(e) => setSelectedSettings({...selectedSettings, minStockLevelAlert: e.target.checked})}
                      className="w-4 h-4 text-[#1E4D4D] focus:ring-[#1E4D4D] border-slate-200 rounded mt-0.5"
                    />
                    <div>
                      <label htmlFor="stock-alert" className="text-xs font-black text-slate-700 cursor-pointer">تفعيل منبهات انخفاض مستوى المخزون</label>
                      <p className="text-[10px] text-slate-400 mt-1">يقوم النظام بتنبيه أمين مستودع الفرع عندما يقل صنف عن نقطة إعادة الطلب المحددة له محلياً.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 mb-2">أيام التغطية المستهدفة لإعادة الطلب التلقائي</label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    required
                    value={selectedSettings.autoReorderTargetDays}
                    onChange={(e) => setSelectedSettings({...selectedSettings, autoReorderTargetDays: parseInt(e.target.value, 10)})}
                    className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-[#1E4D4D] text-black"
                  />
                  <p className="text-[10px] text-slate-400 mt-1.5">أيام التغطية النموذجية التي يعتمد عليها خوارزمي التنبؤ بالطلب التلقائي لتغطية مبيعات الفرع.</p>
                </div>

                <div className="flex gap-2 pt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-[#1E4D4D] hover:bg-[#153a3a] text-white font-black text-xs py-4 rounded-2xl transition-all shadow-lg"
                  >
                    تطبيق الإعدادات
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfiguringSettings(false)}
                    className="px-6 py-4 bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold text-xs rounded-2xl transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
