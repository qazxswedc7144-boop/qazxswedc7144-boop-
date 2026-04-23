
import { db } from '../lib/database';

/**
 * Conflict Resolver Service - محرك حل النزاعات (The Judge)
 * يضمن بقاء البيانات متسقة عند العمل من عدة أجهزة في وضع الأوفلاين.
 */
export const conflictResolver = {
  
  /**
   * حل التضارب: الإصدار الأحدث زمنياً هو "الفائز" (Last Write Wins)
   */
  resolve<T extends { lastModified?: string; syncVersion?: number; id?: string; SaleID?: string }>(local: T, remote: T): T {
    // التحقق من الهوية (Idempotency)
    // إذا كانت العملية هي فاتورة مبيعات بنفس المعرف، نعتمد نسخة السيرفر منعاً للتكرار
    const isSameInvoice = (local.SaleID && local.SaleID === remote.SaleID) || (local.id && local.id === remote.id);
    if (isSameInvoice && remote.syncVersion && remote.syncVersion >= (local.syncVersion || 0)) {
      return remote;
    }

    const localTime = new Date(local.lastModified || 0).getTime();
    const remoteTime = new Date(remote.lastModified || 0).getTime();

    // استراتيجية LWW - الوقت هو الفيصل
    if (localTime > remoteTime) {
      return { ...local, syncStatus: 'synced' } as T;
    }

    // إذا تساوى الوقت، نعتمد على رقم الإصدار (Sequence Number)
    if (localTime === remoteTime && (local.syncVersion || 0) > (remote.syncVersion || 0)) {
      return local;
    }

    return remote;
  },

  /**
   * فحص دقيق لمحتوى السجل لاكتشاف التغييرات الفعلية (Deep Check)
   */
  hasConflict(local: any, remote: any): boolean {
    if (!local || !remote) return false;
    
    // استبعاد الحقول الفنية من المقارنة (Meta fields)
    const ignoredKeys = ['lastModified', 'syncVersion', 'syncStatus', 'retries', 'hash'];
    const keys = Object.keys(local).filter(k => !ignoredKeys.includes(k));
    
    // فحص إذا كان أي حقل جوهري قد تغير
    return keys.some(key => {
      // التعامل مع المصفوفات (مثل أصناف الفاتورة)
      if (Array.isArray(local[key])) {
        return JSON.stringify(local[key]) !== JSON.stringify(remote[key]);
      }
      return local[key] !== remote[key];
    });
  },

  /**
   * دمج التغييرات بشكل ذكي (Semantic Merge)
   * يمكن استخدامه مستقبلاً لدمج ملاحظات مختلفة على نفس الفاتورة دون حذف أحدهما
   */
  smartMerge<T extends object>(local: T, remote: T): T {
    return { ...remote, ...local };
  }
};
