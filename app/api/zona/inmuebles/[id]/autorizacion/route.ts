import { NextResponse } from "next/server";
import { getAgencySession } from "@/services/agency/auth";
import { handleDocDownload, handleDocUpload } from "@/services/listings/uploads";

async function actor() {
  const s = await getAgencySession();
  return s ? ({ kind: "agency", agencyId: s.agencyId, userId: s.userId, userName: s.userName } as const) : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await actor();
  if (!a) return NextResponse.json({ error: "Sesión caducada. Vuelve a entrar." }, { status: 401 });
  return handleDocUpload(a, (await params).id, request);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await actor();
  if (!a) return new NextResponse("No autorizado", { status: 401 });
  return handleDocDownload(a, (await params).id);
}
