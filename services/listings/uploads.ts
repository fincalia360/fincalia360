// Manejadores de subida/descarga compartidos por el panel (/api/admin/…) y la Zona inmobiliarias
// (/api/zona/…). Quién actúa lo decide cada ruta tras comprobar su sesión.
import { NextResponse } from "next/server";
import { CONTENT_TYPES, getFile } from "@/services/storage/storage";
import { ListingError, addPhoto, getListing, setAuthorizationDoc, type ListingActor } from "./listings";
import { MAX_PHOTO_BYTES } from "./catalog";

async function fileFrom(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_PHOTO_BYTES + 1024 * 1024) throw new ListingError("El archivo es demasiado grande");
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") throw new ListingError("No se ha recibido ningún archivo");
  return Buffer.from(await file.arrayBuffer());
}

function fail(e: unknown) {
  if (e instanceof ListingError) return NextResponse.json({ error: e.message }, { status: 400 });
  console.error("[upload]", (e as Error).message);
  return NextResponse.json({ error: "No se ha podido guardar el archivo" }, { status: 500 });
}

export async function handlePhotoUpload(actor: ListingActor, listingId: string, request: Request) {
  try {
    const photo = await addPhoto(actor, listingId, await fileFrom(request));
    return NextResponse.json({ ok: true, id: photo.id });
  } catch (e) {
    return fail(e);
  }
}

export async function handleDocUpload(actor: ListingActor, listingId: string, request: Request) {
  try {
    await setAuthorizationDoc(actor, listingId, await fileFrom(request));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

export async function handleDocDownload(actor: ListingActor, listingId: string) {
  try {
    const l = await getListing(actor, listingId);
    const file = l.authorizationDoc ? await getFile(l.authorizationDoc) : null;
    if (!file || !l.authorizationDoc) return new NextResponse("No encontrado", { status: 404 });
    const ext = l.authorizationDoc.split(".").pop()!;
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext],
        "Content-Disposition": `inline; filename="autorizacion-${l.reference}.${ext}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("No encontrado", { status: 404 });
  }
}
