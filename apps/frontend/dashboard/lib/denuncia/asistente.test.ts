import { describe, expect, it } from "vitest";
import type { Hallazgo } from "@/lib/privacidad";
import {
  estadoInicial,
  reducirAsistente,
  type AccionAsistente,
  type EstadoAsistente,
} from "./asistente";
import { MIN_RELATO } from "./validaciones";

const aplicar = (estado: EstadoAsistente, ...acciones: AccionAsistente[]) =>
  acciones.reduce(reducirAsistente, estado);

const RELATO = "x".repeat(MIN_RELATO);
const llenarHechos: AccionAsistente[] = [
  { tipo: "campoHecho", campo: "estado", valor: "17" },
  { tipo: "campoHecho", campo: "tipoFalta", valor: "otra" },
  { tipo: "campoHecho", campo: "cuando", valor: "no_recuerdo" },
  { tipo: "campoHecho", campo: "relato", valor: RELATO },
];
const FRASE = "ancla barco cielo dedo pera mesa";

const hallazgo: Hallazgo = {
  tipo: "telefono",
  nivel: "dato",
  inicio: 0,
  fin: 3,
  texto: "xxx",
  explicacion: "",
  sugerencia: "[t]",
};

describe("búsqueda opcional con el modelo", () => {
  const evento = (
    e: Extract<AccionAsistente, { tipo: "busquedaModelo" }>["evento"],
  ): AccionAsistente => ({ tipo: "busquedaModelo", evento: e });
  const revisado = aplicar(estadoInicial(), {
    tipo: "hallazgosDetectados",
    hallazgos: [hallazgo],
  });

  it("empieza apagada", () => {
    expect(estadoInicial().busquedaModelo.fase).toBe("apagada");
  });

  it("descargar no toca los hallazgos ni el avance de la denuncia", () => {
    const e = aplicar(revisado, evento({ tipo: "activar" }));
    expect(e.busquedaModelo.fase).toBe("cargando");
    expect(e.hallazgos).toEqual([hallazgo]);
    expect(reducirAsistente({ ...e, paso: "evidencias" }, { tipo: "avanzar" }).paso).toBe(
      "revision",
    );
  });

  it("cancelar la descarga conserva lo ya revisado", () => {
    const e = aplicar(revisado, evento({ tipo: "activar" }), evento({ tipo: "cancelar" }));
    expect(e.busquedaModelo.fase).toBe("cancelada");
    expect(e.hallazgos).toEqual([hallazgo]);
  });

  it("con el modelo listo vuelve a revisar el relato para sumar sugerencias", () => {
    const e = aplicar(
      revisado,
      evento({ tipo: "activar" }),
      evento({ tipo: "cargaTerminada", exito: true }),
    );
    expect(e.busquedaModelo.fase).toBe("analizando");
    expect(e.hallazgos).toBeNull();
  });

  it("recuerda lo que la persona decidió dejar al sumar las sugerencias", () => {
    const e = aplicar(
      revisado,
      { tipo: "ignorarHallazgo", hallazgo },
      evento({ tipo: "activar" }),
      evento({ tipo: "cargaTerminada", exito: true }),
      { tipo: "hallazgosDetectados", hallazgos: [hallazgo] },
    );
    expect(e.hallazgos).toEqual([]);
  });

  it("apagarla con resultados quita las sugerencias del modelo al revisar otra vez", () => {
    const e = aplicar(
      revisado,
      evento({ tipo: "activar" }),
      evento({ tipo: "cargaTerminada", exito: true }),
      { tipo: "hallazgosDetectados", hallazgos: [hallazgo] },
      evento({ tipo: "revisionTerminada", modeloListo: true }),
      evento({ tipo: "cancelar" }),
    );
    expect(e.busquedaModelo.fase).toBe("apagada");
    expect(e.hallazgos).toBeNull();
  });

  it("un fallo conserva lo encontrado por las reglas", () => {
    const e = aplicar(
      revisado,
      evento({ tipo: "activar" }),
      evento({ tipo: "cargaTerminada", exito: false }),
    );
    expect(e.busquedaModelo.fase).toBe("fallo");
    expect(e.hallazgos).toEqual([hallazgo]);
  });

  it("no se guarda en el borrador ni sobrevive al envío", () => {
    const e = aplicar(revisado, evento({ tipo: "activar" }), {
      tipo: "denunciaEnviada",
      folio: "BZ-1",
    });
    expect(e.busquedaModelo.fase).toBe("apagada");
  });
});

