
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
 * Extracts text from an image using Google Vision API.
 */
export async function extractTextFromImage(file: File | string): Promise<string> {
  const apiKey = import.meta.env.VITE_GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    throw new Error('Google Vision API Key is missing. Please check your environment variables.');
  }

  try {
    const base64 = await toBase64(file);
    const content = base64.split(',')[1];

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content },
              features: [{ type: 'TEXT_DETECTION' }]
            }
          ]
        })
      }
    );

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || 'Google Vision API error');
    }

    return data.responses?.[0]?.fullTextAnnotation?.text || '';
  } catch (error: any) {
    console.error('OCR Error:', error);
    throw new Error('تعذر قراءة الفاتورة بواسطة Google Vision – حاول صورة أوضح');
  }
}
