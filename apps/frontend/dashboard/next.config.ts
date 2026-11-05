import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const API_INTERNA = process.env.API_INTERNA ?? "http://localhost:4000";
// fileURLToPath y no `.pathname`: en Windows este último da "/C:/..." y rompe el rastreo de archivos.
const RAIZ_REPO = fileURLToPath(new URL("../../../", import.meta.url));

/**
 * El frontend y la API comparten origen: sin CORS y sin dominios adicionales que
 * un observador pueda distinguir. No se usa cacheComponents/PPR porque son
 * incompatibles con la CSP por nonce de proxy.ts.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Comprime Caddy (docker/caddy/Caddyfile), que sí ofrece zstd. Si Next comprimiera primero, Caddy
  // recibiría gzip y lo dejaría pasar tal cual.
  compress: false,
  output: "standalone",
  outputFileTracingRoot: RAIZ_REPO,
  // /denunciar comprueba si existen estos archivos; solo los sirve public/, sin duplicarlos.
  outputFileTracingExcludes: { "/*": ["public/modelos/**"] },
  turbopack: {
    root: RAIZ_REPO,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  rewrites: async () => [{ source: "/api/:path*", destination: `${API_INTERNA}/api/:path*` }],
};

export default nextConfig;
