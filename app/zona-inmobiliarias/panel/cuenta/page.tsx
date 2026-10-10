import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm } from "@/components/admin/crm/CrmForms";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { prisma } from "@/db/client";
import { requireAgency } from "@/services/agency/auth";
import { changePasswordAction } from "../actions";

export const metadata = { title: "Mi cuenta" };

export default async function AccountPage() {
  const s = await requireAgency();
  const [team, agency] = await Promise.all([
    prisma.agencyUser.findMany({ where: { agencyId: s.agencyId }, select: { id: true, name: true, email: true, role: true, status: true }, orderBy: { createdAt: "asc" } }),
    prisma.agency.findUniqueOrThrow({ where: { id: s.agencyId }, select: { maxListings: true, maxUsers: true } }),
  ]);
  return (
    <>
      <PageHeader title="Mi cuenta" description={`${s.userName} · ${s.email}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Cambiar la contraseña" description="Al cambiarla se cierran todas tus sesiones y vuelves a entrar." />
          <CardBody>
            <ActionForm action={changePasswordAction} submitLabel="Cambiar contraseña">
              <input name="current" type="password" required autoComplete="current-password" placeholder="Contraseña actual" className="field" />
              <input name="next" type="password" required minLength={10} autoComplete="new-password" placeholder="Contraseña nueva (mín. 10, letras y números)" className="field" />
              <input name="confirm" type="password" required minLength={10} autoComplete="new-password" placeholder="Repite la contraseña nueva" className="field" />
            </ActionForm>
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title={`Equipo de ${s.agencyName}`}
            description={`Plan: hasta ${agency.maxUsers} usuarios y ${agency.maxListings} inmuebles activos. Para añadir usuarios o ampliar el plan, contacta con FINCALIA360.`}
          />
          <ul className="divide-y divide-sand-100">
            {team.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-ink-800">{u.name}</p>
                  <p className="text-[12px] text-ink-500">
                    {u.email} · {u.role === "OWNER" ? "Responsable" : "Agente"}
                  </p>
                </div>
                <Badge tone={u.status === "ACTIVE" ? "green" : u.status === "INVITED" ? "amber" : "neutral"}>
                  {u.status === "ACTIVE" ? "Activo" : u.status === "INVITED" ? "Invitado" : "Desactivado"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
