import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HARDWIG: EMPIRE MODE",
    short_name: "EMPIRE",
    description: "Kempen Vice — persoonlijk operating system voor netwerk, missies en empire value.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0907",
    theme_color: "#0B0907",
    lang: "nl",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
