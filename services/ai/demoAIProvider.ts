// Agente DEMO: reglas + estado conversacional (slot filling). Sin APIs externas.
// Cada turno: 1) extrae datos del mensaje (NLU por palabras clave en 8 idiomas),
// 2) interpreta la respuesta al paso pendiente, 3) elige la siguiente pregunta.
import { getDictionary, t, type Dictionary } from "@/lib/i18n";
import { intentFromTimeline } from "@/services/scoringService";
import {
  CONTACT_CHANNELS,
  LOCATIONS,
  MOTIVATIONS,
  PROPERTY_TYPES,
  SITUATIONS,
  TIMELINES,
  type ContactChannel,
  type ExtractedData,
  type Location,
  type Motivation,
  type PropertyType,
  type Situation,
  type Timeline,
} from "@/types";
import { analyze, type NluResult } from "./nlu";
import type { AgentAction, AgentStep, AgentTurnInput, AgentTurnOutput, AIProvider, ConversationState, QuickReply } from "./types";

const MAX_ATTEMPTS = 1;

function parseValue(value?: string): { step: string; value: string } | null {
  if (!value) return null;
  const [step, ...rest] = value.split(":");
  return { step, value: rest.join(":") };
}

function oneOf<T extends string>(list: readonly T[], value: string | undefined): T | undefined {
  return value && (list as readonly string[]).includes(value) ? (value as T) : undefined;
}

export class DemoAIProvider implements AIProvider {
  readonly name = "demo";

