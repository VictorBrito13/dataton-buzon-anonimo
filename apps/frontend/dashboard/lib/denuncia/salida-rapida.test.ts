import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SITIO_NEUTRO,
  crearDetectorEscape,
  ejecutarSalidaRapida,
  limpiarRastro,
} from "./salida-rapida";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("limpiarRastro", () => {
  it("borra solo las claves buzon: del almacenamiento local y toda la sesión", () => {
    localStorage.setItem("buzon:borrador", "x");
    localStorage.setItem("buzon:otra", "y");
    localStorage.setItem("ajena", "z");
    sessionStorage.setItem("algo", "1");
    limpiarRastro(localStorage, sessionStorage);
    expect(localStorage.getItem("buzon:borrador")).toBeNull();
    expect(localStorage.getItem("buzon:otra")).toBeNull();
    expect(localStorage.getItem("ajena")).toBe("z");
    expect(sessionStorage.length).toBe(0);
  });
});

describe("ejecutarSalidaRapida", () => {
  it("navega al sitio neutro después de limpiar", () => {
    localStorage.setItem("buzon:borrador", "x");
    const navegar = vi.fn();
    ejecutarSalidaRapida({
      obtenerLocal: () => localStorage,
      obtenerSesion: () => sessionStorage,
      navegar,
    });
    expect(localStorage.getItem("buzon:borrador")).toBeNull();
    expect(navegar).toHaveBeenCalledWith(SITIO_NEUTRO);
  });

  it("sale aunque el almacenamiento esté bloqueado", () => {
    const navegar = vi.fn();
    const obtener = () => {
      throw new Error("bloqueado");
    };
    ejecutarSalidaRapida({ obtenerLocal: obtener, obtenerSesion: obtener, navegar });
    expect(navegar).toHaveBeenCalledWith(SITIO_NEUTRO);
  });

  it("el sitio neutro no revela nada en la URL", () => {
    expect(SITIO_NEUTRO).toMatch(/^https:\/\//);
    expect(SITIO_NEUTRO).not.toMatch(/denuncia|buzon|corrup/i);
  });
});

describe("crearDetectorEscape", () => {
  it("se activa con tres pulsaciones dentro de la ventana", () => {
    const pulsar = crearDetectorEscape(1500);
    expect(pulsar(0)).toBe(false);
    expect(pulsar(400)).toBe(false);
    expect(pulsar(800)).toBe(true);
  });

  it("no se activa si las pulsaciones están separadas", () => {
    const pulsar = crearDetectorEscape(1500);
    expect(pulsar(0)).toBe(false);
    expect(pulsar(1000)).toBe(false);
    expect(pulsar(2000)).toBe(false);
    expect(pulsar(2100)).toBe(true);
  });
});
