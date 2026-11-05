import { describe, expect, it } from "vitest";
import { acotarPorIntervalos } from "./ataque-intervalos.js";
import { crearAzar } from "./azar.js";
import { anchoMinimo } from "./k-anonimato.js";
import {
  CLAVE_SIN_ENTE,
  claveMunicipioSinEspecificar,
  construirPublicacion,
  construirRed,
  normalizarDimensiones,
  TABLAS_PUBLICADAS,
  type DenunciaAgregable,
  type Universo,
} from "./publicacion.js";

const universo: Universo = {
  municipios: [
    { clave: "17007", estado: "17" },
    { clave: "17006", estado: "17" },
    { clave: "14039", estado: "14" },
  ],
  entes: ["ente-a", "ente-b"],
};

const denuncia = (parcial: Partial<DenunciaAgregable> = {}): DenunciaAgregable => ({
  estado: "17",
  municipio: "17007",
  tipoFalta: "cohecho",
  etapa: "recibida",
  ente: "ente-a",
  n: 1,
  ...parcial,
});

const k = 5;
const buscar = (
  publicacion: ReturnType<typeof construirPublicacion>,
  dimensiones: string,
  claves: Record<string, string>,
) =>
  publicacion.find(
    (f) => f.dimensiones === dimensiones && JSON.stringify(f.claves) === JSON.stringify(claves),
  );

describe("dimensiones", () => {
  it("normaliza el orden: estado,tipoFalta y tipoFalta,estado son la misma tabla", () => {
    expect(normalizarDimensiones(["tipoFalta", "estado"])).toBe("estado,tipoFalta");
  });

  it("nunca acepta más de dos dimensiones", () => {
    expect(() => normalizarDimensiones(["estado", "tipoFalta", "etapa"])).toThrow(/dos/);
  });

  it("rechaza dimensiones repetidas", () => {
    expect(() => normalizarDimensiones(["estado", "estado"])).toThrow();
  });

  it("ninguna tabla publicada tiene más de dos dimensiones", () => {
    for (const tabla of TABLAS_PUBLICADAS) {
      expect(tabla.split(",").length).toBeLessThanOrEqual(2);
    }
  });
});

describe("construirPublicacion", () => {
  it("publica cada tabla del plan", () => {
    const filas = construirPublicacion([denuncia({ n: 50 })], universo, { k });
    const tablas = new Set(filas.map((f) => f.dimensiones));
    for (const tabla of [...TABLAS_PUBLICADAS, "total"]) expect(tablas).toContain(tabla);
  });

  it("agrupa los casos sin municipio bajo su estado para que el total siga cuadrando", () => {
    const filas = construirPublicacion(
      [denuncia({ municipio: null, n: 20 }), denuncia({ n: 30 })],
      universo,
      { k },
    );
    expect(
      buscar(filas, "municipio", { municipio: claveMunicipioSinEspecificar("17") })?.conteo,
    ).toBe(20);
  });

  it("agrupa los casos sin ente en una clave propia", () => {
    const filas = construirPublicacion(
      [denuncia({ ente: null, n: 20 }), denuncia({ n: 30 })],
      universo,
      { k },
    );
    expect(buscar(filas, "ente", { ente: CLAVE_SIN_ENTE })?.conteo).toBe(20);
  });

  it("publica ceros para los municipios del catálogo sin denuncias", () => {
    const filas = construirPublicacion([denuncia({ n: 50 })], universo, { k });
    expect(buscar(filas, "municipio", { municipio: "14039" })).toMatchObject({
      conteo: 0,
      motivo: "publicada",
    });
  });

  it("nunca incluye datos sobre la persona denunciada: solo dimensiones del catálogo", () => {
    const filas = construirPublicacion([denuncia({ n: 50 })], universo, { k });
    const permitidas = new Set(["estado", "municipio", "tipoFalta", "etapa", "ente"]);
    for (const fila of filas) {
      for (const clave of Object.keys(fila.claves)) expect(permitidas).toContain(clave);
    }
  });

  it("el total nacional se oculta cuando hay menos de k denuncias en el país", () => {
    const filas = construirPublicacion([denuncia({ n: 3 })], universo, { k });
    expect(buscar(filas, "total", {})?.conteo).toBeNull();
  });

  it("rechaza un municipio que no pertenece a su estado", () => {
    expect(() =>
      construirPublicacion([denuncia({ estado: "14", municipio: "17007" })], universo, { k }),
    ).toThrow(/17007/);
  });
});

