
import { extractTextFromImage } from './ocrService';
import { parseInvoice, ParsedInvoice } from './aiInvoiceParser';

/**
 * Smart Import Engine - يجمع بين التعرف البحري على الحروف (OCR) ومعالجة اللغة الطبيعية (AI)
 */
export async function processInvoice(file: File | string): Promise<ParsedInvoice> {
  console.log("🚀 Starting Smart Import Engine...");
  
  // 1. OCR Stage
  const text = await extractTextFromImage(file);
  console.log("📄 Raw Text Extracted:", text.substring(0, 100) + "...");
  
  if (!text || text.trim().length < 5) {
    throw new Error("لم نتمكن من قراءة أي نص في الصورة المرفقة");
  }

  // 2. Parse Stage
  const parsed = await parseInvoice(text);
  console.log("✅ AI Parsing Complete:", parsed);
  
  return parsed;
}
