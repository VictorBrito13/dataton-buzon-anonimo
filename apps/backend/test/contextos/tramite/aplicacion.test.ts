import type { Etapa } from "@dataton/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { LimiteIntentos } from "../../../src/compartido/dominio/limite-intentos.js";
import { CasosDenunciasAutoridad } from "../../../src/contextos/tramite/aplicacion/casos-denuncias.js";
import { CasosSesion } from "../../../src/contextos/tramite/aplicacion/casos-sesion.js";
import type {
  AlmacenSesiones,
  DetalleCrudo,
  RepositorioTramite,
  TransaccionTramite,
} from "../../../src/contextos/tramite/aplicacion/puertos.js";
import type { Sesion } from "../../../src/contextos/tramite/dominio/sesion.js";

interface Registro {
  usuarioId: string;
  accion: string;
  denunciaId: string | null;
}

const ID = "d1";
const sesion: Sesion = { usuarioId: "u1", usuario: "ana", expiraMs: Number.MAX_SAFE_INTEGER };

class RepositorioFalso implements RepositorioTramite {
  etapas = new Map<string, Etapa>([[ID, "recibida"]]);
  bitacora: Registro[] = [];
  cambios: { etapa: Etapa; dia: string }[] = [];
  mensajes: { cifrado: Uint8Array; dia: string }[] = [];
  evidencias = new Map([["e1", { tipo: "image/png", blobSellado: new Uint8Array([9]) }]]);
  fallarAlRegistrar = false;

  private readonly tx: TransaccionTramite = {
    etapaBloqueada: (id) => Promise.resolve(this.etapas.get(id) ?? null),
    cambiarEtapa: (id, etapa, dia) => {
      this.etapas.set(id, etapa);
      this.cambios.push({ etapa, dia });
      return Promise.resolve();
    },
    agregarMensaje: (_id, cifrado, dia) => {
      this.mensajes.push({ cifrado, dia });
      return Promise.resolve();
    },
    registrar: (usuarioId, accion, denunciaId) => this.registrar(usuarioId, accion, denunciaId),
  };

  transaccion<T>(fn: (tx: TransaccionTramite) => Promise<T>): Promise<T> {
    return fn(this.tx);
  }
  registrar(usuarioId: string, accion: string, denunciaId: string | null): Promise<void> {
    if (this.fallarAlRegistrar) return Promise.reject(new Error("bitácora caída"));
    this.bitacora.push({ usuarioId, accion, denunciaId });
    return Promise.resolve();
  }
  listar() {
    return Promise.resolve([
      {
        id: ID,
        estado: "17",
        municipio: null,
        tipoFalta: "cohecho" as const,
        enteId: null,
        etapa: "recibida" as const,
        recibidaDia: "2026-01-01",
      },
    ]);
  }
  detalle(id: string): Promise<DetalleCrudo | null> {
    if (id !== ID) return Promise.resolve(null);
    return Promise.resolve({
      id: ID,
      estado: "17",
      municipio: null,
      tipoFalta: "cohecho",
      enteId: null,
      etapa: "recibida",
      recibidaDia: "2026-01-01",
      relatoSellado: new Uint8Array([1, 2, 3]),
      lineaTiempo: [{ etapa: "recibida", dia: "2026-01-01" }],
      evidencias: [{ id: "e1", tipo: "image/png" }],
      mensajes: [
        {
          autor: "autoridad",
          dia: "2026-01-02",
          cuerpoCifrado: new TextEncoder().encode("Hola"),
          cuerpoSellado: null,
        },
        {
          autor: "denunciante",
          dia: "2026-01-03",
          cuerpoCifrado: null,
          cuerpoSellado: new Uint8Array([251, 255]),
        },
      ],
    });
  }
  evidencia(denunciaId: string, evidenciaId: string) {
    if (denunciaId !== ID) return Promise.resolve(null);
    return Promise.resolve(this.evidencias.get(evidenciaId) ?? null);
  }
}

