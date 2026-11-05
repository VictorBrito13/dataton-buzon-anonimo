import { describe, expect, it } from "vitest";
import {
  agregarCobertura,
  comoCsvCobertura,
  contrastarConS3,
  type EnteCatalogo,
} from "./cobertura.js";

const ente = (parcial: Partial<EnteCatalogo> = {}): EnteCatalogo => ({
  ambitoGobierno: "Estatal",
  controlOIC: false,
  controlTribunal: false,
  sistema1: false,
  sistema2: false,
  sistema3: false,
  sistema6: false,
  entidad: "17",
  date_created: "2024-06-22T06:10:21.377Z",
  date_updated: null,
  ...parcial,
});

const organoControl = (parcial: Partial<EnteCatalogo> = {}): EnteCatalogo =>
  ente({ controlOIC: true, ...parcial });

const tribunal = (parcial: Partial<EnteCatalogo> = {}): EnteCatalogo =>
  ente({ controlTribunal: true, ...parcial });

describe("agregarCobertura: a quién se le pide cada sistema", () => {
  it("un órgano interno de control no cuenta en el denominador de S1, S2 ni S6", () => {
    const { nacional } = agregarCobertura([ente({ sistema1: true }), organoControl()]);
    expect(nacional.s1).toEqual({ aplicables: 1, conectados: 1, porcentaje: 100 });
    expect(nacional.s2).toEqual({ aplicables: 1, conectados: 0, porcentaje: 0 });
    expect(nacional.s6).toEqual({ aplicables: 1, conectados: 0, porcentaje: 0 });
  });

  it("un sujeto obligado no cuenta en el denominador de S3", () => {
    const { nacional } = agregarCobertura([ente(), organoControl({ sistema3: true })]);
    expect(nacional.s3).toEqual({ aplicables: 1, conectados: 1, porcentaje: 100 });
  });

  it("un tribunal cuenta en todos los sistemas, como en el tablero de la PDN", () => {
    const { nacional } = agregarCobertura([tribunal({ sistema1: true, sistema3: true })]);
    expect(nacional.s1).toEqual({ aplicables: 1, conectados: 1, porcentaje: 100 });
    expect(nacional.s2).toEqual({ aplicables: 1, conectados: 0, porcentaje: 0 });
    expect(nacional.s3).toEqual({ aplicables: 1, conectados: 1, porcentaje: 100 });
    expect(nacional.tribunales).toBe(1);
  });

  it("una bandera en un sistema que no le corresponde no se cuenta, y queda registrada", () => {
    const { nacional, banderasFueraDeAlcance } = agregarCobertura([
      ente({ sistema3: true }),
      organoControl({ sistema1: true }),
    ]);
    expect(nacional.s1.conectados).toBe(0);
    expect(nacional.s3.conectados).toBe(0);
    expect(nacional.sinConexion).toBe(2);
    expect(banderasFueraDeAlcance).toBe(2);
  });
});

