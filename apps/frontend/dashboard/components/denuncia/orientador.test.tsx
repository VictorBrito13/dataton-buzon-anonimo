import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ariaCampo } from "@/components/ui";
import { Orientador } from "./orientador";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Formulario() {
  const [tipoFalta, setTipoFalta] = useState("");
  return (
    <>
      <select
        {...ariaCampo("tipoFalta")}
        value={tipoFalta}
        onChange={(e) => setTipoFalta(e.target.value)}
      >
        <option value="">Elige una opción</option>
        <option value="cohecho">Cohecho</option>
        <option value="otra">Otra</option>
      </select>
      <Orientador tipoFaltaActual={tipoFalta} alElegir={setTipoFalta} />
    </>
  );
}

let contenedor: HTMLDivElement;
let raiz: Root;

const panel = () => contenedor.querySelector("details") as HTMLDetailsElement;
const campo = () => contenedor.querySelector("select") as HTMLSelectElement;
const anuncio = () => contenedor.querySelector("[aria-live]") as HTMLElement;

const clic = (elemento: Element) =>
  act(() => elemento.dispatchEvent(new MouseEvent("click", { bubbles: true })));

const radioCon = (texto: string) =>
  [...contenedor.querySelectorAll("label")]
    .find((l) => l.textContent?.includes(texto))
    ?.querySelector("input") as HTMLInputElement;

const usarSugerencia = () => {
  panel().open = true;
  act(() => panel().dispatchEvent(new Event("toggle")));
  clic(radioCon("Alguien que trabaja en gobierno"));
  clic(radioCon("Pidió dinero"));
  const boton = [...contenedor.querySelectorAll("button")].find(
    (b) => b.textContent === "Usar esta opción",
  ) as HTMLButtonElement;
  clic(boton);
};

beforeEach(() => {
  contenedor = document.createElement("div");
  document.body.append(contenedor);
  raiz = createRoot(contenedor);
  act(() => raiz.render(<Formulario />));
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
});

describe("Orientador", () => {
  it("al usar la sugerencia aplica el tipo, cierra el panel y lleva el foco al campo", () => {
    usarSugerencia();
    expect(campo().value).toBe("cohecho");
    expect(panel().open).toBe(false);
    expect(document.activeElement).toBe(campo());
  });

  it("confirma con una región viva que sigue activa con el panel cerrado", () => {
    expect(anuncio().closest("details")).toBeNull();
    expect(anuncio().textContent).toBe("");
    usarSugerencia();
    expect(anuncio().getAttribute("aria-live")).toBe("polite");
    expect(anuncio().textContent).toMatch(/Elegimos .*Cohecho/);
  });

  it("deja de confirmar si la persona cambia el tipo a mano", () => {
    usarSugerencia();
    act(() => {
      const asignar = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      asignar?.call(campo(), "otra");
      campo().dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(anuncio().textContent).toBe("");
  });

  it("se puede volver a abrir y a anunciar la misma opción", () => {
    usarSugerencia();
    panel().open = true;
    act(() => panel().dispatchEvent(new Event("toggle")));
    expect(panel().open).toBe(true);
    expect(anuncio().textContent).toBe("");
  });
});
