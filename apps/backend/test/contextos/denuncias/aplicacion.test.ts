import { describe, expect, it } from "vitest";
import type { Credencial } from "@dataton/shared";
import { LimiteIntentos } from "../../../src/compartido/dominio/limite-intentos.js";
import type { CifradorMensajes, Reloj } from "../../../src/compartido/aplicacion/puertos.js";
import { ConsultarDenuncia } from "../../../src/contextos/denuncias/aplicacion/consultar-denuncia.js";
import { CrearDenuncia } from "../../../src/contextos/denuncias/aplicacion/crear-denuncia.js";
import { EnviarMensajeDenunciante } from "../../../src/contextos/denuncias/aplicacion/enviar-mensaje-denunciante.js";
import { PuertaAcceso } from "../../../src/contextos/denuncias/aplicacion/puerta-acceso.js";
import type {
  Huellas,
  RepositorioDenuncias,
  ResultadoCreacion,
  Seguimiento,
} from "../../../src/contextos/denuncias/aplicacion/puertos.js";
import type { Denuncia } from "../../../src/contextos/denuncias/dominio/denuncia.js";

const HEX = "a".repeat(64);
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const sello = () => {
  const b = new Uint8Array(100);
  b[0] = 1;
  return b;
};

class RepositorioFalso implements RepositorioDenuncias {
  denuncias: { id: string; denuncia: Denuncia; folio: string; acceso: string }[] = [];
  mensajes: { id: string; sello: Uint8Array; dia: string }[] = [];
  evidenciasLibres = new Map<string, number>();
  seguimientoDe: Seguimiento = {
    etapaActual: "recibida",
    lineaTiempo: [{ etapa: "recibida", dia: "2026-01-01" }],
    mensajes: [],
  };

  crear(
    denuncia: Denuncia,
    huellas: { folio: Uint8Array; acceso: Uint8Array },
  ): Promise<ResultadoCreacion> {
    if (this.denuncias.some((d) => d.acceso === hex(huellas.acceso))) {
      return Promise.resolve("acceso_duplicado");
    }
    if (denuncia.evidenciaIds.some((id) => !this.evidenciasLibres.has(id))) {
      return Promise.resolve("evidencia_invalida");
    }
    this.denuncias.push({
      id: `d${this.denuncias.length}`,
      denuncia,
      folio: hex(huellas.folio),
      acceso: hex(huellas.acceso),
    });
    return Promise.resolve("creada");
  }
  tamanosEvidencias(ids: readonly string[]): Promise<number[]> {
    return Promise.resolve(ids.map((id) => this.evidenciasLibres.get(id) ?? 0));
  }
  buscarId(via: "folio" | "acceso", huella: Uint8Array): Promise<string | null> {
    const d = this.denuncias.find((x) => x[via] === hex(huella));
    return Promise.resolve(d?.id ?? null);
  }
  seguimiento(): Promise<Seguimiento> {
    return Promise.resolve(this.seguimientoDe);
  }
  agregarMensajeDenunciante(id: string, cuerpoSellado: Uint8Array, dia: string): Promise<void> {
    this.mensajes.push({ id, sello: cuerpoSellado, dia });
    return Promise.resolve();
  }
}

const huellas: Huellas = {
  huella: (valor) => new TextEncoder().encode(`h:${valor}`),
};
const reloj: Reloj = { ahora: () => new Date("2026-05-02T18:44:12Z") };
const powValida = { consumir: (pow: string) => Promise.resolve(pow === "ok") };
const azar = { bytes: (n: number) => new Uint8Array(n).fill(7) };
const MAX_TOTAL = 1000;

const limitesDeCreacion = (maximo = 100) => ({
  limiteCredencial: new LimiteIntentos({ maximo, ventanaMs: 60_000, maxClaves: 10 }),
  limiteGlobal: new LimiteIntentos({ maximo, ventanaMs: 60_000, maxClaves: 1 }),
});

const armarCrear = (
  repo = new RepositorioFalso(),
  sobre: Partial<ReturnType<typeof limitesDeCreacion>> = {},
) => ({
  repo,
  caso: new CrearDenuncia(
    { repositorio: repo, huellas, reloj, pow: powValida, azar, ...limitesDeCreacion(), ...sobre },
    MAX_TOTAL,
  ),
});

const solicitud = {
  pow: "ok",
  accesoId: HEX,
  estado: "17",
  tipoFalta: "cohecho" as const,
  relatoSellado: sello(),
  evidenciaIds: [] as string[],
};

