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
  contacts: typeof import("@/services/crm/contacts");
  metrics: typeof import("@/services/crm/metrics");
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
    contacts: await import("@/services/crm/contacts"),
    metrics: await import("@/services/crm/metrics"),
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

describe("CRM: seguimiento, colaboradores, ingresos e indicadores", () => {
  async function newContact(email: string, over: Record<string, unknown> = {}) {
    const s = await newStudy();
    const r = await m.requests.submitStudyRequest(s.id, s.token, req({ email, ...over }));
    if (!r.ok) throw new Error(r.error);
    return r.leadId;
  }

  it("cambia de estado, programa la próxima acción y registra comunicaciones", async () => {
    const id = await newContact("seguimiento@example.com");
    const follow = await m.contacts.listContacts({ followUp: "1" });
    expect(follow.map((c) => c.id)).toContain(id); // nuevo y pendiente: requiere seguimiento
    await m.contacts.logContact(id, "CALL", "Primera llamada: interesado en vender");
    let lead = await m.prisma.lead.findUniqueOrThrow({ where: { id } });
    expect(lead.status).toBe("CONTACTED");
    expect(lead.lastContactAt).not.toBeNull();
    expect(lead.nextActionAt).toBeNull(); // la acción pendiente («contactar») queda realizada
    expect((await m.contacts.listContacts({ followUp: "1" })).map((c) => c.id)).not.toContain(id);
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    await m.contacts.setNextAction(id, "Concertar consulta", tomorrow);
    expect((await m.contacts.listContacts({ followUp: "1" })).map((c) => c.id)).not.toContain(id); // la próxima acción aún no ha vencido
    await m.contacts.changeStatus(id, "APPOINTMENT");
    lead = await m.prisma.lead.findUniqueOrThrow({ where: { id } });
    expect(lead.status).toBe("APPOINTMENT");
    await expect(m.contacts.changeStatus(id, "INVENTADO")).rejects.toThrow(/no válido/);
    const types = (await m.prisma.event.findMany({ where: { leadId: id } })).map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["CONTACT_LOGGED", "NEXT_ACTION_SET", "STAGE_ENTERED"]));
  });

  it("filtra por municipio, interés y estado", async () => {
    const id = await newContact("filtros@example.com", { interest: "RENT" });
    expect((await m.contacts.listContacts({ municipality: "Roses", interest: "RENT" })).map((c) => c.id)).toContain(id);
    expect((await m.contacts.listContacts({ municipality: "Lugo" })).map((c) => c.id)).not.toContain(id);
    expect((await m.contacts.listContacts({ status: "PENDING_CONTACT", q: "filtros@" })).map((c) => c.id)).toEqual([id]);
  });

  it("solo asigna a un colaborador si el propietario lo autorizó", async () => {
    const partner = await m.prisma.agency.create({
      data: { name: "Colaborador Ficticio", zones: "", email: "colab@example.com", phone: "600000000", languages: "es", propertyTypes: "APARTMENT", status: "ACTIVE", services: "SELL", provinces: "17" },
    });
    const sin = await newContact("sin-permiso@example.com");
    await expect(m.contacts.assignPartner(sin, partner.id, "SELL")).rejects.toThrow(/no ha autorizado/);
    const con = await newContact("con-permiso@example.com", { consentPartnerShare: true });
    const a = await m.contacts.assignPartner(con, partner.id, "SELL");
    await m.contacts.updateAssignment(a.id, "WON", "Mandato firmado (ficticio)");
    expect((await m.prisma.partnerAssignment.findUniqueOrThrow({ where: { id: a.id } })).closedAt).not.toBeNull();
  });

  it("indicadores: sin dobles conteos y sin datos de demostración", async () => {
    const from = new Date(Date.now() - 1);
    const id = await newContact("metricas@example.com");
    await m.contacts.changeStatus(id, "APPOINTMENT");
    await m.contacts.changeStatus(id, "CONTACTED");
    await m.contacts.changeStatus(id, "APPOINTMENT"); // vuelve a entrar: debe contar una sola vez
    await m.contacts.changeStatus(id, "CONVERTED");
    await m.contacts.addRevenue({ leadId: id, agencyId: null, serviceCode: "SELL", amount: 1500, date: new Date(), description: "Honorarios (ficticio)" });
    // Contacto de demostración: no debe contar
    const demo = await m.prisma.lead.create({ data: { name: "Demo", email: "demo@example.com", timeline: "NOW", situation: "EMPTY", isDemo: true } });
    await m.prisma.revenue.create({ data: { leadId: demo.id, amount: 99999, date: new Date(), description: "demo" } });
    await m.prisma.event.create({ data: { category: "BUSINESS", type: "STAGE_ENTERED", leadId: demo.id, payload: JSON.stringify({ to: "CONVERTED" }) } });
    await m.prisma.event.create({ data: { category: "ANALYTICS", type: "study_started", sessionId: "seed-1" } });
    await m.prisma.event.create({ data: { category: "ANALYTICS", type: "study_started", sessionId: "real-1" } });
    await m.prisma.event.create({ data: { category: "ANALYTICS", type: "study_started", sessionId: "real-1" } });

    const r = await m.metrics.getBusinessMetrics({ from, to: new Date(Date.now() + 1000) });
    expect(r.values.consultationsScheduled).toBe(1);
    expect(r.values.clientsWon).toBe(1);
    expect(r.values.revenue).toBe(1500);
    expect(r.values.studiesStarted).toBe(1); // misma sesión dos veces = 1; la sesión «seed-» no cuenta
    expect(r.values.requestsReceived).toBeGreaterThanOrEqual(1);
  });

  it("exporta y suprime los datos personales de un contacto", async () => {
    const id = await newContact("borrar@example.com", { phone: "+34 622 33 44 55", contactChannel: "PHONE", comments: "Comentario personal" });
    const exported = await m.contacts.exportContactData(id);
    expect(exported?.contact.email).toBe("borrar@example.com");
    await m.contacts.eraseContact(id);
    const lead = await m.prisma.lead.findUniqueOrThrow({ where: { id }, include: { notes: true, requests: true, consent: true } });
    expect(lead.name).toBe("Contacto suprimido");
    expect(lead.email).not.toContain("borrar");
    expect(lead.phone).toBeNull();
    expect(lead.notes).toHaveLength(0);
    expect(lead.consent).toBeNull();
    expect(lead.requests.every((r) => r.comments === null)).toBe(true);
    const study = await m.prisma.study.findFirstOrThrow({ where: { leadId: id } });
    expect(study.contactEmail).toBeNull();
  });
});

