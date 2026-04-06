
import { extractTextFromImage } from './ocrService';
import { normalizeArabic, cleanInvoiceText } from './arabicProcessor';
import { parseInvoice, ParsedInvoice } from './aiInvoiceParser';
import { generateFileHash } from './hash';
import { getOCRCache, saveOCRCache } from './ocrCache';
import { applyLearning } from './learningService';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Extracts text from a PDF file.
 */
async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

/**
 * Full pipeline for processing an invoice file (image or PDF).
 */
export async function processInvoice(file: File | string): Promise<ParsedInvoice> {
  const hash = await generateFileHash(file);
  
  // 1. Cache check
  let text = getOCRCache(hash);
  
  if (!text) {
    if (file instanceof File && file.type === 'application/pdf') {
      text = await extractTextFromPDF(file);
    } else {
      text = await extractTextFromImage(file);
    }
    
    if (text) {
      saveOCRCache(hash, text);
    }
  }

  if (!text) {
    throw new Error('تعذر استخراج النص من المستند');
  }

  // 2. Apply learning
  text = applyLearning(text);

  // 3. Cleaning and Normalization
  text = normalizeArabic(text);
  text = cleanInvoiceText(text);

  // 4. AI Analysis
  const data = await parseInvoice(text);

  return data;
}