const codigo = async (promesa: Promise<unknown>) =>
  promesa.then(
    () => undefined,
    (e: { codigo?: string }) => e.codigo,
  );

describe("CrearDenuncia", () => {
  it("devuelve un folio y guarda solo las huellas, con la fecha al día", async () => {
    const { repo, caso } = armarCrear();
    const { folio } = await caso.ejecutar(solicitud);
    const guardada = repo.denuncias[0];
    expect(folio).toMatch(/^BZ(-[0-9A-Z]{4}){4}$/);
    expect(guardada?.folio).toBe(hex(huellas.huella(folio)));
    expect(guardada?.acceso).toBe(hex(huellas.huella(HEX)));
    expect(guardada?.denuncia.recibidaDia).toBe("2026-05-02");
    expect(JSON.stringify(guardada?.denuncia)).not.toContain(folio);
    expect(JSON.stringify(guardada?.denuncia)).not.toContain(HEX);
  });

  it("exige prueba de trabajo válida", async () => {
    const { repo, caso } = armarCrear();
    expect(await codigo(caso.ejecutar({ ...solicitud, pow: "mala" }))).toBe("pow_invalida");
    expect(repo.denuncias).toHaveLength(0);
  });

  it("rechaza una frase ya usada", async () => {
    const { caso } = armarCrear();
    await caso.ejecutar(solicitud);
    expect(await codigo(caso.ejecutar(solicitud))).toBe("acceso_duplicado");
  });

  it("pasa por el límite por credencial: tras agotarlo ni siquiera consulta la frase", async () => {
    const { repo, caso } = armarCrear(undefined, {
      limiteCredencial: new LimiteIntentos({ maximo: 1, ventanaMs: 60_000, maxClaves: 10 }),
    });
    await caso.ejecutar(solicitud);
    expect(await codigo(caso.ejecutar(solicitud))).toBe("demasiados_intentos");
    expect(await codigo(caso.ejecutar({ ...solicitud, accesoId: "b".repeat(64) }))).toBeUndefined();
    expect(repo.denuncias).toHaveLength(2);
  });

  it("pasa por el límite global, cualquiera que sea la frase", async () => {
    const { repo, caso } = armarCrear(undefined, {
      limiteGlobal: new LimiteIntentos({ maximo: 1, ventanaMs: 60_000, maxClaves: 1 }),
    });
    await caso.ejecutar(solicitud);
    expect(await codigo(caso.ejecutar({ ...solicitud, accesoId: "b".repeat(64) }))).toBe(
      "demasiados_intentos",
    );
    expect(repo.denuncias).toHaveLength(1);
  });

  it("rechaza evidencias inexistentes o ya ligadas", async () => {
    const { caso } = armarCrear();
    expect(await codigo(caso.ejecutar({ ...solicitud, evidenciaIds: ["x"] }))).toBe(
      "evidencia_invalida",
    );
  });

  it("rechaza más evidencias de las permitidas por denuncia", async () => {
    const { caso } = armarCrear();
    const evidenciaIds = ["1", "2", "3", "4", "5", "6"];
    expect(await codigo(caso.ejecutar({ ...solicitud, evidenciaIds }))).toBe(
      "demasiadas_evidencias",
    );
  });

  it("rechaza si el total de evidencias excede el máximo, sin contar el sobrecosto del sello", async () => {
    const { repo, caso } = armarCrear();
    repo.evidenciasLibres.set("a", 600 + 94);
    repo.evidenciasLibres.set("b", 400 + 94);
    await expect(caso.ejecutar({ ...solicitud, evidenciaIds: ["a", "b"] })).resolves.toBeDefined();
    repo.evidenciasLibres.set("c", 1 + 94);
    expect(
      await codigo(
        caso.ejecutar({ ...solicitud, accesoId: "b".repeat(64), evidenciaIds: ["a", "b", "c"] }),
      ),
    ).toBe("evidencias_exceden_total");
  });
});

