"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck, Loader2, MessageCircle, Phone, BookOpen } from "lucide-react";
import { SlotPicker } from "@/components/booking/SlotPicker";
import { buttonClasses } from "@/components/ui/Button";
import { track } from "@/lib/analytics-client";
import { LOCALES, t, type Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Language, Slot } from "@/types";

type Mode = "idle" | "contact" | "informed" | "slots" | "booked";

export function ResultActions({
  leadId,
  lang,
  dict,
  existingAppointment,
}: {
  leadId: string;
  lang: Language;
  dict: Dictionary;
  existingAppointment?: { iso: string; agency: string | null } | null;
}) {
  const r = dict.result;
  const [mode, setMode] = useState<Mode>(existingAppointment ? "booked" : "idle");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState(existingAppointment ?? null);
  const locale = LOCALES[lang];

  async function preference(choice: "CONTACT_ME" | "KEEP_INFORMED") {
    setBusy(true);
    await fetch(`/api/leads/${leadId}/preference`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choice }),
    }).catch(() => {});
    setBusy(false);
    setMode(choice === "CONTACT_ME" ? "contact" : "informed");
  }

  async function openSlots() {
    setMode("slots");
    track("appointment_started", { from: "result" }, leadId);
    const res = await fetch("/api/slots").then((x) => x.json()).catch(() => ({ slots: [] }));
    setSlots(res.slots);
  }

  async function book(slot: Slot) {
    setBusy(true);
    const res = await fetch(`/api/leads/${leadId}/appointment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot: slot.iso, source: "WEB_FORM" }),
    });
    setBusy(false);
    if (res.ok) {
      const data = (await res.json()) as { agencyName: string | null };
      setBooked({ iso: slot.iso, agency: data.agencyName });
      setMode("booked");
    }
  }

  const choice = (active: boolean) =>
    cn(
      "flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-[15px] font-medium transition",
      active ? "border-ink-800 bg-ink-800 text-white" : "border-sand-300 bg-white text-ink-800 hover:border-ink-300 hover:bg-sand-50",
    );

  if (mode === "booked" && booked) {
    const date = new Date(booked.iso);
    return (
      <div className="rounded-2xl border border-pine-100 bg-pine-50 p-5">
        <div className="flex items-start gap-3">
          <CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-pine-600" />
          <div>
            <p className="font-medium text-ink-800">
              {t(r.booked, {
                date: date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" }),
                time: date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
              })}
            </p>
            {booked.agency && <p className="mt-1 text-sm text-ink-500">{t(r.bookedDetail, { agency: booked.agency })}</p>}
          </div>
        </div>
        <Link href={`/agent/${leadId}`} className={buttonClasses({ variant: "outline", size: "md", className: "mt-4 w-full sm:w-auto" })}>
          <MessageCircle className="h-4 w-4" />
          {r.chat}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button type="button" className={choice(mode === "contact")} onClick={() => preference("CONTACT_ME")} disabled={busy}>
        <Phone className="h-4 w-4 shrink-0" />
        {r.contactMe}
      </button>
      <button type="button" className={choice(mode === "slots")} onClick={openSlots} disabled={busy}>
        <CalendarCheck className="h-4 w-4 shrink-0" />
        {r.bookCall}
      </button>
      <button type="button" className={choice(mode === "informed")} onClick={() => preference("KEEP_INFORMED")} disabled={busy}>
        <BookOpen className="h-4 w-4 shrink-0" />
        {r.keepInformed}
      </button>

      {mode === "slots" && (
        <div className="rounded-2xl border border-sand-200 bg-sand-50 p-5">
          <p className="mb-4 font-medium text-ink-800">{r.slotsTitle}</p>
          {!slots ? (
            <Loader2 className="h-5 w-5 animate-spin text-ink-400" />
          ) : (
            <SlotPicker slots={slots} labels={{ today: r.today, tomorrow: r.tomorrow }} locale={locale} onSelect={book} disabled={busy} />
          )}
          {busy && <p className="mt-3 text-sm text-ink-400">{r.booking}</p>}
        </div>
      )}

      {(mode === "contact" || mode === "informed") && (
        <div className="rounded-2xl border border-sand-200 bg-sand-50 p-5">
          <p className="text-ink-700">{mode === "contact" ? r.contactConfirmed : r.informedConfirmed}</p>
          <Link href={`/agent/${leadId}`} className={buttonClasses({ variant: "outline", size: "md", className: "mt-4" })}>
            <MessageCircle className="h-4 w-4" />
            {r.chat}
          </Link>
        </div>
      )}
    </div>
  );
}
