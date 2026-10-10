"use server";

// Comparables de alquiler registrados por el equipo (solo administrador).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/db/client";
import { comparableSchema } from "@/services/study/rentComparables";
import type { CrmActionState } from "@/app/admin/crmActions";

export async function createComparableAction(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  const admin = await requireAdmin();
  try {
    const data = comparableSchema.parse(Object.fromEntries(formData.entries()));
    await prisma.rentComparable.create({ data: { ...data, municipalityCode: data.municipalityCode ?? null, createdBy: admin.id } });
    revalidatePath("/admin/comparables");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof z.ZodError ? (e.issues[0]?.message ?? "Datos no válidos") : "No se ha podido guardar" };
  }
}

/** Borra un comparable registrado por error (no afecta a ningún estudio guardado). */
export async function deleteComparableAction(id: string) {
  await requireAdmin();
  await prisma.rentComparable.delete({ where: { id } }).catch(() => null);
  revalidatePath("/admin/comparables");
}