describe("asistente de denuncia", () => {
  it("empieza en hechos, con el borrador apagado y sin frase", () => {
    const e = estadoInicial();
    expect(e.paso).toBe("hechos");
    expect(e.guardarBorrador).toBe(false);
    expect(e.frase).toBeNull();
  });

  it("no avanza con errores y los expone por campo", () => {
    const e = aplicar(estadoInicial(), { tipo: "avanzar" });
    expect(e.paso).toBe("hechos");
    expect(Object.keys(e.errores)).toContain("relato");
  });

  it("avanza cuando los hechos están completos y limpia los errores", () => {
    const e = aplicar(estadoInicial(), { tipo: "avanzar" }, ...llenarHechos, { tipo: "avanzar" });
    expect(e.paso).toBe("personas");
    expect(e.errores).toEqual({});
  });

  it("al cambiar de estado se borra el municipio, que depende de él", () => {
    const e = aplicar(
      estadoInicial(),
      { tipo: "campoHecho", campo: "estado", valor: "17" },
      { tipo: "campoHecho", campo: "municipio", valor: "17007" },
      { tipo: "campoHecho", campo: "estado", valor: "09" },
    );
    expect(e.hechos.municipio).toBe("");
  });

  it("corregir un campo quita solo su error", () => {
    const e = aplicar(
      estadoInicial(),
      { tipo: "avanzar" },
      { tipo: "campoHecho", campo: "estado", valor: "17" },
    );
    expect(e.errores.estado).toBeUndefined();
    expect(e.errores.relato).toBeDefined();
  });

  it("retroceder conserva lo escrito y no se sale del primer paso", () => {
    const e = aplicar(
      estadoInicial(),
      ...llenarHechos,
      { tipo: "avanzar" },
      { tipo: "retroceder" },
    );
    expect(e.paso).toBe("hechos");
    expect(e.hechos.relato).toBe(RELATO);
    expect(aplicar(e, { tipo: "retroceder" }).paso).toBe("hechos");
  });

  it("agrega, edita y quita personas", () => {
    const e = aplicar(
      estadoInicial(),
      { tipo: "agregarPersona" },
      { tipo: "editarPersona", indice: 0, campo: "nombre", valor: "Ana" },
      { tipo: "agregarPersona" },
      { tipo: "quitarPersona", indice: 1 },
    );
    expect(e.personas).toEqual([{ nombre: "Ana", cargo: "" }]);
  });

  it("registra y quita evidencias", () => {
    const evidencia = {
      evidenciaId: "id",
      nombre: "a.png",
      tamano: 1,
      eliminadosEnDispositivo: [],
      eliminadosEnServidor: [],
    };
    const e = aplicar(estadoInicial(), { tipo: "evidenciaAgregada", evidencia });
    expect(e.evidencias).toHaveLength(1);
    expect(aplicar(e, { tipo: "evidenciaQuitada", evidenciaId: "id" }).evidencias).toEqual([]);
  });

  describe("revisión", () => {
    const enRevision = () =>
      aplicar(
        estadoInicial(),
        ...llenarHechos,
        { tipo: "avanzar" },
        { tipo: "avanzar" },
        { tipo: "avanzar" },
      );

    it("reemplazar cambia el relato y quita el hallazgo", () => {
      const e = aplicar(
        enRevision(),
        { tipo: "hallazgosDetectados", hallazgos: [hallazgo] },
        { tipo: "aplicarSugerencia", hallazgo },
      );
      expect(e.hechos.relato.startsWith("[t]")).toBe(true);
      expect(e.hallazgos).toEqual([]);
    });

    it("ignorar deja el relato igual y se recuerda al volver a escanear", () => {
      const e = aplicar(
        enRevision(),
        { tipo: "hallazgosDetectados", hallazgos: [hallazgo] },
        { tipo: "ignorarHallazgo", hallazgo },
        { tipo: "hallazgosDetectados", hallazgos: [hallazgo] },
      );
      expect(e.hechos.relato).toBe(RELATO);
      expect(e.hallazgos).toEqual([]);
    });

    it("los hallazgos no bloquean: la decisión es de la persona", () => {
      const e = aplicar(
        enRevision(),
        { tipo: "hallazgosDetectados", hallazgos: [hallazgo] },
        { tipo: "avanzar" },
      );
      expect(e.paso).toBe("frase");
    });

    it("editar el relato invalida los hallazgos ya calculados", () => {
      const e = aplicar(
        enRevision(),
        { tipo: "hallazgosDetectados", hallazgos: [hallazgo] },
        { tipo: "campoHecho", campo: "relato", valor: RELATO + "y" },
      );
      expect(e.hallazgos).toBeNull();
    });
  });

  describe("frase", () => {
    const enFrase = () =>
      aplicar(
        estadoInicial(),
        ...llenarHechos,
        { tipo: "avanzar" },
        { tipo: "avanzar" },
        { tipo: "avanzar" },
        { tipo: "avanzar" },
        { tipo: "fraseGenerada", frase: FRASE, posiciones: [1, 4] },
      );

    it("no avanza sin confirmar", () => {
      const e = aplicar(enFrase(), { tipo: "avanzar" });
      expect(e.paso).toBe("frase");
      expect(e.errores.confirmacion).toBeDefined();
    });

    it("rechaza una confirmación equivocada", () => {
      const e = aplicar(enFrase(), { tipo: "confirmarFrase", respuestas: ["mal", "pera"] });
      expect(e.fraseConfirmada).toBe(false);
      expect(e.errores.confirmacion).toBeDefined();
    });

    it("si la confirmación falla y se intenta avanzar, conserva el mensaje específico", () => {
      const e = aplicar(
        enFrase(),
        { tipo: "confirmarFrase", respuestas: ["mal", "pera"] },
        { tipo: "avanzar" },
      );
      expect(e.paso).toBe("frase");
      expect(e.errores.confirmacion).toMatch(/no coinciden/);
    });

    it("avanza al envío solo con las dos palabras correctas", () => {
      const e = aplicar(
        enFrase(),
        { tipo: "confirmarFrase", respuestas: ["barco", "pera"] },
        { tipo: "avanzar" },
      );
      expect(e.fraseConfirmada).toBe(true);
      expect(e.paso).toBe("envio");
    });

    it("la frase no cambia si se vuelve al paso", () => {
      const e = aplicar(enFrase(), { tipo: "fraseGenerada", frase: "otra", posiciones: [0, 1] });
      expect(e.frase).toBe(FRASE);
    });
  });

  describe("al enviar", () => {
    it("guarda el folio y olvida la frase y el relato de la memoria", () => {
      const e = aplicar(
        estadoInicial(),
        ...llenarHechos,
        { tipo: "fraseGenerada", frase: FRASE, posiciones: [1, 4] },
        { tipo: "denunciaEnviada", folio: "BZ-0" },
      );
      expect(e.folio).toBe("BZ-0");
      expect(e.frase).toBeNull();
      expect(e.hechos.relato).toBe("");
      expect(e.guardarBorrador).toBe(false);
    });
  });

  it("restaurar un borrador recupera hechos y personas y deja el guardado encendido", () => {
    const e = aplicar(estadoInicial(), {
      tipo: "restaurarBorrador",
      borrador: {
        hechos: {
          estado: "17",
          municipio: "",
          tipoFalta: "",
          enteId: "",
          cuando: "",
          relato: "abc",
        },
        personas: [],
      },
    });
    expect(e.hechos.relato).toBe("abc");
    expect(e.guardarBorrador).toBe(true);
  });
});
