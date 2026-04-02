
import { useState, useMemo, useEffect, useRef, useCallback, KeyboardEvent } from 'react';
import { db } from '../services/database';
import { Product, InvoiceStatus, InvoiceItem, Sale, PaymentStatus, Supplier } from '../types';
import { useUI, useInventory, useAccounting } from '../store/AppContext';
import { useAppStore } from '../store/useAppStore';
import { authService } from '../services/auth.service';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { priceIntelligenceService } from '../services/priceIntelligence.service';
import { InvoiceWorkflowEngine } from '../services/logic/InvoiceWorkflowEngine';
import { ExportService } from '../services/exportService';

const DRAFT_KEY = 'pharmaflow_sales_draft';

export const useSales = (onNavigate?: (view: any, params?: any) => void) => {
  const { addToast, currency, refreshGlobal } = useUI();
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
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');

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

  const filteredCustomers = useMemo(() => {
    if (!customerSearchTerm) return [];
    return customers.filter(c => 
      c.Supplier_Name.toLowerCase().includes(customerSearchTerm.toLowerCase())
    ).slice(0, 5);
  }, [customerSearchTerm, customers]);

  const handleCustomerSearch = (val: string) => {
    setCustomerSearchTerm(val);
    setShowCustomerDropdown(true);
  };

  const selectCustomer = (c: any) => {
    setHeader(prev => ({ ...prev, customer_id: c.id }));
    setCustomerSearchTerm(c.Supplier_Name);
    setShowCustomerDropdown(false);
  };

  const handleCustomerBlur = () => {
    setTimeout(() => {
      setShowCustomerDropdown(false);
      if (customerSearchTerm && !customers.find(c => c.Supplier_Name === customerSearchTerm)) {
        setNewCustomerName(customerSearchTerm);
        setIsAddCustomerModalOpen(true);
      }
    }, 200);
  };

  const confirmAddCustomer = async () => {
    try {
      const { db } = await import('../services/database');
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
  };

  const cancelAddCustomer = () => {
    setIsAddCustomerModalOpen(false);
    setCustomerSearchTerm('');
    setHeader(prev => ({ ...prev, customer_id: '' }));
  };

  const [isPeriodLockedStatus, setIsPeriodLockedStatus] = useState(false);
  
  useEffect(() => {
    const checkLock = async () => {
      const locked = await db.isDateLocked(header.date);
      setIsPeriodLockedStatus(locked);
    };
    checkLock();
  }, [header.date]);

  const isLocked = useMemo(() => {
    const isWorkflowLocked = InvoiceWorkflowEngine.isLocked(header.status);
    const isPeriodLocked = isPeriodLockedStatus && !isAdmin;
    return isWorkflowLocked || isPeriodLocked || hasDependencies;
  }, [header.status, isPeriodLockedStatus, isAdmin, hasDependencies]);

  useEffect(() => {
    const init = async () => {
      let loadedHeader = { ...header };
      
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
      }

      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) { 
        const parsed = JSON.parse(draft);
        loadedHeader = parsed.header;
        setHeader(loadedHeader); 
        setItems(parsed.items); 
      }

      if (!loadedHeader.invoice_number) {
        const next = await InvoiceRepository.getSafeUniqueNumber('SALE', loadedHeader.isReturn);
        setHeader(h => ({ ...h, invoice_number: next }));
      }
    };
    init();
  }, [editingInvoiceId, header.isReturn]);

  useEffect(() => {
    if (header.invoice_number) {
      InvoiceRepository.isNumberDuplicate(header.invoice_number, 'SALE', editingInvoiceId).then(setIsDuplicate);
    }
  }, [header.invoice_number, editingInvoiceId]);

  const vTotalSum = useMemo(() => {
    const sub = items.reduce((acc, it) => acc + (it.sum || 0), 0);
    return sub - (sub * (adjData.discountPercent / 100)) + adjData.otherFees + adjData.tax;
  }, [items, adjData]);

  const persistToDB = useCallback(async () => {
    const isPeriodLocked = await db.isDateLocked(header.date) && !isAdmin;
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
            id: editingInvoiceId,
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
    
    setIsAutoSaving(false);
  }, [header, items, vTotalSum, isDuplicate, isAdmin, isLocked, editingInvoiceId, currency]);

  const filteredProducts = useMemo(() => {
    if (!manualItemName.trim()) return [];
    const term = manualItemName.toLowerCase();
    return products.filter(p => 
      p.Is_Active !== false && (
        p.Name.toLowerCase().includes(term) || 
        p.id.toLowerCase().includes(term) ||
        (p.barcode && p.barcode.includes(term))
      )
    ).slice(0, 5);
  }, [products, manualItemName]);

  const selectProduct = async (p: Product) => {
    setSelectedProduct(p);
    setManualItemName(p.Name);
    setCategoryName(p.categoryName || '');
    const suggestion = await priceIntelligenceService.getSuggestedPrice(p.id, 'SALE', header.customer_id);
    setTempPrice(suggestion.suggestedPrice || p.UnitPrice);
    setShowSearchDropdown(false);
    setIsDetailModalOpen(true);
  };

  const finalizeItemAdd = async (closeModal = true) => {
    if (isLocked) return;
    const name = manualItemName.trim();
    if (!name) return;
    
    setIsAdding(true);
    // Simulate a small delay for visual feedback
    await new Promise(resolve => setTimeout(resolve, 600));

    let prod = selectedProduct;
    if (!prod || prod.Name.toLowerCase() !== name.toLowerCase()) {
      prod = products.find(p => p.Name.toLowerCase() === name.toLowerCase()) || null;
    }
    
    const newItem: InvoiceItem = {
      id: db.generateId('SALE_DET'), parent_id: header.invoice_number,
      product_id: prod?.id || db.generateId('NEW'),
      name: prod?.Name || name, price: parseFloat(tempPrice as any) || 0, qty: Number(tempQty) || 1,
      sum: (Number(tempQty) || 1) * (parseFloat(tempPrice as any) || 0), row_order: items.length + 1,
      expiryDate: tempExpiry,
      notes: tempNote
    };
    setItems([...items, newItem]);
    
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
  };

  const handleSearchKeyDown = (e: KeyboardEvent) => {
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

  const removeItem = (id: string) => {
    if (isLocked) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handlePost = async () => {
    if (items.length === 0 || isLocked || isDuplicate || isSaving) return;
    
    setIsSaving(true);
    try {
      const nextStatus = InvoiceWorkflowEngine.determineNextStatus(vTotalSum, header.payment_method === 'Cash' ? vTotalSum : 0, 'PENDING');
      
      const res = await addInvoice({
        type: 'SALE',
        payload: { 
          customerId: header.customer_id, 
          items, 
          total: vTotalSum, 
          invoiceId: header.invoice_number,
          id: editingInvoiceId,
          attachment: header.attachment
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

      if (res.success) { 
        localStorage.removeItem(DRAFT_KEY); 
        setEditingInvoiceId(null); 
        onNavigate?.('dashboard'); 
      }
    } catch (err: any) {
      addToast(err.message || "فشل الحفظ", "error");
    } finally {
      setIsSaving(false);
    }
  };

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
    isCameraOpen, setIsCameraOpen,
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
    selectCustomer,
    handleCustomerBlur,
    confirmAddCustomer,
    cancelAddCustomer
  };
};
