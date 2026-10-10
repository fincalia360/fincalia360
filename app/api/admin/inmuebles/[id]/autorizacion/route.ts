import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleDocDownload, handleDocUpload } from "@/services/listings/uploads";

async function admin() {
  const user = await getCurrentUser();
  return user && user.role === "admin" ? ({ kind: "admin", id: user.id } as const) : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await admin();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return handleDocUpload(actor, (await params).id, request);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await admin();
  if (!actor) return new NextResponse("No autorizado", { status: 401 });
  return handleDocDownload(actor, (await params).id);
}