const reloj = { ahora: () => new Date("2026-05-02T18:44:12Z") };
const cifrador = {
  cifrar: (texto: string) => new TextEncoder().encode(texto),
  descifrar: (bytes: Uint8Array) => new TextDecoder().decode(bytes),
};
const codigo = async (promesa: Promise<unknown>) =>
  promesa.then(
    () => undefined,
    (e: { codigo?: string }) => e.codigo,
  );

describe("CasosDenunciasAutoridad", () => {
  let repo: RepositorioFalso;
  let casos: CasosDenunciasAutoridad;

  beforeEach(() => {
    repo = new RepositorioFalso();
    casos = new CasosDenunciasAutoridad({ repositorio: repo, cifrador, reloj });
  });

  it("lista y lo registra en la bitácora", async () => {
    expect(await casos.listar(sesion)).toHaveLength(1);
    expect(repo.bitacora).toEqual([
      { usuarioId: "u1", accion: "denuncias_listadas", denunciaId: null },
    ]);
  });

  it("el detalle descifra lo de la autoridad, no abre lo sellado y queda en bitácora", async () => {
    const detalle = await casos.ver(sesion, ID);
    expect(detalle.relatoSellado).toBe("AQID");
    expect(detalle.mensajes).toEqual([
      { autor: "autoridad", dia: "2026-01-02", cuerpo: "Hola", cuerpoSellado: null },
      { autor: "denunciante", dia: "2026-01-03", cuerpo: null, cuerpoSellado: "-_8" },
    ]);
    expect(repo.bitacora[0]).toMatchObject({ accion: "denuncia_consultada", denunciaId: ID });
  });

  it("una denuncia inexistente da 'no encontrada', sin bitácora ligada a ella", async () => {
    expect(await codigo(casos.ver(sesion, "otra"))).toBe("denuncia_no_encontrada");
    expect(repo.bitacora).toHaveLength(0);
  });

  it("cambia de etapa con el día y registra el cambio", async () => {
    await casos.cambiarEtapa(sesion, ID, "turnada_investigadora");
    expect(repo.cambios).toEqual([{ etapa: "turnada_investigadora", dia: "2026-05-02" }]);
    expect(repo.bitacora[0]?.accion).toBe("etapa_cambiada:turnada_investigadora");
  });

  it("rechaza una transición inválida, sin cambios, y registra el intento", async () => {
    expect(await codigo(casos.cambiarEtapa(sesion, ID, "resuelta"))).toBe("transicion_invalida");
    expect(repo.cambios).toHaveLength(0);
    expect(repo.etapas.get(ID)).toBe("recibida");
    expect(repo.bitacora[0]?.accion).toBe("etapa_rechazada:resuelta");
  });

  it("cifra el mensaje de la autoridad y lo registra", async () => {
    await casos.enviarMensaje(sesion, ID, "Necesitamos más datos");
    expect(new TextDecoder().decode(repo.mensajes[0]?.cifrado)).toBe("Necesitamos más datos");
    expect(repo.mensajes[0]?.dia).toBe("2026-05-02");
    expect(repo.bitacora[0]).toMatchObject({ accion: "mensaje_enviado", denunciaId: ID });
  });

  it("no envía mensajes a una denuncia inexistente", async () => {
    expect(await codigo(casos.enviarMensaje(sesion, "otra", "x"))).toBe("denuncia_no_encontrada");
  });

  it("entrega la evidencia sellada y registra la descarga", async () => {
    expect(await casos.descargarEvidencia(sesion, ID, "e1")).toEqual({
      tipo: "image/png",
      blobSellado: new Uint8Array([9]),
    });
    expect(repo.bitacora[0]?.accion).toBe("evidencia_descargada");
  });

  it("no entrega evidencias de otra denuncia", async () => {
    expect(await codigo(casos.descargarEvidencia(sesion, "otra", "e1"))).toBe(
      "evidencia_no_encontrada",
    );
    expect(repo.bitacora).toHaveLength(0);
  });

  it("falla cerrado: sin bitácora no se entrega la información", async () => {
    repo.fallarAlRegistrar = true;
    await expect(casos.ver(sesion, ID)).rejects.toThrow(/bitácora/);
    await expect(casos.descargarEvidencia(sesion, ID, "e1")).rejects.toThrow(/bitácora/);
  });
});

