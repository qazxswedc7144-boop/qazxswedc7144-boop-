# دليل إعداد Firebase و Gemini لـ PharmaFlow

## 1. قواعد الأمان (Firebase Security Rules)
قم بنسخ القواعد التالية ولصقها في قسم Rules في Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // حماية كافة المجموعات - الوصول فقط للمستخدمين المسجلين
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // قواعد مخصصة للمخزون
    match /inventory/{item} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.role == 'Admin';
    }
  }
}
```

## 2. إعداد Gemini AI
1. احصل على مفتاح API من [Google AI Studio](https://aistudio.google.com/).
2. أضف المفتاح في ملف `.env` تحت اسم `GEMINI_API_KEY`.
3. النظام مهيأ لاستخدام نموذج `gemini-3-flash-preview` للتحليلات السريعة والذكية.

## 3. الإشعارات التلقائية
النظام يقوم بفحص المخزون والانتهاء تلقائياً عند:
- تشغيل التطبيق.
- إتمام أي عملية بيع.
- تحديث بيانات صنف.

يتم عرض التنبيهات في "مركز الإشعارات" (Notification Center) في الشريط العلوي.
