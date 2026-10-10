"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

/** Solicitud de información o visita. El consentimiento nunca va marcado de antemano. */
export function InquiryForm({ reference, consentText }: { reference: string; consentText: string }) {
  const openedAt = useRef(Date.now());
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    setState("sending");
    try {
      const res = await fetch(`/api/inmuebles/${reference}/solicitud`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.get("name"),
          email: f.get("email"),
          phone: f.get("phone"),
          message: f.get("message"),
          wantsVisit: f.get("wantsVisit") === "on",
          consent: f.get("consent") === "on",
          website: f.get("website"),
          elapsedMs: Date.now() - openedAt.current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se ha podido enviar la solicitud");
      setState("done");
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-pine-100 bg-pine-50 p-5 text-pine-700" role="status">
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="h-5 w-5" /> Solicitud enviada
        </p>
        <p className="mt-2 text-sm">El anunciante ha recibido tu solicitud y se pondrá en contacto contigo.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <label className="block">
        <span className="field-label">Nombre</span>
        <input name="name" required maxLength={80} autoComplete="name" className="field" />
      </label>
      <label className="block">
        <span className="field-label">Email</span>
        <input name="email" type="email" required maxLength={120} autoComplete="email" className="field" />
      </label>
      <label className="block">
        <span className="field-label">Teléfono <span className="font-normal text-ink-400">(necesario para visitas)</span></span>
        <input name="phone" type="tel" maxLength={30} autoComplete="tel" className="field" />
      </label>
      <label className="block">
        <span className="field-label">Mensaje <span className="font-normal text-ink-400">(opcional)</span></span>
        <textarea name="message" rows={3} maxLength={1500} className="field" placeholder="¿Qué te gustaría saber?" />
      </label>
      {/* Campo trampa antispam: invisible para las personas */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className="flex items-start gap-2.5 text-sm text-ink-700">
        <input type="checkbox" name="wantsVisit" className="mt-0.5 h-4 w-4 rounded border-sand-300" />
        Quiero concertar una visita
      </label>
      <label className="flex items-start gap-2.5 text-[13px] leading-snug text-ink-600">
        <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 shrink-0 rounded border-sand-300" />
        <span>
          {consentText}{" "}
          <a href="/privacy" target="_blank" className="underline">
            Política de privacidad
          </a>
          .
        </span>
      </label>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={state === "sending"} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-terracotta-500 text-[15px] font-medium text-white hover:bg-terracotta-600 disabled:opacity-60">
        {state === "sending" && <Loader2 className="h-4 w-4 animate-spin" />} Solicitar información o visita
      </button>
    </form>
  );
}