describe("CasosSesion", () => {
  class AlmacenFalso implements AlmacenSesiones {
    sesiones = new Map<string, Sesion>();
    crear(s: Sesion): string {
      const token = `t${this.sesiones.size}`;
      this.sesiones.set(token, s);
      return token;
    }
    obtener(token: string): Sesion | null {
      return this.sesiones.get(token) ?? null;
    }
    borrar(token: string): void {
      this.sesiones.delete(token);
    }
  }

  const armar = (maxIntentos = 10, maxGlobal = 100) => {
    const repo = new RepositorioFalso();
    const almacen = new AlmacenFalso();
    const verificados: (string | null)[] = [];
    let ahoraMs = 1000;
    const casos = new CasosSesion(
      {
        usuarios: {
          buscar: (usuario) =>
            Promise.resolve(usuario === "ana" ? { id: "u1", usuario: "ana", hash: "HASH" } : null),
        },
        hasher: {
          verificar: (hash, contrasena) => {
            verificados.push(hash);
            return Promise.resolve(hash === "HASH" && contrasena === "secreta");
          },
        },
        almacen,
        bitacora: repo,
        reloj: { ahora: () => new Date(ahoraMs) },
        limite: new LimiteIntentos({ maximo: maxIntentos, ventanaMs: 100_000, maxClaves: 10 }),
        limiteGlobal: new LimiteIntentos({ maximo: maxGlobal, ventanaMs: 60_000, maxClaves: 1 }),
      },
      500,
    );
    return { casos, repo, almacen, verificados, avanzar: (ms: number) => (ahoraMs += ms) };
  };

  it("limita los inicios de sesión de todo el panel, sin importar el usuario", async () => {
    const { casos, verificados } = armar(10, 2);
    await codigo(casos.iniciar("nadie", "x"));
    await codigo(casos.iniciar("otro", "x"));
    expect(await codigo(casos.iniciar("ana", "secreta"))).toBe("demasiados_intentos");
    expect(verificados).toHaveLength(2);
  });

  it("inicia sesión, la registra y la sesión queda vigente", async () => {
    const { casos, repo } = armar();
    const { token, usuario } = await casos.iniciar("ana", "secreta");
    expect(usuario).toBe("ana");
    expect(casos.actual(token)).toMatchObject({ usuarioId: "u1" });
    expect(repo.bitacora[0]).toMatchObject({ usuarioId: "u1", accion: "sesion_iniciada" });
  });

  it("da el mismo error con contraseña mala o usuario inexistente, y siempre verifica", async () => {
    const { casos, verificados } = armar();
    expect(await codigo(casos.iniciar("ana", "mala"))).toBe("credenciales_invalidas");
    expect(await codigo(casos.iniciar("nadie", "mala"))).toBe("credenciales_invalidas");
    expect(verificados).toEqual(["HASH", null]);
  });

  it("limita los intentos por usuario", async () => {
    const { casos } = armar(1);
    await codigo(casos.iniciar("ana", "mala"));
    expect(await codigo(casos.iniciar("ana", "secreta"))).toBe("demasiados_intentos");
  });

  it("la sesión expira y se borra", async () => {
    const { casos, almacen, avanzar } = armar();
    const { token } = await casos.iniciar("ana", "secreta");
    avanzar(500);
    expect(casos.actual(token)).toBeNull();
    expect(almacen.sesiones.size).toBe(0);
  });

  it("cerrar sesión la invalida y queda en bitácora", async () => {
    const { casos, repo } = armar();
    const { token } = await casos.iniciar("ana", "secreta");
    await casos.cerrar(token);
    expect(casos.actual(token)).toBeNull();
    expect(repo.bitacora.at(-1)?.accion).toBe("sesion_cerrada");
  });
});
