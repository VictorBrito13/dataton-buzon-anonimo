import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  llenarHechos,
  revisarObjetivos,
  revisarPantalla,
  sinDesbordeHorizontal,
  vigilarPagina,
} from "./apoyo";

const OPCION = "Buscar también nombres, cargos y lugares";
const ESTADO = "main div[role=status][aria-live=polite]";
const RELATO =
  "María Hernández, la directora de Obras en Pachuca, me pidió dinero en la ventanilla 3. Mi teléfono es 5512345678.";
const ARCHIVO_MODELO = /\/modelos\/.*model_quantized\.onnx$/;
const CON_MODELO = existsSync(
  join(
    process.cwd(),
    "public/modelos/Xenova/distilbert-base-multilingual-cased-ner-hrl/onnx/model_quantized.onnx",
  ),
);

const irARevision = async (page: Page) => {
  await page.goto("/denunciar");
  await llenarHechos(page, RELATO);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Revisión", level: 2 })).toBeFocused();
  await expect(page.locator("main ol li").filter({ hasText: "«5512345678»" })).toBeVisible();
};

const sinFugas = (vigilancia: ReturnType<typeof vigilarPagina>) => {
  expect(vigilancia.errores).toEqual([]);
  expect(vigilancia.externas).toEqual([]);
  const trafico = vigilancia.cuerpos.join("\n");
  expect(trafico).not.toContain("Hernández");
  expect(trafico).not.toContain("5512345678");
};

test("sin activarla no se pide ningún archivo del modelo", async ({ page }) => {
  const vigilancia = vigilarPagina(page);
  await irARevision(page);
  await expect(page.getByLabel(OPCION)).not.toBeChecked();
  expect(vigilancia.cuerpos.filter((p) => p.includes("/modelos/"))).toEqual([]);
  sinFugas(vigilancia);
});

