"use server";

// Acciones del panel sobre las solicitudes de publicación. Cada una exige la sesión de administrador.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { ListingError } from "@/services/listings/listings";
import {
  PublicationRequestError,
  convertPublicationRequest,
  deletePublicationRequest,
  setPublicationRequestStatus,
} from "@/services/listings/publicationRequests";

export type RequestFormState = { ok?: boolean; error?: string };

function message(e: unknown) {
  if (e instanceof z.ZodError) return e.issues[0]?.message ?? "Datos no válidos";
  if (e instanceof PublicationRequestError || e instanceof ListingError) return e.message;
  console.error("[admin/solicitudes-publicacion]", e);
  return "No se ha podido guardar";
}

export async function requestStatusAction(id: string, _prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  const user = await requireAdmin();
  try {
    const status = z.enum(["NEW", "IN_REVIEW", "REJECTED"]).parse(formData.get("status"));
    await setPublicationRequestStatus(user.id, id, status, (formData.get("note") as string) || null);
    revalidatePath(`/admin/solicitudes-publicacion/${id}`);
    revalidatePath("/admin/solicitudes-publicacion");
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function convertRequestAction(id: string, _prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  const user = await requireAdmin();
  let listingId: string;
  try {
    const input = z
      .object({
        title: z.string().trim().min(10, "El título debe tener al menos 10 caracteres").max(110),
        price: z.coerce.number({ invalid_type_error: "Indica el precio" }).int().min(1, "Indica el precio"),
      })
      .parse({ title: formData.get("title"), price: formData.get("price") });
    listingId = (await convertPublicationRequest(user.id, id, input)).id;
  } catch (e) {
    return { error: message(e) };
  }
  redirect(`/admin/inmuebles/${listingId}?creado=1`);
}

export async function deleteRequestAction(id: string): Promise<RequestFormState> {
  const user = await requireAdmin();
  try {
    await deletePublicationRequest(user.id, id);
  } catch (e) {
    return { error: message(e) };
  }
  redirect("/admin/solicitudes-publicacion");
}
