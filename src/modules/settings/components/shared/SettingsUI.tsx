import { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface SettingsCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  icon?: React.ElementType;
}

export const SettingsCard = ({ title, description, children, icon: Icon }: SettingsCardProps) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6">
    <div className="p-6 border-b border-slate-50 flex items-center gap-4 bg-slate-50/50">
      {Icon && (
        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
          <Icon size={24} />
        </div>
      )}
      <div>
        <h3 className="text-lg font-bold text-slate-800 font-cairo">{title}</h3>
        {description && <p className="text-sm text-slate-500 font-cairo mt-1">{description}</p>}
      </div>
    </div>
    <div className="p-6 space-y-6">
      {children}
    </div>
  </div>
);

export const Accordion = ({ title, children, defaultOpen = false }: { title: string, children: ReactNode, defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden mb-4 bg-white">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors"
      >
        <span className="font-bold text-slate-700 font-cairo">{title}</span>
        {isOpen ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4 border-t border-slate-100 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface SettingToggleProps {
  label: string;
  description?: string;
  checked: any;
  onChange: (checked: boolean) => void;
  icon?: React.ElementType;
  disabled?: boolean;
}

export const SettingToggle = ({ label, description, checked, onChange, icon: Icon, disabled = false }: SettingToggleProps) => (
  <div className={`flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 hover:border-indigo-100 transition-colors shadow-sm ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
    <div className="flex items-center gap-3">
      {Icon && <div className="p-2 bg-slate-50 rounded-lg text-slate-500"><Icon size={18} /></div>}
      <div>
        <span className="text-sm font-bold text-slate-800 block font-cairo">{label}</span>
        {description && <span className="text-xs text-slate-500 block mt-0.5 font-cairo">{description}</span>}
      </div>
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none ${checked ? 'bg-indigo-500' : 'bg-slate-200'}`}
    >
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'left-1 translate-x-6' : 'left-1'}`} />
    </button>
  </div>
);

interface SettingInputProps {
  label: string;
  value: any;
  onChange?: (value: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  description?: string;
}

export const SettingInput = ({ label, value, onChange, type = 'text', placeholder = '', disabled = false, description }: SettingInputProps) => (
  <div className="space-y-1.5">
    <label className="block text-sm font-bold text-slate-700 font-cairo">{label}</label>
    {description && <p className="text-xs text-slate-500 font-cairo mb-2">{description}</p>}
    <input
      type={type}
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-cairo disabled:opacity-50"
    />
  </div>
);

interface SettingSelectProps {
  label: string;
  value: any;
  onChange?: (value: string) => void;
  options: { value: string; label: string }[];
  description?: string;
  disabled?: boolean;
}

export const SettingSelect = ({ label, value, onChange, options, description, disabled = false }: SettingSelectProps) => (
  <div className="space-y-1.5">
    <label className="block text-sm font-bold text-slate-700 font-cairo">{label}</label>
    {description && <p className="text-xs text-slate-500 font-cairo mb-2">{description}</p>}
    <select
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-cairo disabled:opacity-50"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

export const LoadingSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    {[1, 2].map(i => (
      <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-100 rounded-xl" />
          <div className="space-y-2">
            <div className="h-5 w-48 bg-slate-100 rounded" />
            <div className="h-4 w-64 bg-slate-50 rounded" />
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="h-16 bg-slate-50 rounded-xl w-full" />
          <div className="h-16 bg-slate-50 rounded-xl w-full" />
        </div>
      </div>
    ))}
  </div>
);
