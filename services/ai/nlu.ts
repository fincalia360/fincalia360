// NLU por reglas y palabras clave, multilingüe (es, ca, en, fr, de, nl, it, pt).
// Todas las palabras clave están normalizadas: minúsculas, sin acentos, sin apóstrofos.
// Se buscan como palabras/frases completas sobre el texto normalizado.
import { normalizeText } from "@/lib/utils";
import type { ContactChannel, Location, Motivation, PropertyType, Situation, Timeline } from "@/types";

type KeywordMap<T extends string> = Array<[T, string[]]>;

function has(norm: string, phrase: string) {
  return norm.includes(` ${phrase} `);
}

function firstMatch<T extends string>(norm: string, map: KeywordMap<T>): T | undefined {
  for (const [value, phrases] of map) {
    if (phrases.some((p) => has(norm, p))) return value;
  }
  return undefined;
}

const YES_WORDS = [
  "si", "sí", "claro", "vale", "por supuesto", "de acuerdo", "perfecto", "dacord", "d acord", "es clar", "yes", "yeah", "yep",
  "sure", "ok", "okay", "of course", "oui", "bien sur", "volontiers", "ja", "jawohl", "gerne", "naturlich", "klar", "ja graag",
  "zeker", "prima", "certo", "certamente", "sim", "com certeza", "esta bien", "adelante", "reservar", "book", "graag",
];

const NO_WORDS = [
  "no", "nop", "ahora no", "no gracias", "ara no", "no cal", "not now", "no thanks", "not interested", "nope", "non", "non merci",
  "pas maintenant", "nein", "jetzt nicht", "nein danke", "nee", "nu niet", "nee dank je", "adesso no", "no grazie", "nao",
  "agora nao", "nao obrigado", "nicht", "niet",
];

export function detectYesNo(norm: string): "YES" | "NO" | null {
  const tokens = norm.trim().split(" ");
  const firstTwo = tokens.slice(0, 2).join(" ");
  if (NO_WORDS.some((w) => firstTwo === w || tokens[0] === w)) return "NO";
  if (YES_WORDS.some((w) => firstTwo === w || tokens[0] === w)) return "YES";
  if (["no gracias", "not interested", "no thanks", "non merci", "nein danke", "no grazie", "nao obrigado", "ahora no", "not now", "pas maintenant", "jetzt nicht", "nu niet", "adesso no", "agora nao"].some((p) => has(norm, p))) {
    return "NO";
  }
  if (YES_WORDS.some((w) => w.length > 2 && has(norm, w))) return "YES";
  return null;
}

const LOCATION_KEYWORDS: KeywordMap<Location> = [
  ["EMPURIABRAVA", ["empuriabrava", "empuria brava", "ampuriabrava"]],
  ["CADAQUES", ["cadaques", "cadaques port lligat", "portlligat", "port lligat"]],
  ["LLANCA", ["llanca", "llansa"]],
  ["CASTELLO", ["castello", "castello d empuries", "castello de ampurias"]],
  ["FIGUERES", ["figueres", "figueras"]],
  ["ROSES", ["roses", "rosas", "santa margarida", "canyelles", "almadrava", "mas boscà", "mas bosca", "puig rom"]],
];

export const detectLocation = (norm: string) => firstMatch(norm, LOCATION_KEYWORDS);

const PROPERTY_KEYWORDS: KeywordMap<PropertyType> = [
  ["VILLA", ["villa", "vila", "chalet de lujo", "luxury villa"]],
  ["LAND", ["terreno", "solar", "parcela", "terreny", "land", "plot", "terrain", "grundstuck", "bouwgrond", "perceel", "lotto", "lote"]],
  ["COMMERCIAL", ["local comercial", "local", "comercial", "shop", "commercial", "boutique", "gewerbe", "laden", "winkel", "bedrijfspand", "negozio", "loja"]],
  [
    "APARTMENT",
    [
      "apartamento", "piso", "atico", "estudio", "apartament", "pis", "apartment", "flat", "penthouse", "studio", "appartement",
      "wohnung", "ferienwohnung", "appartamento", "attico", "monolocale", "bilocale",
    ],
  ],
  ["HOUSE", ["casa", "chalet", "adosado", "masia", "house", "townhouse", "cottage", "maison", "haus", "reihenhaus", "huis", "woning", "moradia", "vivenda"]],
];

export const detectPropertyType = (norm: string) => firstMatch(norm, PROPERTY_KEYWORDS);

