import { randomBytes } from "node:crypto";
import { abrir, sellar } from "@dataton/shared";
import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { solveChallenge, type Challenge } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import JSZip from "jszip";
import sharp from "sharp";
import {
  compose,
  completarDenuncia,
  Grabadora,
  leerBitacoras,
  OPCIONES_CONTEXTO_MARCADO,
  type PeticionGrabada,
  secretosPresentes,
  URL_BASE,
  visitar,
  volcarBaseDeDatos,
} from "./apoyo";

/**
 * Sube evidencias reales contra el despliegue: una foto con GPS y autor, y una hoja de cálculo con
 * la ruta de usuario que Excel guarda. Comprueba lo que sale del navegador (el cuerpo de cada
 * `POST /evidencias`), lo que queda en la base (`pg_dump`) y, subiendo también los archivos sucios
 * directo a la API, que el servidor limpia por su cuenta: lo que la autoridad abre con su clave ya
 * no trae esos datos.
 */
const AUTOR = "Juana Testigo Marcadora 7F3A";
const CAMARA = "CamaraMarcadora7F3A";
const USUARIO_EQUIPO = "juana.testigo.7f3a";
const RUTA_LOCAL = `C:\\Users\\${USUARIO_EQUIPO}\\Documents\\Denuncias\\`;
const NOMBRE_FOTO = "foto-oficina-juana-7f3a.jpg";
const NOMBRE_HOJA = "pagos-juana-7f3a.xlsx";
const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Lo que no debe aparecer en ninguna parte tras limpiar. */
const MARCADORES = {
  autor: AUTOR,
  camara: CAMARA,
  usuarioDelEquipo: USUARIO_EQUIPO,
  nombreDeLaFoto: NOMBRE_FOTO,
  nombreDeLaHoja: NOMBRE_HOJA,
};

const fotoConGpsYAutor = (): Promise<Buffer> =>
  sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .jpeg()
    .withExif({
      IFD0: { Artist: AUTOR, Make: CAMARA, Copyright: AUTOR },
      IFD3: {
        GPSLatitudeRef: "N",
        GPSLatitude: "19/1 25/1 42/1",
        GPSLongitudeRef: "W",
        GPSLongitude: "99/1 8/1 0/1",
      },
    })
    .toBuffer();

/** Como lo guarda Excel: ruta absoluta del libro en `workbook.xml` y autor en `docProps`. */
const hojaConRutaDeUsuario = async (): Promise<Buffer> => {
  const rels = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"';
  const r = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      `<Override PartName="/xl/workbook.xml" ContentType="${TIPO_XLSX}.main+xml"/>` +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      "</Types>",
  );
  zip.file(
    "_rels/.rels",
    `<Relationships ${rels}>` +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      "</Relationships>",
  );
  zip.file(
    "xl/workbook.xml",
    `<workbook ${r} xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:x15ac="http://schemas.microsoft.com/office/spreadsheetml/2010/11/ac">` +
      `<mc:AlternateContent><mc:Choice Requires="x15"><x15ac:absPath url="${RUTA_LOCAL}"/></mc:Choice></mc:AlternateContent>` +
      '<sheets><sheet name="Pagos" sheetId="1" r:id="rId1"/></sheets></workbook>',
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<Relationships ${rels}>` +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      "</Relationships>",
  );
  zip.file(
    "xl/worksheets/sheet1.xml",
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>1500</v></c></row></sheetData></worksheet>',
  );
  zip.file(
    "docProps/core.xml",
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>${AUTOR}</dc:creator></cp:coreProperties>`,
  );
  return Buffer.from(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
};

