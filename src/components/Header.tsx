import React from 'react';
// تأكد من وضع صورة الشعار في مجلد assets واستيرادها بهذا الشكل
import logoImg from '../assets/pharmaflow-logo.png'; 

const Header = ({ pageTitle, showBackButton, onBackClick }: { pageTitle?: string, showBackButton?: boolean, onBackClick?: () => void }) => {
  return (
    <header className="w-full bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm">
      
      {/* الجهة اليسرى: زر العودة المطور مع تأثير الـ Hover */}
      <div className="flex items-center gap-4">
        {showBackButton && (
          <button 
            onClick={onBackClick}
            className="text-2xl text-gray-600 hover:text-emerald-600 transition-all duration-300 transform hover:scale-110 p-2 rounded-full hover:bg-emerald-50 flex items-center justify-center"
            title="العودة للرئيسية"
          >
            <span className="leading-none">➟</span>
          </button>
        )}
        
        {/* عنوان الصفحة الحالي */}
        <h1 className="text-xl font-bold text-gray-800 hidden md:block">
          {pageTitle || "PharmaFlow"}
        </h1>
      </div>

      {/* المنتصف: الشعار (تم إصلاح المسار لضمان الظهور) */}
      <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2">
        <img 
          src={logoImg} 
          alt="PharmaFlow Logo" 
          className="h-10 md:h-12 w-auto object-contain transition-opacity duration-500"
          onError={(e) => {
            // حل احتياطي في حال فشل تحميل الصورة مجدداً
            e.currentTarget.src = 'https://via.placeholder.com/150?text=PharmaFlow';
            console.error("فشل تحميل الشعار، يرجى التأكد من وجود الملف في مجلد assets");
          }}
        />
      </div>

      {/* الجهة اليمنى: معلومات المستخدم أو التنبيهات */}
      <div className="flex items-center gap-3" dir="rtl">
        <div className="text-right hidden sm:block">
          <p className="text-xs text-gray-500">مرحباً بك،</p>
          <p className="text-sm font-semibold text-emerald-700">admin</p>
        </div>
        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold border-2 border-emerald-50">
          A
        </div>
      </div>
    </header>
  );
};

export default Header;
