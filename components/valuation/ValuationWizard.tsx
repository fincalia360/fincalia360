"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getSessionId, track } from "@/lib/analytics-client";
import type { Dictionary } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { LANGUAGE_NAMES } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  CONDITIONS,
  CONTACT_CHANNELS,
  LANGUAGES,
  LOCATIONS,
  PROPERTY_TYPES,
  SITUATIONS,
  TIMELINES,
  type Condition,
  type ContactChannel,
  type Language,
  type Location,
  type PropertyType,
  type Situation,
  type Timeline,
} from "@/types";

interface FormState {
  location?: Location;
  locationOther: string;
  type?: PropertyType;
  timeline?: Timeline;
  situation?: Situation;
  sqm: string;
  bedrooms: string;
  bathrooms: string;
  terrace: boolean;
  pool: boolean;
  parking: boolean;
  condition: Condition;
  name: string;
  email: string;
  phone: string;
  language: Language;
  preferredContact: ContactChannel;
  consentContact: boolean;
  consentMarketing: boolean;
}

const TOTAL = 6;

function OptionGrid<T extends string>({
  options,
  labels,
  value,
  onSelect,
  columns = "sm:grid-cols-2",
}: {
  options: readonly T[];
  labels: Record<T, string>;
  value?: T;
  onSelect: (v: T) => void;
  columns?: string;
}) {
  return (
    <div className={cn("grid gap-2.5", columns)}>
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(opt)}
            aria-pressed={selected}
            className={cn(
              "flex min-h-[54px] items-center justify-between rounded-xl border px-4 py-3 text-left text-[15px] transition",
              selected
                ? "border-ink-800 bg-ink-800 text-white shadow-sm"
                : "border-sand-300 bg-white text-ink-700 hover:border-ink-300 hover:bg-sand-50",
            )}
          >
            <span>{labels[opt]}</span>
            {selected && <Check className="h-4 w-4 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
        checked ? "border-ink-800 bg-ink-800 text-white" : "border-sand-300 bg-white text-ink-600 hover:border-ink-300",
      )}
    >
      {checked && <Check className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

export function ValuationWizard({ dict, lang, initialLocation }: { dict: Dictionary; lang: Language; initialLocation?: Location }) {
  const router = useRouter();
  const f = dict.form;
  const o = dict.options;
  const [step, setStep] = useState(initialLocation ? 1 : 0);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<FormState>({
    location: initialLocation,
    locationOther: "",
    sqm: "",
    bedrooms: "",
    bathrooms: "",
    terrace: false,
    pool: false,
    parking: false,
    condition: "GOOD",
    name: "",
    email: "",
    phone: "",
    language: lang,
    preferredContact: "PHONE",
    consentContact: false,
    consentMarketing: false,
  });
  const topRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    track("valuation_started", { lang, initialLocation });
  }, [lang, initialLocation]);

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const choose = <K extends "location" | "type" | "timeline" | "situation">(key: K, value: FormState[K]) => {
    update(key, value);
    if (key === "location" && value === "OTHER") return; // necesita escribir la localidad
    setTimeout(() => setStep((s) => Math.min(s + 1, TOTAL - 1)), 180);
  };

  const canContinue = (() => {
    switch (step) {
      case 0:
        return Boolean(form.location) && (form.location !== "OTHER" || form.locationOther.trim().length > 1);
      case 1:
        return Boolean(form.type);
      case 2:
        return Boolean(form.timeline);
      case 3:
        return Boolean(form.situation);
      default:
        return true;
    }
  })();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = f.errors.required;
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = f.errors.email;
    if (!form.consentContact) next.consentContact = f.errors.consent;
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          locationOther: form.locationOther || undefined,
          sqm: form.sqm || undefined,
          bedrooms: form.bedrooms || undefined,
          bathrooms: form.bathrooms || undefined,
          sessionId: getSessionId(),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { id: string };
      router.push(`/valorar/resultado/${data.id}?lang=${form.language}`);
    } catch {
      setErrors({ form: f.errors.generic });
      setSubmitting(false);
    }
  }

  const titles = [f.steps.location, f.steps.type, f.steps.timeline, f.steps.situation, f.steps.details, f.steps.contact];

  return (
    <div ref={topRef} className="scroll-mt-24">
      {/* Progreso */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.16em] text-ink-400">
          <span>{t(f.stepOf, { current: step + 1, total: TOTAL })}</span>
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="inline-flex items-center gap-1 normal-case tracking-normal text-ink-500 hover:text-ink-800">
              <ArrowLeft className="h-3.5 w-3.5" />
              {f.back}
            </button>
          )}
        </div>
        <div className="mt-3 grid grid-cols-6 gap-1.5">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <span key={i} className={cn("h-1 rounded-full transition-colors", i <= step ? "bg-terracotta-500" : "bg-sand-200")} />
          ))}
        </div>
      </div>

      <h1 className="font-serif text-[32px] font-medium leading-tight text-ink-800 sm:text-4xl">{titles[step]}</h1>

      <form onSubmit={submit} className="mt-7" noValidate>
        {step === 0 && (
          <div className="space-y-4">
            <OptionGrid options={LOCATIONS} labels={o.location} value={form.location} onSelect={(v) => choose("location", v)} />
            {form.location === "OTHER" && (
              <input
                autoFocus
                className="field"
                placeholder={f.otherLocation}
                aria-label={f.otherLocation}
                value={form.locationOther}
                onChange={(e) => update("locationOther", e.target.value)}
              />
            )}
          </div>
        )}
        {step === 1 && <OptionGrid options={PROPERTY_TYPES} labels={o.propertyType} value={form.type} onSelect={(v) => choose("type", v)} />}
        {step === 2 && <OptionGrid options={TIMELINES} labels={o.timeline} value={form.timeline} onSelect={(v) => choose("timeline", v)} />}
        {step === 3 && <OptionGrid options={SITUATIONS} labels={o.situation} value={form.situation} onSelect={(v) => choose("situation", v)} />}

        {step === 4 && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ["sqm", f.sqm, 10, 5000],
                  ["bedrooms", f.bedrooms, 0, 20],
                  ["bathrooms", f.bathrooms, 0, 20],
                ] as const
              ).map(([key, label, min, max]) => (
                <div key={key}>
                  <label htmlFor={key} className="field-label truncate">
                    {label}
                  </label>
                  <input
                    id={key}
                    inputMode="numeric"
                    type="number"
                    min={min}
                    max={max}
                    className="field"
                    value={form[key]}
                    onChange={(e) => update(key, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <div>
              <p className="field-label">{f.features}</p>
              <div className="flex flex-wrap gap-2">
                <Toggle label={f.terrace} checked={form.terrace} onChange={(v) => update("terrace", v)} />
                <Toggle label={f.pool} checked={form.pool} onChange={(v) => update("pool", v)} />
                <Toggle label={f.parking} checked={form.parking} onChange={(v) => update("parking", v)} />
              </div>
            </div>
            <div>
              <p className="field-label">{f.condition}</p>
              <div className="flex flex-wrap gap-2">
                {CONDITIONS.map((c) => (
                  <Toggle key={c} label={o.condition[c]} checked={form.condition === c} onChange={() => update("condition", c)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="name" className="field-label">{f.name}</label>
                <input id="name" autoComplete="name" className="field" value={form.name} onChange={(e) => update("name", e.target.value)} />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="email" className="field-label">{f.email}</label>
                <input id="email" type="email" autoComplete="email" className="field" value={form.email} onChange={(e) => update("email", e.target.value)} />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>
              <div>
                <label htmlFor="phone" className="field-label">{f.phone}</label>
                <input id="phone" type="tel" autoComplete="tel" className="field" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
                <p className="mt-1 text-xs text-ink-400">{f.phoneHint}</p>
              </div>
              <div>
                <label htmlFor="language" className="field-label">{f.language}</label>
                <select id="language" className="field" value={form.language} onChange={(e) => update("language", e.target.value as Language)}>
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>{LANGUAGE_NAMES[l]}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="field-label">{f.preferredContact}</p>
                <div className="flex flex-wrap gap-2">
                  {CONTACT_CHANNELS.map((c) => (
                    <Toggle key={c} label={o.contact[c]} checked={form.preferredContact === c} onChange={() => update("preferredContact", c)} />
                  ))}
                </div>
              </div>
            </div>

            <fieldset className="space-y-3 rounded-xl border border-sand-200 bg-sand-50 p-4">
              <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-ink-700">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-sand-300 accent-ink-800"
                  checked={form.consentContact}
                  onChange={(e) => update("consentContact", e.target.checked)}
                />
                <span>{f.consentContact}</span>
              </label>
              {errors.consentContact && <p className="pl-8 text-sm text-red-600">{errors.consentContact}</p>}
              <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-ink-700">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-sand-300 accent-ink-800"
                  checked={form.consentMarketing}
                  onChange={(e) => update("consentMarketing", e.target.checked)}
                />
                <span>{f.consentMarketing}</span>
              </label>
              <p className="pl-8 text-xs text-ink-400">
                {f.privacyNote}{" "}
                <Link href={`/privacy?lang=${lang}`} target="_blank" className="underline underline-offset-2 hover:text-ink-700">
                  {f.privacyLink}
                </Link>
                .
              </p>
            </fieldset>
            {errors.form && <p className="text-sm text-red-600">{errors.form}</p>}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-sand-200 pt-6">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="h-4 w-4" />
              {f.back}
            </Button>
          ) : (
            <span />
          )}
          {step < TOTAL - 1 ? (
            <Button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canContinue} size="lg">
              {f.next}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" variant="accent" size="lg" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? f.submitting : f.submit}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
