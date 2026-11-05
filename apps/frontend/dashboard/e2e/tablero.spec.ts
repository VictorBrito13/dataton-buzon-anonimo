import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Requiere la API real con datos agregados y `next build && next start`.
 * BASE_URL=http://localhost:3102 npx playwright test -c playwright.tablero.config.ts
 */

const CAPTURAS = process.env.CAPTURAS_DIR ?? "test-results/tablero";

const registrarErroresCsp = (page: Page): string[] => {
  const errores: string[] = [];
  page.on("console", (mensaje) => {
    if (mensaje.type() === "error") errores.push(mensaje.text());
  });
  page.on("pageerror", (error) => errores.push(error.message));
  return errores;
};

const abrir = async (page: Page, ruta = "/tablero") => {
  await page.goto(ruta);
  await expect(page.getByRole("heading", { level: 1, name: "Tablero público" })).toBeVisible();
  await expect(page.getByText("denuncias sintéticas en")).toBeVisible();
};

for (const esquema of ["light", "dark"] as const) {
  for (const ancho of [320, 1280]) {
    test.describe(`${esquema}, ${ancho}px`, () => {
      test.use({ colorScheme: esquema, viewport: { width: ancho, height: 900 } });

      test("sin errores de CSP, sin desplazamiento lateral y sin violaciones de axe", async ({
        page,
      }) => {
        const errores = registrarErroresCsp(page);
        await abrir(page, "/tablero?estado=17#municipios");

        const desborde = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(desborde).toBeLessThanOrEqual(0);

        const { violations } = await new AxeBuilder({ page }).analyze();
        const serias = violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
        expect(
          serias.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
        ).toEqual([]);

        await page.screenshot({
          path: `${CAPTURAS}/tablero-${esquema}-${ancho}.png`,
          fullPage: true,
        });
        expect(errores).toEqual([]);
      });
    });
  }
}

test("ningún elemento usa style= en línea", async ({ page }) => {
  await abrir(page);
  await expect(page.locator("main [style]")).toHaveCount(0);
  await expect(page.locator("main svg [style]")).toHaveCount(0);
});

test("ninguna petición sale del mismo origen", async ({ page, baseURL }) => {
  const externas: string[] = [];
  page.on("request", (peticion) => {
    if (!peticion.url().startsWith(baseURL ?? "") && !peticion.url().startsWith("data:")) {
      externas.push(peticion.url());
    }
  });
  await abrir(page);
  expect(externas).toEqual([]);
});

