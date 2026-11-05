import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const SECCIONES = [
  "Qué guardamos",
  "Qué no guardamos",
  "De qué te protege",
  "De qué no te protege",
  "Cómo comprobarlo por tu cuenta",
  "Qué hemos comprobado hasta ahora",
];

/** Lo que esta misma suite demuestra: debe aparecer como comprobado, no como pendiente. */
const COMPROBADAS = [
  "Tu frase y tu relato en claro nunca salen de tu dispositivo.",
  "Al enviar una denuncia no se pide nada a otros dominios.",
  "Tras enviar una denuncia, la base de datos no contiene tu relato, frase ni folio.",
  "Las estadísticas públicas no muestran números pequeños.",
];

/** Lo que sigue sin prueba contra el despliegue: la página no debe afirmarlo. */
const PENDIENTES = ["Tus evidencias se limpian de datos ocultos."];

test.describe("Página /como-te-protegemos", () => {
  test("responde las preguntas del público y distingue lo pendiente", async ({ page }) => {
    await page.goto("/como-te-protegemos");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cómo te protegemos");
    for (const nombre of SECCIONES) {
      await expect(
        page.getByRole("heading", { level: 2, name: nombre, exact: true }),
      ).toBeVisible();
    }
    const fila = (texto: string) => page.locator("li").filter({ hasText: texto });
    for (const texto of COMPROBADAS) await expect(fila(texto)).toContainText("Comprobado");
    for (const texto of PENDIENTES)
      await expect(fila(texto)).toContainText("Pendiente de verificar");
    await expect(page.getByText("Pendiente de verificar")).toHaveCount(PENDIENTES.length);
  });

  test("declara que la salida rápida abre un sitio ajeno y qué borra", async ({ page }) => {
    await page.goto("/como-te-protegemos");
    const texto = page.locator("li").filter({ hasText: "salida rápida" });
    await expect(texto).toContainText("Google");
    await expect(texto).toContainText("dirección IP");
    await expect(texto).toContainText("modelo");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`sin fallas de accesibilidad WCAG A y AA en modo ${colorScheme}`, async ({
      browser,
      baseURL,
    }, info) => {
      const contexto = await browser.newContext({ baseURL, colorScheme, ignoreHTTPSErrors: true });
      const pagina = await contexto.newPage();
      await pagina.goto("/como-te-protegemos");
      const { violations, passes } = await new AxeBuilder({ page: pagina })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      await contexto.close();
      expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
      info.annotations.push({
        type: "evidencia",
        description: `axe-core: ${passes.length} reglas aprobadas, 0 violaciones`,
      });
    });
  }

  test("funciona a 320 px de ancho, sin desplazamiento horizontal", async ({
    browser,
    baseURL,
  }) => {
    const contexto = await browser.newContext({
      baseURL,
      viewport: { width: 320, height: 640 },
      ignoreHTTPSErrors: true,
    });
    const pagina = await contexto.newPage();
    await pagina.goto("/como-te-protegemos");
    const { anchoDocumento, anchoVentana } = await pagina.evaluate(() => ({
      anchoDocumento: document.documentElement.scrollWidth,
      anchoVentana: window.innerWidth,
    }));
    await contexto.close();
    expect(anchoDocumento).toBeLessThanOrEqual(anchoVentana);
  });
});
