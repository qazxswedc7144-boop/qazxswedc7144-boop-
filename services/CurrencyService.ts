
import { db } from './database';
import { Currency } from '../types';
import { eventBus, EVENTS } from './eventBus';

export class CurrencyService {
  private static ACTIVE_CURRENCY_KEY = 'ACTIVE_CURRENCY';
  private static CURRENCY_NAME_KEY = 'ACTIVE_CURRENCY_NAME';

  /**
   * دالة تحديث العملة للنظام بالكامل
   * @param {string} code - رمز العملة (مثل YER)
   * @param {string} label - اسم العملة (مثل يمني)
   * @param {boolean} isNew - هل هي عملة جديدة تضاف لأول مرة؟
   */
  static async setGlobalCurrency(code: string, label: string, isNew: boolean = false) {
    const upperCode = code.toUpperCase();
    
    // 1. إذا كانت عملة جديدة، تضاف لقائمة العملات المتاحة مستقبلاً
    if (isNew) {
      const newCurrency: Currency = {
        id: db.generateId('CUR'),
        code: upperCode,
        name: label,
        symbol: upperCode,
        isBase: false,
        lastModified: new Date().toISOString()
      };
      await db.saveCurrency(newCurrency);
    }

    // 2. تعيين العملة كـ "عملة نشطة" للنظام بالكامل في الإعدادات
    await db.saveSetting(this.ACTIVE_CURRENCY_KEY, upperCode);
    await db.saveSetting(this.CURRENCY_NAME_KEY, label);

    // 3. تحديث الذاكرة المؤقتة (للتوافق مع الكود القديم إن وجد)
    (window as any).currentSystemCurrency = upperCode;
    localStorage.setItem('pharma_currency', upperCode);

    // 4. إرسال حدث لتنبيه الواجهة بالتغيير
    eventBus.emit(EVENTS.CURRENCY_CHANGED, { code: upperCode, label });
    
    console.log(`✅ النظام الآن يعمل بعملة: ${label} (${upperCode})`);
    return upperCode;
  }

  /**
   * جلب العملة النشطة الحالية
   */
  static async getActiveCurrency(): Promise<{ code: string; label: string }> {
    const code = await db.getSetting(this.ACTIVE_CURRENCY_KEY, 'AED');
    const label = await db.getSetting(this.CURRENCY_NAME_KEY, 'درهم إماراتي');
    
    // Update window cache
    (window as any).currentSystemCurrency = code;
    
    return { code, label };
  }

  /**
   * مراقب يقوم بتحديث الرموز في الواجهة تلقائياً
   * في بيئة Dexie، نعتمد على eventBus بدلاً من onSnapshot
   */
  static startCurrencyObserver(onUpdate: (code: string, label: string) => void) {
    // جلب القيمة الحالية فوراً
    this.getActiveCurrency().then(curr => onUpdate(curr.code, curr.label));

    // الاشتراك في التغييرات المستقبلية
    return eventBus.subscribe(EVENTS.CURRENCY_CHANGED, (data: any) => {
      if (data && data.code) {
        onUpdate(data.code, data.label);
        
        // تحديث جميع العناصر التي تحمل كلاس العملة في الواجهة (DOM Manipulation as requested)
        document.querySelectorAll(".currency-label").forEach(el => {
          (el as HTMLElement).innerText = data.code;
        });
      }
    });
  }

  /**
   * تحويل المبلغ إلى العملة الأساسية (Base Currency)
   */
  static async convertToBase(amount: number, fromCurrency: string, date?: string) {
    const baseCurrency = await db.getSetting('BASE_CURRENCY', 'AED');
    
    if (fromCurrency === baseCurrency) {
      return { baseAmount: amount, rate: 1 };
    }

    // البحث عن سعر الصرف في قاعدة البيانات
    const rates = await db.getExchangeRates(date);
    const rateEntry = rates.find(r => r.fromCurrency === fromCurrency && r.toCurrency === baseCurrency);
    
    if (rateEntry) {
      return { baseAmount: amount * rateEntry.rate, rate: rateEntry.rate };
    }

    // سعر صرف افتراضي إذا لم يوجد (لأغراض العرض)
    const defaultRates: Record<string, number> = {
      'USD': 3.67,
      'SAR': 1.0,
      'YER': 0.014
    };

    const rate = defaultRates[fromCurrency] || 1;
    return { baseAmount: amount * rate, rate };
  }
}
