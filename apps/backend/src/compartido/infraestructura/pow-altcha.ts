import { createHash, randomInt } from "node:crypto";
import { createChallenge, verifySolution, type Challenge, type Solution } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import type { VerificadorPow } from "../aplicacion/puertos.js";

export interface OpcionesPow {
  claveHmac: string;
  /** Iteraciones de PBKDF2 por intento. */
  costo: number;
  /** El contador secreto se elige entre 1 y este valor: el trabajo esperado es costo × contador/2. */
  contadorMax: number;
  expiraSeg: number;
  maxUsados: number;
  ahoraMs?: () => number;
}

/**
 * Altcha autoalojado (protocolo v2, el del widget altcha 3). Los retos son sin estado: van
 * firmados y con expiración, y solo se recuerdan en memoria los ya usados hasta que expiran.
 * La verificación compara una firma de la clave derivada, sin gastar CPU del servidor en PBKDF2.
 */
export class PowAltcha implements VerificadorPow {
  private readonly usados = new Map<string, number>();
  private readonly secretoClave: string;
  private readonly ahoraMs: () => number;

  constructor(private readonly opciones: OpcionesPow) {
    this.secretoClave = createHash("sha256")
      .update(`clave-derivada:${opciones.claveHmac}`)
      .digest("hex");
    this.ahoraMs = opciones.ahoraMs ?? Date.now;
  }

  crearReto(): Promise<Challenge> {
    const { claveHmac, costo, contadorMax, expiraSeg } = this.opciones;
    return createChallenge({
      algorithm: "PBKDF2/SHA-256",
      cost: costo,
      counter: randomInt(1, contadorMax + 1),
      deriveKey,
      expiresAt: Math.floor(this.ahoraMs() / 1000) + expiraSeg,
      hmacSignatureSecret: claveHmac,
      hmacKeySignatureSecret: this.secretoClave,
    });
  }

  async consumir(pow: string): Promise<boolean> {
    try {
      const { challenge, solution } = JSON.parse(Buffer.from(pow, "base64").toString("utf8")) as {
        challenge?: Challenge;
        solution?: Solution;
      };
      if (!challenge?.parameters?.keySignature || !challenge.signature || !solution) return false;
      const resultado = await verifySolution({
        challenge,
        solution,
        deriveKey,
        hmacSignatureSecret: this.opciones.claveHmac,
        hmacKeySignatureSecret: this.secretoClave,
      });
      if (!resultado.verified) return false;
      return this.marcarUsado(challenge.signature, (challenge.parameters.expiresAt ?? 0) * 1000);
    } catch {
      return false;
    }
  }

  private marcarUsado(firma: string, expiraMs: number): boolean {
    if (this.usados.has(firma)) return false;
    if (this.usados.size >= this.opciones.maxUsados) {
      const ahora = this.ahoraMs();
      for (const [clave, expira] of this.usados) {
        if (expira <= ahora) this.usados.delete(clave);
      }
      if (this.usados.size >= this.opciones.maxUsados) return false;
    }
    this.usados.set(firma, expiraMs);
    return true;
  }
}
