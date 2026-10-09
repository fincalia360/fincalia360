"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Download, FileText, Home, KeyRound, Loader2, Scale } from "lucide-react";
import { track } from "@/lib/analytics-client";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { ChoiceGroup, Field } from "./fields";

export interface PublicService {
  code: string;
  name: string;
  summary: string;
  scope: string;
  price: string;
}

type Interest = "SELL" | "RENT" | "ADVICE" | "REPORT_ONLY";

const OPTIONS: Array<{ interest: Interest; title: string; text: string; icon: typeof Home }> = [
  { interest: "SELL", title: "Quiero vender mi vivienda", text: "Revisamos tu caso y te ponemos en contacto con una inmobiliaria colaboradora de tu zona.", icon: Home },
  { interest: "RENT", title: "Quiero alquilar mi vivienda", text: "Partimos de la renta y las reglas de tu zona que muestra el estudio para preparar el alquiler.", icon: KeyRound },
  { interest: "ADVICE", title: "Quiero comparar las alternativas con un profesional", text: "Revisión personalizada de los escenarios de venta, alquiler y mantenimiento.", icon: Scale },
  { interest: "REPORT_ONLY", title: "Solo quiero recibir mi informe", text: "Descárgalo ahora. Nadie te contactará.", icon: FileText },
];

const INTEREST_TITLE: Record<Interest, string> = { SELL: "Vender mi vivienda", RENT: "Alquilar mi vivienda", ADVICE: "Comparar alternativas con un profesional", REPORT_ONLY: "Recibir mi informe" };
const CHANNEL_LABEL = { EMAIL: "Email", PHONE: "Llamada", WHATSAPP: "WhatsApp" } as const;
const WINDOW_LABEL = { MORNING: "Mañanas (9-14 h)", AFTERNOON: "Tardes (16-20 h)", EVENING: "A última hora (20-21 h)", ANY: "Cualquier hora" } as const;

type Form = {
  name: string;
  email: string;
  phone: string;
  contactChannel: keyof typeof CHANNEL_LABEL;
  contactWindow: keyof typeof WINDOW_LABEL;
  comments: string;
  consentContact: boolean;
  consentPartnerShare: boolean;
  consentMarketing: boolean;
  website: string;
};

const EMPTY: Form = {
  name: "",
  email: "",
  phone: "",
  contactChannel: "EMAIL",
  contactWindow: "ANY",
  comments: "",
  consentContact: false,
  consentPartnerShare: false,
  consentMarketing: false,
  website: "",
};

