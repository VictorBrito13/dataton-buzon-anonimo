import { join } from "node:path";
import { aBase64Url, generarParDeClaves, sellar } from "@dataton/shared";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { confirmarFrase, leerFrase, llenarHechos } from "./apoyo";

const ID = "6f1c1c1e-3f0a-4a53-9a55-0d3f6a1b2c3d";
const DIR_CAPTURAS = process.env.CAPTURAS_RESPONSIVE;

const VENTANAS = [
  { nombre: "320", width: 320, height: 640, zoom: false },
  { nombre: "360", width: 360, height: 740, zoom: false },
  { nombre: "390", width: 390, height: 844, zoom: false },
  { nombre: "768", width: 768, height: 1024, zoom: false },
  { nombre: "1024", width: 1024, height: 768, zoom: false },
  { nombre: "1440", width: 1440, height: 900, zoom: false },
  { nombre: "1920", width: 1920, height: 1080, zoom: false },
  { nombre: "horizontal-844", width: 844, height: 390, zoom: false },
  // WCAG 1.4.4: solo crece el texto, no la ventana. 320 es el caso más difícil.
  { nombre: "texto-200-320", width: 320, height: 640, zoom: true },
  { nombre: "texto-200-390", width: 390, height: 844, zoom: true },
  { nombre: "texto-200-1280", width: 1280, height: 800, zoom: true },
];

/** Enlaces dentro de un texto o una celda: WCAG 2.5.8 los exceptúa y crecerlos rompería la lectura. */
const CONTROLES = "a, button, select, input:not([type=hidden]), textarea, summary";

const revisar = async (page: Page, nombreVentana: string, pantalla: string) => {
  const zoom = nombreVentana.startsWith("texto-");
  if (zoom) {
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
  }
  const contexto = `${pantalla} a ${nombreVentana}`;

  // Los elementos dentro de una región con desplazamiento propio no ensanchan la página.
  const culpables = await page.evaluate(() => {
    const raiz = document.documentElement;
    if (raiz.scrollWidth <= raiz.clientWidth) return [];
    return [...document.body.querySelectorAll<HTMLElement>("*")]
      .filter((el) => {
        if (el.getBoundingClientRect().right <= raiz.clientWidth + 1) return false;
        const padre = el.parentElement?.closest("[role=region], [class*=overflow-x]");
        return !padre;
      })
      .slice(0, 8)
      .map((el) => `${el.tagName}.${el.className}`.slice(0, 90));
  });
  expect.soft(culpables, `${contexto}: desplazamiento lateral de página`).toEqual([]);

  const pequenos = await page.locator(CONTROLES).evaluateAll((elementos) =>
    elementos.flatMap((el) => {
      const caja = el.getBoundingClientRect();
      if (caja.width === 0 || caja.height === 0) return [];
      const entrada = el as HTMLInputElement;
      if (entrada.type === "radio" || entrada.type === "checkbox") return [];
      if (el.classList.contains("sr-only") || el.closest("[hidden], .sr-only")) return [];
      if (el.tagName === "A" && el.closest("p, td")) return [];
      if (caja.height >= 44 && caja.width >= 24) return [];
      return [
        `${el.tagName} «${(el.textContent ?? "").trim().slice(0, 30)}» ${Math.round(caja.width)}x${Math.round(caja.height)}`,
      ];
    }),
  );
  expect.soft(pequenos, `${contexto}: objetivos táctiles menores a 44 px`).toEqual([]);

  const sinRegion = await page.locator("table").evaluateAll((tablas) =>
    tablas.flatMap((tabla) => {
      const padre = tabla.parentElement as HTMLElement;
      if (tabla.getBoundingClientRect().width <= padre.clientWidth + 1) return [];
      const ok =
        padre.getAttribute("role") === "region" &&
        padre.getAttribute("tabindex") === "0" &&
        Boolean(padre.getAttribute("aria-label") ?? padre.getAttribute("aria-labelledby"));
      return ok ? [] : [tabla.querySelector("caption")?.textContent ?? "tabla sin título"];
    }),
  );
  expect.soft(sinRegion, `${contexto}: tabla ancha sin región desplazable`).toEqual([]);

  if (DIR_CAPTURAS) {
    await page.evaluate(() => window.scrollTo(0, 0));
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await page.screenshot({
        path: join(DIR_CAPTURAS, `${nombreVentana}-${pantalla}-${colorScheme}.png`),
        fullPage: true,
      });
    }
    await page.emulateMedia({ colorScheme: "light" });
  }
};

