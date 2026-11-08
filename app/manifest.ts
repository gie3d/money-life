import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Money Life",
    short_name: "Money Life",
    description: "Track what you own, and how it performs.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f2f7",
    theme_color: "#f2f2f7",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
