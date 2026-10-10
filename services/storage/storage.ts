// Almacenamiento de archivos (fotos de inmuebles y documentos privados).
// Hoy: disco local en UPLOAD_DIR. En Render apunta al disco persistente (/var/data/uploads), que se
// conserva entre publicaciones. Si más adelante se usa Cloudflare R2/S3, basta con otro driver con
// estas mismas funciones.
//  - «public/…»: fotos (se sirven por /media, solo si el inmueble es visible o con sesión autorizada)
//  - «private/…»: documentos de autorización (nunca públicos)
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

/** Carpeta del proyecto, aunque el servidor se arranque desde la carpeta superior (como hacen las fuentes de datos). */
function projectRoot() {
  const candidates = [process.cwd(), path.join(process.cwd(), "captacion-costa-brava")];
  return candidates.find((dir) => existsSync(path.join(dir, "prisma", "schema.prisma"))) ?? process.cwd();
}

export function uploadRoot() {
  return path.resolve(process.env.UPLOAD_DIR?.trim() || path.join(projectRoot(), "storage"));
}

const KEY_RE = /^(public|private)\/[a-z0-9-]+\/[a-z0-9-]+\.(webp|jpg|png|pdf)$/;

export function isValidKey(key: string) {
  return KEY_RE.test(key);
}

function resolveKey(key: string) {
  if (!isValidKey(key)) throw new Error("Clave de archivo no válida");
  const full = path.join(uploadRoot(), key);
  if (!full.startsWith(uploadRoot() + path.sep)) throw new Error("Clave de archivo no válida");
  return full;
}

export function newKey(scope: "public" | "private", folder: string, ext: "webp" | "jpg" | "png" | "pdf", suffix = "") {
  const safeFolder = folder.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return `${scope}/${safeFolder}/${randomBytes(12).toString("hex")}${suffix}.${ext}`;
}

export async function putFile(key: string, data: Buffer) {
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
}

export async function getFile(key: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveKey(key));
  } catch {
    return null;
  }
}

export async function deleteFile(key: string) {
  try {
    await rm(resolveKey(key), { force: true });
  } catch {
    // ya no existe
  }
}

export const CONTENT_TYPES: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png",
  pdf: "application/pdf",
};
