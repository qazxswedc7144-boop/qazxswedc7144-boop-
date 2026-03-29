
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { db } from '../services/database';
import { Product, InvoiceStatus, InvoiceItem, Purchase, PaymentStatus } from '../types';
import { useUI, useInventory, useAccounting } from '../store/AppContext';
import { useAppStore } from '../store/useAppStore';
import { authService } from '../services/auth.service';
import { Card, Button, Badge, Modal, Input } from './SharedUI';
import { InvoiceLockedBanner } from './SharedInvoiceUI';
import { PurchaseRepository } from '../repositories/PurchaseRepository';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { priceIntelligenceService } from '../services/priceIntelligence.service';
import { syncService } from '../services/sync.service';
import PrintMenu from './PrintMenu';
import { 
  Search, Trash2, Plus, Minus, ArrowLeft, Tag, Camera, Calendar,
  ChevronDown, RotateCcw, CheckCircle2,
  ShoppingBag, Package, CalendarDays, Wallet, Percent, Scale,
  X, Edit3, AlertCircle, History, ShieldAlert, Lock, Clock,
  User, CreditCard, Save, ChevronRight, FileText, ArrowRight, Home, Printer,
  ChevronLeft, MoreVertical, Trash, Info
} from 'lucide-react';
import { InvoiceWorkflowEngine } from '../services/logic/InvoiceWorkflowEngine';
import { motion, AnimatePresence } from 'motion/react';

const DRAFT_KEY = 'pharmaflow_purchase_draft';

