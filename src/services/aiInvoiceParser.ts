export interface ParsedInvoice {
  type: 'cash' | 'credit' | 'return';
  supplier: string;
  invoice_number: string;
  date?: string;
  notes: string;
  items: {
    name: string;
    quantity: number;
    price: number;
    expiryDate?: string;
  }[];
}

export async function parseInvoice(text: string): Promise<ParsedInvoice> {
  // MOCK FALLBACK SINCE GOOGLE GENAI IS REMOVED
  return {
    type: 'cash',
    supplier: 'مورد غير معروف (تم التعرف جزئياً)',
    invoice_number: 'INV-' + Math.floor(Math.random() * 10000),
    date: new Date().toISOString().split('T')[0],
    notes: 'تم تعطيل خدمة الذكاء الاصطناعي السحابية.',
    items: [
      {
        name: 'صنف مستخرج آلياً',
        quantity: 1,
        price: 0
      }
    ]
  };
}
