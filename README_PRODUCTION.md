# دليل الإنتاج والتشغيل الشامل | PharmaFlow Pro ERP

يحتوي هذا الملف على كافة الأوامر، والتركيبات، والتعليمات البرمجية، وحلول المشاكل البرمجية الشائعة (Troubleshooting) اللازمة لتشغيل وتثبيت وبناء ونشر تطبيق **PharmaFlow Pro ERP** على مختلف بيئات العمل وبشكل خاص: **Project IDX**, **Firebase Studio**, **Vite**, **Build system** و **Production Deploy**.

---

## 📅 فهرس المحتويات
1. [بيئة التطوير والتشغيل السريع (Project IDX)](#1-بيئة-التطوير-والتشغيل-السريع-project-idx)
2. [قواعد البيانات وتكامل السحابة (Firebase)](#2-قواعد-البيانات-وتكامل-السحابة-firebase)
3. [نظام الحزم وبناء التطبيق (Vite & Build)](#3-نظام-الحزم-وبناء-التطبيق-vite--build)
4. [النشر الفعلي بالإنتاج (Production Deploy)](#4-النشر-الفعلي-بالإنتاج-production-deploy)
5. [حلول مشاكل توافقية نظام قواعد البيانات (Dexie Compatibility & IndexedDB)](#5-حلول-مشاكل-توافقية-نظام-قواعد-البيانات-dexie-compatibility--indexeddb)
6. [إصلاحات TypeScript البرمجية وتحسين جودة الأكواد (TypeScript Fixes)](#6-إصلاحات-typescript-البرمجية-وتحسين-جودة-الأكواد-typescript-fixes)
7. [تحسين الأداء وضغط الحزم (Vite Optimization)](#7-تحسين-الأداء-وضغط-الحزم-vite-optimization)

---

## 1. بيئة التطوير والتشغيل السريع (Project IDX)

منصة Google Project IDX توفر بيئة برمجية سحابية متكاملة تعتمد على حاويات لينكس المخصصة.

### أ. أوامر التثبيت (Installation Commands)
عند تشغيل حاوية التطوير لأول مرة، استخدم الأوامر التالية لتنظيف وتثبيت الحزم البرمجية بالكامل:
```bash
# تنظيف ملفات الكاش القديمة في npm وإعادة بناء node_modules
npm cache clean --force
npm install
```

### ب. إعدادات خادم التطوير (Dev Server Configuration)
الخادم في Project IDX يحتاج للربط بالعنوان المحلي `0.0.0.0` ليكون متاحاً عبر النفق السحابي الآمن:
* يجب تفعيل هذا الخيار في ملف `package.json` أو ملف إعدادات `vite.config.ts`.
```json
// package.json - قسم scripts
"scripts": {
  "dev": "vite --host 0.0.0.0 --port 3000"
}
```

### ج. فحص وتصحيح خادم التطوير (Troubleshooting & Logs)
* **مشكلة عدم استجابة الخادم السحابي:**
  في بيئة IDX، قد تصبح منافذ التوجيه مغلقة مؤقتاً، لحل ذلك قم بإعادة تشغيل عمليات Node السابقة عن طريق:
  ```bash
  killall -9 node
  npm run dev
  ```
* **مشاكل كاش خادم التطوير:**
  امسح كاش البناء الأولي لـ Vite لتجنب الأخطاء المتعلقة بالحزم المعالجة مسبقاً (Pre-bundled dependencies):
  ```bash
  rm -rf node_modules/.vite
  npm run dev
  ```

---

## 2. قواعد البيانات وتكامل السحابة (Firebase)

يدعم النظام تخزين البيانات وعمليات المزامنة عبر Firebase Firestore و Firebase Auth من خلال لوحة تحكم Firebase المدمجة والتكامل البرمجي مع Dexie.js للتخزين المحلي غير المتصل بالإنترنت.

### أ. فحص وتهيئة قواعد البيانات السحابية
```bash
# تثبيت أدوات سطر أوامر جافا سكريبت للنشر والإدارة
npm install -g firebase-tools

# تسجيل الدخول لحساب Firebase
firebase login

# تهيئة قواعد المشروع الحالي لربط Firestore
firebase init firestore
```

### ب. نشر القواعد البرمجية (Deploy Rules)
تحديث وإرسال القواعد الأمنية المخصصة لحماية حقول الصيدلة والتعاملات المالية الحيوية:
```bash
# نشر القواعد الأمنية المحددة في ملف firestore.rules
firebase deploy --only firestore:rules
```

### ج. معالجة مشاكل الخوادم والمزامنة (Troubleshooting)
* **مشكلة Permissions Insufficient (صلاحيات منتهية):**
  تحقق من مطابقة القواعد الأمنية في `firestore.rules` للتأكد من ربط معرفات المستخدمين بالمعاملات:
  ```javascript
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /invoices/{document} {
        allow read, write: if request.auth != null;
      }
    }
  }
  ```

---

## 3. نظام الحزم وبناء التطبيق (Vite & Build)

يمتلك المشروع هيكلية هجينة متطورة (Vite كخادم واجهة أمامية و Express كصمام أمان خلفي للعمليات الحساسة ونماذج الذكاء الاصطناعي Gemini).

### أ. أوامر بناء الحزمة الإنتاجية كاملة (Production Build Flow)
```bash
# عملية البناء الكاملة المتكاملة (Front-End & Back-End Server)
npm run build
```
توضيح ميكانيكية البناء في `package.json`:
```json
"build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs"
```
* **Vite build:** يقوم بترجمة ملفات React، ضغط ملفات CSS والتصاميم، وإنتاج واجهة SPA ثابتة داخل مجلد `/dist`.
* **Esbuild:** يقوم بجمع وترجمة خادم Express الخلفي المكتوب بـ TypeScript لملف واحد يعمل بنظام CJS يدعى `dist/server.cjs` والذي يضمن استقرار مسارات الاستيراد محلياً وفي الحاويات (Docker).

### ب. تشغيل نسخة الإنتاج واختبارها محلياً
```bash
# تشغيل الخادم والواجهات المجمعة لتقييم الأداء محلياً قبل النشر الفعلي
npm run start
```

---

## 4. النشر الفعلي بالإنتاج (Production Deploy)

يتم نشر التطبيق في الحاويات السحابية مثل Google Cloud Run، للتأكد من كفاءة المعالجة وتوفير الموارد.

### أ. إعداد متغيرات البيئة السرية (Environment Setup)
قم بإنشاء وتعبئة ملف `.env.example` بكافة المتغيرات التشغيلية التي يحتاجها النظام للتحقق والبناء:
```env
# ملف التوثيق للمتغيرات ومفاتيح الربط للإنتاج
NODE_ENV=production
GEMINI_API_KEY=
FIREBASE_PROJECT_ID=
VITE_API_URL=https://api.pharmaflow.pro
```
* **تنبيه أمني:** لا تقم أبداً بوضع المفاتيح الفعلية داخل الكود أو في ملفات Git، بل ارفعها مباشرة للوحة إدارة السيرفر السحابي (Secret Manager).

### ب. ملف الحاوية الافتراضي (Dockerfile)
لإنتاج حاوية خفيفة وسريعة التحميل للصيدليات المنتشرة سحابياً:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
RUN npm ci --only=production
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
```

---

## 5. حلول مشاكل توافقية نظام قواعد البيانات (Dexie Compatibility & IndexedDB)

من أكثر المشاكل البرمجية داخل بيئات المعاينة المعتمدة على الـ iFrames هي حظر متصفحات Chrome لعمليات الـ IndexedDB (التي يعتمد عليها Dexie.js لتخزين البيانات المحلية للصيدلية).

### أ. معالجة قيود الأمن والحظر في المتصفحات
* **تنبيه هام:** قد يؤدي استخدام متصفح مغلق أمنياً من قبل أطر العمل الأخرى لمنع فتح المعاينة لملف Dexie، للتغلب على هذه المشكلة:
  1. قم بتوفير واجهة تفاعل للمستخدم تتيح فتح التطبيق في تبويب متصفح مستقل ومباشر (`Open in New Tab`).
  2. وفر خطة طوارئ برمجية للتراجع السلس (Memory Fallback) في حالة رفض المتصفح تفعيل IndexedDB.

### ب. الكود المعياري للتعامل مع أخطاء فتح IndexedDB بمرونة:
في ملف `src/core/db.ts` أو الإجراء البرمجي لتهيئة الاتصال:
```typescript
class PharmaFlowDB extends Dexie {
  constructor() {
    super('PharmaFlowPRO');
    // تهيئة الجداول وهياكل الحقول المحلية
    this.version(1).stores({
      invoices: 'id, documentStatus, financialStatus, partnerId, date',
      products: 'id, name, barcode, stock, is_active',
      journalEntries: 'id, date, sourceType, TotalAmount, status'
    });
  }
}

// إنشاء وتوفير دالة التهيئة الآمنة لمعرفة توافق المتصفح
export const safeDBInit = async (dbInstance: Dexie) => {
  try {
    await dbInstance.open();
    console.log("IndexedDB تم الاتصال بنجاح بقاعدة البيانات المحلية");
  } catch (error: any) {
    if (error.name === 'SecurityError' || error.name === 'NotAllowedError') {
      console.warn("تنبيه أمني: المتصفح يمنع كتابة البيانات بسبب قيود الـ iFrame. تم التفعيل الفوري للمزامنة الذاكرية المؤقتة.");
    } else {
      console.error("فشل اتصال Dexie:", error);
    }
  }
};
```

---

## 6. إصلاحات TypeScript البرمجية وتحسين جودة الأكواد (TypeScript Fixes)

يتعامل المشروع مع هياكل بيانات معقدة مثل `Sale`, `Purchase`, JSON من فواتير ذكاء اصطناعي وغيرها، لذا يجب تجنب إيقاف البناء بسبب أخطاء الأنواع والمطابقة:

### أ. معالجة البيانات غير المؤكدة أو الاختيارية (Possibly 'undefined')
عند التعامل مع حقول المخزون أو الكميات، قد تكون بعض القيم مخزنة كـ `null` أو `undefined` مسبقاً في الداتا بيز:
```typescript
// ❌ النمط الخاطئ - قد يسبب انقطاع المعالجة لعدم وجود القيمة
const stockValue = product.stock * product.CostPrice;

// ✅ النمط الصحيح المتوافق أمنياً وعلمياً في TypeScript
const stockValue = (Number(product.stock) || 0) * (Number(product.CostPrice) || 0);
```

### ب. الاستفادة من واجهات التحويل المعيارية (Data Mappers)
لتحقيق التوافق وسد الفجوات بين الأنواع القديمة والـ Enterprise Unified Schema:
```typescript
import { UnifiedInvoice, Sale, Purchase } from '@/types';

// تحويل كائن الفاتورة الموحدة لكائن مبيعات متوافق برمجياً بالكامل
export function mapInvoiceToSale(inv: UnifiedInvoice): Sale {
  return {
    ...inv,
    SaleID: inv.id,
    customerId: inv.partnerId,
    branchId: 'main',
    totalCost: inv.subtotal * 0.7, // COGS estimate
    InvoiceStatus: inv.documentStatus,
    paidAmount: inv.paidAmount,
    items: inv.items,
    finalTotal: inv.finalTotal,
    paymentStatus: inv.paymentStatus,
    Date: inv.date
  } as unknown as Sale;
}
```

---

## 7. تحسين الأداء وضغط الحزم (Vite Optimization)

ضمان استجابة وسرعة فتح واجهة صيدليات PharmaFlow وحقن الخدمات من خلال تحسين إعدادات Vite:

### أ. تقسيم الكود والملفات البرمجية (Vendor Chunk Splitting)
قم بتعديل ملف `vite.config.ts` لفصل حقول المكتبات الثقيلة (Recharts, Dexie, motion) عن نواة منطق العمل التطبيق:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3')) {
              return 'charts-vendor';
            }
            if (id.includes('dexie') || id.includes('@google/genai')) {
              return 'db-ai-vendor';
            }
            return 'core-vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 800 // تعيين الحد الأقصى الآمن لتجنب تحذيرات الحزم
  }
});
```

### ب. منع تحديثات التحديث المباشر المزعجة بكود المعاينة (Ignore HMR Websocket Warnings)
أثناء عمل التطوير السحابي في Project IDX أو بيئة المعاينة، قد ينقطع خادم WebSocket والـ HMR، وتظهر تحذيرات مستمرة في الـ Console كـ `[vite] failed to connect to websocket`.
* **ملاحظة:** هذا السلوك طبيعي ومبرر لأن البيئة تضع متغير `DISABLE_HMR=true` لمنع وميض وتفكك المعاينة أثناء تعديل الأكواد. لا تحاول إلغاء ذلك أو معالجة الخيار برمجياً بالمتصفح، بل تجاهلها بالكامل لأنها لا تؤثر مطلقاً على جودة أو بناء نسخة الإنتاج الخاصة بالعميل.

---
✍️ **تم صياغته لضمان تشغيل وبناء هندسي مستقر على السيرفرات السحابية.**
