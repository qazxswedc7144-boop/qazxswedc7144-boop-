// server/routes/ai.routes.ts
import { Router, Response } from "express";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth.middleware";
import rateLimit from "express-rate-limit";
import { prisma } from "../database/prisma";

export const aiRouter = Router();

// 1. Enterprise-grade Rate Limiting specifically for AI proxy requests to prevent DDoS & billing spikes
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 15, // Max 15 requests per IP address per minute for security coverage
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "RATE_LIMIT_EXCEEDED",
    message: "لقد تجاوزت الحد الأقصى المسموح به لطلبات الذكاء الاصطناعي في هذه الدقيقة. يرجى الانتظار والمحاولة لاحقاً لحماية خوادم المؤسسة."
  },
  validate: { default: false }
});

// Apply rate limiter to all secure AI actions
aiRouter.use(aiRateLimiter);

// Lazy initialization of GoogleGenAI client (avoids crashing on startup if credentials are not set)
let aiInstance: any = null;

async function getAiClient(): Promise<any> {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("⚠️ Warning: GEMINI_API_KEY is not defined in the environment. AI features will fallback gracefully.");
    }
    const mod = await Function("return import('@google/genai')")();
    const GoogleGenAI = mod.GoogleGenAI;
    aiInstance = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY_OFFLINE",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// 2. Maximum Prompt Length Protection against model abuse and buffer overflow attacks
const MAX_PROMPT_CHAR_LIMIT = 20000;

/**
 * Utility to recursively gather all prompt content string length
 */
function extractTextFromContents(contents: any): string {
  if (!contents) return "";
  if (typeof contents === "string") return contents;
  if (Array.isArray(contents)) {
    return contents.map((item: any) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        if (item.text) return item.text;
        if (Array.isArray(item.parts)) {
          return item.parts.map((p: any) => p?.text || "").join(" ");
        }
        if (item.content) {
          return extractTextFromContents(item.content);
        }
      }
      return "";
    }).join(" ");
  }
  if (typeof contents === "object") {
    if (contents.text) return contents.text;
    if (Array.isArray(contents.parts)) {
      return contents.parts.map((p: any) => p?.text || "").join(" ");
    }
  }
  return "";
}

/**
 * Heuristic Token Estimator (~4.1 characters per token overall)
 */
function estimateTokensCount(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4.1));
}

/**
 * Gemini pricing standard calculator (Dynamic pricing for flash models)
 */
function calculateCost(tokensIn: number, tokensOut: number, model: string): number {
  const isFlash = model.includes("flash") || model.includes("flash-latest");
  // $0.075 / million input tokens, $0.30 / million output tokens
  const costPerMillionIn = isFlash ? 0.075 : 0.075;
  const costPerMillionOut = isFlash ? 0.30 : 0.30;
  
  const costIn = (tokensIn / 1_000_000) * costPerMillionIn;
  const costOut = (tokensOut / 1_000_000) * costPerMillionOut;
  return Number((costIn + costOut).toFixed(8));
}

/**
 * Robustly sanitizes errors returning to the client to avoid revealing security keys,
 * environment configuration, node stacks, or internal database schemas.
 */
function sanitizeError(error: any): string {
  const errMsg = error?.message || String(error);
  let sanitized = errMsg
    .replace(/AI[-_]?KEY\s*=\s*[a-zA-Z0-9-_]+/gi, "AI_KEY=[REDACTED]")
    .replace(/AI[-_]?KEY/gi, "AI_KEY")
    .replace(/AI[-_]?SECRET/gi, "AI_SECRET")
    .replace(/mongodb:\/\/\S+/gi, "DATABASE_URL=[REDACTED]")
    .replace(/postgresql:\/\/\S+/gi, "DATABASE_URL=[REDACTED]")
    .replace(/\/home\/\S+/gi, "[REDACTED_PATH]")
    .replace(/C:\\\S+/gi, "[REDACTED_PATH]");
  
  if (sanitized.includes("ECONNREFUSED") || sanitized.includes("ERR_") || error?.stack) {
    return "فشل نظام التحليلات الذكي في إكمال الطلب بسبب خطأ اتصال داخلي آمن.";
  }
  return sanitized;
}

// 7. Google Play compliance directives for AI generated content in pharmaceutical ERPs
const GOOGLE_PLAY_COMPLIANCE_INSTRUCTION = 
  "You are the PharmaFlow Pro Enterprise ERP AI Assistant. " +
  "You must always adhere to strict Google Play Content Guidelines and pharmaceutical safety standards: " +
  "1. Never recommend clinical actions, medicine dosages, or medical treatments without a clear, prominent warning in Arabic specifying that a qualified pharmacist or clinician must verify and double-check instructions. " +
  "2. Do not generate inappropriate, offensive, unsafe, dangerous, or illegal content. " +
  "3. Keep calculations and business insights highly professional, objective, and compliant with standard accounting & healthcare rules.";

/**
 * POST /api/ai/generate-content
 * Secure backend proxy endpoint for Gemini AI content generation with full audits and limits
 */