test("clic en un estado del mapa muestra sus municipios", async ({ page }) => {
  await abrir(page);
  await page.getByRole("link", { name: /Morelos: .*Ver municipios/ }).click();
  await expect(page).toHaveURL(/estado=17/);
  await expect(page.getByRole("heading", { name: "Municipios de Morelos" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Cuernavaca", exact: true })).toBeVisible();
});

test("el mapa se recorre con teclado", async ({ page }) => {
  await abrir(page);
  const casilla = page.getByRole("link", { name: /Jalisco: .*Ver municipios/ });
  await casilla.focus();
  await expect(casilla).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/estado=14/);
});

test("el selector cambia de trimestre", async ({ page }) => {
  await abrir(page);
  await page.getByLabel("Trimestre").selectOption("2025-T4");
  await page.getByRole("button", { name: "Ver trimestre" }).click();
  await expect(page).toHaveURL(/periodo=2025-T4/);
  await expect(page.getByText("denuncias sintéticas en 2025-T4")).toBeVisible();
});

test("cada gráfica tiene una tabla equivalente", async ({ page }) => {
  await abrir(page);
  for (const grafica of ["Denuncias por tipo de falta", "Denuncias por etapa"]) {
    await expect(page.getByRole("img", { name: new RegExp(`^${grafica}`) })).toBeVisible();
    await expect(
      page.getByRole("table", { name: grafica, exact: true, includeHidden: true }),
    ).toHaveCount(1);
  }
  await expect(
    page.getByRole("table", { name: "Denuncias por estado", exact: true, includeHidden: true }),
  ).toHaveCount(1);
});

test("las celdas ocultas se explican y nunca muestran un valor", async ({ page }) => {
  await abrir(page);
  await expect(page.getByText("No damos el número exacto")).toBeVisible();
  await expect(page.getByText("< 5").first()).toBeAttached();
});

test("la gráfica coincide con la API: una etapa oculta nunca aparece como 0", async ({
  page,
  request,
}) => {
  await abrir(page);
  const respuesta = await request.get(
    "/api/v1/publico/agregados?dimensiones=etapa&periodo=2026-T3",
  );
  const { celdas } = (await respuesta.json()) as {
    celdas: { claves: { etapa: string }; conteo: number | null }[];
  };
  const ocultas = celdas.filter((c) => c.conteo === null);
  expect(ocultas.length).toBeGreaterThan(0);
  const tabla = page.getByRole("table", {
    name: "Denuncias por etapa",
    exact: true,
    includeHidden: true,
  });
  const ETIQUETAS: Record<string, string> = {
    archivada: "Archivada",
    substanciacion: "En substanciación",
    tribunal: "En el Tribunal de Justicia Administrativa",
    resuelta: "Resuelta",
    recibida: "Recibida",
    sin_competencia: "Enviada a otra autoridad",
  };
  for (const celda of ocultas) {
    const fila = tabla.locator("tr", { hasText: ETIQUETAS[celda.claves.etapa] ?? "" }).first();
    await expect(fila.locator("td").nth(1)).not.toHaveText("0");
  }
});

test("axe tampoco encuentra violaciones con las tablas equivalentes abiertas", async ({ page }) => {
  await abrir(page, "/tablero?estado=14");
  for (const detalle of await page.locator("details").all()) {
    await detalle.evaluate((d) => ((d as HTMLDetailsElement).open = true));
  }
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(
    violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
  ).toEqual([]);
});

test("los datos sintéticos y los reales se distinguen en pantalla", async ({ page }) => {
  await abrir(page);
  await expect(page.getByText("Datos sintéticos", { exact: true })).toBeVisible();
  await expect(page.getByText("Datos reales de la PDN", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Datos reales de la PDN", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/nunca una acusación/).first()).toBeVisible();
  await expect(page.getByText(/S6 llega hasta 2021/)).toBeVisible();
  await expect(page.getByText(/Cobertura incompleta/)).toBeVisible();
  await expect(page.getByText(/prueba de concepto/).first()).toBeVisible();
  await expect(page.getByText(/Consultado el \d{4}-\d{2}-\d{2}/).first()).toBeVisible();
});

test.describe("Cobertura de la PDN", () => {
  const seccion = (page: Page) =>
    page.getByRole("region", { name: "Cobertura de la PDN", exact: true });

  const API_COBERTURA = "/api/v1/publico/cobertura-pdn";

  interface Conexion {
    aplicables: number;
    conectados: number;
    porcentaje: number | null;
  }
  interface Fila {
    entidad: string | null;
    nombre: string;
    registros: number;
    s1: Conexion;
    s3: Conexion;
    s6: Conexion;
  }
  interface Cobertura {
    nacional: Fila;
    porEntidad: Fila[];
    kAnonimato: string;
    datosSinteticos: boolean;
  }

  test("se etiqueta como datos reales, separada de las denuncias sintéticas", async ({ page }) => {
    await abrir(page);
    const zona = seccion(page);
    await expect(zona.getByRole("heading", { level: 2 })).toHaveText("Cobertura de la PDN");
    await expect(zona.getByText("Datos reales de la PDN", { exact: true })).toBeVisible();
    await expect(zona.getByText(/cobertura de información, no conducta/i)).toBeVisible();
    await expect(zona.getByText(/no significa que no tenga sanciones/)).toBeVisible();
    await expect(zona.getByText(/No mide conducta ni riesgo de corrupción/)).toBeVisible();
    await expect(zona.getByText(/k-anonimato no aplica/)).toBeVisible();
  });

  test("las cifras en pantalla coinciden con la API", async ({ page, request }) => {
    const { nacional, kAnonimato, datosSinteticos } = (await (
      await request.get(API_COBERTURA)
    ).json()) as Cobertura;
    expect(kAnonimato).toBe("no_aplica");
    expect(datosSinteticos).toBe(false);
    await abrir(page);
    const enlace = seccion(page).getByRole("link", { name: /^S3/ });
    await expect(enlace).toContainText(`${nacional.s3.porcentaje}%`);
    await expect(enlace).toContainText(
      `${nacional.s3.conectados.toLocaleString("en-US")} de ${nacional.s3.aplicables.toLocaleString("en-US")}`,
    );
  });

  test("el selector de sistema cambia el mapa y funciona con teclado", async ({
    page,
    request,
  }) => {
    const { porEntidad } = (await (await request.get(API_COBERTURA)).json()) as Cobertura;
    const sonora = porEntidad.find((f) => f.entidad === "26");
    await abrir(page);
    const zona = seccion(page);
    await expect(zona.getByRole("link", { name: /^S3/ })).toHaveAttribute("aria-current", "true");
    await zona.getByRole("link", { name: /^S6/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/cobertura=s6/);
    // El encabezado fijo del sitio no debe tapar el título al llegar con el ancla.
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const titulo = await seccion(page).getByRole("heading", { level: 2 }).boundingBox();
    const encabezado = await page.locator("body header").first().boundingBox();
    expect(titulo?.y ?? 0).toBeGreaterThanOrEqual((encabezado?.y ?? 0) + (encabezado?.height ?? 0));
    await expect(seccion(page).getByRole("link", { name: /^S6/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(seccion(page).getByRole("heading", { name: /^S6 por estado/ })).toBeVisible();
    await expect(page.locator(".casilla-cobertura")).toHaveCount(32);
    await expect(page.locator(".casilla-cobertura title").nth(0)).toContainText("conectados a S6");
    expect(sonora?.s6.conectados).toBe(0);
    await expect(page.locator(".casilla-cobertura title", { hasText: "Sonora: 0 de" })).toHaveCount(
      1,
    );
  });

  test("un valor desconocido del selector no rompe la página", async ({ page }) => {
    await abrir(page, "/tablero?cobertura=%3Cscript%3E");
    await expect(seccion(page).getByRole("link", { name: /^S3/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  test("el mapa tiene una tabla equivalente con los mismos datos", async ({ page, request }) => {
    const { porEntidad } = (await (await request.get(API_COBERTURA)).json()) as Cobertura;
    await abrir(page);
    await expect(seccion(page).getByRole("img", { name: /Mapa de cuadrícula/ })).toBeVisible();
    await seccion(page).getByText("Ver la tabla con los 32 estados").click();
    const tabla = seccion(page).getByRole("table", { name: "Cobertura por estado y sistema" });
    await expect(tabla.locator("tbody tr")).toHaveCount(33);
    const morelos = porEntidad.find((f) => f.entidad === "17");
    const fila = tabla.locator("tr", { hasText: "Morelos" });
    await expect(fila.locator("td").nth(3)).toContainText(`${morelos?.s3.porcentaje}%`);
  });

  test("las descargas y el diccionario traen el conjunto, sin nombres de entes", async ({
    page,
    request,
  }) => {
    await abrir(page);
    const zona = seccion(page);
    const csv = await request.get(
      (await zona.getByRole("link", { name: "Cobertura en CSV" }).getAttribute("href")) ?? "",
    );
    expect(csv.status()).toBe(200);
    const texto = await csv.text();
    expect(texto.split("\n")[0]).toMatch(/^corte,entidad,ambito,nombre,registros,/);
    expect(texto).not.toMatch(/AYUNTAMIENTO|SECRETARIA DE/i);

    const json = await request.get(
      (await zona.getByRole("link", { name: "Cobertura en JSON" }).getAttribute("href")) ?? "",
    );
    expect(json.status()).toBe(200);
    const cuerpo = (await json.json()) as Cobertura & { diccionario: { campos: unknown[] } };
    expect(cuerpo.nacional.registros).toBe(10_144);
    expect(cuerpo.diccionario.campos.length).toBeGreaterThan(5);

    const diccionario = await request.get("/api/v1/publico/descargas/diccionario.json");
    expect(((await diccionario.json()) as { cobertura: unknown }).cobertura).toBeTruthy();
  });

  test("no toca la garantía del motor: la descarga de denuncias no lleva cobertura", async ({
    page,
    request,
  }) => {
    await abrir(page);
    const enlace = await page.getByRole("link", { name: "Agregados en CSV" }).getAttribute("href");
    const texto = await (await request.get(enlace ?? "")).text();
    expect(texto).not.toMatch(/cobertura|s3_conectados/i);
    const { alcanceCobertura } = (await (
      await request.get("/api/v1/publico/metodologia")
    ).json()) as { alcanceCobertura: string };
    expect(alcanceCobertura).toMatch(/No aplica/);
  });

  for (const esquema of ["light", "dark"] as const) {
    for (const ancho of [320, 768, 1280]) {
      test(`${esquema} a ${ancho} px: sin desborde, CSP limpia y axe sin violaciones`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: ancho, height: 900 });
        await page.emulateMedia({ colorScheme: esquema });
        const errores = registrarErroresCsp(page);
        await abrir(page, "/tablero?cobertura=s3");
        await seccion(page).getByText("Ver la tabla con los 32 estados").click();
        const desborde = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(desborde).toBeLessThanOrEqual(0);
        const { violations } = await new AxeBuilder({ page }).include("#cobertura-pdn").analyze();
        expect(
          violations
            .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
            .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
        ).toEqual([]);
        await page.locator("#cobertura-pdn").screenshot({
          path: `${CAPTURAS}/cobertura-${esquema}-${ancho}.png`,
        });
        await page
          .getByRole("region", { name: /^Mapa de cobertura/ })
          .screenshot({ path: `${CAPTURAS}/cobertura-mapa-${esquema}-${ancho}.png` });
        expect(errores).toEqual([]);
      });
    }
  }
});

test("la sección de protección muestra el ataque y su resultado real", async ({ page }) => {
  await abrir(page);
  await expect(page.getByRole("heading", { name: "Cómo protegemos estas cifras" })).toBeVisible();
  await expect(page.getByText(/9 − 8/)).toBeVisible();
  await expect(page.getByText("1 a 4")).toBeVisible();
});

test("las descargas responden con cifras protegidas", async ({ request, page }) => {
  await abrir(page);
  const enlace = await page.getByRole("link", { name: "Agregados en CSV" }).getAttribute("href");
  const csv = await request.get(enlace ?? "");
  expect(csv.status()).toBe(200);
  const texto = await csv.text();
  expect(texto.split("\n")[0]).toContain("conteo,motivo,k,datos_sinteticos");
  // Toda fila oculta sale con el conteo vacío.
  const ocultas = texto.split("\n").filter((l) => /,(menor_a_k|supresion_complementaria),/.test(l));
  expect(ocultas.length).toBeGreaterThan(0);
  for (const linea of ocultas) expect(linea).toMatch(/,,(menor_a_k|supresion_complementaria),/);

  const json = await request.get("/api/v1/publico/descargas/diccionario.json");
  expect((await json.json()).campos.length).toBeGreaterThan(5);
});
