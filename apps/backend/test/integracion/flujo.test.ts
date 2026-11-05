import {
  ERROR_ACCESO,
  esquemaFolio,
  respuestaConfiguracion,
  respuestaConsulta,
  respuestaEvidencia,
  type DetalleDenunciaAutoridad,
  type RespuestaConsulta,
  type RespuestaEvidencia,
  type ResumenDenunciaAutoridad,
} from "@dataton/shared";
import type { Express } from "express";
import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDatabase, pool } from "../../src/db/postgres.js";
import { limpiarHuerfanas } from "../../src/composicion.js";
import {
  AUTOR,
  jpegConMetadatos,
  officeConMetadatos,
  pdfConMetadatos,
} from "../ayudas/fixtures.js";
import {
  abrirBytes,
  binario,
  crearDenuncia,
  iniciarSesion,
  prepararBase,
  randomHex,
  RELATO,
  resolverPow,
  selloDe,
} from "../ayudas/http.js";

let app: Express;

beforeAll(async () => {
  app = await prepararBase();
});

afterAll(async () => {
  await closeDatabase();
});

const subir = async (bytes: Uint8Array, tipo = "application/octet-stream") =>
  request(app)
    .post("/api/v1/evidencias")
    .query({ pow: await resolverPow(app) })
    .set("Content-Type", tipo)
    .send(Buffer.from(bytes));

const consultar = async (credencial: unknown) =>
  request(app)
    .post("/api/v1/acceso/consulta")
    .send({ pow: await resolverPow(app), credencial });

