import { GoogleGenAI } from "@google/genai";

export class GeminiAnalyticsService {
  private static ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  static async analyzeData(prompt: string, data: any) {
    try {
      const model = "gemini-3-flash-preview";
      const fullPrompt = `
        أنت خبير محاسبي ومحلل بيانات ذكي لنظام PharmaFlow.
        قم بتحليل البيانات التالية وتقديم توصيات عملية:
        
        البيانات:
        ${JSON.stringify(data, null, 2)}
        
        المطلوب:
        ${prompt}
        
        يرجى تقديم التحليل باللغة العربية وبشكل منسق (Markdown).
      `;

      const response = await this.ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: fullPrompt }] }]
      });

      return response.text || "عذراً، لم أتمكن من إنشاء التحليل حالياً.";
    } catch (error) {
      console.error("Gemini Analytics Error:", error);
      return "حدث خطأ أثناء الاتصال بـ Gemini AI. يرجى التحقق من مفتاح API.";
    }
  }

  static async predictSales(historicalData: any) {
    return this.analyzeData("توقع اتجاه المبيعات للفترة القادمة واقترح كميات الطلب المثالية.", historicalData);
  }

  static async detectAnomalies(transactions: any) {
    return this.analyzeData("ابحث عن أي تناقضات أو عمليات مشبوهة في حركة الحسابات أو المخزون.", transactions);
  }
}
