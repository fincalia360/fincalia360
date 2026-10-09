import { describe, expect, it } from "vitest";
import { DemoAIProvider } from "@/services/ai/demoAIProvider";
import { analyze } from "@/services/ai/nlu";
import type { AgentTurnOutput, ConversationState } from "@/services/ai/types";
import type { ExtractedData, Language } from "@/types";

const provider = new DemoAIProvider();

async function converse(language: Language, known: ExtractedData, messages: Array<{ text: string; value?: string }>) {
  let out: AgentTurnOutput = await provider.generateReply({ language, leadName: "Ana", state: null, known, userMessage: null });
  let state: ConversationState = out.nextState;
  let data: ExtractedData = { ...known, ...out.extracted };
  const replies = [out.reply];
  for (const m of messages) {
    out = await provider.generateReply({ language, leadName: "Ana", state, known: data, userMessage: m });
    state = out.nextState;
    data = { ...data, ...out.extracted };
    replies.push(out.reply);
  }
  return { out, state, data, replies };
}

describe("NLU multilingüe", () => {
  it("detecta datos en español", () => {
    const r = analyze("Quiero vender mi villa en Roses este año porque la heredé");
    expect(r.propertyType).toBe("VILLA");
    expect(r.location).toBe("ROSES");
    expect(r.timeline).toBe("M6_12");
  });

  it("detecta datos en alemán, francés y neerlandés", () => {
    expect(analyze("Wir haben eine Wohnung in Empuriabrava").propertyType).toBe("APARTMENT");
    expect(analyze("C'est notre résidence secondaire").situation).toBe("SECOND_HOME");
    expect(analyze("Het huis is geërfd").situation).toBe("INHERITED");
    expect(analyze("in 3 Monaten").timeline).toBe("M1_3");
  });

  it("sí / no", () => {
    expect(analyze("Sí, claro").yesNo).toBe("YES");
    expect(analyze("Ahora no, gracias").yesNo).toBe("NO");
    expect(analyze("Ja, gerne").yesNo).toBe("YES");
  });

  it("superficie, dormitorios y precio", () => {
    const r = analyze("Tiene 120 m2 y 3 dormitorios, pido 350.000 €");
    expect(r.sqm).toBe(120);
    expect(r.bedrooms).toBe(3);
    expect(r.price).toBe(350000);
  });
});

describe("DemoAIProvider", () => {
  it("saluda en el idioma del lead", async () => {
    const de = await provider.generateReply({ language: "de", leadName: "Klaus", state: null, known: { propertyType: "HOUSE", location: "ROSES" }, userMessage: null });
    expect(de.reply).toMatch(/^Hallo Klaus/);
    const fr = await provider.generateReply({ language: "fr", leadName: "Sophie", state: null, known: {}, userMessage: null });
    expect(fr.reply).toMatch(/^Bonjour Sophie/);
  });

  it("reproduce el flujo del enunciado y propone cita", async () => {
    const { data, out, replies } = await converse("es", {}, [
      { text: "Quiero saber cuánto vale mi apartamento." },
      { text: "Empuriabrava." },
      { text: "Quiero cambiar de casa" },
      { text: "Probablemente este año." },
      { text: "Segunda residencia." },
      { text: "Unos 80 metros y 2 dormitorios" },
      { text: "Sí" },
    ]);
    expect(replies[1]).toContain("¿En qué zona está la vivienda?");
    expect(data.propertyType).toBe("APARTMENT");
    expect(data.location).toBe("EMPURIABRAVA");
    expect(data.timeline).toBe("M6_12");
    expect(data.situation).toBe("SECOND_HOME");
    expect(data.sqm).toBe(80);
    expect(data.agencyInterest).toBe(true);
    expect(data.intent).toBe("MEDIUM");
    expect(out.nextState.step).toBe("OFFER_APPOINTMENT");
    expect(out.reply).toContain("¿Quieres que te reserve una llamada?");
    expect(out.quickReplies.map((q) => q.value)).toEqual(["BOOK:YES", "BOOK:NO"]);
  });

  it("muestra horarios al aceptar la cita", async () => {
    const { out } = await converse("en", { location: "ROSES", propertyType: "VILLA", timeline: "NOW", situation: "TOURIST", sqm: 250, bedrooms: 4 }, [
      { text: "Yes", value: "YESNO:YES" },
      { text: "We are relocating", value: "MOTIVATION:RELOCATION" },
      { text: "Yes", value: "TIMELINE:KEEP" },
      { text: "Sea views", value: "FEATURE:SEA_VIEW" },
      { text: "Yes", value: "AGENCY:YES" },
      { text: "Yes, book a call", value: "BOOK:YES" },
    ]);
    expect(out.action).toBe("SHOW_SLOTS");
    expect(out.extracted.appointmentInterest).toBe(true);
  });

  it("detecta urgencia y herencia en texto libre", async () => {
    const { data, replies } = await converse("es", { location: "FIGUERES", propertyType: "HOUSE" }, [
      { text: "Sí" },
      { text: "La casa es una herencia y necesitamos venderla urgente" },
    ]);
    expect(data.motivation).toBe("INHERITANCE");
    expect(data.urgency).toBe("HIGH");
    expect(data.timeline).toBe("NOW");
    expect(replies[2]).toContain("herencias");
  });

  it("respeta un 'no' inicial", async () => {
    const { out } = await converse("it", {}, [{ text: "No, grazie" }]);
    expect(out.action).toBe("COMPLETE");
    expect(out.extracted.confirmedInterest).toBe(false);
  });
});
