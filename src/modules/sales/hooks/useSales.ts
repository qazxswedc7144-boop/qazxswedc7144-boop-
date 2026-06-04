
import { useState, useMemo, useEffect, useRef, useCallback, KeyboardEvent } from 'react';
import { db } from '@/core/db';
import { Product, InvoiceStatus, InvoiceItem, PaymentStatus, Supplier } from '@/types';
import { useUI, useInventory, useAccounting } from '@/contexts/AppContext';
import { useAppStore } from '@/hooks/useAppStore';
import { authService } from '@/modules/auth/services/authService';
import { InvoiceRepository } from '@/database/repositories/invoice.repository';
import { priceIntelligenceService } from '@/modules/inventory/services/priceIntelligenceService';
import { InvoiceWorkflowEngine } from '@/modules/sales/services/InvoiceWorkflowEngine';
import { ExportService } from '@/services/data/exportService';
import { predictionService } from '@/modules/ai/services/predictionService';
import { auditLogService } from '@/services/audit/auditLog';
import { useAppNotification } from '@/context/NotificationContext';

const DRAFT_KEY = 'pharmaflow_sales_draft';

export const useSales = (onNavigate?: (view: any, params?: any) => void) => {
  const { addToast, currency, refreshGlobal } = useUI();
  const { showNotification } = useAppNotification();
  const { addInvoice, customers } = useAccounting();
  const { products } = useInventory();
  const setEditingInvoiceId = useAppStore(state => state.setEditingInvoiceId);
  const editingInvoiceId = useAppStore(state => state.editingInvoiceId);
  const systemStatus = useAppStore(state => state.systemStatus);
  const isRecovery = systemStatus === 'RECOVERY_MODE';
  
  const user = authService.getCurrentUser();
  const isAdmin = user?.Role === 'Admin';
  
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savePhase, setSavePhase] = useState<'idle' | 'saving' | 'failed'>('idle');
  const [isAdding, setIsAdding] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [hasDependencies, setHasDependencies] = useState(false);
  
  const [adjData, setAdjData] = useState({ discountPercent: 0, otherFees: 0, tax: 0 });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [manualItemName, setManualItemName] = useState<string>('');
  const [tempQty, setTempQty] = useState<number | string>('');
  const [tempPrice, setTempPrice] = useState<number | string>('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const [tempExpiry, setTempExpiry] = useState<string>('');
  const [tempNote, setTempNote] = useState<string>('');
  const [categoryName, setCategoryName] = useState<string>('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);
  const [isAdjustmentsOpen, setIsAdjustmentsOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');

  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Supplier[]>([]);
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(-1);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);

  const itemNameInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const expiryInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const categoryInputRef = useRef<HTMLSelectElement>(null);

  const [header, setHeader] = useState({ 
    invoice_number: '', customer_id: '', payment_method: 'Cash',
    status: 'DRAFT' as InvoiceStatus, payment_status: 'Unpaid' as PaymentStatus,
    date: new Date().toISOString().split('T')[0], isReturn: false,
    notes: '', warehouse: '', attachment: ''
  });

  const resetInvoiceState = useCallback(async () => {
    try {
      const nextNum = await InvoiceRepository.generateInvoiceNumber();
      setHeader({
        invoice_number: nextNum,
        customer_id: '',
        payment_method: 'Cash',
        status: 'DRAFT',
        payment_status: 'Unpaid',
        date: new Date().toISOString().split('T')[0],
        isReturn: false,
        notes: '',
        warehouse: '',
        attachment: ''
      });
      setItems([]);
      setAdjData({ discountPercent: 0, otherFees: 0, tax: 0 });
      setCustomerSearchTerm('');
      setEditingInvoiceId(null);
    } catch (e) {
      console.error("resetInvoiceState failed:", e);
    }
  }, [setEditingInvoiceId]);

  // Smart Prediction for Products
  useEffect(() => {
    const timer = setTimeout(() => {
      (async () => {
        try {
          if (manualItemName.trim()) {
            const results = await predictionService.searchProducts(manualItemName);
            // Filter products that exist in inventory with stock > 0
            setFilteredProducts(results.filter(p => (p.StockQuantity || 0) > 0));
          } else {
            setFilteredProducts([]);
          }
        } catch (e) {
          console.error("Product prediction failed:", e);
        }
      })().catch(err => console.error("[predictionService] Fatal:", err));
    }, 300);
    return () => clearTimeout(timer);
  }, [manualItemName]);

  // Smart Prediction for Customers from Dexie directly
  useEffect(() => {
    const timer = setTimeout(() => {
      (async () => {
        const term = customerSearchTerm.trim();
        if (term.length < 2) {
          setFilteredCustomers([]);
          return;
        }

        setIsSearchingCustomers(true);
        try {
          const results = await db.db.customers
            .filter(c => 
              (c.Supplier_Name.toLowerCase().includes(term.toLowerCase()) || 
               c.Supplier_ID.toLowerCase().includes(term.toLowerCase())) &&
              c.Is_Active !== false
            )
            .limit(10)
            .toArray();

          setFilteredCustomers(results);
        } catch (err) {
          console.error('Error searching customers:', err);
          try {
            // Fallback to local search
            const localResults = await predictionService.searchCustomers(term);
            setFilteredCustomers(localResults);
          } catch (e2) {
            console.error("Fallback search also failed:", e2);
          }
        } finally {
          setIsSearchingCustomers(false);
        }
      })().catch(err => console.error("[CustomerSearch] Fatal:", err));
    }, 400);

    return () => clearTimeout(timer);
  }, [customerSearchTerm]);

  const handleCustomerSearch = useCallback((val: string) => {
    setCustomerSearchTerm(val);
    setShowCustomerDropdown(true);
    setSelectedCustomerIndex(-1);
  }, []);

  const handleCustomerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedCustomerIndex(prev => Math.min(prev + 1, filteredCustomers.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedCustomerIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      if (selectedCustomerIndex >= 0) {
        e.preventDefault();
        selectCustomer(filteredCustomers[selectedCustomerIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowCustomerDropdown(false);
      setSelectedCustomerIndex(-1);
    }
  }, [filteredCustomers, selectedCustomerIndex]);

  const selectCustomer = useCallback((c: any) => {
    setHeader(prev => ({ ...prev, customer_id: c.id }));
    setCustomerSearchTerm(c.Supplier_Name);
    setShowCustomerDropdown(false);
  }, []);

  const handleCustomerBlur = useCallback(() => {
    setTimeout(() => {
      setShowCustomerDropdown(false);
      if (customerSearchTerm && !customers.find(c => c.Supplier_Name === customerSearchTerm)) {
        setNewCustomerName(customerSearchTerm);
        setIsAddCustomerModalOpen(true);
      }
    }, 200);
  }, [customerSearchTerm, customers]);

  const confirmAddCustomer = useCallback(async () => {
    try {
      const newId = `CUS-${Date.now()}`;
      const newCus: Supplier = {
        id: newId,
        Supplier_ID: newId,
        Supplier_Name: newCustomerName,
        Phone: '',
        Address: '',
        Balance: 0,
        openingBalance: 0,
        Is_Active: true,
        Created_At: new Date().toISOString()
      } as any;
      
      await db.saveCustomer(newCus);
      await refreshGlobal();
      
      setHeader(prev => ({ ...prev, customer_id: newId }));
      setCustomerSearchTerm(newCustomerName);
      setIsAddCustomerModalOpen(false);
      addToast(`تم إضافة العميل ${newCustomerName} بنجاح`, "success");
    } catch (error) {
      console.error("Failed to add customer", error);
      addToast("فشل في إضافة العميل", "error");
    }
  }, [newCustomerName, refreshGlobal, addToast]);

  const cancelAddCustomer = useCallback(() => {
    setIsAddCustomerModalOpen(false);
    setCustomerSearchTerm('');
    setHeader(prev => ({ ...prev, customer_id: '' }));
  }, []);

  const [isPeriodLockedStatus, setIsPeriodLockedStatus] = useState(false);
  
  useEffect(() => {
    const checkLock = async () => {
      try {
        const locked = await db.isDateLocked(header.date || "");
        setIsPeriodLockedStatus(locked);
      } catch (e) {
        console.error("checkLock failed:", e);
      }
    };
    checkLock().catch(e => console.error("[useSales] checkLock fatal error:", e));
  }, [header.date]);

  const isLocked = useMemo(() => {
    const isWorkflowLocked = InvoiceWorkflowEngine.isLocked(header.status);
    const isPeriodLocked = isPeriodLockedStatus && !isAdmin;
    return isWorkflowLocked || isPeriodLocked || hasDependencies;
  }, [header.status, isPeriodLockedStatus, isAdmin, hasDependencies]);

  useEffect(() => {
    const init = async () => {
      try {
        if (editingInvoiceId) {
          const inv = await InvoiceRepository.getUnifiedInvoice(editingInvoiceId);
          const deps = await InvoiceRepository.checkHasDependencies(editingInvoiceId, 'SALE');
          setHasDependencies(deps);

          if (inv) {
            const h = {
              invoice_number: inv.invoiceNumber, customer_id: inv.partnerId,
              payment_method: inv.paymentStatus, status: inv.documentStatus,
              payment_status: inv.financialStatus, date: inv.date.split('T')[0],
              isReturn: inv.isReturn,
              notes: (inv as any).notes || '',
              attachment: (inv as any).attachment || '',
              warehouse: (inv as any).warehouse || ''
            };
            setHeader(h);
            setItems(inv.items);
            return;
          }
        } else {
          // RULE: everything empty, ONLY invoice_number is auto-filled
          await resetInvoiceState();
        }
      } catch (e) {
        console.error("Init useSales failed:", e);
      }
    };
    init().catch(e => console.error("[useSales] Init failed:", e));
  }, [editingInvoiceId, resetInvoiceState]);

  useEffect(() => {
    if (header.invoice_number) {
      InvoiceRepository.isNumberDuplicate(header.invoice_number, 'SALE', editingInvoiceId)
        .then(setIsDuplicate)
        .catch(e => console.error("isDuplicate check failed:", e));
    }
  }, [header.invoice_number, editingInvoiceId]);

  const vTotalSum = useMemo(() => {
    const sub = items.reduce((acc, it) => acc + (it.sum || 0), 0);
    return sub - (sub * (adjData.discountPercent / 100)) + adjData.otherFees + adjData.tax;
  }, [items, adjData]);

  const persistToDB = useCallback(async () => {
    try {
      const isPeriodLocked = await db.isDateLocked(header.date || "") && !isAdmin;
      if (isPeriodLocked || isDuplicate) return;
      
      setIsAutoSaving(true);
      
      if (isLocked) {
        if (editingInvoiceId) {
          await db.updateSaleNotes(editingInvoiceId, header.notes);
          await db.updateSaleAttachment(editingInvoiceId, header.attachment || '');
        }
      } else if (header.status === 'DRAFT' || header.status === 'DRAFT_EDIT') {
        if (items.length > 0) {
          await addInvoice({
            type: 'SALE',
            payload: { 
              customerId: header.customer_id, 
              items, 
              total: vTotalSum, 
              invoiceId: header.invoice_number,
              id: editingInvoiceId || undefined,
              notes: header.notes,
              attachment: header.attachment
            },
            options: { 
              isCash: header.payment_method === 'Cash', 
              paymentStatus: header.payment_method as any,
              isReturn: header.isReturn, 
              currency,
              invoiceStatus: header.status,
              date: header.date
            }
          });
        }
      }
    } catch (e) {
      console.error("Auto-persist failed:", e);
    } finally {
      setIsAutoSaving(false);
    }
  }, [header, items, vTotalSum, isDuplicate, isAdmin, isLocked, editingInvoiceId, currency]);

  const selectProduct = useCallback(async (p: Product) => {
    try {
      setSelectedProduct(p);
      setManualItemName(p.Name || p.name);
      setCategoryName(p.categoryName || (p as any).category || '');
      setTempExpiry(p.ExpiryDate || (p as any).expiryDate || '');
      const suggestion = await priceIntelligenceService.getSuggestedPrice(p.id, 'SALE', header.customer_id);
      setTempPrice(suggestion.suggestedPrice || p.UnitPrice || p.price || 0);
      setTempQty(1);
      
      if ((p.StockQuantity || p.stock) !== undefined) {
        const stock = p.StockQuantity || p.stock || 0;
        addToast(`المخزون المتاح: ${stock}`, stock > 0 ? "info" : "error");
      }
      
      setShowSearchDropdown(false);
      setIsDetailModalOpen(true);
    } catch (e) {
      console.error("selectProduct failed:", e);
    }
  }, [header.customer_id, addToast, setCategoryName, setTempExpiry, setTempPrice, setTempQty, setSelectedProduct, setIsDetailModalOpen]);

  const finalizeItemAdd = useCallback(async (closeModal = true) => {
    try {
      if (isLocked) return;
      const name = manualItemName.trim();
      if (!name) return;
      
      setIsAdding(true);
      // Snappy feedback: use small timeout and then optimistic update
      await new Promise(resolve => setTimeout(resolve, 300));

      let prod = selectedProduct;
      if (!prod || (prod.Name || prod.name || '').toLowerCase() !== name.toLowerCase()) {
        prod = products.find(p => (p.Name || p.name || '').toLowerCase() === name.toLowerCase()) || null;
      }
      
      const newItem: InvoiceItem = {
        id: db.generateId('SALE_DET'), parent_id: header.invoice_number,
        product_id: prod?.id || db.generateId('NEW'),
        name: prod?.Name || name, 
        price: parseFloat(tempPrice as any) || 0, 
        qty: Number(tempQty) || 1,
        sum: (Number(tempQty) || 1) * (parseFloat(tempPrice as any) || 0), 
        row_order: items.length + 1,
        expiryDate: tempExpiry || prod?.ExpiryDate || (prod as any)?.expiryDate || '',
        category: categoryName || prod?.categoryName || (prod as any)?.category || '',
        notes: tempNote
      };
      setItems(prev => [...prev, newItem]);
      
      if (closeModal) {
        setIsDetailModalOpen(false);
        setManualItemName(''); setTempQty(''); setTempPrice(''); setTempExpiry(''); setTempNote(''); setSelectedProduct(null);
        setSelectedIndex(-1);
        setShowSearchDropdown(false);
        itemNameInputRef.current?.focus();
      } else {
        setManualItemName(''); setTempQty(''); setTempPrice(''); setTempExpiry(''); setTempNote(''); setSelectedProduct(null);
        itemNameInputRef.current?.focus();
      }
      
      setIsAdding(false);
      addToast("تمت إضافة الصنف ✅", "success");
    } catch (e) {
      console.error("finalizeItemAdd failed:", e);
      setIsAdding(false);
    }
  }, [isLocked, manualItemName, selectedProduct, products, items.length, header.invoice_number, tempPrice, tempQty, tempExpiry, tempNote, addToast]);

  const handleSearchKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredProducts.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0) {
        e.preventDefault();
        const pToSelect = filteredProducts[selectedIndex];
        if (pToSelect) {
          selectProduct(pToSelect);
        }
      } else if (manualItemName) {
        e.preventDefault();
        qtyInputRef.current?.focus();
      }
    } else if (e.key === 'Escape') {
      setShowSearchDropdown(false);
      setSelectedIndex(-1);
    }
  }, [filteredProducts, selectedIndex, selectProduct, manualItemName]);

  const updateItem = useCallback((id: string, field: keyof InvoiceItem, val: any) => {
    if (isLocked) return;
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const next = { ...item, [field]: val };
        next.sum = (parseFloat(next.qty as any) || 0) * (parseFloat(next.price as any) || 0);
        return next;
      }
      return item;
    }));
  }, [isLocked]);

  const removeItem = useCallback((id: string) => {
    if (isLocked) return;
    setItems(prev => prev.filter(item => item.id !== id));
  }, [isLocked]);

  const handlePost = useCallback(async () => {
    if (savePhase === 'saving') return;
    if (items.length === 0 || isLocked || isDuplicate) return;
    
    // OPTIMISTIC: Show success immediately and block UI only enough to navigate
    showNotification('⌛ جاري طباعة الإيصال وترحيل الصندوق...', 'info');
    addToast("جاري الحفظ والمزامنة... ⏳", "info");
    const navPromise = new Promise(res => setTimeout(res, 500)); // Briefly show toast
    
    setIsSaving(true);
    setSavePhase('saving');
    try {
      const nextStatus = InvoiceWorkflowEngine.determineNextStatus(vTotalSum, header.payment_method === 'Cash' ? vTotalSum : 0, 'PENDING');
      
      const savePromise = (async () => {
        const r = await addInvoice({
          type: 'SALE',
          payload: { 
            customerId: header.customer_id, 
            items, 
            total: vTotalSum, 
            invoiceId: header.invoice_number,
            id: editingInvoiceId || undefined,
            notes: header.notes,
            attachment: header.attachment,
            date: header.date
          },
          options: { 
            isCash: header.payment_method === 'Cash', 
            paymentStatus: header.payment_method as any,
            invoiceStatus: nextStatus, 
            isReturn: header.isReturn, 
            currency,
            date: header.date
          }
        });
        await navPromise;
        return r;
      })();

      // سباق برمجي: إما يتم الحفظ أو ينتهي الوقت خلال 15 ثانية ويفك تجميد الأزرار تلقائياً
      const res = await Promise.race([
        savePromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('SAVE_TIMEOUT')), 15000)
        )
      ]) as { success: boolean; refId?: string };

      if (res?.success) { 
        setSavePhase('idle');
        showNotification('✅ تم حفظ فاتورة المبيعات وترحيل الصندوق بنجاح', 'success');
        addToast("تم الحفظ والترحيل بنجاح ✅", "success");
        
        await auditLogService.logSale(res.refId || editingInvoiceId || header.invoice_number, `Sale created: ${header.invoice_number}`, { items, total: vTotalSum });
        localStorage.removeItem(DRAFT_KEY); 
        setEditingInvoiceId(null); 
        onNavigate?.('dashboard'); 
      }
    } catch (err: any) {
      setSavePhase('failed');
      const isTimeout = err?.message === 'SAVE_TIMEOUT';
      showNotification(
        isTimeout 
          ? '⚠️ تأخر حفظ الفاتورة؛ تم فك تجميد الواجهة حرصاً على استمرار العمل.' 
          : '❌ فشل في حفظ مبيعات الكاشير', 
        'error'
      );
      addToast(
        isTimeout
          ? 'تأخر حفظ الفاتورة سحابياً؛ تم فك تجميد الواجهة حرصاً على العمل المستمر. راجع مركز المزامنة.'
          : (err?.message || "فشل الحفظ"),
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  }, [items, isLocked, isDuplicate, savePhase, vTotalSum, header, editingInvoiceId, currency, addInvoice, addToast, onNavigate, setEditingInvoiceId, showNotification]);

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'Draft': return 'مسودة 📝';
      case 'Saved': return 'مرحلة (مفتوحة) ✅';
      case 'PartiallyPaid': return 'سداد جزئي 💸';
      case 'Paid': return 'تم السداد 💰';
      case 'Cancelled': return 'ملغاة 🚫';
      case 'Returned': return 'مرتجع 🔄';
      default: return status;
    }
  };

  const handleExport = () => {
    ExportService.exportToExcel(items, `SALE_${Date.now()}`, ['name', 'qty', 'price', 'sum']);
  };

  const printData = useMemo(() => ({
    invoiceId: header.invoice_number,
    items,
    finalTotal: vTotalSum
  }), [header.invoice_number, items, vTotalSum]);

  return {
    items, setItems,
    searchTerm, setSearchTerm,
    isAutoSaving,
    isSaving,
    isAdding,
    isDuplicate,
    hasDependencies,
    adjData, setAdjData,
    selectedProduct, setSelectedProduct,
    manualItemName, setManualItemName,
    tempQty, setTempQty,
    tempPrice, setTempPrice,
    selectedIndex, setSelectedIndex,
    tempExpiry, setTempExpiry,
    tempNote, setTempNote,
    showSearchDropdown, setShowSearchDropdown,
    isDetailModalOpen, setIsDetailModalOpen,
    isConfirmSaveOpen, setIsConfirmSaveOpen,
    isAdjustmentsOpen, setIsAdjustmentsOpen,
    isViewerOpen, setIsViewerOpen,
    itemNameInputRef,
    qtyInputRef,
    priceInputRef,
    expiryInputRef,
    noteInputRef,
    categoryInputRef,
    header, setHeader,
    isPeriodLockedStatus,
    isLocked,
    vTotalSum,
    persistToDB,
    filteredProducts,
    selectProduct,
    finalizeItemAdd,
    handleSearchKeyDown,
    updateItem,
    removeItem,
    handlePost,
    currency,
    isAdmin,
    categoryName,
    setCategoryName,
    isRecovery,
    getStatusLabel,
    handleExport,
    printData,
    customerSearchTerm, setCustomerSearchTerm,
    showCustomerDropdown, setShowCustomerDropdown,
    isAddCustomerModalOpen, setIsAddCustomerModalOpen,
    newCustomerName, setNewCustomerName,
    filteredCustomers,
    handleCustomerSearch,
    handleCustomerKeyDown,
    selectedCustomerIndex,
    isSearchingCustomers,
    selectCustomer,
    handleCustomerBlur,
    confirmAddCustomer,
    cancelAddCustomer,
    resetInvoiceState,
    customers,
    savePhase,
    setSavePhase
  };
};
