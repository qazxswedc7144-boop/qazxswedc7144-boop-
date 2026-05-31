
/**
 * OCR Cache Management - مدير ذاكرة التخزين المؤقت للتعرف على النصوص
 */

const CACHE_PREFIX = 'pharmaflow_ocr_';

export function getOCRCache(hash: string): string | null {
  return localStorage.getItem(CACHE_PREFIX + hash);
}

export function saveOCRCache(hash: string, text: string): void {
  localStorage.setItem(CACHE_PREFIX + hash, text);
}

export function clearOCRCache(): void {
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(CACHE_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
}
