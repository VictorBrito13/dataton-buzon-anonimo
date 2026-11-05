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
  await expect(page.getByText("Datos reales de la PDN", { exact: true })).toBeVisible();
  await expect(page.getByText(/nunca una acusación/).first()).toBeVisible();
  await expect(page.getByText(/S6 llega hasta 2021/)).toBeVisible();
  await expect(page.getByText(/Cobertura incompleta/)).toBeVisible();
  await expect(page.getByText(/prueba de concepto/).first()).toBeVisible();
  await expect(page.getByText(/Consultado el \d{4}-\d{2}-\d{2}/).first()).toBeVisible();
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