  async generateReply(input: AgentTurnInput): Promise<AgentTurnOutput> {
    const dict = getDictionary(input.language);

    if (!input.state || !input.userMessage) {
      return this.greeting(input, dict);
    }

    const state: ConversationState = { ...input.state, covered: [...input.state.covered], turn: input.state.turn + 1 };
    const known: ExtractedData = { ...input.known };
    const extracted: Partial<ExtractedData> = {};
    const prefixes: string[] = [];
    const set = <K extends keyof ExtractedData>(key: K, value: ExtractedData[K]) => {
      extracted[key] = value;
      known[key] = value;
    };
    const cover = (step: AgentStep) => {
      if (!state.covered.includes(step)) state.covered.push(step);
    };

    const hint = parseValue(input.userMessage.value);
    const nlu = analyze(input.userMessage.text);
    const current = state.step;

    // 1) Extracción "oportunista": datos que el propietario menciona aunque no se le hayan preguntado.
    this.applyOpportunistic(nlu, known, current, set, cover);

    // 2) Interpretar la respuesta al paso pendiente.
    const action: AgentAction = "NONE";
    let understood = true;
    let forcedNext: AgentStep | null = null;

    switch (current) {
      case "CONFIRM_INTEREST": {
        const yn = hint?.step === "YESNO" ? hint.value : nlu.yesNo;
        if (yn === "NO") {
          set("confirmedInterest", false);
          cover("CONFIRM_INTEREST");
          state.step = "CLOSED";
          state.attempts = 0;
          return this.out(dict.agent.notInterested, [], "COMPLETE", state, extracted);
        }
        set("confirmedInterest", true);
        cover("CONFIRM_INTEREST");
        break;
      }
      case "LOCATION": {
        const loc = oneOf(LOCATIONS, hint?.value) ?? nlu.location;
        set("location", loc ?? "OTHER");
        cover("LOCATION");
        break;
      }
      case "PROPERTY_TYPE": {
        const type = oneOf(PROPERTY_TYPES, hint?.value) ?? nlu.propertyType;
        if (type) {
          set("propertyType", type);
          cover("PROPERTY_TYPE");
        } else understood = false;
        break;
      }
      case "MOTIVATION": {
        const motivation = oneOf(MOTIVATIONS, hint?.value) ?? nlu.motivation;
        set("motivation", motivation ?? "OTHER");
        if (!hint) set("motivationText", input.userMessage.text.slice(0, 300));
        cover("MOTIVATION");
        break;
      }
      case "TIMELINE": {
        const timeline = oneOf(TIMELINES, hint?.value) ?? nlu.timeline;
        const keepsFormValue = (hint?.value === "KEEP" || nlu.yesNo === "YES") && known.timeline;
        if (timeline) {
          set("timeline", timeline);
          cover("TIMELINE");
        } else if (keepsFormValue) {
          set("timeline", known.timeline);
          cover("TIMELINE");
        } else {
          understood = false; // "ha cambiado" o no entendido: volvemos a preguntar con opciones
        }
        break;
      }
      case "SITUATION": {
        const situation = oneOf(SITUATIONS, hint?.value) ?? nlu.situation;
        if (situation) {
          set("situation", situation);
          cover("SITUATION");
        } else understood = false;
        break;
      }
      case "DETAILS": {
        let sqm = nlu.sqm;
        let bedrooms = nlu.bedrooms;
        if (!sqm && !bedrooms) {
          const numbers = (nlu.norm.match(/\d+/g) ?? []).map(Number);
          for (const n of numbers) {
            if (n >= 20 && !sqm) sqm = n;
            else if (n > 0 && n < 20 && !bedrooms) bedrooms = n;
          }
        }
        if (sqm) set("sqm", sqm);
        if (bedrooms) set("bedrooms", bedrooms);
        cover("DETAILS");
        break;
      }
      case "FEATURES": {
        const features = hint?.step === "FEATURE" ? (hint.value === "NONE" ? [] : [hint.value]) : nlu.features;
        set("features", Array.from(new Set([...(known.features ?? []), ...features])));
        cover("FEATURES");
        break;
      }
      case "AGENCY_INTEREST": {
        const v = hint?.step === "AGENCY" ? hint.value : nlu.yesNo;
        set("agencyInterest", v === "YES" ? true : v === "NO" ? false : null);
        cover("AGENCY_INTEREST");
        break;
      }
      case "OFFER_APPOINTMENT":
      case "SLOTS": {
        const v = hint?.step === "BOOK" ? hint.value : nlu.yesNo;
        cover("OFFER_APPOINTMENT");
        if (v === "NO") {
          set("appointmentInterest", false);
          state.step = "PREFERRED_CONTACT";
          state.attempts = 0;
          return this.out(dict.agent.declined, this.contactReplies(dict), "NONE", state, extracted);
        }
        set("appointmentInterest", true);
        state.step = "SLOTS";
        state.attempts = 0;
        const text = current === "SLOTS" ? dict.agent.slotsReminder : dict.agent.showSlots;
        return this.out(text, [], "SHOW_SLOTS", state, extracted);
      }
      case "PREFERRED_CONTACT": {
        const channel = oneOf(CONTACT_CHANNELS, hint?.value) ?? nlu.contact ?? "EMAIL";
        set("preferredContact", channel);
        state.step = "CLOSED";
        state.attempts = 0;
        const reply = t(dict.agent.contactSaved, { channel: dict.options.contact[channel] });
        return this.out(reply, [], "COMPLETE", state, extracted);
      }
      case "BOOKED":
      case "CLOSED": {
        if ((nlu.yesNo === "YES" || hint?.step === "BOOK") && !known.appointmentInterest && current === "CLOSED") {
          forcedNext = "OFFER_APPOINTMENT";
          break;
        }
        const reply = t(dict.agent.closing, { name: input.leadName });
        return this.out(reply, [], "COMPLETE", state, extracted);
      }
    }

    // 3) Reconocimientos empáticos.
    if (understood) {
      if (extracted.motivation === "INHERITANCE" || (extracted.situation === "INHERITED" && current === "SITUATION")) {
        prefixes.push(dict.agent.ackInheritance);
      } else if (extracted.motivation === "RELOCATION") {
        prefixes.push(dict.agent.ackRelocation);
      }
      if (nlu.urgent && known.urgency !== "HIGH") {
        set("urgency", "HIGH");
        prefixes.push(dict.agent.ackUrgent);
      }
      if (!prefixes.length) prefixes.push(dict.agent.acks[state.turn % dict.agent.acks.length]);
    }

    // 4) Siguiente paso.
    let next: AgentStep;
    if (!understood && state.attempts < MAX_ATTEMPTS) {
      next = current;
      state.attempts += 1;
      prefixes.unshift(dict.agent.notUnderstood);
    } else {
      if (!understood) cover(current); // tras un reintento, pasamos de pregunta
      next = forcedNext ?? this.nextStep(known, state);
      state.attempts = 0;
    }

    if (known.timeline) {
      const intent = intentFromTimeline(known.timeline);
      if (intent !== input.known.intent) set("intent", intent);
    }

    state.step = next;
    const question = this.question(next, known, dict, !understood && next === current);
    if (next === "CLOSED") {
      return this.out(`${prefixes.join(" ")} ${t(dict.agent.closing, { name: input.leadName })}`.trim(), [], "COMPLETE", state, extracted);
    }
    return this.out(`${prefixes.join(" ")} ${question.text}`.trim(), question.quickReplies, action, state, extracted);
  }