const TIMELINE_KEYWORDS: KeywordMap<Timeline> = [
  [
    "NOW",
    [
      "cuanto antes", "lo antes posible", "lo mas pronto posible", "inmediatamente", "com mes aviat millor", "asap", "as soon as possible",
      "immediately", "des que possible", "le plus vite possible", "so schnell wie moglich", "sofort", "zo snel mogelijk", "prima possibile",
      "il prima possibile", "o mais rapido possivel", "imediatamente",
    ],
  ],
  [
    "INFO_ONLY",
    [
      "solo informarme", "solo quiero informarme", "informarme", "curiosidad", "solo saber", "nomes informar", "informar me", "just curious",
      "just information", "only information", "just want to know", "just looking", "m informer", "curiosite", "nur informieren",
      "neugier", "neugierig", "alleen informatie", "orienteren", "nieuwsgierig", "informarmi", "curiosita", "so informar", "informar-me",
      "curiosidade",
    ],
  ],
  [
    "LATER",
    [
      "ahora no", "ara no", "not now", "pas maintenant", "jetzt nicht", "nu niet", "adesso no", "agora nao",
      "mas adelante", "el ano que viene", "el proximo ano", "sin prisa", "no tengo prisa", "mes endavant", "l any que ve", "later",
      "no rush", "next year", "in a year", "plus tard", "l annee prochaine", "pas presse", "spater", "nachstes jahr", "keine eile",
      "volgend jaar", "geen haast", "piu avanti", "l anno prossimo", "nessuna fretta", "mais tarde", "proximo ano", "sem pressa",
    ],
  ],
  [
    "M6_12",
    [
      "este ano", "a lo largo del ano", "antes de fin de ano", "dentro de un ano", "aquest any", "this year", "within a year",
      "end of the year", "cette annee", "dans l annee", "d ici la fin de l annee", "dieses jahr", "innerhalb eines jahres",
      "bis ende des jahres", "dit jaar", "binnen een jaar", "quest anno", "entro l anno", "este ano", "durante o ano",
    ],
  ],
  [
    "M3_6",
    [
      "medio ano", "seis meses", "este verano", "en verano", "mig any", "aquest estiu", "half a year", "six months", "this summer",
      "six mois", "cet ete", "halbes jahr", "sechs monaten", "diesen sommer", "half jaar", "zes maanden", "deze zomer", "sei mesi",
      "quest estate", "seis meses", "este verao",
    ],
  ],
  [
    "M1_3",
    [
      "proximos meses", "pronto", "un par de meses", "dos meses", "tres meses", "propers mesos", "aviat", "few months", "couple of months",
      "next months", "soon", "quelques mois", "bientot", "prochains mois", "nachsten monaten", "bald", "paar monate", "paar maanden",
      "binnenkort", "prossimi mesi", "presto", "em breve",
    ],
  ],
  [
    "NOW",
    [
      "ahora", "ahora mismo", "cuanto antes", "inmediatamente", "lo antes posible", "ara", "com mes aviat", "now", "asap", "right away",
      "immediately", "as soon as possible", "maintenant", "tout de suite", "des que possible", "jetzt", "sofort", "so schnell wie moglich",
      "nu", "direct", "zo snel mogelijk", "adesso", "subito", "prima possibile", "agora", "imediatamente", "o mais rapido",
    ],
  ],
];

const MONTH_WORDS = "(meses|mes|mesos|months|month|mois|monaten|monate|monat|maanden|maand|mesi|mese)";

export function detectTimeline(norm: string): Timeline | undefined {
  const months = [...norm.matchAll(new RegExp(`(\\d{1,2})\\s*(?:-|a|o|y|to|or|bis|tot|e|ou)?\\s*(\\d{1,2})?\\s*${MONTH_WORDS}`, "g"))];
  if (months.length) {
    const n = Math.max(...months.flatMap((m) => [Number(m[1]), Number(m[2] ?? 0)]));
    if (n <= 1) return "NOW";
    if (n <= 3) return "M1_3";
    if (n <= 6) return "M3_6";
    if (n <= 12) return "M6_12";
    return "LATER";
  }
  return firstMatch(norm, TIMELINE_KEYWORDS);
}

