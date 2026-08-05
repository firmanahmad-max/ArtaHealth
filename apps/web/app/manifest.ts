import type { MetadataRoute } from "next";

/** Manifest PWA — warna & nama mengikuti design token (ui-ux-spec §1). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ArtaHealth — AI Personal Health Companion",
    short_name: "ArtaHealth",
    description: "Teman kesehatan pribadi yang memahami kebiasaan Anda, bukan sekadar mencatat data.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0E1A",
    theme_color: "#0A0E1A",
    lang: "id",
    categories: ["health", "lifestyle", "medical"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Catat Air", short_name: "Catat Air", url: "/?log=hydration" },
      { name: "Timeline", short_name: "Timeline", url: "/timeline" },
    ],
  };
}
