// Prepara la base de datos. Se ejecuta antes de `npm run dev`, `npm run build` y `npm start`:
//  1. en local, crea .env a partir de .env.example si no existe (nunca en producción)
//  2. sincroniza el esquema Prisma con SQLite (prisma db push; no borra datos)
//  3. carga los datos DEMO si la base está vacía — solo en local. En producción (SEED_DEMO_DATA=false)
//     la base se crea vacía: nunca se mezclan datos ficticios con solicitudes reales.
// Si la carpeta de la base de datos no existe todavía (p. ej. el disco del servidor solo se monta al
// arrancar, no al compilar), se omite sin error y se prepara en `npm start`.
import { execSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
const production = process.env.NODE_ENV === "production" || process.env.SEED_DEMO_DATA === "false";

if (!production && !process.env.DATABASE_URL && !existsSync(".env") && existsSync(".env.example")) {
  copyFileSync(".env.example", ".env");
  console.log("[setup] .env creado a partir de .env.example");
}

const url = process.env.DATABASE_URL ?? "";
if (url.startsWith("file:")) {
  const file = url.slice("file:".length);
  const dir = path.isAbsolute(file) ? path.dirname(file) : null;
  if (dir && !existsSync(dir)) {
    console.log(`[setup] La carpeta ${dir} aún no existe: la base de datos se preparará al arrancar.`);
    process.exit(0);
  }
}

/** Migraciones de datos idempotentes (no borran nada). */
async function migrateData() {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    // Estados comerciales v2: «Cualificado» pasa a «Pendiente de contactar»
    const { count } = await prisma.lead.updateMany({ where: { status: "QUALIFIED" }, data: { status: "PENDING_CONTACT" } });
    if (count) console.log(`[setup] ${count} contactos pasan de «Cualificado» a «Pendiente de contactar».`);
    // Email y teléfono normalizados para evitar duplicados
    const pending = await prisma.lead.findMany({ where: { emailNormalized: null }, select: { id: true, email: true, phone: true } });
    for (const l of pending) {
      const digits = (l.phone ?? "").replace(/\D/g, "");
      await prisma.lead.update({ where: { id: l.id }, data: { emailNormalized: l.email.trim().toLowerCase(), phoneNormalized: digits.length >= 9 ? digits.slice(-9) : null } });
    }
    await prisma.$disconnect();
  } catch (error) {
    console.error("[setup] No se pudo completar la migración de datos:", error.message);
  }
}

/** Política de conservación: estudios sin solicitud de contacto se eliminan a los 12 meses. */
async function purgeExpiredStudies() {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const limit = new Date(Date.now() - 365 * 24 * 3600 * 1000);
    const { count } = await prisma.study.deleteMany({ where: { valuationRequested: false, createdAt: { lt: limit } } });
    if (count) console.log(`[setup] Eliminados ${count} estudios sin solicitud de contacto con más de 12 meses.`);
    await prisma.$disconnect();
  } catch (error) {
    console.error("[setup] No se pudo aplicar la política de conservación:", error.message);
  }
}

try {
  run("npx prisma db push --skip-generate");
  if (production) console.log("[setup] Producción: no se cargan datos de demostración.");
  else run("npx tsx prisma/seed.ts --if-empty");
  await migrateData();
  await purgeExpiredStudies();
} catch {
  console.error("[setup] Error preparando la base de datos. Prueba: npx prisma generate && npm run db:reset");
  process.exit(1);
}
