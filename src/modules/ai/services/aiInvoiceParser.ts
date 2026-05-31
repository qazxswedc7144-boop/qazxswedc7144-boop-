import { ai } from '@/modules/ai/services/gemini';
import { ParsedInvoiceSchema } from '@/shared/validation/ai.schema';

export interface ParsedInvoice {
  type: 'cash' | 'credit' | 'return';
  supplier: string;
  invoice_number: string;
  date?: string;
  notes: string;
  items: {
    name: string;
    quantity: number;
    price: number;
    expiryDate?: string;
  }[];
  status: 'Draft'; // 1. Any invoice processed/read via AI model must obligatorily be saved with "Draft" status.
  warning: string; // 4. Mandatory warning message stating it is awaiting human audit/review.
}

let lastAICall = 0;

/**
 * 2. يمنع منعاً باتاً تمرير أو ترحيل الفاتورة مباشرة إلى الحسابات أو المخازن من خلال هذا الملف.
 * يقتصر دور هذا الملف حصراً على معالجة واستخراج البيانات (Pure Data Extractor) ولا يحتوي على أي ممر أو تحويل مباشر في المعاملات/المخازن.
 */

/**
 * 3. دالة تحقق (Validation Check) تمنع تغيير حالة الفاتورة من 'Draft' إلى 'Approved' أو 'Posted' 
 * إلا إذا كان المستخدم الحالي يمتلك صلاحية محاسبية أو إدارية معتمدة.
 * 
 * @param user كائن المستخدم الحالي ويشتمل على حقل role
 * @param targetStatus الحالة المستهدفة المراد التغيير إليها
 * @returns كائن يحتوي على نتيجة التحقق ورسالة الخطأ إن وجدت
 */
export function validateStatusTransition(
  user: { role: string } | null | undefined,
  targetStatus: string
): { success: boolean; error?: string } {
  if (!targetStatus) {
    return { success: true };
  }

  const normTarget = targetStatus.toUpperCase();

  // منع تغيير الحالة للفواتير من Draft إلى Approved أو Posted إلا بوجود صلاحية مناسبة
  if (normTarget === 'APPROVED' || normTarget === 'POSTED') {
    const role = user?.role;
    if (role !== 'Accountant' && role !== 'Admin') {
      return {
        success: false,
        error: "🚫 عذراً، لا تمتلك الصلاحيات المحاسبية أو الإدارية اللازمة لاعتماد أو ترحيل الفاتورة. يُسمح فقط للمحاسبين (Accountant) والمدراء (Admin) بإجراء هذا التحويل."
      };
    }
  }

  return { success: true };
}

/**
 * يقوم بتحليل وقراءة نص الفاتورة عبر نموذج الذكاء الاصطناعي مع فرض حالة "مسودة" إجبارياً وبانتظار التدقيق البشري.
 */
