import { expect, test } from "@playwright/test";
import { compose, composeIntento } from "./apoyo";

/**
 * Datos de demostración en el despliegue real: `docker compose run --rm sintetico` llena la base con
 * denuncias SINTÉTICAS y publica los trimestres cerrados. Aquí se comprueba, sobre lo que de verdad
 * sirve la API pública, que las estadísticas no muestran números pequeños (D6) y que los indicadores
 * por ente no describen celdas ocultas.
 */
const API = "/api/v1/publico";

interface Fila {
  dimensiones: string;
  claves: Record<string, string>;
  conteo: number | null;
  motivo: string;
  k: number;
}

interface IndicadorEnte {
  ente: string;
  motivo: string;
  denuncias: number | null;
  porcentajeConRespuesta: number | null;
  porcentajeTurnado: number | null;
  porcentajeArchivado: number | null;
  porcentajeSinCompetencia: number | null;
  tiempoPromedioDias: Record<string, number | null>;
  senal: string;
}

test.describe.serial("Tablero con datos de demostración", () => {
  let periodo: string;
  let k: number;

  test.beforeAll(() => {
    test.setTimeout(600_000);
    compose(["run", "--rm", "sintetico"], { salidaVisible: true });
  });

  test("el servicio de demostración publica trimestres y los marca como sintéticos", async ({
    request,
  }, info) => {
    const respuesta = await request.get(`${API}/periodos`);
    expect(respuesta.ok()).toBe(true);
    const cuerpo = (await respuesta.json()) as {
      periodos: { periodo: string; k: number }[];
      datosSinteticos: boolean;
    };
    expect(cuerpo.datosSinteticos).toBe(true);
    expect(cuerpo.periodos.length).toBeGreaterThan(0);
    const primero = cuerpo.periodos[0];
    if (!primero) throw new Error("sin periodos");
    periodo = primero.periodo;
    k = primero.k;
    info.annotations.push({
      type: "evidencia",
      description: `${cuerpo.periodos.length} trimestres publicados; el más reciente, ${periodo}, con k = ${k}`,
    });
  });

  test("el tablero muestra el trimestre y avisa que las denuncias son sintéticas", async ({
    page,
  }) => {
    await page.goto("/tablero");
    await expect(page.getByRole("heading", { level: 1, name: "Tablero público" })).toBeVisible();
    await expect(page.getByText(`denuncias sintéticas en ${periodo}`)).toBeVisible();
    await expect(page.getByText("Todavía no hay un trimestre publicado")).toHaveCount(0);
  });

  test("ninguna celda publicada vale entre 1 y k − 1, en ninguna tabla ni descarga", async ({
    request,
  }, info) => {
    const descarga = await request.get(`${API}/descargas/agregados.json?periodo=${periodo}`);
    expect(descarga.ok()).toBe(true);
    const { filas } = (await descarga.json()) as { filas: Fila[] };
    expect(filas.length).toBeGreaterThan(100);
    const pequenas = filas.filter((f) => f.conteo !== null && f.conteo > 0 && f.conteo < f.k);
    expect(pequenas).toEqual([]);
    const ocultas = filas.filter((f) => f.conteo === null);
    for (const fila of ocultas) {
      expect(["menor_a_k", "supresion_complementaria"]).toContain(fila.motivo);
    }
    info.annotations.push({
      type: "evidencia",
      description: `${filas.length} celdas en ${new Set(filas.map((f) => f.dimensiones)).size} tablas; ${ocultas.length} ocultas y ninguna publicada entre 1 y ${k - 1}`,
    });
  });

  test("los indicadores de un ente con alguna etapa oculta no traen porcentajes, tiempos ni señal", async ({
    request,
  }, info) => {
    const [indicadores, cruce] = await Promise.all([
      request.get(`${API}/indicadores?periodo=${periodo}`),
      request.get(`${API}/agregados?periodo=${periodo}&dimensiones=ente,etapa`),
    ]);
    expect(indicadores.ok()).toBe(true);
    expect(cruce.ok()).toBe(true);
    const { entes } = (await indicadores.json()) as { entes: IndicadorEnte[] };
    const { celdas } = (await cruce.json()) as { celdas: Fila[] };
    const conEtapaOculta = new Set(
      celdas.filter((c) => c.conteo === null).map((c) => c.claves.ente ?? ""),
    );
    for (const ente of entes) {
      if (conEtapaOculta.has(ente.ente)) {
        expect(ente.motivo, ente.ente).not.toBe("publicado");
        expect(ente.porcentajeConRespuesta, ente.ente).toBeNull();
        expect(ente.porcentajeTurnado, ente.ente).toBeNull();
        expect(ente.porcentajeArchivado, ente.ente).toBeNull();
        expect(ente.porcentajeSinCompetencia, ente.ente).toBeNull();
        expect(ente.tiempoPromedioDias, ente.ente).toEqual({});
        expect(ente.senal, ente.ente).toBe("datos_insuficientes");
      }
    }
    info.annotations.push({
      type: "evidencia",
      description: `${entes.length} entes; ${conEtapaOculta.size} con alguna etapa oculta y sin derivados`,
    });
  });

  test("el generador se niega sin la bandera de demostración, aunque corra en la misma imagen", () => {
    test.setTimeout(180_000);
    const { estado, salida } = composeIntento([
      "run",
      "--rm",
      "--no-deps",
      "-e",
      "DATOS_SINTETICOS_DEMO=0",
      "sintetico",
      "node",
      "dist/scripts/sintetico.js",
    ]);
    expect(estado).not.toBe(0);
    expect(salida).toContain("no corre en producción");
  });
});
