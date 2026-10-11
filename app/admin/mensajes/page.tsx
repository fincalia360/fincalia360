import Link from "next/link";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PageHeader } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { CONTACT_STATUSES, deleteContactMessage, listContactMessages, setContactStatus } from "@/services/contactMessages";

export const metadata = { title: "Mensajes de contacto" };
export const dynamic = "force-dynamic";

async function statusAction(id: string, formData: FormData) {
  "use server";
  const user = await requireAdmin();
  await setContactStatus(user.id, id, z.enum(["NEW", "HANDLED", "DISCARDED"]).parse(formData.get("status")));
  revalidatePath("/admin/mensajes");
}

async function deleteAction(id: string) {
  "use server";
  const user = await requireAdmin();
  await deleteContactMessage(user.id, id);
  revalidatePath("/admin/mensajes");
}

export default async function ContactMessagesPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  await requireAdmin();
  const estado = (await searchParams).estado;
  const messages = await listContactMessages(estado && estado in CONTACT_STATUSES ? estado : undefined);
  return (
    <>
      <PageHeader title="Mensajes de contacto" description="Mensajes enviados desde la página Contacto de la web." />
      <nav className="mb-4 flex flex-wrap gap-1.5">
        {[["", "Todos"], ...Object.entries(CONTACT_STATUSES)].map(([k, label]) => (
          <Link
            key={k}
            href={`/admin/mensajes${k ? `?estado=${k}` : ""}`}
            className={(estado ?? "") === k ? "rounded-full bg-ink-800 px-3 py-1.5 text-[13px] text-white" : "rounded-full bg-white px-3 py-1.5 text-[13px] text-ink-600 ring-1 ring-sand-200 hover:bg-sand-50"}
          >
            {label}
          </Link>
        ))}
      </nav>
      {messages.length === 0 ? (
        <Card>
          <p className="px-5 py-12 text-center text-sm text-ink-400">No hay mensajes{estado ? " en este estado" : " todavía"}.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <Card key={m.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink-800">
                    {m.name} {m.subject && <span className="font-normal text-ink-500">· {m.subject}</span>}
                  </p>
                  <p className="text-sm text-ink-500">
                    <a href={`mailto:${m.email}`} className="underline">
                      {m.email}
                    </a>
                    {m.phone ? (
                      <>
                        {" · "}
                        <a href={`tel:${m.phone}`} className="underline">
                          {m.phone}
                        </a>
                      </>
                    ) : null}{" "}
                    · {formatDateTime(m.createdAt)}
                  </p>
                </div>
                <Badge tone={m.status === "NEW" ? "blue" : m.status === "HANDLED" ? "green" : "neutral"}>{CONTACT_STATUSES[m.status as keyof typeof CONTACT_STATUSES]}</Badge>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-700">{m.message}</p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <form action={statusAction.bind(null, m.id)} className="flex items-center gap-2">
                  <select name="status" defaultValue={m.status} className="field h-8 py-0 text-[13px]">
                    {Object.entries(CONTACT_STATUSES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <button className="text-[13px] font-medium text-ink-700 hover:underline">Guardar</button>
                </form>
                <form action={deleteAction.bind(null, m.id)}>
                  <button className="text-[13px] text-red-600 hover:underline">Eliminar</button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
