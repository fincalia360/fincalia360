// Pisos de MUESTRA para ver cómo queda el portal en local. Todo es FICTICIO y va marcado «DEMO»:
// los pisos no existen y las fotos son ilustraciones generadas, no fotos reales.
// Solo funciona en desarrollo (nunca en la web publicada).
//   npm run demo:pisos            → crea (o vuelve a crear) los pisos de muestra
//   npm run demo:pisos -- --borrar → los elimina, con sus fotos
import sharp from "sharp";
import { prisma } from "@/db/client";
import { deleteFile } from "@/services/storage/storage";
import { addPhoto, createListing, transitionListing, type ListingActor } from "@/services/listings/listings";

if (process.env.NODE_ENV === "production" || process.env.SEED_DEMO_DATA === "false") {
  console.error("Los pisos de muestra solo se pueden crear en local.");
  process.exit(1);
}

const AGENCY_NAME = "Inmobiliaria de demostración (ficticia)";
const DEMO_NOTE = "ANUNCIO DE DEMOSTRACIÓN: este inmueble no existe y las imágenes son ilustraciones, no fotos reales.\n\n";

type Room = "fachada" | "salon" | "cocina" | "dormitorio" | "bano" | "terraza";
const LABELS: Record<Room, string> = { fachada: "Fachada", salon: "Salón", cocina: "Cocina", dormitorio: "Dormitorio", bano: "Baño", terraza: "Terraza" };

