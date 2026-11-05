import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Buzón Anónimo",
    short_name: "Buzón Anónimo",
    description:
      "Denuncia faltas administrativas y hechos de corrupción sin cuenta, sin correo y sin teléfono.",
    lang: "es-MX",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f5f0",
    theme_color: "#0b5563",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/iconos/icono-mascara-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
