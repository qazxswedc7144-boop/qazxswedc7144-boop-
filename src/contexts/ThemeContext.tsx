import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('saas_theme_mode') as ThemeMode) || 'system';
    }
    return 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  const updateRootThemeAndResolved = (mode: ThemeMode) => {
    let isDark = false;
    if (mode === 'dark') {
      isDark = true;
    } else if (mode === 'system') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    setResolvedTheme(isDark ? 'dark' : 'light');

    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    // Initial apply
    updateRootThemeAndResolved(themeMode);

    // Listen to changes from settings or other modules
    const handleThemeUpdate = () => {
      const current = (localStorage.getItem('saas_theme_mode') as ThemeMode) || 'system';
      setThemeState(current);
      updateRootThemeAndResolved(current);
    };

    window.addEventListener('saas-theme-updated', handleThemeUpdate);

    // Listen to system theme changes if we are on 'system' mode
    const systemMedia = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemMediaChange = () => {
      if (themeMode === 'system') {
        updateRootThemeAndResolved('system');
      }
    };

    systemMedia.addEventListener('change', handleSystemMediaChange);

    return () => {
      window.removeEventListener('saas-theme-updated', handleThemeUpdate);
      systemMedia.removeEventListener('change', handleSystemMediaChange);
    };
  }, [themeMode]);

  const setThemeMode = (mode: ThemeMode) => {
    localStorage.setItem('saas_theme_mode', mode);
    setThemeState(mode);
    updateRootThemeAndResolved(mode);
    window.dispatchEvent(new Event('saas-theme-updated'));
  };

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
