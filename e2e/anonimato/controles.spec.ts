import { expect, test } from "@playwright/test";
import {
  bitacoraDeContenedor,
  dominiosAjenos,
  docker,
  Grabadora,
  RELATO_MARCADOR,
  secretosPresentes,
  UA_MARCADOR,
  URL_BASE,
} from "./apoyo";

/**
 * Controles: comprueban que los detectores sí detectan. Sin ellos, una prueba "sin hallazgos"
 * podría pasar solo porque el detector está roto.
 */
test.describe("Controles de los detectores", () => {
  test("la grabadora detecta una petición a un tercero", async ({ browser }, info) => {
    const contexto = await browser.newContext();
    const grabadora = new Grabadora(contexto);
    await contexto.route("https://tercero.invalid/**", (ruta) =>
      ruta.fulfill({ status: 200, body: "" }),
    );
    const pagina = await contexto.newPage();
    await pagina.goto("about:blank");
    const respuesta = pagina.waitForResponse("https://tercero.invalid/rastreo.png");
    await pagina.setContent('<img src="https://tercero.invalid/rastreo.png" alt="">');
    await respuesta;

    const ajenos = dominiosAjenos(await grabadora.listas(), URL_BASE);
    await contexto.close();
    expect(ajenos).toContain("https://tercero.invalid/rastreo.png");
    info.annotations.push({ type: "evidencia", description: `Detectó ${ajenos.join(", ")}` });
  });

  test("el buscador detecta un secreto en claro y codificado", () => {
    const secreto = `palabra uno ${RELATO_MARCADOR}`;
    const formas = [
      secreto,
      encodeURIComponent(secreto),
      Buffer.from(secreto).toString("base64"),
      Buffer.from(secreto).toString("hex"),
    ];
    for (const forma of formas) {
      expect(secretosPresentes(`{"x":"${forma}"}`, { secreto })).toEqual(["secreto"]);
    }
    expect(secretosPresentes("contenido sellado", { secreto })).toEqual([]);
  });

  test("antes y después: un Caddy con bitácora de acceso sí registra IP y user-agent", async ({
    request,
  }, info) => {
    const configuracion = ':8080 {\n\tlog\n\trespond "ok"\n}\n';
    const nombre = `dataton-control-bitacora-${process.pid}`;
    docker([
      "run",
      "-d",
      "--name",
      nombre,
      "-p",
      "127.0.0.1::8080",
      "--entrypoint",
      "sh",
      "caddy:2.11.8-alpine",
      "-c",
      `printf '${configuracion.replaceAll("\n", "\\n").replaceAll("\t", "\\t")}' > /tmp/Caddyfile && caddy run --config /tmp/Caddyfile --adapter caddyfile`,
    ]);
    try {
      const puerto = docker(["port", nombre, "8080"]).trim().split(":").at(-1);
      await expect
        .poll(
          () =>
            request
              .get(`http://127.0.0.1:${puerto}/`, { headers: { "User-Agent": UA_MARCADOR } })
              .then((r) => r.status())
              .catch(() => 0),
          { timeout: 15_000 },
        )
        .toBe(200);
      await expect
        .poll(() => bitacoraDeContenedor(nombre), { timeout: 5_000 })
        .toContain(UA_MARCADOR);
      expect(bitacoraDeContenedor(nombre)).toContain("remote_ip");
      info.annotations.push({
        type: "evidencia",
        description:
          "Con `log` activado, Caddy guarda el user-agent marcador y remote_ip. El despliegue real no lo hace: ver despliegue.spec.ts.",
      });
    } finally {
      docker(["rm", "-f", nombre]);
    }
  });
});
