
/**
 * Arabic Text Processor - معالج النصوص العربية المطور
 */

export function normalizeArabic(text: string): string {
  if (!text) return "";
  
  return text
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u0652]/g, "") // Remove Tashkeel
    .trim();
}

export function cleanInvoiceText(text: string): string {
  if (!text) return "";
  
  // Remove garbage characters often found in OCR
  return text
    .replace(/[^\u0600-\u06FF\s0-9a-zA-Z.,#\-:/]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
