import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api/client";

export type AppLanguage = "en" | "ur";

interface LanguageContextValue {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
}

const LanguageContext = createContext<LanguageContextValue>({ lang: "en", setLang: () => {} });

function readStoredLang(): AppLanguage {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem("wdas.lang");
  return stored === "ur" || stored === "en" ? stored : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<AppLanguage>("en");

  useEffect(() => {
    setLangState(readStoredLang());
    void api.get<{ preferredLanguage: string }>("/api/users/me/preferences")
      .then((p) => {
        if (p.preferredLanguage === "ur" || p.preferredLanguage === "en") {
          setLangState(p.preferredLanguage);
        }
      })
      .catch(() => {});
  }, []);

  const setLang = (next: AppLanguage) => {
    setLangState(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("wdas.lang", next);
    }
    void api.put("/api/users/me/preferences", { preferredLanguage: next }).catch(() => {});
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
