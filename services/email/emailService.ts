// Envío real de correo con Resend (https://resend.com) mediante su API HTTP, sin dependencias.
// Si falta la configuración NO se simula ningún envío: se devuelve NOT_CONFIGURED y se registra.
// Variables: RESEND_API_KEY, EMAIL_FROM («FINCALIA360 <hola@tudominio.es>»), TEAM_NOTIFICATION_EMAIL.

export interface EmailAttachment {
  filename: string;
  content: Uint8Array;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export type EmailResult = { status: "SENT"; id: string } | { status: "NOT_CONFIGURED"; missing: string[] } | { status: "FAILED"; error: string };

export function emailConfig() {
  const missing = ["RESEND_API_KEY", "EMAIL_FROM"].filter((k) => !process.env[k]?.trim());
  return { configured: missing.length === 0, missing, from: process.env.EMAIL_FROM ?? null, team: process.env.TEAM_NOTIFICATION_EMAIL?.trim() || null };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** HTML sencillo con la identidad de FINCALIA360 a partir del texto plano. */
export function brandedHtml(text: string) {
  const body = text
    .split("\n\n")
    .map((p) => `<p style="margin:0 0 14px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family:Inter,Arial,sans-serif;color:#142B45;max-width:560px;margin:0 auto;padding:24px">
<p style="font-weight:800;font-size:20px;margin:0 0 20px">FINCALIA<span style="color:#238477">360</span></p>${body}
<p style="margin:24px 0 0;font-size:12px;color:#5B6B7C">Estudios orientativos: no sustituyen una tasación oficial ni el asesoramiento fiscal o jurídico.</p></div>`;
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const cfg = emailConfig();
  if (!cfg.configured) return { status: "NOT_CONFIGURED", missing: cfg.missing };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: cfg.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html ?? brandedHtml(message.text),
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        ...(message.attachments?.length
          ? { attachments: message.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") })) }
          : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok || !data.id) return { status: "FAILED", error: data.message ?? `HTTP ${res.status}` };
    return { status: "SENT", id: data.id };
  } catch (error) {
    return { status: "FAILED", error: (error as Error).message };
  }
}
