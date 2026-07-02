
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { db } from '@/core/db';
import { Product, InvoiceStatus, InvoiceItem, PaymentStatus, Supplier } from '@/types';
import { useUI, useInventory, useAccounting } from '@/contexts/AppContext';
import { useAppStore } from '@/hooks/useAppStore';
import { authService } from '@/modules/auth/services/authService';
import { InvoiceRepository } from '@/database/repositories/invoice.repository';
import { SupplierRepository } from '@/database/repositories/SupplierRepository';
import { auditLogService } from '@/services/audit/auditLog';
import { InvoiceWorkflowEngine } from '@/modules/sales/services/InvoiceWorkflowEngine';
import { predictionService } from '@/modules/ai/services/predictionService';
import { saveLearning } from '@/modules/ai/services/learningService';
import { useAppNotification } from '@/context/NotificationContext';
import { DraftService } from '@/services/system/DraftService';
import { reportCache } from '@/modules/reports/services/reportCacheService';
import { ReportEngine } from '@/services/reports/reportEngine';

const DRAFT_KEY = 'pharmaflow_purchase_draft';

export function usePurchases(onNavigate?: (view: any, params?: any) => void) {
  const { addToast, currency, refreshGlobal } = useUI();
  const { showNotification } = useAppNotification();
  const { addInvoice, suppliers } = useAccounting();
  const { categories, addCategory } = useInventory();
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
  const [selectedSupplierIndex, setSelectedSupplierIndex] = useState(-1);
  const [isSearchingSuppliers, setIsSearchingSuppliers] = useState(false);

  // البحث الذكي عن الموردين مع Debouncing من Dexie مباشرة
  useEffect(() => {
    const timer = setTimeout(() => {
      (async () => {
        const term = supplierSearchTerm.trim();
        if (term.length < 2) {
          setFilteredSuppliers([]);
          return;
        }

        setIsSearchingSuppliers(true);
        try {
          const results = await SupplierRepository.searchSuppliers(term);

          setFilteredSuppliers(results);
        } catch (err) {
          console.error('Error searching suppliers:', err);
          // Fallback to local search
          const localResults = await predictionService.searchSuppliers(term);
          setFilteredSuppliers(localResults);
        } finally {
          setIsSearchingSuppliers(false);
        }
      })().catch(e => console.error("[usePurchases] supplierSearch fatal:", e));
    }, 400); // Debounce duration

    return () => clearTimeout(timer);
  }, [supplierSearchTerm]);

  const [isSaving, setIsSaving] = useState(false);
  const [savePhase, setSavePhase] = useState<'idle' | 'saving' | 'failed'>('idle');
  const [hasDependencies, setHasDependencies] = useState(false);
  
  const [isAdjustmentsOpen, setIsAdjustmentsOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [hasUnsavedAI, setHasUnsavedAI] = useState(false);
  const [showAIConfirmModal, setShowAIConfirmModal] = useState(false);
  const [aiParsedData, setAIParsedData] = useState<any>(null);
  const [saveSuccessData, setSaveSuccessData] = useState<{
    invoiceNumber: string;
    totalAmount: number;
    type: 'SALE' | 'PURCHASE';
    date?: string;
    partnerName?: string;
    accountingStatus?: string;
    inventoryStatus?: string;
    balanceStatus?: string;
  } | null>(null);

  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [recoveryDraftData, setRecoveryDraftData] = useState<any>(null);

  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);
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
    setIsProcessingAI(false);
    setHasUnsavedAI(false);
  }, [setEditingInvoiceId]);

  const [isDateLockedStatus, setIsDateLockedStatus] = useState(false);

  // Smart Prediction for Products
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        if (manualItemName.trim()) {
          const results = await predictionService.searchProducts(manualItemName);
          setFilteredProducts(results);
        } else {
          setFilteredProducts([]);
        }
      } catch (e) {
        console.error("Product prediction failed:", e);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [manualItemName]);

  useEffect(() => {
    const checkLock = async () => {
      try {
        const locked = await db.isDateLocked(header.date || "");
        setIsDateLockedStatus(locked);
      } catch (e) {
        console.error("checkLock failed:", e);
      }
    };
    checkLock().catch(e => console.error("[usePurchases] checkLock fatal error:", e));
  }, [header.date]);

  const isLocked = useMemo(() => {
    const isWorkflowLocked = InvoiceWorkflowEngine.isLocked(header.status);
    const isPeriodLocked = isDateLockedStatus && authService.getCurrentUser()?.Role !== 'Admin';
    return isWorkflowLocked || isPeriodLocked || hasDependencies;
  }, [header.status, isDateLockedStatus, hasDependencies]);

  useEffect(() => {
    const fetchEditingInvoice = async () => {
      try {
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
      } catch (e) {
        console.error("fetchEditingInvoice failed:", e);
      }
    };
    fetchEditingInvoice().catch(e => console.error("[usePurchases] fetchEditingInvoice fatal error:", e));
  }, [editingInvoiceId, resetInvoiceState]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isLocked && editingInvoiceId) {
      timer = setTimeout(() => {
        (async () => {
          try {
            await db.updatePurchaseNotes(editingInvoiceId, header.notes);
            await db.updatePurchaseAttachment(editingInvoiceId, header.attachment || '');
          } catch (e) {
            console.error("Auto-update header failed:", e);
          }
        })().catch(e => console.error("[usePurchases] Auto-update header fatal:", e));
      }, 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [header.notes, header.attachment, isLocked, editingInvoiceId]);

  // 1. Mount Effect: Check for unsaved database drafts for purchases
  const draftPromptCheckedRef = useRef(false);
  useEffect(() => {
    if (editingInvoiceId) return;

    const checkDraft = async () => {
      if (draftPromptCheckedRef.current) return;
      draftPromptCheckedRef.current = true;
      try {
        const unfinished = await DraftService.getUnfinishedInvoiceDraft('PURCHASE');
        if (unfinished) {
          setRecoveryDraftData(unfinished);
          setIsRecoveryModalOpen(true);
        } else {
          const hasSavedDraft = await DraftService.hasDraft('purchases');
          if (hasSavedDraft) {
            const draft = await DraftService.getDraft('purchases');
            if (draft && draft.items && draft.items.length > 0) {
              setRecoveryDraftData(draft);
              setIsRecoveryModalOpen(true);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load purchases draft recovery status:', err);
      }
    };
    checkDraft().catch(e => console.error("checkDraft error:", e));
  }, [editingInvoiceId]);

  const restoreDraft = useCallback(async () => {
    if (recoveryDraftData) {
      const data = recoveryDraftData.totals?.header ? recoveryDraftData.totals : (recoveryDraftData.payload || recoveryDraftData);
      if (data) {
        if (data.header) {
          setHeader(data.header);
        }
        if (recoveryDraftData.items) {
          setItems(recoveryDraftData.items);
        } else if (data.items) {
          setItems(data.items);
        }
        if (data.adjData) {
          setAdjData(data.adjData);
        } else if (data.totals?.adjData) {
          setAdjData(data.totals.adjData);
        } else if (recoveryDraftData.totals?.adjData) {
          setAdjData(recoveryDraftData.totals.adjData);
        }
        if (recoveryDraftData.partner?.partnerName) {
          setSupplierSearchTerm(recoveryDraftData.partner.partnerName);
        } else if (data.partner?.partnerName) {
          setSupplierSearchTerm(data.partner.partnerName);
        }
      }
      addToast("تمت استعادة مسودة المشتريات بنجاح 💾", "success");
    }
    setIsRecoveryModalOpen(false);
    setRecoveryDraftData(null);
  }, [recoveryDraftData, addToast]);

  const discardDraft = useCallback(async () => {
    try {
      if (recoveryDraftData?.draftId) {
        await DraftService.clearInvoiceDraft(recoveryDraftData.draftId);
      }
      await DraftService.clearDraft('purchases');
      const unfinished = await DraftService.getUnfinishedInvoiceDraft('PURCHASE');
      if (unfinished?.draftId) {
        await DraftService.clearInvoiceDraft(unfinished.draftId);
      }
      addToast("تم حذف مسودة المشتريات المتروكة وبدء قيد جديد", "info");
      resetInvoiceState();
    } catch (e) {
      console.error("discardDraft failed:", e);
    } finally {
      setIsRecoveryModalOpen(false);
      setRecoveryDraftData(null);
    }
  }, [addToast, resetInvoiceState, recoveryDraftData]);

  const handleSupplierSearch = useCallback((val: string) => {
    setSupplierSearchTerm(val);
    setShowSupplierDropdown(true);
    setSelectedSupplierIndex(-1);
  }, []);

  const handleSupplierKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSupplierIndex(prev => Math.min(prev + 1, filteredSuppliers.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSupplierIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      if (selectedSupplierIndex >= 0) {
        e.preventDefault();
        selectSupplier(filteredSuppliers[selectedSupplierIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSupplierDropdown(false);
      setSelectedSupplierIndex(-1);
    }
  }, [filteredSuppliers, selectedSupplierIndex]);

  const selectSupplier = useCallback((s: any) => {
    setHeader(prev => ({ ...prev, supplier_id: s.id }));
    setSupplierSearchTerm(s.Supplier_Name);
    setShowSupplierDropdown(false);
    showNotification(`رصيد المورد الحالي للفاتورة: ${(s.balance || 0).toLocaleString()} ${currency}`, 'info');
  }, [showNotification, currency]);

  const handleSupplierBlur = useCallback(() => {
    setTimeout(async () => {
      setShowSupplierDropdown(false);
      if (supplierSearchTerm) {
        try {
           const allDBSuppliers = await db.suppliers.toArray() as any[];
           const activeSuppliers = allDBSuppliers.filter(s => s.Is_Active === true || s.Is_Active === 1 || String(s.Is_Active) === "true" || s.Is_Active === undefined);
           const exactMatch = activeSuppliers.find(s => s.Supplier_Name === supplierSearchTerm || s.name === supplierSearchTerm);
           
           if (!exactMatch) {
              const similarSupplier = activeSuppliers.find(s => {
                const sName = (s.Supplier_Name || s.name || '').toLowerCase();
                const tName = supplierSearchTerm.toLowerCase();
                return sName.includes(tName) || tName.includes(sName);
              });

              if (similarSupplier) {
                if (window.confirm(`هل تقصد [${similarSupplier.Supplier_Name || similarSupplier.name}]؟`)) {
                  selectSupplier(similarSupplier);
                  return;
                }
              }

              setNewSupplierName(supplierSearchTerm);
              setIsAddSupplierModalOpen(true);
           } else {
             selectSupplier(exactMatch);
           }
        } catch (error) {
           console.error("Checking DB for supplier failed", error);
        }
      }
    }, 200);
  }, [supplierSearchTerm, selectSupplier]);

  const confirmAddSupplier = useCallback(async () => {
    try {
      const newId = `SUP-${Date.now()}`;
      const newSup: Supplier = {
        id: newId,
        Supplier_ID: newId,
        Supplier_Name: newSupplierName,
        Phone: '',
        Address: '',
        balance: 0,
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
  }, [newSupplierName, refreshGlobal, addToast]);

  const cancelAddSupplier = useCallback(() => {
    setIsAddSupplierModalOpen(false);
    setSupplierSearchTerm('');
    setHeader(prev => ({ ...prev, supplier_id: '' }));
  }, []);

  const safeNavigate = useCallback((path: string) => {
    try {
      onNavigate?.(path as any);
    } catch (error) {
      console.error("Navigation failed, falling back to window.location", error);
      window.location.hash = path; // Simple fallback for hash routing if applicable
    }
  }, [onNavigate]);

  const handleAIImport = async (file: File | string) => {
    console.log("IMPORT FLOW RUNNING");
    console.log("STEP 1: FILE SELECTED");
    setIsProcessingAI(true);
    let parsed: any = null;
    let fallbackTriggered = false;

    try {
      console.log("STEP 2: AI START");
      const { processInvoice } = await import('@/modules/ai/services/smartImportEngine');
      parsed = await processInvoice(file);
      console.log("STEP 3: AI DONE", parsed);
    } catch (error: any) {
      console.warn("[AI IMPORT] Main AI Engine failed. Engaging local backup OCR engine...", error);
      fallbackTriggered = true;
      try {
        const { parseInvoiceLocally } = await import('@/modules/ai/services/localBackupOcrEngine');
        parsed = await parseInvoiceLocally(file);
        console.log("STEP 3 (FALLBACK): LOCAL OCR DONE", parsed);
      } catch (fallbackError: any) {
        console.error("Local Backup OCR Engine failed too:", fallbackError);
        addToast("فشلت قراءة الفاتورة بكلا المحركين الذكي والمحلي 📴", "error");
        setIsProcessingAI(false);
        return;
      }
    }

    if (!parsed || !parsed.items || parsed.items.length === 0) {
      if (!fallbackTriggered) {
        fallbackTriggered = true;
        try {
          const { parseInvoiceLocally } = await import('@/modules/ai/services/localBackupOcrEngine');
          parsed = await parseInvoiceLocally(file);
        } catch (e) {
          addToast("لم يتم التعرف على بيانات الفاتورة بنجاح", "warning");
          setIsProcessingAI(false);
          return;
        }
      } else {
        addToast("الفاتورة التي تم تحليلها لا تحتوي على أي أصناف مقروءة", "warning");
        setIsProcessingAI(false);
        return;
      }
    }

    setAIParsedData(parsed);
    console.log("STEP 4: MODAL OPENED");
    setShowAIConfirmModal(true);
    
    // Handle attachment preview
    if (typeof file === 'string') {
      setHeader(prev => ({ ...prev, attachment: file }));
    } else {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      setHeader(prev => ({ ...prev, attachment: base64 }));
    }
  };

  const applyAIParsedData = async () => {
    if (!aiParsedData) return;

    if (!aiParsedData.items || aiParsedData.items.length === 0) {
      addToast("لم يتم التعرف على بيانات الفاتورة", "warning");
      setIsProcessingAI(false);
      return;
    }

    // CLEAN DATA
    const cleanedItems = (aiParsedData.items || []).filter((i: any) =>
      i.name && i.quantity && i.price
    );

    if (!cleanedItems.length) {
      addToast("❌ فشل تحليل الفاتورة في استخراج أصناف صالحة", "error");
      setIsProcessingAI(false);
      return;
    }

    // MAP TO INTERMEDIATE REVIEW SCREEN (No automatic save, no automatic redirect!)
    // Discover if we have matching supplier in DB
    const matchedSupplier = suppliers?.find((s: any) => 
      s.Supplier_Name?.toLowerCase().includes(aiParsedData.supplier?.toLowerCase()) ||
      aiParsedData.supplier?.toLowerCase().includes(s.Supplier_Name?.toLowerCase())
    );
    const matchedSupplierId = matchedSupplier ? (matchedSupplier.id || matchedSupplier.Supplier_ID) : (suppliers?.[0]?.id || '');

    // Transform extracted raw items into standard local InvoiceItem array
    const mappedItems: InvoiceItem[] = cleanedItems.map((item: any, idx: number) => ({
      id: `PUR-DET-${Date.now()}-${idx}`,
      parent_id: aiParsedData.invoice_number || `INV-${Math.floor(Math.random() * 100000)}`,
      product_id: item.product_id || `manual-${Date.now()}-${idx}`,
      name: item.name,
      qty: Number(item.quantity || 1),
      price: Number(item.price || 0),
      sum: Number(item.quantity || 1) * Number(item.price || 0),
      row_order: idx + 1,
      expiryDate: item.expiryDate || '',
      notes: item.notes || '',
      categoryId: item.categoryId || ''
    } as any));

    // Update screen reactive states (Intermediate Review Space)
    setItems(mappedItems);
    setHeader(prev => ({
      ...prev,
      invoice_number: aiParsedData.invoice_number || prev.invoice_number,
      supplier_id: matchedSupplierId,
      isReturn: aiParsedData.type === 'return',
      notes: aiParsedData.notes || prev.notes,
      status: 'DRAFT' // Strict requirement 1: Initial state is Draft awaiting review
    }));

    setHasUnsavedAI(true);
    setIsProcessingAI(false);
    setShowAIConfirmModal(false);

    addToast("📝 تم تعبئة شاشة المراجعة الوسيطة بنجاح! يرجى التدقيق يدوياً والموافقة لحفظ الفاتورة المحاسبية 💾", "success");
  };

  const vTotalSum = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
    const discount = subtotal * (adjData.discountPercent / 100);
    return subtotal - discount + adjData.otherFees + adjData.tax;
  }, [items, adjData]);

  // 2. Smart Auto Save Draft Engine (Task 5 / Phase 5.2.5-C)
  // Backup Interval: Auto-save draft every 5 seconds
  useEffect(() => {
    if (editingInvoiceId) return;

    const interval = setInterval(async () => {
      if (items.length === 0 && !header.supplier_id && !header.notes) {
        return;
      }
      try {
        const partner = suppliers.find(s => s.id === header.supplier_id);
        const partnerName = partner ? partner.Supplier_Name : '';
        await DraftService.saveInvoiceDraft('purchases_draft_current', 'PURCHASE', items, {
          adjData,
          subtotal: vTotalSum,
          header,
          partner: { partnerName }
        });
      } catch (e) {
        console.error("Interval auto-save failed:", e);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [items, header, adjData, vTotalSum, editingInvoiceId, suppliers]);

  // Immediate save on specific changes: Add Item, Remove Item, Change Qty/Price, Change Supplier, Change Notes
  const prevItemsRef = useRef<any[]>(items);
  const prevSupplierIdRef = useRef<string>(header.supplier_id);
  const prevNotesRef = useRef<string>(header.notes);
  const prevAdjDataRef = useRef<any>(adjData);

  useEffect(() => {
    if (editingInvoiceId) return;
    if (items.length === 0 && !header.supplier_id && !header.notes) {
      return;
    }

    const itemsChanged = JSON.stringify(items) !== JSON.stringify(prevItemsRef.current);
    const supplierChanged = header.supplier_id !== prevSupplierIdRef.current;
    const notesChanged = header.notes !== prevNotesRef.current;
    const adjChanged = JSON.stringify(adjData) !== JSON.stringify(prevAdjDataRef.current);

    if (itemsChanged || supplierChanged || notesChanged || adjChanged) {
      prevItemsRef.current = items;
      prevSupplierIdRef.current = header.supplier_id;
      prevNotesRef.current = header.notes;
      prevAdjDataRef.current = adjData;

      const triggerImmediateSave = async () => {
        try {
          const partner = suppliers.find(s => s.id === header.supplier_id);
          const partnerName = partner ? partner.Supplier_Name : '';
          await DraftService.saveInvoiceDraft('purchases_draft_current', 'PURCHASE', items, {
            adjData,
            subtotal: vTotalSum,
            header,
            partner: { partnerName }
          });
        } catch (e) {
          console.error("Immediate change-triggered auto-save failed:", e);
        }
      };
      triggerImmediateSave().catch(e => console.error("Immediate save error:", e));
    }
  }, [items, header, adjData, vTotalSum, editingInvoiceId, suppliers]);

  const selectProduct = useCallback((p: Product) => {
    setSelectedProduct(p);
    setManualItemName(p.Name || '');
    setTempPrice(p.LastPurchasePrice || p.CostPrice || '');
    setTempQty(1);
    
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
  }, [addToast, currency]);

  const handleSearchKeyDown = useCallback((e: any) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredProducts.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0) {
        e.preventDefault();
        const prod = filteredProducts[selectedIndex];
        if (prod) {
          selectProduct(prod);
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

  const finalizeItemAdd = useCallback(() => {
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

    setItems(prev => [...prev, newItem]);
    
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
    addToast("تمت إضافة الصنف ✅", "success");
  }, [manualItemName, tempQty, tempPrice, header.invoice_number, selectedProduct, items.length, tempExpiry, tempNote, selectedCategoryId, addToast]);

  const handlePost = useCallback(async () => {
    if (savePhase === 'saving') return;
    if (!header.supplier_id) {
      addToast("يرجى اختيار المورد", "error");
      return;
    }
    if (items.length === 0) {
      addToast("الفاتورة فارغة", "error");
      return;
    }

    // OPTIMISTIC: Show success immediately and block UI only enough to navigate
    showNotification('⌛ جاري حفظ الفاتورة وتحديث المستودع...', 'info');
    addToast("جاري الحفظ والمزامنة... ⏳", "info");
    const navPromise = new Promise(res => setTimeout(res, 500)); 

    setIsSaving(true);
    setSavePhase('saving');
    try {
      if (aiParsedData) {
        const originalSupplier = aiParsedData.supplier;
        const finalSupplier = suppliers.find(s => s.id === header.supplier_id)?.Supplier_Name;
        if (originalSupplier && finalSupplier && originalSupplier !== finalSupplier) {
          saveLearning(originalSupplier, finalSupplier);
        }

        aiParsedData.items.forEach((aiItem: any) => {
          const finalItem = items.find(i => i.qty === aiItem.quantity && i.price === aiItem.price);
          if (finalItem && aiItem.name !== finalItem.name) {
            saveLearning(aiItem.name, finalItem.name);
          }
        });
      }

      // سباق برمجي: إما يتم الحفظ أو ينتهي الوقت خلال 15 ثانية ويفك تجميد الأزرار تلقائياً
      const res = await Promise.race([
        (async () => {
          const r = await addInvoice({
            type: 'PURCHASE',
            payload: {
              supplierId: header.supplier_id,
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
              invoiceStatus: 'POSTED',
              isReturn: !!header.isReturn,
              currency,
              date: header.date
            }
          });
          await navPromise;
          return r;
        })(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('SAVE_TIMEOUT')), 15000)
        )
      ]) as { success: boolean };

      if (res?.success) {
        setSavePhase('idle');
        
        // --- REAL-TIME ARCHIVE & REPORT SYNCHRONIZATION (PHASE 5.2.5-B) ---
        // 1. Invalidate report cache
        reportCache.purge();
        // 2. Increment data version to signal components of data changes
        db.incrementDataVersion();
        // 3. Clear report engine state and refresh
        await ReportEngine.refresh();
        // 4. Force state synchronization across related providers/views
        await refreshGlobal();

        // Display success toast for 1 second only
        showNotification("Invoice Saved Successfully\nReturning to Dashboard...", 'success', 1000);
        addToast("Invoice Saved Successfully\nReturning to Dashboard...", "success");

        localStorage.removeItem(DRAFT_KEY);
        setHasUnsavedAI(false);
        
        await auditLogService.log({
          table: 'purchases',
          action: 'PURCHASE',
          entityId: editingInvoiceId || header.invoice_number,
          newData: { items, total: vTotalSum },
          details: `Purchase ${header.isReturn ? 'Return' : ''}: ${header.invoice_number}`
        });
        
        // Capture data for success modal 2.0 (Task 4) and dispose of draft (Task 5)
        const supplier = suppliers.find(s => s.id === header.supplier_id);
        const supplierName = supplier ? supplier.Supplier_Name : 'مورد غير محدد';
        await DraftService.clearInvoiceDraft('purchases_draft_current');
        await DraftService.clearDraft('purchases');

        setSaveSuccessData({
          invoiceNumber: header.invoice_number,
          totalAmount: vTotalSum,
          type: 'PURCHASE',
          date: header.date,
          partnerName: supplierName,
          accountingStatus: 'قيد ذمم دائنة مرحل وتلقائي',
          inventoryStatus: 'قيد المخزون المتاح والوجبات المدخلة',
          balanceStatus: 'معدل ومرحل لحساب المورد'
        });

        // Instantly generate a clean new invoice state to prevent dirty or stale state reuse
        resetInvoiceState();

        // Delay navigation by 1 second to show the toast and feedback
        setTimeout(() => {
          try {
            onNavigate?.('dashboard');
          } catch (error) {
            window.location.hash = '#/dashboard';
          }
        }, 1000);
      }
    } catch (error: any) {
      console.error("Save error", error);
      setSavePhase('failed');
      const isTimeout = error?.message === 'SAVE_TIMEOUT';
      showNotification(
        isTimeout 
          ? '⚠️ تأخر حفظ الفاتورة؛ تم فك تجميد الواجهة حرصاً على استمرار العمل.' 
          : '❌ فشل في حفظ الفاتورة وتحديث المستودع', 
        'error'
      );
      addToast(
        isTimeout
          ? 'تأخر حفظ الفاتورة سحابياً؛ تم فك تجميد الواجهة حرصاً على العمل المستمر. راجع مركز المزامنة.'
          : (error?.message || "فشل في حفظ الفاتورة"),
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  }, [header, items, aiParsedData, suppliers, vTotalSum, editingInvoiceId, currency, addInvoice, addToast, refreshGlobal, onNavigate, showNotification, savePhase]);

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
    isSaving,
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
    handleSupplierKeyDown,
    selectedSupplierIndex,
    isSearchingSuppliers,
    selectSupplier,
    handleSupplierBlur,
    confirmAddSupplier,
    cancelAddSupplier,
    selectProduct,
    finalizeItemAdd,
    handleSearchKeyDown,
    handlePost,
    safeNavigate,
    currency,
    isRecovery,
    suppliers,
    categories,
    addCategory,
    handleExport,
    printData,
    editingInvoiceId,
    aiParsedData,
    isProcessingAI, setIsProcessingAI,
    hasUnsavedAI,
    showAIConfirmModal,
    setShowAIConfirmModal,
    handleAIImport,
    applyAIParsedData,
    resetInvoiceState,
    savePhase,
    setSavePhase,
    saveSuccessData,
    setSaveSuccessData,
    isConfirmSaveOpen,
    setIsConfirmSaveOpen,
    isRecoveryModalOpen,
    setIsRecoveryModalOpen,
    recoveryDraftData,
    restoreDraft,
    discardDraft
  };
}
