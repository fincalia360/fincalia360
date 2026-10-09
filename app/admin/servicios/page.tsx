import { addStageAction, deleteStageAction, saveServiceAction, saveStageAction } from "@/app/admin/configActions";
import { ActionForm } from "@/components/admin/crm/CrmForms";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { prisma } from "@/db/client";
import { PRICE_TYPE_LABELS, getServices, getStages, priceText } from "@/services/crm/catalog";

export const metadata = { title: "Servicios y estados" };

const small = "field h-9 py-1.5 text-sm";

export default async function ServicesPage() {
  const [services, stages] = await Promise.all([getServices(), getStages({ includeInactive: true })]);
  const counts = await prisma.lead.groupBy({ by: ["status"], where: { isDemo: false }, _count: true });
  const countOf = (code: string) => counts.find((c) => c.status === code)?._count ?? 0;

  return (
    <>
      <PageHeader title="Servicios y estados" description="Lo que ofrece FINCALIA360 y las etapas del seguimiento comercial." />

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        FINCALIA360 estudia el caso y pone en contacto con profesionales colaboradores: no intermedia directamente. Mientras el precio sea «Por definir», la web
        dirá que el alcance y el precio se explican antes de contratar. No hay pagos en línea.
      </div>

      <h2 className="mb-3 text-lg font-bold text-ink-800">Servicios</h2>
      <div className="mb-10 grid gap-6 xl:grid-cols-3">
        {services.map((s) => (
          <Card key={s.code}>
            <CardHeader title={s.name} description={`Lo que ve el propietario: ${priceText(s)}`} />
            <CardBody>
              <ActionForm action={saveServiceAction.bind(null, s.code)} submitLabel="Guardar servicio" resetOnSuccess={false}>
                <label className="block text-xs text-ink-500">
                  Nombre
                  <input name="name" defaultValue={s.name} className={`${small} mt-1`} />
                </label>
                <label className="block text-xs text-ink-500">
                  Resumen (se muestra en la pantalla final)
                  <textarea name="summary" defaultValue={s.summary} rows={3} className="field mt-1 text-sm" />
                </label>
                <label className="block text-xs text-ink-500">
                  Qué incluye
                  <textarea name="scope" defaultValue={s.scope} rows={3} className="field mt-1 text-sm" />
                </label>
                <label className="block text-xs text-ink-500">
                  Condiciones (internas, para preparar propuestas)
                  <textarea name="conditions" defaultValue={s.conditions} rows={2} className="field mt-1 text-sm" />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs text-ink-500">
                    Tipo de precio
                    <select name="priceType" defaultValue={s.priceType} className={`${small} mt-1`}>
                      {Object.entries(PRICE_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs text-ink-500">
                    Importe (€) o comisión (%)
                    <input
                      name="priceAmount"
                      type="number"
                      step="0.01"
                      min={0}
                      defaultValue={s.priceAmount == null ? "" : s.priceType === "COMMISSION" ? s.priceAmount / 100 : s.priceAmount}
                      className={`${small} mt-1`}
                    />
                  </label>
                </div>
                <label className="block text-xs text-ink-500">
                  Nota sobre el precio (opcional)
                  <input name="priceNote" defaultValue={s.priceNote ?? ""} maxLength={200} className={`${small} mt-1`} />
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-600">
                  <input type="checkbox" name="active" defaultChecked={s.active} /> Visible en la pantalla final
                </label>
              </ActionForm>
            </CardBody>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-bold text-ink-800">Estados del seguimiento</h2>
      <Card>
        <CardBody>
          <table className="table-base">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Tipo</th>
                <th className="text-right">Contactos</th>
                <th>Editar</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((s) => (
                <tr key={s.code}>
                  <td className="font-medium text-ink-800">
                    {s.label}
                    {!s.active && <span className="ml-2 text-xs text-ink-400">(oculto)</span>}
                  </td>
                  <td className="text-ink-500">{s.kind === "WON" ? "Ganado" : s.kind === "LOST" ? "Perdido" : "Abierto"}{s.system ? " · inicial" : ""}</td>
                  <td className="text-right tabular-nums">{countOf(s.code)}</td>
                  <td className="whitespace-normal">
                    <ActionForm action={saveStageAction.bind(null, s.code)} submitLabel="Guardar" resetOnSuccess={false} className="flex flex-wrap items-center gap-2">
                      <input name="label" defaultValue={s.label} className={`${small} w-48`} />
                      <input name="order" type="number" defaultValue={s.order} className={`${small} w-20`} title="Orden" />
                      {!s.system && (
                        <label className="flex items-center gap-1 text-xs text-ink-500">
                          <input type="checkbox" name="active" defaultChecked={s.active} /> visible
                        </label>
                      )}
                    </ActionForm>
                    {!s.system && (
                      <ActionForm action={deleteStageAction.bind(null, s.code)} submitLabel="Eliminar" variant="danger" className="mt-2">
                        <span />
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-6 border-t border-sand-100 pt-5">
            <p className="mb-2 text-sm font-semibold text-ink-800">Añadir un estado</p>
            <ActionForm action={addStageAction} submitLabel="Añadir estado" className="flex flex-wrap items-center gap-2">
              <input name="label" placeholder="Nombre del estado" className={`${small} w-56`} />
              <input name="order" type="number" defaultValue={55} className={`${small} w-20`} title="Orden" />
              <select name="kind" defaultValue="OPEN" className={`${small} w-36`}>
                <option value="OPEN">Abierto</option>
                <option value="WON">Ganado</option>
                <option value="LOST">Perdido</option>
              </select>
            </ActionForm>
            <p className="mt-2 text-xs text-ink-400">
              Los 8 estados iniciales no se pueden eliminar porque los usan los indicadores; sí puedes cambiar su nombre y su orden.
            </p>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
