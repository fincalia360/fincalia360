import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { deleteAgencyAction } from "@/app/admin/actions";
import { AgencyForm } from "@/components/admin/AgencyForm";
import { PageHeader } from "@/components/admin/PageHeader";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Badge, STATUS_TONES } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { LOCATION_LABELS, PROPERTY_LABELS, STATUS_LABELS, label } from "@/lib/labels";
import { formatDate, formatEUR } from "@/lib/utils";
import { getAgency } from "@/services/agencyService";

export const metadata = { title: "Inmobiliaria" };

export default async function AgencyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agency = await getAgency(id);
  if (!agency) notFound();

  return (
    <>
      <Link href="/admin/agencies" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Inmobiliarias
      </Link>
      <PageHeader
        title={agency.name}
        description={`${agency._count.leads} leads recibidos · ${agency._count.appointments} citas`}
        actions={
          <form action={deleteAgencyAction.bind(null, agency.id)}>
            <SubmitButton variant="danger" size="sm">
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </SubmitButton>
          </form>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title="Datos" />
          <CardBody className="p-6">
            <AgencyForm
              agency={{
                id: agency.id,
                name: agency.name,
                zones: agency.zones,
                email: agency.email,
                phone: agency.phone,
                languages: agency.languages,
                propertyTypes: agency.propertyTypes,
                status: agency.status,
                monthlyFee: agency.monthlyFee,
                pricePerAppointment: agency.pricePerAppointment,
              }}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Leads recibidos" description="Últimos 20" />
          <ul className="divide-y divide-sand-100">
            {agency.leads.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <Link href={`/admin/leads/${l.id}`} className="font-medium text-ink-800 hover:underline">
                    {l.name}
                  </Link>
                  <p className="truncate text-[12.5px] text-ink-400">
                    {label(PROPERTY_LABELS, l.property?.type)} · {label(LOCATION_LABELS, l.property?.location)} · {formatEUR(l.estimatedValue)} · {formatDate(l.createdAt)}
                  </p>
                </div>
                <Badge tone={STATUS_TONES[l.status]}>{label(STATUS_LABELS, l.status)}</Badge>
              </li>
            ))}
            {agency.leads.length === 0 && <li className="px-5 py-6 text-sm text-ink-400">Todavía no ha recibido leads.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