const SITUATION_KEYWORDS: KeywordMap<Situation> = [
  [
    "INHERITED",
    [
      "herencia", "heredado", "heredada", "herede", "heredamos", "herencia de", "heretat", "heretada", "herencia familiar", "inherited",
      "inheritance", "inherit", "heritage", "herite", "heritee", "succession", "geerbt", "erbschaft", "erbe", "geerfd", "erfenis",
      "eredita", "ereditato", "ereditata", "successione", "heranca", "herdado", "herdada", "herdei",
    ],
  ],
  [
    "TOURIST",
    [
      "turistica", "alquiler turistico", "alquiler vacacional", "airbnb", "hutg", "booking", "us turistic", "holiday rental",
      "vacation rental", "short term rental", "location saisonniere", "meuble de tourisme", "ferienvermietung", "vakantieverhuur",
      "affitto turistico", "affitti brevi", "alojamento local",
    ],
  ],
  [
    "SECOND_HOME",
    [
      "segunda residencia", "segunda vivienda", "casa de vacaciones", "segona residencia", "second home", "holiday home", "vacation home",
      "residence secondaire", "zweitwohnsitz", "ferienhaus", "ferienwohnung", "tweede woning", "vakantiehuis", "vakantiewoning",
      "seconda casa", "casa vacanze", "segunda habitacao", "casa de ferias", "veraneo", "vacaciones",
    ],
  ],
  [
    "RENTED",
    [
      "alquilada", "alquilado", "inquilino", "inquilinos", "llogada", "llogat", "rented", "tenant", "tenants", "let out", "louee",
      "locataire", "vermietet", "mieter", "verhuurd", "huurder", "affittata", "affittato", "arrendada", "arrendado", "inquilina",
    ],
  ],
  ["EMPTY", ["vacia", "vacio", "buida", "buit", "empty", "vacant", "vide", "inoccupe", "leer", "leerstehend", "leeg", "vuota", "vazia"]],
  [
    "PRIMARY",
    [
      "vivienda habitual", "residencia habitual", "vivo alli", "vivo ahi", "vivo aqui", "vivimos alli", "vivimos aqui",
      "habitatge habitual", "hi visc", "hi vivim", "main home", "main residence", "primary residence", "i live there", "we live there",
      "residence principale", "j y vis", "nous y vivons", "hauptwohnsitz", "wohne dort", "wohnen dort", "hoofdverblijf", "woon er",
      "wonen er", "abitazione principale", "ci vivo", "ci viviamo", "habitacao propria", "moro la", "moramos la",
    ],
  ],
];

export const detectSituation = (norm: string) => firstMatch(norm, SITUATION_KEYWORDS);

const MOTIVATION_KEYWORDS: KeywordMap<Motivation> = [
  ["INHERITANCE", SITUATION_KEYWORDS[0][1]],
  [
    "RELOCATION",
    [
      "mudanza", "me mudo", "nos mudamos", "cambio de residencia", "trabajo fuera", "volvemos", "trasllat", "ens traslladem", "moving",
      "relocating", "relocation", "move back", "moving back", "demenage", "demenagement", "demenageons", "umzug", "ziehen", "zuruck",
      "verhuizen", "verhuis", "verhuizing", "terug naar", "trasferimento", "trasloco", "ci trasferiamo", "mudanca", "mudar", "vamos mudar",
    ],
  ],
  [
    "LIFE_CHANGE",
    [
      "divorcio", "separacion", "jubilacion", "jubilarme", "jubilat", "divorci", "divorce", "separation", "retire", "retirement",
      "retraite", "ruhestand", "rente", "scheidung", "pensioen", "scheiding", "pensione", "divorzio", "familia",
      "family", "famille", "familie", "famiglia", "salud", "health", "sante", "gesundheit", "gezondheid", "salute", "saude", "edad", "age",
    ],
  ],
  [
    "UNUSED",
    [
      "no la usamos", "no la uso", "ya no venimos", "apenas venimos", "gastos", "mantenimiento", "no la fem servir", "despeses",
      "don t use", "rarely use", "no longer use", "maintenance", "upkeep", "costs", "n utilise plus", "n utilisons plus", "entretien",
      "charges", "nutzen nicht", "kaum", "unterhalt", "kosten", "gebruiken niet", "onderhoud", "non la usiamo", "manutenzione",
      "costi", "spese", "nao usamos", "manutencao", "custos", "despesas",
    ],
  ],
  [
    "LIQUIDITY",
    [
      "dinero", "liquidez", "invertir", "inversion", "capital", "deudas", "diners", "liquiditat", "money", "cash", "invest", "investment",
      "liquidity", "argent", "liquidite", "investir", "geld", "liquiditat", "investieren", "investeren", "soldi", "liquidita",
      "investire", "dinheiro", "liquidez", "investimento",
    ],
  ],
  [
    "UPGRADE",
    [
      "mas grande", "mas pequena", "mas pequeno", "cambiar de casa", "otra casa", "mes gran", "mes petita", "bigger", "smaller", "downsize",
      "upsize", "another house", "plus grand", "plus petit", "autre maison", "grosser", "kleiner", "anderes haus", "groter", "kleiner huis",
      "andere woning", "piu grande", "piu piccola", "altra casa", "maior", "mais pequena", "outra casa",
    ],
  ],
];

