// Hipótesis de negocio configurables. NO son resultados reales: deben validarse en el piloto.
import { prisma } from "@/db/client";

export interface BusinessSettings {
  cpl: number; // € por lead
  leadToAppointment: number; // 0-1
  appointmentToOpportunity: number; // 0-1
  pricePerAppointment: number; // € que paga la inmobiliaria por cita
  adBudget: number; // € / mes
  toolsCost: number; // € / mes
  agencies: number;
  monthlyFee: number; // € / mes por inmobiliaria
}

export const DEFAULT_SETTINGS: BusinessSettings = {
  cpl: 20,
  leadToAppointment: 0.15,
  appointmentToOpportunity: 0.4,
  pricePerAppointment: 150,
  adBudget: 1000,
  toolsCost: 300,
  agencies: 2,
  monthlyFee: 250,
};

export async function getSettings(): Promise<BusinessSettings> {
  const rows = await prisma.setting.findMany();
  const result = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key in result) {
      const value = Number(row.value);
      if (Number.isFinite(value)) result[row.key as keyof BusinessSettings] = value;
    }
  }
  return result;
}

export async function saveSettings(values: Partial<BusinessSettings>) {
  const entries = Object.entries(values).filter(([key, v]) => key in DEFAULT_SETTINGS && Number.isFinite(v));
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } }),
    ),
  );
  return getSettings();
}
