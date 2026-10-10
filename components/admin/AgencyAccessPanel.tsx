"use client";

// Acceso de una inmobiliaria a la Zona inmobiliarias: activación, límites del plan y usuarios.
import { useState, useTransition } from "react";
import { useActionForm } from "@/lib/useActionForm";
import { Copy, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { LinkActionState } from "@/app/admin/agencyAccessActions";

type User = { id: string; name: string; email: string; role: string; status: string; lastLoginAt: Date | null; lockedUntil: Date | null };

function LinkResult({ state }: { state: LinkActionState }) {
  const [copied, setCopied] = useState(false);
  if (state.error)
    return (
      <p className="text-sm text-red-600" role="alert">
        {state.error}
      </p>
    );
  if (!state.ok) return null;
  return (
    <div className="space-y-1.5 text-[13px]">
      {state.note && <p className={state.link ? "text-amber-800" : "text-pine-600"}>{state.note}</p>}
      {state.link && (
        <div className="flex items-center gap-2">
          <input readOnly value={state.link} className="field h-8 flex-1 py-0 text-[12px]" onFocus={(e) => e.currentTarget.select()} />
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(state.link!);
              setCopied(true);
            }}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-sand-300 px-3 text-[12px]"
          >
            <Copy className="h-3.5 w-3.5" /> {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      )}
    </div>
  );
}

const STATUS: Record<string, [string, "green" | "amber" | "neutral"]> = {
  ACTIVE: ["Activo", "green"],
  INVITED: ["Invitación pendiente", "amber"],
  DISABLED: ["Desactivado", "neutral"],
};

