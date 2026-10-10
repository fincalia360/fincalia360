import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Lock } from "lucide-react";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { StudyResults } from "@/components/study/StudyResults";
import { buttonClasses } from "@/components/ui/Button";
import { getDictionary } from "@/lib/i18n";
import { buildDefaultAssumptions, hintsFromSnapshot } from "@/services/study/assumptions";
import { cookieName } from "@/services/study/access";
import { getCcaa, getProvince } from "@/services/study/geo";
import { getServices, priceText } from "@/services/crm/catalog";
import { emailConfig } from "@/services/email/emailService";
import { claudeConfigured } from "@/services/ai/claudeClient";
import { chatDemoEnabled } from "@/services/study/chatDemo";
import { getStudyForOwner } from "@/services/study/studyService";
import { PROPERTY_KIND_LABELS } from "@/services/study/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tu estudio: vender o alquilar", robots: { index: false, follow: false } };

export default async function StudyResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get(cookieName(id))?.value;
  const study = await getStudyForOwner(id, token);
  const dict = getDictionary("es");

  return (
    <div lang="es">
      <SiteHeader dict={dict} lang="es" basePath="/" />
      <main className="container-page py-8 sm:py-12">
        {!study ? (
          <div className="mx-auto max-w-xl rounded-3xl border border-sand-200 bg-white p-8 text-center shadow-soft">
            <Lock className="mx-auto h-8 w-8 text-ink-400" />
            <h1 className="mt-4 font-serif text-3xl text-ink-800">Este estudio es privado</h1>
            <p className="mt-2 text-ink-500">
              Solo puede verse desde el navegador en el que se creó. Por privacidad, no mostramos datos de la vivienda ni financieros a quien solo conoce el enlace.
            </p>
            <Link href="/estudio" className={buttonClasses({ variant: "accent", size: "lg", className: "mt-6" })}>
              Hacer un estudio nuevo
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <p className="eyebrow">Tu estudio gratuito</p>
              <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight text-ink-800 sm:text-5xl">¿Te interesa más vender o alquilar tu vivienda?</h1>
              <p className="mt-3 text-ink-500">
                {PROPERTY_KIND_LABELS[study.input.property.kind]} de {study.input.property.sqm} m² en {study.input.location.municipalityName} (
                {getProvince(study.input.location.provinceCode)?.name}) · CP {study.input.location.postalCode} · generado el{" "}
                {new Date(study.snapshot.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <StudyResults
              studyId={id}
              input={study.input}
              snapshot={study.snapshot}
              initialAssumptions={study.assumptions}
              defaultAssumptions={buildDefaultAssumptions(study.input, hintsFromSnapshot(study.snapshot)).values}
              meta={buildDefaultAssumptions(study.input, hintsFromSnapshot(study.snapshot)).meta}
              services={(await getServices({ onlyActive: true })).map((sv) => ({ code: sv.code, name: sv.name, summary: sv.summary, scope: sv.scope, price: priceText(sv) }))}
              emailConfigured={emailConfig().configured}
              chatEnabled={claudeConfigured() || chatDemoEnabled()}
              chatDemo={chatDemoEnabled()}
              ccaaName={getCcaa(study.input.location.ccaaCode)?.name ?? ""}
            />
          </>
        )}
      </main>
      <SiteFooter dict={dict} lang="es" />
    </div>
  );
}