  private greeting(input: AgentTurnInput, dict: Dictionary): AgentTurnOutput {
    const { known } = input;
    const property =
      known.propertyType && known.location
        ? `${dict.options.propertyType[known.propertyType]} · ${dict.options.location[known.location]}`
        : null;
    const text = property
      ? t(dict.agent.greeting, { name: input.leadName, property })
      : t(dict.agent.greetingGeneric, { name: input.leadName });
    const state: ConversationState = { step: "CONFIRM_INTEREST", covered: [], attempts: 0, turn: 0 };
    return this.out(text, this.yesNoReplies(dict), "NONE", state, { language: input.language });
  }

  private applyOpportunistic(
    nlu: NluResult,
    known: ExtractedData,
    current: AgentStep,
    set: <K extends keyof ExtractedData>(key: K, value: ExtractedData[K]) => void,
    cover: (step: AgentStep) => void,
  ) {
    // Sólo rellenamos huecos vacíos: no pisamos datos del formulario con detecciones ambiguas.
    if (nlu.location && !known.location && current !== "LOCATION") {
      set("location", nlu.location);
      cover("LOCATION");
    }
    if (nlu.propertyType && !known.propertyType && current !== "PROPERTY_TYPE") {
      set("propertyType", nlu.propertyType);
      cover("PROPERTY_TYPE");
    }
    if (nlu.motivation && !known.motivation && current !== "MOTIVATION") {
      set("motivation", nlu.motivation);
      cover("MOTIVATION");
    }
    if (nlu.timeline && current !== "TIMELINE" && !["OFFER_APPOINTMENT", "SLOTS"].includes(current) && nlu.timeline !== known.timeline) {
      set("timeline", nlu.timeline);
      cover("TIMELINE");
    }
    if (nlu.situation && !known.situation && current !== "SITUATION") {
      set("situation", nlu.situation);
      cover("SITUATION");
    }
    if (nlu.situation === "INHERITED" && current !== "SITUATION" && !known.motivation) {
      set("motivation", "INHERITANCE");
      cover("MOTIVATION");
    }
    if (nlu.sqm && !known.sqm && current !== "DETAILS") set("sqm", nlu.sqm);
    if (nlu.bedrooms && !known.bedrooms && current !== "DETAILS") set("bedrooms", nlu.bedrooms);
    if (nlu.features.length && current !== "FEATURES") {
      set("features", Array.from(new Set([...(known.features ?? []), ...nlu.features])));
    }
    if (nlu.price) set("ownerPriceExpectation", nlu.price);
    if (nlu.contact && current !== "PREFERRED_CONTACT" && !known.preferredContact) set("preferredContact", nlu.contact);
    if (nlu.urgent && !known.timeline) {
      set("timeline", "NOW");
      cover("TIMELINE");
    }
  }

  private nextStep(known: ExtractedData, state: ConversationState): AgentStep {
    const covered = (s: AgentStep) => state.covered.includes(s);
    if (!known.location) return "LOCATION";
    if (!known.propertyType) return "PROPERTY_TYPE";
    if (!known.motivation && !covered("MOTIVATION")) return "MOTIVATION";
    if (!covered("TIMELINE")) return "TIMELINE";
    if (!known.situation && !covered("SITUATION")) return "SITUATION";
    const needsDetails = (!known.sqm || !known.bedrooms) && known.propertyType !== "LAND" && known.propertyType !== "COMMERCIAL";
    if (needsDetails && !covered("DETAILS")) return "DETAILS";
    if (!needsDetails && !covered("DETAILS") && !covered("FEATURES") && !known.features?.length) return "FEATURES";
    if (known.agencyInterest === undefined && !covered("AGENCY_INTEREST")) return "AGENCY_INTEREST";
    if (!covered("OFFER_APPOINTMENT")) return "OFFER_APPOINTMENT";
    return "CLOSED";
  }

