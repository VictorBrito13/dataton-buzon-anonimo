import { abrir, sellar, type RespuestaDenuncia } from "@dataton/shared";
import { solveChallenge, type Challenge } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import type { Express } from "express";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { migrar } from "../../src/db/migrate.js";
import { pool } from "../../src/db/postgres.js";
import { hashSecret } from "../../src/security/argon2.js";

/** Par de desarrollo documentado en .env.example; la pública es el valor por defecto de env.ts. */
const CLAVE_PUBLICA_DESARROLLO = {
  kty: "EC",
  crv: "P-256",
  x: "4Ce4VQgpxVOK83QXNpWp9aDvR8xbbbLaT7xqguAykvM",
  y: "lLgpqedTMB40bkFVOShb5LCUNRBnt3lk7f0akK1MdzA",
};
export const CLAVE_PRIVADA_DESARROLLO = {
  ...CLAVE_PUBLICA_DESARROLLO,
  d: "llg6YonUYprovZVU_tdH2U4ZGEfdsBUWtfzEx-b36J4",
};

export const USUARIO = { usuario: "autoridad.demo", contrasena: "contrasena-de-prueba" };
export const RELATO = "El director recibio un soborno en la oficina del tercer piso";

export const prepararBase = async (): Promise<Express> => {
  await migrar();
  await pool.query(
    "TRUNCATE bitacora_autoridad, autoridad_usuarios, mensajes, evidencias, denuncia_etapas, denuncias CASCADE",
  );
  await pool.query("INSERT INTO autoridad_usuarios (usuario, contrasena_hash) VALUES ($1, $2)", [
    USUARIO.usuario,
    await hashSecret(USUARIO.contrasena),
  ]);
  return createApp();
};

export const resolverPow = async (app: Express): Promise<string> => {
  const reto = await request(app).get("/api/v1/pow/reto").expect(200);
  const challenge = reto.body as Challenge;
  const solution = await solveChallenge({ challenge, deriveKey });
  return Buffer.from(JSON.stringify({ challenge, solution })).toString("base64");
};

export const selloDe = async (texto: string): Promise<string> =>
  Buffer.from(
    await sellar(CLAVE_PUBLICA_DESARROLLO, new Uint8Array(Buffer.from(texto, "utf8"))),
  ).toString("base64url");

export const abrirBytes = async (sello: Uint8Array): Promise<Buffer> =>
  Buffer.from(await abrir(CLAVE_PRIVADA_DESARROLLO, new Uint8Array(sello)));

export const crearDenuncia = async (
  app: Express,
  sobre: Record<string, unknown> = {},
): Promise<{ folio: string; accesoId: string }> => {
  const accesoId = (sobre.accesoId as string | undefined) ?? randomHex();
  const respuesta = await request(app)
    .post("/api/v1/denuncias")
    .send({
      pow: await resolverPow(app),
      accesoId,
      estado: "17",
      municipio: "17001",
      tipoFalta: "cohecho",
      relatoSellado: await selloDe(RELATO),
      evidenciaIds: [],
      ...sobre,
    })
    .expect(201);
  return { folio: (respuesta.body as RespuestaDenuncia).folio, accesoId };
};

export const randomHex = (): string =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");

export const iniciarSesion = async (app: Express): Promise<string> => {
  const respuesta = await request(app).post("/api/v1/autoridad/sesion").send(USUARIO).expect(200);
  const cookies = respuesta.headers["set-cookie"] as unknown as string[];
  return (cookies[0] as string).split(";")[0] as string;
};

/** Evita los `any` de supertest al leer un cuerpo binario. */
export const binario = (
  res: unknown,
  fin: (error: Error | null, cuerpo: unknown) => void,
): void => {
  const flujo = res as NodeJS.ReadableStream;
  const partes: Buffer[] = [];
  flujo.on("data", (parte: Buffer) => partes.push(parte));
  flujo.on("end", () => fin(null, Buffer.concat(partes)));
};