describe("agregarCobertura: cortes", () => {
  const entes = [
    ente({ entidad: "17", ambitoGobierno: "Estatal", sistema1: true }),
    ente({ entidad: "17", ambitoGobierno: "Municipal" }),
    organoControl({ entidad: "17", ambitoGobierno: "Municipal", sistema3: true }),
    ente({ entidad: "06", ambitoGobierno: "Estatal", sistema2: true, sistema6: true }),
    ente({ entidad: "00", ambitoGobierno: "Federal", sistema1: true }),
    organoControl({ entidad: "00", ambitoGobierno: "Federal" }),
  ];

  it("separa cada registro en sujeto obligado, órgano de control o tribunal", () => {
    const { nacional } = agregarCobertura([...entes, tribunal({ entidad: "06" })]);
    expect(nacional.registros).toBe(7);
    expect(nacional.sujetosObligados).toBe(4);
    expect(nacional.organosControl).toBe(2);
    expect(nacional.tribunales).toBe(1);
  });

  it("agrupa por entidad, en orden de clave, y nombra a la Federación", () => {
    const { porEntidad } = agregarCobertura(entes);
    expect(porEntidad.map((f) => [f.entidad, f.nombre])).toEqual([
      ["00", "Federación"],
      ["06", "Colima"],
      ["17", "Morelos"],
    ]);
    expect(porEntidad[2]?.s1).toEqual({ aplicables: 2, conectados: 1, porcentaje: 50 });
  });

  it("agrupa por ámbito en orden federal, estatal, municipal", () => {
    const { porAmbito } = agregarCobertura(entes);
    expect(porAmbito.map((f) => [f.ambito, f.registros])).toEqual([
      ["Federal", 2],
      ["Estatal", 2],
      ["Municipal", 2],
    ]);
  });

  it("cruza entidad y ámbito, sin filas vacías", () => {
    const { porEntidadAmbito } = agregarCobertura(entes);
    expect(porEntidadAmbito.map((f) => `${f.entidad}-${f.ambito}`)).toEqual([
      "00-Federal",
      "06-Estatal",
      "17-Estatal",
      "17-Municipal",
    ]);
  });

  it("los cortes suman lo mismo que el total nacional", () => {
    const { nacional, porEntidad, porAmbito, porEntidadAmbito } = agregarCobertura(entes);
    for (const corte of [porEntidad, porAmbito, porEntidadAmbito]) {
      expect(corte.reduce((suma, f) => suma + f.registros, 0)).toBe(nacional.registros);
      expect(corte.reduce((suma, f) => suma + f.s1.conectados, 0)).toBe(nacional.s1.conectados);
      expect(corte.reduce((suma, f) => suma + f.s3.aplicables, 0)).toBe(nacional.s3.aplicables);
      expect(corte.reduce((suma, f) => suma + f.sinConexion, 0)).toBe(nacional.sinConexion);
    }
  });
});

describe("agregarCobertura: porcentajes y fechas", () => {
  it("sin registros obligados el porcentaje es nulo, no cero", () => {
    const { nacional } = agregarCobertura([ente()]);
    expect(nacional.s3).toEqual({ aplicables: 0, conectados: 0, porcentaje: null });
  });

  it("redondea a un decimal", () => {
    const { nacional } = agregarCobertura([ente({ sistema1: true }), ente(), ente()]);
    expect(nacional.s1.porcentaje).toBe(33.3);
  });

  it("cuenta los registros sin ninguna conexión y su porcentaje", () => {
    const { nacional } = agregarCobertura([ente({ sistema6: true }), ente(), organoControl()]);
    expect(nacional.sinConexion).toBe(2);
    expect(nacional.porcentajeSinConexion).toBe(66.7);
  });

  it("toma la última modificación del catálogo, de edición o de alta", () => {
    const { ultimaModificacion } = agregarCobertura([
      ente({ date_created: "2024-01-01T00:00:00.000Z", date_updated: "2026-10-21T03:39:30.075Z" }),
      ente({ date_created: "2026-10-20T22:34:17.129Z", date_updated: null }),
    ]);
    expect(ultimaModificacion).toBe("2026-10-21");
  });
});

describe("agregarCobertura: no asume lo que no viene", () => {
  it("se niega si una bandera no es booleana", () => {
    expect(() => agregarCobertura([ente({ sistema3: null as unknown as boolean })])).toThrow(
      /sistema3/,
    );
    expect(() => agregarCobertura([ente({ controlOIC: undefined as unknown as boolean })])).toThrow(
      /controlOIC/,
    );
  });

  it("se niega ante una entidad o un ámbito desconocidos", () => {
    expect(() => agregarCobertura([ente({ entidad: "33" })])).toThrow(/entidad/);
    expect(() => agregarCobertura([ente({ ambitoGobierno: "Regional" })])).toThrow(/ámbito/);
  });

  it("se niega si un registro es órgano de control y tribunal a la vez", () => {
    expect(() => agregarCobertura([ente({ controlOIC: true, controlTribunal: true })])).toThrow(
      /a la vez/,
    );
  });

  it("no conserva datos de un ente individual", () => {
    const nombre = "AYUNTAMIENTO DE PRUEBA";
    const crudo = { ...ente(), nombre, id: 9_999 } as EnteCatalogo;
    const texto = JSON.stringify(agregarCobertura([crudo]));
    expect(texto).not.toContain(nombre);
    expect(texto).not.toContain("9999");
  });
});

