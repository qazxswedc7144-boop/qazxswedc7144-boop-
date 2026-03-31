
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
        const draft = localStorage.getItem(DRAFT_KEY);
        if (draft) {
          try {
            const parsed = JSON.parse(draft);
            setHeader(prev => ({ ...prev, ...parsed.header }));
            setItems(parsed.items || []);
            setAdjData(parsed.adjData || { discountPercent: 0, otherFees: 0, tax: 0 });
          } catch (e) {
            console.error("Failed to load draft", e);
          }
        }
      }
    };
    fetchEditingInvoice();
  }, [editingInvoiceId]);

  useEffect(() => {
    if (isLocked || isSaving) return;
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ header, items, adjData }));
    }, 1000);
    return () => clearTimeout(timer);
  }, [header, items, adjData, isLocked, isSaving]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return [];
    return products.filter(p => 
      p.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode?.includes(searchTerm)
    ).slice(0, 5);
  }, [searchTerm, products]);

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchTerm) return [];
    return suppliers.filter(s => 
      s.Supplier_Name.toLowerCase().includes(supplierSearchTerm.toLowerCase())
    ).slice(0, 5);
  }, [supplierSearchTerm, suppliers]);

  const handleSupplierSearch = (val: string) => {
    setSupplierSearchTerm(val);
    setShowSupplierDropdown(true);
    
    // If user typed something and it doesn't match any supplier exactly
    // we don't trigger the modal yet, only on blur or enter if needed.
    // But the requirement says "when writing a name not in DB, activate action"
  };

  const selectSupplier = (s: any) => {
    setHeader(prev => ({ ...prev, supplier_id: s.id }));
    setSupplierSearchTerm(s.Supplier_Name);
    setShowSupplierDropdown(false);
  };

  const handleSupplierBlur = () => {
    // Wait a bit for click events on dropdown
    setTimeout(() => {
      setShowSupplierDropdown(false);
      if (supplierSearchTerm && !suppliers.find(s => s.Supplier_Name === supplierSearchTerm)) {
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

  const vTotalSum = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
    const discount = subtotal * (adjData.discountPercent / 100);
    return subtotal - discount + adjData.otherFees + adjData.tax;
  }, [items, adjData]);

  const selectProduct = (p: Product) => {
    setSelectedProduct(p);
    setManualItemName(p.Name);
    setTempPrice(p.CostPrice || '');
    setTempQty(1);
    setSearchTerm('');
    setShowSearchDropdown(false);
    qtyInputRef.current?.focus();
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
        await InvoiceRepository.savePurchase(header.supplier_id, items, vTotalSum, editingInvoiceId, header.payment_method === 'Cash', currency, 'POSTED');
        addToast("تم تحديث الفاتورة بنجاح", "success");
      } else {
        await InvoiceRepository.savePurchase(header.supplier_id, items, vTotalSum, header.invoice_number, header.payment_method === 'Cash', currency, 'POSTED');
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
    handlePost,
    currency,
    isRecovery,
    suppliers,
    categories,
    addCategory,
    handleExport,
    printData,
    editingInvoiceId
  };
}
