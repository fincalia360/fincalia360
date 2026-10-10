"use server";

// Acciones de la Zona inmobiliarias. Cada una obtiene la inmobiliaria de la SESIÓN del servidor
// (requireAgency) y la pasa a los servicios, que filtran todos los datos por ella.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseMadridLocal } from "@/lib/dates";
import type { FormState } from "@/components/listings/ListingForm";
import { AuthError, changePassword, requireAgency } from "@/services/agency/auth";
import {
  CrmError,
  changeContactStatus,
  createContact,
  deleteContact,
  logActivity,
  scheduleVisit,
  setContactNextAction,
  setInquiryStatus,
  setVisitStatus,
  updateContact,
  type Tenant,
} from "@/services/agency/crm";
import {
  ListingError,
  TRANSITIONS,
  createListing,
  deleteListing,
  deletePhoto,
  listingFormToObject,
  movePhoto,
  setMainPhoto,
  transitionListing,
  updateListing,
  type ListingActor,
  type Transition,
} from "@/services/listings/listings";

const P = "/zona-inmobiliarias/panel";

async function session() {
  try {
    return await requireAgency();
  } catch {
    redirect("/zona-inmobiliarias");
  }
}

async function tenant(): Promise<Tenant> {
  const s = await session();
  return { agencyId: s.agencyId, userId: s.userId, userName: s.userName };
}

async function actor(): Promise<ListingActor> {
  const s = await session();
  return { kind: "agency", agencyId: s.agencyId, userId: s.userId, userName: s.userName };
}

function message(e: unknown) {
  if (e instanceof z.ZodError) return e.issues[0]?.message ?? "Datos no válidos";
  if (e instanceof CrmError || e instanceof ListingError || e instanceof AuthError) return e.message;
  console.error("[zona-inmobiliarias]", e);
  return "No se ha podido guardar";
}

const contactForm = (fd: FormData) => ({ kind: fd.get("kind"), name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone"), notes: fd.get("notes") });

// ------------------------------------------------------------------ Contactos
export async function createContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await tenant();
  let id: string;
  try {
    id = (await createContact(t, contactForm(formData))).id;
  } catch (e) {
    return { error: message(e) };
  }
  redirect(`${P}/contactos/${id}`);
}

export async function updateContactAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const t = await tenant();
  try {
    await updateContact(t, id, contactForm(formData));
    revalidatePath(`${P}/contactos/${id}`);
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function contactStatusAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const t = await tenant();
  try {
    await changeContactStatus(t, id, String(formData.get("status")));
    revalidatePath(`${P}/contactos/${id}`);
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function nextActionAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const t = await tenant();
  try {
    const text = z.string().trim().max(200).parse(formData.get("action") ?? "");
    const at = parseMadridLocal(String(formData.get("dueAt") ?? ""));
    if (text && !at) return { error: "Indica la fecha de la próxima acción" };
    await setContactNextAction(t, id, text || null, at);
    revalidatePath(`${P}/contactos/${id}`);
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function logActivityAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const t = await tenant();
  try {
    await logActivity(t, id, String(formData.get("type")), String(formData.get("summary") ?? ""), parseMadridLocal(String(formData.get("at") ?? "")) ?? new Date());
    revalidatePath(`${P}/contactos/${id}`);
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function scheduleVisitAction(contactId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const t = await tenant();
  try {
    const at = parseMadridLocal(String(formData.get("at") ?? ""));
    if (!at) return { error: "Indica la fecha y la hora de la visita" };
    await scheduleVisit(t, contactId, at, (formData.get("listingId") as string) || null, (formData.get("notes") as string) || null);
    revalidatePath(`${P}/contactos/${contactId}`);
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function visitStatusAction(visitId: string, status: string): Promise<void> {
  const t = await tenant();
  await setVisitStatus(t, visitId, status);
  revalidatePath(P, "layout");
}

export async function deleteContactAction(id: string): Promise<FormState> {
  const t = await tenant();
  try {
    await deleteContact(t, id);
  } catch (e) {
    return { error: message(e) };
  }
  redirect(`${P}/contactos`);
}

export async function inquiryStatusAction(inquiryId: string, formData: FormData) {
  const t = await tenant();
  await setInquiryStatus(t, inquiryId, String(formData.get("status")));
  revalidatePath(`${P}/solicitudes`);
}

// ------------------------------------------------------------------ Inmuebles
export async function createListingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const a = await actor();
  let id: string;
  try {
    id = (await createListing(a, listingFormToObject(formData))).id;
  } catch (e) {
    return { error: message(e) };
  }
  redirect(`${P}/inmuebles/${id}?creado=1`);
}

export async function updateListingAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const a = await actor();
  try {
    const { backToReview } = await updateListing(a, id, listingFormToObject(formData));
    revalidatePath(`${P}/inmuebles/${id}`);
    return backToReview ? { ok: true, notice: "Guardado. Como el anuncio estaba publicado, vuelve a revisión de FINCALIA360 antes de mostrarse." } : { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function transitionAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const a = await actor();
  try {
    const t = z.enum(Object.keys(TRANSITIONS) as [Transition]).parse(formData.get("transition"));
    await transitionListing(a, id, t);
    revalidatePath(`${P}/inmuebles/${id}`);
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
  redirect(`${P}/inmuebles`);
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

// ------------------------------------------------------------------ Cuenta
export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await session();
  const next = String(formData.get("next") ?? "");
  if (next !== String(formData.get("confirm") ?? "")) return { error: "Las contraseñas nuevas no coinciden" };
  try {
    await changePassword(s, String(formData.get("current") ?? ""), next);
  } catch (e) {
    return { error: message(e) };
  }
  redirect("/zona-inmobiliarias?cambiada=1");
}
