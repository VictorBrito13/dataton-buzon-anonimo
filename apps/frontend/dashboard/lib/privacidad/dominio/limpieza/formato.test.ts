import { describe, expect, it } from "vitest";
import { jpegSinMetadatos, pngSinMetadatos, unir, webpAnimada } from "./ejemplos";
import { detectarFormato, motivoDeRechazo } from "./formato";

const texto = (s: string) => new TextEncoder().encode(s);

describe("detectarFormato", () => {
  it("se guía por el contenido, no por el nombre del archivo", () => {
    expect(detectarFormato(jpegSinMetadatos())).toBe("jpeg");
    expect(detectarFormato(pngSinMetadatos())).toBe("png");
    expect(detectarFormato(webpAnimada())).toBe("webp");
    expect(detectarFormato(texto("%PDF-1.7\n"))).toBe("pdf");
    expect(detectarFormato(Uint8Array.of(0x50, 0x4b, 3, 4, 0, 0))).toBe("office");
  });
  it("no reconoce otros formatos", () => {
    expect(detectarFormato(texto("hola mundo"))).toBeNull();
    expect(detectarFormato(new Uint8Array())).toBeNull();
    expect(detectarFormato(texto("MZ ejecutable"))).toBeNull();
  });
});

describe("motivoDeRechazo", () => {
  it("explica los casos comunes en lenguaje claro", () => {
    const heic = unir(Uint8Array.of(0, 0, 0, 24), texto("ftypheic"));
    expect(motivoDeRechazo(heic)).toMatch(/HEIC/);
    const antiguo = Uint8Array.of(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    expect(motivoDeRechazo(antiguo)).toMatch(/Office antiguo o protegido/);
    expect(motivoDeRechazo(texto("cualquier cosa"))).toMatch(/JPEG, PNG, WebP, PDF/);
  });
});
