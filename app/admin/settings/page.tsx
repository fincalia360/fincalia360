import { demoToolsEnabled } from "@/lib/demo";
import { RefreshCcw } from "lucide-react";
import { resetDemoDataAction } from "@/app/admin/actions";
import { PageHeader } from "@/components/admin/PageHeader";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PROPERTY_LABELS, SITUATION_LABELS, TIMELINE_LABELS } from "@/lib/labels";
import { CONSENT_VERSION } from "@/services/leadService";
import {
  APPOINTMENT_INTEREST_POINTS,
  CONTACT_POINTS,
  PROPERTY_POINTS,
  SITUATION_POINTS,
  TIER_THRESHOLDS,
  TIMELINE_POINTS,
  VALUE_BANDS,
} from "@/services/scoringService";
import { getSettings } from "@/services/settingsService";
import type { PropertyType, Situation, Timeline } from "@/types";

export const metadata = { title: "Configuración" };

function RuleList({ title, items }: { title: string; items: Array<[string, number]> }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">{title}</p>
      <ul className="space-y-1 text-sm">
        {items.map(([name, pts]) => (
          <li key={name} className="flex justify-between gap-3">
            <span className="text-ink-600">{name}</span>
            <span className="font-semibold tabular-nums">+{pts}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function SettingsPage() {
  const settings = await getSettings();
  const integrations: Array<[string, string, boolean]> = [
    ["Agente conversacional (AI_PROVIDER)", process.env.AI_PROVIDER ?? "demo", false],
    ["Notificaciones (NOTIFICATION_PROVIDER)", process.env.NOTIFICATION_PROVIDER ?? "demo", false],
    ["WhatsApp Business API", "demo (simulado)", false],
    ["Calendario", "demo (horarios ficticios)", false],
    ["Google Ads / Meta Ads", "no conectado (simulación)", false],
    ["Autenticación /admin", process.env.ADMIN_PASSWORD ? "login con contraseña activo" : "sin contraseña (solo desarrollo)", Boolean(process.env.ADMIN_PASSWORD)],
  ];

  return (
    <>
      <PageHeader title="Configuración" description="Hipótesis de negocio, reglas de scoring, integraciones y datos demo." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Hipótesis de negocio" description="Valores de partida a validar con el piloto (no son resultados)" />
          <CardBody>
            <SettingsForm settings={settings} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Reglas de scoring" description="services/scoringService.ts" />
          <CardBody className="grid gap-6 sm:grid-cols-2">
            <RuleList title="Intención (plazo)" items={Object.entries(TIMELINE_POINTS).map(([k, v]) => [TIMELINE_LABELS[k as Timeline], v])} />
            <RuleList title="Valor estimado" items={VALUE_BANDS.map((b) => [b.label, b.points])} />
            <RuleList title="Propiedad" items={Object.entries(PROPERTY_POINTS).map(([k, v]) => [PROPERTY_LABELS[k as PropertyType], v ?? 0])} />
            <RuleList title="Situación" items={Object.entries(SITUATION_POINTS).map(([k, v]) => [SITUATION_LABELS[k as Situation], v ?? 0])} />
            <RuleList
              title="Contacto e interés"
              items={[
                ["Teléfono", CONTACT_POINTS.phone],
                ["Email", CONTACT_POINTS.email],
                ["Quiere hablar con especialista", APPOINTMENT_INTEREST_POINTS],
              ]}
            />
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">Clasificación</p>
              <ul className="space-y-1 text-sm">
                {TIER_THRESHOLDS.slice()
                  .reverse()
                  .map((t, i, arr) => (
                    <li key={t.tier} className="flex justify-between">
                      <span className="text-ink-600">{t.tier}</span>
                      <span className="tabular-nums">
                        {t.min}
                        {arr[i + 1] ? `–${arr[i + 1].min - 1}` : "+"}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Integraciones" description="Adapters preparados, ver docs/integrations.md" />
          <CardBody>
            <ul className="divide-y divide-sand-100 text-sm">
              {integrations.map(([name, value, on]) => (
                <li key={name} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-ink-700">{name}</span>
                  <Badge tone={on ? "green" : "neutral"}>{value}</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-400">Versión de consentimiento vigente: {CONSENT_VERSION}</p>
          </CardBody>
        </Card>

        {demoToolsEnabled() && (
        <Card>
          <CardHeader title="Datos demo" description="Borra todo y vuelve a cargar el seed (14 leads, 4 inmobiliarias, citas, conversaciones, campañas)" />
          <CardBody>
            <form action={resetDemoDataAction}>
              <SubmitButton variant="danger" pendingLabel="Restableciendo…">
                <RefreshCcw className="h-4 w-4" /> Restablecer datos demo
              </SubmitButton>
            </form>
            <p className="mt-3 text-xs text-ink-400">Equivale a `npm run db:reset`. Solo disponible en local: en la web publicada está desactivado.</p>
          </CardBody>
        </Card>
        )}
      </div>
    </>
  );
}