/** Ilustración sencilla de una estancia (SVG → JPEG). */
function svg(room: Room, accent: string, wall: string, floor: string) {
  const W = 1600;
  const H = 1050;
  const win = `<rect x="1050" y="130" width="400" height="430" fill="#fff"/><rect x="1064" y="144" width="372" height="402" fill="url(#sky)"/><rect x="1244" y="144" width="12" height="402" fill="#fff"/><rect x="1064" y="339" width="372" height="12" fill="#fff"/>`;
  const base = `<rect width="${W}" height="${H * 0.68}" fill="${wall}"/><rect y="${H * 0.68}" width="${W}" height="${H * 0.32}" fill="url(#floor)"/>`;
  const scenes: Record<Room, string> = {
    fachada: `<rect width="${W}" height="${H}" fill="url(#sky)"/><rect x="300" y="160" width="1000" height="800" fill="${wall}"/>${[0, 1, 2, 3]
      .map((r) => [0, 1, 2, 3].map((c) => `<rect x="${370 + c * 230}" y="${210 + r * 175}" width="150" height="120" fill="#9fc7de"/><rect x="${360 + c * 230}" y="${330 + r * 175}" width="170" height="14" fill="${accent}"/>`).join(""))
      .join("")}<rect x="700" y="860" width="200" height="100" fill="${accent}"/><rect y="960" width="${W}" height="90" fill="#9e9e9e"/>`,
    salon: `${base}${win}<rect x="180" y="520" width="620" height="270" rx="18" fill="${accent}"/><rect x="150" y="560" width="70" height="230" rx="14" fill="${accent}" opacity=".85"/><rect x="760" y="560" width="70" height="230" rx="14" fill="${accent}" opacity=".85"/><rect x="300" y="560" width="110" height="80" rx="10" fill="#e9c46a"/><rect x="380" y="840" width="300" height="30" fill="#8d6e4f"/><circle cx="950" cy="600" r="70" fill="#2a9d8f"/><rect x="935" y="640" width="30" height="170" fill="#6d4c41"/>`,
    cocina: `${base}<rect x="620" y="140" width="360" height="300" fill="#fff"/><rect x="634" y="154" width="332" height="272" fill="url(#sky)"/><rect x="80" y="545" width="1440" height="255" fill="#fff"/>${[0, 1, 2, 3, 4, 5]
      .map((i) => `<rect x="${100 + i * 240}" y="590" width="210" height="190" rx="6" fill="${accent}"/>`)
      .join("")}<rect x="80" y="120" width="460" height="240" fill="#fff"/><rect x="1060" y="120" width="460" height="240" fill="#fff"/><rect x="80" y="545" width="1440" height="22" fill="#d9d3c7"/>`,
    dormitorio: `${base}<rect x="200" y="140" width="340" height="400" fill="#fff"/><rect x="214" y="154" width="312" height="372" fill="url(#sky)"/><rect x="650" y="430" width="620" height="140" rx="12" fill="#8d6e4f"/><rect x="650" y="560" width="620" height="230" rx="10" fill="#fff"/><rect x="650" y="660" width="620" height="130" fill="${accent}" opacity=".7"/><rect x="700" y="520" width="220" height="70" rx="20" fill="#f4f1ea"/><rect x="990" y="520" width="220" height="70" rx="20" fill="#f4f1ea"/><rect x="1310" y="640" width="140" height="150" fill="#6d4c41"/><circle cx="1380" cy="600" r="40" fill="#f1c27d"/>`,
    bano: `${base}${win}<rect x="140" y="560" width="700" height="230" rx="30" fill="#fff"/><rect x="170" y="585" width="640" height="60" rx="20" fill="#e3eef2"/><rect x="960" y="600" width="300" height="190" fill="#fff"/><rect x="1010" y="250" width="200" height="260" rx="12" fill="${accent}" opacity=".35"/>`,
    terraza: `<rect width="${W}" height="${H * 0.6}" fill="url(#sky)"/><circle cx="1250" cy="200" r="90" fill="#ffe08a"/><rect y="${H * 0.45}" width="${W}" height="80" fill="#7fa7c9"/><rect y="${H * 0.6}" width="${W}" height="${H * 0.4}" fill="url(#floor)"/><rect y="${H * 0.52}" width="${W}" height="14" fill="#fff"/>${Array.from({ length: 16 }, (_, i) => `<rect x="${i * 100 + 40}" y="${H * 0.52}" width="10" height="120" fill="#fff"/>`).join("")}<rect x="420" y="740" width="320" height="24" fill="#8d6e4f"/><rect x="560" y="764" width="40" height="120" fill="#8d6e4f"/><circle cx="1150" cy="760" r="80" fill="${accent}"/>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd0f0"/><stop offset="1" stop-color="#e6f4fb"/></linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${floor}"/><stop offset="1" stop-color="#8a6a48"/></linearGradient>
  </defs>
  ${scenes[room]}
  <rect x="28" y="${H - 96}" width="640" height="68" rx="8" fill="#142B45" opacity=".82"/>
  <text x="50" y="${H - 50}" font-family="Arial, sans-serif" font-size="34" font-weight="bold" fill="#fff">${LABELS[room]} · imagen de demostración</text>
</svg>`;
}

const SAMPLES = [
  { operation: "SALE", propertyType: "PISO", title: "Piso luminoso con balcón cerca del centro", price: 245000, provinceCode: "17", municipality: "Girona", zone: "Eixample", postalCode: "17002", builtArea: 92, bedrooms: 3, bathrooms: 2, floor: "3ª", yearBuilt: 2004, condition: "GOOD", energyRating: "D", features: ["ELEVATOR", "BALCONY", "HEATING", "EQUIPPED_KITCHEN"], rooms: ["salon", "cocina", "dormitorio", "bano"] as Room[], palette: ["#4b6a7d", "#efe7da", "#c49a6c"], text: "Piso exterior de tres habitaciones con balcón, cocina equipada y calefacción. Edificio con ascensor, cerca de colegios, comercios y transporte." },
  { operation: "SALE", propertyType: "ATICO", title: "Ático con terraza y vistas despejadas", price: 465000, provinceCode: "08", municipality: "Barcelona", zone: "Gràcia", postalCode: "08012", builtArea: 85, bedrooms: 2, bathrooms: 1, floor: "Ático", yearBuilt: 1975, condition: "GOOD", energyRating: "E", features: ["TERRACE", "ELEVATOR", "AC", "VIEWS", "EXTERIOR"], rooms: ["terraza", "salon", "dormitorio", "cocina"] as Room[], palette: ["#238477", "#f3efe6", "#b98b5e"], text: "Ático de dos habitaciones con terraza de 25 m², mucha luz y vistas despejadas. Aire acondicionado y ascensor." },
  { operation: "SALE", propertyType: "CASA", title: "Casa adosada con jardín y garaje", price: 329000, provinceCode: "08", municipality: "Sant Cugat del Vallès", zone: "Valldoreix", postalCode: "08197", builtArea: 180, bedrooms: 4, bathrooms: 3, floor: null, yearBuilt: 2008, condition: "GOOD", energyRating: "C", features: ["GARDEN", "PARKING", "STORAGE", "HEATING", "BUILT_IN_WARDROBES"], rooms: ["fachada", "salon", "cocina", "dormitorio", "terraza"] as Room[], palette: ["#a0785a", "#ece4d6", "#c8a27a"], text: "Casa adosada de cuatro habitaciones y tres baños, con jardín privado, garaje para dos coches y trastero. Zona residencial tranquila." },
  { operation: "SALE", propertyType: "PISO", title: "Piso para reformar en zona céntrica", price: 139000, provinceCode: "25", municipality: "Lleida", zone: "Centre Històric", postalCode: "25002", builtArea: 70, bedrooms: 2, bathrooms: 1, floor: "1ª", yearBuilt: 1968, condition: "TO_REFORM", energyRating: "IN_PROGRESS", features: ["EXTERIOR"], rooms: ["fachada", "salon", "cocina", "bano"] as Room[], palette: ["#c97b4a", "#f1ebe0", "#b0906e"], text: "Piso de dos habitaciones para reformar a tu gusto, en pleno centro y a pocos minutos del mercado y de la Seu Vella." },
  { operation: "RENT", propertyType: "PISO", title: "Piso amueblado de 2 habitaciones junto al metro", price: 1150, provinceCode: "08", municipality: "Sabadell", zone: "Centre", postalCode: "08201", builtArea: 68, bedrooms: 2, bathrooms: 1, floor: "4ª", yearBuilt: 1960, condition: "GOOD", energyRating: "E", features: ["FURNISHED", "ELEVATOR", "HEATING", "EQUIPPED_KITCHEN"], rooms: ["salon", "dormitorio", "cocina", "bano"] as Room[], palette: ["#5d7f99", "#eef1f3", "#b98b5e"], text: "Piso amueblado y equipado de dos habitaciones, a dos minutos del metro. Calefacción individual y ascensor." },
  { operation: "RENT", propertyType: "ESTUDIO", title: "Estudio reformado ideal para una persona", price: 690, provinceCode: "17", municipality: "Figueres", zone: "Centre", postalCode: "17600", builtArea: 38, bedrooms: 1, bathrooms: 1, floor: "Bajo", yearBuilt: 1985, condition: "GOOD", energyRating: "F", features: ["FURNISHED", "AC", "EQUIPPED_KITCHEN"], rooms: ["salon", "cocina", "bano"] as Room[], palette: ["#e76f51", "#f6efe4", "#c49a6c"], text: "Estudio reformado con cocina abierta y aire acondicionado, en una calle tranquila del barrio." },
  { operation: "RENT", propertyType: "PISO", title: "Piso familiar con terraza y plaza de garaje", price: 950, provinceCode: "43", municipality: "Tarragona", zone: "Part Alta", postalCode: "43003", builtArea: 105, bedrooms: 3, bathrooms: 2, floor: "2ª", yearBuilt: 1999, condition: "GOOD", energyRating: "D", features: ["TERRACE", "PARKING", "ELEVATOR", "PETS"], rooms: ["terraza", "salon", "dormitorio", "cocina", "bano"] as Room[], palette: ["#2a9d8f", "#eef3ef", "#c8a27a"], text: "Piso de tres habitaciones con terraza, plaza de garaje incluida y ascensor. Se admiten mascotas." },
];

async function removeDemo() {
  const agency = await prisma.agency.findFirst({ where: { name: AGENCY_NAME } });
  if (!agency) return 0;
  const listings = await prisma.listing.findMany({ where: { agencyId: agency.id, title: { startsWith: "DEMO" } }, include: { photos: true } });
  for (const l of listings) {
    for (const p of l.photos) {
      await deleteFile(p.key);
      await deleteFile(p.key.replace(/\.webp$/, "-thumb.webp"));
    }
  }
  await prisma.listing.deleteMany({ where: { id: { in: listings.map((l) => l.id) } } });
  return listings.length;
}

async function main() {
  const removed = await removeDemo();
  if (process.argv.includes("--borrar")) {
    console.log(`Eliminados ${removed} pisos de muestra.`);
    return;
  }
  const agency =
    (await prisma.agency.findFirst({ where: { name: AGENCY_NAME } })) ??
    (await prisma.agency.create({
      data: { name: AGENCY_NAME, zones: "", email: "demo.inmobiliaria@example.com", phone: "000000000", languages: "es", propertyTypes: "", status: "ACTIVE", crmAccess: true, notes: "DEMO: datos ficticios." },
    }));
  await prisma.agency.update({ where: { id: agency.id }, data: { crmAccess: true, status: "ACTIVE", maxListings: Math.max(agency.maxListings, 25) } });
  const actor: ListingActor = { kind: "agency", agencyId: agency.id, userId: "demo-script", userName: "Pisos de muestra" };
  const admin: ListingActor = { kind: "admin", id: "demo-script" };

  for (const s of SAMPLES) {
    const rent = s.operation === "RENT";
    const l = await createListing(actor, {
      operation: s.operation,
      title: `DEMO · ${s.title}`,
      description: DEMO_NOTE + s.text,
      propertyType: s.propertyType,
      price: String(s.price),
      communityFee: rent ? "" : "70",
      provinceCode: s.provinceCode,
      municipality: s.municipality,
      zone: s.zone,
      postalCode: s.postalCode,
      builtArea: String(s.builtArea),
      bedrooms: String(s.bedrooms),
      bathrooms: String(s.bathrooms),
      floor: s.floor ?? "",
      yearBuilt: String(s.yearBuilt),
      condition: s.condition,
      features: s.features,
      energyRating: s.energyRating,
      authorizationType: "MANDATE_SHARED",
      authorizationDate: "2026-10-01",
      checkData: "on",
      checkAuthorization: "on",
      checkEnergy: "on",
      ...(rent ? { rentalType: "HABITUAL", depositMonths: "1", minTermMonths: "12", checkLegalRent: "on", rentConditions: "Gastos de suministros a cargo del inquilino. Datos de demostración." } : {}),
    });
    const [accent, wall, floor] = s.palette;
    for (const room of s.rooms) {
      const jpg = await sharp(Buffer.from(svg(room, accent, wall, floor))).jpeg({ quality: 88 }).toBuffer();
      await addPhoto(actor, l.id, jpg);
    }
    await transitionListing(actor, l.id, "submit");
    await transitionListing(admin, l.id, "publish");
    console.log(`✓ ${l.reference} · ${s.title} (${s.municipality})`);
  }
  console.log(`\nCreados ${SAMPLES.length} pisos de muestra. Se ven en /comprar y /alquilar.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
