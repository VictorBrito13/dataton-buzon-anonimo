import type { NextConfig } from "next";

const API_INTERNA = process.env.API_INTERNA ?? "http://localhost:4000";

/**
 * El frontend y la API comparten origen: sin CORS y sin dominios adicionales que
 * un observador pueda distinguir. No se usa cacheComponents/PPR porque son
 * incompatibles con la CSP por nonce de proxy.ts.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  outputFileTracingRoot: new URL("../../../", import.meta.url).pathname,
  // /denunciar comprueba si existen estos archivos; solo los sirve public/, sin duplicarlos.
  outputFileTracingExcludes: { "/*": ["public/modelos/**"] },
  turbopack: {
    root: new URL("../../../", import.meta.url).pathname,
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
