// Traducción de la herramienta de valoración. Las claves son el propio texto en español, de modo que
// en español se muestra exactamente el texto original y, si falta una traducción, también.
export type StudyMessages = Record<string, string>;
export type StudyVars = Array<string | number | null | undefined> | Record<string, string | number | null | undefined>;

export function translateStudy(messages: StudyMessages, text: string, vars?: StudyVars): string {
  const template = messages[text] ?? text;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = (vars as Record<string, unknown>)[key];
    return value === undefined || value === null ? match : String(value);
  });
}
