"use client";
// Formulario de contacto. El consentimiento nunca va marcado de antemano.
import { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { PortalDict } from "@/lib/i18n/portal/es";

export function ContactForm({ t, lang }: { t: PortalDict["contact"]; lang: string }) {
  const openedAt = useRef(Date.now());
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    setState("sending");
    try {
      const res = await fetch("/api/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.get("name"),
          email: f.get("email"),
          phone: f.get("phone"),
          subject: f.get("subject"),
          message: f.get("message"),
          privacy: f.get("privacy") === "on",
          website: f.get("website"),
          elapsedMs: Date.now() - openedAt.current,
          lang,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t.error);
      setState("done");
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-pine-100 bg-white p-8 text-center" role="status">
        <CheckCircle2 className="mx-auto h-10 w-10 text-pine-600" />
        <h2 className="mt-4 text-xl font-semibold text-ink-800">{t.sentTitle}</h2>
        <p className="mt-2 text-ink-500">{t.sentText}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">{t.name}</span>
          <input name="name" required maxLength={100} autoComplete="name" className="field" />
        </label>
        <label className="block">
          <span className="field-label">
            {t.phone} <span className="font-normal text-ink-400">{t.optional}</span>
          </span>
          <input name="phone" type="tel" maxLength={20} autoComplete="tel" className="field" />
        </label>
        <label className="block sm:col-span-2">
          <span className="field-label">{t.email}</span>
          <input name="email" type="email" required maxLength={150} autoComplete="email" className="field" />
        </label>
        <label className="block sm:col-span-2">
          <span className="field-label">
            {t.subject} <span className="font-normal text-ink-400">{t.optional}</span>
          </span>
          <input name="subject" maxLength={120} className="field" />
        </label>
        <label className="block sm:col-span-2">
          <span className="field-label">{t.message}</span>
          <textarea name="message" required minLength={10} maxLength={4000} rows={6} className="field" />
        </label>
      </div>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className="flex items-start gap-2.5 text-[13.5px] text-ink-700">
        <input type="checkbox" name="privacy" required className="mt-0.5 h-4 w-4 shrink-0 rounded border-sand-300" />
        <span>
          {t.consent}{" "}
          <Link href="/privacy" target="_blank" className="underline">
            {t.privacyLink}
          </Link>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={state === "sending"} className="inline-flex h-11 items-center gap-2 rounded-full bg-terracotta-500 px-6 font-semibold text-white hover:bg-terracotta-600 disabled:opacity-60">
          {state === "sending" && <Loader2 className="h-4 w-4 animate-spin" />} {t.submit}
        </button>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
