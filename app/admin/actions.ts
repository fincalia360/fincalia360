"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { agencySchema } from "@/lib/validation";
import {
  createAgency,
  deleteAgency,
  setAgencyStatus,
  updateAgency,
} from "@/services/agencyService";
import { createAppointmentFromAdmin, updateAppointmentStatus } from "@/services/appointmentService";
import { createDemoLead, simulateHotLead } from "@/services/demoService";
import { addNote } from "@/services/leadService";
import { demoToolsEnabled } from "@/lib/demo";
import { saveSettings, type BusinessSettings } from "@/services/settingsService";
import { seedDemoData } from "@/db/seedDemoData";
import { APPOINTMENT_STATUSES, type AppointmentStatus } from "@/types";

function refreshAdmin() {
  revalidatePath("/admin", "layout");
}

// ---- Simuladores (solo en desarrollo local; nunca en la web publicada) ----
function assertDemo() {
  if (!demoToolsEnabled()) throw new Error("Herramientas de demostración desactivadas en producción");
}

export async function createDemoLeadAction() {
  await requireAdmin();
  assertDemo();
  const lead = await createDemoLead();
  refreshAdmin();
  redirect(`/admin/leads/${lead.id}?created=demo`);
}

export async function simulateHotLeadAction() {
  await requireAdmin();
  assertDemo();
  const lead = await simulateHotLead();
  refreshAdmin();
  redirect(`/admin/leads/${lead.id}?created=hot`);
}

export async function resetDemoDataAction() {
  await requireAdmin();
  assertDemo();
  await seedDemoData();
  refreshAdmin();
  redirect("/admin?reset=1");
}

// ---- Leads ----
export async function createAppointmentAction(leadId: string) {
  await requireAdmin();
  await createAppointmentFromAdmin(leadId);
  refreshAdmin();
}

export async function addNoteAction(leadId: string, formData: FormData) {
  await requireAdmin();
  const content = String(formData.get("content") ?? "").trim();
  if (content) await addNote(leadId, content.slice(0, 2000));
  refreshAdmin();
}

// ---- Citas ----
export async function setAppointmentStatusAction(appointmentId: string, status: string) {
  await requireAdmin();
  if (!(APPOINTMENT_STATUSES as readonly string[]).includes(status)) throw new Error("Estado no válido");
  await updateAppointmentStatus(appointmentId, status as AppointmentStatus);
  refreshAdmin();
}

// ---- Inmobiliarias ----
function agencyFromForm(formData: FormData) {
  return agencySchema.safeParse({
    name: formData.get("name"),
    zones: formData.getAll("zones").map(String),
    email: formData.get("email"),
    phone: formData.get("phone"),
    languages: formData.getAll("languages").map(String),
    propertyTypes: formData.getAll("propertyTypes").map(String),
    status: formData.get("status") ?? "ACTIVE",
    monthlyFee: formData.get("monthlyFee") || 0,
    pricePerAppointment: formData.get("pricePerAppointment") || 0,
    partnerType: formData.get("partnerType") ?? "INMOBILIARIA",
    services: formData.getAll("services").map(String),
    provinces: formData.getAll("provinces").map(String),
    municipalities: formData.get("municipalities") ?? "",
    contactName: formData.get("contactName") ?? "",
    agreementTerms: formData.get("agreementTerms") ?? "",
    notes: formData.get("notes") ?? "",
  });
}

export type AgencyFormState = { error?: string } | undefined;

export async function saveAgencyAction(agencyId: string | null, _prev: AgencyFormState, formData: FormData): Promise<AgencyFormState> {
  await requireAdmin();
  const parsed = agencyFromForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message && !parsed.error.issues[0].message.startsWith("Invalid") ? parsed.error.issues[0].message : `Revisa los campos: ${Object.keys(parsed.error.flatten().fieldErrors).join(", ")}` };
  }
  if (agencyId) await updateAgency(agencyId, parsed.data);
  else await createAgency(parsed.data);
  refreshAdmin();
  redirect("/admin/agencies");
}

export async function toggleAgencyStatusAction(agencyId: string, status: "ACTIVE" | "PAUSED") {
  await requireAdmin();
  await setAgencyStatus(agencyId, status);
  refreshAdmin();
}

export async function deleteAgencyAction(agencyId: string) {
  await requireAdmin();
  await deleteAgency(agencyId);
  refreshAdmin();
  redirect("/admin/agencies");
}

// ---- Configuración ----
export type SettingsFormState = { saved?: boolean; error?: string } | undefined;

export async function saveSettingsAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireAdmin();
  const num = (key: string) => Number(String(formData.get(key) ?? "").replace(",", "."));
  const values: Partial<BusinessSettings> = {
    cpl: num("cpl"),
    leadToAppointment: num("leadToAppointment") / 100,
    appointmentToOpportunity: num("appointmentToOpportunity") / 100,
    pricePerAppointment: num("pricePerAppointment"),
    adBudget: num("adBudget"),
    toolsCost: num("toolsCost"),
    agencies: num("agencies"),
    monthlyFee: num("monthlyFee"),
  };
  if (Object.values(values).some((v) => !Number.isFinite(v) || (v as number) < 0)) return { error: "Valores no válidos" };
  await saveSettings(values);
  refreshAdmin();
  return { saved: true };
}
