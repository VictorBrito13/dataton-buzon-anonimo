import { afterEach, describe, expect, it, vi } from "vitest";
import { crearClienteNer } from "./ner-cliente";
import type { MensajeAlWorker, MensajeDelWorker, WorkerNer } from "./protocolo-ner";

class WorkerFalso implements WorkerNer {
  enviados: MensajeAlWorker[] = [];
  terminado = false;
  onmessage: ((evento: { data: MensajeDelWorker }) => void) | null = null;
  onerror: ((evento: unknown) => void) | null = null;
  postMessage(mensaje: MensajeAlWorker) {
    this.enviados.push(mensaje);
  }
  terminate() {
    this.terminado = true;
  }
  emitir(data: MensajeDelWorker) {
    this.onmessage?.({ data });
  }
}

const preparar = () => {
  const workers: WorkerFalso[] = [];
  const cliente = crearClienteNer(() => {
    const worker = new WorkerFalso();
    workers.push(worker);
    return worker;
  });
  return { cliente, workers };
};

const preparaListo = async () => {
  const { cliente, workers } = preparar();
  const carga = cliente.cargar();
  workers[0].emitir({ tipo: "listo" });
  await carga;
  return { cliente, worker: workers[0] };
};

afterEach(() => {
  vi.useRealTimers();
});

describe("cargar", () => {
  it("no crea el Worker hasta que se pide", () => {
    const { workers, cliente } = preparar();
    expect(workers).toHaveLength(0);
    expect(cliente.estado()).toBe("inactivo");
  });

  it("informa el progreso y termina en listo", async () => {
    const { cliente, workers } = preparar();
    const progreso: unknown[] = [];
    const carga = cliente.cargar((p) => progreso.push(p));
    expect(cliente.estado()).toBe("cargando");
    expect(workers[0].enviados).toEqual([{ tipo: "cargar" }]);
    workers[0].emitir({ tipo: "progreso", porcentaje: 40 });
    workers[0].emitir({ tipo: "listo" });
    await expect(carga).resolves.toBe(true);
    expect(cliente.estado()).toBe("listo");
    expect(progreso).toContainEqual({ estado: "cargando", porcentaje: 40 });
    expect(progreso).toContainEqual({ estado: "listo", porcentaje: 100 });
  });

  it("dos llamadas comparten la misma carga", async () => {
    const { cliente, workers } = preparar();
    const a = cliente.cargar();
    const b = cliente.cargar();
    expect(workers).toHaveLength(1);
    workers[0].emitir({ tipo: "listo" });
    await expect(Promise.all([a, b])).resolves.toEqual([true, true]);
    await expect(cliente.cargar()).resolves.toBe(true);
    expect(workers).toHaveLength(1);
  });

  it("si el Worker avisa de un error, resuelve en false y libera el Worker", async () => {
    const { cliente, workers } = preparar();
    const carga = cliente.cargar();
    workers[0].emitir({ tipo: "error" });
    await expect(carga).resolves.toBe(false);
    expect(cliente.estado()).toBe("error");
    expect(workers[0].terminado).toBe(true);
  });

  it("si el Worker falla, resuelve en false", async () => {
    const { cliente, workers } = preparar();
    const carga = cliente.cargar();
    workers[0].onerror?.(new Error("no carga"));
    await expect(carga).resolves.toBe(false);
  });

  it("si no se puede crear el Worker, resuelve en false sin lanzar", async () => {
    const cliente = crearClienteNer(() => {
      throw new Error("sin Worker");
    });
    await expect(cliente.cargar()).resolves.toBe(false);
    expect(cliente.estado()).toBe("error");
  });

  it("se puede reintentar tras un error", async () => {
    const { cliente, workers } = preparar();
    const primera = cliente.cargar();
    workers[0].emitir({ tipo: "error" });
    await primera;
    const segunda = cliente.cargar();
    workers[1].emitir({ tipo: "listo" });
    await expect(segunda).resolves.toBe(true);
  });

  it("abandona si el Worker deja de responder", async () => {
    vi.useFakeTimers();
    const { cliente, workers } = preparar();
    const carga = cliente.cargar();
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    await expect(carga).resolves.toBe(false);
    expect(workers[0].terminado).toBe(true);
  });
});

