import React, { createContext, useContext, useState, ReactNode } from 'react';

// Helper function to get the first day of the current month in YYYY-MM-DD format
const getBeginningOfMonth = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

// Helper function to get today's date in YYYY-MM-DD format
const getTodayDate = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export interface DateRange {
  fromDate: string;
  toDate: string;
}

export interface ReportSections {
  financial_engine: DateRange;
  inventory_balance: DateRange;
  expiry_report: DateRange;
  item_movement: DateRange;
  item_sales: DateRange;
  item_profitability: DateRange;
  customer_profits: DateRange;
  supplier_profits: DateRange;
  item_purchases: DateRange;
  account_movement: DateRange;
  debt_aging: DateRange;
}

// Support additional dynamic section keys or string querying index signature
export type ReportDates = ReportSections & {
  [key: string]: DateRange;
};

export interface ReportContextType {
  dates: ReportDates;
  updateSectionDates: (sectionName: keyof ReportSections | string, from: string, to: string) => void;
  fromDate: string;
  toDate: string;
  setFromDate: (date: string) => void;
  setToDate: (date: string) => void;
  setDateRange: (from: string, to: string) => void;
  setDates: (from: string, to: string) => void;
  resetDateRange: () => void;
}

const ReportContext = createContext<{
  dates: ReportDates;
  updateSectionDates: (sectionName: keyof ReportSections | string, from: string, to: string) => void;
} | undefined>(undefined);

// Legacy mapping function to sync old names (sales, purchases, accounts) or dynamic names with typed keys
export const mapLegacySectionName = (sectionName: string): keyof ReportSections => {
  const s = sectionName.toLowerCase();
  if (s === 'financial_engine' || s.includes('مالية') || s.includes('financial')) return 'financial_engine';
  if (s === 'inventory_balance' || s.includes('مخزون') || s.includes('inventory') || s.includes('remaining')) return 'inventory_balance';
  if (s === 'expiry_report' || s.includes('صلاحية') || s.includes('expiry')) return 'expiry_report';
  if (s === 'item_movement' || s.includes('حركة الأصناف') || s.includes('movement')) return 'item_movement';
  if (s === 'item_sales' || s === 'sales' || s.includes('مبيعات') || s.includes('sales')) return 'item_sales';
  
  if (s === 'customer_profits' || s.includes('أرباح العملاء') || s.includes('عميل') || s.includes('customer')) return 'customer_profits';
  if (s === 'supplier_profits' || s.includes('أرباح الموردين') || s.includes('مورد') || s.includes('supplier')) return 'supplier_profits';
  if (s === 'item_profitability' || s.includes('أرباح الأصناف') || s.includes('profitability') || s.includes('profits')) return 'item_profitability';
  
  if (s === 'item_purchases' || s === 'purchases' || s.includes('مشتريات') || s.includes('purchases')) return 'item_purchases';
  if (s === 'account_movement' || s === 'accounts' || s.includes('حركة الحساب') || s.includes('حساب') || s.includes('account')) return 'account_movement';
  if (s === 'debt_aging' || s.includes('تعمير') || s.includes('aging')) return 'debt_aging';
  
  return 'financial_engine'; // Default base
};

export const ReportProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dates, setDatesState] = useState<ReportDates>(() => {
    const defaultRange = { fromDate: getBeginningOfMonth(), toDate: getTodayDate() };
    return {
      financial_engine: { ...defaultRange },
      inventory_balance: { ...defaultRange },
      expiry_report: { ...defaultRange },
      item_movement: { ...defaultRange },
      item_sales: { ...defaultRange },
      item_profitability: { ...defaultRange },
      customer_profits: { ...defaultRange },
      supplier_profits: { ...defaultRange },
      item_purchases: { ...defaultRange },
      account_movement: { ...defaultRange },
      debt_aging: { ...defaultRange },
    };
  });

  const updateSectionDates = (sectionName: keyof ReportSections | string, fromDate: string, toDate: string) => {
    const targetKey = mapLegacySectionName(String(sectionName));
    setDatesState((prev) => ({
      ...prev,
      [targetKey]: { fromDate, toDate },
    }));
  };

  return (
    <ReportContext.Provider value={{ dates, updateSectionDates }}>
      {children}
    </ReportContext.Provider>
  );
};

export const useReportContext = (sectionName: keyof ReportSections | string = 'financial_engine'): ReportContextType => {
  const context = useContext(ReportContext);
  if (context === undefined) {
    throw new Error('useReportContext must be used within a ReportProvider');
  }

  const resolvedKey = mapLegacySectionName(String(sectionName));
  const sectionDates = context.dates[resolvedKey] || {
    fromDate: getBeginningOfMonth(),
    toDate: getTodayDate(),
  };

  const setFromDate = (date: string) => {
    context.updateSectionDates(resolvedKey, date, sectionDates.toDate);
  };

  const setToDate = (date: string) => {
    context.updateSectionDates(resolvedKey, sectionDates.fromDate, date);
  };

  const setDateRange = (from: string, to: string) => {
    context.updateSectionDates(resolvedKey, from, to);
  };

  const setDates = (from: string, to: string) => {
    context.updateSectionDates(resolvedKey, from, to);
  };

  const resetDateRange = () => {
    context.updateSectionDates(resolvedKey, getBeginningOfMonth(), getTodayDate());
  };

  return {
    dates: context.dates,
    updateSectionDates: context.updateSectionDates,
    fromDate: sectionDates.fromDate,
    toDate: sectionDates.toDate,
    setFromDate,
    setToDate,
    setDateRange,
    setDates,
    resetDateRange,
  };
};
