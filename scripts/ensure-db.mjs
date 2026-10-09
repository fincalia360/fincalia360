// Se ejecuta antes de `npm run dev` y `npm run build`:
//  1. crea .env a partir de .env.example si no existe
//  2. sincroniza el esquema Prisma con SQLite (prisma db push)
//  3. carga los datos demo si la base de datos está vacía
import { execSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

if (!existsSync(".env") && existsSync(".env.example")) {
  copyFileSync(".env.example", ".env");
  console.log("[setup] .env creado a partir de .env.example");
}

try {
  run("npx prisma db push --skip-generate");
  run("npx tsx prisma/seed.ts --if-empty");
} catch {
  console.error("[setup] Error preparando la base de datos. Prueba: npx prisma generate && npm run db:reset");
  process.exit(1);
}