export const detectMotivation = (norm: string) => firstMatch(norm, MOTIVATION_KEYWORDS);

const URGENT = [
  "urgente", "urgencia", "cuanto antes", "lo antes posible", "rapido", "urgent", "asap", "as soon as possible", "quickly", "fast",
  "rapidement", "des que possible", "dringend", "eilig", "schnell", "so schnell", "snel", "zo snel", "spoed", "urgenza", "subito",
  "rapidamente", "o mais rapido",
];

export function detectUrgency(norm: string): boolean {
  return URGENT.some((u) => has(norm, u));
}

const CONTACT_KEYWORDS: KeywordMap<ContactChannel> = [
  ["WHATSAPP", ["whatsapp", "wasap", "whats app", "wa"]],
  ["EMAIL", ["email", "e mail", "correo", "mail", "correu", "courriel", "posta"]],
  ["PHONE", ["telefono", "llamada", "llamadme", "telefon", "trucada", "phone", "call", "ring", "telephone", "appel", "anruf", "anrufen", "bellen", "telefoon", "chiamata", "telefone", "chamada", "ligar"]],
];

export const detectContactChannel = (norm: string) => firstMatch(norm, CONTACT_KEYWORDS);

const FEATURE_KEYWORDS: KeywordMap<string> = [
  ["SEA_VIEW", ["vistas al mar", "vista al mar", "vistes al mar", "sea view", "sea views", "vue mer", "vue sur la mer", "meerblick", "zeezicht", "vista mare", "vista mar"]],
  ["MOORING", ["amarre", "amarrador", "canal", "mooring", "berth", "amarrage", "anneau", "liegeplatz", "bootsliegeplatz", "ligplaats", "posto barca", "ormeggio", "amarracao"]],
  ["RENOVATED", ["reformada", "reformado", "reformat", "renovated", "refurbished", "renove", "renovee", "renoviert", "gerenoveerd", "ristrutturata", "ristrutturato", "renovada", "renovado"]],
  ["TO_REFORM", ["a reformar", "necesita reforma", "per reformar", "cal reformar", "needs work", "needs renovation", "a renover", "renovierungsbedurftig", "opknappen", "op te knappen", "da ristrutturare", "precisa de obras", "para renovar"]],
];

export function detectFeatures(norm: string): string[] {
  return FEATURE_KEYWORDS.filter(([, phrases]) => phrases.some((p) => has(norm, p))).map(([v]) => v);
}

export function detectSqm(norm: string): number | undefined {
  const m = norm.match(/(\d{2,4})\s*(m2|m|mts|metros|metres|meters|meter|mq|qm|sqm|quadratmeter|vierkante)\b/);
  return m ? Number(m[1]) : undefined;
}

export function detectBedrooms(norm: string): number | undefined {
  const m = norm.match(
    /(\d{1,2})\s*(dormitorios|dormitorio|habitaciones|habitacion|hab|dormitoris|habitacions|bedrooms|bedroom|beds|bed|chambres|chambre|schlafzimmer|zimmer|slaapkamers|slaapkamer|camere|camera|quartos|quarto)\b/,
  );
  return m ? Number(m[1]) : undefined;
}

export function detectPrice(norm: string): number | undefined {
  const k = norm.match(/(\d{2,4})\s*(k|mil|mille)\b/);
  if (k) return Number(k[1]) * 1000;
  const full = norm.match(/\b(\d{1,3}(?: \d{3})+|\d{5,7})\b/);
  if (full) {
    const value = Number(full[1].replace(/ /g, ""));
    if (value >= 50_000) return value;
  }
  return undefined;
}

export interface NluResult {
  norm: string;
  yesNo: "YES" | "NO" | null;
  location?: Location;
  propertyType?: PropertyType;
  timeline?: Timeline;
  situation?: Situation;
  motivation?: Motivation;
  urgent: boolean;
  contact?: ContactChannel;
  features: string[];
  sqm?: number;
  bedrooms?: number;
  price?: number;
}

export function analyze(text: string): NluResult {
  const norm = normalizeText(text);
  return {
    norm,
    yesNo: detectYesNo(norm),
    location: detectLocation(norm),
    propertyType: detectPropertyType(norm),
    timeline: detectTimeline(norm),
    situation: detectSituation(norm),
    motivation: detectMotivation(norm),
    urgent: detectUrgency(norm),
    contact: detectContactChannel(norm),
    features: detectFeatures(norm),
    sqm: detectSqm(norm),
    bedrooms: detectBedrooms(norm),
    price: detectPrice(norm),
  };
}
