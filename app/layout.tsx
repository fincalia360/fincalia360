import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Tramontana · Propietarios Costa Brava", template: "%s · Tramontana" },
  description: "Valoración y acompañamiento de propietarios que quieren vender en la Costa Brava.",
  robots: { index: false, follow: false }, // demo
};

export const viewport: Viewport = {
  themeColor: "#13293D",
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
