// Backend simulado para las pruebas E2E, basado en los esquemas de @dataton/shared.
// Valida cada solicitud con el contrato real y verifica la prueba de trabajo con altcha-lib.
import { createServer } from "node:http";
import { randomInt, randomUUID } from "node:crypto";
import {
  ERROR_ACCESO,
  generarParDeClaves,
  solicitudConsulta,
  solicitudDenuncia,
  solicitudMensajeDenunciante,
} from "@dataton/shared";
import { createChallenge, verifySolution } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import { responderPublico } from "./datos-publicos.mjs";

const PUERTO = Number(process.env.PUERTO_SIMULADO ?? 4100);
const SECRETO = "secreto-solo-para-pruebas";
const SECRETO_CLAVE = "otro-secreto-solo-para-pruebas";
const { publica } = await generarParDeClaves();

const denuncias = new Map();
const bitacora = [];
const desafiosUsados = new Set();

const folioNuevo = () => {
  const alfabeto = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const grupo = () =>
    Array.from({ length: 4 }, () => alfabeto[Math.floor(Math.random() * 32)]).join("");
  return `BZ-${grupo()}-${grupo()}-${grupo()}-${grupo()}`;
};

const leerCuerpo = async (peticion) => {
  const partes = [];
  for await (const parte of peticion) partes.push(parte);
  return Buffer.concat(partes);
};

const powValida = async (pow) => {
  try {
    const { challenge, solution } = JSON.parse(atob(pow));
    if (desafiosUsados.has(challenge.signature)) return false;
    const { verified } = await verifySolution({
      challenge,
      solution,
      deriveKey,
      hmacSignatureSecret: SECRETO,
      hmacKeySignatureSecret: SECRETO_CLAVE,
    });
    if (verified) desafiosUsados.add(challenge.signature);
    return verified;
  } catch {
    return false;
  }
};

const claveDe = (credencial) =>
  credencial.tipo === "folio" ? credencial.folio : credencial.accesoId;

const servidor = createServer(async (peticion, respuesta) => {
  const url = new URL(peticion.url, "http://simulado");
  const ruta = url.pathname.replace("/api/v1", "");
  const responder = (estado, cuerpo) => {
    respuesta.writeHead(estado, { "Content-Type": "application/json" });
    respuesta.end(cuerpo === undefined ? undefined : JSON.stringify(cuerpo));
  };
  const cuerpoCrudo = await leerCuerpo(peticion);
  const texto = peticion.headers["content-type"]?.includes("json") ? cuerpoCrudo.toString() : "";
  bitacora.push({ metodo: peticion.method, url: peticion.url, cuerpo: texto });

  if (ruta === "/__bitacora") return responder(200, bitacora);
  if (peticion.method === "GET" && ruta.startsWith("/publico/")) {
    const datos = responderPublico(ruta, url.searchParams);
    if (datos) return responder(200, datos);
  }
  if (peticion.method === "GET" && ruta === "/configuracion") {
    return responder(200, {
      clavePublicaAutoridad: publica,
      maxBytesEvidencia: 5 * 1024 * 1024,
      maxEvidencias: 3,
      tiposEvidencia: ["image/jpeg", "image/png", "application/pdf"],
    });
  }
  if (peticion.method === "GET" && ruta === "/pow/reto") {
    return responder(
      200,
      await createChallenge({
        algorithm: "PBKDF2/SHA-256",
        cost: 200,
        counter: randomInt(1, 200),
        deriveKey,
        hmacSignatureSecret: SECRETO,
        hmacKeySignatureSecret: SECRETO_CLAVE,
        expiresAt: Math.floor(Date.now() / 1000) + 300,
      }),
    );
  }
  if (peticion.method === "POST" && ruta === "/evidencias") {
    if (!(await powValida(url.searchParams.get("pow")))) return responder(400, { error: {} });
    return responder(201, {
      evidenciaId: randomUUID(),
      metadatosEliminadosEnServidor: ["Software de edición"],
    });
  }
  if (peticion.method === "POST" && ruta === "/denuncias") {
    const solicitud = solicitudDenuncia.safeParse(JSON.parse(texto));
    if (!solicitud.success || !(await powValida(solicitud.data.pow))) {
      return responder(400, { error: { message: "Solicitud inválida." } });
    }
    const folio = folioNuevo();
    const registro = {
      etapaActual: "turnada_investigadora",
      lineaTiempo: [
        { etapa: "turnada_investigadora", dia: "2026-11-03" },
        { etapa: "recibida", dia: "2026-11-01" },
      ],
      mensajes: [
        {
          autor: "autoridad",
          dia: "2026-11-03",
          cuerpo: "Recibimos tu denuncia. ¿Puedes indicar en qué oficina ocurrió?",
        },
      ],
    };
    denuncias.set(folio, registro);
    denuncias.set(solicitud.data.accesoId, registro);
    return responder(201, { folio });
  }
  if (peticion.method === "POST" && ruta === "/acceso/consulta") {
    const solicitud = solicitudConsulta.safeParse(JSON.parse(texto));
    const registro = solicitud.success && denuncias.get(claveDe(solicitud.data.credencial));
    if (!registro || !(await powValida(solicitud.data.pow))) return responder(401, ERROR_ACCESO);
    return responder(200, registro);
  }
  if (peticion.method === "POST" && ruta === "/acceso/mensajes") {
    const solicitud = solicitudMensajeDenunciante.safeParse(JSON.parse(texto));
    const registro = solicitud.success && denuncias.get(claveDe(solicitud.data.credencial));
    if (!registro || !(await powValida(solicitud.data.pow))) return responder(401, ERROR_ACCESO);
    registro.mensajes.push({ autor: "denunciante", dia: "2026-11-04", cuerpo: null });
    return responder(204);
  }
  return responder(404, { error: { message: "No encontrado" } });
});

servidor.listen(PUERTO);
