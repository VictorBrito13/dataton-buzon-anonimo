import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  ALMACENAMIENTO_VACIO,
  almacenamientoDe,
  completarDenuncia,
  dominiosAjenos,
  EXIGIR_FLUJO,
  flujoDisponible,
  Grabadora,
  IP_MARCADOR,
  ipDelAnfitrion,
  leerBitacoras,
  OPCIONES_CONTEXTO_MARCADO,
  type PeticionGrabada,
  RELATO_MARCADOR,
  type ResultadoFlujo,
  secretosPresentes,
  UA_MARCADOR,
  URL_BASE,
  volcarBaseDeDatos,
} from "./apoyo";

/**
 * Recorre el flujo real una vez, con un navegador marcado, y lo examina desde cada ángulo.
 * Sin formulario, las pruebas quedan en `fixme`; `ANONIMATO_EXIGIR_FLUJO=1` las vuelve fallas,
 * para que al integrar un formulario roto no pase por pendiente.
 */
test.describe.serial("Flujo de denuncia", () => {
  let contexto: BrowserContext;
  let pagina: Page;
  let peticiones: PeticionGrabada[];
  let flujo: ResultadoFlujo;

  test.beforeAll(async ({ browser }) => {
    contexto = await browser.newContext({
      ...OPCIONES_CONTEXTO_MARCADO,
      ignoreHTTPSErrors: true,
      baseURL: URL_BASE,
    });
    const grabadora = new Grabadora(contexto);
    pagina = await contexto.newPage();

    const disponible = await flujoDisponible(pagina);
    if (!disponible && EXIGIR_FLUJO) {
      throw new Error("ANONIMATO_EXIGIR_FLUJO=1 y /denunciar no expone denuncia-formulario");
    }
    test.fixme(!disponible, "El formulario de /denunciar aún no está integrado en esta rama");

    flujo = await completarDenuncia(pagina);
    peticiones = await grabadora.listas();
  });

  test.afterAll(async () => {
    await contexto?.close();
  });

  test("el flujo se completó y envió la denuncia", () => {
    expect(flujo.frase.split(/\s+/)).toHaveLength(6);
    expect(flujo.folio).toMatch(/^BZ(-[0-9A-Z]{4}){4}$/);
    const envio = peticiones.filter(
      (p) => p.metodo === "POST" && p.url.endsWith("/api/v1/denuncias"),
    );
    expect(envio).toHaveLength(1);
  });

  test("ningún request sale a un dominio distinto del propio", ({}, info) => {
    expect(dominiosAjenos(peticiones, URL_BASE)).toEqual([]);
    info.annotations.push({
      type: "evidencia",
      description: `${peticiones.length} peticiones observadas`,
    });
  });

  test("la frase y el relato no aparecen en cuerpo, URL ni cabeceras", () => {
    const secretos = { frase: flujo.frase, relato: flujo.relato, marcador: RELATO_MARCADOR };
    const fugas = peticiones.flatMap((p) => {
      const partes = { url: p.url, cabeceras: p.cabeceras, cuerpo: p.cuerpo };
      return Object.entries(partes).flatMap(([parte, contenido]) =>
        secretosPresentes(contenido, secretos).map((s) => `${s} en ${parte} de ${p.url}`),
      );
    });
    expect(fugas).toEqual([]);
  });

  test("sin cookies ni almacenamiento local si no se activó el borrador", async () => {
    expect(await contexto.cookies()).toEqual([]);
    expect(await almacenamientoDe(pagina)).toEqual(ALMACENAMIENTO_VACIO);
  });

  test("pg_dump no contiene relato, frase, folio ni IP de prueba", () => {
    const volcado = volcarBaseDeDatos();
    expect(volcado).toContain("INSERT INTO public.denuncias");
    const presentes = secretosPresentes(volcado, {
      relato: flujo.relato,
      marcador: RELATO_MARCADOR,
      frase: flujo.frase,
      folio: flujo.folio,
      ip: IP_MARCADOR,
      ipAnfitrion: ipDelAnfitrion(),
      userAgent: UA_MARCADOR,
    });
    expect(presentes).toEqual([]);
  });

  test("las bitácoras de backend y Caddy no contienen IP ni user-agent", () => {
    const presentes = secretosPresentes(leerBitacoras(), {
      ip: IP_MARCADOR,
      ipAnfitrion: ipDelAnfitrion(),
      userAgent: UA_MARCADOR,
      frase: flujo.frase,
      folio: flujo.folio,
      marcador: RELATO_MARCADOR,
    });
    expect(presentes).toEqual([]);
  });
});