export function AgencyAccessPanel({
  agency,
  users,
  activeListings,
  saveAccess,
  addUser,
  resendInvite,
  resetLink,
  setStatus,
  setRole,
}: {
  agency: { crmAccess: boolean; maxListings: number; maxUsers: number; status: string };
  users: User[];
  activeListings: number;
  saveAccess: (prev: LinkActionState, fd: FormData) => Promise<LinkActionState>;
  addUser: (prev: LinkActionState, fd: FormData) => Promise<LinkActionState>;
  resendInvite: (userId: string) => Promise<LinkActionState>;
  resetLink: (userId: string) => Promise<LinkActionState>;
  setStatus: (userId: string, enabled: boolean) => Promise<LinkActionState>;
  setRole: (userId: string, role: "OWNER" | "AGENT") => Promise<LinkActionState>;
}) {
  const [accessState, accessSubmit, savingAccess] = useActionForm(saveAccess, {});
  const [userState, userSubmit, addingUser] = useActionForm(addUser, {});
  const [rowState, setRowState] = useState<Record<string, LinkActionState>>({});
  const [pending, start] = useTransition();
  const run = (userId: string, fn: () => Promise<LinkActionState>) =>
    start(async () => {
      const result = await fn();
      setRowState((s) => ({ ...s, [userId]: result }));
    });
  const enabledUsers = users.filter((u) => u.status !== "DISABLED").length;

  return (
    <div className="space-y-5">
      <form onSubmit={accessSubmit} className="space-y-3">
        <label className="flex items-start gap-2.5 text-sm text-ink-700">
          <input type="checkbox" name="crmAccess" defaultChecked={agency.crmAccess} className="mt-0.5 h-4 w-4 rounded border-sand-300" />
          <span>
            <strong>Acceso a la Zona inmobiliarias</strong> (CRM propio y publicación de inmuebles con revisión de FINCALIA360)
            {agency.status !== "ACTIVE" && <span className="block text-[12px] text-amber-700">El colaborador no está activo: no podrá entrar aunque marques el acceso.</span>}
          </span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="field-label">Máx. inmuebles activos</span>
            <input name="maxListings" type="number" min={0} max={10000} defaultValue={agency.maxListings} className="field" />
            <span className="mt-1 block text-xs text-ink-400">Ahora: {activeListings}</span>
          </label>
          <label className="block">
            <span className="field-label">Máx. usuarios</span>
            <input name="maxUsers" type="number" min={1} max={500} defaultValue={agency.maxUsers} className="field" />
            <span className="mt-1 block text-xs text-ink-400">Ahora: {enabledUsers}</span>
          </label>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={savingAccess}>
            {savingAccess && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar acceso
          </Button>
          {accessState.ok && !savingAccess && <span className="text-xs text-pine-600">Guardado</span>}
          {accessState.error && <span className="text-xs text-red-600">{accessState.error}</span>}
        </div>
      </form>

      <div className="border-t border-sand-100 pt-4">
        <h3 className="text-sm font-semibold text-ink-800">Usuarios</h3>
        {users.length === 0 ? (
          <p className="mt-2 text-[13px] text-ink-400">Ninguno todavía.</p>
        ) : (
          <ul className={`mt-2 divide-y divide-sand-100 ${pending ? "opacity-60" : ""}`}>
            {users.map((u) => (
              <li key={u.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-ink-800">
                      {u.name} <span className="font-normal text-ink-400">· {u.role === "OWNER" ? "Responsable" : "Agente"}</span>
                    </p>
                    <p className="text-[12px] text-ink-500">
                      {u.email}
                      {u.lastLoginAt ? ` · último acceso ${new Date(u.lastLoginAt).toLocaleDateString("es-ES")}` : ""}
                    </p>
                  </div>
                  <Badge tone={STATUS[u.status]?.[1] ?? "neutral"}>{STATUS[u.status]?.[0] ?? u.status}</Badge>
                </div>
                {u.lockedUntil && new Date(u.lockedUntil) > new Date() && <p className="text-[12px] text-amber-700">Bloqueado temporalmente por intentos fallidos.</p>}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px]">
                  {u.status === "INVITED" && (
                    <button type="button" onClick={() => run(u.id, () => resendInvite(u.id))} className="font-medium text-ink-700 hover:underline">
                      Reenviar invitación
                    </button>
                  )}
                  {u.status === "ACTIVE" && (
                    <button type="button" onClick={() => run(u.id, () => resetLink(u.id))} className="font-medium text-ink-700 hover:underline">
                      Enlace para nueva contraseña
                    </button>
                  )}
                  <button type="button" onClick={() => run(u.id, () => setRole(u.id, u.role === "OWNER" ? "AGENT" : "OWNER"))} className="font-medium text-ink-700 hover:underline">
                    {u.role === "OWNER" ? "Pasar a agente" : "Pasar a responsable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (u.status === "DISABLED" || confirm(`¿Desactivar a ${u.name}? Se cerrarán sus sesiones.`)) run(u.id, () => setStatus(u.id, u.status === "DISABLED"));
                    }}
                    className={u.status === "DISABLED" ? "font-medium text-pine-600 hover:underline" : "font-medium text-red-600 hover:underline"}
                  >
                    {u.status === "DISABLED" ? "Reactivar" : "Desactivar"}
                  </button>
                </div>
                {rowState[u.id] && <LinkResult state={rowState[u.id]} />}
              </li>
            ))}
          </ul>
        )}

        {agency.crmAccess && (
          <form key={users.length} onSubmit={userSubmit} className="mt-3 space-y-3 rounded-xl bg-sand-50 p-3">
            <p className="text-[13px] font-semibold text-ink-700">Invitar a un usuario</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input name="name" required maxLength={80} placeholder="Nombre" className="field" />
              <input name="email" type="email" required maxLength={120} placeholder="Email" className="field" />
            </div>
            <select name="role" defaultValue={users.length ? "AGENT" : "OWNER"} className="field">
              <option value="OWNER">Responsable de la inmobiliaria</option>
              <option value="AGENT">Agente</option>
            </select>
            <Button type="submit" size="sm" variant="accent" disabled={addingUser}>
              {addingUser && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Crear usuario e invitar
            </Button>
            <LinkResult state={userState} />
          </form>
        )}
      </div>
    </div>
  );
}