describe("contrastarConS3", () => {
  const { porEntidad } = agregarCobertura([
    organoControl({ entidad: "17", sistema3: true }),
    organoControl({ entidad: "06" }),
    organoControl({ entidad: "01", sistema3: true }),
    organoControl({ entidad: "00", ambitoGobierno: "Federal" }),
  ]);

  it("señala estados con registros en S3 y ninguna bandera, y al revés", () => {
    const contraste = contrastarConS3(porEntidad, [
      { estado: "06", registros: 12 },
      { estado: "17", registros: 3 },
    ]);
    expect(contraste.conRegistrosSinConexion).toEqual([{ estado: "06", registros: 12 }]);
    expect(contraste.conConexionSinRegistros).toEqual([{ estado: "01", conectados: 1 }]);
  });

  it("no compara a la Federación, que no tiene proveedor general en S3", () => {
    const contraste = contrastarConS3(porEntidad, [{ estado: "00", registros: 5 }]);
    expect(contraste.conRegistrosSinConexion).toEqual([]);
  });
});

describe("comoCsvCobertura", () => {
  const agregado = agregarCobertura([
    ente({ entidad: "17", ambitoGobierno: "Estatal", sistema1: true }),
    organoControl({ entidad: "00", ambitoGobierno: "Federal" }),
  ]);
  const csv = comoCsvCobertura(agregado, "2026-11-05");
  const [cabecera = "", ...lineas] = csv.trim().split("\n");

  it("tiene una columna por dato y marca que no son denuncias ni llevan k", () => {
    expect(cabecera).toBe(
      "corte,entidad,ambito,nombre,registros,sujetos_obligados,organos_control,tribunales," +
        "s1_aplicables,s1_conectados,s1_porcentaje,s2_aplicables,s2_conectados,s2_porcentaje," +
        "s3_aplicables,s3_conectados,s3_porcentaje,s6_aplicables,s6_conectados,s6_porcentaje," +
        "sin_conexion,sin_conexion_porcentaje,consultado_el,datos_sinteticos,k_anonimato",
    );
    expect(lineas[0]).toMatch(/,2026-11-05,false,no_aplica$/);
  });

  it("incluye cada corte: nacional, ámbito, entidad y entidad por ámbito", () => {
    const cortes = new Set(lineas.map((l) => l.split(",")[0]));
    expect([...cortes]).toEqual(["nacional", "ambito", "entidad", "entidad_ambito"]);
    expect(lineas[0]).toMatch(/^nacional,,,Nacional,2,1,1,0,/);
    expect(lineas).toContain(
      "entidad_ambito,17,Estatal,Morelos,1,1,0,0,1,1,100,1,0,0,0,0,,1,0,0,0,0,2026-11-05,false,no_aplica",
    );
  });

  it("un porcentaje sin registros obligados sale vacío", () => {
    const fila = lineas.find((l) => l.startsWith("entidad,00,"));
    // S1 no aplica: en la Federación de este ejemplo solo hay un órgano de control.
    expect(fila).toContain(",0,0,,");
  });

  it("entrecomilla un nombre con coma", () => {
    expect(
      comoCsvCobertura(
        {
          ...agregado,
          porEntidad: [{ ...agregado.nacional, nombre: "Nombre, con coma" }],
          porAmbito: [],
          porEntidadAmbito: [],
        },
        "2026-11-05",
      ),
    ).toContain('"Nombre, con coma"');
  });
});
