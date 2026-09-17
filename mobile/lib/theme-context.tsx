import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from 'react';
import Colors from '@/constants/colors';
import { getThemePreference, saveThemePreference, type ThemePreference } from '@/lib/storage';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: typeof Colors.light;
  preference: ThemePreference;
  setThemeMode: (mode: ThemePreference['mode']) => void;
  setManualTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getThemeByTime(): ThemeMode {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 18) {
    return 'light';
  }
  return 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>({ mode: 'auto', manualTheme: 'light' });
  const [mode, setMode] = useState<ThemeMode>(getThemeByTime);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const saved = await getThemePreference();
      if (saved && isMounted) {
        setPreference(saved);
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (preference.mode === 'manual') {
      setMode(preference.manualTheme);
      return;
    }
    setMode(getThemeByTime());
    const interval = setInterval(() => {
      setMode(getThemeByTime());
    }, 60000);
    return () => clearInterval(interval);
  }, [preference.mode, preference.manualTheme]);

  const setThemeMode = useCallback((nextMode: ThemePreference['mode']) => {
    setPreference((prev) => {
      const next: ThemePreference = { ...prev, mode: nextMode };
      void saveThemePreference(next);
      return next;
    });
  }, []);

  const setManualTheme = useCallback((nextTheme: ThemeMode) => {
    setPreference((prev) => {
      const next: ThemePreference = { ...prev, mode: 'manual', manualTheme: nextTheme };
      void saveThemePreference(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    mode,
    isDark: mode === 'dark',
    colors: mode === 'dark' ? Colors.dark : Colors.light,
    preference,
    setThemeMode,
    setManualTheme,
  }), [mode, preference, setThemeMode, setManualTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
