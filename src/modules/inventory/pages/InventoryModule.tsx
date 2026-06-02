
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useInventory, useUI, useAccounting } from '@/contexts/AppContext';
import { Product, PriceHistory, Purchase, InventoryTransaction, WarehouseStock } from '@/types';
import { ProductRepository } from '@/modules/inventory/services/ProductRepository';
import { db } from '@/core/db';
import { PurchaseRepository } from '@/database/repositories/PurchaseRepository';
import { InventoryService } from '@/modules/inventory/services/InventoryService';
import { authService } from '@/modules/auth/services/authService';
import { Modal, Badge } from '@/components/shared/SharedUI';
import { FixedSizeList as List } from 'react-window';
import { 
  TrendingUp, Layers, ArrowRight, Plus, 
  AlertCircle, History, 
  Warehouse as WarehouseIcon, Settings2, ArrowRightLeft, MinusCircle, PlusCircle,
  ChevronRight, Box, BarChart3, Save, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PullToRefresh } from '@/components/shared/PullToRefresh';

import SupplierManagement from '@/modules/accounting/components/SupplierManagement';

const InventoryModule: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  const { products, categories } = useInventory();
  const { suppliers } = useAccounting();
  const { refreshGlobal, addToast, currency } = useUI();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);

  // Optimize loading state - use products.length as dependency to avoid flickering on reference changes
  useEffect(() => {
    if (products.length > 0) {
      setIsLoading(false);
    } else {
      // Small timeout to allow async products to load before showing empty state
      const timer = setTimeout(() => setIsLoading(false), 800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [products.length]);

  const handleProductClick = useCallback((product: Product) => {
    setEditingProduct(product);
    setActiveTab('details');
  }, []);
  
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortAsc] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [filterBy] = useState<'all' | 'low' | 'out' | 'expired'>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');

  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'warehouses' | 'adjust' | 'suppliers'>('details');
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<Purchase[]>([]);
  const [movements, setMovements] = useState<InventoryTransaction[]>([]);
  const [warehouseStocks, setWarehouseStocks] = useState<WarehouseStock[]>([]);
  
  const [adjustment, setAdjustment] = useState({ qty: 0, reason: '', type: 'ADJUSTMENT' as any });

  useEffect(() => {
    const loadProductData = async () => {
      if (editingProduct?.id) {
        try {
          const priceHist = await ProductRepository.getPriceHistory(editingProduct.id);
          setPriceHistory(priceHist);
          
          const purchHist = await ProductRepository.getPurchaseHistory(editingProduct.id);
          setPurchaseHistory(purchHist);
          
          const moves = await db.db.inventoryTransactions
            .where('productId')
            .equals(editingProduct.id)
            .reverse()
            .limit(20)
            .toArray();
          setMovements(moves);

          const stocks = await db.db.warehouseStock
            .where('productId')
            .equals(editingProduct.id)
            .toArray();
          setWarehouseStocks(stocks);
        } catch (e) {
          console.error("loadProductData in Inventory failed:", e);
        }
      }
    };
    loadProductData();
  }, [editingProduct]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handler);
  }, [search]);

  const filteredProducts = useMemo(() => {
    let result = [...products];
    
    if (selectedCategoryId !== 'ALL') {
      result = result.filter(p => p.categoryId === selectedCategoryId);
    }

    if (debouncedSearch.trim()) {
      const lower = debouncedSearch.toLowerCase();
      result = result.filter(p => (p.name || p.Name || '').toLowerCase().includes(lower) || p.id.toLowerCase().includes(lower));
    }

    if (filterBy === 'low') {
      result = result.filter(p => (p.stock || p.StockQuantity || 0) > 0 && (p.stock || p.StockQuantity || 0) <= (p.MinLevel || 5));
    } else if (filterBy === 'out') {
      result = result.filter(p => (p.stock || p.StockQuantity || 0) <= 0);
    } else if (filterBy === 'expired') {
      const today: string = new Date().toISOString().substring(0, 10);
      result = result.filter(p => p.ExpiryDate && p.ExpiryDate < today);
    }

    return result.sort((a, b) => {
      const nameA = (a.name || a.Name || '').toLowerCase();
      const nameB = (b.name || b.Name || '').toLowerCase();
      return sortAsc ? nameA.localeCompare(nameB, 'ar') : nameB.localeCompare(nameA, 'ar');
    });
  }, [products, debouncedSearch, sortAsc, filterBy, selectedCategoryId]);

  const handleAdjustment = async () => {
    if (!editingProduct || adjustment.qty === 0) return;
    
    try {
      const user = authService.getCurrentUser();
      await InventoryService.recordMovement({
        type: 'ADJUSTMENT',
        productId: editingProduct.id,
        warehouseId: 'WH-MAIN',
        quantity: adjustment.qty,
        sourceDocId: `ADJ-${Date.now()}`,
        sourceDocType: 'ADJUSTMENT',
        userId: user?.User_Email || 'SYSTEM',
        notes: adjustment.reason || 'Manual Adjustment'
      });
      
      addToast("تم تنفيذ التسوية المخزنية بنجاح ✅", "success");
      
      refreshGlobal();
      setEditingProduct(null);
      setAdjustment({ qty: 0, reason: '', type: 'ADJUSTMENT' });
    } catch (err: any) {
      addToast(err.message || "فشل تنفيذ التسوية", "error");
    }
  };

