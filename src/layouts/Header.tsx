import { useState, useEffect } from 'react';
import { db } from '@/core/db';
import defaultLogoImg from '@/assets/logo-vector.svg'; 
import { HeartPulse, Settings } from 'lucide-react';
import { useUI } from '@/contexts/AppContext';
import RoleGuard from '@/components/shared/RoleGuard';
import NotificationCenter from '@/components/shared/NotificationCenter';

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
    <header className="w-full bg-white border-b border-gray-100 px-4 pt-3.5 pb-3 flex items-center justify-between sticky top-0 z-50 shadow-sm min-h-[64px]" dir="rtl">
      
      {/* الجهة اليمنى (بداية الصف في RTL): أيقونة الإعدادات وزر العودة متبوعاً بالعنوان */}
      <div className="flex items-center gap-3 z-10">
        <RoleGuard permission="MANAGE_SYSTEM">
          <button 
            onClick={() => setSettingsOpen(true)}
            className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all active:scale-95"
            title="الإعدادات"
          >
            <Settings size={20} />
          </button>
        </RoleGuard>

        {showBackButton && (
          <button 
            onClick={onBackClick}
            className="text-2xl text-gray-600 hover:text-emerald-600 transition-all duration-300 transform hover:scale-110 p-2 rounded-full hover:bg-emerald-50 flex items-center justify-center"
            title="العودة"
          >
            <span className="leading-none">➟</span>
          </button>
        )}
        
        {/* عنوان الصفحة الحالي */}
        <h1 className="text-base font-bold text-gray-800 hidden md:block">
          {pageTitle || "PharmaFlow"}
        </h1>
      </div>

      {/* المنتصف تماماً: الشعار وحاوية الاسم */}
      <div className="flex flex-col items-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0">
        <DynamicLogo />
      </div>

      {/* الجهة اليسرى (نهاية الصف في RTL): أيقونة التنبيهات مع المنبه */}
      <div className="flex items-center gap-3 z-10">
        <NotificationCenter />
      </div>
    </header>
  );
};

export default Header;