export async function parseInvoice(text: string): Promise<ParsedInvoice> {
  const now = Date.now();

  // حماية من استدعاءات API المتكررة (Rate Limit Protection)
  if (now - lastAICall < 3000) {
    console.warn("⛔ تم منع استدعاء AI (Rate Limit Protection)");
    throw new Error("تجاوز عدد مرات الاستدعاء المسموح بها محلياً. يرجى الانتظار قليلاً.");
  }

  lastAICall = now;

  if (!text || text.trim().length < 10) {
    throw new Error("نص الفاتورة غير كافي للتحليل التلقائي.");
  }

  // الرسالة التحذيرية الموحدة الخاصة بالتدقيق البشري
  const humanReviewWarning = "⚠️ هذه الفاتورة تم توليدها تلقائياً بوسطة الذكاء الاصطناعي، وهي بانتظار المراجعة والتدقيق البشري واليدوي الفوري قبل الاعتماد.";

  try {
    const prompt = `أنت خبير في استخراج البيانات من فواتير الأدوية والمشتريات الطبية باللغة العربية والإنجليزية. 
قم بتحليل النص التالي واستخرج المعلومات المطلوبة بدقة عالية. 
ملاحظات هامة جداً:
1. إذا وجد صنف مكتوب باللغة الإنجليزية أو العربية، استخرج الاسم كما هو.
2. حاول تحديد نوع الفاتورة (cash، credit، return) من السياق.
3. استخرج تاريخ الصلاحية (Expiry Date) لكل صنف إذا وجد بتنسيق YYYY-MM-DD.
4. أرجع النتيجة ككائن JSON مطابقة للشكل التالي فقط دون نصوص أخرى مرافقة.

الشكل المطلوب:
{
  "type": "cash" | "credit" | "return",
  "supplier": "اسم المورد/الشركة",
  "invoice_number": "رقم الفاتورة",
  "date": "YYYY-MM-DD",
  "notes": "الملاحظات المستخرجة",
  "items": [
    { 
      "name": "اسم الدواء/الصنف", 
      "quantity": 1, 
      "price": 10.0, 
      "expiryDate": "YYYY-MM-DD" 
    }
  ]
}

نص الفاتورة المطلوب معالجتها:
${text}
`;

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
    });

    let jsonStr = response.text;
    if (!jsonStr) {
      throw new Error('لم يتم استلام أي بيانات أو استجابة من نموذج الذكاء الاصطناعي.');
    }
    
    // تنظيف المخرجات من كتل الماركداون البرمجية إن وجدت
    if (jsonStr.startsWith('\`\`\`json')) {
      jsonStr = jsonStr.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '');
    } else if (jsonStr.startsWith('\`\`\`')) {
      jsonStr = jsonStr.replace(/\`\`\`/g, '');
    }

    const rawObject = JSON.parse(jsonStr.trim());
    
    // Validate schema safety
    const validation = ParsedInvoiceSchema.safeParse(rawObject);
    if (!validation.success) {
      console.warn("⚠️ AI Response validation failed. Fallback to raw object mapper.", validation.error.format());
    }

    const validatedData = validation.success ? validation.data : rawObject;

    // 1 & 4. فرض القواعد الصارمة على الفاتورة المستخرجة
    return {
      type: (validatedData.type === 'cash' || validatedData.type === 'credit' || validatedData.type === 'return') 
        ? validatedData.type 
        : 'cash',
      supplier: validatedData.supplier || 'غير معروف',
      invoice_number: validatedData.invoice_number || 'INV-' + Math.floor(Math.random() * 100000),
      date: validatedData.date || new Date().toISOString().split('T')[0],
      notes: validatedData.notes 
        ? `[بانتظار المراجعة والتدقيق البشري واليدوي] ${validatedData.notes}` 
        : '[بانتظار المراجعة والتدقيق البشري واليدوي]',
      items: (validatedData.items || []).map((item: any) => ({
        name: item.name || 'مادة مجهولة الاسم',
        quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
        price: typeof item.price === 'number' && item.price >= 0 ? item.price : 0,
        expiryDate: item.expiryDate || undefined
      })),
      status: 'Draft', // فرض حالة مسودة إجبارياً بحسب الشرط رقم 1
      warning: humanReviewWarning // إرفاق الرسالة التحذيرية المطابقة للشرط رقم 4
    };

  } catch (error) {
    console.error('AI Parse Error [Encountered, utilizing secure Draft fallback]:', error);
    
    // في حالة حدوث خطأ، نقوم بإرجاع مسودة آمنة وفارغة متوافقة مع القواعد الصارمة والشرط رقم 1 ورقم 4
    return {
      type: 'cash',
      supplier: 'مورد غير معروف - فشل القراءة الآلية',
      invoice_number: 'ERR-' + Math.floor(Math.random() * 100000),
      date: new Date().toISOString().split('T')[0],
      notes: `[فشل في الفك الآلي] يرجى إدخال البيانات يدوياً. ${humanReviewWarning}`,
      items: [],
      status: 'Draft', // فرض حالة مسودة إجبارياً بحسب الشرط رقم 1
      warning: `${humanReviewWarning} (ملاحظة: فشل التحليل التلقائي وتراجع النظام إلى مسودة فارغة وحماية ضد التمرير المباشر)`
    };
  }
}

