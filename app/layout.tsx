import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FINCALIA360 · ¿Vender o alquilar tu vivienda?", template: "%s · FINCALIA360" },
  description:
    "Descubre cuánto vale tu inmueble, qué alquiler máximo legal le corresponde y qué opción puede convenirte más: vender, alquilar o mantener.",
  applicationName: "FINCALIA360",
  ...(process.env.SITE_URL ? { metadataBase: new URL(process.env.SITE_URL) } : {}),
  // Solo se indexa en buscadores cuando se publica y se activa ALLOW_INDEXING=true
  robots: process.env.ALLOW_INDEXING === "true" ? { index: true, follow: true } : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#142B45",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
