"use client";
// Idioma de la herramienta de valoración en el navegador: la página pasa las traducciones de su idioma.
import { createContext, useContext } from "react";
import {
  translateStudy,
  type StudyMessages,
  type StudyVars,
} from "@/lib/i18n/study/translate";

const StudyI18nContext = createContext<{
  lang: string;
  messages: StudyMessages;
}>({ lang: "es", messages: {} });

export function StudyI18nProvider({
  lang,
  messages,
  children,
}: {
  lang: string;
  messages: StudyMessages;
  children: React.ReactNode;
}) {
  return (
    <StudyI18nContext.Provider value={{ lang, messages }}>
      {children}
    </StudyI18nContext.Provider>
  );
}

/** Devuelve t(textoEnEspañol, variables?) para el idioma de la página. */
export function useStudyT() {
  const { messages } = useContext(StudyI18nContext);
  return (text: string, vars?: StudyVars) =>
    translateStudy(messages, text, vars);
}

export function useStudyLang() {
  return useContext(StudyI18nContext).lang;
}
