import { describe, expect, it } from "vitest";
import type { Hallazgo, TipoHallazgo } from "@/lib/privacidad";
import { ARCHIVOS_MODELO_NER } from "@/lib/privacidad/dominio/archivos-modelo";
import {
  BUSQUEDA_INICIAL,
  busquedaActiva,
  esSugerenciaDelModelo,
  mensajeBusqueda,
  modeloActivoEnRevision,
  modeloPublicado,
  reducirBusqueda,
  requiereNuevaRevision,
  resumenHallazgos,
  type EstadoBusqueda,
  type FaseBusqueda,
} from "./busqueda-modelo";

const en = (fase: FaseBusqueda, porcentaje = 0): EstadoBusqueda => ({ fase, porcentaje });

const hallazgo = (tipo: TipoHallazgo): Hallazgo => ({
  tipo,
  nivel: "dato",
  inicio: 0,
  fin: 1,
  texto: "x",
  explicacion: "",
  sugerencia: "[x]",
});

describe("reducirBusqueda", () => {
  it("empieza apagada: nada se descarga si la persona no lo pide", () => {
    expect(BUSQUEDA_INICIAL.fase).toBe("apagada");
    expect(busquedaActiva(BUSQUEDA_INICIAL)).toBe(false);
  });

  it("activar empieza la carga en cero, también tras un fallo o una cancelación", () => {
    for (const fase of ["apagada", "fallo", "cancelada"] as const) {
      expect(reducirBusqueda(en(fase, 80), { tipo: "activar" })).toEqual(en("cargando", 0));
    }
  });

  it("el progreso nunca retrocede y se limita a un porcentaje válido", () => {
    let estado = en("cargando", 40);
    estado = reducirBusqueda(estado, { tipo: "progreso", porcentaje: 20 });
    expect(estado.porcentaje).toBe(40);
    estado = reducirBusqueda(estado, { tipo: "progreso", porcentaje: 400 });
    expect(estado.porcentaje).toBe(100);
    expect(reducirBusqueda(en("cargando", 5), { tipo: "progreso", porcentaje: NaN })).toEqual(
      en("cargando", 5),
    );
  });

  it("al terminar la carga pasa a analizar; si falla, queda en fallo", () => {
    const carga = en("cargando", 100);
    expect(reducirBusqueda(carga, { tipo: "cargaTerminada", exito: true }).fase).toBe("analizando");
    expect(reducirBusqueda(carga, { tipo: "cargaTerminada", exito: false }).fase).toBe("fallo");
  });

  it("ignora avisos tardíos de una carga que la persona ya canceló", () => {
    const cancelada = en("cancelada");
    expect(reducirBusqueda(cancelada, { tipo: "cargaTerminada", exito: false })).toBe(cancelada);
    expect(reducirBusqueda(cancelada, { tipo: "progreso", porcentaje: 50 })).toBe(cancelada);
    expect(reducirBusqueda(cancelada, { tipo: "revisionTerminada", modeloListo: false })).toBe(
      cancelada,
    );
  });

  it("solo dice que el modelo revisó el texto si de verdad estaba listo", () => {
    const analizando = en("analizando");
    expect(reducirBusqueda(analizando, { tipo: "revisionTerminada", modeloListo: true }).fase).toBe(
      "lista",
    );
    expect(
      reducirBusqueda(analizando, { tipo: "revisionTerminada", modeloListo: false }).fase,
    ).toBe("fallo");
    expect(
      reducirBusqueda(en("lista"), { tipo: "revisionTerminada", modeloListo: false }).fase,
    ).toBe("fallo");
  });

  it("cancelar se distingue de apagar una búsqueda que ya terminó", () => {
    expect(reducirBusqueda(en("cargando", 30), { tipo: "cancelar" }).fase).toBe("cancelada");
    expect(reducirBusqueda(en("analizando"), { tipo: "cancelar" }).fase).toBe("cancelada");
    expect(reducirBusqueda(en("lista"), { tipo: "cancelar" }).fase).toBe("apagada");
  });

  it("la casilla refleja si la búsqueda sigue en marcha", () => {
    const activas = (["cargando", "analizando", "lista"] as const).map((f) =>
      busquedaActiva(en(f)),
    );
    const inactivas = (["apagada", "fallo", "cancelada"] as const).map((f) =>
      busquedaActiva(en(f)),
    );
    expect(activas).toEqual([true, true, true]);
    expect(inactivas).toEqual([false, false, false]);
  });
});

