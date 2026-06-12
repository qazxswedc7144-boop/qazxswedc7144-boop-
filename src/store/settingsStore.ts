import { create } from 'zustand';

// تعريف الأنواع المدعومة للعملات والمظهر
export type CurrencyType = 'YER' | 'SAR' | 'USD' | 'AED';
export type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsState {
  currency: CurrencyType;
  theme: ThemeMode;
  isUpdating: boolean;
  setCurrency: (currency: CurrencyType) => Promise<void>;
  setTheme: (theme: ThemeMode) => void;
  syncThemeWithDOM: (theme: ThemeMode) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  currency: (localStorage.getItem('pharmaflow_currency') as CurrencyType) || 'USD',
  theme: (localStorage.getItem('pharmaflow_theme') as ThemeMode) || 'light',
  isUpdating: false,

  // 1. الحل الجذري لمنع تقلبات العملة العشوائية
  setCurrency: async (newCurrency: CurrencyType) => {
    // منع النقرات المتعددة المتزامنة وحظر الـ Race Condition
    if (get().isUpdating) return;

    set({ isUpdating: true, currency: newCurrency });
    localStorage.setItem('pharmaflow_currency', newCurrency);

    try {
      // محاكاة أو استدعاء تحديث الإعدادات على مستوى السيرفر/Dexie محلياً
      // واجهة النظام تعتمد الآن القيمة الجديدة فوراً وحسماً دون رجوع
      await new Promise((resolve) => setTimeout(resolve, 100)); 
      
      console.log(`[Currency Sync]: Successfully locked to ${newCurrency}`);
    } catch (error) {
      console.error("فشل تحديث العملة في قاعدة البيانات الإقليمية", error);
    } finally {
      set({ isUpdating: false });
    }
  },

  // 2. الحل الجذري لتفعيل المظهر الليلي والنهاري فورياً
  setTheme: (newTheme: ThemeMode) => {
    set({ theme: newTheme });
    localStorage.setItem('pharmaflow_theme', newTheme);
    
    // استدعاء فوري لحقن التغيير البصري في شجرة الـ DOM
    get().syncThemeWithDOM(newTheme);
  },

  syncThemeWithDOM: (targetTheme: ThemeMode) => {
    const root = window.document.documentElement;
    
    // إزالة الفئات القديمة لمنع التداخل
    root.classList.remove('light', 'dark');

    if (targetTheme === 'system') {
      // التحقق من مظهر نظام التشغيل أو الأندرويد الافتراضي
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      // حقن الفئة المطلوبة لـ Tailwind CSS لتغيير الألوان فوراً
      root.classList.add(targetTheme);
    }
  }
}));
