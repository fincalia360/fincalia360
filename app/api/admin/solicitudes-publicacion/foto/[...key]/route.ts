// Fotos de las solicitudes de publicación: privadas, solo para el administrador.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isRequestPhoto } from "@/services/listings/publicationRequests";
import { getFile } from "@/services/storage/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin") return new NextResponse("No encontrado", { status: 404 });
  const key = (await params).key.join("/");
  if (!(await isRequestPhoto(key))) return new NextResponse("No encontrado", { status: 404 });
  const file = await getFile(key);
  if (!file) return new NextResponse("No encontrado", { status: 404 });
  return new NextResponse(new Uint8Array(file), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