describe("cuándo volver a revisar el relato", () => {
  it("al quedar listo el modelo, para sumar sus sugerencias", () => {
    expect(requiereNuevaRevision(en("cargando"), en("analizando"))).toBe(true);
  });

  it("al apagarlo con resultados, para quitar sus sugerencias", () => {
    expect(requiereNuevaRevision(en("lista"), en("apagada"))).toBe(true);
    expect(requiereNuevaRevision(en("analizando"), en("cancelada"))).toBe(true);
  });

  it("no descarta las decisiones de la persona por otros cambios", () => {
    expect(requiereNuevaRevision(en("apagada"), en("cargando"))).toBe(false);
    expect(requiereNuevaRevision(en("cargando", 1), en("cargando", 2))).toBe(false);
    expect(requiereNuevaRevision(en("cargando"), en("cancelada"))).toBe(false);
    expect(requiereNuevaRevision(en("cargando"), en("fallo"))).toBe(false);
    expect(requiereNuevaRevision(en("analizando"), en("lista"))).toBe(false);
    expect(requiereNuevaRevision(en("analizando"), en("fallo"))).toBe(false);
  });

  it("el modelo solo cuenta para la revisión cuando ya terminó de cargar", () => {
    expect(modeloActivoEnRevision(en("cargando"))).toBe(false);
    expect(modeloActivoEnRevision(en("analizando"))).toBe(true);
    expect(modeloActivoEnRevision(en("lista"))).toBe(true);
    expect(modeloActivoEnRevision(en("fallo"))).toBe(false);
  });
});

describe("mensajeBusqueda", () => {
  it("sin el modelo en el despliegue lo dice y aclara que siguen las reglas", () => {
    const mensaje = mensajeBusqueda(BUSQUEDA_INICIAL, false);
    expect(mensaje).toContain("no está disponible");
    expect(mensaje).toContain("reglas");
    expect(mensaje).toContain("nombres");
  });

  it("apagada no anuncia nada", () => {
    expect(mensajeBusqueda(BUSQUEDA_INICIAL, true)).toBe("");
  });

  it("anuncia el avance de diez en diez para no saturar el lector de pantalla", () => {
    const anuncio = (porcentaje: number) => mensajeBusqueda(en("cargando", porcentaje), true);
    expect(anuncio(31)).toBe(anuncio(39));
    expect(anuncio(39)).not.toBe(anuncio(40));
    expect(anuncio(40)).toContain("40%");
  });

  it("al terminar la descarga dice que sigue preparando, no que ya acabó", () => {
    expect(mensajeBusqueda(en("cargando", 100), true)).toContain("Preparando");
  });

  it("el fallo dice que sigue con reglas y que se puede continuar", () => {
    const mensaje = mensajeBusqueda(en("fallo"), true);
    expect(mensaje).toContain("reglas");
    expect(mensaje).toContain("continuar");
    expect(mensaje).toContain("nombres");
  });

  it("confirma la cancelación y lo que sigue funcionando", () => {
    expect(mensajeBusqueda(en("cancelada"), true)).toContain("reglas");
  });

  it("una vez lista recuerda que puede no detectarlo todo", () => {
    expect(mensajeBusqueda(en("lista"), true)).toContain("puede no detectarlo todo");
  });
});

describe("sugerencias del modelo", () => {
  it("distingue lo que viene de la búsqueda opcional de lo que viene de las reglas", () => {
    for (const tipo of ["persona", "lugar", "organizacion", "cargo"] as const) {
      expect(esSugerenciaDelModelo(hallazgo(tipo))).toBe(true);
    }
    for (const tipo of ["telefono", "curp", "fecha_exacta", "descripcion_unica"] as const) {
      expect(esSugerenciaDelModelo(hallazgo(tipo))).toBe(false);
    }
  });

  it("el resumen sin sugerencias no menciona al modelo", () => {
    expect(resumenHallazgos([hallazgo("telefono")])).toBe(
      "Encontramos 1 dato. Tú decides qué hacer con cada uno.",
    );
    expect(resumenHallazgos([hallazgo("telefono"), hallazgo("rfc")])).toContain("2 datos");
  });

  it("el resumen aclara cuántas son sugerencias que pueden equivocarse", () => {
    const uno = resumenHallazgos([hallazgo("telefono"), hallazgo("persona")]);
    expect(uno).toContain("2 datos");
    expect(uno).toContain("1 es una sugerencia");
    const dos = resumenHallazgos([hallazgo("lugar"), hallazgo("persona")]);
    expect(dos).toContain("2 son sugerencias");
  });
});

describe("modeloPublicado", () => {
  it("exige todos los archivos que el navegador va a pedir", () => {
    expect(modeloPublicado(() => true)).toBe(true);
    for (const faltante of ARCHIVOS_MODELO_NER) {
      expect(modeloPublicado((ruta) => ruta !== faltante)).toBe(false);
    }
  });

  it("incluye el modelo y el WASM", () => {
    expect(ARCHIVOS_MODELO_NER.some((r) => r.endsWith("model_quantized.onnx"))).toBe(true);
    expect(ARCHIVOS_MODELO_NER.some((r) => r.endsWith(".wasm"))).toBe(true);
  });

  it("si no se puede comprobar, lo da por no disponible en vez de fallar", () => {
    expect(
      modeloPublicado(() => {
        throw new Error("sin permisos");
      }),
    ).toBe(false);
  });
});
