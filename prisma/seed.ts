// Carga datos DEMO ficticios: npm run db:seed
// Con --if-empty sólo siembra si la base de datos no tiene leads (lo usa `npm run dev`).
import { prisma } from "../db/client";
import { seedDemoData } from "../db/seedDemoData";

async function main() {
  if (process.argv.includes("--if-empty")) {
    const count = await prisma.lead.count();
    if (count > 0) {
      console.log(`[seed] La base de datos ya tiene ${count} leads. No se modifica.`);
      return;
    }
  }
  console.log("[seed] Cargando datos demo…");
  await seedDemoData((msg) => console.log(`[seed] ${msg}`));
  console.log("[seed] Listo.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
