
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { db } from '../services/database';
import { Product, InvoiceStatus, InvoiceItem, Purchase, PaymentStatus, Supplier } from '../types';
import { useUI, useInventory, useAccounting } from '../store/AppContext';
import { useAppStore } from '../store/useAppStore';
import { authService } from '../services/auth.service';
import { PurchaseRepository } from '../repositories/PurchaseRepository';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { InvoiceWorkflowEngine } from '../services/logic/InvoiceWorkflowEngine';
import { syncService } from '../services/sync.service';
import { predictionService } from '../services/predictionService';

const DRAFT_KEY = 'pharmaflow_purchase_draft';

export function usePurchases(onNavigate?: (view: any, params?: any) => void) {
  const { addToast, currency, refreshGlobal } = useUI();
  const { addInvoice, suppliers } = useAccounting();
  const { products, categories, addCategory } = useInventory();
  const setEditingInvoiceId = useAppStore(state => state.setEditingInvoiceId);
  const editingInvoiceId = useAppStore(state => state.editingInvoiceId);
  const systemStatus = useAppStore(state => state.systemStatus);
  const isRecovery = systemStatus === 'RECOVERY_MODE';
  
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');

  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);

  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [hasDependencies, setHasDependencies] = useState(false);
  
  const [isAdjustmentsOpen, setIsAdjustmentsOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [showAIConfirmModal, setShowAIConfirmModal] = useState(false);
  const [aiParsedData, setAIParsedData] = useState<any>(null);
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
  const [selectedIndex, setSelectedIndex] = useState(-1);
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
    isReturn: false,
    attachment: ''
  });

  const resetInvoiceState = useCallback(() => {
    setHeader({
      invoice_number: '',
      supplier_id: '',
      payment_method: 'Cash',
      status: 'DRAFT',
      payment_status: 'Unpaid',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      isReturn: false,
      attachment: ''
    });
    setItems([]);
    setAdjData({ discountPercent: 0, otherFees: 0, tax: 0 });
    setSupplierSearchTerm('');
    setEditingInvoiceId(null);
    setAIParsedData(null);
    setShowAIConfirmModal(false);
  }, [setEditingInvoiceId]);

  const [isDateLockedStatus, setIsDateLockedStatus] = useState(false);

  // Smart Prediction for Products
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (manualItemName.trim()) {
        const results = await predictionService.searchProducts(manualItemName);
        setFilteredProducts(results);
      } else {
        setFilteredProducts([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [manualItemName]);

  // Smart Prediction for Suppliers
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (supplierSearchTerm.trim()) {
        const results = await predictionService.searchSuppliers(supplierSearchTerm);
        setFilteredSuppliers(results);
      } else {
        setFilteredSuppliers([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [supplierSearchTerm]);

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
        const inv = await InvoiceRepository.getPurchaseById(editingInvoiceId);
        if (inv) {
          setHeader({
            invoice_number: inv.invoiceId,
            supplier_id: inv.partnerId,
            payment_method: inv.status === 'PAID' ? 'Cash' : 'Credit',
            status: inv.invoiceStatus,
            payment_status: inv.payment_status || 'Unpaid',
            date: inv.date,
            notes: inv.notes || '',
            attachment: (inv as any).attachment || '',
            isReturn: inv.invoiceType === 'مرتجع'
          });
          setItems(inv.items);
          setAdjData({
            discountPercent: (inv as any).discountPercent || 0,
            otherFees: (inv as any).otherFees || 0,
            tax: inv.tax || 0
          });
          
          const deps = await InvoiceRepository.checkHasDependencies(editingInvoiceId, 'PURCHASE');
          setHasDependencies(deps);
        }
      } else {
        resetInvoiceState();
      }
    };
    fetchEditingInvoice();
  }, [editingInvoiceId, resetInvoiceState]);

  useEffect(() => {
    if (isLocked && editingInvoiceId) {
      const timer = setTimeout(async () => {
        await db.updatePurchaseNotes(editingInvoiceId, header.notes);
        await db.updatePurchaseAttachment(editingInvoiceId, header.attachment || '');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [header.notes, header.attachment, isLocked, editingInvoiceId]);

  useEffect(() => {
    if (isLocked || isSaving) return;
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ header, items, adjData }));
    }, 1000);
    return () => clearTimeout(timer);
  }, [header, items, adjData, isLocked, isSaving]);

  const handleSupplierSearch = (val: string) => {
    setSupplierSearchTerm(val);
    setShowSupplierDropdown(true);
  };

  const selectSupplier = (s: any) => {
    setHeader(prev => ({ ...prev, supplier_id: s.id }));
    setSupplierSearchTerm(s.Supplier_Name);
    setShowSupplierDropdown(false);
    
    // Auto-fill supplier info
    if (s.Balance !== undefined) {
      addToast(`رصيد المورد الحالي: ${s.Balance} ${currency}`, "info");
    }
  };

  const handleSupplierBlur = () => {
    // Wait a bit for click events on dropdown
    setTimeout(() => {
      setShowSupplierDropdown(false);
      if (supplierSearchTerm && !suppliers.find(s => s.Supplier_Name === supplierSearchTerm)) {
        // Check for similarity
        const similarSupplier = suppliers.find(s => {
          const sName = s.Supplier_Name.toLowerCase();
          const tName = supplierSearchTerm.toLowerCase();
          return sName.includes(tName) || tName.includes(sName);
        });

        if (similarSupplier) {
          if (window.confirm(`هل تقصد [${similarSupplier.Supplier_Name}]؟`)) {
            selectSupplier(similarSupplier);
            return;
          }
        }

        setNewSupplierName(supplierSearchTerm);
        setIsAddSupplierModalOpen(true);
      }
    }, 200);
  };

  const confirmAddSupplier = async () => {
    try {
      const { db } = await import('../services/database');
      const newId = `SUP-${Date.now()}`;
      const newSup: Supplier = {
        id: newId,
        Supplier_ID: newId,
        Supplier_Name: newSupplierName,
        Phone: '',
        Address: '',
        Balance: 0,
        openingBalance: 0,
        Is_Active: true,
        Created_At: new Date().toISOString()
      };
      
      await db.saveSupplier(newSup);
      await refreshGlobal();
      
      setHeader(prev => ({ ...prev, supplier_id: newId }));
      setSupplierSearchTerm(newSupplierName);
      setIsAddSupplierModalOpen(false);
      addToast(`تم إضافة المورد ${newSupplierName} بنجاح`, "success");
    } catch (error) {
      console.error("Failed to add supplier", error);
      addToast("فشل في إضافة المورد", "error");
    }
  };

  const cancelAddSupplier = () => {
    setIsAddSupplierModalOpen(false);
    setSupplierSearchTerm('');
    setHeader(prev => ({ ...prev, supplier_id: '' }));
  };

  const handleAIImport = async (file: File | string) => {
    setIsAIProcessing(true);
    try {
      let base64 = '';
      let mimeType = '';
      if (typeof file === 'string') {
        base64 = file.split(',')[1];
        mimeType = file.split(',')[0].split(':')[1].split(';')[0];
      } else {
        const reader = new FileReader();
        base64 = await new Promise((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        mimeType = file.type;
      }

      const { aiDocumentService } = await import('../services/aiDocumentService');
      const parsed = await aiDocumentService.parseInvoice(base64, mimeType);

      if (parsed) {
        setAIParsedData(parsed);
        setShowAIConfirmModal(true);
        setHeader(prev => ({ ...prev, attachment: typeof file === 'string' ? file : `data:${mimeType};base64,${base64}` }));
      } else {
        addToast("فشل في تحليل المستند", "error");
      }
    } catch (error) {
      console.error("AI Import Error:", error);
      addToast("حدث خطأ أثناء معالجة المستند", "error");
    } finally {
      setIsAIProcessing(false);
    }
  };

  const applyAIParsedData = async () => {
    if (!aiParsedData) return;

    // Find or create supplier
    let supplier = suppliers.find(s => s.Supplier_Name.toLowerCase().includes(aiParsedData.supplier_name.toLowerCase()) || aiParsedData.supplier_name.toLowerCase().includes(s.Supplier_Name.toLowerCase()));
    
    if (!supplier) {
      if (window.confirm(`المورد "${aiParsedData.supplier_name}" غير موجود. هل تريد إضافته؟`)) {
        const newId = `SUP-${Date.now()}`;
        const newSup: Supplier = {
          id: newId,
          Supplier_ID: newId,
          Supplier_Name: aiParsedData.supplier_name,
          Balance: 0,
          openingBalance: 0,
          Is_Active: true,
          Created_At: new Date().toISOString()
        };
        await db.saveSupplier(newSup);
        await refreshGlobal();
        supplier = newSup;
      }
    }

    setHeader(prev => ({
      ...prev,
      invoice_number: aiParsedData.invoice_number,
      supplier_id: supplier?.id || '',
      payment_method: aiParsedData.payment_method,
      isReturn: aiParsedData.is_return,
      date: aiParsedData.date,
      notes: aiParsedData.notes
    }));
    setSupplierSearchTerm(supplier?.Supplier_Name || aiParsedData.supplier_name);

    // Map items
    const mappedItems: InvoiceItem[] = [];
    for (const item of aiParsedData.items) {
      const product = products.find(p => p.Name.toLowerCase().includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(p.Name.toLowerCase()));
      
      mappedItems.push({
        id: `PUR-DET-${Date.now()}-${Math.random()}`,
        parent_id: aiParsedData.invoice_number,
        product_id: product?.id || `manual-${Date.now()}-${Math.random()}`,
        name: item.name,
        qty: item.qty,
        price: item.price,
        sum: item.qty * item.price,
        row_order: mappedItems.length + 1,
        expiryDate: item.expiryDate,
        categoryId: product?.categoryId || ''
      } as any);
    }
    setItems(mappedItems);
    setShowAIConfirmModal(false);
    addToast("تم تعبئة البيانات بنجاح", "success");
  };

  const vTotalSum = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
    const discount = subtotal * (adjData.discountPercent / 100);
    return subtotal - discount + adjData.otherFees + adjData.tax;
  }, [items, adjData]);

  const selectProduct = (p: Product) => {
    setSelectedProduct(p);
    setManualItemName(p.Name);
    setTempPrice(p.LastPurchasePrice || p.CostPrice || '');
    setTempQty(1);
    
    // Auto-fill stock info
    if (p.StockQuantity !== undefined) {
      addToast(`المخزون الحالي: ${p.StockQuantity}`, "info");
    }
    if (p.LastPurchasePrice) {
      addToast(`آخر سعر شراء: ${p.LastPurchasePrice} ${currency}`, "info");
    }

    setSearchTerm('');
    setShowSearchDropdown(false);
    setSelectedIndex(-1);
    qtyInputRef.current?.focus();
  };

  const handleSearchKeyDown = (e: any) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredProducts.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0) {
        e.preventDefault();
        selectProduct(filteredProducts[selectedIndex]);
      } else if (manualItemName) {
        e.preventDefault();
        qtyInputRef.current?.focus();
      }
    } else if (e.key === 'Escape') {
      setShowSearchDropdown(false);
      setSelectedIndex(-1);
    }
  };

  const finalizeItemAdd = () => {
    if (!manualItemName || !tempQty || !tempPrice) {
      addToast("يرجى إكمال بيانات الصنف", "error");
      return;
    }

    const newItem: InvoiceItem = {
      id: `PUR-DET-${Date.now()}`,
      parent_id: header.invoice_number,
      product_id: selectedProduct?.id || `manual-${Date.now()}`,
      name: manualItemName,
      qty: Number(tempQty),
      price: Number(tempPrice),
      sum: Number(tempQty) * Number(tempPrice),
      row_order: items.length + 1,
      expiryDate: tempExpiry,
      notes: tempNote,
      categoryId: selectedCategoryId || selectedProduct?.categoryId
    } as any;

    setItems([...items, newItem]);
    
    setSelectedProduct(null);
    setManualItemName('');
    setTempQty('');
    setTempPrice('');
    setTempExpiry('');
    setTempNote('');
    setSelectedCategoryId('');
    setManualCategoryName('');
    setShowCategoryDropdown(false);
    itemNameInputRef.current?.focus();
  };

  const handlePost = async () => {
    if (!header.supplier_id) {
      addToast("يرجى اختيار المورد", "error");
      return;
    }
    if (items.length === 0) {
      addToast("الفاتورة فارغة", "error");
      return;
    }

    setIsSaving(true);
    try {
      const purchaseData: any = {
        invoiceId: header.invoice_number || `PUR-${Date.now()}`,
        partnerId: header.supplier_id,
        date: header.date,
        items,
        subtotal: items.reduce((sum, i) => sum + i.sum, 0),
        discountPercent: adjData.discountPercent,
        otherFees: adjData.otherFees,
        tax: adjData.tax,
        totalAmount: vTotalSum,
        status: header.payment_method === 'Cash' ? 'PAID' : 'UNPAID',
        invoiceStatus: 'POSTED',
        payment_status: header.payment_method === 'Cash' ? 'Paid' : 'Unpaid',
        paidAmount: header.payment_method === 'Cash' ? vTotalSum : 0,
        notes: header.notes,
        invoiceType: header.isReturn ? 'مرتجع' : 'شراء',
        createdBy: authService.getCurrentUser()?.user_id || 'system'
      };

      if (editingInvoiceId) {
        // Update logic if needed, but PurchaseRepository doesn't have update.
        // We can use InvoiceRepository.savePurchase if it handles updates.
        await InvoiceRepository.savePurchase(header.supplier_id, items, vTotalSum, editingInvoiceId, header.payment_method === 'Cash', currency, 'POSTED', undefined, undefined, undefined, header.attachment);
        addToast("تم تحديث الفاتورة بنجاح", "success");
      } else {
        await InvoiceRepository.savePurchase(header.supplier_id, items, vTotalSum, header.invoice_number, header.payment_method === 'Cash', currency, 'POSTED', undefined, undefined, undefined, header.attachment);
        addToast("تم حفظ وترحيل الفاتورة", "success");
        localStorage.removeItem(DRAFT_KEY);
      }

      refreshGlobal();
      onNavigate?.('dashboard');
    } catch (error) {
      console.error("Save error", error);
      addToast("فشل في حفظ الفاتورة", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    // Implementation for export
  };

  const printData = {
    invoiceId: header.invoice_number,
    title: header.isReturn ? "فاتورة مرتجع مشتريات" : "فاتورة مشتريات",
    invoiceNumber: header.invoice_number,
    date: header.date,
    customerName: suppliers.find(s => s.id === header.supplier_id)?.Supplier_Name || 'مورد عام',
    items: items.map(i => ({
      name: i.name,
      qty: i.qty,
      price: i.price,
      total: i.sum
    })),
    total: vTotalSum,
    currency
  };

  return {
    items, setItems,
    searchTerm, setSearchTerm,
    isSearchOpen, setSearchOpen,
    isAutoSaving,
    isSaving,
    isDuplicate,
    hasDependencies,
    isAdjustmentsOpen, setIsAdjustmentsOpen,
    isCameraOpen, setIsCameraOpen,
    isViewerOpen, setIsViewerOpen,
    adjData, setAdjData,
    selectedProduct, setSelectedProduct,
    manualItemName, setManualItemName,
    tempQty, setTempQty,
    tempPrice, setTempPrice,
    tempExpiry, setTempExpiry,
    tempNote, setTempNote,
    showSearchDropdown, setShowSearchDropdown,
    manualCategoryName, setManualCategoryName,
    selectedCategoryId, setSelectedCategoryId,
    showCategoryDropdown, setShowCategoryDropdown,
    invNumInputRef,
    itemNameInputRef,
    qtyInputRef,
    priceInputRef,
    expiryInputRef,
    noteInputRef,
    categoryInputRef,
    header, setHeader,
    isLocked,
    vTotalSum,
    filteredProducts,
    filteredSuppliers,
    selectedIndex,
    setSelectedIndex,
    supplierSearchTerm,
    setSupplierSearchTerm,
    showSupplierDropdown,
    setShowSupplierDropdown,
    isAddSupplierModalOpen,
    setIsAddSupplierModalOpen,
    newSupplierName,
    handleSupplierSearch,
    selectSupplier,
    handleSupplierBlur,
    confirmAddSupplier,
    cancelAddSupplier,
    selectProduct,
    finalizeItemAdd,
    handleSearchKeyDown,
    handlePost,
    currency,
    isRecovery,
    suppliers,
    categories,
    addCategory,
    handleExport,
    printData,
    editingInvoiceId,
    isAIProcessing,
    showAIConfirmModal,
    setShowAIConfirmModal,
    handleAIImport,
    applyAIParsedData,
    resetInvoiceState
  };
}
