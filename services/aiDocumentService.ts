
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ParsedInvoice {
  invoice_number: string;
  supplier_name: string;
  date: string;
  payment_method: 'Cash' | 'Credit';
  is_return: boolean;
  notes: string;
  items: {
    name: string;
    qty: number;
    price: number;
    expiryDate: string;
  }[];
}

export const aiDocumentService = {
  async parseInvoice(base64Data: string, mimeType: string): Promise<ParsedInvoice | null> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType
                }
              },
              {
                text: `Analyze this invoice and extract the following information in JSON format:
                - invoice_number (string)
                - supplier_name (string)
                - date (string, YYYY-MM-DD)
                - payment_method ('Cash' or 'Credit')
                - is_return (boolean, true if it's a return/credit note)
                - notes (string)
                - items (array of objects with: name, qty, price, expiryDate (YYYY-MM-DD or empty))`
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              invoice_number: { type: Type.STRING },
              supplier_name: { type: Type.STRING },
              date: { type: Type.STRING },
              payment_method: { type: Type.STRING, enum: ['Cash', 'Credit'] },
              is_return: { type: Type.BOOLEAN },
              notes: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    qty: { type: Type.NUMBER },
                    price: { type: Type.NUMBER },
                    expiryDate: { type: Type.STRING }
                  },
                  required: ['name', 'qty', 'price']
                }
              }
            },
            required: ['invoice_number', 'supplier_name', 'date', 'items']
          }
        }
      });

      const text = response.text;
      if (!text) return null;
      return JSON.parse(text) as ParsedInvoice;
    } catch (error) {
      console.error("AI Parsing Error:", error);
      return null;
    }
  }
};
