import { NextResponse, type NextRequest } from "next/server";

/**
 * CSP estricta por petición. connect-src y script-src en 'self' son la garantía
 * técnica de "sin terceros". 'wasm-unsafe-eval' lo requiere Argon2id (WASM).
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  const cabeceras = new Headers(request.headers);
  cabeceras.set("x-nonce", nonce);
  cabeceras.set("Content-Security-Policy", csp);

  const respuesta = NextResponse.next({ request: { headers: cabeceras } });
  respuesta.headers.set("Content-Security-Policy", csp);
  respuesta.headers.set("Referrer-Policy", "no-referrer");
  respuesta.headers.set("X-Content-Type-Options", "nosniff");
  respuesta.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  respuesta.headers.set("Cache-Control", "no-store");
  return respuesta;
}

export const config = {
  matcher: [{ source: "/((?!api|_next/static|_next/image|favicon.ico).*)" }],
};