describe("la protección no destruye más de lo necesario", () => {
  it("un ente muy pequeño no arrastra el total nacional ni a los demás entes", () => {
    const etapas = ["recibida", "turnada_investigadora", "archivada", "resuelta"];
    const tipos = ["cohecho", "peculado", "otra"];
    const filas: DenunciaAgregable[] = [];
    const grandes = ["ente-a", "ente-b", "ente-c", "ente-d", "ente-e", "ente-f"];
    grandes.forEach((ente, i) => {
      for (const etapa of etapas) {
        for (const tipoFalta of tipos) {
          filas.push(denuncia({ ente, etapa, tipoFalta, n: 40 + i * 10 }));
        }
      }
    });
    // Tres denuncias del ente pequeño, cada una en una etapa distinta.
    filas.push(denuncia({ ente: "ente-z", etapa: "recibida", n: 1 }));
    filas.push(denuncia({ ente: "ente-z", etapa: "archivada", n: 1 }));
    filas.push(denuncia({ ente: "ente-z", etapa: "resuelta", n: 1 }));

    const publicacion = construirPublicacion(
      filas,
      { ...universo, entes: [...grandes, "ente-z"] },
      { k },
    );
    expect(buscar(publicacion, "total", {})?.conteo).not.toBeNull();
    expect(buscar(publicacion, "ente", { ente: "ente-z" })?.conteo).toBeNull();
    const visibles = grandes.filter(
      (ente) => buscar(publicacion, "ente", { ente })?.conteo !== null,
    );
    expect(visibles.length).toBeGreaterThanOrEqual(4);
  });
});

describe("HU-31 · Ataques entre tablas de una misma publicación", () => {
  const entes = ["ente-a", "ente-b", "ente-c"];
  const municipios = [
    { clave: "17007", estado: "17" },
    { clave: "17006", estado: "17" },
    { clave: "17011", estado: "17" },
    { clave: "14039", estado: "14" },
    { clave: "14120", estado: "14" },
    { clave: "06002", estado: "06" },
  ];
  const generar = (semilla: number): DenunciaAgregable[] => {
    const azar = crearAzar(semilla);
    return Array.from({ length: azar.entero(5, 80) }, () => {
      const m = municipios[azar.entero(0, municipios.length - 1)] ?? { clave: "", estado: "" };
      return denuncia({
        estado: m.estado,
        municipio: m.clave,
        tipoFalta: ["cohecho", "peculado", "otra"][azar.entero(0, 2)] ?? "otra",
        etapa: ["recibida", "archivada", "resuelta", "en_investigacion"][azar.entero(0, 3)] ?? "",
        ente: entes[azar.entero(0, 2)] ?? null,
        n: azar.entero(1, 4),
      });
    });
  };

  it("100 publicaciones al azar: restar entre tablas nunca acota por debajo del ancho mínimo", () => {
    for (let semilla = 1; semilla <= 100; semilla += 1) {
      const filas = generar(semilla);
      const red = construirRed(filas, { municipios, entes });
      const publicacion = construirPublicacion(filas, { municipios, entes }, { k });
      const vista = new Map(publicacion.map((f) => [f.id, { conteo: f.conteo, motivo: f.motivo }]));
      const cotas = acotarPorIntervalos(vista, red.lineas, k);
      for (const fila of publicacion) {
        const real = red.conteos.get(fila.id) ?? 0;
        const cota = cotas.get(fila.id);
        if (!cota) throw new Error(`Sin cota: ${fila.id}`);
        expect(cota.min).toBeLessThanOrEqual(real);
        expect(cota.max).toBeGreaterThanOrEqual(real);
        if (fila.conteo === null) {
          expect(cota.max - cota.min).toBeGreaterThanOrEqual(anchoMinimo(k));
        }
      }
    }
  });

  it("la misma celda vale lo mismo en todas las tablas: un total oculto no reaparece en otra", () => {
    const filas = generar(7);
    const publicacion = construirPublicacion(filas, { municipios, entes }, { k });
    const ids = publicacion.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
