"use server";

// Acciones del panel sobre los inmuebles. Cada una exige la sesión de administrador en el servidor.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { generateListingCopy } from "@/services/listings/aiCopy";
import { TranslationError, saveTranslations, translateIfStale, translateListing, type StoredTranslations } from "@/services/listings/translations";
import { prisma } from "@/db/client";
import type { FormState } from "@/components/listings/ListingForm";
import {
  ListingError,
  TRANSITIONS,
  createListing,
  deleteListing,
  duplicateListing,
  deletePhoto,
  listingFormToObject,
  movePhoto,
  setMainPhoto,
  transitionListing,
  updateListing,
  type Transition,
} from "@/services/listings/listings";

async function actor() {
  const user = await requireAdmin();
  return { kind: "admin" as const, id: user.id };
}

function message(e: unknown) {
  if (e instanceof z.ZodError) return e.issues[0]?.message ?? "Datos no válidos";
  if (e instanceof ListingError) return e.message;
  console.error("[admin/inmuebles]", e);
  return "No se ha podido guardar";
}

export async function createListingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const a = await actor();
  let id: string;
  try {
    id = (await createListing(a, listingFormToObject(formData))).id;
  } catch (e) {
    return { error: message(e) };
  }
  redirect(`/admin/inmuebles/${id}?creado=1`);
}

export async function updateListingAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const a = await actor();
  try {
    await updateListing(a, id, listingFormToObject(formData));
    revalidatePath(`/admin/inmuebles/${id}`);
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function transitionAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const a = await actor();
  try {
    const t = z.enum(Object.keys(TRANSITIONS) as [Transition]).parse(formData.get("transition"));
    await transitionListing(a, id, t, (formData.get("note") as string) || null);
    // Al publicar se preparan las traducciones (catalán, inglés, alemán y francés) si no están al día.
    // Si la IA no está configurada o falla, el anuncio se publica igualmente y se ve en español.
    if (t === "publish") await translateIfStale(id, a.id);
    revalidatePath(`/admin/inmuebles/${id}`);
    revalidatePath("/admin/inmuebles");
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function deleteListingAction(id: string): Promise<FormState> {
  const a = await actor();
  try {
    await deleteListing(a, id);
  } catch (e) {
    return { error: message(e) };
  }
  redirect("/admin/inmuebles");
}

export async function duplicateListingAction(id: string): Promise<FormState> {
  const a = await actor();
  let newId: string;
  try {
    newId = (await duplicateListing(a, id)).id;
  } catch (e) {
    return { error: message(e) };
  }
  redirect(`/admin/inmuebles/${newId}?duplicado=1`);
}

/** IA de redacción: propone textos a partir de los datos del formulario (no guarda ni publica nada). */
export async function aiCopyAction(raw: Record<string, unknown>, mode: "ALL" | "TITLE" | "DESCRIPTION", listingId?: string | null) {
  const user = await requireAdmin();
  const m = z.enum(["ALL", "TITLE", "DESCRIPTION"]).parse(mode);
  return generateListingCopy({ raw, mode: m, adminId: user.id, listingId: listingId ?? null });
}

export async function translateListingAction(id: string): Promise<FormState> {
  const a = await actor();
  try {
    await translateListing(id, a.id);
    revalidatePath(`/admin/inmuebles/${id}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof TranslationError ? e.message : "No se ha podido traducir el anuncio" };
  }
}

export async function saveTranslationsAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await actor();
  try {
    const langs: StoredTranslations["langs"] = {};
    for (const lang of ["ca", "en", "de", "fr"] as const) {
      const pick = (f: string) => String(formData.get(`${lang}.${f}`) ?? "");
      langs[lang] = { title: pick("title"), description: pick("description"), extraInfo: pick("extraInfo"), distribution: pick("distribution"), rentConditions: pick("rentConditions") };
    }
    await saveTranslations(id, langs);
    revalidatePath(`/admin/inmuebles/${id}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof TranslationError ? e.message : message(e) };
  }
}

export async function mainPhotoAction(photoId: string) {
  try {
    await setMainPhoto(await actor(), photoId);
  } catch (e) {
    return { error: message(e) };
  }
}
export async function movePhotoAction(photoId: string, direction: -1 | 1) {
  try {
    await movePhoto(await actor(), photoId, direction === -1 ? -1 : 1);
  } catch (e) {
    return { error: message(e) };
  }
}
export async function deletePhotoAction(photoId: string) {
  try {
    await deletePhoto(await actor(), photoId);
  } catch (e) {
    return { error: message(e) };
  }
}

export async function inquiryStatusAction(inquiryId: string, formData: FormData) {
  await requireAdmin();
  const status = z.enum(["NEW", "HANDLED", "DISCARDED"]).parse(formData.get("status"));
  // El panel solo gestiona las solicitudes de los inmuebles propios de FINCALIA360
  await prisma.listingInquiry.updateMany({ where: { id: inquiryId, agencyId: null }, data: { status } });
  revalidatePath("/admin/inmuebles");
}
