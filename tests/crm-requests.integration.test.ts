// Pruebas de integración con una base de datos SQLite propia (prisma/test-crm.db), nunca la de desarrollo.
// Todos los datos son FICTICIOS.
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildDefaultAssumptions } from "@/services/study/assumptions";
import { emptySnapshot, makeInput } from "./study-fixtures";

const DB_FILE = path.join(__dirname, "..", "prisma", "test-crm.db");
process.env.DATABASE_URL = `file:${DB_FILE}`;
delete process.env.RESEND_API_KEY;
delete process.env.EMAIL_FROM;

type Mods = {
  prisma: typeof import("@/db/client").prisma;
  requests: typeof import("@/services/crm/requests");
  access: typeof import("@/services/study/access");
};
let m: Mods;

const SALE = {
  value: 300000,
  low: 264000,
  high: 336000,
  perM2: 3750,
  origin: "MODEL" as const,
  method: "test",
  confidence: "LOW" as const,
  source: { name: "Ministerio (test)", status: "OK" as const },
  adjustments: [],
  limitations: [],
};

async function newStudy(withSale = true) {
  const input = makeInput({ property: { sqm: 80 } });
  const { token, hash } = m.access.newAccessToken();
  const study = await m.prisma.study.create({
    data: {
      tokenHash: hash,
      input: JSON.stringify(input),
      assumptions: JSON.stringify(buildDefaultAssumptions(input).values),
      result: JSON.stringify(emptySnapshot(withSale ? { sale: SALE } : {})),
      ccaaCode: "09",
      provinceCode: "17",
      municipalityCode: "17152",
      municipalityName: "Roses",
      postalCode: "17480",
      propertyType: "PISO",
      sqm: 80,
      confidence: "LOW",
      tensionedStatus: "UNKNOWN",
    },
  });
  return { id: study.id, token };
}

const req = (over: Record<string, unknown> = {}) => ({ interest: "SELL", name: "Persona Ficticia", email: "ficticia@example.com", consentContact: true, elapsedMs: 10_000, ...over });

beforeAll(async () => {
  // Base de datos de prueba propia: se borra solo este fichero y se crea de nuevo
  for (const f of [DB_FILE, `${DB_FILE}-journal`]) if (existsSync(f)) rmSync(f);
  execSync("npx prisma db push --skip-generate", { env: { ...process.env, DATABASE_URL: `file:${DB_FILE}` }, stdio: "ignore" });
  m = {
    prisma: (await import("@/db/client")).prisma,
    requests: await import("@/services/crm/requests"),
    access: await import("@/services/study/access"),
  };
}, 120_000);

afterAll(async () => {
  await m?.prisma.$disconnect();
});

