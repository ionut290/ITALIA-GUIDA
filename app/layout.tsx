import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { PoiMultimediaEnhancer } from "@/components/poi-multimedia-enhancer";

export const metadata: Metadata = {
  title: "Italia Guida — I luoghi ti parlano",
  description:
    "Guida turistica automatica per scoprire i luoghi culturali vicini in tutta Italia con GPS, audio, fotografie e video.",
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
