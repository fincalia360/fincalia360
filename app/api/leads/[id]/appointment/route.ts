import { NextResponse } from "next/server";
import { bookingSchema } from "@/lib/validation";
import { bookAppointment } from "@/services/appointmentService";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = bookingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Horario no válido" }, { status: 400 });
  try {
    const { appointment, agency } = await bookAppointment(id, new Date(parsed.data.slot), { source: parsed.data.source ?? "WEB_FORM" });
    return NextResponse.json({ appointmentId: appointment.id, scheduledAt: appointment.scheduledAt, agencyName: agency?.name ?? null }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 404 });
  }
}
