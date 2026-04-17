import { GoogleGenAI, Type } from "@google/genai";

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

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function parseInvoice(text: string): Promise<ParsedInvoice> {
  const prompt = `
Extract structured invoice data from the following text:

Language: Arabic or English

Return JSON:
{
  "type": "cash | credit | return",
  "supplier": "Supplier Name",
  "invoice_number": "Invoice Number",
  "date": "YYYY-MM-DD",
  "notes": "Any additional notes",
  "items": [
    {
      "name": "Item Name",
      "quantity": number,
      "price": number,
      "expiryDate": "YYYY-MM-DD (if available)"
    }
  ]
}

Text:
${text}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ['cash', 'credit', 'return'] },
            supplier: { type: Type.STRING },
            invoice_number: { type: Type.STRING },
            date: { type: Type.STRING },
            notes: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  price: { type: Type.NUMBER },
                  expiryDate: { type: Type.STRING }
                },
                required: ['name', 'quantity', 'price']
              }
            }
          },
          required: ['type', 'supplier', 'invoice_number', 'items']
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    
    result.items = result.items.filter((i: any) => i.name && i.quantity && i.price)
    
    if (result.items.length === 0) {
        throw new Error("❌ فشل تحليل الفاتورة")
    }

    return result as ParsedInvoice;
  } catch (error: any) {
    console.error('AI Parsing Error:', error);
    if (error.message?.includes('429') || error.status === 429 || error.message?.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('تم تجاوز حصة الاستخدام لـ Gemini AI. يرجى المحاولة لاحقاً أو التحقق من خطة الاشتراك.');
    }
    throw new Error('فشل تحليل البيانات بواسطة الذكاء الاصطناعي');
  }
}
