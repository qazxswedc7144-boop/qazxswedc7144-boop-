import { ReportEngine } from '../core/engines/reportEngine';
import { ai } from '../lib/gemini';

export class GeminiAnalyticsService {
  private static CACHE_PREFIX = 'pharmaflow_gemini_cache_';
  private static CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private static LAST_REQUEST_TIME = 0;
  private static MIN_REQUEST_INTERVAL = 5000; // 5 seconds between requests
  private static isProcessing = false;

  private static async generateHash(str: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  static async analyzeData(prompt: string, data: any) {
    if (this.isProcessing) {
      console.warn("⛔ طلب سابق قيد التنفيذ");
      return "جاري المعالجة، يرجى الانتظار...";
    }

    this.isProcessing = true;

    try {
      const dataStr = JSON.stringify(data);
      const cacheKey = await this.generateHash(prompt + dataStr);
      
      // 1. Check Cache
      const cachedRaw = localStorage.getItem(this.CACHE_PREFIX + cacheKey);
      let cachedData = null;
      if (cachedRaw) {
        cachedData = JSON.parse(cachedRaw);
        // If valid, return directly
        if (Date.now() - cachedData.timestamp < this.CACHE_TTL) {
          return cachedData.result;
        }
      }

      // 2. Rate Limiting (Cooldown)
      const now = Date.now();
      if (now - this.LAST_REQUEST_TIME < this.MIN_REQUEST_INTERVAL) {
        console.warn("⛔ تم منع الطلب بسبب Rate Limit");
        if (cachedData) {
          console.info("ℹ️ استخدام نسخة مخبأة (Cache) لتجنب الانتظار");
          return cachedData.result;
        }
        throw new Error("Rate limited locally");
      }

      // 3. Data Validation
      if (!data || Object.keys(data).length === 0) {
        throw new Error("لا توجد بيانات للتحليل");
      }

      this.LAST_REQUEST_TIME = now;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `${prompt}\n\nData: ${dataStr}`,
      });

      const result = response.text || "لم يتم استلام أي استجابة من الذكاء الاصطناعي.";
      
      // 4. Save to Cache
      localStorage.setItem(this.CACHE_PREFIX + cacheKey, JSON.stringify({
        result,
        timestamp: Date.now()
      }));

      return result;
    } catch (error: any) {
      console.error("Analytics Error:", error);
      if (error.message === "Rate limited locally" || error.message === "لا توجد بيانات للتحليل") {
        throw error;
      }
      return "حدث خطأ أثناء إجراء التحليل. يرجى المحاولة لاحقاً.";
    } finally {
      this.isProcessing = false;
    }
  }

  static async predictSales(historicalData: any) {
    return this.analyzeData("توقع اتجاه المبيعات للفترة القادمة واقترح كميات الطلب المثالية.", historicalData);
  }

  static async analyze(summary: any) {
    return this.analyzeData("قم بتحليل ملخص البيانات التالي وتقديم رؤى سريعة وتوصيات.", summary);
  }

  static async detectAnomalies(transactions: any) {
    return this.analyzeData("ابحث عن أي تناقضات أو عمليات مشبوهة في حركة الحسابات أو المخزون.", transactions);
  }

  static async getTopSellingInsights(data: any) {
    return this.analyzeData("حلل الأصناف الأكثر مبيعاً واقترح استراتيجيات لزيادة الربح منها.", data);
  }

  static async getBestCustomerInsights(data: any) {
    return this.analyzeData("حلل أفضل العملاء واقترح برامج ولاء أو عروض مخصصة لهم.", data);
  }

  static async getHighestProfitInsights(data: any) {
    return this.analyzeData("حلل الأصناف ذات أعلى هامش ربح واقترح كيفية تحسين مبيعاتها.", data);
  }

  static async getEnterpriseInsights() {
    const summary = await ReportEngine.getAnalyticsSummary();
    const incomeStatement = await ReportEngine.getIncomeStatement();
    const data = { summary, incomeStatement };
    return this.analyzeData("قم بتقديم تحليل شامل لأداء المؤسسة المالي والتشغيلي، موضحاً نقاط القوة والضعف وفرص النمو.", data);
  }
}
