import { describe, expect, it } from "vitest";
import { diaDe, diaAnterior } from "../../src/compartido/dominio/dia.js";
import { LimiteIntentos } from "../../src/compartido/dominio/limite-intentos.js";
import { selloBienFormado } from "../../src/compartido/dominio/sello.js";
import { Semaforo } from "../../src/compartido/dominio/semaforo.js";

describe("Semaforo", () => {
  it("deja pasar hasta el máximo y hace esperar al siguiente hasta que alguien libere", async () => {
    const semaforo = new Semaforo({ maximo: 2, esperaMaxMs: 1000 });
    const a = await semaforo.adquirir();
    const b = await semaforo.adquirir();
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(semaforo.ocupados).toBe(2);
    let tercero: (() => void) | null | "esperando" = "esperando";
    const espera = semaforo.adquirir().then((l) => (tercero = l));
    await new Promise((r) => setTimeout(r, 20));
    expect(tercero).toBe("esperando");
    a?.();
    await espera;
    expect(tercero).not.toBe("esperando");
    expect(tercero).not.toBeNull();
    expect(semaforo.ocupados).toBe(2);
  });

  it("devuelve null si la espera acotada se agota, sin ocupar lugar", async () => {
    const semaforo = new Semaforo({ maximo: 1, esperaMaxMs: 30 });
    const unico = await semaforo.adquirir();
    expect(await semaforo.adquirir()).toBeNull();
    expect(semaforo.ocupados).toBe(1);
    unico?.();
    expect(semaforo.ocupados).toBe(0);
    expect(await semaforo.adquirir()).not.toBeNull();
  });

  it("liberar dos veces no abre un lugar de más", async () => {
    const semaforo = new Semaforo({ maximo: 1, esperaMaxMs: 10 });
    const liberar = (await semaforo.adquirir()) as () => void;
    liberar();
    liberar();
    expect(semaforo.ocupados).toBe(0);
    const otro = await semaforo.adquirir();
    expect(otro).not.toBeNull();
    expect(await semaforo.adquirir()).toBeNull();
  });
});

describe("dia", () => {
  it("redondea cualquier instante al día, sin hora", () => {
    expect(diaDe(new Date("2026-03-09T23:59:59.999Z"))).toBe("2026-03-09");
  });

  it("calcula el día anterior, cruzando meses", () => {
    expect(diaAnterior("2026-03-01")).toBe("2026-02-28");
  });
});

describe("LimiteIntentos", () => {
  const limite = () => new LimiteIntentos({ maximo: 2, ventanaMs: 1000, maxClaves: 2 });

  it("permite hasta el máximo por clave y rechaza después", () => {
    const l = limite();
    expect([l.permitir("a", 0), l.permitir("a", 1), l.permitir("a", 2)]).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("no mezcla claves distintas", () => {
    const l = limite();
    l.permitir("a", 0);
    l.permitir("a", 0);
    expect(l.permitir("b", 0)).toBe(true);
  });

  it("reinicia el conteo al terminar la ventana", () => {
    const l = limite();
    l.permitir("a", 0);
    l.permitir("a", 0);
    expect(l.permitir("a", 1000)).toBe(true);
  });

  it("falla cerrado si la memoria de claves está llena de ventanas vigentes", () => {
    const l = limite();
    l.permitir("a", 0);
    l.permitir("b", 0);
    expect(l.permitir("c", 1)).toBe(false);
  });

  it("libera claves vencidas cuando se llena", () => {
    const l = limite();
    l.permitir("a", 0);
    l.permitir("b", 0);
    expect(l.permitir("c", 1000)).toBe(true);
  });
});

describe("selloBienFormado", () => {
  const sello = (largo: number, version = 1) => {
    const bytes = new Uint8Array(largo);
    bytes[0] = version;
    return bytes;
  };

  it("acepta versión 1 con cabecera y etiqueta completas", () => {
    expect(selloBienFormado(sello(94))).toBe(true);
  });

  it("rechaza contenido demasiado corto para ser un sello", () => {
    expect(selloBienFormado(sello(93))).toBe(false);
  });

  it("rechaza texto claro, cuya versión no coincide", () => {
    expect(selloBienFormado(new TextEncoder().encode("x".repeat(200)))).toBe(false);
  });
});