describe("asistente virtual del estudio (Claude)", () => {
  it("convierte las propuestas del asistente en botones y quita las etiquetas del texto", async () => {
    const { extractActions } = await import("@/services/study/chatAssistant");
    const r = extractActions("Con tus cifras, vender hoy te deja 280.000 € netos.\n[[ACCION:SELL]]");
    expect(r.actions).toEqual(["SELL"]);
    expect(r.text).not.toContain("[[");
  });

  it("envía a Claude las reglas y SOLO los datos de ese estudio; exige el código de acceso", async () => {
    const s = await newStudy();
    const { answerStudyChat } = await import("@/services/study/chatAssistant");
    expect(await answerStudyChat(s.id, "otro-codigo", { messages: [{ role: "user", content: "Hola" }] })).toMatchObject({ ok: false, status: 404 });

    process.env.ANTHROPIC_API_KEY = "sk-ant-ficticia";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ content: [{ type: "text", text: "Hello! Selling today would leave you about 300.000 €.\n[[ACCION:SELL]]" }], usage: { input_tokens: 900, output_tokens: 40 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await answerStudyChat(s.id, s.token, { messages: [{ role: "user", content: "Should I sell my flat?" }] });
    vi.unstubAllGlobals();
    delete process.env.ANTHROPIC_API_KEY;

    expect(r).toMatchObject({ ok: true, actions: ["SELL"] });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("sk-ant-ficticia");
    const body = JSON.parse(String(init.body));
    expect(body.system).toMatch(/idioma en que te escribe/);
    expect(body.system).toMatch(/No inventes precios/);
    expect(body.system).toMatch(/Sin presión/);
    expect(body.system).toContain("300.000 €"); // valoración de ESTE estudio
    expect(body.system).toContain("Roses");
    expect(body.messages).toEqual([{ role: "user", content: "Should I sell my flat?" }]);
    // No se guarda la conversación: solo un evento anónimo de uso
    const ev = await m.prisma.event.findFirst({ where: { type: "chat_message" }, orderBy: { createdAt: "desc" } });
    expect(ev?.payload).not.toContain("Should I sell");
  });

  it("respeta el límite diario de mensajes (control de coste)", async () => {
    const s = await newStudy();
    process.env.CHAT_DAILY_MESSAGE_LIMIT = "0";
    const { answerStudyChat } = await import("@/services/study/chatAssistant");
    expect(await answerStudyChat(s.id, s.token, { messages: [{ role: "user", content: "Hola" }] })).toMatchObject({ ok: false, status: 503 });
    delete process.env.CHAT_DAILY_MESSAGE_LIMIT;
  });
});
