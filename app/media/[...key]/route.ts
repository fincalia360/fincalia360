// Fotos de los inmuebles. Las de anuncios visibles se sirven a cualquiera (con caché); las de
// borradores o anuncios retirados, solo al administrador o a la inmobiliaria propietaria.
// Los documentos privados («private/…») nunca se sirven por aquí.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAgencySession } from "@/services/agency/auth";
import { canSeePhoto, isPublicPhoto } from "@/services/listings/listings";
import { CONTENT_TYPES, getFile, isValidKey } from "@/services/storage/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  if (!key.startsWith("public/") || !isValidKey(key)) return new NextResponse("No encontrado", { status: 404 });

  const { exists, isPublic } = await isPublicPhoto(key);
  if (!exists) return new NextResponse("No encontrado", { status: 404 });
  if (!isPublic) {
    const admin = await getCurrentUser();
    const agency = admin ? null : await getAgencySession();
    const allowed = admin ? true : agency ? await canSeePhoto({ kind: "agency", agencyId: agency.agencyId, userId: agency.userId, userName: agency.userName }, key) : false;
    if (!allowed) return new NextResponse("No encontrado", { status: 404 });
  }

  const file = await getFile(key);
  if (!file) return new NextResponse("No encontrado", { status: 404 });
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": CONTENT_TYPES[key.split(".").pop()!] ?? "application/octet-stream",
      "Cache-Control": isPublic ? "public, max-age=86400, stale-while-revalidate=604800" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
