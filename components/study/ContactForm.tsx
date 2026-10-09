"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup, Field } from "./fields";

export function ContactForm({ studyId, alreadyRequested }: { studyId: string; alreadyRequested: boolean }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", preferredContact: "EMAIL" as "PHONE" | "WHATSAPP" | "EMAIL", comments: "", consentContact: false, consentMarketing: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(alreadyRequested ? "done" : "idle");

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 2) errs.name = "Indica tu nombre";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errs.email = "Email no válido";
    if ((form.preferredContact === "PHONE" || form.preferredContact === "WHATSAPP") && !form.phone.trim()) errs.phone = "Necesitamos un teléfono para este medio de contacto";
    if (!form.consentContact) errs.consentContact = "Necesitamos tu consentimiento para contactarte sobre la valoración";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setStatus("sending");
    const res = await fetch(`/api/estudio/${studyId}/contacto`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).catch(() => null);
    setStatus(res?.ok ? "done" : "error");
  }

  if (status === "done") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-pine-100 bg-pine-50 p-5 text-pine-600">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium">Solicitud recibida.</p>
          <p className="mt-1 text-sm">Un especialista revisará tu estudio y te contactará para concertar la valoración profesional. Es gratuita y sin compromiso.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="c-name" error={errors.name}>
          <input id="c-name" className="field" autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Correo electrónico" htmlFor="c-email" error={errors.email}>
          <input id="c-email" type="email" className="field" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Teléfono" htmlFor="c-phone" optional={form.preferredContact === "EMAIL"} error={errors.phone}>
          <input id="c-phone" type="tel" className="field" autoComplete="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Medio de contacto preferido">
          <ChoiceGroup
            name="Medio de contacto"
            columns="grid-cols-3"
            options={[
              { value: "EMAIL", label: "Email" },
              { value: "PHONE", label: "Teléfono" },
              { value: "WHATSAPP", label: "WhatsApp" },
            ]}
            value={form.preferredContact}
            onChange={(v) => set("preferredContact", v)}
          />
        </Field>
        <Field label="Comentarios" htmlFor="c-comments" optional className="sm:col-span-2">
          <textarea id="c-comments" rows={3} className="field" value={form.comments} onChange={(e) => set("comments", e.target.value)} />
        </Field>
      </div>

      <div className="rounded-xl border border-sand-200 bg-sand-50 p-4 text-sm">
        <p className="text-xs leading-relaxed text-ink-500">
          <strong className="text-ink-700">Qué guardamos y para qué:</strong> tu nombre, email, teléfono (si lo indicas), medio preferido y comentarios, junto con los datos de la
          vivienda y los resultados de este estudio, para gestionar tu solicitud de valoración. Si lo aceptas, una inmobiliaria colaboradora de la zona podrá contactarte para
          realizarla. Puedes retirar el consentimiento cuando quieras. Más información en la{" "}
          <Link href="/privacy" target="_blank" className="underline">
            política de privacidad
          </Link>
          .
        </p>
        <label className="mt-3 flex cursor-pointer gap-3 text-ink-700">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-ink-800" checked={form.consentContact} onChange={(e) => set("consentContact", e.target.checked)} />
          <span>Acepto que Tramontana y, en su caso, una inmobiliaria colaboradora de la zona me contacten para realizar la valoración profesional que solicito. (Necesario para atender la solicitud)</span>
        </label>
        {errors.consentContact && <p className="mt-1 pl-8 text-xs text-red-600">{errors.consentContact}</p>}
        <label className="mt-2 flex cursor-pointer gap-3 text-ink-700">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-ink-800" checked={form.consentMarketing} onChange={(e) => set("consentMarketing", e.target.checked)} />
          <span>Quiero recibir ocasionalmente información comercial y del mercado inmobiliario. (Opcional, no es necesario para el estudio ni para la valoración)</span>
        </label>
      </div>
      {status === "error" && <p className="text-sm text-red-600">No hemos podido enviar tu solicitud. Inténtalo de nuevo.</p>}
      <Button type="submit" variant="accent" size="lg" disabled={status === "sending"} className="w-full sm:w-auto">
        {status === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
        Solicitar valoración profesional
      </Button>
    </form>
  );
}
