import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Italia Guida",
    short_name: "Italia",
    description:
      "Guida turistica automatica per i luoghi culturali vicini in tutta Italia.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4efe5",
    theme_color: "#8f2d24",
    lang: "it",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
