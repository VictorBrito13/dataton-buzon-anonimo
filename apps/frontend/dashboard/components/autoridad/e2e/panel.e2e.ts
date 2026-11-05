import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { aBase64Url, generarParDeClaves, sellar, TRANSICIONES, type Etapa } from "@dataton/shared";

const ID_RECIBIDA = "6f1c1c1e-3f0a-4a53-9a55-0d3f6a1b2c3d";
const ID_BIFURCA = "7a2d2d2f-4a1b-4b64-8b66-1e4a7b2c3d4e";
const ID_EVIDENCIA = "8b3e3e30-5b2c-4c75-9c77-2f5b8c3d4e5f";

const RELATO = "Vi un pago en efectivo en la ventanilla 3.";
const MENSAJE_DENUNCIANTE = "Puedo agregar la fecha aproximada: marzo.";
const EVIDENCIA = "contenido de la evidencia";
const COOKIE = "sesion_autoridad=prueba";

const claves = async () => generarParDeClaves();
const selloTexto = async (publica: JsonWebKey, texto: string) =>
  sellar(publica, new TextEncoder().encode(texto));

const resumen = (id: string, etapa: Etapa, estado: string, recibidaDia: string) => ({
  id,
  estado,
  municipio: null,
  tipoFalta: "cohecho",
  enteId: null,
  etapa,
  recibidaDia,
});

/** Simula la API del contrato con la cookie real: sin ella, 401. */
const simularApi = async (page: Page, publica: JsonWebKey) => {
  const relatoSellado = aBase64Url(await selloTexto(publica, RELATO));
  const mensajeSellado = aBase64Url(await selloTexto(publica, MENSAJE_DENUNCIANTE));
  const evidenciaSellada = await selloTexto(publica, EVIDENCIA);

  const estado = {
    etapas: { [ID_RECIBIDA]: "recibida", [ID_BIFURCA]: "analisis_competencia" } as Record<
      string,
      Etapa
    >,
    lineas: {
      [ID_RECIBIDA]: [{ etapa: "recibida", dia: "2026-03-01" }],
      [ID_BIFURCA]: [
        { etapa: "recibida", dia: "2026-01-10" },
        { etapa: "turnada_investigadora", dia: "2026-01-12" },
        { etapa: "analisis_competencia", dia: "2026-01-20" },
      ],
    } as Record<string, { etapa: Etapa; dia: string }[]>,
    respuestas: [] as string[],
    cuerposEnviados: [] as string[],
  };

  const resumenDe = (id: string) =>
    id === ID_RECIBIDA
      ? {
          ...resumen(id, estado.etapas[id]!, "17", "2026-03-01"),
          municipio: "17007",
          enteId: "1",
        }
      : { ...resumen(id, estado.etapas[id]!, "09", "2026-01-10"), enteId: "ficticio-01" };

  await page.route("**/api/v1/**", async (route) => {
    const peticion = route.request();
    const ruta = new URL(peticion.url()).pathname.replace("/api/v1", "");
    const metodo = peticion.method();
    const cabeceras = await peticion.allHeaders();
    if (peticion.postData()) estado.cuerposEnviados.push(peticion.postData() as string);

    if (ruta === "/autoridad/sesion" && metodo === "POST") {
      const { contrasena } = peticion.postDataJSON() as { contrasena: string };
      if (contrasena !== "correcta") {
        return route.fulfill({ status: 401, json: { error: { message: "No autorizado" } } });
      }
      return route.fulfill({
        status: 204,
        headers: { "Set-Cookie": `${COOKIE}; Path=/; HttpOnly; SameSite=Strict` },
      });
    }

    if (!cabeceras.cookie?.includes(COOKIE)) {
      return route.fulfill({ status: 401, json: { error: { message: "No autorizado" } } });
    }

    if (ruta === "/autoridad/sesion" && metodo === "DELETE") {
      return route.fulfill({
        status: 204,
        headers: { "Set-Cookie": "sesion_autoridad=; Path=/; Max-Age=0" },
      });
    }
    if (ruta === "/autoridad/denuncias") {
      // Un dato de más en la respuesta no debe llegar a la pantalla.
      return route.fulfill({
        json: {
          denuncias: [ID_BIFURCA, ID_RECIBIDA].map((id) => ({
            ...resumenDe(id),
            ip: "203.0.113.9",
          })),
          total: 2,
        },
      });
    }

    const detalle = /^\/autoridad\/denuncias\/([^/]+)(\/.*)?$/.exec(ruta);
    const id = detalle?.[1] as string;
    const resto = detalle?.[2];
    if (detalle && !resto) {
      return route.fulfill({
        json: {
          ...resumenDe(id),
          relatoSellado,
          correo: "no-deberia-verse@example.org",
          lineaTiempo: estado.lineas[id],
          evidencias: [{ id: ID_EVIDENCIA, tipo: "application/pdf" }],
          mensajes: [
            {
              autor: "denunciante",
              dia: "2026-03-02",
              cuerpo: null,
              cuerpoSellado: mensajeSellado,
            },
            ...estado.respuestas.map((cuerpo) => ({
              autor: "autoridad",
              dia: "2026-03-03",
              cuerpo,
              cuerpoSellado: null,
            })),
          ],
        },
      });
    }
    if (resto === "/etapa" && metodo === "POST") {
      const { etapa } = peticion.postDataJSON() as { etapa: Etapa };
      if (!TRANSICIONES[estado.etapas[id]!].includes(etapa)) {
        return route.fulfill({ status: 409, json: { error: { message: "Transición inválida" } } });
      }
      estado.etapas[id] = etapa;
      estado.lineas[id]!.push({ etapa, dia: "2026-03-04" });
      return route.fulfill({ status: 204 });
    }
    if (resto === "/mensajes" && metodo === "POST") {
      estado.respuestas.push((peticion.postDataJSON() as { cuerpo: string }).cuerpo);
      return route.fulfill({ status: 204 });
    }
    if (resto === `/evidencias/${ID_EVIDENCIA}`) {
      return route.fulfill({
        contentType: "application/octet-stream",
        body: Buffer.from(evidenciaSellada),
      });
    }
    return route.fulfill({ status: 404, json: { error: { message: "No encontrado" } } });
  });

  return estado;
};

