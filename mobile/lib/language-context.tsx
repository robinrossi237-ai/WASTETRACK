import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LANGUAGE_OPTIONS, LanguageCode, translate } from "@/lib/i18n";
import * as storage from "@/lib/storage";

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  options: typeof LANGUAGE_OPTIONS;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("en");

  useEffect(() => {
    let isMounted = true;
    storage.getLanguagePreference().then((value) => {
      if (!isMounted || !value) return;
      setLanguageState(value);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const setLanguage = useCallback((code: LanguageCode) => {
    setLanguageState(code);
    void storage.saveLanguagePreference(code);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(language, key, params),
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      options: LANGUAGE_OPTIONS,
    }),
    [language, setLanguage, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
