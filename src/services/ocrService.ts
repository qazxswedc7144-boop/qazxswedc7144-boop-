
import Tesseract from 'tesseract.js';

/**
 * Converts a File or string to base64.
 */
async function toBase64(file: File | string): Promise<string> {
  if (typeof file === 'string') return file;
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
}

/**
 * Extracts text from an image using Tesseract.js instead of Google Vision
 */
export async function extractTextFromImage(file: File | string): Promise<string> {
  try {
    const base64 = await toBase64(file);
    
    const worker = await Tesseract.createWorker(['ara', 'eng']);
    const { data: { text } } = await worker.recognize(base64);
    await worker.terminate();
    
    return text || '';
  } catch (error: any) {
    console.error('OCR Error:', error);
    throw new Error('تعذر قراءة الفاتورة بواسطة تقنية التعرّف – حاول صورة أوضح');
  }
}
