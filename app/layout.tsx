import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { PoiMultimediaEnhancer } from "@/components/poi-multimedia-enhancer";

export const metadata: Metadata = {
  title: "Varga Tour — I luoghi ti parlano",
  description:
    "Guida turistica intelligente per scoprire l’Italia con GPS, percorsi personalizzati, audio, orari, prenotazioni, fotografie e video.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body>
        {children}
        <PoiMultimediaEnhancer />
      </body>
    </html>
  );
}
