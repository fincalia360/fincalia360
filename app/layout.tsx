import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { publicSiteUrl } from "@/lib/site";
import { getSiteLang } from "@/lib/i18n/siteServer";

export const metadata: Metadata = {
  title: { default: "FINCALIA360 · ¿Vender o alquilar tu vivienda?", template: "%s · FINCALIA360" },
  description:
    "Descubre cuánto vale tu inmueble, qué alquiler máximo legal le corresponde y qué opción puede convenirte más: vender, alquilar o mantener.",
  applicationName: "FINCALIA360",
  // Enlaces absolutos (imágenes para compartir, canónicas): tu dominio o, si no hay, la dirección de Render
  metadataBase: new URL(publicSiteUrl()),
  // Solo se indexa en buscadores cuando se publica y se activa ALLOW_INDEXING=true
  robots: process.env.ALLOW_INDEXING === "true" ? { index: true, follow: true } : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#142B45",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={await getSiteLang()}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
