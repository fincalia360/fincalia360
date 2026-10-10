import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatMadrid } from "@/lib/dates";
import { requireAgency } from "@/services/agency/auth";
import { listInquiries } from "@/services/agency/crm";
import { INQUIRY_STATUSES } from "@/services/listings/catalog";
import { inquiryStatusAction } from "../actions";

export const metadata = { title: "Solicitudes" };

const P = "/zona-inmobiliarias/panel";

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const s = await requireAgency();
  const sp = await searchParams;
  const status = sp.estado && sp.estado in INQUIRY_STATUSES ? sp.estado : undefined;
  const inquiries = await listInquiries(s, status);
  const tabs: [string, string][] = [["", "Todas"], ...Object.entries(INQUIRY_STATUSES)];
  return (
    <>
      <PageHeader title="Solicitudes" description="Peticiones de información y visitas recibidas desde tus anuncios. Cada persona aparece también en Contactos." />
      <nav className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map(([k, label]) => (
          <Link
            key={k}
            href={`${P}/solicitudes${k ? `?estado=${k}` : ""}`}
            className={(status ?? "") === k ? "rounded-full bg-ink-800 px-3 py-1.5 text-[13px] text-white" : "rounded-full bg-white px-3 py-1.5 text-[13px] text-ink-600 ring-1 ring-sand-200 hover:bg-sand-50"}
          >
            {label}
          </Link>
        ))}
      </nav>
      <Card className="overflow-x-auto">
        {inquiries.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-ink-400">No hay solicitudes{status ? " en este estado" : " todavía"}.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Inmueble</th>
                <th>Persona</th>
                <th>Mensaje</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {inquiries.map((i) => (
                <tr key={i.id}>
                  <td className="text-ink-500">{formatMadrid(i.createdAt)}</td>
                  <td>
                    <Link href={`${P}/inmuebles/${i.listing.id}`} className="font-medium text-ink-800 hover:underline">
                      {i.listing.reference}
                    </Link>
                  </td>
                  <td>
                    {i.contact ? (
                      <Link href={`${P}/contactos/${i.contact.id}`} className="font-medium text-ink-800 hover:underline">
                        {i.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-ink-800">{i.name}</span>
                    )}
                    <p className="text-xs text-ink-500">
                      {i.email}
                      {i.phone ? ` · ${i.phone}` : ""}
                    </p>
                  </td>
                  <td className="max-w-xs whitespace-normal text-[13px] text-ink-600">
                    {i.wantsVisit && <Badge tone="terracotta">Quiere visitarlo</Badge>} {i.message}
                  </td>
                  <td>
                    <form action={inquiryStatusAction.bind(null, i.id)} className="flex items-center gap-2">
                      <select name="status" defaultValue={i.status} className="field h-8 py-0 text-[13px]">
                        {Object.entries(INQUIRY_STATUSES).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                      <button className="text-[13px] font-medium text-ink-700 hover:underline">Guardar</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
