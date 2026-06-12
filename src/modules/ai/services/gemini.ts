// src/modules/ai/services/gemini.ts
import { useAuthStore } from "@/store/authStore";

/**
 * Retrieves the currently active JWT token of the authenticated user session.
 */
function getToken(): string {
  const storeToken = useAuthStore.getState().token;
  if (storeToken) return storeToken;

  // Safe fallback to persist storage
  try {
    const raw = localStorage.getItem("pharma-auth-storage");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.token) {
        return parsed.state.token;
      }
    }
  } catch (e) {}

  return localStorage.getItem("pharmaflow_token") || 
         localStorage.getItem("token") || 
         "";
}

/**
 * Makes a secure request to the backend server-side Gemini AI proxy.
 */
async function callAiProxy(model: string, contents: any): Promise<{ text: string; candidates: any[] }> {
  const token = getToken();
  if (!token) {
    return {
      text: "التحليلات في وضع عدم الاتصال حالياً. يرجى تسجيل الدخول أولاً لتفعيل نظام التحليلات الذكي.",
      candidates: []
    };
  }

  try {
    const response = await fetch("/api/ai/generate-content", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        model,
        contents
      })
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson.message || `HTTP error ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.warn("[GeminiEngine Client] Proxy call info:", error.message || error);
    return {
      text: "النظام يعمل حالياً في وضع عدم الاتصال المستقل، أو أن هناك مشكلة مؤقتة في الاتصال بخدمة الذكاء الاصطناعي.",
      candidates: []
    };
  }
}

/**
 * Gemini AI Engine Client - Invokes secure node proxies to query Gemini.
 */
export class GeminiEngine {
  static getClient() {
    return {
      models: {
        generateContent: async (options: { model: string; contents: any }) => {
          return callAiProxy(options.model, options.contents);
        }
      }
    };
  }

  static async generateInsight(prompt: string): Promise<string> {
    const res = await callAiProxy("gemini-3.5-flash", prompt);
    return res.text;
  }
}

export const ai = {
  getModel: (model: string = "gemini-flash-latest") => {
    return {
      generateContent: async (contents: any) => {
        return callAiProxy(model, contents);
      }
    };
  },
  generateInsight: GeminiEngine.generateInsight,
  models: {
    generateContent: async (options: { model: string; contents: any }) => {
      return callAiProxy(options.model, options.contents);
    }
  }
};