/** Recorre el IFD0 del bloque EXIF buscando el apuntador al IFD de GPS (0x8825). */
const exifTieneGps = (exif: Buffer): boolean => {
  const tiff = exif.subarray(exif.toString("latin1", 0, 4) === "Exif" ? 6 : 0);
  const pocoSignificativoPrimero = tiff.toString("latin1", 0, 2) === "II";
  const u16 = (p: number) =>
    pocoSignificativoPrimero ? tiff.readUInt16LE(p) : tiff.readUInt16BE(p);
  const u32 = (p: number) =>
    pocoSignificativoPrimero ? tiff.readUInt32LE(p) : tiff.readUInt32BE(p);
  const ifd0 = u32(4);
  const entradas = u16(ifd0);
  for (let i = 0; i < entradas; i += 1) if (u16(ifd0 + 2 + i * 12) === 0x8825) return true;
  return false;
};

const partesDeTexto = async (bytes: Uint8Array): Promise<string> => {
  const zip = await JSZip.loadAsync(bytes);
  const textos: string[] = [];
  for (const entrada of Object.values(zip.files)) {
    if (!entrada.dir) textos.push(`### ${entrada.name}\n${await entrada.async("string")}`);
  }
  return textos.join("\n");
};

/**
 * Chromium no entrega a Playwright el cuerpo binario de un `fetch` con `Blob`, así que se copia
 * desde el propio navegador, justo antes de enviarlo: es exactamente lo que viaja en la petición.
 */
const CAPTURAR_CUERPOS = `
  const original = window.fetch;
  window.__cuerposEvidencias = [];
  window.fetch = async (entrada, init) => {
    const url = typeof entrada === "string" ? entrada : entrada.url;
    if (url.includes("/api/v1/evidencias") && init && init.body instanceof Blob) {
      const bytes = new Uint8Array(await init.body.arrayBuffer());
      let binario = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        binario += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      window.__cuerposEvidencias.push(btoa(binario));
    }
    return original(entrada, init);
  };
`;

const cuerposCapturados = async (pagina: Page): Promise<Buffer[]> =>
  (
    await pagina.evaluate(
      () => (window as unknown as { __cuerposEvidencias: string[] }).__cuerposEvidencias,
    )
  ).map((b64) => Buffer.from(b64, "base64"));

const esJpeg = (bytes: Buffer) => bytes[0] === 0xff && bytes[1] === 0xd8;