describe("plataforma", () => {
  it("expone la configuración del contrato con los límites del prototipo", async () => {
    const res = await request(app).get("/api/v1/configuracion").expect(200);
    const configuracion = respuestaConfiguracion.parse(res.body);
    expect(configuracion.maxEvidencias).toBe(5);
    expect(configuracion.tiposEvidencia).toContain("application/pdf");
    expect(configuracion.clavePublicaAutoridad).not.toHaveProperty("d");
  });

  it("no publica cabeceras que identifiquen ni cachea respuestas", async () => {
    const res = await request(app).get("/api/v1/configuracion");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("no incluye stack ni la ruta pedida en los errores fuera de desarrollo", async () => {
    const res = await request(app).get("/api/v1/inexistente?folio=BZ-SECRETO").expect(404);
    expect(res.text).not.toMatch(/stack|BZ-SECRETO|node_modules/);
  });

  it("no acepta las rutas de otros frentes", async () => {
    await request(app).get("/api/v1/publico/agregados").expect(404);
  });
});

describe("POST /denuncias", () => {
  it("devuelve el folio y guarda la fila sin relato ni credenciales en claro", async () => {
    const { folio, accesoId } = await crearDenuncia(app);
    expect(esquemaFolio.safeParse(folio).success).toBe(true);

    const { rows } = await pool.query<Record<string, unknown>>(
      "SELECT d.*, encode(relato_sellado, 'escape') AS relato_texto, encode(folio_hmac, 'hex') AS f, encode(acceso_hmac, 'hex') AS a FROM denuncias d",
    );
    const volcado = JSON.stringify(rows);
    expect(volcado).not.toContain(RELATO);
    expect(volcado).not.toContain("soborno");
    expect(volcado).not.toContain(folio);
    expect(volcado).not.toContain(accesoId);
  });

  it("redondea la fecha al día y crea la primera etapa", async () => {
    const { rows } = await pool.query<{ dia: string; etapa: string; orden: number }>(
      "SELECT to_char(e.dia, 'YYYY-MM-DD') AS dia, e.etapa, e.orden FROM denuncia_etapas e LIMIT 1",
    );
    expect(rows[0]?.etapa).toBe("recibida");
    expect(rows[0]?.dia).toBe(new Date().toISOString().slice(0, 10));
    expect(rows[0]?.orden).toBe(1);
    const columnas = await pool.query<{ data_type: string }>(
      "SELECT data_type FROM information_schema.columns WHERE table_name = 'denuncias' AND column_name = 'recibida_dia'",
    );
    expect(columnas.rows[0]?.data_type).toBe("date");
  });

  it("exige prueba de trabajo de un solo uso", async () => {
    const pow = await resolverPow(app);
    const cuerpo = {
      pow,
      accesoId: randomHex(),
      estado: "17",
      tipoFalta: "cohecho",
      relatoSellado: await selloDe(RELATO),
      evidenciaIds: [],
    };
    await request(app).post("/api/v1/denuncias").send(cuerpo).expect(201);
    await request(app)
      .post("/api/v1/denuncias")
      .send({ ...cuerpo, accesoId: randomHex() })
      .expect(403);
  });

  it("rechaza relato en texto claro y municipio de otro estado", async () => {
    await request(app)
      .post("/api/v1/denuncias")
      .send({
        pow: await resolverPow(app),
        accesoId: randomHex(),
        estado: "17",
        tipoFalta: "cohecho",
        relatoSellado: Buffer.from(RELATO.repeat(5)).toString("base64url"),
        evidenciaIds: [],
      })
      .expect(400);
    await request(app)
      .post("/api/v1/denuncias")
      .send({
        pow: await resolverPow(app),
        accesoId: randomHex(),
        estado: "17",
        municipio: "09001",
        tipoFalta: "cohecho",
        relatoSellado: await selloDe(RELATO),
        evidenciaIds: [],
      })
      .expect(400);
  });

  it("rechaza una frase repetida sin crear otra fila", async () => {
    const { accesoId } = await crearDenuncia(app);
    const antes = await pool.query("SELECT 1 FROM denuncias");
    await request(app)
      .post("/api/v1/denuncias")
      .send({
        pow: await resolverPow(app),
        accesoId,
        estado: "17",
        tipoFalta: "cohecho",
        relatoSellado: await selloDe(RELATO),
        evidenciaIds: [],
      })
      .expect(409);
    const despues = await pool.query("SELECT 1 FROM denuncias");
    expect(despues.rowCount).toBe(antes.rowCount);
  });

  it("admite un relato sellado cercano al máximo", async () => {
    await crearDenuncia(app, { relatoSellado: await selloDe("x".repeat(149_000)) });
  });

  it("rechaza más de 5 evidencias", async () => {
    const ids = Array.from({ length: 6 }, () => crypto.randomUUID());
    await request(app)
      .post("/api/v1/denuncias")
      .send({
        pow: await resolverPow(app),
        accesoId: randomHex(),
        estado: "17",
        tipoFalta: "cohecho",
        relatoSellado: await selloDe(RELATO),
        evidenciaIds: ids,
      })
      .expect(400);
  });
});

describe("POST /evidencias", () => {
  it("elimina GPS y autor de una foto antes de sellarla", async () => {
    const entrada = await jpegConMetadatos();
    const res = await subir(entrada, "image/jpeg");
    expect(res.status).toBe(201);
    const { evidenciaId, metadatosEliminadosEnServidor } = respuestaEvidencia.parse(res.body);
    expect(metadatosEliminadosEnServidor.join(" ")).toMatch(/EXIF/);

    const { rows } = await pool.query<{ blob_sellado: Buffer; tipo: string }>(
      "SELECT blob_sellado, tipo FROM evidencias WHERE id = $1",
      [evidenciaId],
    );
    const fila = rows[0];
    expect(fila?.tipo).toBe("image/jpeg");
    expect(fila?.blob_sellado.toString("latin1")).not.toContain(AUTOR);
    const abierta = await abrirBytes(fila?.blob_sellado as Buffer);
    expect(abierta.toString("latin1")).not.toContain(AUTOR);
    expect((await sharp(abierta).metadata()).exif).toBeUndefined();
  });

  it("limpia PDF y Office, y guarda el tipo real sin importar el declarado", async () => {
    const pdf = await subir(await pdfConMetadatos(), "image/png");
    expect(pdf.status).toBe(201);
    const office = await subir(await officeConMetadatos());
    expect(office.status).toBe(201);
    const { rows } = await pool.query<{ tipo: string; blob_sellado: Buffer }>(
      "SELECT tipo, blob_sellado FROM evidencias WHERE id = ANY($1)",
      [
        [
          (pdf.body as RespuestaEvidencia).evidenciaId,
          (office.body as RespuestaEvidencia).evidenciaId,
        ],
      ],
    );
    expect(rows.map((r) => r.tipo).sort()).toEqual([
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);
    for (const fila of rows) {
      expect((await abrirBytes(fila.blob_sellado)).toString("latin1")).not.toContain(AUTOR);
    }
  });

  it("rechaza ejecutables aunque se declaren como imagen", async () => {
    const exe = new Uint8Array(512);
    exe.set(new TextEncoder().encode("MZ"));
    exe.set(new TextEncoder().encode("PE\0\0"), 128);
    new DataView(exe.buffer).setUint32(60, 128, true);
    expect((await subir(exe, "image/jpeg")).status).toBe(415);
    const elf = new Uint8Array([
      0x7f,
      0x45,
      0x4c,
      0x46,
      2,
      1,
      1,
      ...new Array<number>(100).fill(0),
    ]);
    expect((await subir(elf, "application/pdf")).status).toBe(415);
    expect((await subir(new TextEncoder().encode("hola"))).status).toBe(415);
  });

  it("rechaza macros, vacíos y archivos por encima del máximo", async () => {
    const macro = await officeConMetadatos({ partes: { "word/vbaProject.bin": "x" } });
    expect((await subir(macro)).status).toBe(422);
    expect((await subir(new Uint8Array(0))).status).toBe(400);
    expect((await subir(new Uint8Array(2_000_001))).status).toBe(413);
  });

  it("rechaza sin prueba de trabajo, sin procesar el archivo", async () => {
    await request(app)
      .post("/api/v1/evidencias")
      .set("Content-Type", "image/jpeg")
      .send(await jpegConMetadatos())
      .expect(403);
  });

  it("liga evidencias a la denuncia una sola vez", async () => {
    const res = await subir(await jpegConMetadatos());
    const { evidenciaId } = res.body as RespuestaEvidencia;
    await crearDenuncia(app, { evidenciaIds: [evidenciaId] });
    const { rows } = await pool.query<{ denuncia_id: string | null }>(
      "SELECT denuncia_id FROM evidencias WHERE id = $1",
      [evidenciaId],
    );
    expect(rows[0]?.denuncia_id).not.toBeNull();
    await request(app)
      .post("/api/v1/denuncias")
      .send({
        pow: await resolverPow(app),
        accesoId: randomHex(),
        estado: "17",
        tipoFalta: "cohecho",
        relatoSellado: await selloDe(RELATO),
        evidenciaIds: [evidenciaId],
      })
      .expect(400);
  });

  it("no ata la denuncia si una evidencia no existe (atómico)", async () => {
    const antes = await pool.query("SELECT 1 FROM denuncias");
    await request(app)
      .post("/api/v1/denuncias")
      .send({
        pow: await resolverPow(app),
        accesoId: randomHex(),
        estado: "17",
        tipoFalta: "cohecho",
        relatoSellado: await selloDe(RELATO),
        evidenciaIds: [crypto.randomUUID()],
      })
      .expect(400);
    expect((await pool.query("SELECT 1 FROM denuncias")).rowCount).toBe(antes.rowCount);
  });

  it("la limpieza periódica borra solo las subidas viejas sin denuncia", async () => {
    const vieja = (await subir(await jpegConMetadatos())).body as RespuestaEvidencia;
    const reciente = (await subir(await jpegConMetadatos())).body as RespuestaEvidencia;
    await pool.query("UPDATE evidencias SET subida_dia = '2020-01-01' WHERE id = $1", [
      vieja.evidenciaId,
    ]);
    expect(await limpiarHuerfanas.ejecutar()).toBeGreaterThanOrEqual(1);
    const { rows } = await pool.query<{ id: string }>(
      "SELECT id FROM evidencias WHERE id = ANY($1)",
      [[vieja.evidenciaId, reciente.evidenciaId]],
    );
    expect(rows.map((r) => r.id)).toEqual([reciente.evidenciaId]);
  });
});

describe("acceso sin cuenta", () => {
  it("consulta con folio y con frase", async () => {
    const { folio, accesoId } = await crearDenuncia(app);
    for (const credencial of [
      { tipo: "folio", folio },
      { tipo: "frase", accesoId },
    ]) {
      const res = await consultar(credencial);
      expect(res.status).toBe(200);
      const cuerpo = respuestaConsulta.parse(res.body);
      expect(cuerpo.etapaActual).toBe("recibida");
      expect(cuerpo.lineaTiempo).toHaveLength(1);
    }
  });

  it("responde byte a byte igual exista o no la credencial, y ante cualquier fallo", async () => {
    const { folio } = await crearDenuncia(app);
    const respuestas = await Promise.all([
      consultar({ tipo: "folio", folio: "BZ-0000-0000-0000-0000" }),
      consultar({ tipo: "frase", accesoId: "f".repeat(64) }),
      // Credencial real con prueba de trabajo inválida.
      request(app)
        .post("/api/v1/acceso/consulta")
        .send({ pow: "invalida", credencial: { tipo: "folio", folio } }),
      // Forma inválida, JSON roto, sin cuerpo y exceso de tamaño.
      request(app).post("/api/v1/acceso/consulta").send({ credencial: "x" }),
      request(app)
        .post("/api/v1/acceso/consulta")
        .set("Content-Type", "application/json")
        .send('{"roto":'),
      request(app).post("/api/v1/acceso/consulta"),
      request(app)
        .post("/api/v1/acceso/consulta")
        .send({ relleno: "x".repeat(400_000) }),
    ]);
    const referencia = respuestas[0];
    expect(referencia?.status).toBe(401);
    expect(referencia?.body).toEqual(ERROR_ACCESO);
    const cabeceras = (h: Record<string, string>) => {
      const { date: _fecha, ...resto } = h;
      return resto;
    };
    for (const res of respuestas) {
      expect(res.status).toBe(401);
      expect(res.text).toBe(referencia?.text);
      expect(cabeceras(res.headers as Record<string, string>)).toEqual(
        cabeceras(referencia?.headers as Record<string, string>),
      );
    }
  });

  it("mensajes también usa el error uniforme", async () => {
    const res = await request(app)
      .post("/api/v1/acceso/mensajes")
      .send({
        pow: await resolverPow(app),
        credencial: { tipo: "frase", accesoId: "e".repeat(64) },
        cuerpoSellado: await selloDe("hola"),
      });
    expect(res.status).toBe(401);
    expect(res.body).toEqual(ERROR_ACCESO);
  });

  it("tarda al menos el tiempo mínimo, también al fallar temprano", async () => {
    const inicio = performance.now();
    await request(app).post("/api/v1/acceso/consulta").send({});
    expect(performance.now() - inicio).toBeGreaterThanOrEqual(55);
  });

  it("limita los intentos por credencial con el mismo error, incluso si es correcta", async () => {
    const { accesoId } = await crearDenuncia(app);
    const credencial = { tipo: "frase", accesoId };
    for (let i = 0; i < 8; i += 1) {
      expect((await consultar(credencial)).status).toBe(200);
    }
    const res = await consultar(credencial);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(ERROR_ACCESO);
  });

  it("no registra IP, cuerpo ni credenciales si la base de datos falla", async () => {
    const espia = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const consulta = vi.spyOn(pool, "query").mockImplementationOnce(() => {
      throw new Error("fallo con BZ-SECRETO y 127.0.0.1");
    });
    const res = await consultar({ tipo: "frase", accesoId: "d".repeat(64) });
    consulta.mockRestore();
    const salida = JSON.stringify(espia.mock.calls);
    espia.mockRestore();
    expect(res.status).toBe(401);
    expect(salida).not.toMatch(/BZ-SECRETO|127\.0\.0\.1|d{64}/);
  });
});

describe("panel de autoridad", () => {
  const ID = "6a0d3f0e-3c1c-4b7c-8a55-0a5a9a8a7a11";
  const rutas: ["get" | "post" | "delete", string][] = [
    ["get", "/autoridad/sesion"],
    ["delete", "/autoridad/sesion"],
    ["get", "/autoridad/denuncias"],
    ["get", `/autoridad/denuncias/${ID}`],
    ["post", `/autoridad/denuncias/${ID}/etapa`],
    ["post", `/autoridad/denuncias/${ID}/mensajes`],
    ["get", `/autoridad/denuncias/${ID}/evidencias/${ID}`],
  ];

  it.each(rutas)("%s %s sin sesión responde 401", async (metodo, ruta) => {
    await request(app)[metodo](`/api/v1${ruta}`).expect(401);
  });

  it("rechaza credenciales incorrectas igual si el usuario existe o no", async () => {
    const mala = await request(app)
      .post("/api/v1/autoridad/sesion")
      .send({ usuario: "autoridad.demo", contrasena: "mala" });
    const inexistente = await request(app)
      .post("/api/v1/autoridad/sesion")
      .send({ usuario: "nadie", contrasena: "mala" });
    expect(mala.status).toBe(401);
    expect(inexistente.text).toBe(mala.text);
  });

  it("emite la cookie HttpOnly y SameSite=Strict", async () => {
    const res = await request(app)
      .post("/api/v1/autoridad/sesion")
      .send({ usuario: "autoridad.demo", contrasena: "contrasena-de-prueba" })
      .expect(200);
    const cookie = (res.headers["set-cookie"] as unknown as string[])[0];
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(res.text).not.toContain("sesion_autoridad");
  });

  it("cerrar sesión invalida la cookie", async () => {
    const cookie = await iniciarSesion(app);
    await request(app).get("/api/v1/autoridad/sesion").set("Cookie", cookie).expect(200);
    await request(app).delete("/api/v1/autoridad/sesion").set("Cookie", cookie).expect(204);
    await request(app).get("/api/v1/autoridad/sesion").set("Cookie", cookie).expect(401);
  });

  it("recorre el flujo completo y deja rastro en la bitácora", async () => {
    const foto = (await subir(await jpegConMetadatos())).body as RespuestaEvidencia;
    const { folio, accesoId } = await crearDenuncia(app, { evidenciaIds: [foto.evidenciaId] });
    const cookie = await iniciarSesion(app);

    const lista = await request(app)
      .get("/api/v1/autoridad/denuncias")
      .set("Cookie", cookie)
      .expect(200);
    const resumenes = lista.body as ResumenDenunciaAutoridad[];
    const { rows } = await pool.query<{ denuncia_id: string }>(
      "SELECT denuncia_id FROM evidencias WHERE id = $1",
      [foto.evidenciaId],
    );
    const id = rows[0]?.denuncia_id as string;
    expect(resumenes.map((r) => r.id)).toContain(id);
    expect(lista.text).not.toMatch(/acceso|folio/i);

    // Relato: la autoridad lo abre con su clave privada.
    const detalle = await request(app)
      .get(`/api/v1/autoridad/denuncias/${id}`)
      .set("Cookie", cookie)
      .expect(200);
    const cuerpo = detalle.body as DetalleDenunciaAutoridad;
    expect((await abrirBytes(Buffer.from(cuerpo.relatoSellado, "base64url"))).toString()).toBe(
      RELATO,
    );
    expect(cuerpo.evidencias).toEqual([{ id: foto.evidenciaId, tipo: "image/jpeg" }]);

    // Evidencia: solo sellada, y ligada a su denuncia.
    const blob = await request(app)
      .get(`/api/v1/autoridad/denuncias/${id}/evidencias/${foto.evidenciaId}`)
      .set("Cookie", cookie)
      .buffer(true)
      .parse(binario)
      .expect(200);
    expect(blob.headers["content-type"]).toBe("application/octet-stream");
    expect((await sharp(await abrirBytes(blob.body as Buffer)).metadata()).format).toBe("jpeg");
    await request(app)
      .get(`/api/v1/autoridad/denuncias/${ID}/evidencias/${foto.evidenciaId}`)
      .set("Cookie", cookie)
      .expect(404);

    // Transición inválida rechazada, sin cambios.
    await request(app)
      .post(`/api/v1/autoridad/denuncias/${id}/etapa`)
      .set("Cookie", cookie)
      .send({ etapa: "resuelta" })
      .expect(409);
    await request(app)
      .post(`/api/v1/autoridad/denuncias/${id}/etapa`)
      .set("Cookie", cookie)
      .send({ etapa: "no_existe" })
      .expect(400);
    await request(app)
      .post(`/api/v1/autoridad/denuncias/${id}/etapa`)
      .set("Cookie", cookie)
      .send({ etapa: "turnada_investigadora" })
      .expect(200);

    // Mensajes en ambos sentidos.
    const texto = "Por favor indica la fecha aproximada";
    await request(app)
      .post(`/api/v1/autoridad/denuncias/${id}/mensajes`)
      .set("Cookie", cookie)
      .send({ cuerpo: texto })
      .expect(201);
    const guardado = await pool.query<{ c: Buffer }>(
      "SELECT cuerpo_cifrado AS c FROM mensajes WHERE denuncia_id = $1",
      [id],
    );
    expect(guardado.rows[0]?.c.toString("latin1")).not.toContain(texto);

    await request(app)
      .post("/api/v1/acceso/mensajes")
      .send({
        pow: await resolverPow(app),
        credencial: { tipo: "folio", folio },
        cuerpoSellado: await selloDe("Fue en marzo"),
      })
      .expect(201);

    // El denunciante ve el avance.
    const vista = (await consultar({ tipo: "frase", accesoId })).body as RespuestaConsulta;
    expect(vista.etapaActual).toBe("turnada_investigadora");
    expect(vista.lineaTiempo.map((e) => e.etapa)).toEqual(["recibida", "turnada_investigadora"]);
    expect(vista.mensajes.map((m) => [m.autor, m.cuerpo])).toEqual([
      ["autoridad", texto],
      ["denunciante", null],
    ]);

    // La autoridad recibe el mensaje sellado y puede abrirlo.
    const final = (
      await request(app).get(`/api/v1/autoridad/denuncias/${id}`).set("Cookie", cookie).expect(200)
    ).body as DetalleDenunciaAutoridad;
    const sellado = final.mensajes[1]?.cuerpoSellado as string;
    expect((await abrirBytes(Buffer.from(sellado, "base64url"))).toString()).toBe("Fue en marzo");

    // Cada acción quedó en la bitácora, sin contenido.
    const bitacora = await pool.query<{ accion: string }>(
      "SELECT accion FROM bitacora_autoridad WHERE denuncia_id = $1",
      [id],
    );
    const acciones = bitacora.rows.map((b) => b.accion);
    expect(acciones).toEqual(
      expect.arrayContaining([
        "denuncia_consultada",
        "evidencia_descargada",
        "etapa_rechazada:resuelta",
        "etapa_cambiada:turnada_investigadora",
        "mensaje_enviado",
      ]),
    );
    const globales = await pool.query<{ accion: string }>(
      "SELECT accion FROM bitacora_autoridad WHERE denuncia_id IS NULL",
    );
    expect(globales.rows.map((b) => b.accion)).toEqual(
      expect.arrayContaining(["sesion_iniciada", "denuncias_listadas"]),
    );
  });

  it("devuelve 404, no 500, ante un identificador mal formado", async () => {
    const cookie = await iniciarSesion(app);
    await request(app)
      .get("/api/v1/autoridad/denuncias/no-es-uuid")
      .set("Cookie", cookie)
      .expect(404);
  });
});
