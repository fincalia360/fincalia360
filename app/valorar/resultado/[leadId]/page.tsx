import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ExternalLink, MessageCircle } from "lucide-react";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { Badge, DemoBadge, TIER_TONES } from "@/components/ui/Badge";
import { ResultActions } from "@/components/valuation/ResultActions";
import { formatEstimate, getDictionary, resolveLanguage, t } from "@/lib/i18n";
import { TIER_LABELS, label } from "@/lib/labels";
import { parseJSON } from "@/lib/utils";
import { getPublicResult } from "@/services/leadService";
import type { Location, PropertyType, ScoreItem } from "@/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ leadId: string }>; searchParams: Promise<{ lang?: string }> };

export default async function ResultPage({ params, searchParams }: Props) {
  const { leadId } = await params;
  const lead = await getPublicResult(leadId);
  if (!lead || !lead.property) notFound();

  const lang = resolveLanguage((await searchParams).lang, lead.language);
  const dict = getDictionary(lang);
  const r = dict.result;
  const breakdown = parseJSON<ScoreItem[]>(lead.scoreBreakdown, []);
  const appointment = lead.appointments[0];

  return (
    <div lang={lang} className="min-h-screen">
      <SiteHeader dict={dict} lang={lang} basePath={`/valorar/resultado/${lead.id}`} showNav={false} />
      <main className="container-page py-8 sm:py-14">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.15fr_1fr]">
          <section className="rounded-3xl border border-sand-200 bg-white p-6 shadow-soft sm:p-10">
            <p className="flex items-center gap-2 text-sm font-medium text-pine-600">
              <CheckCircle2 className="h-4 w-4" />
              {r.thanks}
            </p>
            <p className="eyebrow mt-8">{r.estimate}</p>
            <p className="mt-3 font-serif text-[40px] font-medium leading-none tracking-tight text-ink-800 sm:text-6xl">
              {formatEstimate(lead.estimatedValueMin ?? 0, lang)}
              <span className="mx-2 text-ink-300">–</span>
              <br className="sm:hidden" />
              {formatEstimate(lead.estimatedValueMax ?? 0, lang)}
            </p>
            <p className="mt-4 text-sm text-ink-500">
              {t(r.basis, {
                type: dict.options.propertyType[lead.property.type as PropertyType],
                location: dict.options.location[lead.property.location as Location],
                sqm: lead.property.sqm ?? "—",
              })}
            </p>
            <p className="mt-6 rounded-xl bg-sand-50 px-4 py-3 text-sm leading-relaxed text-ink-500">{r.disclaimer}</p>
          </section>

          <section className="rounded-3xl border border-sand-200 bg-white p-6 shadow-soft sm:p-8">
            <h2 className="font-serif text-3xl font-medium text-ink-800">{r.talkTitle}</h2>
            <p className="mt-2 text-ink-500">{r.talkText}</p>
            <div className="mt-6">
              <ResultActions
                leadId={lead.id}
                lang={lang}
                dict={dict}
                existingAppointment={appointment ? { iso: appointment.scheduledAt.toISOString(), agency: lead.agency?.name ?? null } : null}
              />
            </div>
          </section>

          {/* Panel interno solo para presentar la demo */}
          <aside className="rounded-2xl border border-dashed border-terracotta-400/60 bg-terracotta-50/40 p-5 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <DemoBadge>Vista interna · solo demo</DemoBadge>
                <span className="text-sm text-ink-500">El propietario no ve este panel en producción.</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/agent/${lead.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-ink-800 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-ink-700">
                  <MessageCircle className="h-3.5 w-3.5" /> Conversación con agente
                </Link>
                <Link href={`/admin/leads/${lead.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-sand-300 bg-white px-3 py-1.5 text-[13px] font-medium text-ink-700 hover:bg-sand-50">
                  <ExternalLink className="h-3.5 w-3.5" /> Ver en CRM
                </Link>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="font-serif text-4xl text-ink-800">{lead.score}</span>
              <Badge tone={TIER_TONES[lead.scoreTier]}>{label(TIER_LABELS, lead.scoreTier)}</Badge>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-500">
                {breakdown.map((item) => (
                  <li key={item.label}>
                    {item.label} <span className="font-semibold text-ink-700">+{item.points}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
