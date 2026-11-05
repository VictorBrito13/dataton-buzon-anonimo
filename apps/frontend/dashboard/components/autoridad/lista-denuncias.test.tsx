import type { RespuestaListadoAutoridad } from "@dataton/shared";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** La URL es la fuente de verdad de la página; aquí la controla la prueba. */
let consultaActual = new URLSearchParams();
vi.mock("next/navigation", () => ({
  usePathname: () => "/autoridad",
  useSearchParams: () => consultaActual,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...resto }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}));
vi.mock("./use-nombres", () => ({
  useNombres: () => ({
    municipio: (m: string | null) => m ?? "—",
    ente: (e: string | null) => e ?? "—",
  }),
}));
const listarDenuncias = vi.fn<(c: { pagina: number }) => Promise<RespuestaListadoAutoridad>>();
vi.mock("@/lib/autoridad/api", async (importar) => ({
  ...(await importar<typeof import("@/lib/autoridad/api")>()),
  listarDenuncias: (consulta: { pagina: number }) => listarDenuncias(consulta),
}));

import { ProveedorPanel } from "./contexto";
import { ListaDenuncias } from "./lista-denuncias";

const resumen = (n: number) => ({
  id: `6f1c1c1e-3f0a-4a53-9a55-0d3f6a1b2${String(n).padStart(4, "0")}`,
  estado: "17" as const,
  municipio: null,
  tipoFalta: "cohecho" as const,
  enteId: null,
  etapa: "recibida" as const,
  recibidaDia: "2026-03-01",
});

const pagina = (numero: number, total: number, porPagina = 50): RespuestaListadoAutoridad => {
  const desde = (numero - 1) * porPagina;
  const cantidad = Math.max(0, Math.min(porPagina, total - desde));
  return {
    denuncias: Array.from({ length: cantidad }, (_, i) => resumen(desde + i)),
    total,
    pagina: numero,
    porPagina,
  };
};

let contenedor: HTMLDivElement;
let raiz: Root;
let replaceState: ReturnType<typeof vi.spyOn>;

const boton = (nombre: string) =>
  [...contenedor.querySelectorAll("button")].find((b) =>
    (b.getAttribute("aria-label") ?? b.textContent ?? "").includes(nombre),
  ) as HTMLButtonElement;
const estado = () => contenedor.querySelector("[role=status]")?.textContent ?? "";

const montar = async (consulta: string, respuesta: RespuestaListadoAutoridad) => {
  consultaActual = new URLSearchParams(consulta);
  listarDenuncias.mockResolvedValue(respuesta);
  await act(async () => {
    raiz.render(
      <ProveedorPanel>
        <ListaDenuncias />
      </ProveedorPanel>,
    );
  });
};

/** Simula lo que hace el enrutador de Next al cambiar la URL: entregar la nueva consulta. */
const navegarA = async (consulta: string, respuesta: RespuestaListadoAutoridad) => {
  consultaActual = new URLSearchParams(consulta);
  listarDenuncias.mockResolvedValue(respuesta);
  await act(async () => {
    raiz.render(
      <ProveedorPanel>
        <ListaDenuncias />
      </ProveedorPanel>,
    );
  });
};

beforeEach(() => {
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
  listarDenuncias.mockReset();
  replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  replaceState.mockRestore();
});

describe("ListaDenuncias con paginación", () => {
  it("pide al servidor la página de la URL con sus filtros", async () => {
    await montar("pagina=2&etapa=recibida", pagina(2, 120));
    expect(listarDenuncias).toHaveBeenLastCalledWith({ pagina: 2, etapa: "recibida" });
    expect(contenedor.querySelectorAll("tbody tr")).toHaveLength(50);
  });

  it("describe el tramo visible y ofrece controles accesibles de página", async () => {
    await montar("", pagina(1, 120));
    expect(estado()).toBe("Denuncias 1 a 50 de 120. Página 1 de 3.");
    const navegacion = contenedor.querySelector("nav[aria-label]") as HTMLElement;
    expect(navegacion.getAttribute("aria-label")).toMatch(/Páginas/);
    expect(boton("Página anterior").disabled).toBe(true);
    expect(boton("Página siguiente").disabled).toBe(false);
  });

  it("al avanzar escribe la página en la URL y vuelve a pedir al servidor", async () => {
    await montar("", pagina(1, 120));
    await act(async () => {
      boton("Página siguiente").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/autoridad?pagina=2");

    await navegarA("pagina=2", pagina(2, 120));
    expect(listarDenuncias).toHaveBeenLastCalledWith({ pagina: 2 });
    expect(estado()).toBe("Denuncias 51 a 100 de 120. Página 2 de 3.");
    expect(boton("Página anterior").disabled).toBe(false);

    await navegarA("pagina=3", pagina(3, 120));
    expect(estado()).toBe("Denuncias 101 a 120 de 120. Página 3 de 3.");
    expect(boton("Página siguiente").disabled).toBe(true);
  });

  it("con una sola página no muestra controles de paginación", async () => {
    await montar("", pagina(1, 2));
    expect(estado()).toBe("2 de 2 denuncias");
    expect(contenedor.querySelector("nav[aria-label]")).toBeNull();
  });

  it("cambiar un filtro vuelve a la primera página", async () => {
    await montar("pagina=3", pagina(3, 120));
    const selector = contenedor.querySelector("#filtro-etapa") as HTMLSelectElement;
    await act(async () => {
      selector.value = "recibida";
      selector.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/autoridad?etapa=recibida");
  });

  it("si la página pedida ya no existe, lleva a la última", async () => {
    await montar("pagina=9", pagina(9, 120));
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/autoridad?pagina=3");
  });
});
