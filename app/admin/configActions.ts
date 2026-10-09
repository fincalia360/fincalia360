"use server";

// Configuración comercial: servicios (sin precios inventados) y estados del embudo.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/db/client";
import { requireAdmin } from "@/lib/auth";
import type { CrmActionState } from "./crmActions";

const fail = (e: unknown): CrmActionState => ({ error: e instanceof z.ZodError ? (e.issues[0]?.message ?? "Datos no válidos") : (e as Error).message });

const serviceSchema = z
  .object({
    name: z.string().trim().min(3).max(80),
    summary: z.string().trim().min(10, "Resume el servicio").max(400),
    scope: z.string().trim().min(10, "Describe qué incluye").max(1000),
    conditions: z.string().trim().max(2000),
    priceType: z.enum(["TBD", "FREE", "FIXED", "QUOTE", "COMMISSION"]),
    priceAmount: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().nonnegative().max(10_000_000).nullable()),
    priceNote: z.string().trim().max(200),
    active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if ((v.priceType === "FIXED" || v.priceType === "COMMISSION") && v.priceAmount == null)
      ctx.addIssue({ code: "custom", path: ["priceAmount"], message: "Indica el importe o el porcentaje para este tipo de precio" });
  });

export async function saveServiceAction(code: string, _prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  await requireAdmin();
  try {
    const d = serviceSchema.parse({
      name: formData.get("name"),
      summary: formData.get("summary"),
      scope: formData.get("scope"),
      conditions: formData.get("conditions") ?? "",
      priceType: formData.get("priceType"),
      priceAmount: formData.get("priceAmount"),
      priceNote: formData.get("priceNote") ?? "",
      active: formData.get("active") === "on",
    });
    // Comisión: se guarda en centésimas de punto (3,5 % → 350)
    const priceAmount = d.priceAmount == null ? null : d.priceType === "COMMISSION" ? Math.round(d.priceAmount * 100) : Math.round(d.priceAmount);
    await prisma.service.update({ where: { code }, data: { ...d, priceAmount, priceNote: d.priceNote || null } });
    revalidatePath("/admin/servicios");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveStageAction(code: string, _prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  await requireAdmin();
  try {
    const label = z.string().trim().min(2).max(40).parse(formData.get("label"));
    const order = z.coerce.number().int().min(0).max(10_000).parse(formData.get("order"));
    const stage = await prisma.pipelineStage.findUniqueOrThrow({ where: { code } });
    const active = stage.system ? true : formData.get("active") === "on"; // los iniciales no se pueden ocultar (indicadores)
    await prisma.pipelineStage.update({ where: { code }, data: { label, order, active } });
    revalidatePath("/admin/servicios");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function addStageAction(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  await requireAdmin();
  try {
    const label = z.string().trim().min(2, "Pon un nombre al estado").max(40).parse(formData.get("label"));
    const order = z.coerce.number().int().min(0).max(10_000).parse(formData.get("order"));
    const kind = z.enum(["OPEN", "WON", "LOST"]).parse(formData.get("kind"));
    const code = `CUSTOM_${Date.now().toString(36).toUpperCase()}`;
    await prisma.pipelineStage.create({ data: { code, label, order, kind, active: true, system: false } });
    revalidatePath("/admin/servicios");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteStageAction(code: string, _prev: CrmActionState): Promise<CrmActionState> {
  void _prev;
  await requireAdmin();
  const stage = await prisma.pipelineStage.findUnique({ where: { code } });
  if (!stage || stage.system) return { error: "Los estados iniciales no se pueden eliminar" };
  const inUse = await prisma.lead.count({ where: { status: code } });
  if (inUse) return { error: `Hay ${inUse} contacto(s) en este estado: cámbialos antes de eliminarlo` };
  await prisma.pipelineStage.delete({ where: { code } });
  revalidatePath("/admin/servicios");
  return { ok: true };
}