  private question(step: AgentStep, known: ExtractedData, dict: Dictionary, retry: boolean): { text: string; quickReplies: QuickReply[] } {
    const a = dict.agent;
    const o = dict.options;
    const opts = <T extends string>(prefix: string, values: readonly T[], labels: Record<T, string>) =>
      values.map((v) => ({ label: labels[v], value: `${prefix}:${v}` }));

    switch (step) {
      case "LOCATION":
        return { text: a.askLocation, quickReplies: opts("LOCATION", LOCATIONS, o.location) };
      case "PROPERTY_TYPE":
        return { text: a.askType, quickReplies: opts("TYPE", PROPERTY_TYPES, o.propertyType) };
      case "MOTIVATION":
        return { text: a.askMotivation, quickReplies: opts("MOTIVATION", MOTIVATIONS, o.motivation) };
      case "TIMELINE": {
        const options = opts("TIMELINE", TIMELINES, o.timeline);
        if (known.timeline && !retry) {
          return {
            text: t(a.askTimelineConfirm, { timeline: o.timeline[known.timeline as Timeline] }),
            quickReplies: [{ label: a.quick.yes, value: "TIMELINE:KEEP" }, ...options.filter((q) => q.value !== `TIMELINE:${known.timeline}`)],
          };
        }
        return { text: a.askTimeline, quickReplies: options };
      }
      case "SITUATION":
        return { text: a.askSituation, quickReplies: opts("SITUATION", SITUATIONS, o.situation) };
      case "DETAILS":
        return { text: a.askDetails, quickReplies: [] };
      case "FEATURES":
        return {
          text: a.askFeatures,
          quickReplies: [
            { label: a.quick.seaView, value: "FEATURE:SEA_VIEW" },
            { label: a.quick.mooring, value: "FEATURE:MOORING" },
            { label: a.quick.renovated, value: "FEATURE:RENOVATED" },
            { label: a.quick.toReform, value: "FEATURE:TO_REFORM" },
            { label: a.quick.nothing, value: "FEATURE:NONE" },
          ],
        };
      case "AGENCY_INTEREST":
        return {
          text: a.askAgency,
          quickReplies: [
            { label: a.quick.yes, value: "AGENCY:YES" },
            { label: a.quick.maybe, value: "AGENCY:MAYBE" },
            { label: a.quick.no, value: "AGENCY:NO" },
          ],
        };
      case "OFFER_APPOINTMENT":
        return {
          text: t(a.offer, { summary: this.summary(known, dict) }),
          quickReplies: [
            { label: a.quick.book, value: "BOOK:YES" },
            { label: a.quick.notNow, value: "BOOK:NO" },
          ],
        };
      case "PREFERRED_CONTACT":
        return { text: a.declined, quickReplies: this.contactReplies(dict) };
      default:
        return { text: "", quickReplies: [] };
    }
  }

  summary(known: ExtractedData, dict: Dictionary): string {
    const o = dict.options;
    return [
      known.propertyType && o.propertyType[known.propertyType as PropertyType],
      known.location && o.location[known.location as Location],
      known.situation && o.situation[known.situation as Situation],
      known.timeline && o.timeline[known.timeline as Timeline],
      known.motivation && known.motivation !== "OTHER" && o.motivation[known.motivation as Motivation],
    ]
      .filter(Boolean)
      .join(", ");
  }

  private yesNoReplies(dict: Dictionary): QuickReply[] {
    return [
      { label: dict.agent.quick.yes, value: "YESNO:YES" },
      { label: dict.agent.quick.no, value: "YESNO:NO" },
    ];
  }

  private contactReplies(dict: Dictionary): QuickReply[] {
    return CONTACT_CHANNELS.map((c: ContactChannel) => ({ label: dict.options.contact[c], value: `CONTACT:${c}` }));
  }

  private out(
    reply: string,
    quickReplies: QuickReply[],
    action: AgentAction,
    nextState: ConversationState,
    extracted: Partial<ExtractedData>,
  ): AgentTurnOutput {
    return { reply, quickReplies, action, nextState, extracted };
  }
}