const ProductItem = React.memo(({ product, currency, onClick }: { product: Product, currency: string, onClick: () => void }) => {
  const lastRealPurchasePrice = PurchaseRepository.getLastPurchasePriceForItem(product.id);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-100 rounded-[40px] h-full flex items-center justify-between px-10 shadow-sm hover:shadow-xl hover:border-[#1E4D4D]/20 transition-all group cursor-pointer active:scale-[0.99]"
      onClick={onClick}
    >
        <div className="flex items-center gap-8 flex-1">
          <div className="w-16 h-16 bg-slate-50 text-[#1E4D4D] rounded-[24px] flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">
            <Box size={28} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[11px] font-black text-[#1E4D4D] truncate leading-none mb-2">{product.name || product.Name}</h3>
            <div className="flex items-center gap-4 flex-nowrap">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">ID: {product.id}</p>
                <div className="w-1.5 h-1.5 bg-slate-200 rounded-full"></div>
                <Badge variant={(product.stock || product.StockQuantity || 0) <= (product.MinLevel || 5) ? 'danger' : 'info'} className="!rounded-full px-3 py-0.5 text-[11px] font-black uppercase tracking-tight">
                {product.categoryName || 'بدون تصنيف'}
                </Badge>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-16">
          <div className="text-center hidden lg:block border-r border-slate-50 pr-12">
              <p className="text-[11px] font-black text-slate-300 uppercase mb-1 tracking-tight flex items-center justify-center gap-2">
              <TrendingUp size={12}/> آخر تكلفة
              </p>
              <p className="text-[11px] font-black text-[#1E4D4D]">
                {lastRealPurchasePrice ? `${lastRealPurchasePrice.toLocaleString()} ${currency}` : '---'}
              </p>
          </div>
          <div className="text-center w-32">
              <p className="text-[11px] font-black text-slate-300 uppercase mb-1 tracking-tight">الرصيد الحالي</p>
              <div className="flex items-center justify-center gap-2">
                <p className={`text-[11px] font-black ${(product.stock || product.StockQuantity || 0) <= (product.MinLevel || 5) ? 'text-red-500' : 'text-[#1E4D4D]'}`}>{product.stock || product.StockQuantity}</p>
                <span className="text-[11px] font-black text-slate-400 uppercase">{product.DefaultUnit || 'حبة'}</span>
              </div>
          </div>
          <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center group-hover:bg-[#1E4D4D] group-hover:text-white transition-all shadow-sm">
            <ChevronRight size={24} />
          </div>
        </div>
    </motion.div>
  );
});

  return (
    <div className="flex flex-col min-h-full h-full bg-[#F8FAFA] font-cairo w-full relative" dir="rtl">
      {/* Modern Header */}
      <header className="p-6 sm:p-10 pb-8 shrink-0 bg-white border-b border-slate-100 z-20">
        {/* Row 1: Back, Spacer, Centered Title */}
        <div className="flex items-center w-full mb-10 relative">
          <button 
            onClick={() => onNavigate?.('dashboard')}
            className="w-14 h-14 bg-white border-2 border-slate-50 text-[#1E4D4D] rounded-[24px] flex items-center justify-center shadow-lg shadow-slate-200/40 active:scale-95 active:bg-slate-100 hover:bg-slate-50 transition-all z-10"
          >
            <ArrowRight size={26} strokeWidth={3.5} />
          </button>
          
          <div className="w-[15%] shrink-0" />

          <div className="flex-1 flex items-center justify-center gap-4">
            <div className="w-14 h-14 bg-[#1E4D4D] text-white rounded-[24px] flex items-center justify-center shadow-2xl shadow-emerald-900/30">
              <Layers size={28} />
            </div>
            <div className="flex flex-col items-start">
              <h2 className="text-xl sm:text-2xl font-black text-[#1E4D4D] tracking-tight leading-none">المستودع الرقمي</h2>
              <p className="text-[11px] text-slate-300 font-bold uppercase tracking-widest mt-2">Digital Inventory System</p>
            </div>
          </div>
          
          {/* Invisible spacers to maintain perfect centering of the middle div */}
          <div className="w-[15%] shrink-0" />
          <div className="w-14" />
        </div>

        {/* Row 2: Search (60%), Add, Jerd */}
        <div className="flex items-center gap-4 flex-nowrap">
          <div className="basis-[60%] relative group">
            <input 
              className="w-full h-16 bg-slate-50 border-2 border-slate-50 rounded-[32px] px-8 text-[11px] font-black focus:bg-white focus:border-[#1E4D4D] outline-none shadow-sm transition-all" 
              placeholder="بحث عن صنف..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          
          <button 
            onClick={() => { 
              const newId = db.generateId('PROD');
              setEditingProduct({ id: newId, ProductID: newId, name: '', DefaultUnit: 'حبة', LastPurchasePrice: 0, TaxDefault: 15, price: 0, CostPrice: 0, stock: 0, ExpiryDate: '', MinLevel: 5, category: 'أدوية' } as any); 
              setActiveTab('details'); 
            }}
            className="flex-1 h-16 bg-[#1E4D4D] text-white rounded-[32px] flex items-center justify-center gap-3 text-[11px] font-black shadow-xl shadow-emerald-900/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={20} />
            <span>إضافة</span>
          </button>
          
          <button 
            onClick={() => onNavigate?.('inventory-audit')}
            className="flex-1 h-16 bg-white border-2 border-slate-50 text-[#1E4D4D] rounded-[32px] flex items-center justify-center gap-3 text-[11px] font-black shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
          >
            <BarChart3 size={20} />
            <span>جرد</span>
          </button>
        </div>

        {/* Categories Scroller */}
        <div className="flex items-center gap-3 overflow-x-auto pt-8 pb-2 no-scrollbar scroll-smooth flex-nowrap">
          <button 
            onClick={() => setSelectedCategoryId('ALL')}
            className={`px-8 py-3 rounded-full text-[11px] font-black transition-all whitespace-nowrap border-2 ${selectedCategoryId === 'ALL' ? 'bg-[#1E4D4D] text-white border-[#1E4D4D] shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}
          >
            جميع التصنيفات
          </button>
          {categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-8 py-3 rounded-full text-[11px] font-black transition-all whitespace-nowrap border-2 ${selectedCategoryId === cat.id ? 'bg-[#1E4D4D] text-white border-[#1E4D4D] shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}
            >
              {cat.categoryName}
            </button>
          ))}
        </div>
      </header>

      {/* List Area */}
      <div className="flex-1 bg-[#F8FAFA] pt-6" ref={containerRef}>
        <PullToRefresh onRefresh={async () => { await refreshGlobal(); }} className="h-full w-full">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 font-black gap-4">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-[#1E4D4D] rounded-full animate-spin"></div>
              <span>جاري التحميل...</span>
            </div>
          ) : (
            <List 
              height={containerRef.current?.offsetHeight || 600} 
              itemCount={filteredProducts.length} 
              itemSize={120} 
              width="100%" 
              className="custom-scrollbar"
              itemKey={(index) => {
                const p = filteredProducts[index];
                return p ? p.id : index.toString();
              }}
            >
              {({ index, style }) => {
                const prod = filteredProducts[index];
                if (!prod) return null;
                return (
                  <div style={style} className="px-8 py-3" key={prod.id}>
                    <ProductItem 
                      product={prod} 
                      currency={currency} 
                      onClick={() => handleProductClick(prod)}
                    />
                  </div>
                );
              }}
            </List>
          )}
        </PullToRefresh>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingProduct && (
          <Modal isOpen={!!editingProduct} onClose={() => setEditingProduct(null)} title="بطاقة بيانات صنف" noPadding>
            <div className="flex flex-col h-[85vh] font-sans" dir="rtl">
              {/* Modal Tabs */}
              <div className="flex items-center gap-1 bg-slate-50 p-2 shrink-0 flex-nowrap overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveTab('details')} className={`flex-1 py-3 px-3 rounded-xl text-[11px] font-black flex items-center justify-center gap-2 transition-all whitespace-nowrap ${activeTab === 'details' ? 'bg-white text-[#1E4D4D] shadow-sm' : 'text-slate-400'}`}><Settings2 size={14} /> التفاصيل</button>
                <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 px-3 rounded-xl text-[11px] font-black flex items-center justify-center gap-2 transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-white text-[#1E4D4D] shadow-sm' : 'text-slate-400'}`}><History size={14} /> السجل</button>
                <button onClick={() => setActiveTab('warehouses')} className={`flex-1 py-3 px-3 rounded-xl text-[11px] font-black flex items-center justify-center gap-2 transition-all whitespace-nowrap ${activeTab === 'warehouses' ? 'bg-white text-[#1E4D4D] shadow-sm' : 'text-slate-400'}`}><WarehouseIcon size={14} /> المستودعات</button>
                <button onClick={() => setActiveTab('suppliers')} className={`flex-1 py-3 px-3 rounded-xl text-[11px] font-black flex items-center justify-center gap-2 transition-all whitespace-nowrap ${activeTab === 'suppliers' ? 'bg-white text-[#1E4D4D] shadow-sm' : 'text-slate-400'}`}><Users size={14} /> الموردين</button>
                <button onClick={() => setActiveTab('adjust')} className={`flex-1 py-3 px-3 rounded-xl text-[11px] font-black flex items-center justify-center gap-2 transition-all whitespace-nowrap ${activeTab === 'adjust' ? 'bg-white text-[#1E4D4D] shadow-sm' : 'text-slate-400'}`}><ArrowRightLeft size={14} /> تسوية</button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                {activeTab === 'details' && (
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-2">إسم الصنف التجاري</label>
                      <input 
                        className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-[11px] font-black text-[#1E4D4D] outline-none focus:bg-white focus:border-emerald-500 transition-all text-right"
                        value={editingProduct.name || editingProduct.Name} 
                        onChange={e => setEditingProduct({...editingProduct, name: e.target.value, Name: e.target.value})} 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                       <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-2">سعر البيع للجمهور</label>
                        <input 
                          type="number"
                          className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-[11px] font-black text-[#1E4D4D] outline-none focus:bg-white focus:border-emerald-500 transition-all text-center"
                          value={editingProduct.price || editingProduct.UnitPrice} 
                          onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value) || 0, UnitPrice: parseFloat(e.target.value) || 0})} 
                        />
                       </div>
                       <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-2">الرصيد المتاح</label>
                        <div className="w-full h-14 bg-slate-100 border border-slate-200 rounded-2xl flex items-center px-6 text-[11px] font-black text-slate-500">
                          {editingProduct.stock || editingProduct.StockQuantity}
                        </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                       <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-2">الحد الأدنى للطلب</label>
                        <input 
                          type="number"
                          className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-[11px] font-black text-[#1E4D4D] outline-none focus:bg-white focus:border-emerald-500 transition-all text-center"
                          value={editingProduct.MinLevel} 
                          onChange={e => setEditingProduct({...editingProduct, MinLevel: parseFloat(e.target.value) || 0})} 
                        />
                       </div>
                       <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-2">المورد الرئيسي</label>
                        <select 
                          className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-[11px] font-black text-[#1E4D4D] outline-none focus:bg-white focus:border-emerald-500 transition-all appearance-none"
                          value={editingProduct.supplierId || ''} 
                          onChange={e => {
                            const s = suppliers.find(sup => sup.Supplier_ID === e.target.value);
                            setEditingProduct({...editingProduct, supplierId: e.target.value, supplierName: s?.Supplier_Name || ''});
                          }} 
                        >
                          <option value="">اختر مورداً...</option>
                          {suppliers.map(s => (
                            <option key={s.Supplier_ID} value={s.Supplier_ID}>{s.Supplier_Name}</option>
                          ))}
                        </select>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                       <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-2">تاريخ الصلاحية</label>
                        <input 
                          type="date"
                          className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-[11px] font-black text-[#1E4D4D] outline-none focus:bg-white focus:border-emerald-500 transition-all"
                          value={editingProduct.ExpiryDate} 
                          onChange={e => setEditingProduct({...editingProduct, ExpiryDate: e.target.value})} 
                        />
                       </div>
                       <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-2">التصنيف</label>
                        <select 
                          className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-[11px] font-black text-[#1E4D4D] outline-none focus:bg-white focus:border-emerald-500 transition-all appearance-none"
                          value={editingProduct.categoryId || ''} 
                          onChange={e => {
                            const c = categories.find(cat => cat.id === e.target.value);
                            setEditingProduct({...editingProduct, categoryId: e.target.value, categoryName: c?.categoryName || ''});
                          }} 
                        >
                          <option value="">اختر تصنيفاً...</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.categoryName}</option>
                          ))}
                        </select>
                       </div>
                    </div>

                    <div className="pt-8 border-t border-slate-100 space-y-6">
                       <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[3px]">إحصائيات الأسعار</h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                           <p className="text-[11px] font-black text-slate-400 mb-4 uppercase tracking-widest">تغيرات الأسعار الأخيرة</p>
                           {priceHistory.length === 0 ? (
                             <p className="text-xs font-bold text-slate-300 italic">لا يوجد سجل أسعار متاح</p>
                           ) : (
                             <div className="space-y-3">
                               {priceHistory.map(ph => (
                                 <div key={ph.id} className="flex justify-between items-center">
                                   <span className="text-[11px] font-bold text-slate-400">{ph.Invoice_Date}</span>
                                   <span className="text-sm font-black text-[#1E4D4D]">{ph.Price} {currency}</span>
                                 </div>
                               ))}
                             </div>
                           )}
                         </div>
                         <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                           <p className="text-[11px] font-black text-slate-400 mb-4 uppercase tracking-widest">آخر عمليات الشراء</p>
                           {purchaseHistory.length === 0 ? (
                             <p className="text-xs font-bold text-slate-300 italic">لا يوجد سجل مشتريات متاح</p>
                           ) : (
                             <div className="space-y-3">
                               {purchaseHistory.map(ph => (
                                 <div key={ph.id} className="flex justify-between items-center">
                                   <span className="text-[11px] font-bold text-slate-400">{ph.date.split('T')[0]}</span>
                                   <span className="text-sm font-black text-blue-600">{ph.items.find(it => it.product_id === editingProduct.id)?.price} {currency}</span>
                                 </div>
                               ))}
                             </div>
                           )}
                         </div>
                       </div>
                    </div>
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="space-y-6">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[3px]">سجل حركات المخزون</h4>
                    <div className="bg-white border border-slate-100 rounded-[32px] overflow-x-auto custom-scrollbar shadow-sm">
                      <table className="w-full text-right min-w-[450px]">
                        <thead className="bg-slate-50 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                          <tr>
                            <th className="px-8 py-5">التاريخ</th>
                            <th className="px-8 py-5">النوع</th>
                            <th className="px-8 py-5 text-center">الكمية</th>
                            <th className="px-8 py-5">المستند</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {movements.map(mv => (
                            <tr key={mv.TransactionID} className="hover:bg-slate-50 transition-colors">
                              <td className="px-8 py-5 text-xs font-bold text-slate-500">{new Date(mv.TransactionDate).toLocaleDateString()}</td>
                              <td className="px-8 py-5">
                                <Badge variant={mv.TransactionType === 'SALE' ? 'warning' : mv.TransactionType === 'PURCHASE' ? 'success' : 'info'} className="!rounded-full px-3 py-0.5 text-[9px] font-black">
                                  {mv.TransactionType}
                                </Badge>
                              </td>
                              <td className={`px-8 py-5 text-center text-sm font-black ${mv.QuantityChange > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {mv.QuantityChange > 0 ? '+' : ''}{mv.QuantityChange}
                              </td>
                              <td className="px-8 py-5 text-[11px] font-bold text-slate-400">{mv.SourceDocumentID}</td>
                            </tr>
                          ))}
                          {movements.length === 0 && (
                            <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-300 italic">لا توجد حركات مسجلة لهذا الصنف</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'warehouses' && (
                  <div className="space-y-6">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[3px]">توزيع المخزون</h4>
                    <div className="grid grid-cols-1 gap-4">
                      {warehouseStocks.map(ws => (
                        <div key={ws.id} className="bg-white p-8 rounded-[32px] border border-slate-100 flex justify-between items-center shadow-sm">
                          <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner"><WarehouseIcon size={24} /></div>
                            <div>
                              <p className="text-sm font-black text-[#1E4D4D]">{ws.warehouseId === 'WH-MAIN' ? 'المستودع الرئيسي' : ws.warehouseId}</p>
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">آخر تحديث: {new Date(ws.lastUpdated).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="text-left">
                            <p className="text-3xl font-black text-[#1E4D4D]">{ws.quantity}</p>
                            <p className="text-[11px] text-slate-300 uppercase font-bold tracking-widest mt-1">Available Units</p>
                          </div>
                        </div>
                      ))}
                      {warehouseStocks.length === 0 && (
                        <div className="p-20 text-center text-slate-300 italic">لا توجد بيانات مستودعات متاحة</div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'suppliers' && (
                  <div className="h-full -m-10">
                    <SupplierManagement lang="ar" onNavigate={onNavigate} />
                  </div>
                )}

                {activeTab === 'adjust' && (
                  <div className="space-y-10">
                    <div className="bg-amber-50 border border-amber-100 p-8 rounded-[32px] flex gap-6">
                      <AlertCircle className="text-amber-500 shrink-0" size={32} />
                      <div className="space-y-2">
                        <p className="text-sm font-black text-amber-900">تحذير أمني</p>
                        <p className="text-xs font-bold text-amber-700 leading-relaxed">عمليات التسوية المخزنية تؤثر مباشرة على الأرصدة والقيود المحاسبية. يرجى التأكد من الكميات والأسباب قبل التأكيد.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mr-2">نوع التسوية</label>
                        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-2">
                          <button onClick={() => setAdjustment({...adjustment, qty: Math.abs(adjustment.qty)})} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${adjustment.qty >= 0 ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}><PlusCircle size={16} /> إضافة</button>
                          <button onClick={() => setAdjustment({...adjustment, qty: -Math.abs(adjustment.qty)})} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${adjustment.qty < 0 ? 'bg-white text-red-500 shadow-sm' : 'text-slate-400'}`}><MinusCircle size={16} /> خصم</button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mr-2">الكمية</label>
                        <input 
                          type="number"
                          className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-lg font-black text-[#1E4D4D] outline-none focus:bg-white focus:border-emerald-500 transition-all"
                          placeholder="0"
                          value={Math.abs(adjustment.qty)} 
                          onChange={e => setAdjustment({...adjustment, qty: (parseFloat(e.target.value) || 0) * (adjustment.qty < 0 ? -1 : 1)})} 
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mr-2">سبب التسوية</label>
                      <input 
                        className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-sm font-black text-[#1E4D4D] outline-none focus:bg-white focus:border-emerald-500 transition-all"
                        placeholder="مثال: تلف، خطأ جرد، هدايا..." 
                        value={adjustment.reason} 
                        onChange={e => setAdjustment({...adjustment, reason: e.target.value})} 
                      />
                    </div>
                    
                    <button 
                      onClick={handleAdjustment}
                      className={`w-full h-16 rounded-[24px] font-black text-sm text-white shadow-xl active:scale-95 transition-all ${adjustment.qty < 0 ? 'bg-red-500 shadow-red-900/20' : 'bg-emerald-500 shadow-emerald-900/20'}`}
                    >
                      تأكيد التسوية المخزنية
                    </button>
                  </div>
                )}
              </div>

              {activeTab === 'details' && (
                <div className="p-10 border-t border-slate-50 shrink-0">
                  <button 
                    onClick={async () => { 
                      await ProductRepository.save(editingProduct); 
                      refreshGlobal(); 
                      setEditingProduct(null); 
                      addToast("تم تحديث البيانات بنجاح ✅", "success");

                    }}
                    className="w-full h-16 bg-[#1E4D4D] text-white rounded-[24px] font-black text-sm shadow-2xl shadow-emerald-900/40 active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    <Save size={20} />
                    <span>تأكيد وحفظ بيانات الصنف</span>
                  </button>
                </div>
              )}
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InventoryModule;
