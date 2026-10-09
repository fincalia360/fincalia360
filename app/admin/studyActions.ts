"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/db/client";
import { requireAdmin } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { COMMERCIAL_STATUSES, setCommercialStatus, type CommercialStatus } from "@/services/study/adminStudyService";
import { importTensionedAreas } from "@/services/study/sources/tensionedAreas";

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function setStudyStatusAction(studyId: string, formData: FormData) {
  await requireAdmin();
  const status = String(formData.get("status"));
  if (!(COMMERCIAL_STATUSES as readonly string[]).includes(status)) throw new Error("Estado no válido");
  await setCommercialStatus(studyId, status as CommercialStatus);
  revalidatePath("/admin/studies", "layout");
}

export type ImportState = { ok?: string; error?: string } | undefined;

export async function importTensionedAction(): Promise<void> {
  await requireAdmin();
  try {
    await importTensionedAreas();
  } catch (error) {
    redirect(`/admin/data-sources?error=${encodeURIComponent((error as Error).message)}`);
  }
  revalidatePath("/admin/data-sources");
  redirect("/admin/data-sources?imported=1");
}

export async function clearOfficialCacheAction() {
  await requireAdmin();
  await prisma.officialDataCache.deleteMany();
  revalidatePath("/admin/data-sources");
}

const marketRefSchema = z.object({
  municipalityCode: z.string().regex(/^\d{5}$/),
  municipalityName: z.string().trim().min(2).max(120),
  kind: z.enum(["SALE_M2", "RENT_M2"]),
  dataType: z.enum(["OFFICIAL", "CLOSED_TRANSACTIONS", "ASKING_PRICES", "APPRAISAL"]),
  value: z.coerce.number().positive().max(100_000),
  low: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().positive().optional()),
  high: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().positive().optional()),
  period: z.string().trim().min(4).max(20),
  sourceName: z.string().trim().min(3).max(200),
  sourceUrl: z.string().trim().url().optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional(),
});

export async function addMarketReferenceAction(formData: FormData) {
  await requireAdmin();
  const parsed = marketRefSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/data-sources?error=${encodeURIComponent("Referencia no válida: revisa los campos (código INE de 5 cifras, fuente y periodo obligatorios).")}`);
  const d = parsed.data;
  await prisma.marketReference.create({ data: { ...d, sourceUrl: d.sourceUrl || null, notes: d.notes || null, low: d.low ?? null, high: d.high ?? null } });
  revalidatePath("/admin/data-sources");
}

export async function deleteMarketReferenceAction(id: string) {
  await requireAdmin();
  await prisma.marketReference.delete({ where: { id } });
  revalidatePath("/admin/data-sources");
}