describe("PuertaAcceso", () => {
  const preparar = async (limites?: { credencial?: number; global?: number }) => {
    const repo = new RepositorioFalso();
    const { folio } = await new CrearDenuncia(
      { repositorio: repo, huellas, reloj, pow: powValida, azar, ...limitesDeCreacion() },
      MAX_TOTAL,
    ).ejecutar(solicitud);
    const puerta = new PuertaAcceso({
      repositorio: repo,
      huellas,
      reloj,
      pow: powValida,
      limiteCredencial: new LimiteIntentos({
        maximo: limites?.credencial ?? 100,
        ventanaMs: 1000,
        maxClaves: 100,
      }),
      limiteGlobal: new LimiteIntentos({
        maximo: limites?.global ?? 100,
        ventanaMs: 1000,
        maxClaves: 1,
      }),
    });
    return { repo, puerta, folio };
  };

  it("abre con folio y con frase", async () => {
    const { puerta, folio } = await preparar();
    const porFolio: Credencial = { tipo: "folio", folio };
    const porFrase: Credencial = { tipo: "frase", accesoId: HEX };
    expect(await puerta.abrir("ok", porFolio)).toBe("d0");
    expect(await puerta.abrir("ok", porFrase)).toBe("d0");
  });

  it("no abre con pow inválida ni credencial inexistente", async () => {
    const { puerta, folio } = await preparar();
    expect(await puerta.abrir("mala", { tipo: "folio", folio })).toBeNull();
    expect(await puerta.abrir("ok", { tipo: "frase", accesoId: "c".repeat(64) })).toBeNull();
  });

  it("no confunde un folio con un identificador de frase", async () => {
    const { puerta } = await preparar();
    expect(await puerta.abrir("ok", { tipo: "folio", folio: "BZ-0000-0000-0000-0000" })).toBeNull();
  });

  it("aplica el límite por credencial aun si es correcta", async () => {
    const { puerta, folio } = await preparar({ credencial: 1 });
    expect(await puerta.abrir("ok", { tipo: "folio", folio })).toBe("d0");
    expect(await puerta.abrir("ok", { tipo: "folio", folio })).toBeNull();
    expect(await puerta.abrir("ok", { tipo: "frase", accesoId: HEX })).toBe("d0");
  });

  it("aplica el límite global a cualquier credencial", async () => {
    const { puerta, folio } = await preparar({ global: 1 });
    expect(await puerta.abrir("ok", { tipo: "folio", folio })).toBe("d0");
    expect(await puerta.abrir("ok", { tipo: "frase", accesoId: HEX })).toBeNull();
  });
});

describe("ConsultarDenuncia y EnviarMensajeDenunciante", () => {
  const credencial: Credencial = { tipo: "frase", accesoId: HEX };
  const cifrador: CifradorMensajes = {
    cifrar: (texto) => new TextEncoder().encode(texto),
    descifrar: (bytes) => new TextDecoder().decode(bytes),
  };
  const puerta = (id: string | null) => ({ abrir: () => Promise.resolve(id) });

  it("muestra el mensaje de la autoridad en claro y oculta el del denunciante", async () => {
    const repo = new RepositorioFalso();
    repo.seguimientoDe.mensajes = [
      { autor: "autoridad", dia: "2026-01-02", cuerpoCifrado: cifrador.cifrar("Hola", "d0") },
      { autor: "denunciante", dia: "2026-01-03", cuerpoCifrado: null },
    ];
    const caso = new ConsultarDenuncia({ puerta: puerta("d0"), repositorio: repo, cifrador });
    expect(await caso.ejecutar("ok", credencial)).toEqual({
      etapaActual: "recibida",
      lineaTiempo: [{ etapa: "recibida", dia: "2026-01-01" }],
      mensajes: [
        { autor: "autoridad", dia: "2026-01-02", cuerpo: "Hola" },
        { autor: "denunciante", dia: "2026-01-03", cuerpo: null },
      ],
    });
  });

  it("devuelve null si la puerta no abre", async () => {
    const caso = new ConsultarDenuncia({
      puerta: puerta(null),
      repositorio: new RepositorioFalso(),
      cifrador,
    });
    expect(await caso.ejecutar("ok", credencial)).toBeNull();
  });

  it("guarda el mensaje sellado con el día", async () => {
    const repo = new RepositorioFalso();
    const caso = new EnviarMensajeDenunciante({ puerta: puerta("d0"), repositorio: repo, reloj });
    expect(await caso.ejecutar("ok", credencial, sello())).toBe(true);
    expect(repo.mensajes[0]).toMatchObject({ id: "d0", dia: "2026-05-02" });
  });

  it("no guarda un mensaje sin sellar ni con credencial inválida", async () => {
    const repo = new RepositorioFalso();
    const abierto = new EnviarMensajeDenunciante({
      puerta: puerta("d0"),
      repositorio: repo,
      reloj,
    });
    const cerrado = new EnviarMensajeDenunciante({
      puerta: puerta(null),
      repositorio: repo,
      reloj,
    });
    expect(await abierto.ejecutar("ok", credencial, new Uint8Array(200))).toBe(false);
    expect(await cerrado.ejecutar("ok", credencial, sello())).toBe(false);
    expect(repo.mensajes).toHaveLength(0);
  });
});
