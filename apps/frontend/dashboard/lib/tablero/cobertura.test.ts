import type { FilaCobertura } from "@dataton/shared";
import { describe, expect, it } from "vitest";
import {
  brechaDe,
  enlaceCobertura,
  etiquetaMapa,
  filasDeEstados,
  etiquetaPorcentaje,
  lecturaDeSistema,
  leerSistemaCobertura,
  nivelCobertura,
  ordenarPorCobertura,
  textoLectura,
  SISTEMA_INICIAL,
  UMBRAL_DENOMINADOR_BAJO,
} from "./cobertura";

const conexion = (aplicables: number, conectados: number) => ({
  aplicables,
  conectados,
  porcentaje: aplicables === 0 ? null : Math.round((conectados / aplicables) * 1000) / 10,
});

const fila = (
  entidad: string,
  nombre: string,
  s3: [number, number],
  parcial: Partial<FilaCobertura> = {},
): FilaCobertura => ({
  entidad,
  ambito: null,
  nombre,
  registros: 100,
  sujetosObligados: 50,
  organosControl: 50,
  tribunales: 0,
  s1: conexion(50, 25),
  s2: conexion(50, 25),
  s3: conexion(s3[0], s3[1]),
  s6: conexion(50, 0),
  sinConexion: 10,
  porcentajeSinConexion: 10,
  ...parcial,
});

describe("leerSistemaCobertura", () => {
  it("acepta los cuatro sistemas", () => {
    for (const sistema of ["s1", "s2", "s3", "s6"]) {
      expect(leerSistemaCobertura(sistema)).toBe(sistema);
    }
  });

  it("vuelve al inicial ante cualquier otro valor", () => {
    expect(leerSistemaCobertura("s4")).toBe(SISTEMA_INICIAL);
    expect(leerSistemaCobertura(undefined)).toBe(SISTEMA_INICIAL);
    expect(leerSistemaCobertura("<script>")).toBe(SISTEMA_INICIAL);
  });
});

describe("nivelCobertura", () => {
  it("el cero y lo que no aplica tienen clase propia, no un tono de la escala", () => {
    expect(nivelCobertura(0)).toBe("cobertura-cero");
    expect(nivelCobertura(null)).toBe("cobertura-sin-dato");
  });

  it("usa tramos fijos de 20 puntos: son comparables entre sistemas", () => {
    expect(nivelCobertura(0.1)).toBe("nivel-1");
    expect(nivelCobertura(19.9)).toBe("nivel-1");
    expect(nivelCobertura(20)).toBe("nivel-2");
    expect(nivelCobertura(40)).toBe("nivel-3");
    expect(nivelCobertura(60)).toBe("nivel-4");
    expect(nivelCobertura(80)).toBe("nivel-5");
    expect(nivelCobertura(100)).toBe("nivel-5");
  });
});

describe("etiquetaMapa", () => {
  it("redondea para que quepa en la casilla", () => {
    expect(etiquetaMapa(conexion(100, 44))).toBe("44%");
    expect(etiquetaMapa(conexion(100, 100))).toBe("100%");
    expect(etiquetaMapa(conexion(100, 0))).toBe("0%");
  });

  it("no redondea a 0 % ni a 100 % lo que no lo es", () => {
    expect(etiquetaMapa(conexion(1000, 2))).toBe("<1%");
    expect(etiquetaMapa(conexion(1000, 998))).toBe(">99%");
  });

  it("marca con asterisco un denominador bajo", () => {
    expect(etiquetaMapa(conexion(1, 0))).toBe("0%*");
    expect(etiquetaMapa(conexion(UMBRAL_DENOMINADOR_BAJO, 5))).toBe("50%");
  });

  it("dice n/d cuando no hay registros a los que se les pida el sistema", () => {
    expect(etiquetaMapa(conexion(0, 0))).toBe("n/d");
  });
});

describe("brechaDe y filasDeEstados", () => {
  it("la brecha es cuántos registros faltan por conectar", () => {
    expect(brechaDe(conexion(120, 20))).toBe(100);
  });

  it("deja fuera a la Federación, que no es una casilla del mapa", () => {
    const filas = filasDeEstados([
      fila("00", "Federación", [10, 0]),
      fila("17", "Morelos", [10, 1]),
    ]);
    expect(filas.map((f) => f.entidad)).toEqual(["17"]);
  });
});

