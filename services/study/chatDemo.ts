// MODO DEMOSTRACIÓN del asistente (solo en local, con CHAT_DEMO=true y sin clave de Anthropic).
// Respuestas de EJEMPLO por plantillas con las cifras reales del estudio, para ver la experiencia
// antes de contratar la IA. Se muestran siempre marcadas como demostración. Nunca en producción.
import { demoToolsEnabled } from "@/lib/demo";
import { claudeConfigured } from "@/services/ai/claudeClient";
import { prisma } from "@/db/client";
import { fmtEur } from "./format";
import { buildStudyReport } from "./reportModel";
import { parseStudy } from "./studyService";

export function chatDemoEnabled() {
  return !claudeConfigured() && demoToolsEnabled() && process.env.CHAT_DEMO === "true";
}

type Lang = "es" | "en" | "fr" | "de" | "it" | "pt";

/** Detección sencilla del idioma por palabras frecuentes (suficiente para la demostración). */
export function detectLang(text: string): Lang {
  const t = ` ${text.toLowerCase()} `;
  const score = (words: string[]) => words.filter((w) => t.includes(` ${w} `) || t.includes(` ${w}?`) || t.includes(` ${w},`)).length;
  const s: Record<Lang, number> = {
    es: score(["el", "la", "que", "me", "mi", "vender", "alquilar", "cuánto", "conviene", "piso", "es", "de", "puedo"]),
    en: score(["the", "my", "should", "i", "sell", "rent", "how", "much", "is", "what", "can", "flat", "house"]),
    fr: score(["le", "la", "je", "mon", "vendre", "louer", "combien", "est", "que", "dois", "appartement"]),
    de: score(["ich", "die", "der", "das", "verkaufen", "vermieten", "wie", "viel", "soll", "meine", "wohnung", "ist"]),
    it: score(["il", "mio", "vendere", "affittare", "quanto", "devo", "casa", "è", "che", "posso"]),
    pt: score(["o", "meu", "vender", "alugar", "quanto", "devo", "casa", "é", "que", "posso", "apartamento"]),
  };
  return (Object.entries(s).sort((a, b) => b[1] - a[1])[0][1] > 0 ? Object.entries(s).sort((a, b) => b[1] - a[1])[0][0] : "es") as Lang;
}

type Topic = "SELL_OR_RENT" | "NET" | "LEGAL" | "TAX" | "OTHER";
function detectTopic(text: string): Topic {
  const t = text.toLowerCase();
  const rentWord = /miete|alquiler|rent|loyer|affitt|alug|renda/.test(t);
  const howMuch = /cuánto|cuanto|how much|wie viel|combien|quanto|darf|puedo pedir|can i (ask|charge)/.test(t);
  if (/legal|ley|máxim|maxim|tope|tensionad|limit|gesetz|loi/.test(t) || (rentWord && howMuch)) return "LEGAL";
  if (/impuest|tax|irpf|plusval|steuer|impôt|impost|fiscal/.test(t)) return "TAX";
  if (/cuánto|cuanto|neto|quedar|how much|combien|wie viel|quanto|dinero|money|argent|geld/.test(t)) return "NET";
  if (/vend|alquil|sell|rent|louer|vendre|verkauf|vermiet|affitt|alug|convien|should|dois|soll|devo/.test(t)) return "SELL_OR_RENT";
  return "OTHER";
}

