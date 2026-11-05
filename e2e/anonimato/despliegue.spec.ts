import { expect, test, type APIResponse } from "@playwright/test";
import {
  ALMACENAMIENTO_VACIO,
  almacenamientoDe,
  CABECERAS_MARCADOR,
  compose,
  consultarBaseDeDatos,
  docker,
  dominiosAjenos,
  Grabadora,
  IP_MARCADOR,
  ipDelAnfitrion,
  leerBitacoras,
  OPCIONES_CONTEXTO_MARCADO,
  PAGINAS_PUBLICAS,
  UA_MARCADOR,
  URL_BASE,
  URL_HTTP,
  visitar,
  volcarBaseDeDatos,
} from "./apoyo";

const directiva = (csp: string, nombre: string): string =>
  csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${nombre} `)) ?? "";

const cabecerasComunes = (respuesta: APIResponse) => {
  const h = respuesta.headers();
  expect(h["strict-transport-security"]).toMatch(/max-age=\d{7,}/);
  expect(h["referrer-policy"]).toBe("no-referrer");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-powered-by"]).toBeUndefined();
  expect(h["server"]).toBeUndefined();
  expect(h["set-cookie"]).toBeUndefined();
};

test.describe("Cabeceras de seguridad", () => {
  for (const ruta of ["/", "/como-te-protegemos"]) {
    test(`página ${ruta}: CSP estricta, HSTS, no-referrer y sin X-Powered-By`, async ({
      request,
    }, info) => {
      const respuesta = await request.get(ruta);
      expect(respuesta.status()).toBe(200);
      cabecerasComunes(respuesta);

      const csp = respuesta.headers()["content-security-policy"] ?? "";
      const scriptSrc = directiva(csp, "script-src");
      expect(scriptSrc).not.toBe("");
      expect(scriptSrc).not.toContain("'unsafe-inline'");
      // 'wasm-unsafe-eval' sí se permite: solo habilita WebAssembly, que requiere Argon2id.
      expect(scriptSrc).not.toContain("'unsafe-eval'");
      expect(directiva(csp, "style-src")).not.toContain("unsafe-inline");
      expect(directiva(csp, "connect-src")).toBe("connect-src 'self'");
      expect(directiva(csp, "default-src")).toBe("default-src 'self'");
      expect(directiva(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
      info.annotations.push({
        type: "evidencia",
        description: scriptSrc.replace(/'nonce-[^']+'/, "'nonce-…'"),
      });
    });
  }

  test("API: HSTS, no-referrer y sin X-Powered-By", async ({ request }) => {
    const respuesta = await request.get("/api/health");
    expect(respuesta.status()).toBe(200);
    cabecerasComunes(respuesta);
  });

  test("archivos estáticos: HSTS y sin servidor identificado", async ({ request }) => {
    const html = await (await request.get("/")).text();
    const estatico = html.match(/\/_next\/static\/[^"']+\.js/)?.[0];
    expect(estatico).toBeTruthy();
    const respuesta = await request.get(estatico as string);
    expect(respuesta.status()).toBe(200);
    cabecerasComunes(respuesta);
  });

  test("HTTP redirige a HTTPS", async ({ request }) => {
    const respuesta = await request.get(`${URL_HTTP}/ruta?x=1`, { maxRedirects: 0 });
    expect(respuesta.status()).toBe(308);
    expect(respuesta.headers()["location"]).toBe(`${URL_BASE}/ruta?x=1`);
    expect(respuesta.headers()["server"]).toBeUndefined();
  });
});

test.describe("Páginas públicas", () => {
  for (const ruta of PAGINAS_PUBLICAS) {
    test(`${ruta}: cero terceros, sin cookies, sin almacenamiento y sin violar la CSP`, async ({
      browser,
    }, info) => {
      const contexto = await browser.newContext({ ignoreHTTPSErrors: true, baseURL: URL_BASE });
      const grabadora = new Grabadora(contexto);
      const pagina = await contexto.newPage();
      const violaciones: string[] = [];
      pagina.on("console", (m) => {
        if (/Content Security Policy/i.test(m.text())) violaciones.push(m.text());
      });

      const respuesta = await visitar(pagina, ruta);
      test.fixme(respuesta?.status() === 404, `${ruta} aún no existe en esta rama`);

      const peticiones = await grabadora.listas();
      expect(peticiones.length).toBeGreaterThan(0);
      expect(dominiosAjenos(peticiones, URL_BASE)).toEqual([]);
      expect(await contexto.cookies()).toEqual([]);
      expect(await almacenamientoDe(pagina)).toEqual(ALMACENAMIENTO_VACIO);
      expect(violaciones).toEqual([]);
      info.annotations.push({
        type: "evidencia",
        description: `${peticiones.length} peticiones observadas, todas al propio dominio`,
      });
      await contexto.close();
    });
  }
});

test.describe("Infraestructura", () => {
  test("Postgres no publica ningún puerto", () => {
    const salida = JSON.parse(compose(["ps", "--format", "json", "db"])) as {
      Publishers: { PublishedPort: number }[];
    };
    expect(salida.Publishers.filter((p) => p.PublishedPort !== 0)).toEqual([]);
  });

  test("solo Caddy publica puertos", () => {
    const filas = compose(["ps", "--format", "json"])
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as { Service: string; Publishers: { PublishedPort: number }[] });
    const conPuertos = filas
      .filter((f) => f.Publishers?.some((p) => p.PublishedPort !== 0))
      .map((f) => f.Service);
    expect(conPuertos).toEqual(["caddy"]);
  });

  for (const servicio of ["backend", "frontend", "caddy"]) {
    test(`${servicio}: usuario no root`, () => {
      expect(compose(["exec", "-T", servicio, "id", "-u"]).trim()).not.toBe("0");
    });
  }

  for (const servicio of ["db", "backend", "frontend", "caddy"]) {
    test(`${servicio}: sistema de archivos de solo lectura y sin privilegios nuevos`, () => {
      const id = compose(["ps", "-q", servicio]).trim();
      const configuracion = JSON.parse(
        docker(["inspect", id, "--format", "{{json .HostConfig}}"]),
      ) as { ReadonlyRootfs: boolean; SecurityOpt: string[]; CapDrop: string[] };
      expect(configuracion.ReadonlyRootfs).toBe(true);
      expect(configuracion.SecurityOpt).toContain("no-new-privileges:true");
      expect(configuracion.CapDrop).toContain("ALL");
    });
  }

  test("backend y frontend no tienen salida a internet", () => {
    for (const servicio of ["backend", "frontend"]) {
      expect(() =>
        compose([
          "exec",
          "-T",
          servicio,
          "node",
          "-e",
          `fetch("http://1.1.1.1/",{signal:AbortSignal.timeout(3000)}).then(()=>process.exit(0),()=>process.exit(1))`,
        ]),
      ).toThrow();
    }
  });
});

test.describe("Bitácoras y base de datos", () => {
  test("las bitácoras no guardan IP ni user-agent, incluso con errores 404 y 502", async ({
    playwright,
  }, info) => {
    const cliente = await playwright.request.newContext({
      baseURL: URL_BASE,
      ignoreHTTPSErrors: true,
      userAgent: UA_MARCADOR,
      extraHTTPHeaders: CABECERAS_MARCADOR,
    });
    for (const ruta of ["/", "/api/health", "/api/no-existe", "/no-existe"]) {
      await cliente.get(ruta);
    }

    // Con el backend detenido Caddy responde 502: justo cuando más detalle suele registrarse.
    compose(["stop", "backend"]);
    try {
      expect((await cliente.get("/api/health")).status()).toBe(502);
    } finally {
      compose(["up", "-d", "--wait", "--no-deps", "backend"]);
    }
    await cliente.dispose();

    const bitacoras = leerBitacoras();
    expect(bitacoras).toContain("[backend] listening");
    expect(bitacoras).not.toContain(UA_MARCADOR);
    expect(bitacoras).not.toContain(IP_MARCADOR);
    const anfitrion = ipDelAnfitrion();
    expect(bitacoras).not.toContain(anfitrion);
    info.annotations.push({
      type: "evidencia",
      description: `${bitacoras.split("\n").length} líneas revisadas; sin ${IP_MARCADOR}, sin la IP del anfitrión (${anfitrion}) y sin el user-agent marcador`,
    });
  });

  test("el volcado de pg_dump incluye los datos, así que buscar en él sí significa algo", () => {
    const marcador = "CONTROL_VOLCADO_91C2";
    consultarBaseDeDatos(`CREATE TABLE control_volcado (valor text);
      INSERT INTO control_volcado VALUES ('${marcador}');`);
    try {
      expect(volcarBaseDeDatos()).toContain(marcador);
    } finally {
      consultarBaseDeDatos("DROP TABLE control_volcado;");
    }
    expect(volcarBaseDeDatos()).not.toContain(marcador);
  });

  test("el esquema no tiene columnas de IP ni de user-agent", () => {
    const columnas = consultarBaseDeDatos(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public';",
    );
    expect(columnas).toContain("relato_sellado");
    expect(columnas).not.toMatch(/\b\w*(ip|user_agent|agente|navegador)\b/);
  });
});

test.describe("Marcadores", () => {
  test("el navegador marcado envía de verdad los marcadores que se buscan", async ({ browser }) => {
    const contexto = await browser.newContext({
      ...OPCIONES_CONTEXTO_MARCADO,
      ignoreHTTPSErrors: true,
      baseURL: URL_BASE,
    });
    const grabadora = new Grabadora(contexto);
    const pagina = await contexto.newPage();
    await visitar(pagina, "/");
    const [primera] = await grabadora.listas();
    await contexto.close();
    expect(primera?.cabeceras).toContain(UA_MARCADOR);
    expect(primera?.cabeceras).toContain(IP_MARCADOR);
  });
});
