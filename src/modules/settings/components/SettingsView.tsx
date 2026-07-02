// @ts-nocheck
import React, { useState } from 'react';
import { 
  Building, Wallet, Users, Database, Palette, ChevronRight, 
  Upload, Download, Trash2, Camera
} from 'lucide-react';
import { PharmacyProfile, FinancialSettings, User, UISettings } from '@/types/settings.types';

const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('profile');
  
  // State management (mocked for now)
  const [pharmacy, setPharmacy] = useState<PharmacyProfile>({
    name: 'صيدلية الفارما',
    phone: '',
    address: '',
    taxNumber: ''
  });

  const sections = [
    { id: 'profile', label: 'بيانات الصيدلية', icon: Building },
    { id: 'finance', label: 'الإعدادات المالية', icon: Wallet },
    { id: 'users', label: 'المستخدمون', icon: Users },
    { id: 'system', label: 'النظام والبيانات', icon: Database },
    { id: 'ui', label: 'المظهر والتخصيص', icon: Palette },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-gray-900" dir="rtl">
      {/* Header */}
      <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">الإعدادات</h2>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar/Tabs */}
        <div className="w-20 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col items-center py-4 gap-2">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveTab(section.id)}
              className={`p-3 rounded-xl transition ${activeTab === section.id ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-600' : 'text-gray-500'}`}
            >
              <section.icon size={24} />
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 p-4 overflow-y-auto">
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold">بيانات الصيدلية العامة</h3>
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center relative border-2 border-dashed border-gray-400">
                  <Camera className="text-gray-500" />
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
              </div>
              <input type="text" placeholder="اسم الصيدلية" className="w-full p-3 rounded-lg border dark:bg-gray-800" value={pharmacy.name} onChange={e => setPharmacy({...pharmacy, name: e.target.value})} />
              <input type="text" placeholder="رقم الهاتف" className="w-full p-3 rounded-lg border dark:bg-gray-800" />
              <input type="text" placeholder="العنوان" className="w-full p-3 rounded-lg border dark:bg-gray-800" />
              <input type="text" placeholder="الرقم الضريبي" className="w-full p-3 rounded-lg border dark:bg-gray-800" />
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold">إعدادات النظام</h3>
              <button className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border shadow-sm">
                <span className="flex items-center gap-2"><Download size={18}/> تصدير نسخة احتياطية</span>
              </button>
              <button className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border shadow-sm">
                <span className="flex items-center gap-2"><Upload size={18}/> استعادة البيانات</span>
              </button>
              <button className="w-full flex items-center justify-between p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
                <span className="flex items-center gap-2"><Trash2 size={18}/> تهيئة النظام وحذف البيانات</span>
              </button>
            </div>
          )}
          
          {/* Add other sections similarly */}
          <div className="text-center text-sm text-gray-400 mt-10">
            PharmaFlow Pro ERP - v1.0
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
