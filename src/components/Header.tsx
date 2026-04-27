import React, { useState, useEffect } from 'react';
import { db } from '../lib/database';
// تأكد من وضع صورة الشعار في مجلد assets واستيرادها بهذا الشكل
import defaultLogoImg from '../assets/logo-vector.svg'; 
import { HeartPulse, Settings, Bell } from 'lucide-react';
import { useUI } from '../store/AppContext';
import RoleGuard from './RoleGuard';

const DynamicLogo = () => {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [companyName, setCompanyName] = useState("PharmaFlow");

  useEffect(() => {
    const loadLogo = async () => {
      try {
        const config = await db.getSetting('invoice_config', null);
        if (config?.CompanyLogo) {
          setLogoSrc(config.CompanyLogo);
        } else {
          setLogoSrc(defaultLogoImg);
        }
        if (config?.CompanyName) {
          setCompanyName(config.CompanyName);
        }
      } catch (err) {
        setLogoSrc(defaultLogoImg);
      }
    };
    loadLogo();
  }, []);

  if (hasError || !logoSrc) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-xl border border-emerald-100">
        <HeartPulse className="text-emerald-600" size={24} />
        <span className="font-black text-emerald-800 text-lg tracking-tight">
          {companyName}
        </span>
      </div>
    );
  }

  return (
    <img 
      src={logoSrc} 
      alt={`${companyName} Logo`} 
      loading="lazy"
      className="h-10 md:h-12 w-auto object-contain transition-opacity duration-500"
      onError={() => {
        if (logoSrc === defaultLogoImg) {
          // If even SVG fails, fallback to icon
          setHasError(true);
        } else {
          // If IDB logo fails, try default SVG
          setLogoSrc(defaultLogoImg);
        }
      }}
    />
  );
};

const Header = ({ pageTitle, showBackButton, onBackClick }: { pageTitle?: string, showBackButton?: boolean, onBackClick?: () => void }) => {
  const { setSettingsOpen } = useUI();
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
        <DynamicLogo />
      </div>

      {/* الجهة اليمنى: معلومات المستخدم أو التنبيهات */}
      <div className="flex items-center gap-3" dir="rtl">
        <RoleGuard permission="MANAGE_SYSTEM">
          <button 
            onClick={() => setSettingsOpen(true)}
            className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
            title="الإعدادات"
          >
            <Settings size={20} />
          </button>
        </RoleGuard>

        <button 
          className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all relative"
          title="التنبيهات"
        >
          <Bell size={20} />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 border-2 border-white rounded-full"></span>
        </button>

        <div className="text-right hidden sm:block mr-2">
          <p className="text-[10px] text-gray-500 font-bold leading-tight uppercase tracking-tighter">مرحباً بك،</p>
          <p className="text-xs font-black text-emerald-700">admin</p>
        </div>
        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-[#1E4D4D] rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-emerald-900/10 border border-emerald-400/20">
          A
        </div>
      </div>
    </header>
  );
};

export default Header;
