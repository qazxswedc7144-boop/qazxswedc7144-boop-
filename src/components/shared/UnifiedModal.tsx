import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '@/hooks/useAppStore';
import { useToast } from '@/hooks/useToast';
import { useFinancialModal, FinancialModalMode } from '@/hooks/useFinancialModal';
import { 
  X, Scale, User, Check, AlertCircle, Sparkles 
} from 'lucide-react';

interface UnifiedModalProps {
  type?: string;
  saveFunction?: (data?: any) => Promise<void>;
  requiredFields?: string[];
  formData?: any;
  setFormData?: React.Dispatch<React.SetStateAction<any>>;
  onClose?: () => void;
  title?: string;
  children?: React.ReactNode;
  isInvoiceSaveConfirm?: boolean;
  invoiceType?: 'SALE' | 'PURCHASE';
  invoiceTotal?: number;
}

export const UnifiedModal: React.FC<UnifiedModalProps> = ({ 
  saveFunction: propSaveFunction, 
  requiredFields: propRequiredFields = [], 
  formData: propFormData = {}, 
  setFormData: propSetFormData, 
  onClose: propOnClose, 
  title: propTitle = "نافذة معالجة السندات والفواتير الموحدة",
  children : propChildren,
  isInvoiceSaveConfirm = false,
  invoiceType = 'SALE',
  invoiceTotal = 0
}) => {
  const toast = useToast();
  const currency = useAppStore(state => state.currency);
  const customers = useAppStore(state => state.customers);
  const suppliers = useAppStore(state => state.suppliers);

  // Read financial modal store state
  const { 
    isOpen, 
    mode, 
    formData, 
    errors, 
    isSaving, 
    closeModal, 
    updateField, 
    saveForm 
  } = useFinancialModal();

  // Handle local state for partner dropdown search
  const [partnerSearch, setPartnerSearch] = useState('');
  const [showPartnerDropdown, setShowPartnerDropdown] = useState(false);
  const partnerDropdownRef = useRef<HTMLDivElement>(null);

  // Set up ESC and Enter keyboard shortcut actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (propOnClose) {
          propOnClose();
        } else {
          closeModal();
        }
      }
      
      if (e.key === 'Enter' && e.ctrlKey) {
        // Submit on Ctrl+Enter
        e.preventDefault();
        if (propSaveFunction) {
          handleLegacySave();
        } else {
          saveForm(toast.addToast);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formData, propFormData, propSaveFunction, isSaving]);

  // Handle outside click to close partner search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (partnerDropdownRef.current && !partnerDropdownRef.current.contains(e.target as Node)) {
        setShowPartnerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine which partner list is relevant based on modal mode
  const isCustomerRelevant = mode === 'sales_invoice' || mode === 'receipt_voucher';
  const relevantPartners = useMemo(() => {
    const rawList = isCustomerRelevant ? customers : suppliers;
    if (!partnerSearch.trim()) return rawList;
    return rawList.filter((p: any) => 
      p.Supplier_Name.toLowerCase().includes(partnerSearch.toLowerCase()) ||
      (p.id && p.id.toLowerCase().includes(partnerSearch.toLowerCase()))
    );
  }, [isCustomerRelevant, customers, suppliers, partnerSearch]);

  // Support fallback for legacy prop-based invocations (e.g., from SalesModule.tsx)
  const isLegacyMode = !!propSaveFunction;
  const [legacySaving, setLegacySaving] = useState(false);

  const handleLegacySave = async () => {
    if (propRequiredFields.length > 0) {
      const missingField = propRequiredFields.find((field) => {
        const val = propFormData[field];
        return !val || (typeof val === 'string' && val.trim() === '') || (Array.isArray(val) && val.length === 0);
      });

      if (missingField) {
        toast.warning("يرجى استكمال الحقول المطلوبة قبل الاستمرار");
        return;
      }
    }

    try {
      setLegacySaving(true);
      const dataToSave = { ...propFormData };
      propRequiredFields.forEach(f => {
        if (f === 'amount' || f.toLowerCase().includes('id')) {
          if (dataToSave[f] && !isNaN(Number(dataToSave[f]))) {
            dataToSave[f] = Number(dataToSave[f]);
          }
        }
      });

      if (propSaveFunction) {
        await propSaveFunction(dataToSave);
      }
      
      if (propSetFormData && !isInvoiceSaveConfirm) {
        propSetFormData({});
      }
      
      toast.success("تم الحفظ والترحيل المحاسبي بنجاح ✅");
      if (propOnClose) propOnClose();
    } catch (err: any) {
      console.error(err);
      toast.error(`خطأ في معالجة المستند: ${err.message || "حدث خطأ غير متوقع"}`);
    } finally {
      setLegacySaving(false);
    }
  };

  // Label dictionary translated for financial document modes
  const modeLabels: Record<FinancialModalMode, { title: string; subtitle: string; partnerLabel: string; btnColor: string }> = {
    sales_invoice: {
      title: 'فاتورة مبيعات سريعة',
      subtitle: 'سند بيع يدوي فوري لتعديل المخزون والدفاتر',
      partnerLabel: 'اسم العميل / المستلم',
      btnColor: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
    },
    purchase_invoice: {
      title: 'فاتورة مشتريات واردة',
      subtitle: 'سند إدخال مخزني من مورد وتحديث الذمم',
      partnerLabel: 'اسم المورد / الشريك',
      btnColor: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
    },
    receipt_voucher: {
      title: 'سند قبض نقدية',
      subtitle: 'سند استلام مالي لإطفاء مديونيات العملاء',
      partnerLabel: 'اسم العميل الدافع',
      btnColor: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
    },
    payment_voucher: {
      title: 'سند صرف نقدية',
      subtitle: 'سند مدفوعات لمورد لتسوية الحسابات الدائنة',
      partnerLabel: 'اسم المورد المستفيد',
      btnColor: 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'
    }
  };

  const activeLabel = mode ? modeLabels[mode] : null;

  // Selected partner object for visual feedback
  const currentlySelectedPartner = useMemo(() => {
    if (!mode || isLegacyMode) return null;
    const partnerList = isCustomerRelevant ? customers : suppliers;
    return partnerList.find(p => p.id === formData.partnerId || p.Supplier_ID === formData.partnerId);
  }, [mode, isLegacyMode, isCustomerRelevant, customers, suppliers, formData.partnerId]);

  // Determine if it should render open
  const shouldRender = isLegacyMode ? true : isOpen;

  if (!shouldRender) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4" 
      onClick={isLegacyMode ? propOnClose : closeModal}
      dir="rtl"
      role="dialog"
      aria-modal="true"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
        className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-[28px] border border-slate-100 dark:border-gray-800 shadow-2xl overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative Top Accent Bar */}
        <div className={`h-1.5 w-full ${
          isLegacyMode 
            ? 'bg-gradient-to-l from-indigo-500 to-indigo-600' 
            : mode === 'sales_invoice' 
              ? 'bg-emerald-500' 
              : mode === 'purchase_invoice' 
                ? 'bg-indigo-500' 
                : mode === 'receipt_voucher' 
                  ? 'bg-amber-500' 
                  : 'bg-rose-500'
        }`} />

        <div className="p-7">
          {/* Header Panel */}
          <div className="flex items-start justify-between mb-6">
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                {!isLegacyMode && activeLabel ? activeLabel.title : propTitle}
                {!isLegacyMode && <Sparkles size={16} className="text-yellow-500 animate-pulse" />}
              </h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-extrabold max-w-[340px] leading-relaxed">
                {!isLegacyMode && activeLabel ? activeLabel.subtitle : 'بوابة القيود المالية المتكاملة والمعايرة الفورية'}
              </p>
            </div>
            
            <button 
              onClick={isLegacyMode ? propOnClose : closeModal}
              className="p-2 bg-slate-50 dark:bg-gray-800 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all cursor-pointer"
              aria-label="إغلاق النافذة"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form Content */}
          <div className="space-y-4 mb-7">
            {isInvoiceSaveConfirm ? (
              <div className="space-y-3.5 bg-slate-50 dark:bg-gray-800/40 p-5 rounded-2xl border border-slate-100 dark:border-gray-800 text-right">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100/50 dark:border-gray-800">
                  <span className="text-xs font-black text-slate-400 dark:text-gray-500">رقم الفاتورة:</span>
                  <span className="text-xs font-black text-slate-800 dark:text-white font-mono bg-slate-100 dark:bg-gray-800 px-2.5 py-1 rounded-lg">
                    #{propFormData.invoice_number || 'تلقائي'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100/50 dark:border-gray-800">
                  <span className="text-xs font-black text-slate-400 dark:text-gray-500">
                    {invoiceType === 'SALE' ? 'العميل:' : 'المورد:'}
                  </span>
                  <span className="text-xs font-black text-[#1E4D4D] dark:text-emerald-400">
                    {invoiceType === 'SALE'
                      ? (customers.find((c: any) => c.id === propFormData.customer_id || c.Supplier_ID === propFormData.customer_id)?.Supplier_Name || 'عميل نقدي عام')
                      : (suppliers.find((s: any) => s.id === propFormData.supplier_id || s.Supplier_ID === propFormData.supplier_id)?.Supplier_Name || 'مورد عام')}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100/50 dark:border-gray-800">
                  <span className="text-xs font-black text-slate-400 dark:text-gray-500">التاريخ:</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-350">
                    {propFormData.date || new Date().toISOString().split('T')[0]}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100/50 dark:border-gray-800">
                  <span className="text-xs font-black text-slate-400 dark:text-gray-500">نوع الفاتورة:</span>
                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 font-sans">
                    {propFormData.isReturn ? 'مرتجع' : ''} {propFormData.payment_method === 'Cash' ? 'نقدي (Cash)' : 'آجل (Credit)'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 pt-2.5 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-xl px-3 mt-1.5 border border-emerald-100/50 dark:border-emerald-950/20">
                  <span className="text-xs font-black text-slate-500 dark:text-slate-400">القيمة الإجمالية:</span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {Number(invoiceTotal || 0).toLocaleString()} {currency}
                  </span>
                </div>
                {propChildren}
              </div>
            ) : isLegacyMode ? (
              // Legacy execution block (Standard required dynamic fields)
              <>
                <div className="space-y-3">
                  {propRequiredFields.map(field => {
                    const fallbackName = field === 'customerId' || field === 'customer_id' ? 'العميل' : (field === 'supplierId' ? 'المورد' : field);
                    const isNum = field === 'amount' || field.toLowerCase().includes('id');
                    return (
                      <div key={field} className="space-y-1">
                        <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 mr-1">
                          {fallbackName} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type={isNum ? "number" : "text"}
                          placeholder={`أدخل ${fallbackName}`}
                          value={propFormData[field] || ""}
                          onChange={e => propSetFormData?.({...propFormData, [field]: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-750 rounded-2xl text-xs font-black text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all"
                        />
                      </div>
                    );
                  })}
                  {propChildren}
                </div>
              </>
            ) : (
              // Modern, fully-featured, validated form engine
              <>
                {/* 1. Partner Dropdown Selector */}
                <div className="space-y-1 relative" ref={partnerDropdownRef}>
                  <label className="block text-xs font-black text-slate-500 dark:text-gray-400 mr-1">
                    {activeLabel?.partnerLabel} <span className="text-red-500">*</span>
                  </label>
                  
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                      <User size={15} />
                    </div>
                    
                    <input
                      type="text"
                      placeholder={currentlySelectedPartner ? currentlySelectedPartner.Supplier_Name : "اضغط للبحث واختيار الطرف المالي..."}
                      value={partnerSearch}
                      onChange={(e) => {
                        setPartnerSearch(e.target.value);
                        setShowPartnerDropdown(true);
                      }}
                      onFocus={() => setShowPartnerDropdown(true)}
                      disabled={isSaving}
                      className={`w-full pr-10 pl-4 py-3 bg-slate-50 dark:bg-gray-800 border rounded-2xl text-xs font-black text-slate-800 dark:text-white focus:outline-none transition-all ${
                        errors.partnerId 
                          ? 'border-red-400 dark:border-red-500 ring-2 ring-red-500/10' 
                          : 'border-slate-100 dark:border-gray-750 focus:ring-2 focus:ring-[#1E4D4D]/10 focus:border-[#1E4D4D]'
                      }`}
                    />
                  </div>

                  {/* Dropdown Options List */}
                  <AnimatePresence>
                    {showPartnerDropdown && (
                      <motion.div 
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="absolute z-[2100] top-full right-0 left-0 mt-1.5 bg-white dark:bg-gray-850 border border-slate-100 dark:border-gray-750 rounded-2xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar"
                      >
                        {relevantPartners.length > 0 ? (
                          relevantPartners.map((partner: any) => (
                            <button
                              key={partner.id || partner.Supplier_ID}
                              onClick={() => {
                                updateField('partnerId', partner.id || partner.Supplier_ID);
                                setPartnerSearch('');
                                setShowPartnerDropdown(false);
                              }}
                              className="w-full text-right px-4 py-3 hover:bg-slate-50 dark:hover:bg-gray-800 text-xs font-bold text-slate-700 dark:text-slate-300 flex justify-between items-center transition-all border-b border-slate-50/50 dark:border-gray-800 last:border-0"
                            >
                              <span>{partner.Supplier_Name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-400 bg-slate-50 dark:bg-gray-850 px-2 py-0.5 rounded-md border border-slate-100/50 dark:border-slate-755 font-mono">
                                  {partner.id || partner.Supplier_ID}
                                </span>
                                {(formData.partnerId === partner.id || formData.partnerId === partner.Supplier_ID) && (
                                  <Check size={14} className="text-[#1E4D4D] dark:text-emerald-400" />
                                )}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="p-4 text-center text-xs text-slate-400 font-bold">
                            لا توجد نتائج مطابقة لـ "{partnerSearch}"
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  {errors.partnerId && (
                    <p className="text-[10px] text-red-500 font-bold mr-1 flex items-center gap-1 mt-1 animate-pulse">
                      <AlertCircle size={12} />
                      {errors.partnerId}
                    </p>
                  )}
                </div>

                {/* 2. Transaction Amount Input */}
                <div className="space-y-1">
                  <label className="block text-xs font-black text-slate-500 dark:text-gray-400 mr-1">
                    المبلغ الإجمالي ({currency}) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                      <Scale size={15} />
                    </div>
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => updateField('amount', e.target.value)}
                      disabled={isSaving}
                      className={`w-full pr-10 pl-12 py-3 bg-slate-50 dark:bg-gray-800 border rounded-2xl text-xs font-black text-slate-800 dark:text-white focus:outline-none transition-all ${
                        errors.amount 
                          ? 'border-red-400 dark:border-red-500 ring-2 ring-red-500/10' 
                          : 'border-slate-100 dark:border-gray-750 focus:ring-2 focus:ring-[#1E4D4D]/10 focus:border-[#1E4D4D]'
                      }`}
                    />
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 font-extrabold text-[10px] uppercase">
                      {currency}
                    </div>
                  </div>
                  {errors.amount && (
                    <p className="text-[10px] text-red-500 font-bold mr-1 flex items-center gap-1 mt-1 animate-pulse">
                      <AlertCircle size={12} />
                      {errors.amount}
                    </p>
                  )}
                </div>

                {/* Grid for Date and Reference - Responsive column layout */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* 3. Document Date */}
                  <div className="space-y-1">
                    <label className="block text-xs font-black text-slate-500 dark:text-gray-400 mr-1">
                      تاريخ المستند <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => updateField('date', e.target.value)}
                        disabled={isSaving}
                        className={`w-full px-4 py-3 bg-slate-50 dark:bg-gray-800 border rounded-2xl text-xs font-black text-slate-800 dark:text-white focus:outline-none transition-all border-slate-100 dark:border-gray-750 focus:ring-2 focus:ring-[#1E4D4D]/10 focus:border-[#1E4D4D]`}
                      />
                    </div>
                  </div>

                  {/* 4. Document Reference Number */}
                  <div className="space-y-1">
                    <label className="block text-xs font-black text-slate-500 dark:text-gray-400 mr-1">
                      رقم المرجع / الإيصال
                    </label>
                    <input
                      type="text"
                      placeholder="#10024"
                      value={formData.referenceNumber}
                      onChange={(e) => updateField('referenceNumber', e.target.value)}
                      disabled={isSaving}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-750 rounded-2xl text-xs font-black text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E4D4D]/10 focus:border-[#1E4D4D] transition-all"
                    />
                  </div>
                </div>

                {/* 5. Custom Note / Description */}
                <div className="space-y-1">
                  <label className="block text-xs font-black text-slate-500 dark:text-gray-400 mr-1">
                    البيان الشامل / الملاحظات
                  </label>
                  <textarea
                    rows={2}
                    placeholder="اكتب ملاحظات إضافية بخصوص السند لتوثيقها بالدفاتر..."
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    disabled={isSaving}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-750 rounded-2xl text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E4D4D]/10 focus:border-[#1E4D4D] transition-all resize-none"
                  />
                </div>
              </>
            )}
            
            {propChildren && !isLegacyMode && propChildren}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={isLegacyMode ? handleLegacySave : () => saveForm(toast.addToast)}
              disabled={isSaving || legacySaving}
              className={`flex-[2] py-4 rounded-2xl font-black text-xs text-white transition-all duration-200 active:scale-95 flex items-center justify-center gap-2.5 ${
                (isSaving || legacySaving)
                  ? "bg-slate-350 dark:bg-slate-700 cursor-not-allowed text-slate-500 dark:text-slate-400" 
                  : isLegacyMode 
                    ? "bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-600/20" 
                    : activeLabel?.btnColor + " shadow-xl"
              }`}
            >
              {(isSaving || legacySaving) ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-300 dark:border-slate-500 border-t-white dark:border-t-white rounded-full animate-spin" />
                  <span>معالجة وحفظ البيانات...</span>
                </>
              ) : (
                <>
                  {isLegacyMode ? 'تأكيد وحفظ المستند' : 'ترحيل المستند للقيد المزدوج'}
                </>
              )}
            </button>
            
            <button 
              onClick={isLegacyMode ? propOnClose : closeModal}
              disabled={isSaving || legacySaving}
              className="flex-1 py-4 bg-slate-50 dark:bg-gray-800 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-2xl text-xs font-black text-slate-400 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 transition-all border border-slate-100 dark:border-gray-750 shadow-sm"
            >
              إلغاء
            </button>
          </div>
          
          {/* Helpful shortcuts tip */}
          <div className="mt-4 text-center">
            <span className="text-[9px] text-slate-350 dark:text-slate-500 font-bold uppercase tracking-wider">
              مفاتيح الاختصار: [Ctrl+Enter] للحفظ السريع - [Esc] للإغلاق
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
