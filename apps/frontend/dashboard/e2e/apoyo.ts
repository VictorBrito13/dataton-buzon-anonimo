import { mkdirSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";

const DIR_CAPTURAS = process.env.CAPTURAS_DIR ?? "test-results/capturas";

/** Revisa con axe (WCAG 2.0 A y AA) y guarda capturas en claro y oscuro. */
export const revisarPantalla = async (page: Page, info: TestInfo, nombre: string) => {
  mkdirSync(DIR_CAPTURAS, { recursive: true });
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.screenshot({
      path: join(DIR_CAPTURAS, `${info.project.name}-${nombre}-${colorScheme}.png`),
      fullPage: true,
    });
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const resumen = violations.map(
      (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    );
    expect(resumen, `${nombre} en tema ${colorScheme}`).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: "light" });
};

/** Controles de al menos 44 px de alto y ancho, salvo casillas con su etiqueta completa. */
export const revisarObjetivos = async (page: Page, nombre: string) => {
  const pequenos = await page
    .locator(
      "main a:visible, main button:visible, main select:visible, main input:not([type=radio],[type=checkbox]):visible, main summary:visible, header a:visible, nav a:visible",
    )
    .evaluateAll((elementos) =>
      elementos
        .map((el) => ({ el, caja: el.getBoundingClientRect() }))
        .filter(({ caja }) => caja.height < 44 || caja.width < 44)
        .map(({ el, caja }) => `${el.textContent?.slice(0, 30)} ${caja.width}x${caja.height}`),
    );
  expect(pequenos, nombre).toEqual([]);
};

export const sinDesbordeHorizontal = async (page: Page, nombre: string) => {
  const desborde = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(desborde, `${nombre} desborda horizontalmente`).toBeLessThanOrEqual(0);
};

/** Falla si aparece un error de consola (incluidos los de CSP) o una petición a otro dominio. */
export const vigilarPagina = (page: Page) => {
  const errores: string[] = [];
  const externas: string[] = [];
  const cuerpos: string[] = [];
  page.on("console", (mensaje) => {
    if (mensaje.type() === "error") errores.push(mensaje.text());
  });
  page.on("pageerror", (error) => errores.push(error.message));
  page.on("request", (peticion) => {
    // Un blob: se crea en la propia página, y su origen dice cuál: no es una petición de red.
    const { hostname } = new URL(new URL(peticion.url()).origin);
    if (hostname !== "localhost" && !peticion.url().startsWith("data:")) {
      externas.push(peticion.url());
    }
    cuerpos.push(`${peticion.url()} ${peticion.postData() ?? ""}`);
  });
  return { errores, externas, cuerpos };
};

export const leerFrase = async (page: Page): Promise<string> =>
  (await page.locator(".area-impresion li .font-mono").allTextContents()).join(" ");

export const llenarHechos = async (page: Page, relato: string) => {
  await page.getByLabel("¿En qué estado pasó?").selectOption("17");
  await page.getByLabel("¿Qué tipo de falta es?").selectOption("cohecho");
  await page.getByLabel("Mes").selectOption("03");
  await page.getByLabel("Año").selectOption("2026");
  await page.getByLabel("Cuéntanos qué pasó").fill(relato);
};

/** De la frase a la pantalla de envío, escribiendo las dos palabras que se piden. */
export const confirmarFrase = async (page: Page, frase: string) => {
  await page.getByRole("button", { name: "Ya la guardé" }).click();
  const palabras = frase.split(" ");
  for (const campo of await page.getByLabel(/Palabra número/).all()) {
    const etiqueta = await campo.evaluate(
      (el) => document.querySelector(`label[for="${el.id}"]`)?.textContent ?? "",
    );
    const numero = Number(/\d+/.exec(etiqueta)?.[0]);
    await campo.fill(palabras[numero - 1] ?? "");
  }
  await page.getByRole("button", { name: "Confirmar y continuar" }).click();
};