/** Cada ventana fija su propio tamaño: repetir el recorrido en otro proyecto no aporta nada. */
const soloUnProyecto = () =>
  test.beforeEach(({ browserName: _ }, info) => {
    test.skip(info.project.name !== "escritorio");
  });

const simularAutoridad = async (page: Page) => {
  const { publica } = await generarParDeClaves();
  const sello = aBase64Url(
    await sellar(publica, new TextEncoder().encode("Vi un pago en efectivo.")),
  );
  const resumen = {
    id: ID,
    estado: "17",
    municipio: "17007",
    tipoFalta: "peculado",
    enteId: "ficticio-01",
    etapa: "turnada_investigadora",
    recibidaDia: "2026-03-01",
  };
  let conSesion = false;
  await page.route("**/api/v1/autoridad/**", async (ruta) => {
    const camino = new URL(ruta.request().url()).pathname.replace("/api/v1", "");
    if (camino === "/autoridad/sesion") {
      conSesion = true;
      return ruta.fulfill({ status: 204 });
    }
    if (!conSesion) {
      return ruta.fulfill({ status: 401, json: { error: { message: "No autorizado" } } });
    }
    if (camino === "/autoridad/denuncias") {
      return ruta.fulfill({ json: [resumen, { ...resumen, id: ID.replace("6f", "7a") }] });
    }
    if (camino === `/autoridad/denuncias/${ID}`) {
      return ruta.fulfill({
        json: {
          ...resumen,
          relatoSellado: sello,
          lineaTiempo: [
            { etapa: "recibida", dia: "2026-03-01" },
            { etapa: "turnada_investigadora", dia: "2026-03-05" },
          ],
          evidencias: [{ id: ID, tipo: "application/pdf" }],
          mensajes: [
            { autor: "denunciante", dia: "2026-03-02", cuerpo: null, cuerpoSellado: sello },
          ],
        },
      });
    }
    return ruta.fulfill({ status: 404, json: { error: { message: "No encontrado" } } });
  });
};

