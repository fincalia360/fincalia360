import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/services/appointmentService";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ slots: await getAvailableSlots() });
}
