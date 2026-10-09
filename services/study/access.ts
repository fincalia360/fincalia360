// Acceso privado a cada estudio: el id de la URL no basta. Al crear el estudio se genera
// un token aleatorio que se guarda (hasheado) en BD y en una cookie httpOnly del navegador
// del propietario. Así no se exponen datos financieros a quien conozca la URL.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const STUDY_COOKIE_PREFIX = "estudio_";
export const STUDY_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 días

export function newAccessToken() {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyToken(token: string | undefined | null, expectedHash: string) {
  if (!token) return false;
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(expectedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function cookieName(studyId: string) {
  return `${STUDY_COOKIE_PREFIX}${studyId}`;
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STUDY_COOKIE_MAX_AGE,
  };
}