for (const ventana of VENTANAS) {
  test.describe(`a ${ventana.nombre}`, () => {
    test.use({ viewport: { width: ventana.width, height: ventana.height } });
    soloUnProyecto();
    test.setTimeout(240_000);

    test("páginas sin desbordes", async ({ page }) => {
      for (const [ruta, pantalla] of [
        ["/", "inicio"],
        ["/seguimiento", "seguimiento"],
        ["/tablero", "tablero"],
        ["/tablero?estado=17#municipios", "tablero-municipios"],
        ["/como-te-protegemos", "como-te-protegemos"],
        ["/esta-ruta-no-existe", "404"],
      ] as const) {
        await page.goto(ruta);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        if (pantalla === "tablero" || pantalla === "tablero-municipios") {
          await expect(page.getByText("denuncias sintéticas en")).toBeVisible();
          for (const detalle of await page.locator("main details").all()) {
            await detalle.evaluate((d) => ((d as HTMLDetailsElement).open = true));
          }
        }
        await revisar(page, ventana.nombre, pantalla);
      }
    });

    test("todos los pasos de la denuncia sin desbordes", async ({ page }) => {
      const relato = "En la ventanilla 3 me pidieron dinero. Mi teléfono es 5512345678.";
      await page.goto("/denunciar");
      await expect(page.getByRole("heading", { name: "Qué pasó" })).toBeVisible();
      await page.getByRole("button", { name: "Continuar" }).click();
      await expect(page.locator("main [role=alert]")).toBeFocused();
      await revisar(page, ventana.nombre, "denuncia-1-errores");
      await llenarHechos(page, relato);
      await page.getByText("¿No sabes cuál elegir?").click();
      await page.getByLabel(/Alguien que trabaja en gobierno/).check();
      await revisar(page, ventana.nombre, "denuncia-1-hechos");

      await page.getByRole("button", { name: "Continuar" }).click();
      await page.getByRole("button", { name: "Agregar una persona o ente" }).click();
      await revisar(page, ventana.nombre, "denuncia-2-personas");

      await page.getByRole("button", { name: "Continuar" }).click();
      await expect(page.getByRole("heading", { name: "Evidencias", level: 2 })).toBeFocused();
      await page.getByLabel("Elige tus archivos").setInputFiles({
        name: "un-nombre-de-archivo-muy-largo-sin-espacios-para-forzar-el-ajuste-de-linea.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
          "base64",
        ),
      });
      await expect(page.getByText("Software de edición")).toBeVisible();
      await revisar(page, ventana.nombre, "denuncia-3-evidencias");

      await page.getByRole("button", { name: "Continuar" }).click();
      await expect(page.getByRole("heading", { name: "Revisión", level: 2 })).toBeFocused();
      await expect(page.locator("mark").filter({ hasText: "5512345678" })).toBeVisible();
      await revisar(page, ventana.nombre, "denuncia-4-revision");

      await page.getByRole("button", { name: "Continuar" }).click();
      await expect(page.getByRole("heading", { name: "Tu frase", level: 2 })).toBeFocused();
      const frase = await leerFrase(page);
      await page.getByRole("button", { name: "Mostrar código QR" }).click();
      await revisar(page, ventana.nombre, "denuncia-5-frase");

      await confirmarFrase(page, frase);
      await expect(page.getByRole("heading", { name: "Envío", level: 2 })).toBeFocused();
      await revisar(page, ventana.nombre, "denuncia-6-envio");

      await page.getByRole("button", { name: "Enviar mi denuncia" }).click();
      await expect(page.getByRole("heading", { name: "Tu denuncia se envió" })).toBeFocused({
        timeout: 60_000,
      });
      await revisar(page, ventana.nombre, "denuncia-7-final");

      const folio = (await page.locator(".area-impresion .font-mono").textContent()) ?? "";
      await page.getByRole("link", { name: "Ir a seguimiento" }).click();
      await expect(page.getByRole("tab", { name: "Con mi folio" })).toBeVisible();
      await page.getByLabel("Tu folio").fill(folio);
      await page.getByRole("button", { name: "Ver mi denuncia" }).click();
      await expect(page.getByRole("heading", { name: /Etapa actual/ })).toBeFocused({
        timeout: 60_000,
      });
      await revisar(page, ventana.nombre, "seguimiento-detalle");
    });

    test("panel de autoridad sin desbordes", async ({ page }) => {
      await simularAutoridad(page);
      await page.goto("/autoridad");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await revisar(page, ventana.nombre, "autoridad-entrada");
      await page.getByLabel("Usuario").fill("tramite");
      await page.getByLabel("Contraseña").fill("correcta");
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page.getByRole("heading", { name: "Denuncias recibidas" })).toBeVisible();
      await expect(page.getByText("2 de 2 denuncias")).toBeVisible();
      await revisar(page, ventana.nombre, "autoridad-lista");
      await page.getByRole("link", { name: ID.slice(0, 8) }).click();
      await expect(page.getByRole("heading", { name: /Denuncia/, level: 1 })).toBeVisible();
      await revisar(page, ventana.nombre, "autoridad-detalle");
    });
  });
}

test.describe("encabezado fijo", () => {
  test.use({ viewport: { width: 320, height: 640 } });
  soloUnProyecto();

  test("no cubre el elemento enfocado al recorrer con teclado", async ({ page }) => {
    await page.goto("/");
    const tapados: string[] = [];
    for (let i = 0; i < 18; i += 1) {
      await page.keyboard.press("Tab");
      const estado = await page.evaluate(() => {
        const activo = document.activeElement as HTMLElement;
        const fijo = document.querySelector("header") as HTMLElement;
        // El enlace de salto va por encima del encabezado a propósito.
        if (activo === document.body || fijo.contains(activo)) return null;
        if (activo.getAttribute("href") === "#contenido") return null;
        const caja = activo.getBoundingClientRect();
        const borde = fijo.getBoundingClientRect().bottom;
        // Una región más alta que el espacio libre no puede verse completa; basta que asome.
        const cabe = caja.height <= window.innerHeight - borde;
        const tapado = cabe ? caja.top < borde : caja.bottom <= borde;
        return tapado ? activo.outerHTML.slice(0, 80) : null;
      });
      if (estado) tapados.push(estado);
    }
    expect(tapados).toEqual([]);
  });
});

