import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handlePhotoUpload } from "@/services/listings/uploads";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return handlePhotoUpload({ kind: "admin", id: admin.id }, (await params).id, request);
}
