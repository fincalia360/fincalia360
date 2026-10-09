import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hashToken, newAccessToken, verifyToken } from "@/services/study/access";
import { buildDefaultAssumptions } from "@/services/study/assumptions";
import { csvCell } from "@/services/study/adminStudyService";
import { ineToCommonName, postalCodeMatchesProvince, sameTokens } from "@/services/study/geo";
import { checkTensionedArea, findMunicipalityInText, parseSpanishDate, parseTensionedAreasHtml } from "@/services/study/sources/tensionedAreas";
import { normalizePhone, requestSchema } from "@/services/crm/requests";
import { studyInputSchema } from "@/services/study/types";
import { checkCredentials, signSession, verifySession } from "@/lib/session";
import { makeInput } from "./study-fixtures";

const html = readFileSync(path.join(__dirname, "fixtures", "mivau-zonas-tensionadas-2026-10.html"), "utf-8");

describe("zonas tensionadas (página oficial del Ministerio)", () => {
  const declarations = parseTensionedAreasHtml(html);
  const today = new Date("2026-10-09T12:00:00Z");

  it("interpreta las declaraciones con su vigencia y resolución", () => {
    expect(declarations.length).toBeGreaterThan(10);
    const cat = declarations.find((d) => d.ccaa.startsWith("Catalu") && d.municipalitiesText.includes("Roses"));
    expect(cat?.validFrom?.toISOString().slice(0, 10)).toBe("2024-10-10");
    expect(cat?.validTo?.toISOString().slice(0, 10)).toBe("2027-10-10");
    expect(cat?.bulletin).toMatch(/BOE/);
  });

  it("Roses: declarada en todo el municipio y vigente", () => {
    const r = checkTensionedArea({ municipalityNames: ["Roses"], ccaaName: "Cataluña", declarations, importedAt: today, today });
    expect(r.status).toBe("DECLARED");
  });

  it("declaración parcial: exige comprobar la dirección", () => {
    const r = checkTensionedArea({ municipalityNames: ["Llanes"], ccaaName: "Principado de Asturias", declarations, importedAt: today, today });
    expect(r.status).toBe("PARTIAL");
    expect(r.detail).toMatch(/núcleo urbano/i);
  });

  it("no basta con el nombre: comprueba la comunidad autónoma", () => {
    const r = checkTensionedArea({ municipalityNames: ["Roses"], ccaaName: "Galicia", declarations, importedAt: today, today });
    expect(r.status).toBe("NOT_FOUND");
  });

  it("detecta declaraciones vencidas", () => {
    const r = checkTensionedArea({ municipalityNames: ["Roses"], ccaaName: "Cataluña", declarations, importedAt: today, today: new Date("2031-01-01") });
    expect(r.status).toBe("EXPIRED");
  });

  it("sin datos oficiales: no verificado", () => {
    expect(checkTensionedArea({ municipalityNames: ["Roses"], ccaaName: "Cataluña", declarations: [], importedAt: null }).status).toBe("UNKNOWN");
  });

  it("búsqueda exacta de nombres (no subcadenas)", () => {
    expect(findMunicipalityInText("Sant Pere de Vilamajor, Sant Pere Pescador.", ["Sant Pere"]).found).toBe(false);
    expect(findMunicipalityInText("Castell d'Aro, Platja d'Aro i S'Agaró, Celrà.", ["Castell d'Aro, Platja d'Aro i S'Agaró"]).found).toBe(true);
    expect(parseSpanishDate("Desde el 30 de julio de 2026")?.toISOString().slice(0, 10)).toBe("2026-07-30");
  });
});

describe("validación del formulario y geografía", () => {
  it("rechaza un código postal que no corresponde a la provincia", () => {
    expect(() => makeInput({ location: { postalCode: "08001" } })).toThrow();
    expect(postalCodeMatchesProvince("17480", "17")).toBe(true);
  });

  it("acepta importes desconocidos (null) y rechaza negativos", () => {
    expect(makeInput({ economics: { purchasePrice: "" } }).economics.purchasePrice).toBeNull();
    expect(() => makeInput({ economics: { ibiYear: -5 } })).toThrow();
  });

  it("normaliza nombres del INE", () => {
    expect(ineToCommonName("Escala, L'")).toBe("L'Escala");
    expect(ineToCommonName("Bisbal d'Empordà, La")).toBe("La Bisbal d'Empordà");
    expect(sameTokens("Balears, Illes", "Illes Balears")).toBe(true);
  });

  it("el esquema exige un horizonte válido", () => {
    expect(() => studyInputSchema.parse({ ...makeInput(), owner: { ...makeInput().owner, horizon: 7 } })).toThrow();
  });
});

describe("captación y CRM", () => {
  const base = { interest: "SELL", name: "Ana Prueba", email: "ANA@Example.com", consentContact: true };

  it("solo la autorización para atender la solicitud es obligatoria; las demás, opcionales y desmarcadas", () => {
    const ok = requestSchema.parse(base);
    expect(ok.consentPartnerShare).toBe(false);
    expect(ok.consentMarketing).toBe(false);
    expect(ok.email).toBe("ana@example.com");
    expect(requestSchema.safeParse({ ...base, consentContact: false }).success).toBe(false);
  });

  it("pide teléfono solo si se elige llamada o WhatsApp", () => {
    expect(requestSchema.safeParse({ ...base, contactChannel: "PHONE" }).success).toBe(false);
    expect(requestSchema.safeParse({ ...base, contactChannel: "PHONE", phone: "+34 600 11 22 33" }).success).toBe(true);
    expect(requestSchema.safeParse({ ...base, contactChannel: "EMAIL" }).success).toBe(true);
  });

  it("normaliza teléfonos para detectar duplicados", () => {
    expect(normalizePhone("+34 600 11 22 33")).toBe("600112233");
    expect(normalizePhone("600-112-233")).toBe("600112233");
    expect(normalizePhone("123")).toBeNull();
  });

  it("CSV protegido contra inyección de fórmulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
  });
});

describe("acceso y sesiones", () => {
  it("token de acceso al estudio", () => {
    const { token, hash } = newAccessToken();
    expect(verifyToken(token, hash)).toBe(true);
    expect(verifyToken("otro", hash)).toBe(false);
    expect(verifyToken(undefined, hashToken("x"))).toBe(false);
  });

  it("sesión de administración firmada", async () => {
    process.env.ADMIN_PASSWORD = "secreto-de-prueba";
    process.env.ADMIN_SESSION_SECRET = "clave-de-sesion-de-prueba";
    const token = await signSession("admin");
    expect((await verifySession(token))?.user).toBe("admin");
    expect(await verifySession(token.slice(0, -2) + "xx")).toBeNull();
    expect(await checkCredentials("admin", "secreto-de-prueba")).toBe(true);
    expect(await checkCredentials("admin", "mala")).toBe(false);
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_SESSION_SECRET;
  });
});

describe("hipótesis por defecto", () => {
  it("usa los datos del propietario antes que las hipótesis", () => {
    const input = makeInput({ economics: { communityFeesYear: 900 } });
    const { values, meta } = buildDefaultAssumptions(input);
    expect(values.communityFeesYear).toBe(900);
    expect(meta.communityFeesYear.origin).toBe("OWNER");
    expect(meta.ibiYear.origin).toBe("ASSUMPTION");
  });
});