const PurchasesInvoice: React.FC<{ onNavigate?: (view: any, params?: any) => void }> = ({ onNavigate }) => {
  const { addToast, currency, refreshGlobal } = useUI();
  const { addInvoice, suppliers } = useAccounting();
  const { products, categories, addCategory } = useInventory();
  const setEditingInvoiceId = useAppStore(state => state.setEditingInvoiceId);
  const editingInvoiceId = useAppStore(state => state.editingInvoiceId);
  const systemStatus = useAppStore(state => state.systemStatus);
  const isRecovery = systemStatus === 'RECOVERY_MODE';
  
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [hasDependencies, setHasDependencies] = useState(false);
  
  const [isAdjustmentsOpen, setIsAdjustmentsOpen] = useState(false);
  const [adjData, setAdjData] = useState({
    discountPercent: 0,
    otherFees: 0,
    tax: 0
  });

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [manualItemName, setManualItemName] = useState<string>('');
  const [tempQty, setTempQty] = useState<number | string>('');
  const [tempPrice, setTempPrice] = useState<number | string>('');
  const [tempExpiry, setTempExpiry] = useState<string>('');
  const [tempNote, setTempNote] = useState<string>('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [manualCategoryName, setManualCategoryName] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const invNumInputRef = useRef<HTMLInputElement>(null);
  const itemNameInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  const expiryInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const categoryInputRef = useRef<HTMLSelectElement>(null);

  const [header, setHeader] = useState({ 
    invoice_number: '', 
    supplier_id: '',
    payment_method: 'Cash',
    status: 'DRAFT' as InvoiceStatus,
    payment_status: 'Unpaid' as PaymentStatus,
    date: new Date().toISOString().split('T')[0],
    notes: '',
    isReturn: false
  });

  const [isDateLockedStatus, setIsDateLockedStatus] = useState(false);

  useEffect(() => {
    const checkLock = async () => {
      const locked = await db.isDateLocked(header.date);
      setIsDateLockedStatus(locked);
    };
    checkLock();
  }, [header.date]);

  const isLocked = useMemo(() => {
    const isWorkflowLocked = InvoiceWorkflowEngine.isLocked(header.status);
    const isPeriodLocked = isDateLockedStatus && authService.getCurrentUser()?.Role !== 'Admin';
    return isWorkflowLocked || isPeriodLocked || hasDependencies;
  }, [header.status, isDateLockedStatus, hasDependencies]);

  useEffect(() => {
    const fetchEditingInvoice = async () => {
      if (editingInvoiceId) {
        const purchase = await db.getPurchases().then(all => all.find(p => p.invoiceId === editingInvoiceId || p.purchase_id === editingInvoiceId || p.id === editingInvoiceId));
        const deps = await InvoiceRepository.checkHasDependencies(editingInvoiceId, 'PURCHASE');
        setHasDependencies(deps);

        if (purchase) {
          setHeader({
            invoice_number: purchase.invoiceId || purchase.purchase_id,
            supplier_id: purchase.partnerId,
            payment_method: purchase.status === 'PAID' ? 'Cash' : 'Credit',
            status: purchase.invoiceStatus || 'PENDING',
            payment_status: purchase.payment_status || 'Unpaid',
            date: (purchase.date || "").split('T')[0],
            notes: (purchase as any).notes || '',
            isReturn: purchase.invoiceType === 'مرتجع'
          });
          setItems(purchase.items || []);
        }
      } else {
        const savedDraft = localStorage.getItem(DRAFT_KEY);
        if (savedDraft) {
          try {
            const parsed = JSON.parse(savedDraft);
            setHeader({ ...parsed.header, payment_status: 'Unpaid' });
            setItems(parsed.items);
            setAdjData(parsed.adjData);
          } catch (e) {}
        }
      }
    };
    fetchEditingInvoice();
  }, [editingInvoiceId]);

  useEffect(() => {
    if (header.invoice_number && header.supplier_id) {
      PurchaseRepository.isDuplicate(header.invoice_number, header.supplier_id, editingInvoiceId)
        .then(res => setIsDuplicate(res));
    } else {
      setIsDuplicate(false);
    }
  }, [header.invoice_number, header.supplier_id, editingInvoiceId]);

  const vTotalSum = useMemo(() => {
    const itemsSum = items.reduce((acc, item) => acc + (item.sum || 0), 0);
    const discountAmount = itemsSum * (Number(adjData.discountPercent) / 100);
    return itemsSum - discountAmount + Number(adjData.otherFees) + Number(adjData.tax);
  }, [items, adjData]);

  const persistToDB = useCallback(async () => {
    const isAdmin = authService.getCurrentUser()?.Role === 'Admin';
    const isPeriodLocked = (await db.isDateLocked(header.date)) && !isAdmin;
    if (isPeriodLocked || isDuplicate) return;

    setIsAutoSaving(true);
    try {
      if (isLocked) {
        if (editingInvoiceId) {
          await db.updatePurchaseNotes(editingInvoiceId, header.notes);
        }
      } else if ((header.status === 'DRAFT' || header.status === 'DRAFT_EDIT') && items.length > 0 && header.invoice_number) {
        await addInvoice({
          type: 'PURCHASE',
          payload: { 
            supplierId: header.supplier_id, 
            items, 
            total: vTotalSum, 
            invoiceId: header.invoice_number,
            id: editingInvoiceId,
            notes: header.notes
          },
          options: { 
            isCash: header.payment_method === 'Cash', 
            isReturn: header.isReturn, 
            currency,
            invoiceStatus: header.status,
            date: header.date
          }
        });
      }
    } catch (err) {} finally { setIsAutoSaving(false); }
  }, [items, header, vTotalSum, isDuplicate, isLocked, editingInvoiceId]);

  useEffect(() => {
    const timer = setInterval(() => persistToDB(), 10000);
    return () => clearInterval(timer);
  }, [persistToDB]);

  const updateItem = (id: string, field: keyof InvoiceItem, val: any) => {
    if (isLocked) return;
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const next = { ...item, [field]: val };
        next.sum = (parseFloat(next.qty as any) || 0) * (parseFloat(next.price as any) || 0);
        return next;
      }
      return item;
    }));
  };

  const finalizeItemAdd = async () => {
    if (isLocked) return;
    const name = manualItemName.trim();
    if (!name || !tempQty) return;

    let catId = selectedCategoryId;
    let catName = manualCategoryName.trim();

    if (catName && !catId) {
      const existingCat = categories.find(c => c.categoryName.toLowerCase() === catName.toLowerCase());
      if (existingCat) {
        catId = existingCat.id;
        catName = existingCat.categoryName;
      } else {
        const newCatId = db.generateId('CAT');
        const newCat = {
          id: newCatId,
          categoryId: db.generateId('CAT-ID'),
          categoryName: catName,
          createdAt: new Date().toISOString(),
          isSystem: false
        };
        await addCategory(newCat);
        catId = newCatId;
      }
    }

    let prod = selectedProduct;
    if (!prod || prod.Name.toLowerCase() !== name.toLowerCase()) {
      prod = products.find(p => p.Name.toLowerCase() === name.toLowerCase()) || null;
    }

    if (prod) {
      if (prod.categoryId !== catId || prod.categoryName !== catName) {
        await db.saveProduct({
          ...prod,
          categoryId: catId || prod.categoryId,
          categoryName: catName || prod.categoryName
        });
      }
    } else {
      const newProdId = db.generateId('PROD');
      await db.saveProduct({
        id: newProdId,
        ProductID: newProdId,
        Name: name,
        DefaultUnit: 'Unit',
        LastPurchasePrice: parseFloat(tempPrice as any) || 0,
        TaxDefault: 0,
        UnitPrice: (parseFloat(tempPrice as any) || 0) * 1.2,
        CostPrice: parseFloat(tempPrice as any) || 0,
        StockQuantity: 0,
        MinLevel: 5,
        ExpiryDate: tempExpiry,
        categoryId: catId,
        categoryName: catName,
        Is_Active: true
      });
      prod = await db.db.products.get(newProdId) || null;
    }

    const newItem: InvoiceItem = {
      id: Math.random().toString(36).substr(2, 9),
      parent_id: editingInvoiceId || '',
      row_order: items.length + 1,
      product_id: prod?.ProductID || db.generateId('ITM'),
      name: name,
      qty: parseFloat(tempQty as any) || 0,
      price: parseFloat(tempPrice as any) || 0,
      sum: (parseFloat(tempQty as any) || 0) * (parseFloat(tempPrice as any) || 0),
      expiryDate: tempExpiry,
      notes: tempNote
    };

    setItems([...items, newItem]);
    setManualItemName('');
    setTempQty('');
    setTempPrice('');
    setTempExpiry('');
    setTempNote('');
    setManualCategoryName('');
    setSelectedCategoryId('');
    setSelectedProduct(null);
    setSearchOpen(false);
    addToast("تمت إضافة الصنف بنجاح", "success");
  };

  const filteredProducts = useMemo(() => {
    if (!manualItemName.trim()) return [];
    const term = manualItemName.toLowerCase();
    return products.filter(p => 
      p.Is_Active !== false && (
        p.Name.toLowerCase().includes(term) || 
        p.ProductID.toLowerCase().includes(term) ||
        (p.barcode && p.barcode.includes(term))
      )
    ).slice(0, 5);
  }, [products, manualItemName]);

  const selectProduct = async (p: Product) => {
    setSelectedProduct(p);
    setManualItemName(p.Name);
    setManualCategoryName(p.categoryName || '');
    setSelectedCategoryId(p.categoryId || '');
    const suggestion = await priceIntelligenceService.getSuggestedPrice(p.ProductID, 'PURCHASE', header.supplier_id);
    setTempPrice(suggestion.suggestedPrice || p.CostPrice || p.UnitPrice);
    setShowSearchDropdown(false);
    qtyInputRef.current?.focus();
  };

  const handlePostInvoice = async () => {
    if (isDuplicate || isLocked || isSaving) return;
    if (!header.invoice_number || !header.supplier_id) {
      addToast("يرجى إكمال بيانات الفاتورة والمورد", "warning");
      return;
    }
    
    setIsSaving(true);
    try {
      const nextStatus = InvoiceWorkflowEngine.determineNextStatus(vTotalSum, header.payment_method === 'Cash' ? vTotalSum : 0, 'PENDING');
      const res = await addInvoice({
        type: 'PURCHASE',
        payload: { 
          supplierId: header.supplier_id, 
          items, 
          total: vTotalSum, 
          invoiceId: header.invoice_number,
          id: editingInvoiceId 
        },
        options: { 
          isCash: header.payment_method === 'Cash', 
          invoiceStatus: nextStatus, 
          isReturn: header.isReturn, 
          currency,
          date: header.date
        }
      });

      if (res.success) { 
        localStorage.removeItem(DRAFT_KEY); 
        setEditingInvoiceId(null); 
        refreshGlobal(); 
        onNavigate?.('dashboard'); 
      }
    } catch (err: any) {
      addToast(err.message || "فشل الحفظ", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f7f8fa] font-['Cairo'] w-full max-w-7xl mx-auto relative overflow-x-hidden" dir="rtl">
      {/* HEADER SECTION */}
      <header className="bg-white border-b border-slate-100 p-4 shrink-0 z-50 shadow-sm space-y-4">
        {/* Top Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onNavigate?.('dashboard')} 
              className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-[#1E4D4D] hover:bg-slate-100 transition-all"
              title="الرجوع للرئيسية"
            >
              <ArrowRight size={20} />
            </button>
            <div className="w-10 h-10 bg-[#1E4D4D]/5 rounded-xl flex items-center justify-center text-[#1E4D4D]">
              <ShoppingBag size={20} />
            </div>
            <div className="text-right">
              <h2 className="text-lg font-black text-[#1E4D4D]">مشتريات</h2>
              <p className="text-[10px] font-bold text-slate-400"># ---</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
             <button 
              onClick={() => setHeader({...header, isReturn: !header.isReturn})}
              className={`h-10 px-4 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${header.isReturn ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
            >
              <RotateCcw size={14} />
              <span>مرتجع؟</span>
            </button>

            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
              <button 
                onClick={() => setHeader({...header, payment_method: 'Cash'})}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${header.payment_method === 'Cash' ? 'bg-[#064e3b] text-white shadow-sm' : 'text-slate-400'}`}
              >
                نقداً
              </button>
              <button 
                onClick={() => setHeader({...header, payment_method: 'Credit'})}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${header.payment_method === 'Credit' ? 'bg-[#7f1d1d] text-white shadow-sm' : 'text-slate-400'}`}
              >
                آجل
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PrintMenu data={{ items, totalAmount: vTotalSum }} type="PURCHASE" items={items} />
            
            <button 
              onClick={() => onNavigate?.('invoices-archive', { filter: 'PURCHASE' })} 
              className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-[#1E4D4D] hover:bg-slate-100 transition-all"
              title="سجل المشتريات"
            >
              <History size={20} />
            </button>
          </div>
        </div>

        {/* Middle Row */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
             <select 
                disabled={isLocked || isRecovery}
                className="w-full h-[48px] bg-slate-50 border border-slate-100 rounded-xl pr-4 pl-10 text-sm font-black text-[#1E4D4D] outline-none focus:border-[#1E4D4D] appearance-none text-right"
                value={header.supplier_id}
                onChange={e => setHeader({...header, supplier_id: e.target.value})}
              >
                <option value="">اسم المورد...</option>
                {suppliers.map(s => <option key={s.Supplier_ID} value={s.Supplier_ID}>{s.Supplier_Name}</option>)}
              </select>
              <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
          </div>
          <div className="w-[120px] relative">
            <input 
              type="date" 
              disabled={isLocked || isRecovery}
              className="w-full h-[48px] bg-slate-50 border border-slate-100 rounded-xl px-2 text-[11px] font-black text-center outline-none focus:border-[#1E4D4D]"
              value={header.date}
              onChange={e => setHeader({...header, date: e.target.value})}
            />
          </div>
        </div>

        {/* Bottom Row */}
        <div className="flex gap-3">
          <div className="w-[120px] relative">
            <input 
              ref={invNumInputRef}
              disabled={isLocked || !!editingInvoiceId || isRecovery}
              className={`w-full h-[48px] bg-slate-50 border rounded-xl px-4 text-sm font-black text-center outline-none transition-all ${isDuplicate ? 'border-red-500 text-red-600' : 'border-slate-100 text-[#1E4D4D] focus:border-[#1E4D4D]'}`}
              value={header.invoice_number}
              onChange={e => setHeader({...header, invoice_number: e.target.value})}
              placeholder="رقم الفاتورة..."
            />
            <Edit3 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
          </div>
          <div className="flex-1">
            <input 
              className="w-full h-[48px] bg-slate-50 border border-slate-100 rounded-xl px-4 text-sm font-black text-right outline-none focus:border-[#1E4D4D]"
              placeholder="ملاحظات الفاتورة..."
              value={header.notes}
              onChange={e => setHeader({...header, notes: e.target.value})}
            />
          </div>
          <div className="w-12 h-[48px] bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-300">
            <Camera size={20} />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-[100px] custom-scrollbar">
        {/* ITEM ENTRY AREA */}
        <div className="flex justify-between items-center px-4 mb-2 gap-3 mt-4">
          <div className="relative flex-1">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input 
              className="w-full h-[48px] bg-white border border-slate-100 rounded-xl pr-10 pl-4 text-sm font-black text-[#1E4D4D] focus:border-[#1E4D4D] transition-all outline-none shadow-sm text-right" 
              placeholder="تصفية البنود المضافة..." 
              value={manualItemName} 
              onChange={e => { setManualItemName(e.target.value); setShowSearchDropdown(true); }} 
              onFocus={() => setShowSearchDropdown(true)}
            />
            
            <AnimatePresence>
              {showSearchDropdown && filteredProducts.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute top-full left-0 right-0 bg-white border border-slate-100 rounded-xl shadow-xl z-[100] mt-1 overflow-hidden"
                >
                  {filteredProducts.map(p => (
                    <button 
                      key={p.ProductID} 
                      onClick={() => selectProduct(p)}
                      className="w-full px-4 py-3 text-right flex justify-between items-center border-b border-slate-50 last:border-0 transition-colors hover:bg-slate-50"
                    >
                      <div>
                        <p className="text-xs font-black text-[#1E4D4D]">{p.Name}</p>
                        <p className="text-[9px] font-bold text-slate-400">{p.categoryName || 'عام'}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-emerald-600">{p.CostPrice || p.UnitPrice} {currency}</p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button 
            disabled={isLocked || isRecovery} 
            onClick={() => { setManualItemName(''); setSearchOpen(true); }}
            className="h-[48px] px-6 border-2 border-[#10B981] text-[#10B981] rounded-xl flex items-center gap-2 text-sm font-black hover:bg-emerald-50 transition-all shrink-0"
          >
            <Plus size={18} />
            <span>إضافة</span>
          </button>
        </div>

        {/* ITEM TABLE */}
        <div className="bg-white mx-4 rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-right border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
              <tr className="h-[44px]">
                <th className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[45%]">الصنف</th>
                <th className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-[15%]">الكمية</th>
                <th className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-[20%]">السعر</th>
                <th className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left w-[20%]">المجموع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-20 text-center">
                    <div className="flex flex-col items-center opacity-20">
                      <Package size={48} className="mb-2" />
                      <p className="text-xs font-black">قائمة الأصناف فارغة</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr 
                    key={item.id} 
                    className="h-[44px] hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => {
                      if (!isLocked && !isRecovery) {
                        setManualItemName(item.name);
                        setTempQty(item.qty);
                        setTempPrice(item.price);
                        setTempExpiry(item.expiryDate || '');
                        setSearchOpen(true);
                      }
                    }}
                  >
                    <td className="px-3">
                      <p className="text-[11px] font-black text-[#1E4D4D] truncate max-w-[120px]">{item.name}</p>
                    </td>
                    <td className="px-2 text-center">
                      <span className="text-[11px] font-black text-[#1E4D4D]">{item.qty}</span>
                    </td>
                    <td className="px-2 text-center">
                      <span className="text-[11px] font-black text-slate-500">{item.price}</span>
                    </td>
                    <td className="px-3 text-left">
                      <p className="text-[11px] font-black text-[#1E4D4D]">{item.sum.toLocaleString()}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* BOTTOM SUMMARY BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 z-[100] max-w-7xl mx-auto shadow-[0_-4px_10px_rgba(0,0,0,0.03)] flex items-center gap-3">
        <div className="w-20 bg-slate-50 h-[56px] rounded-2xl border border-slate-100 flex flex-col items-center justify-center">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">البنود</p>
          <p className="text-sm font-black text-[#1E4D4D]">{items.length}</p>
        </div>

        <div className="flex-1 bg-emerald-50 h-[56px] rounded-2xl border border-emerald-100 flex flex-col items-center justify-center">
          <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">صافي المشتريات</p>
          <p className="text-sm font-black text-emerald-700">{vTotalSum.toLocaleString()} <span className="text-[10px]">AED</span></p>
        </div>

        <button 
          onClick={handlePostInvoice} 
          disabled={items.length === 0 || isDuplicate || isLocked || isSaving || isRecovery} 
          className={`h-[56px] px-8 rounded-2xl font-black text-sm text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 ${isDuplicate || isLocked || isRecovery ? 'bg-red-500' : 'bg-[#1E4D4D]'}`}
        >
          ترحيل السجل
        </button>
      </div>

      {/* POPUP ITEM ENTRY */}
      <Modal 
        isOpen={isSearchOpen} 
        onClose={() => { setSearchOpen(false); setShowSearchDropdown(false); }} 
        title="بيانات الصنف"
        maxWidth="w-full sm:w-[380px]"
        noPadding={true}
        showCloseButton={false}
      >
        <div className="p-3 space-y-3 bg-white" dir="rtl">
          {/* Row 1: اسم الصنف */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500">اسم الصنف</label>
            <div className="relative">
              <input 
                ref={itemNameInputRef}
                className="w-full h-[40px] bg-slate-50 border border-slate-100 rounded-lg px-4 text-xs font-bold text-[#1E4D4D] outline-none focus:border-[#1E4D4D]"
                placeholder="ابحث عن صنف أو اكتب اسماً جديداً..." 
                value={manualItemName} 
                onChange={e => { setManualItemName(e.target.value); setShowSearchDropdown(true); }} 
                onFocus={() => setShowSearchDropdown(true)}
              />
              <AnimatePresence>
                {showSearchDropdown && filteredProducts.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-full left-0 right-0 bg-white border border-slate-100 rounded-lg shadow-xl z-[100] mt-1 overflow-hidden"
                  >
                    {filteredProducts.map(p => (
                      <button 
                        key={p.ProductID} 
                        onClick={() => selectProduct(p)}
                        className="w-full px-4 py-3 text-right hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors"
                      >
                        <p className="text-xs font-bold text-[#1E4D4D]">{p.Name}</p>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Row 2: الكمية (Right) | تاريخ الإنتهاء (Left) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500">الكمية</label>
              <input 
                ref={qtyInputRef} 
                type="number" 
                className="w-full h-[40px] bg-slate-50 border border-slate-100 rounded-lg px-4 text-center text-xs font-bold text-[#1E4D4D] outline-none focus:border-[#1E4D4D]" 
                placeholder="0" 
                value={tempQty} 
                onChange={e => setTempQty(e.target.value)} 
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    expiryInputRef.current?.focus();
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500">تاريخ الصلاحية</label>
              <input 
                ref={expiryInputRef}
                type="date"
                className="w-full h-[40px] bg-slate-50 border border-slate-100 rounded-lg px-4 text-xs font-bold text-[#1E4D4D] outline-none focus:border-[#1E4D4D]"
                value={tempExpiry} 
                onChange={e => setTempExpiry(e.target.value)} 
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    priceInputRef.current?.focus();
                  }
                }}
              />
            </div>
          </div>

          {/* Row 3: السعر (Right) | التصنيف (Left) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500">السعر</label>
              <input 
                ref={priceInputRef} 
                type="number" 
                className="w-full h-[40px] bg-slate-50 border border-slate-100 rounded-lg px-4 text-center text-xs font-bold text-[#1E4D4D] outline-none focus:border-[#1E4D4D]" 
                placeholder="0.00" 
                value={tempPrice} 
                onChange={e => setTempPrice(e.target.value)} 
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    categoryInputRef.current?.focus();
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500">التصنيف</label>
              <select 
                ref={categoryInputRef}
                className="w-full h-[40px] bg-slate-50 border border-slate-100 rounded-lg px-4 text-xs font-bold text-[#1E4D4D] outline-none focus:border-[#1E4D4D] appearance-none"
                value={manualCategoryName} 
                onChange={e => setManualCategoryName(e.target.value)} 
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    noteInputRef.current?.focus();
                  }
                }}
              >
                <option value="">اختر تصنيفاً...</option>
                {['أدوية', 'مستلزمات طبية', 'مستحضرات تجميل', 'مكملات غذائية', 'أجهزة طبية', 'مواد استهلاكية', 'أصناف أخرى'].map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: الإجمالي */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500">الإجمالي</label>
            <div className="w-full h-[40px] bg-emerald-50 border border-emerald-100 rounded-lg flex items-center justify-center">
              <span className="text-xs font-black text-emerald-700">
                {((parseFloat(tempQty as string) || 0) * (parseFloat(tempPrice as string) || 0)).toLocaleString()} {currency}
              </span>
            </div>
          </div>

          {/* Row 5: ملاحظة الصنف */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500">ملاحظة الصنف</label>
            <input 
              ref={noteInputRef}
              className="w-full h-[40px] bg-slate-50 border border-slate-100 rounded-lg px-4 text-xs font-bold text-[#1E4D4D] outline-none focus:border-[#1E4D4D]"
              placeholder="أضف ملاحظة هنا..." 
              value={tempNote} 
              onChange={e => setTempNote(e.target.value)} 
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  finalizeItemAdd();
                }
              }}
            />
          </div>

          {/* Bottom Actions: إضافة (Right) | إلغاء (Left) */}
          <div className="flex gap-3 pt-2 border-t border-slate-50 mt-2">
            <button 
              className="flex-1 h-[40px] bg-[#1E4D4D] text-white rounded-xl text-xs font-black shadow-md active:scale-95 transition-all"
              onClick={finalizeItemAdd}
            >
              إضافة
            </button>
            <button 
              className="flex-1 h-[40px] bg-slate-100 text-slate-500 rounded-xl text-xs font-black active:scale-95 transition-all"
              onClick={() => { setSearchOpen(false); setShowSearchDropdown(false); }}
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PurchasesInvoice;
