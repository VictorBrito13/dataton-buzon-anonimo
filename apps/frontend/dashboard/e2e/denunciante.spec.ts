import { ERROR_ACCESO } from "@dataton/shared";
import { expect, test } from "@playwright/test";
import {
  confirmarFrase,
  leerFrase,
  llenarHechos,
  revisarObjetivos,
  revisarPantalla,
  sinDesbordeHorizontal,
  vigilarPagina,
} from "./apoyo";

const RELATO =
  "En la ventanilla 3 me pidieron dinero para agilizar un permiso. Mi teléfono es 5512345678.";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test("recorrido completo: landing, denuncia, seguimiento y respuesta", async ({ page }, info) => {
  const vigilancia = vigilarPagina(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("sin dar tu nombre");
  await expect(page.getByRole("heading", { name: "Qué pasa después de denunciar" })).toBeVisible();
  await revisarPantalla(page, info, "01-landing");
  await revisarObjetivos(page, "landing");

  await page.getByRole("link", { name: "Hacer una denuncia" }).click();
  await expect(page.getByRole("heading", { name: "Qué pasó" })).toBeVisible();

  // Validación: el resumen de errores recibe el foco y cada campo queda asociado a su error.
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.locator("main [role=alert]")).toBeFocused();
  await expect(page.getByLabel("¿En qué estado pasó?")).toHaveAttribute("aria-invalid", "true");
  await revisarPantalla(page, info, "02-hechos-errores");

  await llenarHechos(page, RELATO);

  // Orientador: sugiere sin red, con el aviso visible, y la persona decide.
  await page.getByLabel("¿Qué tipo de falta es?").selectOption("");
  await page.getByText("¿No sabes cuál elegir?").click();
  await page.getByLabel(/Alguien que trabaja en gobierno/).check();
  await page.getByLabel(/Pidió dinero/).check();
  await expect(page.getByText("no constituye una determinación jurídica")).toBeVisible();
  await revisarPantalla(page, info, "03-orientador");
  await page.getByRole("button", { name: "Usar esta opción" }).click();
  await expect(page.getByLabel("¿Qué tipo de falta es?")).toHaveValue("cohecho");

  // Municipio del catálogo local.
  await page.getByLabel("¿En qué municipio?").selectOption("17007");
  await revisarPantalla(page, info, "04-hechos");
  await revisarObjetivos(page, "hechos");

  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Personas o entes involucrados" })).toBeFocused();
  await page.getByRole("button", { name: "Agregar una persona o ente" }).click();
  await page.getByLabel("Cargo, área o cómo la reconoces").fill("Encargado de ventanilla");
  await revisarPantalla(page, info, "05-personas");

  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Evidencias", level: 2 })).toBeFocused();
  // El selector propio muestra un foco visible al llegar con teclado.
  await expect(page.locator("label[for=campo-archivos]")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Elige tus archivos")).toBeFocused();
  await expect(page.locator("label[for=campo-archivos]")).toHaveCSS("outline-style", "solid");
  await page.getByLabel("Elige tus archivos").setInputFiles({
    name: "foto.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(page.getByText("Software de edición")).toBeVisible();
  await expect(page.getByText(/Nombre original del archivo/)).toBeVisible();
  await expect(page.getByText(/Hasta 3 archivos de 5 MB/)).toBeVisible();
  // Un archivo no permitido se explica y no bloquea.
  await page.getByLabel("Elige tus archivos").setInputFiles({
    name: "programa.exe",
    mimeType: "application/x-msdownload",
    buffer: PNG,
  });
  await expect(page.locator("main [role=alert]")).toContainText("No aceptamos este tipo");
  await revisarPantalla(page, info, "06-evidencias");

  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Revisión", level: 2 })).toBeFocused();
  await expect(page.getByText("Tu relato (sellado)")).toBeVisible();
  // La librería real de privacidad detecta el teléfono; la decisión es de la persona.
  const hallazgo = page.locator("main ol li").filter({ hasText: "«5512345678»" });
  await expect(hallazgo).toBeVisible();
  await expect(page.locator("mark").filter({ hasText: "5512345678" })).toBeVisible();
  await revisarPantalla(page, info, "07-revision");
  await hallazgo.getByRole("button", { name: /^Reemplazar por/ }).click();
  await expect(page.locator("main").getByText("5512345678")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Datos que podrían identificarte" }),
  ).toBeFocused();
  await revisarPantalla(page, info, "08-revision-reemplazo");

  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Tu frase", level: 2 })).toBeFocused();
  const frase = await leerFrase(page);
  expect(frase.split(" ")).toHaveLength(6);
  await page.getByRole("button", { name: "Mostrar código QR" }).click();
  await expect(page.getByAltText(/Código QR/)).toBeVisible();
  await revisarPantalla(page, info, "09-frase");

  // Al imprimir solo queda el recuadro de la frase.
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".area-impresion li").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Ya la guardé" })).toBeHidden();
  await expect(page.getByRole("link", { name: /Salida rápida/ })).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await revisarObjetivos(page, "frase");

  // Sin confirmar no se puede continuar.
  await page.getByRole("button", { name: "Ya la guardé" }).click();
  await page.getByRole("button", { name: "Confirmar y continuar" }).click();
  await expect(page.getByRole("heading", { name: "Tu frase", level: 2 })).toBeVisible();
  await expect(page.locator("main [role=alert]")).toContainText("no coinciden");
  await revisarPantalla(page, info, "10-confirmacion-error");
  await page.getByRole("button", { name: "Volver a ver mi frase" }).click();
  await confirmarFrase(page, frase);

  await expect(page.getByRole("heading", { name: "Envío", level: 2 })).toBeFocused();
  await revisarPantalla(page, info, "11-envio");
  await page.getByRole("button", { name: "Enviar mi denuncia" }).click();

  await expect(page.getByRole("heading", { name: "Tu denuncia se envió" })).toBeFocused({
    timeout: 30_000,
  });
  const folio = (await page.locator(".area-impresion .font-mono").textContent()) ?? "";
  expect(folio).toMatch(/^BZ-/);
  await expect(page.getByText("no hay forma de recuperarlos")).toBeVisible();
  await expect(page.getByText("No tomes captura de pantalla")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Qué pasa después de denunciar" })).toBeVisible();
  await revisarPantalla(page, info, "12-final");

  // La frase y el relato nunca viajaron; el folio y la frase no se guardan.
  const trafico = vigilancia.cuerpos.join("\n");
  expect(trafico).not.toContain(frase);
  for (const palabra of frase.split(" ")) {
    expect(trafico.toLowerCase()).not.toContain(` ${palabra} `);
  }
  expect(trafico).not.toContain("ventanilla 3");
  expect(trafico).not.toContain("marzo de 2026");
  const almacenado = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage }),
  );
  expect(almacenado).toBe("{}");

  // Seguimiento con folio.
  await page.getByRole("link", { name: "Ir a seguimiento" }).click();
  await expect(page.getByRole("tab", { name: "Con mi folio" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await revisarPantalla(page, info, "13-seguimiento-entrada");
  await revisarObjetivos(page, "seguimiento");
  await page.getByLabel("Tu folio").fill(folio.toLowerCase());
  await page.getByRole("button", { name: "Ver mi denuncia" }).click();
  await expect(page.getByRole("heading", { name: /Etapa actual: Turnada/ })).toBeFocused({
    timeout: 30_000,
  });
  await expect(page.getByText("1 de noviembre de 2026")).toBeVisible();
  await expect(page.getByText("Plazo esperado: Hasta 10 días hábiles")).toBeVisible();
  await expect(page.getByText("¿Puedes indicar en qué oficina ocurrió?")).toBeVisible();
  expect(page.url()).not.toContain(folio);
  await revisarPantalla(page, info, "14-seguimiento-detalle");

  // Responder con un mensaje sellado.
  await page.getByLabel("Responder a la autoridad").fill("Fue en la oficina central.");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(page.getByText("Tu mensaje se envió sellado")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Mensaje sellado/)).toBeVisible();
  expect(vigilancia.cuerpos.join("\n")).not.toContain("oficina central");
  await revisarPantalla(page, info, "15-seguimiento-respuesta");

  // Seguimiento con frase, por teclado.
  await page.getByRole("button", { name: "Cerrar esta denuncia en pantalla" }).click();
  await page.getByRole("tab", { name: "Con mi folio" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Con mi frase" })).toBeFocused();
  await page.getByLabel("Tu frase de 6 palabras").fill(frase.toUpperCase());
  await page.getByRole("button", { name: "Ver mi denuncia" }).click();
  await expect(page.getByRole("heading", { name: /Etapa actual/ })).toBeVisible({
    timeout: 30_000,
  });
  expect(vigilancia.cuerpos.join("\n")).not.toContain(frase);

  expect(vigilancia.errores, "errores de consola o de CSP").toEqual([]);
  expect(vigilancia.externas, "peticiones a otros dominios").toEqual([]);
});

test("seguimiento: el error es siempre el mismo y sale sin revelar nada", async ({
  page,
}, info) => {
  await page.goto("/seguimiento");
  const mensaje = ERROR_ACCESO.error.message;

  // Formato inválido: sin tocar la red.
  await page.getByLabel("Tu folio").fill("123");
  await page.getByRole("button", { name: "Ver mi denuncia" }).click();
  await expect(page.locator("main [role=alert]")).toContainText(mensaje);

  // Folio válido pero inexistente: 401 del servidor.
  await page.getByLabel("Tu folio").fill("BZ-0000-0000-0000-0000");
  await page.getByRole("button", { name: "Ver mi denuncia" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Comprobando" })).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(page.locator("main [role=alert]")).toContainText(mensaje);
  await revisarPantalla(page, info, "16-seguimiento-error");

  await page.getByRole("tab", { name: "Con mi frase" }).click();
  await page.getByLabel("Tu frase de 6 palabras").fill("esto no es una frase real");
  await page.getByRole("button", { name: "Ver mi denuncia" }).click();
  await expect(page.locator("main [role=alert]")).toContainText(mensaje);
});

test("buscar un ente nunca llega a la red", async ({ page }, info) => {
  const vigilancia = vigilarPagina(page);
  await page.goto("/denunciar");
  await page.getByLabel("¿En qué estado pasó?").selectOption("17");
  const buscador = page.getByLabel(/Institución involucrada/);
  await buscador.focus();
  await expect(page.getByText("Cargando la lista de instituciones")).toHaveCount(0, {
    timeout: 15_000,
  });
  await buscador.fill("xochitepecbusqueda");
  await expect(page.getByText(/No encontramos esa institución/).first()).toBeVisible();
  await buscador.fill("cuernavaca");
  const resultados = page.getByRole("list", { name: "Instituciones encontradas" });
  await expect(resultados.getByRole("button").first()).toBeVisible();
  await revisarPantalla(page, info, "17-busqueda-ente");
  await resultados.getByRole("button").first().click();
  await expect(page.getByRole("button", { name: "Quitar esta institución" })).toBeVisible();

  const trafico = vigilancia.cuerpos.join("\n").toLowerCase();
  expect(trafico).not.toContain("xochitepec");
  expect(trafico).not.toContain("cuernavaca");
  expect(vigilancia.cuerpos.some((c) => c.includes("/catalogos/entes.json"))).toBe(true);
  expect(vigilancia.errores).toEqual([]);
});

test("borrador: apagado por defecto, opcional y sin frase ni folio", async ({ page }, info) => {
  await page.goto("/denunciar");
  await llenarHechos(page, RELATO);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);

  await page.getByLabel("Guardar un borrador en este dispositivo").check();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(["buzon:borrador"]);

  await page.reload();
  await expect(page.getByText("Hay un borrador guardado")).toBeVisible();
  await revisarPantalla(page, info, "18-borrador");
  await page.getByRole("button", { name: "Continuar con el borrador" }).click();
  await expect(page.getByLabel("Cuéntanos qué pasó")).toHaveValue(RELATO);

  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  const frase = await leerFrase(page);
  const guardado = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  expect(guardado).not.toContain(frase);
  expect(guardado).not.toContain(frase.split(" ")[0] + " ");

  // Apagarlo lo borra.
  await page.getByRole("button", { name: "Atrás" }).click();
  await page.getByRole("button", { name: "Atrás" }).click();
  await page.getByRole("button", { name: "Atrás" }).click();
  await page.getByRole("button", { name: "Atrás" }).click();
  await page.getByLabel("Guardar un borrador en este dispositivo").uncheck();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test.describe("salida rápida", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("https://www.google.com/**", (ruta) =>
      ruta.fulfill({ status: 200, contentType: "text/html", body: "sitio neutro" }),
    );
  });

  for (const ruta of ["/", "/denunciar", "/seguimiento"]) {
    test(`el botón limpia y sale en ${ruta}`, async ({ page }) => {
      await page.goto(ruta);
      await page.evaluate(() => {
        localStorage.setItem("buzon:borrador", "{}");
        localStorage.setItem("ajena", "1");
        sessionStorage.setItem("algo", "1");
      });
      await page.getByRole("link", { name: /Salida rápida/ }).click();
      await page.waitForURL("https://www.google.com/**");
      await page.goto(ruta);
      expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(["ajena"]);
      expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
    });
  }

  test("Esc tres veces sale y no queda en el historial", async ({ page }) => {
    await page.goto("/");
    await page.goto("/denunciar");
    await expect(page.getByRole("heading", { name: "Qué pasó" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.waitForURL("https://www.google.com/**");
    await page.goBack();
    expect(new URL(page.url()).pathname).toBe("/");
  });
});

test("funciona a 320 px sin desbordes", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const ruta of ["/", "/denunciar", "/seguimiento"]) {
    await page.goto(ruta);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await sinDesbordeHorizontal(page, ruta);
  }
  await page.goto("/denunciar");
  await llenarHechos(page, RELATO);
  await page.getByText("¿No sabes cuál elegir?").click();
  await sinDesbordeHorizontal(page, "hechos");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await sinDesbordeHorizontal(page, "revisión");
  await page.getByRole("button", { name: "Continuar" }).click();
  await sinDesbordeHorizontal(page, "frase");
});

test("el paso de hechos se completa solo con teclado", async ({ page }) => {
  await page.goto("/denunciar");
  await page.getByLabel("¿En qué estado pasó?").focus();
  await page.keyboard.type("Morelos");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("¿En qué municipio?")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("¿Qué tipo de falta es?")).toBeFocused();
  await page.keyboard.type("Cohecho");
  await page.keyboard.press("Tab");
  await expect(page.getByText("¿No sabes cuál elegir?")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel(/Institución involucrada/)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Mes")).toBeFocused();
  await page.keyboard.type("marzo");
  await page.keyboard.press("Tab");
  await page.keyboard.type("2026");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("No lo recuerdo")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Cuéntanos qué pasó")).toBeFocused();
  await page.keyboard.type(RELATO);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Guardar un borrador en este dispositivo")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Continuar" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Personas o entes involucrados" })).toBeFocused();
});
