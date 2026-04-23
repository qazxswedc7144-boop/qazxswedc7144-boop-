
export const IS_PREVIEW = 
  (typeof process !== 'undefined' && process.env?.APP_ENV === 'preview') || 
  window.location.hostname.includes('aistudio.google.com') ||
  window.location.hostname.includes('run.app');

export const COLORS = {
  primary: '#1E4D4D',
  primaryLight: '#2A6666',
  secondary: '#10B981',
  accent: '#f43f5e',
  background: '#F8FAFA',
  surface: '#ffffff',
  border: '#F1F5F9',
  textMain: '#1E4D4D',
  textMuted: '#94A3B8'
};

export const UI_CONFIG = {
  borderRadius: '32px', // تدوير يناسب الجوال
  borderRadiusInner: '24px',
  fontFamily: 'Cairo, sans-serif',
  defaultCurrency: 'AED',
  // Mobile Mobile Specific
  rowHeightMedium: 'py-4', 
  headerWeight: 'font-black',
  headerSize: 'text-2xl', 
  imageShape: 'rounded-[24px]' 
};
