
import { db } from './database';

interface CacheEntry<T> {
  version: number;
  data: T;
  CacheTimestamp: number; // الطابع الزمني للحفظ (محاكاة AppSheet)
  expiresAt: number;
  size: number; 
}

/**
 * Report Cache Service - محرك التخزين المؤقت الذكي مع إدارة الذاكرة الصارمة
 * ينفذ قاعدة: IF((NOW() - [CacheTimestamp]) > "000:30:00", TRUE, FALSE)
 */
class ReportCacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly DEFAULT_TTL = 30 * 60 * 1000; // القيمة المطلوبة: 30 دقيقة
  private readonly MAX_ENTRIES = 30; // الحد الأقصى لعدد التقارير في الكاش لضمان الخفة

  constructor() {
    // تشغيل الجامي الدوري (Garbage Collector) كل دقيقة لفحص الصلاحية
    if (typeof window !== 'undefined') {
      setInterval(() => this.gc(), 60000);
    }
  }

  /**
   * جلب البيانات مع التحقق من صلاحيتها زمنياً (Logic Evaluation)
   */
  get<T>(key: string): T | null {
    const currentDbVersion = db.getVersion();
    const entry = this.cache.get(key);

    if (!entry) return null;

    // تطبيق منطق سابعاً (Virtual Column Formula): فحص مرور 30 دقيقة
    const now = Date.now();
    const timeSinceCached = now - entry.CacheTimestamp;
    
    // معادلة: (NOW() - [CacheTimestamp]) > "000:30:00"
    const isExpired = timeSinceCached > this.DEFAULT_TTL;
    
    // التحقق الإضافي من توافق إصدار الداتا (لضمان الدقة المالية)
    const isOldVersion = entry.version !== currentDbVersion;

    if (isExpired || isOldVersion) {
      this.cache.delete(key);
      console.debug(`[CachePurge] Entry "${key}" removed. Reason: ${isExpired ? 'Time Limit' : 'Version Update'}`);
      return null;
    }

    return entry.data as T;
  }

  /**
   * حفظ البيانات في الكاش مع تسجيل الطابع الزمني
   */
  set(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
    // إخلاء مساحة إذا تجاوزنا الحد الأقصى (FIFO)
    if (this.cache.size >= this.MAX_ENTRIES) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    const now = Date.now();
    this.cache.set(key, {
      version: db.getVersion(),
      data,
      CacheTimestamp: now,
      expiresAt: now + ttl,
      size: JSON.stringify(data).length 
    });
  }

  /**
   * سابعاً: تنظيف Cache التقارير تلقائياً في الخلفية
   * يقوم بمسح كافة المدخلات التي تجاوزت عمرها الافتراضي (30 دقيقة)
   */
  gc(): void {
    const now = Date.now();
    let purgedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      // تطبيق نفس منطق المعادلة في الخلفية
      if ((now - entry.CacheTimestamp) > this.DEFAULT_TTL) {
        this.cache.delete(key);
        purgedCount++;
      }
    }
    
    if (purgedCount > 0) {
      console.log(`[MemoryGC] Automatic cleaning complete. Purged ${purgedCount} stale report entries.`);
    }
  }

  /**
   * تفريغ الكاش بالكامل (يستخدم عند تسجيل الخروج أو الأخطاء الحرجة)
   */
  purge(): void {
    this.cache.clear();
    console.warn("[MemoryManager] Global report cache forced purge.");
  }
}

export const reportCache = new ReportCacheService();
