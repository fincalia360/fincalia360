import { describe, expect, it } from "vitest";
import { detectLang } from "@/services/study/chatDemo";

describe("modo demostración del asistente: idioma", () => {
  it.each([
    ["¿Me conviene vender o alquilar mi piso?", "es"],
    ["Should I sell my flat? How much would I get?", "en"],
    ["Wie viel Miete darf ich verlangen?", "de"],
    ["Combien je peux louer mon appartement ?", "fr"],
    ["Quanto posso affittare la mia casa?", "it"],
  ])("«%s» → %s", (q, lang) => expect(detectLang(q)).toBe(lang));
});