export function NextStepPanel({
  studyId,
  property,
  services,
  emailConfigured,
  onDownload,
  downloading,
}: {
  studyId: string;
  property: { municipality: string; kind: string; sqm: number };
  services: PublicService[];
  emailConfigured: boolean;
  onDownload: () => void;
  downloading: boolean;
}) {
  const [interest, setInterest] = useState<Interest | null>(null);
  const [step, setStep] = useState<"form" | "summary" | "done">("form");
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ownerEmail: string; existingContact: boolean } | null>(null);
  const openedAt = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const viewed = useRef(false);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !viewed.current) {
        viewed.current = true;
        track("final_screen_view", { studyId });
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [studyId]);

  const service = interest ? services.find((s) => s.code === interest) : undefined;
  const reportOnly = interest === "REPORT_ONLY";
  const needsPhone = form.contactChannel !== "EMAIL";

  function choose(i: Interest) {
    setInterest(i);
    setStep("form");
    setErrors({});
    setServerError(null);
    openedAt.current = Date.now();
    if (i !== "REPORT_ONLY") track("request_form_started", { studyId, interest: i });
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  function validate() {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Indica tu nombre";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = "Revisa el email";
    if (!reportOnly && needsPhone && form.phone.replace(/\D/g, "").length < 9) e.phone = "Indica un teléfono para poder llamarte";
    if (!form.consentContact) e.consentContact = reportOnly ? "Necesitamos tu autorización para enviarte el informe" : "Necesitamos tu autorización para atender la solicitud";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function send() {
    setSending(true);
    setServerError(null);
    try {
      const res = await fetch(`/api/estudio/${studyId}/contacto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          interest,
          contactChannel: reportOnly ? "EMAIL" : form.contactChannel,
          contactWindow: reportOnly || form.contactChannel === "EMAIL" ? undefined : form.contactWindow,
          phone: reportOnly ? "" : form.phone,
          consentPartnerShare: reportOnly ? false : form.consentPartnerShare,
          elapsedMs: Date.now() - openedAt.current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No hemos podido enviar la solicitud.");
      setResult({ ownerEmail: data.ownerEmail, existingContact: data.existingContact });
      setStep("done");
    } catch (error) {
      setServerError((error as Error).message || "No hemos podido enviar la solicitud. Inténtalo de nuevo en unos minutos.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div ref={panelRef} className="rounded-3xl border border-sand-200 bg-white p-6 shadow-soft sm:p-10">
      <h2 className="max-w-3xl text-3xl font-extrabold tracking-tight text-ink-800 sm:text-4xl">Ya conoces las posibilidades de tu vivienda. ¿Quieres que te ayudemos con el siguiente paso?</h2>
      <p className="mt-3 max-w-3xl text-ink-500">
        En FINCALIA360 podemos estudiar contigo las opciones disponibles y, cuando corresponda, ponerte en contacto con profesionales colaboradores para ejecutar
        la operación. Tu estudio y tu informe son tuyos elijas lo que elijas, y pedir información es gratis y sin compromiso.
      </p>

      {/* Opciones */}
      <div className="mt-7 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="¿Qué quieres hacer?">
        {OPTIONS.map((o) => {
          const Icon = o.icon;
          const active = interest === o.interest;
          return (
            <button
              key={o.interest}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(o.interest)}
              className={cn(
                "flex gap-3 rounded-2xl border p-4 text-left transition",
                active ? "border-terracotta-500 bg-terracotta-50 ring-2 ring-terracotta-100" : "border-sand-200 hover:border-ink-300",
              )}
            >
              <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", active ? "bg-terracotta-500 text-white" : "bg-sand-100 text-ink-600")}>
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-bold text-ink-800">{o.title}</span>
                <span className="mt-0.5 block text-sm text-ink-500">{o.text}</span>
              </span>
            </button>
          );
        })}
      </div>

      {interest && (
        <div className="mt-8 border-t border-sand-200 pt-8">
          {/* Solo informe: descarga inmediata, envío por email opcional */}
          {reportOnly && step !== "done" && (
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <Button onClick={onDownload} disabled={downloading} variant="accent" size="lg">
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Descargar mi informe PDF
              </Button>
              <p className="text-sm text-ink-500">No necesitas dejar ningún dato.</p>
            </div>
          )}
          {reportOnly && !emailConfigured && step !== "done" ? null : step === "done" && result ? (
            <Confirmation interest={interest} result={result} emailConfigured={emailConfigured} />
          ) : step === "summary" ? (
            <div>
              <button type="button" onClick={() => setStep("form")} className="mb-4 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800">
                <ArrowLeft className="h-4 w-4" /> Corregir datos
              </button>
              <h3 className="text-xl font-bold text-ink-800">Revisa tu solicitud antes de enviarla</h3>
              <dl className="mt-4 grid gap-x-6 gap-y-2 rounded-2xl bg-sand-50 p-5 text-sm sm:grid-cols-2">
                {[
                  ["Solicitud", INTEREST_TITLE[interest]],
                  ["Vivienda", `${property.kind} · ${property.sqm} m² · ${property.municipality}`],
                  ["Nombre", form.name],
                  ["Email", form.email],
                  ...(!reportOnly
                    ? [
                        ["Contacto preferido", CHANNEL_LABEL[form.contactChannel] + (form.contactChannel !== "EMAIL" ? ` · ${WINDOW_LABEL[form.contactWindow]}` : "")],
                        ["Teléfono", form.phone || "—"],
                      ]
                    : []),
                  ...(form.comments ? [["Comentarios", form.comments]] : []),
                  ...(!reportOnly ? [["Comunicar tus datos a un colaborador", form.consentPartnerShare ? "Sí, lo autorizas" : "No"]] : []),
                  ["Información comercial", form.consentMarketing ? "Sí, la aceptas" : "No"],
                ].map(([k, v]) => (
                  <div key={k} className="flex flex-col">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-ink-400">{k}</dt>
                    <dd className="text-ink-800">{v}</dd>
                  </div>
                ))}
              </dl>
              {serverError && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{serverError}</p>}
              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={send} disabled={sending} variant="accent" size="lg">
                  {sending && <Loader2 className="h-4 w-4 animate-spin" />} {reportOnly ? "Enviarme el informe" : "Enviar solicitud"}
                </Button>
                <Button onClick={() => setStep("form")} variant="outline" size="lg">
                  Volver
                </Button>
              </div>
            </div>
          ) : (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (validate()) setStep("summary");
              }}
              className="space-y-5"
            >
              <div>
                <h3 className="text-xl font-bold text-ink-800">{reportOnly ? "¿Prefieres recibirlo por email?" : INTEREST_TITLE[interest]}</h3>
                {service && (
                  <div className="mt-3 rounded-2xl bg-sand-50 p-4 text-sm text-ink-600">
                    <p>{service.summary}</p>
                    <p className="mt-2 text-xs text-ink-500">
                      <strong className="text-ink-700">Qué incluye:</strong> {service.scope}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      <strong className="text-ink-700">Precio:</strong> {service.price}
                    </p>
                  </div>
                )}
                <p className="mt-3 text-xs text-ink-400">
                  Ya tenemos los datos de tu vivienda del estudio ({property.kind}, {property.sqm} m², {property.municipality}): no hace falta repetirlos.
                </p>
              </div>
              {/* Campo trampa antispam (oculto para personas) */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={form.website} onChange={(e) => set("website", e.target.value)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre" htmlFor="r-name" error={errors.name}>
                  <input id="r-name" className="field" autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} />
                </Field>
                <Field label="Email" htmlFor="r-email" error={errors.email} hint={reportOnly ? "Solo para enviarte el informe." : "Para responderte sobre tu solicitud."}>
                  <input id="r-email" type="email" className="field" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </Field>
              </div>
              {!reportOnly && (
                <>
                  <Field label="¿Cómo prefieres que te contactemos?">
                    <ChoiceGroup
                      name="Contacto preferido"
                      columns="grid-cols-3"
                      options={(Object.keys(CHANNEL_LABEL) as Array<keyof typeof CHANNEL_LABEL>).map((k) => ({ value: k, label: CHANNEL_LABEL[k] }))}
                      value={form.contactChannel}
                      onChange={(v) => set("contactChannel", v as Form["contactChannel"])}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Teléfono"
                      htmlFor="r-phone"
                      optional={!needsPhone}
                      error={errors.phone}
                      hint={needsPhone ? "Solo lo usaremos para esta solicitud." : "Opcional: solo si prefieres que te llamemos en algún momento."}
                    >
                      <input id="r-phone" type="tel" className="field" autoComplete="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                    </Field>
                    {needsPhone && (
                      <Field label="Franja horaria preferida" htmlFor="r-window">
                        <select id="r-window" className="field" value={form.contactWindow} onChange={(e) => set("contactWindow", e.target.value as Form["contactWindow"])}>
                          {(Object.keys(WINDOW_LABEL) as Array<keyof typeof WINDOW_LABEL>).map((k) => (
                            <option key={k} value={k}>
                              {WINDOW_LABEL[k]}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                  </div>
                  <Field label="¿Algo que debamos saber?" htmlFor="r-comments" optional>
                    <textarea id="r-comments" rows={3} maxLength={1000} className="field" value={form.comments} onChange={(e) => set("comments", e.target.value)} />
                  </Field>
                </>
              )}

              <fieldset className="space-y-3 rounded-2xl border border-sand-200 p-4 text-sm">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-400">Tus autorizaciones</legend>
                <label className="flex gap-2.5">
                  <input type="checkbox" className="mt-1" checked={form.consentContact} onChange={(e) => set("consentContact", e.target.checked)} />
                  <span>
                    {reportOnly ? "Acepto que FINCALIA360 use mi email para enviarme mi informe." : "Acepto que FINCALIA360 trate mis datos para atender esta solicitud y contactarme sobre ella."}{" "}
                    <span className="text-ink-400">(Necesario)</span>
                  </span>
                </label>
                {errors.consentContact && <p className="text-xs text-red-600" role="alert">{errors.consentContact}</p>}
                {!reportOnly && (
                  <label className="flex gap-2.5">
                    <input type="checkbox" className="mt-1" checked={form.consentPartnerShare} onChange={(e) => set("consentPartnerShare", e.target.checked)} />
                    <span>
                      Acepto que FINCALIA360 comunique mis datos de contacto y los de mi vivienda a un profesional colaborador de mi zona (inmobiliaria o asesor) para que me
                      preste el servicio. <span className="text-ink-400">(Opcional: si no lo marcas, te atenderemos primero nosotros y te preguntaremos antes de compartirlos.)</span>
                    </span>
                  </label>
                )}
                <label className="flex gap-2.5">
                  <input type="checkbox" className="mt-1" checked={form.consentMarketing} onChange={(e) => set("consentMarketing", e.target.checked)} />
                  <span>
                    Quiero recibir información comercial de FINCALIA360 por email. Puedo darme de baja en cualquier momento. <span className="text-ink-400">(Opcional)</span>
                  </span>
                </label>
                <p className="text-xs text-ink-400">
                  Más información en la{" "}
                  <Link href="/privacy" target="_blank" className="underline">
                    política de privacidad
                  </Link>
                  .
                </p>
              </fieldset>
              <Button type="submit" variant="accent" size="lg">
                Revisar y enviar
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function Confirmation({ interest, result, emailConfigured }: { interest: Interest; result: { ownerEmail: string; existingContact: boolean }; emailConfigured: boolean }) {
  const reportOnly = interest === "REPORT_ONLY";
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-pine-100 bg-pine-50 p-5 text-ink-700" role="status">
      <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-pine-600" />
      <div>
        <p className="text-lg font-bold text-ink-800">{reportOnly ? (result.ownerEmail === "SENT" ? "Te hemos enviado el informe" : "No hemos podido enviarte el informe") : "Solicitud recibida"}</p>
        {reportOnly ? (
          <p className="mt-1 text-sm">
            {result.ownerEmail === "SENT"
              ? "Revisa tu bandeja de entrada (y la carpeta de spam). También puedes descargarlo arriba cuando quieras."
              : "Puedes descargarlo arriba ahora mismo. Si el problema continúa, inténtalo más tarde."}
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm font-semibold text-ink-800">Qué pasa ahora:</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
              <li>Revisamos tu estudio y tu solicitud.</li>
              <li>Te contactamos por el medio que has elegido para entender bien tu caso.</li>
              <li>Si lo necesitas y lo autorizas, te ponemos en contacto con un profesional colaborador de tu zona.</li>
            </ol>
            <p className="mt-3 text-sm text-ink-500">
              {result.ownerEmail === "SENT"
                ? "Te hemos enviado un email de confirmación."
                : emailConfigured
                  ? "No hemos podido enviarte el email de confirmación, pero tu solicitud está registrada."
                  : "Tu solicitud está registrada; te contactaremos directamente."}{" "}
              Pedir información es gratis y sin compromiso: puedes cancelar la solicitud en cualquier momento.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