test.describe("selector de tema", () => {
  soloUnProyecto();
  const selector = (page: Page) => page.locator("summary[aria-label^='Tema']");
  const fondo = (page: Page) =>
    page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  test("guarda la elección, no destella al recargar y respeta la CSP", async ({ page }) => {
    const errores: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errores.push(m.text());
    });
    page.on("pageerror", (e) => errores.push(e.message));
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);

    await selector(page).click();
    await page.getByRole("radio", { name: "Oscuro" }).check();
    await expect(page.locator("html")).toHaveAttribute("data-tema", "oscuro");
    expect(await fondo(page)).toBe("rgb(17, 24, 31)");
    expect(await page.evaluate(() => localStorage.getItem("buzon:tema"))).toBe("oscuro");
    await expect(selector(page)).toHaveAccessibleName("Tema: Oscuro");

    // Antes de hidratar: el tema ya llegó en el primer pintado, con JavaScript de la app bloqueado.
    await page.route("**/_next/static/**/*.js", (ruta) => ruta.abort());
    await page.reload();
    expect(await fondo(page)).toBe("rgb(17, 24, 31)");
    await page.unroute("**/_next/static/**/*.js");
    errores.length = 0;

    await page.reload();
    await selector(page).click();
    await page.getByRole("radio", { name: "Automático" }).check();
    await expect(page.locator("html")).not.toHaveAttribute("data-tema", /.+/);
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
    expect(await fondo(page)).toBe("rgb(247, 245, 240)");
    expect(errores).toEqual([]);
  });

  for (const { width, zoom } of [
    { width: 320, zoom: false },
    { width: 320, zoom: true },
    { width: 1440, zoom: false },
  ]) {
    test(`el menú abierto cabe en ${width} px${zoom ? " con texto al 200 %" : ""}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 700 });
      await page.goto("/");
      if (zoom) {
        await page.evaluate(() => {
          document.documentElement.style.fontSize = "200%";
        });
      }
      await selector(page).click();
      const caja = await page.locator("details fieldset").boundingBox();
      expect(caja?.x).toBeGreaterThanOrEqual(0);
      expect((caja?.x ?? 0) + (caja?.width ?? 0)).toBeLessThanOrEqual(width);
      const altos = await page
        .locator("details label")
        .evaluateAll((etiquetas) => etiquetas.map((e) => e.getBoundingClientRect().height));
      expect(Math.min(...altos)).toBeGreaterThanOrEqual(44);
      if (DIR_CAPTURAS) {
        await page.screenshot({
          path: join(DIR_CAPTURAS, `menu-tema-${width}${zoom ? "-texto-200" : ""}.png`),
        });
      }
    });
  }

  for (const tema of ["claro", "oscuro"]) {
    test(`axe no encuentra violaciones con el tema ${tema} elegido a mano`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema === "claro" ? "dark" : "light" });
      await page.goto("/");
      await selector(page).click();
      await page.getByRole("radio", { name: tema === "claro" ? "Claro" : "Oscuro" }).check();
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
    });
  }

  test("el menú se cierra con Esc y devuelve el foco", async ({ page }) => {
    await page.goto("/");
    await selector(page).click();
    await expect(page.getByRole("radio", { name: "Claro" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("radio", { name: "Claro" })).toBeHidden();
    await expect(selector(page)).toBeFocused();
  });

  test("la salida rápida borra la preferencia", async ({ page }) => {
    await page.route("https://www.google.com/**", (ruta) =>
      ruta.fulfill({ status: 200, contentType: "text/html", body: "sitio neutro" }),
    );
    await page.goto("/");
    await selector(page).click();
    await page.getByRole("radio", { name: "Oscuro" }).check();
    await page.getByRole("link", { name: /Salida rápida/ }).click();
    await page.waitForURL("https://www.google.com/**");
    await page.goto("/");
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
    await expect(page.locator("html")).not.toHaveAttribute("data-tema", /.+/);
  });
});
