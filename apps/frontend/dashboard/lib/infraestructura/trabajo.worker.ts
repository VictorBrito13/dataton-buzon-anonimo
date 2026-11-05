import { derivarAccesoId } from "@dataton/shared";
import { solveChallenge, type Challenge } from "altcha-lib";
import { deriveKey as derivarPbkdf2 } from "altcha-lib/algorithms/web/pbkdf2";
import { deriveKey as derivarSha } from "altcha-lib/algorithms/web/sha";

/**
 * Trabajo pesado fuera del hilo principal, para que la pantalla no se congele en un celular
 * de gama baja: Argon2id de la frase y prueba de trabajo de Altcha. Sin red.
 */
export type PeticionTrabajo =
  { id: number; tipo: "derivar"; frase: string } | { id: number; tipo: "pow"; desafio: Challenge };

export type RespuestaTrabajo = { id: number; resultado: string } | { id: number; error: true };

const resolver = async (desafio: Challenge): Promise<string> => {
  const { algorithm } = desafio.parameters;
  const deriveKey = algorithm.startsWith("PBKDF2/") ? derivarPbkdf2 : derivarSha;
  const solucion = await solveChallenge({ challenge: desafio, deriveKey });
  if (!solucion) throw new Error("Sin solución a tiempo");
  return btoa(JSON.stringify({ challenge: desafio, solution: solucion }));
};

self.onmessage = async ({ data }: MessageEvent<PeticionTrabajo>) => {
  const responder = (mensaje: RespuestaTrabajo) => self.postMessage(mensaje);
  try {
    const resultado =
      data.tipo === "derivar" ? await derivarAccesoId(data.frase) : await resolver(data.desafio);
    responder({ id: data.id, resultado });
  } catch {
    responder({ id: data.id, error: true });
  }
};
