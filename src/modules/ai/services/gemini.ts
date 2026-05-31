import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY || "";

/**
 * Gemini AI Engine - Supports real cloud analysis with offline safety.
 */
export class GeminiEngine {
  private static genAI: GoogleGenAI | null = null;

  static getClient() {
    if (!this.genAI) {
      if (!API_KEY) {
        console.warn("[GeminiEngine] API Key missing. Falling back to offline responses.");
        return null;
      }
      this.genAI = new GoogleGenAI({
        apiKey: API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return this.genAI;
  }

  static async generateInsight(prompt: string): Promise<string> {
    const client = this.getClient();
    if (!client) {
      return "النظام يعمل حالياً في الوضع المحلي المستقل. التحليلات السحابية تتطلب مفتاح API صالحاً.";
    }

    try {
      const response = await client.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt
      });
      return response.text || "لم يتم استلام رد من النموذج.";
    } catch (error) {
      console.error("[GeminiEngine] Generation failed:", error);
      return "فشل النظام في إنشاء تحليل ذكي حالياً. يرجى التحقق من الاتصال بالإنترنت ومفتاح الـ API.";
    }
  }
}

export const ai = {
  getModel: (model: string = "gemini-flash-latest") => {
    return {
      generateContent: async (contents: any) => {
        const client = GeminiEngine.getClient();
        if (!client) return { text: "Offline mode." };
        return await client.models.generateContent({ model, contents });
      }
    };
  },
  generateInsight: GeminiEngine.generateInsight,
  models: {
    generateContent: async (options: { model: string; contents: any }) => {
      const client = GeminiEngine.getClient();
      if (!client) return { text: "النظام يعمل في الوضع المحلي المستقل. التحليلات السحابية تتطلب مفتاح API." };
      return await client.models.generateContent({
        model: options.model,
        contents: options.contents
      });
    }
  }
};