/** La CSP se vigila por dos vías: el evento del navegador y la consola. */
const vigilarCsp = async (page: Page) => {
  const violaciones: string[] = [];
  await page.exposeFunction("__reportarCsp", (texto: string) => violaciones.push(texto));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __reportarCsp: (t: string) => void }).__reportarCsp(
        `${e.violatedDirective} ${e.blockedURI}`,
      );
    });
  });
  page.on("console", (mensaje) => {
    if (/content security policy/i.test(mensaje.text())) violaciones.push(mensaje.text());
  });
  page.on("pageerror", (error) => violaciones.push(`pageerror: ${error.message}`));
  return violaciones;
};

const entrar = async (page: Page) => {
  await page.goto("/autoridad");
  await page.getByLabel("Usuario").fill("tramite");
  await page.getByLabel("Contraseña").fill("correcta");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Denuncias recibidas" })).toBeVisible();
};

const cargarClave = async (page: Page, privada: JsonWebKey) => {
  await page.getByLabel("Cargar clave privada (archivo JWK)").setInputFiles({
    name: "autoridad.jwk",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(privada)),
  });
  await expect(page.getByText("Clave privada cargada")).toBeVisible();
};

const auditar = async (page: Page, testInfo: TestInfo, nombre: string) => {
  await page.screenshot({ path: testInfo.outputPath(`${nombre}.png`), fullPage: true });
  const { violations } = await new AxeBuilder({ page }).analyze();
  const graves = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(graves.map((v) => `${nombre}: ${v.id} ${v.nodes[0]?.html}`)).toEqual([]);
};

type Auditoria = (nombre: string) => Promise<void>;

