"use server";

// Acciones del panel sobre las solicitudes «Busco comprar». Cada una exige la sesión de administrador.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { SearchRequestError, deleteSearchRequest, setSearchRequestStatus, updateSearchRequest, type SearchAction } from "@/services/searchRequests/searchRequests";

export type SearchFormState = { ok?: boolean; error?: string; message?: string };

function message(e: unknown) {
  if (e instanceof z.ZodError) return e.issues[0]?.message ?? "Datos no válidos";
  if (e instanceof SearchRequestError) return e.message;
  console.error("[admin/busco-piso]", e);
  return "No se ha podido guardar";
}

function refresh(id: string) {
  revalidatePath(`/admin/busco-piso/${id}`);
  revalidatePath("/admin/busco-piso");
  revalidatePath("/busco-piso/solicitudes");
}

export async function updateSearchRequestAction(id: string, _prev: SearchFormState, formData: FormData): Promise<SearchFormState> {
  const user = await requireAdmin();
  try {
    const raw: Record<string, unknown> = {};
    for (const [k, v] of formData.entries()) if (typeof v === "string") raw[k] = v;
    raw.municipalities = String(formData.get("municipalities") ?? "")
      .split(/\r?\n/)
      .map((m) => m.trim())
      .filter(Boolean);
    await updateSearchRequest(user.id, id, raw);
    refresh(id);
    return { ok: true, message: "Cambios guardados" };
  } catch (e) {
    refresh(id);
    return { error: message(e) };
  }
}

const LABELS: Record<SearchAction, string> = {
  publish: "Aprobada y publicada",
  hide: "Retirada de la web",
  reject: "Rechazada",
  resolve: "Marcada como resuelta",
  pending: "Vuelve a estar pendiente de revisión",
};

export async function searchStatusAction(id: string, _prev: SearchFormState, formData: FormData): Promise<SearchFormState> {
  const user = await requireAdmin();
  try {
    const action = z.enum(["publish", "hide", "reject", "resolve", "pending"]).parse(formData.get("action"));
    await setSearchRequestStatus(user.id, id, action);
    refresh(id);
    return { ok: true, message: LABELS[action] };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function deleteSearchRequestAction(id: string): Promise<SearchFormState> {
  const user = await requireAdmin();
  try {
    await deleteSearchRequest(user.id, id);
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/admin/busco-piso");
  revalidatePath("/busco-piso/solicitudes");
  redirect("/admin/busco-piso");
}
