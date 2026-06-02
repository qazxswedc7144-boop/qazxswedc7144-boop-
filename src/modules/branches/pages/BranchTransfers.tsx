// src/modules/branches/pages/BranchTransfers.tsx

import React, { useState, useEffect } from 'react';
import { BranchService } from '../services/BranchService';
import { Branch, TransferStatus } from '@/types';
import { useUI } from '@/contexts/AppContext';
import { 
  ArrowRightLeft, Eye, Truck, Trash2, X, RotateCw, CheckCircle2, Ban
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const BranchTransfers: React.FC = () => {
  const { addToast } = useUI();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'LIST' | 'CREATE'>('LIST');

  // Form State
  const [sourceBranchId, setSourceBranchId] = useState('');
  const [targetBranchId, setTargetBranchId] = useState('');
  const [reason, setReason] = useState('');
  const [transferItems, setTransferItems] = useState<{ productId: string; name: string; qty: number }[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProductQty, setSelectedProductQty] = useState(10);

  // Transfer Details modal
  const [activeDetailsId, setActiveDetailsId] = useState<string | null>(null);
  const [details, setDetails] = useState<{ transfer: any; items: any[] } | null>(null);
  
  // Real Receive items popup state
  const [isReceiving, setIsReceiving] = useState(false);
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const branchesList = await BranchService.getBranches();
      setBranches(branchesList);
      
      const transfersList = await BranchService.getTransfers();
      setTransfers(transfersList);

      const productsList = await (await import('@/core/db')).db.products.toArray();
      setProducts(productsList);

      if (branchesList && branchesList.length >= 2) {
        setSourceBranchId(branchesList[0]?.id || "");
        setTargetBranchId(branchesList[1]?.id || "");
      }
    } catch {
      addToast("حدث خطأ أثناء تحميل البيانات المبدئية", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleAddProductToTransfer = () => {
    if (!selectedProductId) return;
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    // Check if duplicate
    const exists = transferItems.find(itm => itm.productId === selectedProductId);
    if (exists) {
      addToast("هذا المنتج مضاف مسبقاً للطلب البيني", "warning");
      return;
    }

    setTransferItems([
      ...transferItems,
      { productId: selectedProductId, name: prod.name, qty: selectedProductQty }
    ]);
    setSelectedProductId('');
    setSelectedProductQty(10);
  };

  const handleRemoveProductFromTransfer = (idx: number) => {
    setTransferItems(transferItems.filter((_, i) => i !== idx));
  };

  const handleCreateTransferRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceBranchId === targetBranchId) {
      addToast("لا يمكن النقل بين نفس الفرع", "warning");
      return;
    }
    if (transferItems.length === 0) {
      addToast("يرجى إضافة صنف واحد على الأقل للمستند", "warning");
      return;
    }

    try {
      await BranchService.createTransfer(
        sourceBranchId,
        targetBranchId,
        transferItems,
        reason,
        "إدارة المخزون السيادي"
      );
      addToast("تم تسجيل طلب المناقلة البينية بنجاح في صيغة مسودة", "success");
      setTransferItems([]);
      setReason('');
      setActiveTab('LIST');
      loadInitialData();
    } catch {
      addToast("فشل إرسال طلب المناقلة البينية", "error");
    }
  };

  const handleViewDetails = async (id: string) => {
    try {
      const info = await BranchService.getTransferDetails(id);
      setDetails(info);
      setActiveDetailsId(id);
    } catch {
      addToast("فشل تحميل تفاصيل طلب المناقلة", "error");
    }
  };

  const handleTransitionStatus = async (id: string, nextStatus: TransferStatus) => {
    try {
      if (nextStatus === "RECEIVED") {
        // Must show receipt confirm modal
        setIsReceiving(true);
        const info = await BranchService.getTransferDetails(id);
        const initialReceipts: Record<string, number> = {};
        info.items.forEach(itm => {
          initialReceipts[itm.id] = itm.qty;
        });
        setReceivedQtys(initialReceipts);
        setDetails(info);
        return;
      }

      await BranchService.updateTransferStatus(id, nextStatus, "مشرف مستودع الفروع");
      addToast(`تم تغيير حالة الطلب بنجاح إلى: ${nextStatus === 'APPROVED' ? 'معتمد' : nextStatus === 'IN_TRANSIT' ? 'في الطريق' : 'ملغي'}`, "success");
      
      // Reload details if modal is open
      if (activeDetailsId === id) {
        const info = await BranchService.getTransferDetails(id);
        setDetails(info);
      }
      
      loadInitialData();
    } catch {
      addToast("حدث خطأ أثناء الانتقال بحالة المستند البيني", "error");
    }
  };

  const handleConfirmReceipt = async () => {
    if (!details?.transfer?.id) return;
    try {
      await BranchService.updateTransferStatus(
        details.transfer.id,
        "RECEIVED",
        "أمين مستودع الفرع المستلم",
        receivedQtys
      );
      addToast("تم تأكيد الاستلام الفعلي وإدخال المخزون للفرع المستلم", "success");
      setIsReceiving(false);
      setActiveDetailsId(null);
      setDetails(null);
      loadInitialData();
    } catch {
      addToast("فشل تسجيل عملية استلام المناقلة", "error");
    }
  };

  const getStatusBadge = (status: TransferStatus) => {
    switch (status) {
      case "DRAFT":
        return <span className="bg-amber-50 text-amber-700 px-3 py-1 pb-1.5 rounded-full text-[10px] font-black border border-amber-200">مسودة</span>;
      case "APPROVED":
        return <span className="bg-[#1E4D4D]/10 text-[#1E4D4D] px-3 py-1 pb-1.5 rounded-full text-[10px] font-black border border-[#1E4D4D]/20">معتمد</span>;
      case "IN_TRANSIT":
        return <span className="bg-blue-50 text-blue-700 px-3 py-1 pb-1.5 rounded-full text-[10px] font-black border border-blue-200">في الطريق</span>;
      case "RECEIVED":
        return <span className="bg-emerald-50 text-emerald-700 px-3 py-1 pb-1.5 rounded-full text-[10px] font-black border border-emerald-200">مستلم فعلياً</span>;
      case "CANCELLED":
        return <span className="bg-rose-50 text-rose-700 px-3 py-1 pb-1.5 rounded-full text-[10px] font-black border border-rose-200">ملغي</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Upper Banner & Navigation Switcher */}
      <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3.5 bg-emerald-50 text-emerald-700 rounded-2xl shadow-inner">
              <ArrowRightLeft size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#1E4D4D]">المناقلات والتحويلات البينية</h1>
              <p className="text-xs text-slate-400 font-bold mt-0.5">تحويل المخزون الدوائي وموازنة الإمدادات بين الفروع والصيدليات الفرعية</p>
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('LIST')}
              className={`flex-1 sm:flex-initial px-6 py-3.5 rounded-2xl text-xs font-black transition-all ${activeTab === 'LIST' ? 'bg-[#1E4D4D] text-white shadow-lg' : 'text-slate-400 hover:text-[#1E4D4D]'}`}
            >
              طلبات التحويل الحالية
            </button>
            <button
              onClick={() => setActiveTab('CREATE')}
              className={`flex-1 sm:flex-initial px-6 py-3.5 rounded-2xl text-xs font-black transition-all ${activeTab === 'CREATE' ? 'bg-[#1E4D4D] text-white shadow-lg' : 'text-slate-400 hover:text-[#1E4D4D]'}`}
            >
              إنشاء طلب تحويل مخزني
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : activeTab === 'LIST' ? (
        /* TRANSFERS LIST TAB */
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-md overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <h2 className="text-base font-black text-[#1E4D4D]">حركة التحويلات الصادرة والواردة</h2>
            <button 
              onClick={loadInitialData}
              className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl transition-all"
            >
              <RotateCw size={14} />
            </button>
          </div>

          {transfers.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-bold">
              لا توجد مناقلات مسجلة حالياً بين الفروع.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-slate-50/75 text-slate-500 font-black text-xs border-b border-slate-100">
                    <th className="p-4">رقم التحويل</th>
                    <th className="p-4">المرسل (المصدر)</th>
                    <th className="p-4">المستقبل (الوجهة)</th>
                    <th className="p-4">حالة الطلب</th>
                    <th className="p-4">تاريخ الطلب</th>
                    <th className="p-4">بواسطة</th>
                    <th className="p-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {transfers.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-black text-slate-800">{item.transferNumber}</td>
                      <td className="p-4">{item.sourceName}</td>
                      <td className="p-4">{item.targetName}</td>
                      <td className="p-4">{getStatusBadge(item.status)}</td>
                      <td className="p-4 text-xs text-slate-500">{new Date(item.createdAt).toLocaleDateString("ar-SA")}</td>
                      <td className="p-4 text-xs">{item.createdBy || "-"}</td>
                      <td className="p-4 flex justify-center gap-2">
                        <button
                          onClick={() => handleViewDetails(item.id)}
                          className="px-4 py-2 bg-[#1E4D4D]/5 hover:bg-[#1E4D4D]/10 text-[#1E4D4D] font-black text-xs rounded-xl transition-all flex items-center gap-1"
                        >
                          <Eye size={12} />
                          <span>عرض وتغيير الحالة</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* CREATE TRANSFER FORM TAB */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-md lg:col-span-2 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-black text-slate-800">بيانات التحويل والأصناف المشمولة</h3>
            </div>

            {/* Selection row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-slate-400 mb-2">فرع المصدر (سحب من)</label>
                <select
                  value={sourceBranchId}
                  onChange={(e) => setSourceBranchId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 text-slate-700 font-black rounded-xl focus:outline-none focus:ring-1 focus:ring-[#1E4D4D] text-sm"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 mb-2">فرع الوجهة (تحويل للوارد)</label>
                <select
                  value={targetBranchId}
                  onChange={(e) => setTargetBranchId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 text-slate-700 font-black rounded-xl focus:outline-none focus:ring-1 focus:ring-[#1E4D4D] text-sm"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selector Item UI */}
            <div className="bg-slate-50/70 p-5 rounded-[24px] border border-slate-100 space-y-4">
              <h4 className="text-xs font-black text-slate-500">إضافة بند دواء إلى مستند التحويل:</h4>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] font-black text-slate-400 mb-1.5">اختر الصنف</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full px-3 py-3 bg-white border border-slate-100 text-slate-700 font-bold rounded-lg text-xs"
                  >
                    <option value="">-- اختر الدواء المطلوب --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} - ({p.sku || p.barcode})</option>
                    ))}
                  </select>
                </div>
                <div className="w-full sm:w-32">
                  <label className="block text-[10px] font-black text-slate-400 mb-1.5">الكمية المطلوبة</label>
                  <input
                    type="number"
                    min={1}
                    value={selectedProductQty}
                    onChange={(e) => setSelectedProductQty(Math.max(1, parseInt(e.target.value, 10)))}
                    className="w-full px-3 py-2.5 bg-white border border-slate-100 text-black text-xs rounded-lg"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddProductToTransfer}
                  className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-lg transition-all"
                >
                  إضافة بند
                </button>
              </div>
            </div>

            {/* Added details table list */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-[#1E4D4D]">قائمة الأصناف المراد مناقلتها:</h4>
              {transferItems.length === 0 ? (
                <p className="text-xs text-slate-400 font-bold py-6 text-center">لا توجد بنود للتصدير بعد. استخدم الأداة بالأعلى.</p>
              ) : (
                <div className="border border-slate-50 rounded-2xl overflow-hidden shadow-inner">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-[#1E4D4D]/5 text-[#1E4D4D] font-black">
                      <tr>
                        <th className="p-3">اسم المستحضر العقاري</th>
                        <th className="p-3 text-center">الكمية الممنوحة للتحويل</th>
                        <th className="p-3 text-center">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-600">
                      {transferItems.map((itm, i) => (
                        <tr key={itm.productId}>
                          <td className="p-3 text-slate-800 font-black">{itm.name}</td>
                          <td className="p-3 text-center">{itm.qty}</td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveProductFromTransfer(i)}
                              className="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Form Actions Side column */}
          <div className="bg-gradient-to-b from-[#1E4D4D] to-[#123131] rounded-[32px] p-6 text-white shadow-xl flex flex-col justify-between h-fit space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-black border-b border-white/10 pb-3">إرسال وتثبيت مستند السحب البيني</h3>
              
              <div>
                <label className="block text-[10px] font-black text-slate-300 mb-2">سبب التحويل وملاحظات إضافية</label>
                <textarea
                  rows={4}
                  placeholder="مثال: تغطية نقص فوري في صيدلية الشمال لمنتج البنادول..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-3 text-xs bg-white/5 border border-white/10 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 rounded-2xl text-white outline-none placeholder:text-white/20"
                />
              </div>

              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-xs text-slate-300 font-bold space-y-2">
                <div className="flex justify-between">
                  <span>إجمالي البنود:</span>
                  <span className="font-black text-white">{transferItems.length} إصدارات</span>
                </div>
                <div className="flex justify-between">
                  <span>إجمالي الحبات:</span>
                  <span className="font-black text-white">{transferItems.reduce((acc, itm) => acc + itm.qty, 0)} عبوة</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleCreateTransferRequest}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 font-black text-xs text-white rounded-2xl transition-all shadow-lg "
            >
              تسجيل مسودة السحب والتحويل
            </button>
          </div>
        </div>
      )}

      {/* Details & Status Actions Modal */}
      <AnimatePresence>
        {activeDetailsId && details && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => {
                setActiveDetailsId(null);
                setDetails(null);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] p-8 max-w-2xl w-full relative z-10 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-[#1E4D4D]">تفاصيل طلب المناقلة {details.transfer.transferNumber}</h2>
                    {getStatusBadge(details.transfer.status)}
                  </div>
                  <p className="text-xs text-slate-400 font-black mt-1">
                    {details.transfer.sourceName} ───← {details.transfer.targetName}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setActiveDetailsId(null);
                    setDetails(null);
                  }}
                  className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Status Action Buttons Section */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6 font-bold space-y-3">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">الإجراءات المتاحة للحركة والاعتمادات السيادية:</p>
                
                <div className="flex flex-wrap gap-2">
                  {details.transfer.status === "DRAFT" && (
                    <>
                      <button
                        onClick={() => handleTransitionStatus(details.transfer.id, "APPROVED")}
                        className="px-4 py-2 bg-[#1E4D4D] hover:bg-[#153a3a] text-white font-black text-xs rounded-lg transition-all"
                      >
                        اعتماد طلب المناقلة البينية
                      </button>
                      <button
                        onClick={() => handleTransitionStatus(details.transfer.id, "CANCELLED")}
                        className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs rounded-lg transition-all"
                      >
                        إلغاء الطلب
                      </button>
                    </>
                  )}

                  {details.transfer.status === "APPROVED" && (
                    <>
                      <button
                        onClick={() => handleTransitionStatus(details.transfer.id, "IN_TRANSIT")}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-lg transition-all flex items-center gap-1.5"
                      >
                        <Truck size={14} />
                        <span>تأكيد الشحن والبدء بالنقل</span>
                      </button>
                      <button
                        onClick={() => handleTransitionStatus(details.transfer.id, "CANCELLED")}
                        className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 font-black text-xs rounded-lg transition-all"
                      >
                        إلغاء واعتماد الرفض
                      </button>
                    </>
                  )}

                  {details.transfer.status === "IN_TRANSIT" && (
                    <button
                      onClick={() => handleTransitionStatus(details.transfer.id, "RECEIVED")}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-lg transition-all"
                    >
                      تسجيل استلام الشحنة وتثبيتها في المخزون
                    </button>
                  )}

                  {details.transfer.status === "RECEIVED" && (
                    <div className="text-xs text-emerald-700 font-black flex items-center gap-1.5">
                      <CheckCircle2 size={16} />
                      <span>تم استلام هذه الشحنة وإدخال مخازن الفرع المستهدف في: {new Date(details.transfer.receivedAt).toLocaleString("ar-SA")}</span>
                    </div>
                  )}

                  {details.transfer.status === "CANCELLED" && (
                    <div className="text-xs text-rose-600 font-black flex items-center gap-1.5">
                      <Ban size={16} />
                      <span>تم إلغاء عملية المناقلة البينية هذه ولا يمكن معالجتها ثانية.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Items List inside transfer details */}
              <div className="space-y-4 font-bold">
                <h3 className="text-xs font-black text-[#1E4D4D] border-b border-slate-50 pb-2">البنود الصيدلانية المشحونة:</h3>
                
                <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-100/75 text-slate-500 font-black">
                        <th className="p-3">الدواء</th>
                        <th className="p-3 text-center">الكمية الصادرة</th>
                        <th className="p-3 text-center">المستلمة فعلياً</th>
                        <th className="p-3">رقم التشغيلة</th>
                        <th className="p-3">تاريخ انتهاء الصلاحية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {details.items.map(itm => (
                        <tr key={itm.id}>
                          <td className="p-3 font-black text-slate-800">{itm.productName}</td>
                          <td className="p-3 text-center text-slate-500 font-semibold">{itm.qty}</td>
                          <td className="p-3 text-center text-emerald-700 font-black">
                            {details.transfer.status === 'RECEIVED' ? itm.receivedQty : 'بانتظار الاستلام'}
                          </td>
                          <td className="p-3 text-xs text-slate-400">{itm.batchNumber || "-"}</td>
                          <td className="p-3 text-xs text-slate-400">{new Date(itm.expiryDate).toLocaleDateString("ar-SA")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {details.transfer.reason && (
                  <div className="bg-slate-50 p-4 rounded-xl text-xs border border-slate-100 mt-4 leading-relaxed">
                    <span className="font-black text-slate-500 block mb-1">سبب الاستدعاء المخزني والمناقلة البينية:</span>
                    <p className="text-slate-700">{details.transfer.reason}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Actual Confirm Receipt Modal (Enter Quantities) */}
      <AnimatePresence>
        {isReceiving && details && (
          <div className="fixed inset-0 z-[700] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsReceiving(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] p-8 max-w-md w-full relative z-10 shadow-2xl border border-slate-100"
            >
              <h2 className="text-base font-black text-[#1E4D4D] mb-4">تسجيل الكميات المستلمة فعلياً</h2>
              <p className="text-slate-400 text-xs font-bold mb-6">يرجى فحص المستحضرات والتثبت من الكميات الدوائية السليمة التي تم تفريغها بالفرع:</p>

              <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-1">
                {details.items.map(itm => (
                  <div key={itm.id} className="flex justify-between items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex-1">
                      <span className="font-black text-slate-700 text-xs block truncate">{itm.productName}</span>
                      <span className="text-[10px] text-slate-400 block font-bold mt-0.5">الكمية الصادرة: {itm.qty}</span>
                    </div>
                    <div className="w-24">
                      <input
                        type="number"
                        min={0}
                        max={itm.qty}
                        required
                        value={receivedQtys[itm.id] ?? itm.qty}
                        onChange={(e) => {
                          const val = Math.min(itm.qty, Math.max(0, parseInt(e.target.value, 10) || 0));
                          setReceivedQtys({ ...receivedQtys, [itm.id]: val });
                        }}
                        className="w-full px-2 py-2 text-center text-xs font-black bg-white border border-slate-200 rounded-lg text-black"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-6">
                <button
                  type="button"
                  onClick={handleConfirmReceipt}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-4 rounded-2xl transition-all shadow-lg"
                >
                  تأكيد وإدخال المخزن
                </button>
                <button
                  type="button"
                  onClick={() => setIsReceiving(false)}
                  className="px-6 py-4 bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold text-xs rounded-2xl transition-all"
                >
                  تراجع
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