test.describe("con el modelo en el despliegue", () => {
  test.skip(!CON_MODELO, "Requiere node scripts/descargar-modelo.mjs");
  test.setTimeout(240_000);

  test("sugiere nombres en el dispositivo y la persona decide", async ({ page }, info) => {
    const vigilancia = vigilarPagina(page);
    await irARevision(page);
    await revisarPantalla(page, info, "modelo-1-apagada");

    await page.getByLabel(OPCION).check();
    const estado = page.locator(ESTADO);
    await expect(estado).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar", exact: true })).toBeVisible();
    await revisarObjetivos(page, "modelo cargando");

    await expect(estado).toContainText("Búsqueda terminada", { timeout: 180_000 });
    await expect(page.getByRole("button", { name: "Cancelar", exact: true })).toBeHidden();

    // Lo del modelo llega con el mismo tratamiento y marcado como sugerencia.
    const persona = page.locator("main ol li").filter({ hasText: "Hernández" });
    await expect(persona).toBeVisible();
    await expect(persona).toContainText("Sugerencia automática");
    await expect(page.locator("main ol li").filter({ hasText: "«5512345678»" })).not.toContainText(
      "Sugerencia automática",
    );
    await expect(page.getByText(/sugerencias? automáticas?/).first()).toBeVisible();
    await revisarPantalla(page, info, "modelo-2-sugerencias");
    await sinDesbordeHorizontal(page, "sugerencias");

    await persona.getByRole("button", { name: "Reemplazar por [persona]" }).click();
    await expect(page.locator("mark").filter({ hasText: "Hernández" })).toHaveCount(0);
    await expect(page.getByText("[persona]").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Datos que podrían identificarte" }),
    ).toBeFocused();

    const cargo = page.locator("main ol li").filter({ hasText: "directora" });
    await cargo.getByRole("button", { name: "Dejarlo así" }).click();
    await expect(page.locator("main ol li").filter({ hasText: "directora" })).toHaveCount(0);

    const peticionesDelModelo = () =>
      vigilancia.cuerpos.filter((p) => ARCHIVO_MODELO.test(p.trim())).length;
    const antesDeReactivar = peticionesDelModelo();

    // Apagarla quita las sugerencias y conserva la decisión de reemplazar.
    await page.getByLabel(OPCION).uncheck();
    await expect(page.getByText("Sugerencia automática")).toHaveCount(0);
    await expect(page.locator("main ol li").filter({ hasText: "«5512345678»" })).toBeVisible();
    await expect(page.getByText("[persona]").first()).toBeVisible();

    // Se puede volver a activar: el marcador [persona] no se trata como un nombre.
    await page.getByLabel(OPCION).check();
    await expect(estado).toContainText("Búsqueda terminada", { timeout: 180_000 });
    await expect(page.locator("main ol li").filter({ hasText: "persona]" })).toHaveCount(0);
    await expect(page.locator("main ol li").filter({ hasText: "directora" })).toHaveCount(0);

    // La segunda vez sale de la caché del navegador: no se vuelve a descargar.
    expect(peticionesDelModelo()).toBe(antesDeReactivar);
    sinFugas(vigilancia);
  });

  test("mientras carga se puede continuar y el resultado espera al volver", async ({ page }) => {
    const vigilancia = vigilarPagina(page);
    await irARevision(page);
    await page.getByLabel(OPCION).check();
    await page.getByRole("button", { name: "Atrás" }).click();
    await expect(page.getByRole("heading", { name: "Evidencias", level: 2 })).toBeFocused();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByLabel(OPCION)).toBeChecked();
    await expect(page.locator("main ol li").filter({ hasText: "Hernández" })).toBeVisible({
      timeout: 180_000,
    });
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Tu frase", level: 2 })).toBeFocused();
    sinFugas(vigilancia);
  });

  test("cancelar detiene la carga y deja el foco en la casilla", async ({ page }, info) => {
    await page.route(ARCHIVO_MODELO, async (ruta) => {
      await new Promise((resolver) => setTimeout(resolver, 15_000));
      await ruta.fulfill({ status: 503 }).catch(() => undefined);
    });
    const vigilancia = vigilarPagina(page);
    await irARevision(page);
    await page.getByLabel(OPCION).check();
    const cancelar = page.getByRole("button", { name: "Cancelar", exact: true });
    await expect(page.locator(ESTADO)).toContainText("Descargando el modelo");
    await revisarPantalla(page, info, "modelo-5-descargando");
    await cancelar.focus();
    await cancelar.press("Enter");
    await expect(page.getByLabel(OPCION)).not.toBeChecked();
    await expect(page.getByLabel(OPCION)).toBeFocused();
    await expect(page.getByText("Cancelaste la búsqueda")).toBeVisible();
    await expect(page.locator("main ol li").filter({ hasText: "«5512345678»" })).toBeVisible();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Tu frase", level: 2 })).toBeFocused();
    expect(vigilancia.externas).toEqual([]);
  });

  test("si la carga falla lo dice, sigue con reglas y deja continuar", async ({ page }, info) => {
    await page.route(ARCHIVO_MODELO, (ruta) => ruta.fulfill({ status: 500, body: "" }));
    await irARevision(page);
    await page.getByLabel(OPCION).check();
    await expect(page.getByText("No pudimos usar el modelo")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByLabel(OPCION)).not.toBeChecked();
    await expect(page.locator("main ol li").filter({ hasText: "«5512345678»" })).toBeVisible();
    await revisarPantalla(page, info, "modelo-3-fallo");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Tu frase", level: 2 })).toBeFocused();
  });
});

test.describe("sin el modelo en el despliegue", () => {
  test.skip(CON_MODELO, "Requiere un despliegue sin public/modelos");

  test("la opción lo dice en vez de fallar", async ({ page }, info) => {
    const vigilancia = vigilarPagina(page);
    await irARevision(page);
    await expect(page.getByLabel(OPCION)).toBeDisabled();
    await expect(page.getByText("no está disponible en este sitio")).toBeVisible();
    await revisarPantalla(page, info, "modelo-4-sin-modelo");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Tu frase", level: 2 })).toBeFocused();
    expect(vigilancia.cuerpos.filter((p) => p.includes("/modelos/"))).toEqual([]);
    sinFugas(vigilancia);
  });
});