describe("solicitud desde la pantalla final", () => {
  it("guarda el contacto, la solicitud con sus consentimientos y la asocia al estudio", async () => {
    const s = await newStudy();
    const r = await m.requests.submitStudyRequest(s.id, s.token, req({ consentPartnerShare: true }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const lead = await m.prisma.lead.findUniqueOrThrow({ where: { id: r.leadId }, include: { requests: true, consent: true, notes: true, events: true, studies: true } });
    expect(lead.status).toBe("PENDING_CONTACT");
    expect(lead.primaryInterest).toBe("SELL");
    expect(lead.partnerShareConsent).toBe(true);
    expect(lead.estimatedValue).toBe(300000); // valoración del estudio, no del modelo de ejemplo
    expect(lead.requests).toHaveLength(1);
    expect(lead.requests[0].studyId).toBe(s.id);
    expect(lead.requests[0].consentText).toMatch(/profesional colaborador/);
    expect(lead.requests[0].consentMarketing).toBe(false);
    expect(lead.studies.map((x) => x.id)).toContain(s.id);
    expect(lead.notes.length).toBe(1);
    expect(lead.events.map((e) => e.type)).toEqual(expect.arrayContaining(["LEAD_CREATED", "STAGE_ENTERED", "REQUEST_RECEIVED", "EMAIL_NOT_CONFIGURED"]));
    expect(r.ownerEmail).toBe("NOT_CONFIGURED"); // sin proveedor no se simula ningún envío
  });

  it("no duplica contactos: mismo email (en mayúsculas) o mismo teléfono", async () => {
    const s1 = await newStudy();
    const s2 = await newStudy();
    const s3 = await newStudy();
    const a = await m.requests.submitStudyRequest(s1.id, s1.token, req({ email: "repetido@example.com", contactChannel: "PHONE", phone: "+34 611 22 33 44" }));
    const b = await m.requests.submitStudyRequest(s2.id, s2.token, req({ email: "REPETIDO@Example.com", interest: "RENT" }));
    const c = await m.requests.submitStudyRequest(s3.id, s3.token, req({ email: "otro@example.com", interest: "ADVICE", contactChannel: "WHATSAPP", phone: "611223344" }));
    expect(a.ok && b.ok && c.ok).toBe(true);
    if (!a.ok || !b.ok || !c.ok) return;
    expect(b.leadId).toBe(a.leadId);
    expect(c.leadId).toBe(a.leadId);
    expect(b.existingContact).toBe(true);
    expect(await m.prisma.serviceRequest.count({ where: { leadId: a.leadId } })).toBe(3);
    expect(await m.prisma.lead.count({ where: { emailNormalized: "repetido@example.com" } })).toBe(1);
  });

  it("solo informe: sin acción comercial y sin valoración inventada", async () => {
    const s = await newStudy(false);
    const r = await m.requests.submitStudyRequest(s.id, s.token, req({ interest: "REPORT_ONLY", email: "informe@example.com" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const lead = await m.prisma.lead.findUniqueOrThrow({ where: { id: r.leadId } });
    expect(lead.status).toBe("STUDY_DONE");
    expect(lead.estimatedValue).toBeNull();
    expect(lead.nextActionAt).toBeNull();
    const study = await m.prisma.study.findUniqueOrThrow({ where: { id: s.id } });
    expect(study.valuationRequested).toBe(false);
  });

  it("rechaza accesos sin el código del estudio, spam y datos incompletos", async () => {
    const s = await newStudy();
    expect(await m.requests.submitStudyRequest(s.id, "codigo-falso", req())).toMatchObject({ ok: false, status: 404 });
    expect(await m.requests.submitStudyRequest(s.id, s.token, req({ website: "http://spam" }))).toMatchObject({ ok: false, status: 400 });
    expect(await m.requests.submitStudyRequest(s.id, s.token, req({ elapsedMs: 300 }))).toMatchObject({ ok: false, status: 400 });
    expect(await m.requests.submitStudyRequest(s.id, s.token, req({ consentContact: false }))).toMatchObject({ ok: false, status: 400 });
    expect(await m.requests.submitStudyRequest(s.id, s.token, req({ contactChannel: "PHONE" }))).toMatchObject({ ok: false, status: 400 });
  });

  it("los datos siguen ahí tras reiniciar (nueva conexión a la base de datos)", async () => {
    const before = await m.prisma.lead.count();
    await m.prisma.$disconnect();
    const { PrismaClient } = await import("@prisma/client");
    const fresh = new PrismaClient({ datasourceUrl: `file:${DB_FILE}` });
    expect(await fresh.lead.count()).toBe(before);
    expect(await fresh.serviceRequest.count()).toBeGreaterThan(0);
    await fresh.$disconnect();
  });
});

describe("envío real de correo (Resend)", () => {
  it("con la configuración, llama a la API de Resend con la clave y el adjunto", async () => {
    process.env.RESEND_API_KEY = "re_test_ficticia";
    process.env.EMAIL_FROM = "FINCALIA360 <hola@example.com>";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "email_123" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendEmail } = await import("@/services/email/emailService");
    const r = await sendEmail({ to: "ficticia@example.com", subject: "Prueba", text: "Hola", attachments: [{ filename: "a.pdf", content: new Uint8Array([37, 80, 68, 70]) }] });
    expect(r).toEqual({ status: "SENT", id: "email_123" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_ficticia");
    expect(JSON.parse(String(init.body)).attachments[0].filename).toBe("a.pdf");
    vi.unstubAllGlobals();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  it("sin configuración no envía nada e indica qué falta", async () => {
    const { sendEmail } = await import("@/services/email/emailService");
    expect(await sendEmail({ to: "x@example.com", subject: "s", text: "t" })).toEqual({ status: "NOT_CONFIGURED", missing: ["RESEND_API_KEY", "EMAIL_FROM"] });
  });
});
