
import { ai } from '@/modules/ai/services/gemini';

export async function extractTextFromImage(file: File | string): Promise<string> {
  try {
    const model = await ai.getModel("gemini-flash-latest");
    if (!model) {
      throw new Error("Failed to initialize Gemini model");
    }

    let imageData: string;
    let mimeType: string;

    if (typeof file === 'string') {
      imageData = file.split(',')[1] || file;
      mimeType = file.match(/data:([^;]+);/)?.[1] || "image/jpeg";
    } else {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i] ?? 0);
      }
      imageData = btoa(binary);
      mimeType = file.type;
    }

    const result = await model.generateContent([
      "Extract all text from this pharmaceutical invoice image accurately. Maintain the structure where possible.",
      {
        inlineData: {
          data: imageData,
          mimeType
        }
      }
    ]);

    const textResult = (result as any).text || (result as any).response?.text?.() || (result as any).response?.text || "";
    return typeof textResult === 'function' ? textResult() : String(textResult);
  } catch (error) {
    console.error("OCR Error:", error);
    return "";
  }
}