describe("analizar", () => {
  it("sin modelo devuelve vacío y no crea el Worker", async () => {
    const { cliente, workers } = preparar();
    await expect(cliente.analizar("Juan Pérez")).resolves.toEqual([]);
    expect(workers).toHaveLength(0);
  });

  it("convierte los tokens en hallazgos y añade cargos", async () => {
    const { cliente, worker } = await preparaListo();
    const analisis = cliente.analizar("Vi a Juan y a el director general");
    const peticion = worker.enviados.at(-1) as Extract<MensajeAlWorker, { tipo: "analizar" }>;
    expect(peticion.fragmentos).toEqual(["Vi a Juan y a el director general"]);
    worker.emitir({
      tipo: "tokens",
      id: peticion.id,
      resultados: [[{ word: "Juan", entity: "B-PER", score: 0.9 }]],
    });
    const hallazgos = await analisis;
    expect(hallazgos.map((h) => [h.tipo, h.texto])).toEqual(
      expect.arrayContaining([
        ["persona", "Juan"],
        ["cargo", "el director general"],
      ]),
    );
  });

  it("ajusta las posiciones de cada fragmento", async () => {
    const { cliente, worker } = await preparaListo();
    const texto = `${"Una oración de relleno. ".repeat(60)}Juan`;
    const analisis = cliente.analizar(texto);
    const peticion = worker.enviados.at(-1) as Extract<MensajeAlWorker, { tipo: "analizar" }>;
    expect(peticion.fragmentos.length).toBeGreaterThan(1);
    worker.emitir({
      tipo: "tokens",
      id: peticion.id,
      // Como el modelo real, devuelve todos los tokens, no solo las entidades.
      resultados: peticion.fragmentos.map((f) =>
        f
          .split(/\s+/)
          .filter(Boolean)
          .map((word) => ({ word, entity: word === "Juan" ? "B-PER" : "O", score: 0.9 })),
      ),
    });
    const [persona] = (await analisis).filter((h) => h.tipo === "persona");
    expect(texto.slice(persona.inicio, persona.fin)).toBe("Juan");
  });

  it("si el modelo no responde a tiempo, devuelve vacío y queda en error", async () => {
    vi.useFakeTimers();
    const { cliente, worker } = await preparaListo();
    const analisis = cliente.analizar("texto");
    await vi.advanceTimersByTimeAsync(60_000);
    await expect(analisis).resolves.toEqual([]);
    expect(cliente.estado()).toBe("error");
    expect(worker.terminado).toBe(true);
  });

  it("si el Worker falla durante el análisis, devuelve vacío", async () => {
    const { cliente, worker } = await preparaListo();
    const analisis = cliente.analizar("texto");
    worker.onerror?.(new Error("falló"));
    await expect(analisis).resolves.toEqual([]);
  });

  it("no manda texto vacío al modelo", async () => {
    const { cliente, worker } = await preparaListo();
    const enviadosAntes = worker.enviados.length;
    await expect(cliente.analizar("")).resolves.toEqual([]);
    expect(worker.enviados).toHaveLength(enviadosAntes);
  });
});

describe("cancelar", () => {
  it("detiene la carga, termina el Worker y resuelve en false", async () => {
    const { cliente, workers } = preparar();
    const carga = cliente.cargar();
    cliente.cancelar();
    await expect(carga).resolves.toBe(false);
    expect(workers[0].terminado).toBe(true);
    expect(cliente.estado()).toBe("inactivo");
  });

  it("no avisa a nadie más después de cancelar", () => {
    const { cliente, workers } = preparar();
    const progreso: unknown[] = [];
    const worker = (void cliente.cargar((p) => progreso.push(p)), workers[0]);
    const alMensaje = worker.onmessage;
    cliente.cancelar();
    progreso.length = 0;
    alMensaje?.({ data: { tipo: "progreso", porcentaje: 50 } });
    expect(progreso).toEqual([]);
    expect(cliente.estado()).toBe("inactivo");
  });

  it("no deja temporizadores que luego marquen un error", async () => {
    vi.useFakeTimers();
    const { cliente } = preparar();
    void cliente.cargar();
    cliente.cancelar();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(cliente.estado()).toBe("inactivo");
  });

  it("permite volver a cargar con un Worker nuevo", async () => {
    const { cliente, workers } = preparar();
    void cliente.cargar();
    cliente.cancelar();
    const otra = cliente.cargar();
    expect(workers).toHaveLength(2);
    workers[1].emitir({ tipo: "listo" });
    await expect(otra).resolves.toBe(true);
    expect(cliente.estado()).toBe("listo");
  });

  it("libera un modelo ya cargado: el análisis deja de usarlo", async () => {
    const { cliente, worker } = await preparaListo();
    cliente.cancelar();
    expect(worker.terminado).toBe(true);
    expect(cliente.estado()).toBe("inactivo");
    await expect(cliente.analizar("Juan Pérez")).resolves.toEqual([]);
  });

  it("resuelve sin hallazgos un análisis en curso", async () => {
    const { cliente } = await preparaListo();
    const analisis = cliente.analizar("Juan Pérez");
    cliente.cancelar();
    await expect(analisis).resolves.toEqual([]);
  });

  it("sin nada en marcha no crea nada, y limpia un error anterior", async () => {
    const { cliente, workers } = preparar();
    cliente.cancelar();
    expect(workers).toHaveLength(0);
    expect(cliente.estado()).toBe("inactivo");

    const carga = cliente.cargar();
    workers[0].emitir({ tipo: "error" });
    await carga;
    expect(cliente.estado()).toBe("error");
    cliente.cancelar();
    expect(cliente.estado()).toBe("inactivo");
  });
});