test.describe.serial("Subida de evidencias", () => {
  let contexto: BrowserContext;
  let pagina: Page;
  let peticiones: PeticionGrabada[];
  let cuerpos: Buffer[];
  let folio: string;
  let foto: Buffer;
  let hoja: Buffer;

  test.beforeAll(async ({ browser }) => {
    foto = await fotoConGpsYAutor();
    hoja = await hojaConRutaDeUsuario();
    contexto = await browser.newContext({
      ...OPCIONES_CONTEXTO_MARCADO,
      ignoreHTTPSErrors: true,
      baseURL: URL_BASE,
    });
    await contexto.addInitScript(CAPTURAR_CUERPOS);
    const grabadora = new Grabadora(contexto);
    pagina = await contexto.newPage();
    await visitar(pagina, "/denunciar");
    ({ folio } = await completarDenuncia(pagina, {
      evidencias: [
        { name: NOMBRE_FOTO, mimeType: "image/jpeg", buffer: foto },
        { name: NOMBRE_HOJA, mimeType: TIPO_XLSX, buffer: hoja },
      ],
    }));
    cuerpos = await cuerposCapturados(pagina);
    peticiones = await grabadora.listas();
  });

  test.afterAll(async () => {
    await contexto?.close();
  });

  test("los archivos originales sí traen GPS, autor y ruta del equipo", async () => {
    const exif = (await sharp(foto).metadata()).exif;
    expect(exif).toBeDefined();
    expect(exifTieneGps(exif as Buffer)).toBe(true);
    expect(foto.toString("latin1")).toContain(AUTOR);
    expect(await partesDeTexto(hoja)).toContain(RUTA_LOCAL);
    expect(await partesDeTexto(hoja)).toContain(AUTOR);
  });

  test("la denuncia se envió con las dos evidencias", () => {
    expect(folio).toMatch(/^BZ(-[0-9A-Z]{4}){4}$/);
    const envio = peticiones.find(
      (p) => p.metodo === "POST" && p.url.endsWith("/api/v1/denuncias"),
    );
    const cuerpo = JSON.parse(envio?.cuerpo.toString("utf8") ?? "{}") as {
      evidenciaIds?: string[];
    };
    expect(cuerpo.evidenciaIds).toHaveLength(2);
  });

  test("lo que el navegador envía en POST /evidencias ya no tiene GPS, autor ni ruta", async ({}, info) => {
    const envios = peticiones.filter(
      (p) => p.metodo === "POST" && p.url.includes("/api/v1/evidencias"),
    );
    expect(envios).toHaveLength(2);
    expect(cuerpos).toHaveLength(2);
    const fotoEnviada = cuerpos.find(esJpeg);
    const hojaEnviada = cuerpos.find((c) => !esJpeg(c));
    expect(fotoEnviada).toBeDefined();
    expect(hojaEnviada).toBeDefined();

    const metadatos = await sharp(fotoEnviada as Buffer).metadata();
    expect(metadatos.format).toBe("jpeg");
    // Sin bloque EXIF no hay dónde viaje el GPS.
    expect(metadatos.exif).toBeUndefined();
    expect(secretosPresentes(fotoEnviada as Buffer, MARCADORES)).toEqual([]);

    const textoHoja = await partesDeTexto(hojaEnviada as Buffer);
    expect(textoHoja).toContain("<sheetData>");
    expect(textoHoja).not.toMatch(/absPath|docProps/);
    expect(secretosPresentes(Buffer.from(textoHoja, "utf8"), MARCADORES)).toEqual([]);
    expect(secretosPresentes(hojaEnviada as Buffer, MARCADORES)).toEqual([]);

    // Ninguna otra petición los lleva tampoco (ni el nombre del archivo).
    const fugas = peticiones.flatMap((p) =>
      secretosPresentes(
        Buffer.concat([Buffer.from(p.url + p.cabeceras), p.cuerpo]),
        MARCADORES,
      ).map((s) => `${s} en ${p.url}`),
    );
    expect(fugas).toEqual([]);
    info.annotations.push({
      type: "evidencia",
      description: `${peticiones.length} peticiones; la foto enviada pesa ${fotoEnviada?.length} bytes sin EXIF y la hoja ${hojaEnviada?.length} bytes sin absPath ni docProps`,
    });
  });

  test("pg_dump guarda las evidencias selladas, sin autor, cámara, ruta ni nombres de archivo", () => {
    const volcado = volcarBaseDeDatos();
    expect(volcado).toContain("INSERT INTO public.evidencias");
    expect(secretosPresentes(volcado, { ...MARCADORES, folio })).toEqual([]);
  });

  test("las bitácoras tampoco los mencionan", () => {
    expect(secretosPresentes(leerBitacoras(), MARCADORES)).toEqual([]);
  });

  test.describe("si el navegador no limpiara, el servidor limpia", () => {
    let api: APIRequestContext;
    let idsSucios: string[];

    const resolverPow = async (): Promise<string> => {
      const challenge = (await (await api.get("/api/v1/pow/reto")).json()) as Challenge;
      const solution = await solveChallenge({ challenge, deriveKey });
      return Buffer.from(JSON.stringify({ challenge, solution })).toString("base64");
    };

    const subirDirecto = async (bytes: Buffer, tipo: string) => {
      const respuesta = await api.post(`/api/v1/evidencias?pow=${await resolverPow()}`, {
        headers: { "Content-Type": tipo },
        data: bytes,
      });
      expect(respuesta.status()).toBe(201);
      return (await respuesta.json()) as {
        evidenciaId: string;
        metadatosEliminadosEnServidor: string[];
      };
    };

    test.beforeAll(async ({ playwright }) => {
      api = await playwright.request.newContext({ baseURL: URL_BASE, ignoreHTTPSErrors: true });
    });

    test.afterAll(async () => {
      await api?.dispose();
    });

    test("acepta los archivos sucios y reporta lo que les quitó", async ({}, info) => {
      const fotoSucia = await subirDirecto(foto, "image/jpeg");
      const hojaSucia = await subirDirecto(hoja, TIPO_XLSX);
      expect(fotoSucia.metadatosEliminadosEnServidor.join(" ")).toMatch(/EXIF/);
      expect(hojaSucia.metadatosEliminadosEnServidor.join(" ")).toMatch(/Rutas de archivos/);
      expect(hojaSucia.metadatosEliminadosEnServidor.join(" ")).toMatch(/Propiedades/);
      idsSucios = [fotoSucia.evidenciaId, hojaSucia.evidenciaId];
      info.annotations.push({
        type: "evidencia",
        description: `Servidor: foto → ${fotoSucia.metadatosEliminadosEnServidor.join(", ")}; hoja → ${hojaSucia.metadatosEliminadosEnServidor.join(", ")}`,
      });
    });

    test("lo que la autoridad abre con su clave ya está limpio", async () => {
      const { clavePublicaAutoridad } = (await (await api.get("/api/v1/configuracion")).json()) as {
        clavePublicaAutoridad: JsonWebKey;
      };
      const relato = new TextEncoder().encode("Relato sintético para probar evidencias sucias.");
      const creada = await api.post("/api/v1/denuncias", {
        data: {
          pow: await resolverPow(),
          accesoId: randomBytes(32).toString("hex"),
          estado: "17",
          tipoFalta: "cohecho",
          relatoSellado: Buffer.from(await sellar(clavePublicaAutoridad, relato)).toString(
            "base64url",
          ),
          evidenciaIds: idsSucios,
        },
      });
      expect(creada.status()).toBe(201);

      // La demostración guarda la clave privada y el acceso del panel en un volumen que ningún
      // servicio monta; aquí se leen como lo haría quien administra ese Docker.
      const acceso = Object.fromEntries(
        compose([
          "run",
          "--rm",
          "--no-deps",
          "clave-autoridad",
          "cat",
          "/clave-autoridad/acceso_panel.txt",
        ])
          .trim()
          .split("\n")
          .map((linea) => linea.split("=") as [string, string]),
      );
      const privada = JSON.parse(
        compose(["run", "--rm", "--no-deps", "clave-autoridad"]).trim(),
      ) as JsonWebKey;
      const sesion = await api.post("/api/v1/autoridad/sesion", {
        data: { usuario: acceso.usuario, contrasena: acceso.contrasena },
      });
      expect(sesion.status()).toBe(200);

      const listado = (await (
        await api.get("/api/v1/autoridad/denuncias?porPagina=200")
      ).json()) as {
        denuncias: { id: string }[];
      };
      let denunciaId: string | undefined;
      for (const { id } of listado.denuncias) {
        const detalle = (await (await api.get(`/api/v1/autoridad/denuncias/${id}`)).json()) as {
          evidencias: { id: string }[];
        };
        if (idsSucios.every((e) => detalle.evidencias.some((d) => d.id === e))) {
          denunciaId = id;
          break;
        }
      }
      expect(denunciaId).toBeDefined();

      const abiertas: Buffer[] = [];
      for (const evidenciaId of idsSucios) {
        const sellada = await api.get(
          `/api/v1/autoridad/denuncias/${denunciaId}/evidencias/${evidenciaId}`,
        );
        expect(sellada.status()).toBe(200);
        abiertas.push(Buffer.from(await abrir(privada, new Uint8Array(await sellada.body()))));
      }
      const fotoAbierta = abiertas.find(esJpeg) as Buffer;
      const hojaAbierta = abiertas.find((a) => !esJpeg(a)) as Buffer;
      expect((await sharp(fotoAbierta).metadata()).exif).toBeUndefined();
      expect(secretosPresentes(fotoAbierta, MARCADORES)).toEqual([]);
      const textoHoja = await partesDeTexto(hojaAbierta);
      expect(textoHoja).toContain("<sheetData>");
      expect(textoHoja).not.toMatch(/absPath|docProps/);
      expect(secretosPresentes(Buffer.from(textoHoja, "utf8"), MARCADORES)).toEqual([]);
    });
  });
});
