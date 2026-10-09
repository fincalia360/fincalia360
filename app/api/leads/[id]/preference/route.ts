import { NextResponse } from "next/server";
import { z } from "zod";
import { setContactPreference } from "@/services/leadService";
import { CONTACT_CHANNELS } from "@/types";

const schema = z.object({
  choice: z.enum(["CONTACT_ME", "KEEP_INFORMED"]),
  channel: z.enum(CONTACT_CHANNELS).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  try {
    await setContactPreference(id, parsed.data.choice, parsed.data.channel);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
  }
}
