import { ai } from '../lib/gemini';

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
  try {
    const prompt = `استخرج بيانات الفاتورة التالية وقم بإرجاعها ككائن JSON فقط بالشكل التالي:
{
  "type": "cash" | "credit" | "return",
  "supplier": "اسم المورد",
  "invoice_number": "رقم الفاتورة",
  "date": "YYYY-MM-DD",
  "notes": "أي ملاحظات",
  "items": [
    { "name": "اسم الصنف", "quantity": 1, "price": 10.0, "expiryDate": "YYYY-MM-DD" }
  ]
}

نص الفاتورة:
${text}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    let jsonStr = response.text;
    if (!jsonStr) {
      throw new Error('No content received from AI');
    }
    
    // Clean up markdown block if present
    if (jsonStr.startsWith('\`\`\`json')) {
      jsonStr = jsonStr.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '');
    } else if (jsonStr.startsWith('\`\`\`')) {
      jsonStr = jsonStr.replace(/\`\`\`/g, '');
    }

    return JSON.parse(jsonStr.trim()) as ParsedInvoice;
  } catch (error) {
    console.error('AI Parse Error:', error);
    // Fallback on error
    return {
      type: 'cash',
      supplier: 'غير معروف',
      invoice_number: 'INV-' + Math.floor(Math.random() * 10000),
      date: new Date().toISOString().split('T')[0],
      notes: 'فشل التعرف الآلي',
      items: []
    };
  }
}
