import { NextResponse } from "next/server";
import { getAgencySession } from "@/services/agency/auth";
import { handlePhotoUpload } from "@/services/listings/uploads";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getAgencySession();
  if (!s) return NextResponse.json({ error: "Sesión caducada. Vuelve a entrar." }, { status: 401 });
  return handlePhotoUpload({ kind: "agency", agencyId: s.agencyId, userId: s.userId, userName: s.userName }, (await params).id, request);
}