const recorrer = async (page: Page, auditarPantalla: Auditoria) => {
  const { publica, privada } = await claves();
  const api = await simularApi(page, publica);
  const hosts = new Set<string>();
  page.on("request", (r) => hosts.add(new URL(r.url()).host));

  // Inicio de sesión
  await page.goto("/autoridad");
  await expect(page.getByRole("heading", { name: /Lo que no existe/ })).toBeVisible();
  await expect(page.getByRole("complementary")).toContainText("Dirección IP");
  await expect(page.getByRole("complementary")).toContainText("Correo");
  await expect(page.getByRole("complementary")).toContainText("Dispositivo");
  await auditarPantalla("1-login");

  await page.getByLabel("Usuario").fill("tramite");
  await page.getByLabel("Contraseña").fill("mala");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Usuario o contraseña incorrectos" }),
  ).toBeVisible();
  await page.getByLabel("Contraseña").fill("correcta");
  await page.getByRole("button", { name: "Entrar" }).click();

  // Lista, tabla semántica y filtros
  await expect(page.getByRole("heading", { name: "Denuncias recibidas" })).toBeVisible();
  await expect(page.getByText("2 de 2 denuncias")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Etapa" })).toBeVisible();
  await expect(page.locator("main")).not.toContainText("203.0.113.9");

  // Nombres de catálogo; un ente fuera del catálogo conserva su código.
  await expect(page.getByRole("cell", { name: "Cuernavaca" })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "ADMINISTRACION DEL PATRIMONIO DE LA BENEFICENCIA PUBLICA" }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "ficticio-01" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "17007" })).toHaveCount(0);
  await expect(page.getByLabel("Estado").locator("option")).toHaveCount(33);
  await auditarPantalla("2-lista");

  await page.getByLabel("Etapa").selectOption("recibida");
  await expect(page.getByText("1 de 2 denuncias")).toBeVisible();
  await expect(page).toHaveURL(/etapa=recibida/);
  await page.getByLabel("Estado").selectOption("09");
  await expect(page.getByText("Ninguna denuncia coincide")).toBeVisible();
  await page.getByRole("button", { name: "Limpiar filtros" }).click();
  await expect(page.getByText("2 de 2 denuncias")).toBeVisible();
  await expect(page).toHaveURL(/\/autoridad$/);

  // La clave se carga en la lista y sobrevive a la navegación interna
  await cargarClave(page, privada);
  await page.getByRole("link", { name: ID_RECIBIDA.slice(0, 8) }).click();
  await expect(page.getByRole("heading", { name: /Denuncia/, level: 1 })).toBeVisible();
  await expect(page.getByText(RELATO)).toBeVisible();
  await expect(page.getByText(MENSAJE_DENUNCIANTE)).toBeVisible();
  await expect(page.locator("main")).not.toContainText("no-deberia-verse");
  await auditarPantalla("4-detalle-abierto");

  // Olvidar la clave vuelve a sellar lo que estaba a la vista
  await page.getByRole("button", { name: "Olvidar clave" }).click();
  await expect(page.getByText(RELATO)).toBeHidden();
  await expect(page.getByText("Contenido sellado.").first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "Contenido sellado" })).toBeVisible();
  await auditarPantalla("3-detalle-sellado");
  await cargarClave(page, privada);
  await expect(page.getByText(RELATO)).toBeVisible();

  // Evidencia: se descarga sellada y se abre aquí
  const [descarga] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Descargar y abrir evidencia/ }).click(),
  ]);
  expect(descarga.suggestedFilename()).toBe(`evidencia-${ID_EVIDENCIA.slice(0, 8)}.pdf`);
  expect(await readFile(await descarga.path(), "utf8")).toBe(EVIDENCIA);

  // Solo las etapas de TRANSICIONES, y con confirmación
  const botonesEtapa = page.getByRole("button", { name: /^Pasar a:/ });
  await expect(botonesEtapa).toHaveCount(1);
  await botonesEtapa.click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toContainText("no se puede deshacer");
  await auditarPantalla("5-confirmacion");
  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  expect(api.etapas[ID_RECIBIDA]).toBe("recibida");

  await botonesEtapa.click();
  await dialogo.getByRole("button", { name: "Confirmar cambio" }).click();
  await expect(page.getByRole("heading", { name: "Etapa: Turnada a investigación" })).toBeFocused();
  await expect(page.getByText("Etapa actualizada a: Turnada a investigación.")).toBeVisible();
  expect(api.etapas[ID_RECIBIDA]).toBe("turnada_investigadora");
  await expect(page.getByRole("listitem").filter({ hasText: "2026-03-04" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pasar a: Revisión de competencia" }),
  ).toBeVisible();

  // Responder
  await page.getByLabel("Responder a quien denuncia").fill("¿Recuerdas la ventanilla?");
  await page.getByRole("button", { name: "Enviar respuesta" }).click();
  await expect(page.getByText("Mensaje enviado.")).toBeVisible();
  await expect(page.getByText("¿Recuerdas la ventanilla?", { exact: true })).toBeVisible();

  // La clave no llegó a ningún almacenamiento ni a la red
  const almacenado = await page.evaluate(async () => ({
    local: { ...localStorage },
    sesion: { ...sessionStorage },
    bases: await indexedDB.databases(),
    cookies: document.cookie,
  }));
  expect(almacenado).toEqual({ local: {}, sesion: {}, bases: [], cookies: "" });
  for (const cuerpo of api.cuerposEnviados) expect(cuerpo).not.toContain(privada.d);
  for (const cuerpo of api.cuerposEnviados) expect(cuerpo).not.toContain(RELATO);
  expect([...hosts]).toEqual([new URL(page.url()).host]);

  // Recargar borra la clave, no la sesión
  await page.reload();
  await expect(page.getByText("Sin clave privada:")).toBeVisible();
  await expect(page.getByText("Contenido sellado.").first()).toBeVisible();
  await expect(page.getByText(RELATO)).toBeHidden();

  // Cerrar sesión
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
  await expect(page).toHaveURL(/\/autoridad$/);
  await page.reload();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
};

test("recorrido completo sin violaciones de CSP: el relato se abre en el navegador y la clave no sale de la memoria", async ({
  page,
}) => {
  const violaciones = await vigilarCsp(page);
  await recorrer(page, async () => {});
  expect(violaciones).toEqual([]);
});

test("recorrido completo con axe, sin violaciones serias", async ({ page }, testInfo) => {
  await recorrer(page, (nombre) => auditar(page, testInfo, nombre));
});

test("una etapa con dos salidas ofrece ambas", async ({ page }) => {
  const { publica } = await claves();
  await simularApi(page, publica);
  await entrar(page);
  await page.getByRole("link", { name: ID_BIFURCA.slice(0, 8) }).click();
  await expect(page.getByRole("button", { name: /^Pasar a:/ })).toHaveText([
    "Pasar a: En investigación",
    "Pasar a: Enviada a otra autoridad",
  ]);
  await page.getByRole("button", { name: "Pasar a: Enviada a otra autoridad" }).click();
  await expect(page.getByRole("dialog")).toContainText("concluye el trámite");
});

test("una clave que no corresponde se dice claramente y una pública se rechaza", async ({
  page,
}) => {
  const { publica } = await claves();
  const ajena = await claves();
  await simularApi(page, publica);
  await entrar(page);
  await page.getByRole("link", { name: ID_RECIBIDA.slice(0, 8) }).click();

  await page.getByLabel("Cargar clave privada (archivo JWK)").setInputFiles({
    name: "publica.jwk",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(ajena.publica)),
  });
  await expect(page.getByRole("alert").filter({ hasText: "clave pública" })).toBeVisible();

  await cargarClave(page, ajena.privada);
  await expect(page.getByText("No se pudo abrir.").first()).toBeVisible();
  await expect(page.getByText(RELATO)).toBeHidden();
});

test("funciona solo con teclado", async ({ page }) => {
  const { publica } = await claves();
  await simularApi(page, publica);
  await entrar(page);
  const enlace = page.getByRole("link", { name: ID_RECIBIDA.slice(0, 8) });
  await enlace.focus();
  await page.keyboard.press("Enter");
  const boton = page.getByRole("button", { name: /^Pasar a:/ });
  await boton.focus();
  await page.keyboard.press("Enter");
  const cancelar = page.getByRole("dialog").getByRole("button", { name: "Cancelar" });
  await expect(cancelar).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(boton).toBeFocused();
});

test("axe en modo oscuro, sin violaciones serias", async ({ page }, testInfo) => {
  const { publica, privada } = await claves();
  await page.emulateMedia({ colorScheme: "dark" });
  await simularApi(page, publica);
  await entrar(page);
  await auditar(page, testInfo, "oscuro-lista");
  await cargarClave(page, privada);
  await page.getByRole("link", { name: ID_RECIBIDA.slice(0, 8) }).click();
  await expect(page.getByText(RELATO)).toBeVisible();
  await auditar(page, testInfo, "oscuro-detalle");
});