test("reemplazar lo sugerido y volver a buscar no marca los propios marcadores", async ({
  page,
}) => {
  test.skip(!CON_MODELO, "Requiere node scripts/descargar-modelo.mjs");
  test.setTimeout(240_000);
  await page.goto("/denunciar");
  await llenarHechos(
    page,
    "Ana Luisa Gómez trabaja en el Instituto Mexicano del Seguro Social en Monterrey, Nuevo León. La secretaria de Finanzas lo sabe.",
  );
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel(OPCION).check();
  const estado = page.locator(ESTADO);
  await expect(estado).toContainText("Búsqueda terminada", { timeout: 180_000 });

  const hallazgos = page.locator("main ol li").filter({ hasText: "«" });
  const encontrados = await hallazgos.allTextContents();
  test.info().annotations.push({ type: "hallazgos", description: encontrados.join(" | ") });
  expect(encontrados.length).toBeGreaterThan(1);
  while ((await hallazgos.count()) > 0) {
    await hallazgos
      .first()
      .getByRole("button", { name: /^Reemplazar por/ })
      .click();
  }

  await page.getByLabel(OPCION).uncheck();
  await page.getByLabel(OPCION).check();
  await expect(estado).toContainText("Búsqueda terminada", { timeout: 180_000 });
  expect(await hallazgos.allTextContents()).toEqual([]);
});

/** Con desplazamiento real y foco de teclado: el encabezado fijo no debe tapar la frase ni el foco. */
for (const ancho of [390, 320]) {
  test(`a ${ancho} px el encabezado fijo no tapa la frase ni el foco`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 600 });
    await irARevision(page);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Tu frase", level: 2 })).toBeFocused();

    /** Lo que de verdad se ve en el borde superior del foco, no solo su posición. */
    const medir = () =>
      page.evaluate(() => {
        const activo = document.activeElement;
        const caja = activo?.getBoundingClientRect();
        const encima = caja && document.elementFromPoint(caja.left + caja.width / 2, caja.top + 1);
        return {
          scrollY: window.scrollY,
          oculto: Boolean(activo && encima && !activo.contains(encima) && !encima.contains(activo)),
          texto: activo?.textContent?.slice(0, 30) ?? "",
        };
      });

    // El encabezado no se queda con más alto del que el sitio reserva al desplazarse con foco.
    const espacio = await page.evaluate(() => {
      const raiz = getComputedStyle(document.documentElement);
      return {
        reservado: parseFloat(raiz.scrollPaddingTop),
        alto: document.querySelector("header")?.getBoundingClientRect().height ?? 0,
      };
    });
    expect(espacio.alto).toBeLessThan(espacio.reservado);

    // Con Tab y Shift+Tab, desde el final de la página, ningún foco queda oculto.
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
    const abajo = await page.evaluate(() => window.scrollY);
    expect(abajo, "la página debe desplazarse para que la prueba valga").toBeGreaterThan(0);
    for (const tecla of ["Shift+Tab", "Tab"]) {
      for (let i = 0; i < 16; i++) {
        await page.keyboard.press(tecla);
        const medida = await medir();
        expect(
          medida.oculto,
          `${tecla} ${i}: «${medida.texto}» con scrollY ${medida.scrollY}`,
        ).toBe(false);
      }
    }

    // Al llevar al foco cada botón y volver atrás, con la página arriba o abajo.
    for (const nombre of ["Copiar", "Imprimir", "Mostrar código QR", "Ya la guardé"]) {
      // Sin soltar el foco, enfocar lo ya enfocado no desplaza nada y la medida no valdría.
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        window.scrollTo({ top: document.body.scrollHeight });
      });
      await page.getByRole("button", { name: nombre }).focus();
      expect((await medir()).oculto, nombre).toBe(false);
    }

    // Volver desde la confirmación enfoca el título de la frase, con la página desplazada.
    await page.getByRole("button", { name: "Ya la guardé" }).click();
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
    await page.getByRole("button", { name: "Volver a ver mi frase" }).click();
    await expect(page.getByRole("heading", { name: "Tu frase", level: 3 })).toBeFocused();
    expect((await medir()).oculto).toBe(false);

    // Desplazando a mano, el título de la frase y la primera palabra se pueden dejar a la vista.
    const palabra = page.locator(".area-impresion li .font-mono").first();
    await palabra.evaluate((el) => el.scrollIntoView({ block: "start" }));
    const visible = await palabra.evaluate((el) => ({
      arriba: el.getBoundingClientRect().top,
      fondo: document.querySelector("header")?.getBoundingClientRect().bottom ?? 0,
    }));
    expect(visible.arriba).toBeGreaterThanOrEqual(visible.fondo);
  });
}