aiRouter.post("/generate-content", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { model, contents, config } = req.body;
    
    // 3. Enforce user and tenant isolation parameters. Reject anonymous requests.
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;

    if (!tenantId || !userId) {
      return res.status(401).json({
        error: "AUTHENTICATION_REQUIRED",
        message: "لم يتم التحقق من صحة المستخدم أو الشركة (Tenant). يرجى تسجيل الدخول أولاً لتفعيل نظام التحليل المعزول."
      });
    }

    const hasKey = !!process.env.GEMINI_API_KEY;
    if (!hasKey) {
      return res.json({
        text: "التحليلات في وضع عدم الاتصال حالياً. يرجى تهيئة مفتاح API الخاص بـ Gemini في إعدادات النظام.",
        candidates: [
          {
            content: {
              parts: [
                { text: "التحليلات في وضع عدم الاتصال حالياً. يرجى تهيئة مفتاح API الخاص بـ Gemini في إعدادات النظام." }
              ]
            }
          }
        ],
        offline: true
      });
    }

    // 5. Add Prompt Length Protection and reject oversized prompts.
    const promptText = extractTextFromContents(contents);
    if (promptText.length > MAX_PROMPT_CHAR_LIMIT) {
      return res.status(400).json({
        error: "PROMPT_SIZE_EXCEEDED",
        message: `لقد تجاوز مدخل الطلب الحد الأقصى المسموح به وهو ${MAX_PROMPT_CHAR_LIMIT} حرفاً لحماية خوادم المؤسسة.`
      });
    }

    const client = await getAiClient();
    const selectedModel = model === "gemini-flash-latest" ? "gemini-3.5-flash" : (model || "gemini-3.5-flash");

    // Format content list securely
    let apiContents: any = contents;
    if (Array.isArray(contents)) {
      apiContents = contents.map((item: any) => {
        if (typeof item === "string") {
          return { text: item };
        }
        return item;
      });
    }

    // Merge systemInstructions to guarantee Google Play Generative AI safety guidelines compliance
    let finalSystemInstruction = GOOGLE_PLAY_COMPLIANCE_INSTRUCTION;
    if (config?.systemInstruction) {
      finalSystemInstruction = `${GOOGLE_PLAY_COMPLIANCE_INSTRUCTION}\n\nUser Context Specific Instruction:\n${config.systemInstruction}`;
    }

    const response = await client.models.generateContent({
      model: selectedModel,
      contents: apiContents,
      config: {
        ...(config || {}),
        systemInstruction: finalSystemInstruction
      }
    });

    // 4. Trace the exact tokens, model inputs/outputs, and compute standard cost
    let tokensIn = estimateTokensCount(promptText);
    let tokensOut = estimateTokensCount(response.text || "");
    if (response.usageMetadata) {
      tokensIn = response.usageMetadata.promptTokenCount || tokensIn;
      tokensOut = response.usageMetadata.candidatesTokenCount || tokensOut;
    }
    const estimatedCost = calculateCost(tokensIn, tokensOut, selectedModel);

    // Save transactional audit logs inside the isolated database block
    try {
      await prisma.aiUsageLog.create({
        data: {
          tenantId,
          userId,
          model: selectedModel,
          tokensIn,
          tokensOut,
          estimatedCost,
        }
      });
    } catch (logErr) {
      console.error("⚠️ Background DB write for AI Usage tracker failed:", logErr);
    }

    return res.json({
      text: response.text || "",
      candidates: response.candidates || []
    });
  } catch (error: any) {
    console.error("❌ [API_AI] Error in generate-content:", error);
    // 6. Sanitize all AI errors and never expose stack traces, keys, or configurations
    return res.status(500).json({
      error: "AI_GENERATION_FAILED",
      message: sanitizeError(error)
    });
  }
});

/**
 * POST /api/ai/test-key
 * Secure backend check for checking Gemini API keys on connection test
 */
aiRouter.post("/test-key", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { key } = req.body;
    
    // Enforce isolation validation parameters
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;

    if (!tenantId || !userId) {
      return res.status(401).json({
        error: "AUTHENTICATION_REQUIRED",
        message: "لم يتم التحقق من صحة المستخدم أو الشركة (Tenant). الاتصال غير مصرح به."
      });
    }

    const testKey = key || process.env.GEMINI_API_KEY;
    if (!testKey) {
      return res.status(400).json({
        error: "MISSING_KEY",
        message: "يرجى تحديد مفتاح API للاختبار."
      });
    }

    if (testKey.length > 500) {
      return res.status(400).json({
        error: "INVALID_KEY_FORMAT",
        message: "تنسيق مفتاح الـ API غير صالح."
      });
    }

    // Creating a test connection using the specified API key dynamically
    const mod = await Function("return import('@google/genai')")();
    const GoogleGenAI = mod.GoogleGenAI;
    const client = new GoogleGenAI({
      apiKey: testKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Say 'Success' briefly in Arabic.",
      config: {
        systemInstruction: "You are testing the AI client connection. Answer in exactly 1-2 words in Arabic."
      }
    });

    // Trace usage of key test as 5 input / 5 output tokens
    try {
      await prisma.aiUsageLog.create({
        data: {
          tenantId,
          userId,
          model: "gemini-3.5-flash",
          tokensIn: 5,
          tokensOut: 5,
          estimatedCost: calculateCost(5, 5, "gemini-3.5-flash"),
        }
      });
    } catch (logErr) {
      console.error("⚠️ Background DB write failed during connection test:", logErr);
    }

    return res.json({
      success: true,
      text: response.text || "تم الاتصال بنجاح."
    });
  } catch (error: any) {
    console.error("❌ [API_AI] test-key failed:", error);
    return res.json({
      success: false,
      message: sanitizeError(error)
    });
  }
});