export async function demoAnswer(studyId: string, question: string): Promise<{ text: string; actions: string[] }> {
  const study = await prisma.study.findUniqueOrThrow({ where: { id: studyId } });
  const { input, snapshot, assumptions } = parseStudy(study);
  const r = buildStudyReport(input, snapshot, assumptions, input.owner.horizon);
  const lang = detectLang(question);
  const topic = detectTopic(question);
  const net = r.main.sellNow?.breakdown.net ?? null;
  const sale = r.sale.used;
  const rent = r.rent.used;
  const h = 5;
  const s5 = r.byHorizon[h];
  const diff = s5.sellNow && s5.rentThenSell ? s5.rentThenSell.wealth - s5.sellNow.wealth : null;
  const y1 = r.main.rental?.rows[0]?.cashFlow ?? null;
  const town = input.location.municipalityName;

  const T: Record<Lang, Record<Topic, string>> = {
    es: {
      SELL_OR_RENT:
        sale == null
          ? `Aún no tenemos un valor de venta fiable para tu vivienda en ${town}, así que no puedo compararlo con el alquiler. Un especialista puede hacer una valoración profesional gratuita.`
          : `Según tu estudio, si vendes hoy te quedarían unos ${fmtEur(net)} netos (precio estimado ${fmtEur(sale)}). Alquilando a ${fmtEur(rent)}/mes, el flujo de caja del primer año sería de ${fmtEur(y1)}. A ${h} años, la diferencia de patrimonio entre alquilar y vender es de ${fmtEur(diff)}: ${diff != null && Math.abs(diff) < 0.05 * (s5.sellNow?.wealth ?? 1) ? "muy parecida, así que pesan más la liquidez, el tiempo y los riesgos del alquiler (impagos, vacíos, gestión)" : diff != null && diff < 0 ? "vender sale mejor con estas hipótesis" : "alquilar sale algo mejor con estas hipótesis, a cambio de gestión y riesgos"}. ¿Quieres que un profesional revise tu caso sin compromiso?`,
      NET: net == null ? "Sin un valor de venta no puedo calcular el dinero neto. Puedes indicar tu propio valor en el estudio o pedir una valoración profesional." : `Si vendes hoy, tu estudio estima unos ${fmtEur(net)} netos tras gastos de venta, impuestos calculados e hipoteca (precio estimado ${fmtEur(sale)}). Es una estimación, no una tasación.`,
      LEGAL: `Para un contrato nuevo en ${town}: ${r.rent.regime.summary} Te puedo poner en contacto con un profesional para revisar tu caso concreto.`,
      TAX: net == null ? "Los impuestos de la venta dependen del precio y de tu precio de compra; complétalos en el estudio para calcularlos." : `En la venta, tu estudio calcula ${fmtEur(r.main.sellNow!.breakdown.taxesTotal)} en impuestos (plusvalía y ganancia patrimonial)${r.main.sellNow!.breakdown.complete ? "" : ", aunque el cálculo está incompleto por falta de datos"}. Es información general: para tu caso, consulta a un asesor.`,
      OTHER: "Puedo ayudarte con tu estudio: cuánto te quedaría si vendes, qué alquiler podrías pedir, impuestos y qué opción te conviene. ¿Qué te gustaría saber?",
    },
    en: {
      SELL_OR_RENT:
        sale == null
          ? `We don't have a reliable sale value for your home in ${town} yet, so I can't compare it with renting. A specialist can do a free professional valuation.`
          : `According to your study, selling today would leave you about ${fmtEur(net)} net (estimated price ${fmtEur(sale)}). Renting at ${fmtEur(rent)}/month, the first-year cash flow would be ${fmtEur(y1)}. Over ${h} years the wealth difference between renting and selling is ${fmtEur(diff)}. Would you like a professional to review your case, free and without commitment?`,
      NET: net == null ? "Without a sale value I can't calculate the net amount." : `If you sell today, your study estimates about ${fmtEur(net)} net after selling costs, taxes and mortgage (estimated price ${fmtEur(sale)}). It's an estimate, not an official appraisal.`,
      LEGAL: `For a new rental contract in ${town}, the rules depend on whether the area is a "stressed market" and on the previous contract. Your study shows: ${r.rent.regime.summary}`,
      TAX: net == null ? "Sale taxes depend on the price and your purchase price." : `Your study calculates ${fmtEur(r.main.sellNow!.breakdown.taxesTotal)} in taxes on the sale. This is general information; please check your case with an adviser.`,
      OTHER: "I can help you with your study: how much you'd get if you sell, what rent you could ask and which option suits you. What would you like to know?",
    },
    fr: {
      SELL_OR_RENT:
        sale == null
          ? `Nous n'avons pas encore de valeur de vente fiable pour votre logement à ${town}. Un spécialiste peut faire une estimation professionnelle gratuite.`
          : `Selon votre étude, vendre aujourd'hui vous laisserait environ ${fmtEur(net)} nets (prix estimé ${fmtEur(sale)}). En louant ${fmtEur(rent)}/mois, le flux de trésorerie de la première année serait de ${fmtEur(y1)}. Sur ${h} ans, l'écart de patrimoine entre louer et vendre est de ${fmtEur(diff)}. Souhaitez-vous qu'un professionnel étudie votre cas, gratuitement et sans engagement ?`,
      NET: net == null ? "Sans valeur de vente, je ne peux pas calculer le montant net." : `Si vous vendez aujourd'hui, votre étude estime environ ${fmtEur(net)} nets après frais, impôts et prêt (prix estimé ${fmtEur(sale)}).`,
      LEGAL: `Pour un nouveau bail à ${town}, le loyer maximal dépend de la zone et du bail précédent. Votre étude indique : ${r.rent.regime.summary}`,
      TAX: net == null ? "Les impôts dépendent du prix de vente et du prix d'achat." : `Votre étude calcule ${fmtEur(r.main.sellNow!.breakdown.taxesTotal)} d'impôts sur la vente (information générale).`,
      OTHER: "Je peux vous aider avec votre étude : combien vous resterait-il en vendant, quel loyer demander et quelle option vous convient. Que souhaitez-vous savoir ?",
    },
    de: {
      SELL_OR_RENT:
        sale == null
          ? `Für Ihre Immobilie in ${town} haben wir noch keinen verlässlichen Verkaufswert. Ein Spezialist kann eine kostenlose professionelle Bewertung machen.`
          : `Laut Ihrer Studie blieben Ihnen beim Verkauf heute etwa ${fmtEur(net)} netto (geschätzter Preis ${fmtEur(sale)}). Bei Vermietung für ${fmtEur(rent)}/Monat läge der Cashflow im ersten Jahr bei ${fmtEur(y1)}. Über ${h} Jahre beträgt der Vermögensunterschied zwischen Vermieten und Verkaufen ${fmtEur(diff)}. Möchten Sie, dass ein Profi Ihren Fall kostenlos und unverbindlich prüft?`,
      NET: net == null ? "Ohne Verkaufswert kann ich den Nettobetrag nicht berechnen." : `Bei einem Verkauf heute schätzt Ihre Studie etwa ${fmtEur(net)} netto nach Kosten, Steuern und Hypothek (geschätzter Preis ${fmtEur(sale)}).`,
      LEGAL: `Für einen neuen Mietvertrag in ${town} hängt die Höchstmiete von der Zone und dem Vorvertrag ab. Ihre Studie zeigt: ${r.rent.regime.summary}`,
      TAX: net == null ? "Die Steuern hängen vom Verkaufs- und Kaufpreis ab." : `Ihre Studie berechnet ${fmtEur(r.main.sellNow!.breakdown.taxesTotal)} Steuern beim Verkauf (allgemeine Information).`,
      OTHER: "Ich helfe Ihnen gern mit Ihrer Studie: Nettoerlös beim Verkauf, mögliche Miete und welche Option passt. Was möchten Sie wissen?",
    },
    it: {
      SELL_OR_RENT:
        sale == null
          ? `Non abbiamo ancora un valore di vendita affidabile per la tua casa a ${town}. Uno specialista può fare una valutazione professionale gratuita.`
          : `Secondo il tuo studio, vendendo oggi ti resterebbero circa ${fmtEur(net)} netti (prezzo stimato ${fmtEur(sale)}). Affittando a ${fmtEur(rent)}/mese, il flusso di cassa del primo anno sarebbe ${fmtEur(y1)}. In ${h} anni la differenza di patrimonio tra affittare e vendere è di ${fmtEur(diff)}. Vuoi che un professionista esamini il tuo caso, gratis e senza impegno?`,
      NET: net == null ? "Senza un valore di vendita non posso calcolare il netto." : `Vendendo oggi, il tuo studio stima circa ${fmtEur(net)} netti dopo costi, imposte e mutuo.`,
      LEGAL: `Per un nuovo contratto a ${town}: ${r.rent.regime.summary}`,
      TAX: net == null ? "Le imposte dipendono dal prezzo di vendita e di acquisto." : `Il tuo studio calcola ${fmtEur(r.main.sellNow!.breakdown.taxesTotal)} di imposte sulla vendita (informazione generale).`,
      OTHER: "Posso aiutarti con il tuo studio: quanto ti resterebbe vendendo, che affitto chiedere e quale opzione ti conviene. Cosa vuoi sapere?",
    },
    pt: {
      SELL_OR_RENT:
        sale == null
          ? `Ainda não temos um valor de venda fiável para a sua casa em ${town}. Um especialista pode fazer uma avaliação profissional gratuita.`
          : `Segundo o seu estudo, vendendo hoje ficaria com cerca de ${fmtEur(net)} líquidos (preço estimado ${fmtEur(sale)}). Arrendando a ${fmtEur(rent)}/mês, o fluxo de caixa do primeiro ano seria de ${fmtEur(y1)}. Em ${h} anos, a diferença de património entre arrendar e vender é de ${fmtEur(diff)}. Quer que um profissional analise o seu caso, sem compromisso?`,
      NET: net == null ? "Sem um valor de venda não consigo calcular o valor líquido." : `Vendendo hoje, o seu estudo estima cerca de ${fmtEur(net)} líquidos após custos, impostos e hipoteca.`,
      LEGAL: `Para um novo contrato em ${town}: ${r.rent.regime.summary}`,
      TAX: net == null ? "Os impostos dependem do preço de venda e de compra." : `O seu estudo calcula ${fmtEur(r.main.sellNow!.breakdown.taxesTotal)} de impostos na venda (informação geral).`,
      OTHER: "Posso ajudá-lo com o seu estudo: quanto ficaria ao vender, que renda pedir e que opção lhe convém. O que gostaria de saber?",
    },
  };

  const actions = topic === "LEGAL" ? ["RENT"] : topic === "TAX" ? ["ADVICE"] : topic === "OTHER" ? [] : diff != null && diff > 0 && Math.abs(diff) >= 0.05 * (s5.sellNow?.wealth ?? 1) ? ["RENT", "SELL"] : ["SELL"];
  return { text: T[lang][topic], actions };
}