describe("lecturaDeSistema", () => {
  const filas = [
    fila("01", "Uno", [100, 0]),
    fila("02", "Dos", [300, 0]),
    fila("03", "Tres", [200, 100]),
    fila("04", "Cuatro", [50, 50]),
    fila("05", "Cinco", [1, 0]),
    fila("06", "Seis", [40, 10]),
    fila("07", "Siete", [30, 10]),
    fila("08", "Ocho", [8, 7]),
  ];
  const lectura = lecturaDeSistema(filas, "s3");

  it("lista los estados en cero, primero los de más registros", () => {
    expect(lectura.enCero.map((f) => f.nombre)).toEqual(["Dos", "Uno"]);
  });

  it("deja aparte los ceros con un denominador demasiado bajo para concluir", () => {
    expect(lectura.denominadorBajo.map((f) => f.nombre)).toEqual(["Cinco", "Ocho"]);
    expect(lectura.enCero.map((f) => f.nombre)).not.toContain("Cinco");
  });

  it("ordena las mayores brechas y calcula cuánto concentran", () => {
    expect(lectura.mayoresBrechas.map((f) => f.nombre)).toEqual([
      "Dos",
      "Tres",
      "Uno",
      "Seis",
      "Siete",
    ]);
    expect(lectura.brechaTotal).toBe(300 + 100 + 100 + 30 + 20 + 1 + 1);
    expect(lectura.concentracionBrechas).toBe(Math.round((550 / 552) * 1000) / 10);
  });

  it("un empate en brecha se resuelve por nombre, para que el orden sea estable", () => {
    const empate = lecturaDeSistema(
      [fila("01", "Beta", [20, 10]), fila("02", "Alfa", [20, 10])],
      "s3",
    );
    expect(empate.mayoresBrechas.map((f) => f.nombre)).toEqual(["Alfa", "Beta"]);
  });

  it("cuenta los estados completos", () => {
    expect(lectura.completos.map((f) => f.nombre)).toEqual(["Cuatro"]);
  });

  it("no incluye estados sin registros obligados", () => {
    const vacia = lecturaDeSistema([fila("01", "Uno", [0, 0])], "s3");
    expect(vacia.enCero).toEqual([]);
    expect(vacia.mayoresBrechas).toEqual([]);
    expect(vacia.concentracionBrechas).toBeNull();
  });
});

describe("textoLectura", () => {
  const filas = [fila("02", "Dos", [300, 0]), fila("03", "Tres", [200, 100])];

  it("dice dónde conviene priorizar la integración, con cifras", () => {
    const texto = textoLectura(lecturaDeSistema(filas, "s3"), "s3");
    expect(texto.cero).toBe("1 estado sin ningún registro marcado como conectado a S3: Dos.");
    expect(texto.prioridad).toContain("Dos (300 de 300 por conectar)");
    expect(texto.prioridad).toContain("priorizar la integración");
  });

  it("no acusa: habla de información, nunca de conducta de un ente", () => {
    const { cero, prioridad, nulo } = textoLectura(lecturaDeSistema(filas, "s3"), "s3");
    for (const frase of [cero, prioridad, nulo]) {
      expect(frase ?? "").not.toMatch(/riesgo|corrup|sospech|opac|incumpl|irregular|omis/i);
    }
  });

  it("si ningún estado está en cero lo dice, en vez de inventar un hueco", () => {
    const texto = textoLectura(lecturaDeSistema([fila("03", "Tres", [200, 100])], "s3"), "s3");
    expect(texto.cero).toBe("Todos los estados tienen al menos un registro conectado a S3.");
    expect(texto.nulo).toBeNull();
  });

  it("un cero con denominador bajo no se presenta como cobertura total", () => {
    const texto = textoLectura(
      lecturaDeSistema([fila("03", "Tres", [200, 100]), fila("29", "Tlaxcala", [1, 0])], "s3"),
      "s3",
    );
    expect(texto.cero).toBe(
      "Fuera de los estados con menos de 10 registros, todos tienen al menos uno conectado a S3.",
    );
    expect(texto.nulo).toContain("Tlaxcala");
  });

  it("sin nada por conectar lo dice sin proponer prioridad", () => {
    const texto = textoLectura(lecturaDeSistema([fila("03", "Tres", [20, 20])], "s3"), "s3");
    expect(texto.prioridad).toMatch(/^No quedan registros por conectar/);
  });

  it("varios estados en cero se enumeran en plural", () => {
    const texto = textoLectura(
      lecturaDeSistema([fila("01", "Uno", [20, 0]), fila("02", "Dos", [30, 0])], "s3"),
      "s3",
    );
    expect(texto.cero).toBe("2 estados sin ningún registro marcado como conectado a S3: Dos, Uno.");
  });
});

describe("ordenarPorCobertura y etiquetaPorcentaje", () => {
  it("va de menos a más cobertura; en un empate, primero donde hay más por conectar", () => {
    const orden = ordenarPorCobertura(
      [
        fila("01", "Uno", [10, 5]),
        fila("02", "Dos", [10, 0]),
        fila("03", "Tres", [300, 0]),
        fila("04", "Cuatro", [0, 0]),
      ],
      "s3",
    );
    expect(orden.map((f) => f.nombre)).toEqual(["Tres", "Dos", "Uno", "Cuatro"]);
  });

  it("escribe el decimal y distingue lo que no aplica", () => {
    expect(etiquetaPorcentaje(44.7)).toBe("44.7%");
    expect(etiquetaPorcentaje(0)).toBe("0%");
    expect(etiquetaPorcentaje(null)).toBe("n/d");
  });
});

describe("enlaceCobertura", () => {
  it("conserva el trimestre y el estado, y lleva a la sección", () => {
    expect(enlaceCobertura("s6", "2026-T3", "17")).toBe(
      "/tablero?periodo=2026-T3&estado=17&cobertura=s6#cobertura-pdn",
    );
    expect(enlaceCobertura("s1", "2026-T3", null)).toBe(
      "/tablero?periodo=2026-T3&cobertura=s1#cobertura-pdn",
    );
  });
});
