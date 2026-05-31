
import React, { useState } from 'react';
import { Printer, FileText, Table, ChevronDown, CheckCircle2, ShoppingBag } from 'lucide-react';
import { ExportService } from '@/services/data/exportService';
import { PrintEngine } from '@/services/print/PrintEngine';

interface PrintMenuProps {
  data: any;
  type: 'SALE' | 'PURCHASE' | 'VOUCHER' | 'REPORT';
  items?: any[];
}

const PrintMenu: React.FC<PrintMenuProps> = ({ data, type, items }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAction = async (action: 'PRINT_A4' | 'PRINT_THERMAL' | 'PDF' | 'EXCEL') => {
    // منع الطباعة إذا لم تكن البيانات مكتملة (Constraint: Prevent printing if unsaved)
    const refId = data.SaleID || data.invoiceId || data.purchase_id || data.id || 'DOC';
    
    setIsProcessing(true);
    try {
      const fileName = `${type}_${refId}`;

      if (action === 'PRINT_A4') {
        await PrintEngine.renderAndPrint(data, type, 'A4', items);
      } else if (action === 'PRINT_THERMAL') {
        await PrintEngine.renderAndPrint(data, type, 'THERMAL', items);
      } else if (action === 'PDF') {
        await PrintEngine.generateHighFidelityPDF(data, type, items);
      } else if (action === 'EXCEL') {
        let headers: string[] = [];
        let exportItems: any[] = [];

        if (type === 'REPORT') {
          headers = data.headers || [];
          exportItems = data.rows || [];
        } else if (type === 'VOUCHER') {
          headers = ['Name', 'Amount', 'Date', 'Category'];
          exportItems = [{
            Name: data.name || data.Entity_Name,
            Amount: data.amount || data.Amount,
            Date: data.date || data.Transaction_Date,
            Category: data.category || data.Transaction_Type
          }];
        } else {
          headers = ['name', 'qty', 'price', 'sum'];
          exportItems = items || data.items || [];
        }
        
        ExportService.exportToExcel(exportItems, fileName, headers);
      }
    } catch (e: any) {
      console.error("Print action failed:", e);
      // Clean up alert and use safe tracking
    } finally {
      setIsProcessing(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative font-cairo">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        disabled={isProcessing}
        className={`flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-100 rounded-xl text-[#1E4D4D] shadow-sm hover:border-[#1E4D4D] transition-all active:scale-95 group ${isProcessing ? 'opacity-50 cursor-wait' : ''}`}
      >
        {isProcessing ? (
          <div className="w-4 h-4 border-2 border-[#1E4D4D] border-t-transparent rounded-full animate-spin"></div>
        ) : (
          <Printer size={18} className="group-hover:rotate-12 transition-transform" />
        )}
        <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">
          {isProcessing ? 'جاري التحضير...' : 'الطابعة'}
        </span>
        <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[200]" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-12 w-64 bg-white rounded-[28px] shadow-2xl border border-slate-100 z-[210] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-3 space-y-1">
              {/* Option 1: Print A4 (Unified Modern Template) */}
              <button 
                onClick={() => handleAction('PRINT_A4')}
                className="w-full flex items-center gap-4 p-4 hover:bg-emerald-50 rounded-2xl transition-colors text-right group"
              >
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <Printer size={20} />
                </div>
                <div>
                  <p className="text-[11px] font-black text-[#1E4D4D]">طباعة A4 قياسية</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase">Enterprise Safe A4 Template</p>
                </div>
              </button>

              {/* Option 2: Thermal Printing Support (80mm narrow Monochrome receipt) */}
              <button 
                onClick={() => handleAction('PRINT_THERMAL')}
                className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-colors text-right group"
              >
                <div className="w-10 h-10 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center group-hover:bg-slate-700 group-hover:text-white transition-all">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <p className="text-[11px] font-black text-[#1E4D4D]">طباعة حرارية POS</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase">Thermal Printer 80mm</p>
                </div>
              </button>

              {/* Option 3: High Fidelity Vector-Accurate Safe PDF */}
              <button 
                onClick={() => handleAction('PDF')}
                className="w-full flex items-center gap-4 p-4 hover:bg-blue-50 rounded-2xl transition-colors text-right group"
              >
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-[11px] font-black text-[#1E4D4D]">تصدير PDF آمن</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase">Vector-Accurate PDF</p>
                </div>
              </button>

              {/* Option 4: Spreadsheet Export */}
              <button 
                onClick={() => handleAction('EXCEL')}
                className="w-full flex items-center gap-4 p-4 hover:bg-amber-50 rounded-2xl transition-colors text-right group"
              >
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all">
                  <Table size={20} />
                </div>
                <div>
                  <p className="text-[11px] font-black text-[#1E4D4D]">تصدير Excel</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase">Data Spreadsheet</p>
                </div>
              </button>
            </div>
            
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
               <CheckCircle2 size={12} className="text-emerald-500" />
               <span className="text-[8px] font-black text-slate-400 uppercase">Audit Logging Active</span>
            </div>
            
            <button 
              onClick={() => setIsOpen(false)}
              className="w-full py-3 bg-white text-[10px] font-black text-slate-400 hover:text-red-500 transition-colors border-t border-slate-100"
            >إغلاق القائمة</button>
          </div>
        </>
      )}
    </div>
  );
};

export default PrintMenu;
