
import React, { createContext, useContext, useState, useCallback } from 'react';

interface InvoiceContextType {
  generatedHtml: string | null;
  setGeneratedHtml: (html: string | null) => void;
  isGenerating: boolean;
  setIsGenerating: (status: boolean) => void;
  lastUsedStyle: string;
  setLastUsedStyle: (style: string) => void;
}

const InvoiceContext = createContext<InvoiceContextType | undefined>(undefined);

export const InvoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastUsedStyle, setLastUsedStyle] = useState('Modern Medical Green');

  const value = React.useMemo(() => ({
    generatedHtml,
    setGeneratedHtml,
    isGenerating,
    setIsGenerating,
    lastUsedStyle,
    setLastUsedStyle
  }), [generatedHtml, isGenerating, lastUsedStyle]);

  return <InvoiceContext.Provider value={value}>{children}</InvoiceContext.Provider>;
};

export const useInvoice = () => {
  const context = useContext(InvoiceContext);
  if (!context) throw new Error('useInvoice must be used within InvoiceProvider');
  return context;
};
